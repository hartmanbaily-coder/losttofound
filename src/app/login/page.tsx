// src/app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error("Email and password are required.");
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }

      // On success, send them to the dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
    setError(null);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-semibold mb-2">
          {mode === "login" ? "Log in to LostToFound" : "Create your LostToFound account"}
        </h1>
        <p className="text-sm text-gray-300 mb-6">
          Use your email and a password. You’ll manage your pet dashboards from here.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-lg border border-brand-border bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border border-brand-border bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-700 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-accent text-black font-medium py-2.5 text-sm hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
              ? "Log in"
              : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          onClick={toggleMode}
          className="mt-4 w-full text-sm text-gray-300 hover:text-white underline underline-offset-4"
        >
          {mode === "login"
            ? "Need an account? Sign up instead."
            : "Already have an account? Log in instead."}
        </button>

        <p className="mt-6 text-xs text-gray-500">
          By continuing, you agree to use LostToFound responsibly to help pets get from lost to home.
        </p>
      </div>
    </div>
  );
}