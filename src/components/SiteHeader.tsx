// src/components/SiteHeader.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export default function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCheckingUser(true);

    // Initial load
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!error && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
      setCheckingUser(false);
    };

    loadUser();

    // Keep header in sync with auth changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        setCheckingUser(false);
      }
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  };

  const isAuthed = !!user;
  const onDashboard = pathname?.startsWith("/dashboard") ?? false;
  const onLost = pathname === "/lost";
  const onBilling = pathname === "/billing";

  return (
    <header className="border-b border-neutral-900/80 bg-black/40 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 sm:px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="group flex items-center gap-2 w-full sm:w-auto"
        >
          <div className="relative h-9 w-9 overflow-hidden rounded-full border border-emerald-300/40 bg-black/80 shadow-sm">
            <Image
              src="/l2f-logo.png"
              alt="LostToFound logo"
              width={36}
              height={36}
              className="h-full w-full object-cover"
              style={{ objectPosition: "50% 30%" }}
              priority
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] tracking-[0.25em] text-neutral-500 uppercase group-hover:text-emerald-300/90 transition-colors">
              LOSTTOFOUND
            </span>
            <span className="mt-1 text-xs text-neutral-400 group-hover:text-neutral-200 transition-colors">
              Emergency support for lost pets.
            </span>
          </div>
        </Link>

        {/* Right side nav */}
        <nav className="flex w-full flex-wrap items-center gap-2 justify-start text-[11px] sm:text-xs sm:w-auto sm:justify-end">
          {checkingUser ? null : isAuthed ? (
            <>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                  onDashboard
                    ? "bg-emerald-500 text-black"
                    : "border border-neutral-700 text-neutral-100 hover:border-emerald-400 hover:text-emerald-300"
                }`}
              >
                Dashboard
              </button>

              <Link
                href="/lost"
                className={`inline-flex items-center rounded-full px-3 py-1.5 font-medium transition-colors ${
                  onLost
                    ? "bg-neutral-100 text-black"
                    : "border border-neutral-700 text-neutral-200 hover:border-emerald-400 hover:text-emerald-300"
                }`}
              >
                Lost pets
              </Link>

              <Link
                href="/billing"
                className={`text-neutral-300 hover:text-emerald-300 transition-colors ${
                  onBilling ? "underline underline-offset-4" : ""
                }`}
              >
                Billing
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="text-neutral-400 hover:text-neutral-100 underline underline-offset-4 transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/lost"
                className={`inline-flex items-center rounded-full px-3 py-1.5 font-medium transition-colors ${
                  onLost
                    ? "bg-neutral-100 text-black"
                    : "border border-neutral-700 text-neutral-200 hover:border-emerald-400 hover:text-emerald-300"
                }`}
              >
                Lost pets
              </Link>
              <Link
                href="/login"
                className="text-neutral-300 hover:text-emerald-300 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-emerald-500 px-3 py-1.5 font-medium text-black hover:bg-emerald-400 transition-colors"
              >
                Get started free
              </Link>
            </>
          )}

          {/* Legal, contact, and Listhaus links – always visible */}
          <Link
            href="/privacy"
            className="text-[11px] text-neutral-500 hover:text-emerald-300 transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-[11px] text-neutral-500 hover:text-emerald-300 transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="text-[11px] text-neutral-500 hover:text-emerald-300 transition-colors"
          >
            Contact
          </Link>
          <Link
            href="/listhaus"
            className="text-[11px] font-medium rounded-full px-3 py-1 bg-[#ff7f6b] text-black hover:bg-[#ff987f] shadow-sm transition-colors"
          >
            Listhaus
          </Link>
        </nav>
      </div>
    </header>
  );
}