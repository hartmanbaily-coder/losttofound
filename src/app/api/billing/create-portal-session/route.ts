// src/app/api/billing/create-portal-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

// Drop explicit apiVersion to avoid TS mismatch with older stripe types
const stripe = new Stripe(stripeSecretKey);

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: "Missing userId or email" },
        { status: 400 }
      );
    }

    // 1) Look up stripe_customer_id in user_profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error loading user profile for portal:", profileError);
      return NextResponse.json(
        { error: "Could not load billing profile." },
        { status: 500 }
      );
    }

    let customerId = (profile?.stripe_customer_id as string | null) ?? null;

    // 2) If no customer yet, create one and store it
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          supabase_user_id: userId,
        },
      });

      customerId = customer.id;

      const { error: updateError } = await supabaseAdmin
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error saving stripe_customer_id:", updateError);
        return NextResponse.json(
          { error: "Could not update billing profile." },
          { status: 500 }
        );
      }
    }

    // 3) Create a Billing Portal session for this customer
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      new URL(req.url).origin;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
    console.error("Error creating Stripe portal session:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error creating portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}