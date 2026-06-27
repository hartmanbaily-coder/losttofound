import { NextResponse } from "next/server";

type HeaderSource = Pick<Headers, "get">;

interface RateLimitRequest {
  headers: HeaderSource;
  nextUrl?: {
    pathname: string;
  };
}

export interface RateLimitRule {
  id: string;
  limit: number;
  windowMs: number;
  includePath?: boolean;
  key?: string;
}

export interface RateLimitResult {
  limited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();
let requestsSincePrune = 0;

function clientAddress(headers: HeaderSource) {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function rateLimitKey(request: RateLimitRequest, rule: RateLimitRule) {
  const identity = rule.key || clientAddress(request.headers);
  const path = rule.includePath ? `:${request.nextUrl?.pathname || ""}` : "";
  return `${rule.id}:${identity}${path}`;
}

function pruneExpiredBuckets(now: number) {
  requestsSincePrune += 1;
  if (requestsSincePrune < 500) return;
  requestsSincePrune = 0;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  request: RateLimitRequest,
  rule: RateLimitRule,
  now = Date.now()
): RateLimitResult {
  pruneExpiredBuckets(now);

  const key = rateLimitKey(request, rule);
  const existing = buckets.get(key);
  const current = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + rule.windowMs };

  if (current.count >= rule.limit) {
    return {
      limited: true,
      limit: rule.limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    limited: false,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: 0,
  };
}

export function rateLimitExceededResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
      },
    }
  );
}

export function resetRateLimitStore() {
  buckets.clear();
  requestsSincePrune = 0;
}
