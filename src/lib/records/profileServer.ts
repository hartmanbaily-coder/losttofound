import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function recordsProfileExists(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("records_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.user_id === userId;
}

export async function upsertRecordsProfile(input: { userId: string; email: string }) {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("records_profiles").upsert(
      {
        user_id: input.userId,
        email: input.email,
        timezone: "America/Anchorage",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.warn(
        JSON.stringify({
          event: "lost_to_found_profile_upsert_failed",
          at: new Date().toISOString(),
          reason: error.message.slice(0, 180),
        })
      );
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "lost_to_found_profile_upsert_failed",
        at: new Date().toISOString(),
        reason: error instanceof Error ? error.message.slice(0, 180) : "Unknown profile upsert error.",
      })
    );
  }
}
