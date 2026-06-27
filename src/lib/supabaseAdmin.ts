// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

function getAdminSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith("https://")) {
    throw new Error(
      `Bad NEXT_PUBLIC_SUPABASE_URL in supabaseAdmin: "${supabaseUrl}". It must start with https://.`
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY for supabaseAdmin. Set it only in server-side secret storage."
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

export function createSupabaseAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getAdminSupabaseConfig();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}
