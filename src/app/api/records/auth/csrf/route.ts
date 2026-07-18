import { NextResponse } from "next/server";
import { createRecordsCsrfToken, setRecordsCsrfCookie } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = createRecordsCsrfToken();
  return setRecordsCsrfCookie(
    NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } }),
    token
  );
}
