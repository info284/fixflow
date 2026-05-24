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
  .update({
    status: "paid",
    paid_at: new Date().toISOString(),
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null,
  })
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
const { data: trader } = await supabase
  .from("profiles")
  .select("display_name, business_name, logo_url")
  .eq("id", invoice.user_id)
  .maybeSingle();
  
    const toEmail =
      invoice.to_email ||
      requestRow?.customer_email ||
      session.customer_details?.email ||
      session.customer_email;

console.log("Receipt check:", {
  toEmail,
  receipt_sent_at: invoice.receipt_sent_at,
  invoiceId: invoice.id,
});

if (toEmail && !invoice.receipt_sent_at) {
      try {
        const sent = await resend.emails.send({
        from: "FixFlow Receipts <receipts@send.thefixflowapp.com>",
          to: toEmail,
          subject: `Payment received for ${invoice.invoice_number || "your invoice"}`,
html: `
<div style="margin:0; padding:0; background:#F6F8FC; font-family:Arial, sans-serif;">
<div style="max-width:620px; margin:0 auto; padding:28px 16px;">
<div style="background:#ffffff; border:1px solid #E6ECF5; border-radius:28px; overflow:hidden; box-shadow:0 24px 70px rgba(15,23,42,0.08);">

<div style="padding:30px 28px 24px; text-align:center; background:#F8FBFF; border-bottom:1px solid #E6ECF5;">
${
trader?.logo_url
? `<img src="${trader.logo_url}" alt="" style="width:72px; height:72px; object-fit:cover; border-radius:22px; border:1px solid #E6ECF5; margin-bottom:14px;" />`
: `<div style="width:72px; height:72px; border-radius:22px; background:#EEF4FF; color:#1F355C; border:1px solid #E6ECF5; display:inline-grid; place-items:center; font-size:28px; font-weight:900; margin-bottom:14px;">
${(trader?.business_name || trader?.display_name || "T").slice(0, 1).toUpperCase()}
</div>`
}

<div style="font-size:22px; font-weight:900; color:#0B2A55;">
${trader?.business_name || trader?.display_name || "Your tradesperson"}
</div>

<div style="margin-top:6px; font-size:14px; font-weight:700; color:#64748B;">
Payment receipt powered by FixFlow
</div>
</div>

<div style="padding:30px 28px;">
<div style="width:74px; height:74px; border-radius:24px; background:#EEF4FF; color:#1F355C; border:1px solid #E6ECF5; display:grid; place-items:center; font-size:34px; font-weight:900; margin:0 auto 22px;">
✓
</div>

<h1 style="margin:0 0 12px; text-align:center; font-size:32px; line-height:1.12; color:#0B2A55;">
Payment received
</h1>

<p style="margin:0 0 26px; text-align:center; font-size:16px; line-height:1.7; color:#64748B;">
Hi ${requestRow?.customer_name || "there"}, thanks — your card payment has been completed successfully.
</p>

<div style="border:1px solid #E6ECF5; border-radius:22px; background:#FFFFFF; overflow:hidden; margin-bottom:24px;">
<div style="padding:18px; background:#F8FBFF; border-bottom:1px solid #E6ECF5;">
<div style="font-size:11px; font-weight:900; color:#64748B; letter-spacing:0.1em; text-transform:uppercase;">
Invoice
</div>
<div style="margin-top:6px; font-size:21px; font-weight:900; color:#0B1320;">
${invoice.invoice_number || invoice.id}
</div>
</div>

<div style="padding:22px 18px; border-bottom:1px solid #E6ECF5;">
<div style="font-size:13px; color:#64748B; font-weight:700; margin-bottom:6px;">
Amount paid
</div>
<div style="font-size:34px; font-weight:900; color:#0B2A55;">
${money(invoice.amount)}
</div>
</div>

<div style="padding:18px;">
<p style="margin:0 0 10px; font-size:15px; color:#0B1320;">
<strong>Job:</strong> ${requestRow?.job_type || "Work completed"}
</p>
<p style="margin:0; font-size:15px; color:#0B1320;">
<strong>Reference:</strong> ${requestRow?.job_number || invoice.request_id || "—"}
</p>
</div>
</div>

<div style="padding:15px 18px; border-radius:18px; background:#EEF4FF; color:#1F355C; font-size:15px; font-weight:800; margin-bottom:24px; border:1px solid rgba(31,53,92,0.08);">
Your payment has been confirmed securely.
</div>

<p style="margin:0; font-size:15px; line-height:1.7; color:#64748B;">
Kind regards,<br/>
<strong style="color:#0B2A55;">
${trader?.business_name || trader?.display_name || "Your tradesperson"}
</strong>
</p>
</div>
</div>

<div style="text-align:center; margin-top:18px; font-size:12px; color:#94A3B8;">
Powered by FixFlow · Card payment processed securely by Stripe
</div>
</div>
</div>
`,
        });
if (sent.error) {
  console.error("Receipt Resend error:", sent.error);
  throw new Error(sent.error.message || "Receipt email failed");
}

console.log("Receipt email result:", sent);

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