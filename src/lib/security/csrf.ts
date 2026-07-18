import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { constantTimeEqualStrings } from "@/lib/records/attorneyCrypto";

const secureCookies = process.env.NODE_ENV === "production";
export const recordsCsrfCookieName = secureCookies ? "__Host-l2f-records-csrf" : "l2f-records-csrf";

export function createRecordsCsrfToken() {
  return randomBytes(32).toString("base64url");
}

export function setRecordsCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set(recordsCsrfCookieName, token, {
    httpOnly: false,
    maxAge: 60 * 60,
    path: "/",
    sameSite: "strict",
    secure: secureCookies,
  });
  return response;
}

function permittedOrigins(request: NextRequest) {
  const origins = new Set([request.nextUrl.origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Invalid deployment configuration is handled by readiness checks.
    }
  }
  return origins;
}

export function verifyRecordsCsrf(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !permittedOrigins(request).has(origin)) {
    return { ok: false as const, error: "Request origin was not accepted." };
  }
  const cookie = request.cookies.get(recordsCsrfCookieName)?.value || "";
  const header = request.headers.get("x-l2f-csrf") || "";
  if (!cookie || !header || !constantTimeEqualStrings(cookie, header)) {
    return { ok: false as const, error: "Security token is missing or expired." };
  }
  return { ok: true as const };
}

export function recordsCsrfError() {
  return NextResponse.json(
    { error: "This request could not be verified. Refresh and try again." },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}
