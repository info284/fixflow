"use client";

import { useState } from "react";

type TraderProfile =
| {
display_name: string | null;
business_name: string | null;
logo_url: string | null;
}
| null;

type Invoice = {
id: string;
amount: number;
currency: string | null;
invoice_number: string | null;
to_email: string | null;
status: string | null;
profiles?: TraderProfile;
};

function formatMoney(amount: number, currency = "GBP") {
return new Intl.NumberFormat("en-GB", {
style: "currency",
currency,
}).format(Number(amount || 0));
}

export default function PayInvoiceClient({
invoice,
}: {
invoice: Invoice;
}) {
const [loading, setLoading] = useState(false);

const amount = Number(invoice.amount || 0);
const currency = invoice.currency || "GBP";
const invoiceRef =
invoice.invoice_number || invoice.id.slice(0, 8);

const trader = invoice.profiles;

const traderName =
trader?.business_name ||
trader?.display_name ||
"Your tradesperson";

const paid = invoice.status === "paid";

async function startPayment() {
try {
setLoading(true);

const res = await fetch("/api/stripe/checkout", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
invoiceId: invoice.id,
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
background: "#F4F7FB",
display: "grid",
placeItems: "center",
padding: 20,
fontFamily:
"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}}
>
<div
style={{
width: "100%",
maxWidth: 520,
background: "#FFFFFF",
borderRadius: 32,
overflow: "hidden",
border: "1px solid #E2E8F0",
boxShadow:
"0 20px 60px rgba(15, 23, 42, 0.08)",
}}
>
{/* HEADER */}

<div
style={{
background: "#0F3267",
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
border: "1px solid rgba(255,255,255,0.14)",
}}
/>
) : null}

<div
style={{
color: "rgba(255,255,255,0.72)",
fontSize: 12,
fontWeight: 900,
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
letterSpacing: "-0.05em",
marginBottom: 14,
}}
>
Pay your invoice
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
Invoice from {traderName}
</div>
</div>

{/* BODY */}

<div
style={{
padding: 30,
}}
>
<div
style={{
border: "1px solid #E2E8F0",
borderRadius: 24,
overflow: "hidden",
marginBottom: 26,
background: "#F8FAFC",
}}
>
<div
style={{
padding: 20,
borderBottom: "1px solid #E2E8F0",
}}
>
<div
style={{
fontSize: 11,
fontWeight: 900,
color: "#667085",
marginBottom: 8,
textTransform: "uppercase",
letterSpacing: "0.12em",
}}
>
Invoice number
</div>

<div
style={{
fontSize: 24,
fontWeight: 950,
color: "#0F3267",
letterSpacing: "-0.03em",
}}
>
{invoiceRef}
</div>
</div>

<div
style={{
padding: 22,
}}
>
<div
style={{
fontSize: 13,
color: "#667085",
marginBottom: 10,
fontWeight: 800,
}}
>
Total due
</div>

<div
style={{
fontSize: 42,
lineHeight: 1,
fontWeight: 950,
color: "#0B1320",
letterSpacing: "-0.05em",
}}
>
{formatMoney(amount, currency)}
</div>
</div>
</div>

{paid ? (
<div
style={{
padding: 18,
borderRadius: 18,
background: "#EEF4FF",
border: "1px solid #D9E4F5",
textAlign: "center",
color: "#163A70",
fontWeight: 800,
marginBottom: 20,
}}
>
✓ This invoice has already been paid
</div>
) : (
<button
type="button"
onClick={startPayment}
disabled={loading || amount <= 0}
style={{
width: "100%",
height: 58,
borderRadius: 999,
border: "none",
background:
loading || amount <= 0
? "#94A3B8"
: "#163A70",
color: "#FFFFFF",
fontWeight: 900,
fontSize: 16,
cursor:
loading || amount <= 0
? "not-allowed"
: "pointer",
boxShadow:
loading || amount <= 0
? "none"
: "0 12px 28px rgba(15, 50, 103, 0.18)",
}}
>
{loading
? "Starting secure payment…"
: "Pay securely by card"}
</button>
)}

<div
style={{
marginTop: 20,
textAlign: "center",
color: "#667085",
fontSize: 13,
lineHeight: 1.7,
}}
>
Powered by FixFlow. Card payments are
securely processed by Stripe.
</div>
</div>
</div>
</main>
);
}