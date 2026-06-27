import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

type SecurityEventSeverity = "info" | "warning" | "high" | "critical";

export type SecurityEventType =
  | "auth_login_success"
  | "auth_login_failed"
  | "auth_mfa_required"
  | "auth_mfa_verified"
  | "auth_mfa_failed"
  | "auth_mfa_enrollment_started"
  | "auth_mfa_enrollment_verified"
  | "auth_mfa_enrollment_failed"
  | "auth_mfa_policy_denied"
  | "evidence_upload_scanner_blocked"
  | "evidence_upload_scanner_failed"
  | "evidence_storage_failed"
  | "evidence_download_denied"
  | "evidence_delete_denied";

export interface SecurityEventInput {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  request?: NextRequest;
  userId?: string;
  caseId?: string;
  evidenceId?: string;
  status?: number;
  detail?: string;
}

function hashForLog(value: string | undefined) {
  if (!value) return undefined;
  const salt = process.env.SECURITY_LOG_HASH_SALT || process.env.AUTH_SECRET || "lost-to-found-records";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 24);
}

function securityEventWebhookUrl() {
  const raw = process.env.SECURITY_EVENT_WEBHOOK_URL;
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function requestMetadata(request: NextRequest | undefined) {
  if (!request) return {};
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent") || undefined;
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-vercel-id") ||
    request.headers.get("cf-ray") ||
    randomUUID();

  return {
    method: request.method,
    route: request.nextUrl.pathname,
    requestId,
    ipHash: hashForLog(forwardedFor),
    userAgentHash: hashForLog(userAgent),
  };
}

export async function recordSecurityEvent(input: SecurityEventInput) {
  const event = {
    event: "lost_to_found_security_event",
    type: input.type,
    severity: input.severity,
    at: new Date().toISOString(),
    status: input.status,
    detail: input.detail?.slice(0, 180),
    userIdHash: hashForLog(input.userId),
    caseIdHash: hashForLog(input.caseId),
    evidenceId: input.evidenceId,
    ...requestMetadata(input.request),
  };

  console.info(JSON.stringify(event));

  const webhookUrl = securityEventWebhookUrl();
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SECURITY_EVENT_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.SECURITY_EVENT_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(event),
    });
  } catch {
    console.warn(
      JSON.stringify({
        event: "lost_to_found_security_event_delivery_failed",
        at: new Date().toISOString(),
        type: input.type,
      })
    );
  }
}
