import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getRecordsAuthContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/records/authServer", () => ({
  getRecordsAuthContext,
  isSupabaseRecordsMode: () => true,
}));

import {
  attorneyInvitationDeliveryMode,
  getAttorneyAuthContext,
} from "@/lib/records/attorneyServer";

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

  it("allows reviewed owner sharing in production without development delivery", () => {
    expect(attorneyInvitationDeliveryMode({
      NODE_ENV: "production",
      ATTORNEY_INVITE_OWNER_SHARE_ENABLED: "true",
      ATTORNEY_INVITE_DEV_DELIVERY: "false",
    })).toBe("owner_share");
  });

  it("never treats the development flag as production delivery", () => {
    expect(attorneyInvitationDeliveryMode({
      NODE_ENV: "production",
      ATTORNEY_INVITE_OWNER_SHARE_ENABLED: "false",
      ATTORNEY_INVITE_DEV_DELIVERY: "true",
    })).toBe("not_configured");
  });
});
