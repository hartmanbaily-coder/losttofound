// src/app/billing/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

type Plan = "free" | "plus";

/**
 * Outer component: just provides Suspense for useSearchParams().
 */
export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-bg text-white px-4 py-6 flex items-center justify-center">
          <p className="text-sm text-neutral-300">
            Loading your billing details…
          </p>
        </div>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}

function BillingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load user and plan
  useEffect(() => {
    let cancelled = false;

    const loadUserAndPlan = async () => {
      setLoadingUser(true);
      const { data, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("plan")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!cancelled) {
        if (profileError) {
          console.error("Error loading user profile on billing:", profileError);
        } else if (profile && profile.plan) {
          setPlan((profile.plan as Plan) ?? "free");
        }
      }

      setLoadingUser(false);
    };

    loadUserAndPlan();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Handle status from Stripe redirect
  useEffect(() => {
    if (!user) return;

    const status = searchParams.get("status");
    if (!status) return;

    if (status === "success") {
      const markPlus = async () => {
        try {
          setError(null);
          setStatusMessage("Checking your new plan...");
          const res = await fetch("/api/billing/mark-plus", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId: user.id }),
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            throw new Error(data.error || "Could not update plan.");
          }

          setPlan("plus");
          setStatusMessage("You are now on the Plus plan.");
        } catch (err: unknown) {
          console.error("Error marking Plus:", err);
          const message =
            err instanceof Error
              ? err.message
              : "We could not confirm the new plan. Please contact support.";
          setError(message);
        }
      };

      markPlus();
    } else if (status === "cancelled") {
      setStatusMessage("Checkout was cancelled. You remain on the Free plan.");
    }
  }, [user, searchParams]);

  const handleUpgrade = async () => {
    if (!user) return;
    if (!user.email) {
      setError("No email found for your account.");
      return;
    }

    try {
      setError(null);
      setStatusMessage(null);
      setLoadingUpgrade(true);

      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Could not start checkout.");
      }

      if (!data.url) {
        throw new Error("Server did not return a checkout page.");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      console.error("Upgrade error:", err);
      const message =
        err instanceof Error ? err.message : "Could not start checkout.";
      setError(message);
    } finally {
      setLoadingUpgrade(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    const email = user.email;
    if (!email) {
      setError("No email found for your account.");
      return;
    }

    try {
      setError(null);
      setStatusMessage(null);
      setLoadingPortal(true);

      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Could not open Stripe portal.");
      }

      if (!data.url) {
        throw new Error("Server did not return a portal URL.");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      console.error("Portal error:", err);
      const message =
        err instanceof Error ? err.message : "Could not open Stripe portal.";
      setError(message);
    } finally {
      setLoadingPortal(false);
    }
  };

  const isPlus = plan === "plus";

  return (
    <div className="min-h-screen bg-brand-bg text-white px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
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
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                LostToFound
              </p>
              <h1 className="text-2xl font-semibold">Billing</h1>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            LostToFound is free for one basic profile. Plus is built for
            households that travel, foster, or juggle more than one pet. It
            unlocks unlimited pets, full sightings history, travel mode that
            shows your current area on the public page and lost board, a simple
            lost poster generator, and extra contact fields per pet.
          </p>
        </header>

        {statusMessage && (
          <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/60 bg-red-900/30 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {loadingUser ? (
          <p className="text-sm text-gray-400">Loading your plan…</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Free plan */}
              <div className="rounded-2xl border border-brand-border bg-black/40 p-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h2 className="text-lg font-medium">Free</h2>
                  <p className="text-xs text-gray-400">
                    For anyone who needs a single tag and profile.
                  </p>
                  <div className="mt-2 text-2xl font-semibold">$0</div>
                  <p className="text-xs text-gray-400 mt-1">
                    One pet profile with basic sightings. Your QR link stays
                    active even if you never upgrade.
                  </p>
                </div>
                <div className="mt-4">
                  <button
                    disabled
                    className="inline-flex items-center rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-medium text-emerald-200"
                  >
                    {isPlus ? "Included" : "Current plan"}
                  </button>
                </div>
              </div>

              {/* Plus plan */}
              <div className="rounded-2xl border border-brand-border bg-black/40 p-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h2 className="text-lg font-medium">Plus household</h2>
                  <p className="text-xs text-gray-400">
                    Unlimited pets for one household with tools that make it
                    easier to track sightings, travel with your pets, and get
                    the word out fast when something goes wrong.
                  </p>
                  <div className="mt-2 text-2xl font-semibold">$3.99</div>
                  <p className="text-xs text-gray-400 mt-1">
                    Per month. Cancel any time through Stripe.
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-gray-300">
                    <li>Unlimited pets on your account</li>
                    <li>Full sightings history for every pet</li>
                    <li>
                      Travel mode that tells finders your pet is away from home
                      and shows the area you are staying in
                    </li>
                    <li>Lost poster generator for print ready flyers</li>
                    <li>Extra contact fields per pet for email and phone</li>
                    <li>Manage billing and cancellation through Stripe</li>
                  </ul>
                  <p className="mt-3 text-[11px] text-gray-400">
                    Travel mode does not show your street address. It only
                    shares the city or region you choose so finders can see that
                    your pet is with you on a trip.
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {isPlus ? (
                    <button
                      type="button"
                      onClick={handleManageSubscription}
                      disabled={loadingPortal}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loadingPortal
                        ? "Opening Stripe portal..."
                        : "Manage subscription"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleUpgrade}
                      disabled={loadingUpgrade}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loadingUpgrade
                        ? "Opening Stripe..."
                        : "Upgrade with Stripe"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* QR tag ordering section */}
            <section className="mt-6 rounded-2xl border border-brand-border bg-black/40 p-4 space-y-2 text-sm">
              <h2 className="text-sm font-semibold text-neutral-100">
                Order QR tags from LostToFound
              </h2>
              <p className="text-xs text-gray-300">
                You can use the public link for each pet on its own, or you can
                place that link on a QR tag for a collar. When someone scans the
                tag it opens the same pet page you see in your dashboard.
              </p>
              <p className="text-xs text-gray-300">
                If travel mode is on for that pet we show the travel banner and
                the area you set. Your QR tag always stays linked to the same
                profile even when you move or travel.
              </p>
              <p className="text-xs text-gray-300">
                Pricing is set by Amazon and can change, but many metal QR tags
                land around twenty five dollars each with shipping. Your pet
                profile and QR link stay active either way.
              </p>
              <p className="text-xs text-gray-400">
                Use the link below to order tags on Amazon, then come back to
                LostToFound to connect your tag to the right pet profile.
              </p>
              <div className="pt-2">
                <a
                  href="https://amzn.to/4oNgs5d"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400"
                >
                  Order QR tags on Amazon
                </a>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}