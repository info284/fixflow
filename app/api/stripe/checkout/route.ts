export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/* ---------------- setup ---------------- */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* ---------------- route ---------------- */

export async function POST(req: Request) {
  console.log("CHECKOUT ROUTE HIT");
  try {
    const body = await req.json();
    const invoiceId = body?.invoiceId;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Missing invoiceId" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // 1. Get invoice
    const { data: inv, error } = await supabase
      .from("invoices")
.select(`
  id,
  amount,
  currency,
  invoice_number,
  to_email,
  request_id,
  user_id
`)
      .eq("id", invoiceId)
      .maybeSingle();

    if (error || !inv) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const amount = Number(inv.amount || 0);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }
// 2. Get trader Stripe Connect account
const { data: profile } = await supabase
  .from("profiles")
  .select("stripe_account_id")
  .eq("id", inv.user_id)
  .maybeSingle();

const stripeAccountId = profile?.stripe_account_id;

if (!stripeAccountId) {
  return NextResponse.json(
    { error: "Trader has not connected Stripe" },
    { status: 400 }
  );
}
const connectedAccount = await stripe.accounts.retrieve(stripeAccountId);

const transfersReady =
  connectedAccount.capabilities?.transfers === "active" ||
  connectedAccount.capabilities?.legacy_payments === "active";

if (!transfersReady) {
  return NextResponse.json(
    {
      error:
        "This trader’s Stripe account is not fully ready to receive payments yet. Please complete Stripe onboarding.",
    },
    { status: 400 }
  );
}
    // 2. Create Stripe checkout session
  const origin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://thefixflowapp.com";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      payment_method_types: ["card"],
      payment_intent_data: {
  application_fee_amount: Math.round(amount * 0.01 * 100), // 1% FixFlow fee
  transfer_data: {
    destination: stripeAccountId,
  },
},

      customer_email: inv.to_email || undefined,

      line_items: [
        {
          price_data: {
            currency: inv.currency?.toLowerCase() || "gbp",
            product_data: {
              name: `Invoice ${inv.invoice_number || inv.id.slice(0, 8)}`,
            },
            unit_amount: Math.round(amount * 100), // pence
          },
          quantity: 1,
        },
      ],
success_url: `${origin}/pay/success?invoiceId=${invoiceId}`,
cancel_url: `${origin}/pay/${invoiceId}`,

      metadata: {
        invoiceId: inv.id,
      },
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);

return NextResponse.json(
  { error: err?.message || "Checkout failed" },
  { status: 500 }
);
  }
}