import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/security/rateLimit";
import { POST } from "@/app/api/records/auth/password/update/route";

const getUser = vi.hoisted(() => vi.fn());
const getClaims = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const updateUser = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const checkPwnedPassword = vi.hoisted(() => vi.fn());
const recordSecurityEvent = vi.hoisted(() => vi.fn());
const hasRecordsPasswordRecoveryCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => ({ auth: { admin: { signOut } } }),
}));

vi.mock("@/lib/records/authServer", () => ({
  clearRecordsSessionCookies: vi.fn(),
  getRecordsSessionAuthClient: async () => ({ auth: { getClaims, getSession, getUser, updateUser } }),
  hasRecordsPasswordRecoveryCookie,
  isStrongRecordsPassword: (password: string) => password.length >= 12,
  isSupabaseRecordsMode: () => true,
  recordsPasswordMinimumLength: () => 12,
}));

vi.mock("@/lib/security/pwnedPasswords", () => ({
  checkPwnedPassword,
  isPwnedPasswordCheckEnabled: () => true,
}));

vi.mock("@/lib/security/securityEvents", () => ({ recordSecurityEvent }));

function request(password = "Replacement-Password!42") {
  return new NextRequest("https://losttofound.org/api/records/auth/password/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "l2f-records-access=test-access-token",
    },
    body: JSON.stringify({ password }),
  });
}

describe("password update compromised-password guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    getUser.mockResolvedValue({ data: { user: { id: "test-user-id" } }, error: null });
    getClaims.mockResolvedValue({
      data: { claims: { session_id: "recovery-session-id", sub: "test-user-id" } },
      error: null,
    });
    getSession.mockResolvedValue({
      data: { session: { access_token: "current-access-token" } },
      error: null,
    });
    hasRecordsPasswordRecoveryCookie.mockReturnValue(true);
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("rejects a compromised replacement before updating Supabase Auth", async () => {
    checkPwnedPassword.mockResolvedValue({ status: "compromised", occurrenceCount: 9 });

    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("known data breaches"),
    });
    expect(getUser).toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("preserves a verified safe password update", async () => {
    checkPwnedPassword.mockResolvedValue({ status: "safe" });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password: "Replacement-Password!42" });
    expect(signOut).toHaveBeenCalledWith("current-access-token", "global");
  });

  it("rejects an ordinary session without a signed same-session recovery binding", async () => {
    hasRecordsPasswordRecoveryCookie.mockReturnValue(false);

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(checkPwnedPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("surfaces global revocation failure after changing the password", async () => {
    checkPwnedPassword.mockResolvedValue({ status: "safe" });
    signOut.mockResolvedValue({ error: new Error("revocation unavailable") });

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("other sessions could not be confirmed signed out"),
    });
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth_password_session_revocation_failed", severity: "high" })
    );
  });
});
