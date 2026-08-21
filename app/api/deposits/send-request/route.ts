export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
buildFixFlowEmail,
buildFixFlowButton,
buildFixFlowInfoCard,
buildFixFlowSectionLabel,
escapeEmailHtml,
} from "@/lib/emails/fixflowEmail";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
/* ---------------- helpers ---------------- */

function supabaseAdmin() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!,
{
auth: { persistSession: false },
}
);
}

function supabaseAnon() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
{
auth: { persistSession: false },
}
);
}

async function getAuthedUserId(req: Request) {
const authHeader = req.headers.get("authorization") || "";

const token = authHeader.toLowerCase().startsWith("bearer ")
? authHeader.slice(7).trim()
: "";

if (!token) return null;

const anon = supabaseAnon();

const { data, error } = await anon.auth.getUser(token);

if (error || !data?.user?.id) {
return null;
}

return data.user.id;
}

function money(value: number) {
return new Intl.NumberFormat("en-GB", {
style: "currency",
currency: "GBP",
}).format(Number(value || 0));
}

/* ---------------- route ---------------- */

export async function POST(req: Request) {
try {
const uid = await getAuthedUserId(req);

if (!uid) {
return NextResponse.json(
{
ok: false,
error: "Not authenticated",
},
{ status: 401 }
);
}

const body = await req.json().catch(() => null);

const estimateId = String(body?.estimateId || "").trim();
const estimateType = String(body?.estimateType || "").trim();
const depositAmount = Number(body?.depositAmount || 0);

if (!estimateId) {
return NextResponse.json(
{
ok: false,
error: "Missing estimateId",
},
{ status: 400 }
);
}

if (
estimateType !== "quick" &&
estimateType !== "detailed"
) {
return NextResponse.json(
{
ok: false,
error: "Invalid estimate type",
},
{ status: 400 }
);
}

if (
!Number.isFinite(depositAmount) ||
depositAmount <= 0
) {
return NextResponse.json(
{
ok: false,
error: "Enter a valid deposit amount",
},
{ status: 400 }
);
}

const admin = supabaseAdmin();

const table =
estimateType === "quick"
? "quick_estimates"
: "estimates";

/* ---------------- estimate ---------------- */

const estimateSelect =
estimateType === "quick"
? `
id,
request_id,
plumber_id,
total_amount,
status,
deposit_status
`
: `
id,
request_id,
plumber_id,
total,
status,
deposit_status
`;

const { data: estimate, error: estimateError } =
await admin
.from(table)
.select(estimateSelect)
.eq("id", estimateId)
.eq("plumber_id", uid)
.maybeSingle();

if (estimateError) {
throw new Error(
`Estimate load failed: ${estimateError.message}`
);
}

if (!estimate) {
return NextResponse.json(
{
ok: false,
error: "Estimate not found",
},
{ status: 404 }
);
}

if (estimate.status !== "accepted") {
return NextResponse.json(
{
ok: false,
error: "A deposit can only be requested after the estimate is accepted",
},
{ status: 400 }
);
}

const totalAmount =
estimateType === "quick"
? Number((estimate as any).total_amount || 0)
: Number((estimate as any).total || 0);

if (depositAmount >= totalAmount) {
return NextResponse.json(
{
ok: false,
error:
"Deposit must be less than the estimate total",
},
{ status: 400 }
);
}

if (estimate.deposit_status === "paid") {
return NextResponse.json(
{
ok: false,
error: "Deposit has already been paid",
},
{ status: 400 }
);
}

/* ---------------- enquiry ---------------- */

const { data: requestRow, error: requestError } =
await admin
.from("quote_requests")
.select(`
id,
customer_name,
customer_email,
job_number,
job_type
`)
.eq("id", estimate.request_id)
.eq("plumber_id", uid)
.maybeSingle();

if (requestError) {
throw new Error(
`Enquiry load failed: ${requestError.message}`
);
}

if (!requestRow) {
return NextResponse.json(
{
ok: false,
error: "Customer enquiry not found",
},
{ status: 404 }
);
}

const to = String(
requestRow.customer_email || ""
).trim();

if (!to) {
return NextResponse.json(
{
ok: false,
error: "Customer email is missing",
},
{ status: 400 }
);
}

/* ---------------- trader ---------------- */

const { data: profile, error: profileError } =
await admin
.from("profiles")
.select(`
display_name,
business_name,
slug,
logo_url,
brand_colour,
stripe_account_id
`)
.eq("id", uid)
.maybeSingle();

if (profileError) {
throw new Error(
`Profile load failed: ${profileError.message}`
);
}

const stripeAccountId = profile?.stripe_account_id;

if (!stripeAccountId) {
return NextResponse.json(
{
ok: false,
error: "Connect Stripe before requesting a deposit.",
},
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
ok: false,
error:
"Your Stripe account is not fully ready to receive deposits yet. Complete Stripe onboarding first.",
},
{ status: 400 }
);
}

const traderName =
String(profile?.business_name || "").trim() ||
String(profile?.display_name || "").trim() ||
String(profile?.slug || "").trim() ||
"Your tradesperson";

const origin =
process.env.NEXT_PUBLIC_SITE_URL ||
process.env.NEXT_PUBLIC_APP_URL ||
"https://thefixflowapp.com";

const payUrl =
`${origin}/pay/deposit/${estimate.id}` +
`?type=${estimateType}`;

const requestedAt = new Date().toISOString();



/* ---------------- email ---------------- */

const customerName = String(
requestRow.customer_name || "there"
).trim();

const firstName =
customerName.split(" ")[0] || "there";

const safeCustomerName =
escapeEmailHtml(firstName);

const safeTraderName =
escapeEmailHtml(traderName);

const safeJobNumber =
escapeEmailHtml(
requestRow.job_number ||
estimate.id.slice(0, 8)
);

const safeJobType =
escapeEmailHtml(
requestRow.job_type || "Your booking"
);

const safeDeposit =
escapeEmailHtml(money(depositAmount));

const html = buildFixFlowEmail({
title: "Deposit requested",

introHtml: `
<div style="font-size:16px; font-weight:700; margin-bottom:10px;">
Hi ${safeCustomerName},
</div>

<div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
${safeTraderName} has requested a deposit to secure your booking.
</div>
`,

bodyHtml: `
${buildFixFlowInfoCard(`
<div style="padding:16px 18px; border-bottom:1px solid #E6ECF5;">
${buildFixFlowSectionLabel("Job reference")}

<div style="font-size:18px; font-weight:800; color:#1F355C;">
${safeJobNumber}
</div>

<div style="margin-top:6px; font-size:14px; color:#5C6B84;">
${safeJobType}
</div>
</div>

<div style="padding:22px 18px;">
${buildFixFlowSectionLabel("Deposit due")}

<div style="font-size:34px; line-height:1; font-weight:900; color:#0B1320; letter-spacing:-0.04em;">
${safeDeposit}
</div>
</div>
`)}

<div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
Pay securely by card using the button below. Once payment is received, your tradesperson can confirm your booking.
</div>
`,

ctaHtml: `
${buildFixFlowButton(
"💳 Pay deposit",
payUrl
)}
`,

closingHtml: `
<div style="font-size:15px; line-height:1.7; color:#5C6B84;">
Thanks,<br />
<span style="font-weight:800; color:#1F355C;">
${safeTraderName}
</span>
</div>
`,
});

const resendKey =
process.env.RESEND_API_KEY;

if (!resendKey) {
throw new Error("Missing RESEND_API_KEY");
}

const resend = new Resend(resendKey);

const from =
process.env.RESEND_FROM ||
process.env.EMAIL_FROM ||
"FixFlow <noreply@send.thefixflowapp.com>";

const sent = await resend.emails.send({
from,
to,
subject: `Deposit requested by ${traderName}`,
html,

text: `Hi ${firstName},

${traderName} has requested a deposit to secure your booking.

Job: ${requestRow.job_type || "Your booking"}
Reference: ${requestRow.job_number || estimate.id.slice(0, 8)}
Deposit due: ${money(depositAmount)}

Pay your deposit securely:
${payUrl}

Once payment is received, your tradesperson can confirm your booking.

Thanks,
${traderName}`,
});

if (sent.error) {
throw new Error(
sent.error.message ||
"Deposit email failed to send"
);
}

/* ---------------- save deposit ---------------- */

const { error: updateError } = await admin
.from(table)
.update({
deposit_required: true,
deposit_amount: depositAmount,
deposit_status: "requested",
deposit_requested_at: requestedAt,
})
.eq("id", estimate.id)
.eq("plumber_id", uid);

if (updateError) {
throw new Error(
`Deposit update failed: ${updateError.message}`
);
}

return NextResponse.json({
ok: true,
depositAmount,
requestedAt,
});
} catch (e: any) {
console.error(
"❌ deposit request email crashed:",
e
);

return NextResponse.json(
{
ok: false,
error:
e?.message ||
"Could not send deposit request",
},
{ status: 500 }
);
}
}