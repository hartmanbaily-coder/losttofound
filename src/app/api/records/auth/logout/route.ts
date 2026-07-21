import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseAuthClient } from "@/lib/supabaseClient";
import {
  clearRecordsSessionCookies,
  isSupabaseRecordsMode,
  recordsAccessCookieName,
  recordsRefreshCookieName,
} from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, {
    id: "records-auth-logout",
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  const accessToken = request.cookies.get(recordsAccessCookieName)?.value;
  const refreshToken = request.cookies.get(recordsRefreshCookieName)?.value;

  if (isSupabaseRecordsMode() && (accessToken || refreshToken)) {
    try {
      const admin = createSupabaseAdminClient();
      let revoked = false;

      if (accessToken) {
        const { error } = await admin.auth.admin.signOut(accessToken, "local");
        revoked = !error;
      }

      if (!revoked && refreshToken) {
        const authClient = createServerSupabaseAuthClient();
        const { data, error: refreshError } = await authClient.auth.refreshSession({
          refresh_token: refreshToken,
        });
        if (refreshError || !data.session?.access_token) {
          throw refreshError || new Error("Unable to refresh the session for revocation.");
        }

        const { error: signOutError } = await admin.auth.admin.signOut(
          data.session.access_token,
          "local"
        );
        if (signOutError) throw signOutError;
        revoked = true;
      }

      if (!revoked) throw new Error("Server session revocation could not be confirmed.");
    } catch {
      await recordSecurityEvent({
        type: "auth_logout_session_revocation_failed",
        severity: "high",
        request,
        status: 503,
        detail: "Local cookies were cleared, but Supabase refresh-session revocation failed.",
      });
      const response = NextResponse.json(
        {
          ok: false,
          clearLocalSession: true,
          error: "Signed out on this device, but server session revocation could not be confirmed.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
      clearRecordsSessionCookies(response);
      return response;
    }
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  clearRecordsSessionCookies(response);
  return response;
}
