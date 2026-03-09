// src/app/api/billing/mark-plus/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: true,
      plan: "free",
      message:
        "Billing upgrades are disabled because LostToFound now includes all features for free.",
    },
    { status: 200 }
  );
}
