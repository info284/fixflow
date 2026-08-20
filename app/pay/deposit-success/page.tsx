"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function DepositSuccessContent() {
const searchParams = useSearchParams();

const estimateId = searchParams.get("estimateId");
const estimateType = searchParams.get("estimateType");

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
boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
}}
>
<div
style={{
background: "#0B2A55",
padding: "34px 30px",
textAlign: "center",
}}
>
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
Deposit paid ✓
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
Your payment has been completed successfully.
</div>
</div>

<div style={{ padding: 30 }}>
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
Your deposit has been confirmed.
</div>

<div
style={{
fontSize: 15,
lineHeight: 1.7,
color: "#5F708A",
textAlign: "center",
}}
>
Your tradesperson can now confirm the booking and next steps with you.
</div>

{estimateId ? (
<div
style={{
marginTop: 18,
fontSize: 12,
color: "#94A3B8",
textAlign: "center",
}}
>
Reference: {estimateId.slice(0, 8)}
{estimateType ? ` · ${estimateType}` : ""}
</div>
) : null}

<div
style={{
marginTop: 22,
textAlign: "center",
color: "#94A3B8",
fontSize: 12,
}}
>
Powered by FixFlow · Card payment processed securely by Stripe
</div>
</div>
</div>
</main>
);
}

export default function DepositSuccessPage() {
return (
<Suspense fallback={<div>Loading…</div>}>
<DepositSuccessContent />
</Suspense>
);
}