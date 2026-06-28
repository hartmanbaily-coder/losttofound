import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function emptyProbeResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export function GET() {
  return emptyProbeResponse();
}

export function POST() {
  return emptyProbeResponse();
}
