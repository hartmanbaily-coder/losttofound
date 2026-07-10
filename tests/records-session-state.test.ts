import { describe, expect, it } from "vitest";
import {
  parseRecordsSessionResponse,
  type RecordsSession,
} from "@/lib/records/clientStore";

const session: RecordsSession = {
  authMode: "supabase",
  caseId: "case-1",
  email: "reviewer@example.test",
  userId: "user-1",
};

describe("records session bootstrap", () => {
  it("restores the authenticator step from a pending AAL1 session", () => {
    expect(
      parseRecordsSessionResponse(403, {
        error: "Multi factor verification required.",
        mfaRequired: true,
      })
    ).toEqual({ status: "mfa_required" });
  });

  it("returns authenticated and signed-out session states", () => {
    expect(parseRecordsSessionResponse(200, { session })).toEqual({
      status: "signed_in",
      session,
    });
    expect(parseRecordsSessionResponse(401, { error: "Sign in required." })).toEqual({
      status: "signed_out",
    });
  });

  it("does not hide unexpected session service failures", () => {
    expect(() =>
      parseRecordsSessionResponse(503, { error: "Session service unavailable." })
    ).toThrow("Session service unavailable.");
  });
});
