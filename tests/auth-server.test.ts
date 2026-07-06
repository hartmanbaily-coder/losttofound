import { describe, expect, it } from "vitest";
import {
  getAccessTokenAal,
  isRecordsMfaRequired,
  isRecordsSignupEnabled,
  isStrongRecordsPassword,
  safeRecordsAuthNextPath,
} from "@/lib/records/authServer";
import { selectTotpFactorForVerification } from "@/lib/records/mfaServer";
import { isUsableSupabasePublicKey } from "@/lib/supabaseClient";

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

  it("keeps account creation behind an explicit gate", () => {
    expect(isRecordsSignupEnabled({ RECORDS_SIGNUPS_ENABLED: "true" })).toBe(true);
    expect(isRecordsSignupEnabled({ NEXT_PUBLIC_RECORDS_SIGNUPS_ENABLED: "true" })).toBe(true);
    expect(isRecordsSignupEnabled({ RECORDS_SIGNUPS_ENABLED: "false" })).toBe(false);
  });

  it("uses the configured strong-password minimum", () => {
    expect(isStrongRecordsPassword("123456789012", { SUPABASE_PASSWORD_MIN_LENGTH: "12" })).toBe(true);
    expect(isStrongRecordsPassword("12345678901", { SUPABASE_PASSWORD_MIN_LENGTH: "12" })).toBe(false);
    expect(isStrongRecordsPassword("123456789012", { SUPABASE_PASSWORD_MIN_LENGTH: "20" })).toBe(false);
  });

  it("rejects placeholder Supabase public keys", () => {
    expect(isUsableSupabasePublicKey("sb_publishable_REALISTIC_VALUE")).toBe(true);
    expect(isUsableSupabasePublicKey("sb_publishable_REPLACE_WITH_DEFAULT_PUBLISHABLE_KEY")).toBe(false);
    expect(isUsableSupabasePublicKey("")).toBe(false);
  });

  it("sanitizes auth redirect targets to records pages only", () => {
    expect(safeRecordsAuthNextPath("/records?auth=recovery")).toBe("/records?auth=recovery");
    expect(safeRecordsAuthNextPath("https://evil.example/records")).toBe("/records");
    expect(safeRecordsAuthNextPath("//evil.example/records")).toBe("/records");
    expect(safeRecordsAuthNextPath("/admin")).toBe("/records");
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
