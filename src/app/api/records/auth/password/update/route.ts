import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  clearRecordsSessionCookies,
  getRecordsSessionAuthClient,
  hasRecordsPasswordRecoveryCookie,
  isStrongRecordsPassword,
  isSupabaseRecordsMode,
  recordsPasswordMinimumLength,
} from "@/lib/records/authServer";
import {
  attorneyAcceptanceCookieName,
  clearAttorneyPasswordSetupCookie,
  getAttorneyPasswordSetupInvitationId,
} from "@/lib/records/attorneyServer";
import {
  attorneyEmailHash,
  createAttorneyInvitationToken,
  hashAttorneyInvitationToken,
  isAttorneyInvitationToken,
} from "@/lib/records/attorneyCrypto";
import { recordsCredentialVersionClaim } from "@/lib/records/profileServer";
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

  const [user, verifiedClaims, currentSession] = await Promise.all([
    authClient.auth.getUser(),
    authClient.auth.getClaims(),
    authClient.auth.getSession(),
  ]);
  const userId = user.data.user?.id;
  const claims = verifiedClaims.data?.claims as {
    session_id?: unknown;
    sub?: unknown;
  } | undefined;
  const sessionId = typeof claims?.session_id === "string" ? claims.session_id : "";
  const recoveryAuthorized = Boolean(
    !user.error &&
      !verifiedClaims.error &&
      userId &&
      claims?.sub === userId &&
      sessionId &&
      hasRecordsPasswordRecoveryCookie(request, { userId, sessionId })
  );
  if (!recoveryAuthorized) {
    await recordSecurityEvent({
      type: "auth_password_update_failed",
      severity: "warning",
      request,
      userId,
      status: 403,
      detail: "Password update was blocked because verified recovery authorization was missing.",
    });
    return NextResponse.json(
      { error: "Open a valid password reset link before changing your password." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
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

  const update = await authClient.auth.updateUser({ password });
  if (update.error || !userId) {
    await recordSecurityEvent({
      type: "auth_password_update_failed",
      severity: "warning",
      request,
      userId,
      status: 400,
    });
    return NextResponse.json({ error: "Unable to update password from this session." }, { status: 400 });
  }

  const attorneyInvitationId = getAttorneyPasswordSetupInvitationId(request, userId);
  const admin = createSupabaseAdminClient();
  const accessToken = currentSession.data.session?.access_token;
  let revocationFailed = !accessToken || Boolean(currentSession.error);
  if (accessToken) {
    try {
      const revocation = await admin.auth.admin.signOut(accessToken, "global");
      revocationFailed = Boolean(revocation.error);
    } catch {
      revocationFailed = true;
    }
  }
  if (revocationFailed) {
    await recordSecurityEvent({
      type: "auth_password_session_revocation_failed",
      severity: "high",
      request,
      userId,
      status: 503,
      detail: "Password changed, but global session revocation could not be confirmed.",
    });
    const response = NextResponse.json(
      {
        error: attorneyInvitationId
          ? "Password saved, but prior sessions could not be confirmed signed out. Reopen attorney invitation setup and request a fresh secure email link."
          : "Password updated, but other sessions could not be confirmed signed out. Contact support before continuing.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "1" },
      }
    );
    clearRecordsSessionCookies(response);
    if (attorneyInvitationId) clearAttorneyPasswordSetupCookie(response);
    return response;
  }

  if (attorneyInvitationId) {
    const onboardingToken = request.cookies.get(attorneyAcceptanceCookieName)?.value || "";
    const userEmail = user.data.user?.email || "";
    const credentialVersion = createAttorneyInvitationToken();
    const existingAppMetadata = user.data.user?.app_metadata || {};
    let metadataUpdated = false;
    try {
      const metadataUpdate = await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...existingAppMetadata,
          [recordsCredentialVersionClaim]: credentialVersion,
        },
      });
      metadataUpdated = !metadataUpdate.error;
    } catch {
      metadataUpdated = false;
    }
    let finalized: { data: unknown; error: unknown } = { data: false, error: null };
    if (metadataUpdated && isAttorneyInvitationToken(onboardingToken) && userEmail) {
      try {
        finalized = await admin.rpc("complete_records_attorney_password_setup", {
          p_invitation_id: attorneyInvitationId,
          p_onboarding_token_hash: hashAttorneyInvitationToken(onboardingToken),
          p_attorney_user_id: userId,
          p_invited_email_hash: attorneyEmailHash(userEmail),
          p_email: userEmail,
          p_credential_version: credentialVersion,
        });
      } catch (error) {
        finalized = { data: false, error };
      }
    }
    if (finalized.error || finalized.data !== true) {
      await recordSecurityEvent({
        type: "auth_password_update_failed",
        severity: "high",
        request,
        userId,
        status: 503,
        detail: "Password changed and prior sessions were revoked, but invited-attorney onboarding was not finalized.",
      });
      const response = NextResponse.json(
        {
          error: "Password saved and prior sessions signed out, but attorney setup did not finish. Reopen attorney invitation setup and request a fresh secure email link.",
        },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "1" } }
      );
      clearRecordsSessionCookies(response);
      clearAttorneyPasswordSetupCookie(response);
      return response;
    }
  }

  await recordSecurityEvent({
    type: "auth_password_updated",
    severity: "info",
    request,
    userId,
    status: 200,
  });

  const response = NextResponse.json(
    { ok: true, message: "Password updated. Sign in again with your new password." },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
  clearRecordsSessionCookies(response);
  if (attorneyInvitationId) clearAttorneyPasswordSetupCookie(response);
  return response;
}
