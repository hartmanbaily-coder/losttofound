import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getRecordsAuthContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/records/authServer", () => ({
  getRecordsAuthContext,
  isSupabaseRecordsMode: () => true,
}));

import { getAttorneyAuthContext } from "@/lib/records/attorneyServer";

const request = new NextRequest("https://losttofound.org/api/records/attorney/portal");

describe("attorney authentication policy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires AAL2 even when ordinary records policy is not being exercised", async () => {
    getRecordsAuthContext.mockResolvedValue({
      userId: "attorney-1",
      email: "counsel@example.com",
      emailConfirmedAt: "2026-01-01T00:00:00.000Z",
      assuranceLevel: "aal1",
    });
    const context = await getAttorneyAuthContext(request);
    expect("error" in context).toBe(true);
    if ("error" in context) expect(context.error.status).toBe(403);
  });

  it("requires a confirmed invited email", async () => {
    getRecordsAuthContext.mockResolvedValue({
      userId: "attorney-1",
      email: "counsel@example.com",
      emailConfirmedAt: undefined,
      assuranceLevel: "aal2",
    });
    const context = await getAttorneyAuthContext(request);
    expect("error" in context).toBe(true);
    if ("error" in context) await expect(context.error.json()).resolves.toMatchObject({
      error: expect.stringContaining("Confirm"),
    });
  });

  it("accepts a confirmed AAL2 adult account context", async () => {
    const expected = {
      userId: "attorney-1",
      email: "counsel@example.com",
      emailConfirmedAt: "2026-01-01T00:00:00.000Z",
      assuranceLevel: "aal2",
      supabase: {},
    };
    getRecordsAuthContext.mockResolvedValue(expected);
    await expect(getAttorneyAuthContext(request)).resolves.toBe(expected);
  });
});
