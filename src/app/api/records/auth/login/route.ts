import { NextRequest, NextResponse } from "next/server";
import type { Session } from "@supabase/supabase-js";
import { createServerSupabaseAuthClient } from "@/lib/supabaseClient";
import {
  getAccessTokenAal,
  isRecordsMfaRequired,
  isSupabaseRecordsMode,
  setRecordsSessionCookies,
} from "@/lib/records/authServer";
import { demoCaseId } from "@/lib/records/seed";
import { upsertRecordsProfile } from "@/lib/records/profileServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

const failedLoginWindowMs = 5 * 60 * 1000;
const maxFailedLogins = 8;
const failedLogins = new Map<string, { count: number; resetAt: number }>();

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Supabase records auth is not enabled.",
      detail: "Set RECORDS_STORAGE_MODE=supabase and NEXT_PUBLIC_RECORDS_STORAGE_MODE=supabase.",
    },
    { status: 501 }
  );
}

function clientKey(request: NextRequest, email: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || "unknown";
  return `${ip}:${email.toLowerCase()}`;
}

function isLimited(key: string) {
  const current = failedLogins.get(key);
  if (!current) return false;
  if (current.resetAt <= Date.now()) {
    failedLogins.delete(key);
    return false;
  }
  return current.count >= maxFailedLogins;
}

function recordFailedLogin(key: string) {
  const current = failedLogins.get(key);
  const resetAt = Date.now() + failedLoginWindowMs;
  failedLogins.set(key, {
    count: current && current.resetAt > Date.now() ? current.count + 1 : 1,
    resetAt,
  });
}

function sessionBody(input: { userId: string; email: string }) {
  return {
    userId: input.userId,
    caseId: demoCaseId,
    email: input.email,
    authMode: "supabase" as const,
  };
}

async function mfaResponse(input: {
  request: NextRequest;
  authClient: ReturnType<typeof createServerSupabaseAuthClient>;
  session: Session;
}) {
  const assurance = await input.authClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) {
    await recordSecurityEvent({
      type: "auth_mfa_policy_denied",
      severity: "high",
      request: input.request,
      status: 403,
      detail: "Unable to read MFA assurance level.",
    });
    return NextResponse.json({ error: "Unable to verify MFA status." }, { status: 403 });
  }

  if (assurance.data.currentLevel === "aal2" || getAccessTokenAal(input.session.access_token) === "aal2") {
    return null;
  }

  const factors = await input.authClient.auth.mfa.listFactors();
  if (factors.error) {
    await recordSecurityEvent({
      type: "auth_mfa_policy_denied",
      severity: "high",
      request: input.request,
      status: 403,
      detail: "Unable to list MFA factors.",
    });
    return NextResponse.json({ error: "Unable to verify MFA factors." }, { status: 403 });
  }

  const hasVerifiedTotp = factors.data.totp.length > 0;
  if (hasVerifiedTotp || assurance.data.nextLevel === "aal2") {
    const response = NextResponse.json(
      {
        error: "Multi-factor verification required.",
        mfaRequired: true,
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
    setRecordsSessionCookies(response, input.session, demoCaseId);
    await recordSecurityEvent({
      type: "auth_mfa_required",
      severity: "info",
      request: input.request,
      status: 403,
    });
    return response;
  }

  const enrollment = await input.authClient.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Lost to Found Records",
  });

  if (enrollment.error) {
    await recordSecurityEvent({
      type: "auth_mfa_enrollment_failed",
      severity: "high",
      request: input.request,
      status: 403,
      detail: "Unable to start MFA enrollment.",
    });
    return NextResponse.json({ error: "Unable to start MFA enrollment." }, { status: 403 });
  }

  const response = NextResponse.json(
    {
      error: "Authenticator app enrollment required.",
      mfaRequired: true,
      mfaEnrollmentRequired: true,
      enrollment: {
        factorId: enrollment.data.id,
        qrCode: enrollment.data.totp.qr_code,
        secret: enrollment.data.totp.secret,
      },
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
  setRecordsSessionCookies(response, input.session, demoCaseId);
  await recordSecurityEvent({
    type: "auth_mfa_enrollment_started",
    severity: "info",
    request: input.request,
    status: 403,
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode()) return disabledResponse();

  const rateLimit = checkRateLimit(request, {
    id: "records-auth-login",
    limit: 20,
    windowMs: 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = parsed as { email?: unknown; password?: unknown; adultConfirmed?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const adultConfirmed = body.adultConfirmed === true;

  if (!adultConfirmed || !email.includes("@") || password.length < 8) {
    return NextResponse.json({ error: "Check your email, password, and adult-use confirmation." }, { status: 400 });
  }

  const key = clientKey(request, email);
  if (isLimited(key)) {
    return NextResponse.json({ error: "Too many sign-in attempts. Try again shortly." }, { status: 429 });
  }

  const supabase = createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session?.access_token || !data.user?.id) {
    recordFailedLogin(key);
    await recordSecurityEvent({
      type: "auth_login_failed",
      severity: "warning",
      request,
      status: 401,
    });
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  failedLogins.delete(key);

  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (isRecordsMfaRequired()) {
    const mfa = await mfaResponse({ request, authClient: supabase, session: data.session });
    if (mfa) return mfa;
  }

  const session = sessionBody({ userId: data.user.id, email: data.user.email || email });
  await upsertRecordsProfile({ userId: session.userId, email: session.email });
  await recordSecurityEvent({
    type: "auth_login_success",
    severity: "info",
    request,
    userId: session.userId,
    status: 200,
  });

  const response = NextResponse.json(
    {
      session,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
  setRecordsSessionCookies(response, data.session, demoCaseId);
  return response;
}
