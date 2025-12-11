// src/app/api/billing/mark-plus/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    // Check for existing profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, plan")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error loading profile in mark-plus:", profileError);
      return NextResponse.json(
        { error: "Could not load user profile." },
        { status: 500 }
      );
    }

    if (!profile) {
      // Create profile if missing
      const { error: insertError } = await supabaseAdmin
        .from("user_profiles")
        .insert({
          user_id: userId,
          plan: "plus",
        });

      if (insertError) {
        console.error("Error creating profile in mark-plus:", insertError);
        return NextResponse.json(
          { error: "Could not create user profile." },
          { status: 500 }
        );
      }
    } else {
      // Update plan
      const { error: updateError } = await supabaseAdmin
        .from("user_profiles")
        .update({ plan: "plus" })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating plan in mark-plus:", updateError);
        return NextResponse.json(
          { error: "Could not update plan." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("mark-plus error:", err);
    return NextResponse.json(
      { error: "Unexpected error updating plan." },
      { status: 500 }
    );
  }
}