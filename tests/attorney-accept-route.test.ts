import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAttorneyInvitationToken } from "@/lib/records/attorneyCrypto";
import { resetRateLimitStore } from "@/lib/security/rateLimit";
import { recordsCsrfCookieName } from "@/lib/security/csrf";

const getAttorneyAuthContext = vi.hoisted(() => vi.fn());
const clearAttorneyAcceptanceCookie = vi.hoisted(() => vi.fn((response) => response));

vi.mock("@/lib/records/attorneyServer", () => ({
  attorneyAcceptanceCookieName: "l2f-attorney-invite",
  clearAttorneyAcceptanceCookie,
  getAttorneyAuthContext,
}));

import { POST } from "@/app/api/records/attorney/accept/route";

function request(token: string) {
  const csrf = "csrf-token-for-accept-test";
  return new NextRequest("https://losttofound.org/api/records/attorney/accept", {
    method: "POST",
    headers: {
      Origin: "https://losttofound.org",
      Cookie: `l2f-attorney-invite=${token}; ${recordsCsrfCookieName}=${csrf}`,
      "X-L2F-CSRF": csrf,
    },
  });
}

describe("attorney invitation acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    process.env.ATTORNEY_PORTAL_SECRET = "accept-route-secret-that-is-more-than-thirty-two-characters";
  });

  it("accepts once and rejects token replay on the next attempt", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{
          grant_id: "grant-1",
          owner_user_id: "owner-1",
          case_key: "default",
          case_id: "case-1",
          access_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });
    getAttorneyAuthContext.mockResolvedValue({
      supabase: { rpc },
      userId: "attorney-1",
      email: "counsel@example.com",
      emailConfirmedAt: "2026-01-01T00:00:00.000Z",
      assuranceLevel: "aal2",
    });
    const token = createAttorneyInvitationToken();

    const accepted = await POST(request(token));
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({
      ok: true,
      accessHandle: expect.any(String),
      accessExpiresAt: expect.any(String),
    });
    const replay = await POST(request(token));
    expect(replay.status).toBe(404);
    await expect(replay.json()).resolves.toMatchObject({
      error: expect.stringContaining("invalid, expired, already used, or belongs to another account"),
    });
  });

  it("returns the same privacy-safe failure for an invited-email mismatch", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    getAttorneyAuthContext.mockResolvedValue({
      supabase: { rpc },
      userId: "attorney-2",
      email: "different@example.com",
      emailConfirmedAt: "2026-01-01T00:00:00.000Z",
      assuranceLevel: "aal2",
    });
    const response = await POST(request(createAttorneyInvitationToken()));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("invalid, expired, already used, or belongs to another account"),
    });
    expect(rpc).toHaveBeenCalledWith("accept_records_attorney_invitation", expect.objectContaining({
      p_invited_email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("returns the same privacy-safe failure for an expired invitation", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    getAttorneyAuthContext.mockResolvedValue({
      supabase: { rpc },
      userId: "attorney-1",
      email: "counsel@example.com",
      emailConfirmedAt: "2026-01-01T00:00:00.000Z",
      assuranceLevel: "aal2",
    });
    const response = await POST(request(createAttorneyInvitationToken()));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Invitation is invalid, expired, already used, or belongs to another account.",
    });
  });
});
