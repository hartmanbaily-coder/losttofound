import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function upsertRecordsProfile(input: { userId: string; email: string }) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("records_profiles").upsert(
    {
      user_id: input.userId,
      email: input.email,
      timezone: "America/Anchorage",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
