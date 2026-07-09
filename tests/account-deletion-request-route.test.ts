import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/security/rateLimit";
import { POST } from "@/app/api/records/account/deletion-request/route";

const getRecordsAuthContext = vi.hoisted(() => vi.fn());
const recordSecurityEvent = vi.hoisted(() => vi.fn());
const insertAuditLog = vi.hoisted(() => vi.fn());

vi.mock("@/lib/records/authServer", () => ({
  attachRefreshedRecordsSession: (
    _request: NextRequest,
    response: NextResponse,
  ) => response,
  getRecordsAuthContext,
  isSupabaseRecordsMode: () => true,
}));

vi.mock("@/lib/security/securityEvents", () => ({
  recordSecurityEvent,
}));

function makeRequest(body: unknown) {
  return new NextRequest("https://losttofound.org/api/records/account/deletion-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("records account deletion request route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    insertAuditLog.mockResolvedValue({ error: null });
    getRecordsAuthContext.mockResolvedValue({
      supabase: {
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
  });

  it("requires explicit confirmation before recording a request", async () => {
    const response = await POST(makeRequest({ confirm: false }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Confirm that you want to start complete account deletion.",
    });
    expect(insertAuditLog).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
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
  });
});
