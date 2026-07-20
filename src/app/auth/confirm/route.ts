import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAuthClient } from "@/lib/supabaseClient";
import {
  isSupabaseRecordsMode,
  recordsAppBaseUrl,
  setRecordsPasswordRecoveryCookie,
  setRecordsSessionCookies,
} from "@/lib/records/authServer";
import { demoCaseId } from "@/lib/records/seed";
import { upsertRecordsProfile } from "@/lib/records/profileServer";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

const allowedOtpTypes = new Set(["email", "recovery", "signup"]);

export async function GET(request: NextRequest) {
  const baseUrl = recordsAppBaseUrl(request);
  const errorRedirect = new URL("/records?auth=confirm-error", baseUrl);

  if (!isSupabaseRecordsMode()) {
    return NextResponse.redirect(errorRedirect);
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const isRecovery = type === "recovery";
  const redirectUrl = new URL(
    isRecovery ? "/records?auth=recovery" : "/records?auth=confirmed",
    baseUrl
  );

  if (!tokenHash || !type || !allowedOtpTypes.has(type)) {
    return NextResponse.redirect(errorRedirect);
  }

  const supabase = createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error || !data.session?.access_token || !data.session.refresh_token || !data.user?.id) {
    await recordSecurityEvent({
      type: isRecovery ? "auth_recovery_session_failed" : "auth_email_confirm_failed",
      severity: "warning",
      request,
      status: 401,
    });
    return NextResponse.redirect(errorRedirect);
  }

  await upsertRecordsProfile({ userId: data.user.id, email: data.user.email || "" });
  await recordSecurityEvent({
    type: isRecovery ? "auth_recovery_session_accepted" : "auth_email_confirmed",
    severity: "info",
    request,
    userId: data.user.id,
    status: 307,
  });

  const response = NextResponse.redirect(redirectUrl);
  if (isRecovery) {
    setRecordsSessionCookies(response, data.session, demoCaseId);
    setRecordsPasswordRecoveryCookie(response);
  }
  return response;
}
