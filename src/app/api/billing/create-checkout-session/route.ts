// src/app/api/billing/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

// Force this route to run in the Node.js runtime (Stripe needs Node APIs)
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    if (!stripeSecretKey) {
      console.error("Missing STRIPE_SECRET_KEY environment variable");
      return NextResponse.json(
        {
          error:
            "Stripe is not configured on the server (secret key missing).",
        },
        { status: 500 }
      );
    }

    if (!priceId) {
      console.error("Missing STRIPE_PRICE_ID environment variable");
      return NextResponse.json(
        {
          error: "Stripe is not configured on the server (price ID missing).",
        },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const origin = req.headers.get("origin") ?? siteUrl;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/billing?status=success`,
      cancel_url: `${origin}/billing?status=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      console.error("Stripe did not return a checkout URL");
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Error creating Stripe checkout session:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create checkout session. Check server logs for details.";
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
