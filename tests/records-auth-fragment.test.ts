import { describe, expect, it } from "vitest";
import { parseRecordsAuthFragment } from "@/lib/records/authClient";

describe("records auth URL fragments", () => {
  it("accepts recovery tokens only for a recovery callback", () => {
    expect(
      parseRecordsAuthFragment(
        "#access_token=access-value&refresh_token=refresh-value&type=recovery&expires_in=3600",
        "recovery"
      )
    ).toEqual({
      kind: "recovery",
      accessToken: "access-value",
      refreshToken: "refresh-value",
      expiresIn: "3600",
    });
  });

  it("does not turn signup confirmation tokens into a recovery session", () => {
    expect(
      parseRecordsAuthFragment(
        "#access_token=access-value&refresh_token=refresh-value&type=signup",
        "confirmed"
      )
    ).toEqual({ kind: "confirmation" });
  });

  it("rejects incomplete and unknown token fragments", () => {
    expect(parseRecordsAuthFragment("#access_token=access-value&type=recovery", "recovery")).toEqual({
      kind: "error",
    });
    expect(
      parseRecordsAuthFragment(
        "#access_token=access-value&refresh_token=refresh-value&type=magiclink",
        null
      )
    ).toEqual({ kind: "error" });
  });

  it("leaves ordinary records URLs alone", () => {
    expect(parseRecordsAuthFragment("", null)).toEqual({ kind: "none" });
  });
});
