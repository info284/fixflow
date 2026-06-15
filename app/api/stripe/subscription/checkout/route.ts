export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body?.email;
    const userId = body?.userId;

    if (!email || !userId) {
      return NextResponse.json(
        { error: "Missing email or userId" },
        { status: 400 }
      );
    }

const origin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://thefixflowapp.com";

const priceId =
  process.env.STRIPE_PRICE_ID || "price_1TifM4JTxWEB21BmdPVXAZXU";

console.log("PRICE ID =", priceId);

const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer_email: email,
  line_items: [
    {
      price: priceId,
      quantity: 1,
    },
  ],
  subscription_data: {
    trial_period_days: 60,
    metadata: {
      userId,
    },
  },
  metadata: {
    userId,
  },
  success_url: `${origin}/dashboard?trial=started`,
  cancel_url: `${origin}/signup?checkout=cancelled`,
});

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Subscription checkout error:", err);

    return NextResponse.json(
      { error: err?.message || "Subscription checkout failed" },
      { status: 500 }
    );
  }
}