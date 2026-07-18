import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/security/rateLimit";
import { POST } from "@/app/api/records/account/deletion-request/route";

const getRecordsAuthContext = vi.hoisted(() => vi.fn());
const recordSecurityEvent = vi.hoisted(() => vi.fn());
const insertAuditLog = vi.hoisted(() => vi.fn());
const revokeSessions = vi.hoisted(() => vi.fn());
const clearRecordsSessionCookies = vi.hoisted(() => vi.fn());
const invalidateAllAttorneyAccessForOwner = vi.hoisted(() => vi.fn());

vi.mock("@/lib/records/authServer", () => ({
  clearRecordsSessionCookies,
  getRecordsAuthContext,
  isSupabaseRecordsMode: () => true,
  recordsAccessCookieName: "l2f-records-access",
}));

vi.mock("@/lib/security/securityEvents", () => ({
  recordSecurityEvent,
}));

vi.mock("@/lib/records/attorneyAccess", () => ({
  invalidateAllAttorneyAccessForOwner,
}));

function makeRequest(body: unknown) {
  return new NextRequest("https://losttofound.org/api/records/account/deletion-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "l2f-records-access=test-access-token",
    },
    body: JSON.stringify(body),
  });
}

describe("records account deletion request route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    insertAuditLog.mockResolvedValue({ error: null });
    revokeSessions.mockResolvedValue({ error: null });
    invalidateAllAttorneyAccessForOwner.mockResolvedValue({ ok: true });
    getRecordsAuthContext.mockResolvedValue({
      supabase: {
        auth: {
          admin: {
            signOut: revokeSessions,
          },
        },
        from: (table: string) => {
          expect(table).toBe("records_audit_logs");
          return { insert: insertAuditLog };
        },
      },
      userId: "11111111-1111-4111-8111-111111111111",
      email: "reviewer@example.test",
      caseId: "demo-case",
    });
  });

  it("records a server-side account deletion request for the authenticated user", async () => {
    const response = await POST(makeRequest({ confirm: true }));
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      ok: true,
      message: expect.stringContaining("Account deletion request received"),
    });
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deletion_requested",
        case_id: null,
        entity_type: "account",
        metadata_summary: expect.stringContaining("complete account deletion"),
        user_id: "11111111-1111-4111-8111-111111111111",
      })
    );
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "warning",
        status: 202,
        type: "account_deletion_requested",
        userId: "11111111-1111-4111-8111-111111111111",
      })
    );
    expect(revokeSessions).toHaveBeenCalledWith("test-access-token", "global");
    expect(clearRecordsSessionCookies).toHaveBeenCalledWith(response);
    expect(body.clearLocalSession).toBe(true);
  });

  it("clears the local session and reports an error if server revocation cannot be confirmed", async () => {
    revokeSessions.mockResolvedValue({ error: new Error("revocation unavailable") });

    const response = await POST(makeRequest({ confirm: true }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      clearLocalSession: true,
      error: expect.stringContaining("session revocation could not be confirmed"),
      requestId: expect.any(String),
    });
    expect(insertAuditLog).toHaveBeenCalledOnce();
    expect(clearRecordsSessionCookies).toHaveBeenCalledWith(response);
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "high",
        status: 503,
        type: "account_deletion_session_revocation_failed",
      })
    );
  });

  it("requires explicit confirmation before recording a request", async () => {
    const response = await POST(makeRequest({ confirm: false }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Confirm that you want to start complete account deletion.",
    });
    expect(insertAuditLog).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
    expect(revokeSessions).not.toHaveBeenCalled();
    expect(clearRecordsSessionCookies).not.toHaveBeenCalled();
  });

  it("requires an authenticated records session", async () => {
    getRecordsAuthContext.mockResolvedValue(
      { error: NextResponse.json({ error: "Sign in before accessing records." }, { status: 401 }) }
    );

    const response = await POST(makeRequest({ confirm: true }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Sign in before accessing records.",
    });
    expect(insertAuditLog).not.toHaveBeenCalled();
    expect(revokeSessions).not.toHaveBeenCalled();
    expect(clearRecordsSessionCookies).not.toHaveBeenCalled();
  });
});
