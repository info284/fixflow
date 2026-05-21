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
        request_id
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

    // 2. Create Stripe checkout session
    const origin = new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      payment_method_types: ["card"],

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

    success_url: `${origin}/pay/receipt?invoiceId=${invoiceId}`,
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
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}