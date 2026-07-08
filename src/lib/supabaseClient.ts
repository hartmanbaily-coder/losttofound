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

function readJwtPayload(value: string) {
  const [, payload] = value.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded =
      typeof globalThis.atob === "function"
        ? globalThis.atob(padded)
        : Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(decoded) as { role?: unknown };
  } catch {
    return null;
  }
}

export function isUsableSupabasePublicKey(value: string | undefined) {
  const key = String(value || "").trim();
  if (isPlaceholderSecret(key)) return false;
  if (key.startsWith("sb_publishable_")) return true;
  if (!/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(key)) return false;
  return readJwtPayload(key)?.role === "anon";
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
