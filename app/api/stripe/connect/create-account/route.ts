export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  try {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://thefixflowapp.com";

    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}/dashboard/profile?stripe=refresh`,
      return_url: `${siteUrl}/dashboard/profile?stripe=connected`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      ok: true,
      accountId: account.id,
      url: accountLink.url,
    });
  } catch (err: any) {
    console.error("Stripe Connect create account error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Could not connect Stripe",
      },
      { status: 500 }
    );
  }
}