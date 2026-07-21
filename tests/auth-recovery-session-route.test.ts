import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/security/rateLimit";

const getUser = vi.hoisted(() => vi.fn());
const recordsProfileExists = vi.hoisted(() => vi.fn());
const upsertRecordsProfile = vi.hoisted(() => vi.fn());
const setRecordsSessionCookies = vi.hoisted(() => vi.fn());
const setRecordsPasswordRecoveryCookie = vi.hoisted(() => vi.fn());
const recordSecurityEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseClient", () => ({
  createServerSupabaseSessionClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/records/authServer", () => ({
  isRecordsSignupEnabled: () => false,
  isSupabaseRecordsMode: () => true,
  setRecordsPasswordRecoveryCookie,
  setRecordsSessionCookies,
}));

vi.mock("@/lib/records/profileServer", () => ({
  recordsProfileExists,
  upsertRecordsProfile,
}));

vi.mock("@/lib/security/securityEvents", () => ({ recordSecurityEvent }));

import { POST } from "@/app/api/records/auth/recovery/session/route";

function request() {
  return new NextRequest("https://losttofound.org/api/records/auth/recovery/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: "access-token-long-enough-for-validation",
      refreshToken: "refresh-token-long-enough-for-validation",
      expiresIn: 3600,
    }),
  });
}

describe("records recovery session admission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    getUser.mockResolvedValue({
      data: { user: { id: "provider-user", email: "user@example.test" } },
      error: null,
    });
  });

  it("does not create an app profile for a provider-only identity while signup is disabled", async () => {
    recordsProfileExists.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(upsertRecordsProfile).not.toHaveBeenCalled();
    expect(setRecordsSessionCookies).not.toHaveBeenCalled();
    expect(setRecordsPasswordRecoveryCookie).not.toHaveBeenCalled();
  });

  it("preserves recovery for an existing app profile after signup is disabled", async () => {
    recordsProfileExists.mockResolvedValue(true);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(upsertRecordsProfile).toHaveBeenCalledWith({
      userId: "provider-user",
      email: "user@example.test",
    });
    expect(setRecordsSessionCookies).toHaveBeenCalled();
    expect(setRecordsPasswordRecoveryCookie).toHaveBeenCalled();
  });
});
