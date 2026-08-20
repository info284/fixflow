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

const estimateId = String(body?.estimateId || "").trim();
const estimateType = String(body?.estimateType || "").trim();

if (!estimateId) {
return NextResponse.json(
{ error: "Missing estimateId" },
{ status: 400 }
);
}

if (estimateType !== "quick" && estimateType !== "detailed") {
return NextResponse.json(
{ error: "Invalid estimateType" },
{ status: 400 }
);
}

const supabase = supabaseAdmin();

const table =
estimateType === "quick" ? "quick_estimates" : "estimates";

const estimateSelect =
estimateType === "quick"
? `
id,
request_id,
plumber_id,
total_amount,
deposit_required,
deposit_amount,
deposit_status
`
: `
id,
request_id,
plumber_id,
total,
deposit_required,
deposit_amount,
deposit_status
`;

const { data: estimate, error: estimateError } = await supabase
.from(table)
.select(estimateSelect)
.eq("id", estimateId)
.maybeSingle();

if (estimateError || !estimate) {
return NextResponse.json(
{ error: "Estimate not found" },
{ status: 404 }
);
}

if (!estimate.deposit_required) {
return NextResponse.json(
{ error: "Deposit is not required for this estimate" },
{ status: 400 }
);
}

const depositAmount = Number(estimate.deposit_amount || 0);

if (!depositAmount || depositAmount <= 0) {
return NextResponse.json(
{ error: "Invalid deposit amount" },
{ status: 400 }
);
}

if (estimate.deposit_status === "paid") {
return NextResponse.json(
{ error: "Deposit has already been paid" },
{ status: 400 }
);
}

const { data: requestRow } = await supabase
.from("quote_requests")
.select(`
customer_name,
customer_email,
job_number,
job_type
`)
.eq("id", estimate.request_id)
.maybeSingle();

const { data: profile } = await supabase
.from("profiles")
.select(`
business_name,
display_name,
stripe_account_id
`)
.eq("id", estimate.plumber_id)
.maybeSingle();

const stripeAccountId = profile?.stripe_account_id;

if (!stripeAccountId) {
return NextResponse.json(
{ error: "Trader has not connected Stripe" },
{ status: 400 }
);
}

const connectedAccount =
await stripe.accounts.retrieve(stripeAccountId);

if (
!connectedAccount.charges_enabled ||
!connectedAccount.payouts_enabled
) {
return NextResponse.json(
{
error:
"This trader’s Stripe account is not fully ready to receive payments yet.",
},
{ status: 400 }
);
}

const origin =
process.env.NEXT_PUBLIC_SITE_URL ||
process.env.NEXT_PUBLIC_APP_URL ||
"https://thefixflowapp.com";

const traderName =
profile?.business_name ||
profile?.display_name ||
"Your tradesperson";

const session = await stripe.checkout.sessions.create({
mode: "payment",

payment_method_types: ["card"],

payment_intent_data: {
application_fee_amount: Math.round(
depositAmount * 0.01 * 100
),
transfer_data: {
destination: stripeAccountId,
},
},

customer_email: requestRow?.customer_email || undefined,

line_items: [
{
price_data: {
currency: "gbp",
product_data: {
name: `Deposit for ${
requestRow?.job_type ||
requestRow?.job_number ||
"your booking"
}`,
description: `Deposit payable to ${traderName}`,
},
unit_amount: Math.round(depositAmount * 100),
},
quantity: 1,
},
],

success_url: `${origin}/pay/deposit-success?estimateId=${estimate.id}&estimateType=${estimateType}`,

cancel_url: `${origin}/pay/deposit/${estimate.id}?type=${estimateType}`,

metadata: {
paymentType: "deposit",
estimateType,
estimateId: estimate.id,
requestId: estimate.request_id || "",
plumberId: estimate.plumber_id || "",
},
});

const { error: updateError } = await supabase
.from(table)
.update({
deposit_stripe_session_id: session.id,
deposit_status: "requested",
deposit_requested_at: new Date().toISOString(),
})
.eq("id", estimate.id);

if (updateError) {
console.error(
"Failed to save deposit checkout session:",
updateError.message
);
}

return NextResponse.json({
url: session.url,
});
} catch (err: any) {
console.error("Deposit checkout error:", err);

return NextResponse.json(
{ error: err?.message || "Could not create deposit checkout" },
{ status: 500 }
);
}
}