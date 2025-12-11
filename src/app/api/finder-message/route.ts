// src/app/api/finder-message/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type FinderReportType = "have" | "saw";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const petId = body.petId as string | undefined;
    const type = body.type as FinderReportType | undefined;
    const message = body.message as string | undefined;
    const generalLocation = body.generalLocation as string | undefined;

    if (!petId || !message || !message.trim()) {
      return NextResponse.json(
        { error: "petId and message are required." },
        { status: 400 }
      );
    }

    if (type !== "have" && type !== "saw") {
      return NextResponse.json(
        { error: "Invalid report type. Expected 'have' or 'saw'." },
        { status: 400 }
      );
    }

    console.log("[finder-message] inserting row", {
      petId,
      type,
      message,
      generalLocation,
    });

    const { data, error } = await supabaseAdmin
      .from("finder_messages")
      .insert({
        pet_id: petId,
        report_type: type, // 👈 HAVE / SAW stored here
        message: message.trim(),
        general_location: generalLocation?.trim() || null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[finder-message] Supabase insert error:", error);
      return NextResponse.json(
        { error: "Could not save message." },
        { status: 500 }
      );
    }

    console.log("[finder-message] inserted row:", data);

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err: any) {
    console.error("[finder-message] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error." },
      { status: 500 }
    );
  }
}