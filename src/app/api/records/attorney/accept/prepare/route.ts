import { NextRequest, NextResponse } from "next/server";
import {
  hashAttorneyInvitationToken,
  isAttorneyInvitationToken,
} from "@/lib/records/attorneyCrypto";
import {
  isSupabaseRecordsMode,
} from "@/lib/records/authServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { setAttorneyAcceptanceCookie } from "@/lib/records/attorneyServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordsCsrfError, verifyRecordsCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const genericBody = {
  ok: true,
  message: "Continue by signing in with the invited account and completing authenticator verification.",
};

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, {
    id: "records-attorney-invitation-prepare",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);
  if (!verifyRecordsCsrf(request).ok) return recordsCsrfError();
  if (!isSupabaseRecordsMode()) {
    return NextResponse.json(genericBody, { headers: { "Cache-Control": "no-store" } });
  }
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  let valid = false;
  if (isAttorneyInvitationToken(token)) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("records_attorney_invitations")
      .select("id")
      .eq("token_hash", hashAttorneyInvitationToken(token))
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    valid = Boolean(data);
  }

  const response = NextResponse.json(genericBody, { headers: { "Cache-Control": "no-store" } });
  return valid ? setAttorneyAcceptanceCookie(response, token) : response;
}
