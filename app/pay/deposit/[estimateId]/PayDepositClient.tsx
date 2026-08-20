"use client";

import { useState } from "react";

type TraderProfile =
| {
display_name: string | null;
business_name: string | null;
logo_url: string | null;
}
| null;

type DepositEstimate = {
id: string;
estimate_type: "quick" | "detailed";
deposit_amount: number;
deposit_status: string | null;
request_id: string | null;
customer_name: string | null;
job_number: string | null;
job_type: string | null;
profiles?: TraderProfile;
};

function formatMoney(amount: number) {
return new Intl.NumberFormat("en-GB", {
style: "currency",
currency: "GBP",
}).format(Number(amount || 0));
}

export default function PayDepositClient({
estimate,
}: {
estimate: DepositEstimate;
}) {
const [loading, setLoading] = useState(false);

const amount = Number(estimate.deposit_amount || 0);

const trader = estimate.profiles;

const traderName =
trader?.business_name ||
trader?.display_name ||
"Your tradesperson";

const paid = estimate.deposit_status === "paid";

async function startPayment() {
try {
setLoading(true);

const res = await fetch("/api/deposits/create-checkout", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
estimateId: estimate.id,
estimateType: estimate.estimate_type,
}),
});

const json = await res.json().catch(() => null);

if (!res.ok || !json?.url) {
throw new Error(
json?.error || "Could not start payment"
);
}

window.location.href = json.url;
} catch (e: any) {
alert(e?.message || "Payment failed to start");
} finally {
setLoading(false);
}
}

return (
<main
style={{
minHeight: "100vh",
background: "#F6F8FC",
display: "grid",
placeItems: "center",
padding: 20,
fontFamily: "Arial, sans-serif",
}}
>
<div
style={{
width: "100%",
maxWidth: 520,
background: "#FFFFFF",
borderRadius: 32,
overflow: "hidden",
border: "1px solid #E6ECF5",
boxShadow:
"0 20px 60px rgba(15, 23, 42, 0.08)",
}}
>
{/* HEADER */}

<div
style={{
background: "#0B2A55",
padding: "34px 30px",
textAlign: "center",
}}
>
{trader?.logo_url ? (
<img
src={trader.logo_url}
alt={traderName}
style={{
width: 78,
height: 78,
objectFit: "cover",
borderRadius: 22,
background: "#FFFFFF",
marginBottom: 18,
border:
"1px solid rgba(255,255,255,0.14)",
}}
/>
) : null}

<div
style={{
color: "rgba(255,255,255,0.72)",
fontSize: 12,
fontWeight: 700,
letterSpacing: "0.14em",
textTransform: "uppercase",
marginBottom: 12,
}}
>
FixFlow secure payment
</div>

<div
style={{
color: "#FFFFFF",
fontSize: 38,
lineHeight: 1.05,
fontWeight: 950,
letterSpacing: "-0.035em",
marginBottom: 14,
}}
>
Pay your deposit
</div>

<div
style={{
color: "rgba(255,255,255,0.78)",
fontSize: 16,
lineHeight: 1.7,
maxWidth: 360,
margin: "0 auto",
}}
>
Deposit requested by {traderName}
</div>
</div>

{/* BODY */}

<div style={{ padding: 30 }}>
<div
style={{
background: "#F8FBFF",
borderRadius: 24,
overflow: "hidden",
marginBottom: 26,
}}
>
<div
style={{
padding: 20,
borderBottom: "1px solid #E6ECF5",
}}
>
<div
style={{
fontSize: 11,
fontWeight: 700,
color: "#5F708A",
marginBottom: 8,
textTransform: "uppercase",
letterSpacing: "0.12em",
}}
>
Job reference
</div>

<div
style={{
fontSize: 24,
fontWeight: 950,
color: "#1F355C",
letterSpacing: "-0.03em",
}}
>
{estimate.job_number || estimate.id.slice(0, 8)}
</div>

{estimate.job_type ? (
<div
style={{
marginTop: 8,
fontSize: 14,
color: "#5F708A",
}}
>
{estimate.job_type}
</div>
) : null}
</div>

<div style={{ padding: 22 }}>
<div
style={{
fontSize: 13,
color: "#5F708A",
marginBottom: 10,
fontWeight: 800,
}}
>
Deposit due
</div>

<div
style={{
fontSize: 42,
lineHeight: 1,
fontWeight: 950,
color: "#0F172A",
letterSpacing: "-0.035em",
}}
>
{formatMoney(amount)}
</div>
</div>
</div>

{paid ? (
<div
style={{
padding: 18,
borderRadius: 18,
background: "#F4F8FE",
border: "1px solid #E6ECF5",
color: "#1F355C",
textAlign: "center",
fontWeight: 800,
marginBottom: 20,
}}
>
✓ This deposit has already been paid
</div>
) : (
<button
type="button"
onClick={startPayment}
disabled={loading || amount <= 0}
style={{
width: "100%",
height: 58,
borderRadius: 12,
border: "none",
background:
loading || amount <= 0
? "#94A3B8"
: "#1F355C",
color: "#FFFFFF",
fontWeight: 700,
fontSize: 16,
cursor:
loading || amount <= 0
? "not-allowed"
: "pointer",
boxShadow:
loading || amount <= 0
? "none"
: "0 12px 28px rgba(31, 53, 92, 0.18)",
}}
>
{loading
? "Starting secure payment…"
: "Pay deposit securely"}
</button>
)}

<div
style={{
marginTop: 20,
textAlign: "center",
color: "#5F708A",
fontSize: 13,
lineHeight: 1.7,
}}
>
Powered by FixFlow. Card payments are securely processed by
Stripe.
</div>
</div>
</div>
</main>
);
}