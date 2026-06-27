import { describe, expect, it, beforeEach } from "vitest";
import {
  checkRateLimit,
  rateLimitExceededResponse,
  resetRateLimitStore,
} from "@/lib/security/rateLimit";

function request(ip = "203.0.113.10") {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
    nextUrl: { pathname: "/api/records/auth/login" },
  };
}

describe("rate limit helper", () => {
  beforeEach(() => resetRateLimitStore());

  it("allows requests under the configured limit", () => {
    const rule = { id: "test-auth", limit: 2, windowMs: 60_000 };

    expect(checkRateLimit(request(), rule, 1_000)).toMatchObject({
      limited: false,
      remaining: 1,
    });
    expect(checkRateLimit(request(), rule, 1_100)).toMatchObject({
      limited: false,
      remaining: 0,
    });
  });

  it("blocks requests after the limit and returns retry metadata", async () => {
    const rule = { id: "test-auth", limit: 1, windowMs: 60_000 };

    checkRateLimit(request(), rule, 1_000);
    const result = checkRateLimit(request(), rule, 2_000);

    expect(result).toMatchObject({
      limited: true,
      retryAfterSeconds: 59,
      remaining: 0,
    });

    const response = rateLimitExceededResponse(result);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("59");
    await expect(response.json()).resolves.toMatchObject({
      error: "Too many requests. Try again shortly.",
    });
  });

  it("keeps separate buckets for separate clients", () => {
    const rule = { id: "test-auth", limit: 1, windowMs: 60_000 };

    checkRateLimit(request("203.0.113.10"), rule, 1_000);
    const otherClient = checkRateLimit(request("203.0.113.11"), rule, 2_000);

    expect(otherClient.limited).toBe(false);
  });
});
