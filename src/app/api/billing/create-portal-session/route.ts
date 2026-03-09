// src/app/api/billing/create-portal-session/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Billing portal is disabled because LostToFound no longer uses paid subscriptions.",
    },
    { status: 410 }
  );
}
