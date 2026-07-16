import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  clearRecordsSessionCookies,
  getAccessTokenAal,
  getRecordsSessionAuthClient,
  hasRecordsPasswordRecoveryCookie,
  isRecordsMfaRequired,
  isStrongRecordsPassword,
  isSupabaseRecordsMode,
  mfaRequiredResponse,
  recordsAccessCookieName,
  recordsPasswordMinimumLength,
} from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import {
  checkPwnedPassword,
  isPwnedPasswordCheckEnabled,
} from "@/lib/security/pwnedPasswords";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode()) {
    return NextResponse.json({ error: "Records account access is not enabled." }, { status: 501 });
  }

  const rateLimit = checkRateLimit(request, {
    id: "records-auth-password-update",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const password = typeof (parsed as { password?: unknown }).password === "string"
    ? (parsed as { password: string }).password
    : "";
  const minimumPasswordLength = recordsPasswordMinimumLength();

  if (!isStrongRecordsPassword(password)) {
    return NextResponse.json(
      {
        error: `Use a password between ${minimumPasswordLength} and 128 characters.`,
      },
      { status: 400 }
    );
  }

  let authClient: Awaited<ReturnType<typeof getRecordsSessionAuthClient>>;
  try {
    authClient = await getRecordsSessionAuthClient(request);
  } catch {
    return NextResponse.json({ error: "Open a valid password reset link before changing your password." }, { status: 401 });
  }

  const accessToken = request.cookies.get(recordsAccessCookieName)?.value;
  const mfaSatisfied = !isRecordsMfaRequired() || getAccessTokenAal(accessToken) === "aal2";
  if (!mfaSatisfied && !hasRecordsPasswordRecoveryCookie(request)) {
    await recordSecurityEvent({
      type: "auth_password_update_failed",
      severity: "warning",
      request,
      status: 403,
      detail: "Password update blocked before MFA verification.",
    });
    return mfaRequiredResponse();
  }

  if (isPwnedPasswordCheckEnabled()) {
    const passwordSafety = await checkPwnedPassword(password);
    if (passwordSafety.status === "compromised") {
      await recordSecurityEvent({
        type: "auth_password_update_compromised_password_blocked",
        severity: "warning",
        request,
        status: 400,
      });
      return NextResponse.json(
        { error: "Choose a different password that has not appeared in known data breaches." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (passwordSafety.status === "unavailable") {
      await recordSecurityEvent({
        type: "auth_password_safety_check_unavailable",
        severity: "high",
        request,
        status: 503,
        detail: "Password update paused because the password safety check was unavailable.",
      });
      return NextResponse.json(
        { error: "Password safety verification is temporarily unavailable. Try again shortly." },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } }
      );
    }
  }

  const user = await authClient.auth.getUser();
  const userId = user.data.user?.id;
  const update = await authClient.auth.updateUser({ password });
  if (user.error || update.error || !userId) {
    await recordSecurityEvent({
      type: "auth_password_update_failed",
      severity: "warning",
      request,
      userId,
      status: 400,
    });
    return NextResponse.json({ error: "Unable to update password from this session." }, { status: 400 });
  }

  await recordSecurityEvent({
    type: "auth_password_updated",
    severity: "info",
    request,
    userId,
    status: 200,
  });

  const response = NextResponse.json(
    {
      ok: true,
      message: "Password updated. Sign in again with your new password.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );

  if (accessToken) {
    try {
      await createSupabaseAdminClient().auth.admin.signOut(accessToken, "local");
    } catch {
      // Cookie clearing below is still required even if token revocation fails.
    }
  }
  clearRecordsSessionCookies(response);
  return response;
}
