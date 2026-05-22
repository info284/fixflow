export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature failed:", err.message);
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;

    if (!invoiceId) return NextResponse.json({ received: true });

    const supabase = supabaseAdmin();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      console.error("Invoice lookup failed:", invoiceError.message);
      return NextResponse.json({ received: true });
    }

    if (!invoice) {
      console.error("Invoice not found:", invoiceId);
      return NextResponse.json({ received: true });
    }

    const { error: paidError } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoice.id);

    if (paidError) {
      console.error("Invoice update failed:", paidError.message);
    }

    const { data: requestRow, error: requestError } = await supabase
      .from("quote_requests")
      .select("customer_name, customer_email, job_type, job_number")
      .eq("id", invoice.request_id)
      .maybeSingle();

    if (requestError) {
      console.error("Quote request lookup failed:", requestError.message);
    }

    const toEmail =
      invoice.to_email ||
      requestRow?.customer_email ||
      session.customer_details?.email ||
      session.customer_email;

    if (toEmail && !invoice.receipt_sent_at) {
      try {
        const sent = await resend.emails.send({
        from: "FixFlow Receipts <receipts@send.thefixflowapp.com>",
          to: toEmail,
          subject: `Payment received for ${invoice.invoice_number || "your invoice"}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #0b1320; line-height: 1.6;">
              <h2 style="color:#0b2a55;">Payment received</h2>
              <p>Hi ${requestRow?.customer_name || "there"},</p>
              <p>Thanks, your payment has been received successfully.</p>

              <div style="padding:16px; border:1px solid #e6ecf5; border-radius:14px; background:#f8fbff; margin:18px 0;">
                <p><strong>Invoice:</strong> ${invoice.invoice_number || invoice.id}</p>
                <p><strong>Amount paid:</strong> ${money(invoice.amount)}</p>
                <p><strong>Job:</strong> ${requestRow?.job_type || "Work completed"}</p>
                <p><strong>Reference:</strong> ${requestRow?.job_number || invoice.request_id || "—"}</p>
              </div>

              <p>This confirms your card payment has been completed.</p>
              <p>Kind regards,<br/>FixFlow</p>
            </div>
          `,
        });

        console.log("Receipt email result:", sent);

        if (sent?.data?.id) {
          const { error: receiptError } = await supabase
            .from("invoices")
            .update({ receipt_sent_at: new Date().toISOString() })
            .eq("id", invoice.id);

          if (receiptError) {
            console.error("Receipt timestamp update failed:", receiptError.message);
          }
        }
      } catch (err: any) {
        console.error("Receipt email failed:", err?.message || err);
      }
    } else {
      console.log("No receipt email needed or already sent.");
    }
  }

  return NextResponse.json({ received: true });
}