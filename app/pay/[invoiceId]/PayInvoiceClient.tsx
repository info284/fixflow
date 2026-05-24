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

export default function PayInvoiceClient({ invoice }: { invoice: Invoice }) {
const [loading, setLoading] = useState(false);

const amount = Number(invoice.amount || 0);
const currency = invoice.currency || "GBP";
const invoiceRef = invoice.invoice_number || invoice.id.slice(0, 8);

const trader = invoice.profiles;
const traderName =
trader?.business_name || trader?.display_name || "Your tradesperson";

async function startPayment() {
try {
setLoading(true);

const res = await fetch("/api/stripe/checkout", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ invoiceId: invoice.id }),
});

const json = await res.json().catch(() => null);

if (!res.ok || !json?.url) {
throw new Error(json?.error || "Could not start payment");
}

window.location.href = json.url;
} catch (e: any) {
alert(e?.message || "Payment failed to start");
} finally {
setLoading(false);
}
}

const paid = invoice.status === "paid";

return (
<main
style={{
minHeight: "100vh",
background:
"linear-gradient(180deg, #F6F8FC 0%, #F8FBFF 48%, #FFFFFF 100%)",
display: "grid",
placeItems: "center",
padding: 24,
fontFamily:
"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}}
>
<div
style={{
width: "100%",
maxWidth: 500,
background: "#FFFFFF",
borderRadius: 30,
padding: 30,
boxShadow: "0 24px 70px rgba(15, 23, 42, 0.08)",
border: "1px solid #E6ECF5",
}}
>
<div style={{ textAlign: "center", marginBottom: 26 }}>
{trader?.logo_url ? (
<img
src={trader.logo_url}
alt={traderName}
style={{
width: 76,
height: 76,
objectFit: "cover",
borderRadius: 22,
marginBottom: 14,
border: "1px solid #E6ECF5",
}}
/>
) : (
<div
style={{
width: 76,
height: 76,
borderRadius: 22,
margin: "0 auto 14px",
display: "grid",
placeItems: "center",
background: "#EEF4FF",
color: "#1F355C",
fontSize: 28,
fontWeight: 950,
border: "1px solid #E6ECF5",
}}
>
{traderName.slice(0, 1).toUpperCase()}
</div>
)}

<div
style={{
fontSize: 22,
fontWeight: 950,
color: "#0B2A55",
letterSpacing: "-0.03em",
}}
>
{traderName}
</div>

<div
style={{
marginTop: 6,
color: "#64748B",
fontSize: 14,
fontWeight: 700,
}}
>
Secure invoice payment powered by FixFlow
</div>
</div>

<div
style={{
border: "1px solid #E6ECF5",
borderRadius: 24,
overflow: "hidden",
background: "#FFFFFF",
marginBottom: 24,
}}
>
<div
style={{
padding: 18,
background: "#F8FBFF",
borderBottom: "1px solid #E6ECF5",
}}
>
<div
style={{
fontSize: 11,
fontWeight: 950,
color: "#64748B",
marginBottom: 6,
textTransform: "uppercase",
letterSpacing: "0.11em",
}}
>
Invoice number
</div>

<div
style={{
fontSize: 21,
fontWeight: 950,
color: "#0B1320",
}}
>
{invoiceRef}
</div>
</div>

<div style={{ padding: 22 }}>
<div
style={{
fontSize: 13,
color: "#64748B",
marginBottom: 8,
fontWeight: 800,
}}
>
Total due
</div>

<div
style={{
fontSize: 38,
fontWeight: 950,
color: "#0B2A55",
letterSpacing: "-0.045em",
}}
>
{formatMoney(amount, currency)}
</div>

<div
style={{
marginTop: 16,
display: "inline-flex",
alignItems: "center",
gap: 8,
background: "#EEF4FF",
color: "#1F355C",
padding: "9px 13px",
borderRadius: 999,
fontWeight: 900,
fontSize: 12,
border: "1px solid rgba(31, 53, 92, 0.08)",
}}
>
Secure card payment
</div>
</div>
</div>

{paid ? (
<div
style={{
textAlign: "center",
padding: 18,
borderRadius: 20,
background: "#ECFDF3",
color: "#166534",
fontWeight: 900,
}}
>
✓ This invoice has already been paid. Thank you.
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
: "linear-gradient(180deg, #1F4B99 0%, #163B73 100%)",
color: "#FFFFFF",
fontWeight: 950,
fontSize: 16,
cursor: loading || amount <= 0 ? "not-allowed" : "pointer",
boxShadow:
loading || amount <= 0
? "none"
: "0 18px 40px rgba(15, 23, 42, 0.12)",
}}
>
{loading ? "Starting secure payment…" : "Pay securely by card"}
</button>
)}

<div
style={{
marginTop: 18,
fontSize: 13,
lineHeight: 1.6,
color: "#64748B",
textAlign: "center",
}}
>
Powered by FixFlow. Card payments are securely processed by Stripe.
</div>
</div>
</main>
);
}