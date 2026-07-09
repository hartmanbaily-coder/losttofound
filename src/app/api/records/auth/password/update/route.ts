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
