export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
const userId = body.userId;

if (!userId) {
  return NextResponse.json(
    { error: "Missing userId" },
    { status: 400 }
  );
}

const supabase = supabaseAdmin();
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
await supabase
  .from("profiles")
  .update({
    stripe_account_id: account.id,
  })
  .eq("id", userId);
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