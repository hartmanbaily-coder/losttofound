// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export function isPlaceholderSecret(value: string | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("replace_with") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("change-me")
  );
}

export function isUsableSupabasePublicKey(value: string | undefined) {
  const key = String(value || "").trim();
  if (isPlaceholderSecret(key)) return false;
  return key.startsWith("sb_publishable_") || /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(key);
}

function getBrowserSupabaseConfig() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !supabaseUrl.startsWith("https://") || !isUsableSupabasePublicKey(supabaseAnonKey)) {
    throw new Error(
      "Missing production Supabase browser configuration. Set NEXT_PUBLIC_SUPABASE_URL and a real NEXT_PUBLIC_SUPABASE_ANON_KEY."
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
