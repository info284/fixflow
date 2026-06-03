export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountId = body?.accountId;

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing accountId" },
        { status: 400 }
      );
    }

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://thefixflowapp.com";

const accountLink = await stripe.accountLinks.create({
  account: accountId,
  refresh_url: `${siteUrl}/dashboard/profile?stripe=refresh`,
  return_url: `${siteUrl}/dashboard/profile?stripe=connected`,
  type: "account_onboarding",
});

    return NextResponse.json({
      url: accountLink.url,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err?.message || "Could not create onboarding link",
      },
      { status: 500 }
    );
  }
}