import { NextRequest, NextResponse } from "next/server";
import {
  attorneyEmailHash,
  hashAttorneyInvitationToken,
  isAttorneyInvitationToken,
  sealAttorneyHandle,
} from "@/lib/records/attorneyCrypto";
import {
  attorneyAcceptanceCookieName,
  clearAttorneyAcceptanceCookie,
  getAttorneyAuthContext,
} from "@/lib/records/attorneyServer";
import { checkAttorneyGuestEntitlement } from "@/lib/records/attorneyEntitlement";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordsCsrfError, verifyRecordsCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, {
    id: "records-attorney-invitation-accept",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);
  if (!verifyRecordsCsrf(request).ok) return recordsCsrfError();
  const entitlement = checkAttorneyGuestEntitlement("");
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: entitlement.reason },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  const context = await getAttorneyAuthContext(request);
  if ("error" in context) return context.error;
  const userLimit = checkRateLimit(request, {
    id: "records-attorney-invitation-accept-user",
    key: context.userId,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (userLimit.limited) return rateLimitExceededResponse(userLimit);

  const token = request.cookies.get(attorneyAcceptanceCookieName)?.value || "";
  if (!isAttorneyInvitationToken(token)) {
    return NextResponse.json(
      { error: "Invitation is invalid, expired, already used, or belongs to another account." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data, error } = await context.supabase.rpc("accept_records_attorney_invitation", {
    p_token_hash: hashAttorneyInvitationToken(token),
    p_attorney_user_id: context.userId,
    p_invited_email_hash: attorneyEmailHash(context.email),
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row?.grant_id) {
    const response = NextResponse.json(
      { error: "Invitation is invalid, expired, already used, or belongs to another account." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
    return clearAttorneyAcceptanceCookie(response);
  }

  const response = NextResponse.json(
    {
      ok: true,
      accessExpiresAt: row.access_expires_at,
      accessHandle: sealAttorneyHandle({
        kind: "grant",
        id: row.grant_id,
        subject: context.userId,
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
  return clearAttorneyAcceptanceCookie(response);
}
