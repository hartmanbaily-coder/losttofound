// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

function getBrowserSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith("https://") || !supabaseAnonKey) {
    throw new Error(
      "Missing production Supabase browser configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getBrowserSupabaseConfig();
  return createClient(supabaseUrl, supabaseAnonKey);
}

export function createServerSupabaseAuthClient() {
  const { supabaseUrl, supabaseAnonKey } = getBrowserSupabaseConfig();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function createServerSupabaseSessionClient(input: {
  accessToken: string;
  refreshToken: string;
}) {
  const client = createServerSupabaseAuthClient();
  const { error } = await client.auth.setSession({
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
  });

  if (error) {
    throw error;
  }

  return client;
}
