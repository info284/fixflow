export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      email: undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return NextResponse.json({
      ok: true,
      accountId: account.id,
    });
  } catch (err: any) {
    console.error("Stripe Connect create account error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Could not create Stripe Connect account",
      },
      { status: 500 }
    );
  }
}