import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  clearRecordsSessionCookies,
  getRecordsAuthContext,
  isSupabaseRecordsMode,
  recordsAccessCookieName,
} from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";
import { invalidateAllAttorneyAccessForOwner } from "@/lib/records/attorneyAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readRequestBody(request: NextRequest): Promise<{ confirm?: unknown }> {
  try {
    return (await request.json()) as { confirm?: unknown };
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseRecordsMode()) {
    return NextResponse.json(
      {
        error: "Cloud records account deletion is not enabled.",
        detail: "Sign in to the production records workspace before submitting account deletion.",
      },
      { status: 501 }
    );
  }

  const initialRateLimit = checkRateLimit(request, {
    id: "records-account-deletion-request",
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });
  if (initialRateLimit.limited) return rateLimitExceededResponse(initialRateLimit);

  const context = await getRecordsAuthContext(request);
  if ("error" in context) {
    return (
      context.error ||
      NextResponse.json({ error: "Sign in before requesting account deletion." }, { status: 401 })
    );
  }

  const userRateLimit = checkRateLimit(request, {
    id: "records-account-deletion-request-user",
    key: context.userId,
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (userRateLimit.limited) return rateLimitExceededResponse(userRateLimit);

  const body = await readRequestBody(request);
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Confirm that you want to start complete account deletion." },
      { status: 400 }
    );
  }

  const requestId = randomUUID();
  const requestedAt = new Date().toISOString();
  const { error } = await context.supabase.from("records_audit_logs").insert({
    user_id: context.userId,
    case_id: null,
    entity_type: "account",
    entity_id: requestId,
    action: "deletion_requested",
    metadata_summary:
      "Authenticated user initiated complete account deletion from the account deletion page.",
    created_at: requestedAt,
  });

  if (error) {
    await recordSecurityEvent({
      type: "account_deletion_request_failed",
      severity: "high",
      request,
      userId: context.userId,
      status: 500,
      detail: "Unable to record account deletion request.",
    });
    return NextResponse.json(
      { error: "Unable to record the account deletion request. Contact support." },
      { status: 500 }
    );
  }

  const attorneyInvalidation = await invalidateAllAttorneyAccessForOwner({
    supabase: context.supabase,
    ownerUserId: context.userId,
    reason: "account_deletion_requested",
  });

  const accessToken =
    context.refreshedSession?.access_token ||
    request.cookies.get(recordsAccessCookieName)?.value;

  try {
    if (!accessToken) {
      throw new Error("Authenticated deletion request did not include an access token.");
    }

    const { error: signOutError } = await context.supabase.auth.admin.signOut(
      accessToken,
      "global"
    );
    if (signOutError) throw signOutError;
  } catch {
    await recordSecurityEvent({
      type: "account_deletion_session_revocation_failed",
      severity: "high",
      request,
      userId: context.userId,
      status: 503,
      detail:
        "Deletion request was recorded, but server-side refresh-session revocation could not be confirmed.",
    });

    const response = NextResponse.json(
      {
        error:
          "Your deletion request was recorded, but session revocation could not be confirmed. Contact support and do not sign in again unless support asks you to.",
        requestId,
        requestedAt,
        clearLocalSession: true,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
    clearRecordsSessionCookies(response);
    return response;
  }

  await recordSecurityEvent({
    type: "account_deletion_requested",
    severity: "warning",
    request,
    userId: context.userId,
    status: 202,
    detail:
      "Authenticated user initiated complete account deletion and server-side refresh sessions were revoked.",
  });

  if (!attorneyInvalidation.ok) {
    await recordSecurityEvent({
      type: "account_deletion_request_failed",
      severity: "critical",
      request,
      userId: context.userId,
      status: 503,
      detail: "Deletion request recorded and sessions revoked, but attorney access revocation failed.",
    });
    const response = NextResponse.json(
      {
        error:
          "Your deletion request was recorded and sessions were revoked, but shared attorney access could not be confirmed as revoked. Contact support immediately.",
        requestId,
        requestedAt,
        clearLocalSession: true,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
    clearRecordsSessionCookies(response);
    return response;
  }

  const response = NextResponse.json(
    {
      ok: true,
      requestId,
      requestedAt,
      clearLocalSession: true,
      message:
        "Account deletion request received and active refresh sessions revoked. Support will verify and process complete account deletion subject to legal, security, and backup-retention requirements.",
    },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );

  clearRecordsSessionCookies(response);
  return response;
}
