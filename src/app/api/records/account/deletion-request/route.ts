import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  attachRefreshedRecordsSession,
  getRecordsAuthContext,
  isSupabaseRecordsMode,
} from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

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

  await recordSecurityEvent({
    type: "account_deletion_requested",
    severity: "warning",
    request,
    userId: context.userId,
    status: 202,
    detail: "Authenticated user initiated complete account deletion.",
  });

  const response = NextResponse.json(
    {
      ok: true,
      requestId,
      requestedAt,
      message:
        "Account deletion request received. Support will verify and process complete account deletion subject to legal, security, and backup-retention requirements.",
    },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );

  return attachRefreshedRecordsSession(request, response, context);
}
