"use client";

import { useRouter } from "next/navigation";

export default function PayCancelPage() {
const router = useRouter();

return (
<main
style={{
minHeight: "100vh",
display: "grid",
placeItems: "center",
padding: 24,
background: "#F4F7FB",
fontFamily:
"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}}
>
<div
style={{
width: "100%",
maxWidth: 520,
borderRadius: 30,
background: "#FFFFFF",
border: "1px solid #E0E7F1",
padding: 34,
textAlign: "center",
boxShadow: "0 24px 70px rgba(15, 23, 42, 0.08)",
}}
>
<div
style={{
width: 82,
height: 82,
borderRadius: 26,
background: "#F8FAFD",
display: "grid",
placeItems: "center",
margin: "0 auto 24px",
color: "#163A70",
fontSize: 38,
fontWeight: 950,
border: "1px solid #E0E7F1",
}}
>
×
</div>

<div
style={{
fontSize: 12,
fontWeight: 950,
color: "#667085",
marginBottom: 10,
textTransform: "uppercase",
letterSpacing: "0.12em",
}}
>
Payment cancelled
</div>

<h1
style={{
color: "#0E2F63",
margin: "0 0 14px",
fontSize: 34,
lineHeight: 1.12,
fontWeight: 950,
letterSpacing: "-0.04em",
}}
>
Payment not completed
</h1>

<p
style={{
color: "#667085",
lineHeight: 1.8,
fontSize: 16,
margin: "0 auto 30px",
maxWidth: 420,
}}
>
Your payment was cancelled before completion. No money has been taken.
</p>

<button
type="button"
onClick={() => router.back()}
style={{
height: 56,
padding: "0 34px",
borderRadius: 999,
border: "none",
background: "#163A70",
color: "#FFFFFF",
fontWeight: 950,
fontSize: 16,
cursor: "pointer",
boxShadow: "0 10px 24px rgba(22, 58, 112, 0.16)",
}}
>
Return to payment
</button>

<div
style={{
marginTop: 18,
color: "#667085",
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