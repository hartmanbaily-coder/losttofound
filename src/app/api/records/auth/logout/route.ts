import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  clearRecordsSessionCookies,
  isSupabaseRecordsMode,
  recordsAccessCookieName,
} from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, {
    id: "records-auth-logout",
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const accessToken = request.cookies.get(recordsAccessCookieName)?.value;

  if (isSupabaseRecordsMode() && accessToken) {
    try {
      await createSupabaseAdminClient().auth.admin.signOut(accessToken, "local");
    } catch {
      // Cookie clearing is still required even if token revocation fails.
    }
  }

  clearRecordsSessionCookies(response);
  return response;
}
