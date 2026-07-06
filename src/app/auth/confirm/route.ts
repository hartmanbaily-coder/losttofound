import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAuthClient } from "@/lib/supabaseClient";
import {
  isSupabaseRecordsMode,
  recordsAppBaseUrl,
  safeRecordsAuthNextPath,
  setRecordsSessionCookies,
} from "@/lib/records/authServer";
import { demoCaseId } from "@/lib/records/seed";
import { upsertRecordsProfile } from "@/lib/records/profileServer";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

const allowedOtpTypes = new Set(["email", "recovery", "signup", "invite", "magiclink", "email_change"]);

export async function GET(request: NextRequest) {
  const baseUrl = recordsAppBaseUrl(request);
  const errorRedirect = new URL("/records?auth=confirm-error", baseUrl);

  if (!isSupabaseRecordsMode()) {
    return NextResponse.redirect(errorRedirect);
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = safeRecordsAuthNextPath(request.nextUrl.searchParams.get("next"));
  const redirectUrl = new URL(next, baseUrl);

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
      type: "auth_email_confirm_failed",
      severity: "warning",
      request,
      status: 401,
    });
    return NextResponse.redirect(errorRedirect);
  }

  await upsertRecordsProfile({ userId: data.user.id, email: data.user.email || "" });
  await recordSecurityEvent({
    type: "auth_email_confirmed",
    severity: "info",
    request,
    userId: data.user.id,
    status: 302,
  });

  const response = NextResponse.redirect(redirectUrl);
  setRecordsSessionCookies(response, data.session, demoCaseId);
  return response;
}
