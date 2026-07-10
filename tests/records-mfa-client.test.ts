import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyRecordsMfa, type RecordsSession } from "@/lib/records/clientStore";

const session: RecordsSession = {
  authMode: "supabase",
  caseId: "case-1",
  email: "reviewer@example.test",
  userId: "user-1",
};

describe("records MFA client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recovers when MFA verification succeeds but the response body omits the session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyRecordsMfa("123456")).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/records/auth/mfa/verify",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        method: "POST",
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/records/auth/session",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      })
    );
  });

  it("does not report an incomplete 200 as a completed MFA verification", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<html></html>", {
          headers: { "Content-Type": "text/html" },
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Multi factor verification required.", mfaRequired: true }), {
          headers: { "Content-Type": "application/json" },
          status: 403,
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyRecordsMfa("123456")).rejects.toThrow(
      "Authenticator verification did not complete. Enter a fresh code and try again."
    );
  });
});
