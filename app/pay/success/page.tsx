"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";

function PaySuccessInner() {
const router = useRouter();

return (
<main
style={{
minHeight: "100vh",
display: "grid",
placeItems: "center",
padding: 20,
background: "#F4F7FB",
fontFamily:
"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}}
>
<div
style={{
width: "min(520px, 100%)",
borderRadius: 32,
background: "#FFFFFF",
border: "1px solid #E2E8F0",
overflow: "hidden",
textAlign: "center",
boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
}}
>
<div
style={{
background: "#0F3267",
padding: "38px 30px",
}}
>
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
Payment successful
</div>

<h1
style={{
color: "#FFFFFF",
margin: 0,
fontSize: 38,
lineHeight: 1.08,
fontWeight: 950,
letterSpacing: "-0.05em",
}}
>
Payment received
</h1>
</div>

<div
style={{
padding: 30,
}}
>
<div
style={{
width: 78,
height: 78,
borderRadius: 24,
background: "#EEF4FF",
display: "grid",
placeItems: "center",
margin: "0 auto 22px",
color: "#163A70",
fontSize: 38,
fontWeight: 950,
border: "1px solid #D9E4F5",
}}
>
✓
</div>

<p
style={{
color: "#667085",
lineHeight: 1.8,
fontSize: 16,
margin: "0 auto 30px",
maxWidth: 390,
}}
>
Thanks, your invoice payment has been completed successfully.
</p>

<button
type="button"
onClick={() => router.push("/")}
style={{
height: 54,
padding: "0 34px",
borderRadius: 999,
border: "none",
background: "#163A70",
color: "#FFFFFF",
fontWeight: 900,
fontSize: 16,
cursor: "pointer",
boxShadow: "0 12px 28px rgba(15, 50, 103, 0.18)",
}}
>
Done
</button>

<div
style={{
marginTop: 20,
color: "#667085",
fontSize: 13,
lineHeight: 1.7,
}}
>
Powered by FixFlow. Card payments securely processed by Stripe.
</div>
</div>
</div>
</main>
);
}

export default function PaySuccessPage() {
return (
<Suspense fallback={null}>
<PaySuccessInner />
</Suspense>
);
}