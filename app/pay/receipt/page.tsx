"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ReceiptInner() {
const searchParams = useSearchParams();
const invoiceId = searchParams.get("invoiceId");

return (
<main
style={{
minHeight: "100vh",
display: "grid",
placeItems: "center",
padding: 24,
background:
"linear-gradient(180deg, #F6F8FC 0%, #F8FBFF 48%, #FFFFFF 100%)",
fontFamily:
"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}}
>
<div
style={{
width: "min(540px, 100%)",
borderRadius: 30,
background: "#FFFFFF",
border: "1px solid #E6ECF5",
padding: 34,
textAlign: "center",
boxShadow: "0 24px 70px rgba(15, 23, 42, 0.08)",
}}
>
<div
style={{
width: 86,
height: 86,
borderRadius: 26,
background: "#EEF4FF",
display: "grid",
placeItems: "center",
margin: "0 auto 24px",
color: "#1F355C",
fontSize: 40,
fontWeight: 950,
border: "1px solid #E6ECF5",
}}
>
✓
</div>

<div
style={{
fontSize: 12,
fontWeight: 950,
color: "#64748B",
marginBottom: 10,
textTransform: "uppercase",
letterSpacing: "0.12em",
}}
>
Payment confirmed
</div>

<h1
style={{
color: "#0B2A55",
margin: "0 0 14px",
fontSize: 36,
lineHeight: 1.1,
fontWeight: 950,
letterSpacing: "-0.04em",
}}
>
Payment received
</h1>

<p
style={{
color: "#64748B",
lineHeight: 1.8,
fontSize: 16,
margin: "0 auto 28px",
maxWidth: 420,
}}
>
Thank you. Your invoice payment has been completed securely. A receipt
has been emailed to you.
</p>

{invoiceId ? (
<div
style={{
marginBottom: 28,
textAlign: "left",
border: "1px solid #E6ECF5",
borderRadius: 22,
overflow: "hidden",
background: "#FFFFFF",
}}
>
<div
style={{
padding: "14px 18px",
borderBottom: "1px solid #E6ECF5",
background: "#F8FBFF",
}}
>
<div
style={{
fontSize: 11,
fontWeight: 950,
color: "#64748B",
textTransform: "uppercase",
letterSpacing: "0.1em",
}}
>
Payment reference
</div>
</div>

<div
style={{
padding: 22,
fontSize: 26,
fontWeight: 950,
color: "#0B2A55",
letterSpacing: "-0.035em",
}}
>
{invoiceId.slice(0, 8).toUpperCase()}
</div>
</div>
) : null}

<button
type="button"
onClick={() => (window.location.href = "/")}
style={{
height: 54,
padding: "0 32px",
borderRadius: 999,
border: "none",
background: "linear-gradient(180deg, #1F4B99 0%, #163B73 100%)",
color: "#FFFFFF",
fontWeight: 950,
fontSize: 16,
cursor: "pointer",
boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
}}
>
Done
</button>

<div
style={{
marginTop: 18,
color: "#64748B",
fontSize: 13,
lineHeight: 1.6,
}}
>
Powered by FixFlow. Card payments processed securely by Stripe.
</div>
</div>
</main>
);
}

export default function ReceiptPage() {
return (
<Suspense fallback={null}>
<ReceiptInner />
</Suspense>
);
}