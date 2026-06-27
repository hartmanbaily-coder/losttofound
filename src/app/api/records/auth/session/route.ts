import { NextRequest, NextResponse } from "next/server";
import {
  attachRefreshedRecordsSession,
  getRecordsAuthContext,
  isSupabaseRecordsMode,
} from "@/lib/records/authServer";

export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Supabase records auth is not enabled.",
      detail: "Set RECORDS_STORAGE_MODE=supabase and NEXT_PUBLIC_RECORDS_STORAGE_MODE=supabase.",
    },
    { status: 501 }
  );
}

export async function GET(request: NextRequest) {
  if (!isSupabaseRecordsMode()) return disabledResponse();

  const context = await getRecordsAuthContext(request);
  if ("error" in context) return context.error;

  const response = NextResponse.json(
    {
      session: {
        userId: context.userId,
        caseId: context.caseId,
        email: context.email,
        authMode: "supabase",
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );

  return attachRefreshedRecordsSession(request, response, context);
}
