import { describe, expect, it } from "vitest";
import { getAccessTokenAal, isRecordsMfaRequired } from "@/lib/records/authServer";
import { selectTotpFactorForVerification } from "@/lib/records/mfaServer";

function fakeJwt(payload: Record<string, unknown>) {
  const encode = (input: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(input)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.signature`;
}

describe("records auth server helpers", () => {
  it("reads Supabase AAL from access token claims", () => {
    expect(getAccessTokenAal(fakeJwt({ aal: "aal1" }))).toBe("aal1");
    expect(getAccessTokenAal(fakeJwt({ aal: "aal2" }))).toBe("aal2");
    expect(getAccessTokenAal(fakeJwt({ aal: "unexpected" }))).toBeNull();
    expect(getAccessTokenAal("not-a-jwt")).toBeNull();
  });

  it("requires MFA when explicitly enabled", () => {
    expect(isRecordsMfaRequired({ RECORDS_ENFORCE_MFA: "true" })).toBe(true);
    expect(isRecordsMfaRequired({ NODE_ENV: "production", SUPABASE_MFA_POLICY: "required" })).toBe(true);
    expect(isRecordsMfaRequired({ NODE_ENV: "development", SUPABASE_MFA_POLICY: "required" })).toBe(false);
  });

  it("prefers verified TOTP factors over abandoned enrollments", () => {
    const verified = { id: "verified-factor", status: "verified" };

    expect(
      selectTotpFactorForVerification([
        { id: "unfinished-factor", status: "unverified" },
        verified,
      ])
    ).toBe(verified);
    expect(selectTotpFactorForVerification([{ id: "unfinished-factor", status: "unverified" }])).toBeNull();
    expect(selectTotpFactorForVerification([{ id: "legacy-factor" }])?.id).toBe("legacy-factor");
  });
});
