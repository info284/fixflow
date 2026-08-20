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

function fromUnix(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature failed:", err.message);
    return NextResponse.json(
      { error: `Webhook error: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.userId;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;

      if (userId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );

        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: subscription.status,
            trial_ends_at: fromUnix(subscription.trial_end),
            subscription_current_period_end: fromUnix(
             (subscription as any).current_period_end
            ),
          })
          .eq("id", userId);

        return NextResponse.json({ received: true });
      }

     if (session.payment_status !== "paid") {
return NextResponse.json({ received: true });
}

/* ---------------- deposit payment ---------------- */

if (session.metadata?.paymentType === "deposit") {
const estimateId = session.metadata?.estimateId;
const estimateType = session.metadata?.estimateType;

if (!estimateId) {
console.error("Deposit payment missing estimateId");
return NextResponse.json({ received: true });
}

if (estimateType !== "quick" && estimateType !== "detailed") {
console.error("Deposit payment has invalid estimateType");
return NextResponse.json({ received: true });
}

const table =
estimateType === "quick"
? "quick_estimates"
: "estimates";

const { error: depositError } = await supabase
.from(table)
.update({
deposit_status: "paid",
deposit_paid_at: new Date().toISOString(),
deposit_stripe_session_id: session.id,
deposit_stripe_payment_intent_id:
typeof session.payment_intent === "string"
? session.payment_intent
: session.payment_intent?.id || null,
})
.eq("id", estimateId);

if (depositError) {
console.error(
"Deposit payment update failed:",
depositError.message
);

return NextResponse.json({ received: true });
}

/* ---------------- deposit receipt data ---------------- */

const { data: depositEstimate } = await supabase
.from(table)
.select(`
id,
request_id,
plumber_id,
deposit_amount,
deposit_receipt_sent_at
`)
.eq("id", estimateId)
.maybeSingle();

if (!depositEstimate) {
console.error("Paid deposit estimate could not be loaded");
return NextResponse.json({ received: true });
}
if (depositEstimate.deposit_receipt_sent_at) {
  return NextResponse.json({ received: true });
}

const { data: depositRequest } = await supabase
.from("quote_requests")
.select(`
customer_name,
customer_email,
job_number,
job_type
`)
.eq("id", depositEstimate.request_id)
.maybeSingle();

const { data: depositTrader } = await supabase
.from("profiles")
.select(`
display_name,
business_name,
logo_url
`)
.eq("id", depositEstimate.plumber_id)
.maybeSingle();

const depositToEmail =
depositRequest?.customer_email ||
session.customer_details?.email ||
session.customer_email;

if (depositToEmail) {
const resend = new Resend(process.env.RESEND_API_KEY);

const traderName =
depositTrader?.business_name ||
depositTrader?.display_name ||
"Your tradesperson";

const traderInitial = traderName.slice(0, 1).toUpperCase();

const sent = await resend.emails.send({
from: "FixFlow Receipts <receipts@send.thefixflowapp.com>",
to: depositToEmail,
subject: `Deposit received for ${
depositRequest?.job_number || "your booking"
}`,

html: `
<div style="margin:0;padding:0;background:#eef4f8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:620px;margin:0 auto;padding:28px 16px;">
<div style="background:#ffffff;border:1px solid #E6ECF5;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.08);">

<div style="padding:34px 28px;text-align:center;background:#1F355C;">
${
depositTrader?.logo_url
? `<img
src="${escapeHtml(depositTrader.logo_url)}"
alt=""
style="width:72px;height:72px;object-fit:cover;border-radius:22px;background:#ffffff;border:1px solid rgba(255,255,255,0.18);margin-bottom:18px;"
/>`
: `<div style="width:72px;height:72px;border-radius:22px;background:#ffffff;color:#1F355C;border:1px solid rgba(255,255,255,0.18);display:inline-grid;place-items:center;font-size:28px;font-weight:900;margin-bottom:18px;">
${escapeHtml(traderInitial)}
</div>`
}

<div style="font-size:12px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.72);margin-bottom:10px;">
FixFlow receipt
</div>

<div style="font-size:34px;line-height:1.08;font-weight:900;color:#ffffff;letter-spacing:-0.04em;">
Deposit received
</div>

<div style="margin-top:12px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.78);">
Receipt from ${escapeHtml(traderName)}
</div>
</div>

<div style="padding:30px 28px;">
<p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:#0F172A;">
Hi ${escapeHtml(depositRequest?.customer_name || "there")},
</p>

<p style="margin:0 0 26px;font-size:16px;line-height:1.7;color:#5F708A;">
Thanks — your deposit payment has been completed successfully.
</p>

<div style="border:1px solid #E6ECF5;border-radius:22px;background:#F8FBFF;overflow:hidden;margin-bottom:24px;">

<div style="padding:18px;border-bottom:1px solid #E6ECF5;">
<div style="font-size:11px;font-weight:900;color:#5F708A;letter-spacing:0.12em;text-transform:uppercase;">
Job reference
</div>

<div style="margin-top:8px;font-size:22px;font-weight:900;color:#1F355C;">
${escapeHtml(
depositRequest?.job_number || depositEstimate.id.slice(0, 8)
)}
</div>
</div>

<div style="padding:22px 18px;border-bottom:1px solid #E6ECF5;background:#ffffff;">
<div style="font-size:13px;color:#5F708A;font-weight:700;margin-bottom:8px;">
Deposit paid
</div>

<div style="font-size:36px;line-height:1;font-weight:900;color:#0F172A;letter-spacing:-0.04em;">
${money(depositEstimate.deposit_amount)}
</div>
</div>

<div style="padding:18px;">
<p style="margin:0;font-size:15px;color:#0F172A;line-height:1.6;">
<strong>Job:</strong>
${escapeHtml(
depositRequest?.job_type || "Your booking"
)}
</p>
</div>

</div>

<div style="padding:15px 18px;border-radius:18px;background:#F4F8FE;color:#1F355C;font-size:15px;font-weight:800;margin-bottom:24px;border:1px solid #E6ECF5;">
Your deposit has been confirmed securely. Your tradesperson can now confirm your booking.
</div>

<p style="margin:0;font-size:15px;line-height:1.7;color:#5F708A;">
Kind regards,<br/>
<strong style="color:#1F355C;">
${escapeHtml(traderName)}
</strong>
</p>
</div>
</div>

<div style="text-align:center;margin-top:18px;font-size:12px;color:#94A3B8;">
Powered by FixFlow · Card payment processed securely by Stripe
</div>
</div>
</div>
`,

text: `Hi ${depositRequest?.customer_name || "there"},

Your deposit payment has been completed successfully.

Deposit paid: ${money(depositEstimate.deposit_amount)}
Job: ${depositRequest?.job_type || "Your booking"}
Reference: ${
depositRequest?.job_number || depositEstimate.id.slice(0, 8)
}

Your tradesperson can now confirm your booking.

Kind regards,
${traderName}

Powered by FixFlow · Card payment processed securely by Stripe`,
});
if (sent.error) {
console.error(
"Deposit receipt Resend error:",
sent.error
);

throw new Error(
sent.error.message || "Deposit receipt email failed"
);
}

if (sent?.data?.id) {
const { error: receiptTimestampError } = await supabase
.from(table)
.update({
deposit_receipt_sent_at: new Date().toISOString(),
})
.eq("id", depositEstimate.id);

if (receiptTimestampError) {
console.error(
"Deposit receipt timestamp update failed:",
receiptTimestampError.message
);
}
}
}
return NextResponse.json({ received: true });
}

/* ---------------- invoice payment ---------------- */

const invoiceId = session.metadata?.invoiceId;
      if (!invoiceId) return NextResponse.json({ received: true });

      const resend = new Resend(process.env.RESEND_API_KEY);

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invoiceError || !invoice) {
        console.error(
          "Invoice lookup failed:",
          invoiceError?.message || invoiceId
        );
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
      } else if (invoice.request_id) {
        const { error: requestPaidError } = await supabase
          .from("quote_requests")
          .update({
            status: "paid",
            stage: "paid",
          })
          .eq("id", invoice.request_id);

        if (requestPaidError) {
          console.error(
            "Quote request paid update failed:",
            requestPaidError.message
          );
        }
      }

      const { data: requestRow } = await supabase
        .from("quote_requests")
        .select("customer_name, customer_email, job_type, job_number")
        .eq("id", invoice.request_id)
        .maybeSingle();

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

      if (toEmail && !invoice.receipt_sent_at) {
        try {
          const traderName =
            trader?.business_name ||
            trader?.display_name ||
            "Your tradesperson";

          const traderInitial = traderName.slice(0, 1).toUpperCase();

          const sent = await resend.emails.send({
            from: "FixFlow Receipts <receipts@send.thefixflowapp.com>",
            to: toEmail,
            subject: `Payment received for ${
              invoice.invoice_number || "your invoice"
            }`,
            html: `
<div style="margin:0;padding:0;background:#eef4f8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
    <div style="background:#ffffff;border:1px solid #E6ECF5;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.08);">

      <div style="padding:34px 28px;text-align:center;background:#1F355C;">
        ${
          trader?.logo_url
            ? `<img src="${escapeHtml(
                trader.logo_url
              )}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:22px;background:#ffffff;border:1px solid rgba(255,255,255,0.18);margin-bottom:18px;" />`
            : `<div style="width:72px;height:72px;border-radius:22px;background:#ffffff;color:#1F355C;border:1px solid rgba(255,255,255,0.18);display:inline-grid;place-items:center;font-size:28px;font-weight:900;margin-bottom:18px;">${escapeHtml(
                traderInitial
              )}</div>`
        }

        <div style="font-size:12px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.72);margin-bottom:10px;">
          FixFlow receipt
        </div>

        <div style="font-size:34px;line-height:1.08;font-weight:900;color:#ffffff;letter-spacing:-0.04em;">
          Payment received
        </div>

        <div style="margin-top:12px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.78);">
          Receipt from ${escapeHtml(traderName)}
        </div>
      </div>

      <div style="padding:30px 28px;">
        <p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:#0F172A;">
          Hi ${escapeHtml(requestRow?.customer_name || "there")},
        </p>

        <p style="margin:0 0 26px;font-size:16px;line-height:1.7;color:#5F708A;">
          Thanks — your card payment has been completed successfully.
        </p>

        <div style="border:1px solid #E6ECF5;border-radius:22px;background:#F8FBFF;overflow:hidden;margin-bottom:24px;">
          <div style="padding:18px;border-bottom:1px solid #E6ECF5;">
            <div style="font-size:11px;font-weight:900;color:#5F708A;letter-spacing:0.12em;text-transform:uppercase;">
              Invoice
            </div>
            <div style="margin-top:8px;font-size:22px;font-weight:900;color:#1F355C;">
              ${escapeHtml(invoice.invoice_number || invoice.id)}
            </div>
          </div>

          <div style="padding:22px 18px;border-bottom:1px solid #E6ECF5;background:#ffffff;">
            <div style="font-size:13px;color:#5F708A;font-weight:700;margin-bottom:8px;">
              Amount paid
            </div>
            <div style="font-size:36px;line-height:1;font-weight:900;color:#0F172A;letter-spacing:-0.04em;">
              ${money(invoice.amount)}
            </div>
          </div>

          <div style="padding:18px;">
            <p style="margin:0 0 10px;font-size:15px;color:#0F172A;line-height:1.6;">
              <strong>Job:</strong> ${escapeHtml(
                requestRow?.job_type || "Work completed"
              )}
            </p>
            <p style="margin:0;font-size:15px;color:#0F172A;line-height:1.6;">
              <strong>Reference:</strong> ${escapeHtml(
                requestRow?.job_number || invoice.request_id || "—"
              )}
            </p>
          </div>
        </div>

        <div style="padding:15px 18px;border-radius:18px;background:#F4F8FE;color:#1F355C;font-size:15px;font-weight:800;margin-bottom:24px;border:1px solid #E6ECF5;">
          Your payment has been confirmed securely.
        </div>

        <p style="margin:0;font-size:15px;line-height:1.7;color:#5F708A;">
          Kind regards,<br/>
          <strong style="color:#1F355C;">${escapeHtml(traderName)}</strong>
        </p>
      </div>
    </div>

    <div style="text-align:center;margin-top:18px;font-size:12px;color:#94A3B8;">
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

          if (sent?.data?.id) {
            const { error: receiptError } = await supabase
              .from("invoices")
              .update({ receipt_sent_at: new Date().toISOString() })
              .eq("id", invoice.id);

            if (receiptError) {
              console.error(
                "Receipt timestamp update failed:",
                receiptError.message
              );
            }
          }
        } catch (err: any) {
          console.error("Receipt email failed:", err?.message || err);
        }
      }
    }

if (
  event.type === "customer.subscription.updated" ||
  event.type === "customer.subscription.deleted"
) {
  const subscription = event.data.object as Stripe.Subscription;

  await supabase
    .from("profiles")
    .update({
      subscription_status: subscription.status,
      trial_ends_at: fromUnix(subscription.trial_end),
      subscription_current_period_end: fromUnix(
        (subscription as any).current_period_end
      ),
    })
    .eq("stripe_subscription_id", subscription.id);

  // If subscription becomes active, mark referral as converting
  if (subscription.status === "active") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, referred_by")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    if (profile?.referred_by) {
      await supabase
        .from("referrals")
        .update({ became_paying_at: new Date().toISOString() })
        .eq("referred_profile_id", profile.id)
        .is("became_paying_at", null);
    }
  }
}


    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook failed" },
      { status: 500 }
    );
  }
}