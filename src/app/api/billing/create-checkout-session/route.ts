// src/app/api/billing/create-checkout-session/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Paid subscriptions are disabled. LostToFound now includes all features for free.",
    },
    { status: 410 }
  );
}
