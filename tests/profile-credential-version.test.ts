import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle,
    };
    return { from: vi.fn(() => query) };
  },
}));

import {
  recordsCredentialVersionClaim,
  recordsCredentialVersionFromAccessToken,
  recordsProfileIsAuthorized,
} from "@/lib/records/profileServer";

function fakeJwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.signature`;
}

describe("records credential-version authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps existing profiles without a credential version compatible", async () => {
    maybeSingle.mockResolvedValue({
      data: { user_id: "legacy-user", credential_version: null },
      error: null,
    });

    await expect(
      recordsProfileIsAuthorized("legacy-user", fakeJwt({ sub: "legacy-user" }))
    ).resolves.toBe(true);
  });

  it("requires the invited profile version to match the verified access JWT", async () => {
    const version = "v".repeat(43);
    maybeSingle.mockResolvedValue({
      data: { user_id: "invited-user", credential_version: version },
      error: null,
    });

    const currentToken = fakeJwt({
      sub: "invited-user",
      app_metadata: { [recordsCredentialVersionClaim]: version },
    });
    const prePasswordToken = fakeJwt({ sub: "invited-user", app_metadata: {} });

    await expect(recordsProfileIsAuthorized("invited-user", currentToken)).resolves.toBe(true);
    await expect(recordsProfileIsAuthorized("invited-user", prePasswordToken)).resolves.toBe(false);
  });

  it("rejects malformed credential-version claims and missing profiles", async () => {
    expect(
      recordsCredentialVersionFromAccessToken(
        fakeJwt({ app_metadata: { [recordsCredentialVersionClaim]: "too-short" } })
      )
    ).toBeNull();

    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(recordsProfileIsAuthorized("missing-user", "not-a-jwt")).resolves.toBe(false);
  });
});
