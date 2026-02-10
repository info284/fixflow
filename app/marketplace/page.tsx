"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type CoverageStatus = "idle" | "checking" | "yes" | "no";

export default function MarketplacePage() {
const searchParams = useSearchParams();

// Expect the link to look like: /marketplace?tradeId=UUID
const tradeId = useMemo(() => searchParams.get("tradeId") ?? "", [searchParams]);

const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [postcode, setPostcode] = useState("");
const [phone, setPhone] = useState("");
const [when, setWhen] = useState("");

const [coverageStatus, setCoverageStatus] = useState<CoverageStatus>("idle");
const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
const [submitError, setSubmitError] = useState<string>("");

const canContinue = coverageStatus === "yes";

async function checkCoverage() {
if (!tradeId) {
setCoverageStatus("no");
return;
}

const pc = postcode.trim();
if (!pc) {
setCoverageStatus("idle");
return;
}

setCoverageStatus("checking");

try {
const res = await fetch(
`/api/marketplace/search?tradeId=${encodeURIComponent(tradeId)}&postcode=${encodeURIComponent(pc)}`
);

if (!res.ok) {
setCoverageStatus("no");
return;
}

const json = (await res.json()) as { covered?: boolean };
setCoverageStatus(json.covered ? "yes" : "no");
} catch (e) {
setCoverageStatus("no");
}
}

async function submitEnquiry() {
setSubmitStatus("saving");
setSubmitError("");

try {
const res = await fetch("/api/marketplace", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
tradeId,
name,
email,
postcode,
phone,
when,
}),
});

const json = await res.json().catch(() => ({}));

if (!res.ok) {
setSubmitStatus("error");
setSubmitError(json?.error || "Something went wrong saving your request.");
return;
}

setSubmitStatus("saved");
} catch (e) {
setSubmitStatus("error");
setSubmitError("Network error. Please try again.");
}
}

return (
<main className="mx-auto max-w-md p-6">
<h1 className="text-xl font-semibold">Request a quote</h1>

{!tradeId && (
<p className="mt-2 text-sm">
⚠️ Missing tradeId in the link. Use: <span className="font-mono">/marketplace?tradeId=...</span>
</p>
)}

<div className="mt-6 space-y-4">
{/* NAME */}
<div className="space-y-1">
<label className="text-sm font-medium">Name</label>
<input
className="w-full rounded-md border px-3 py-2"
value={name}
onChange={(e) => setName(e.target.value)}
placeholder="Your name"
/>
</div>

{/* EMAIL */}
<div className="space-y-1">
<label className="text-sm font-medium">Email</label>
<input
type="email"
className="w-full rounded-md border px-3 py-2"
value={email}
onChange={(e) => setEmail(e.target.value)}
placeholder="you@example.com"
/>
</div>

{/* POSTCODE */}
<div className="space-y-1">
<label className="text-sm font-medium">Postcode</label>
<input
className="w-full rounded-md border px-3 py-2"
value={postcode}
onChange={(e) => {
setPostcode(e.target.value);
setCoverageStatus("idle");
}}
onBlur={checkCoverage}
placeholder="e.g. RH16 1AA"
/>

{coverageStatus === "checking" && <p className="text-sm">Checking…</p>}
{coverageStatus === "yes" && (
<p className="text-sm">✅ The trader works in this postcode</p>
)}
{coverageStatus === "no" && postcode.trim() && tradeId && (
<p className="text-sm">❌ This trader doesn’t cover this area</p>
)}
</div>

{/* PHONE (locked until coverage yes) */}
<div className="space-y-1">
<label className="text-sm font-medium">Phone number</label>
<input
className="w-full rounded-md border px-3 py-2"
value={phone}
onChange={(e) => setPhone(e.target.value)}
placeholder="07..."
disabled={!canContinue}
/>
{!canContinue && (
<p className="text-xs opacity-70">Enter a postcode first to unlock this.</p>
)}
</div>

{/* WHEN (locked until coverage yes) */}
<div className="space-y-1">
<label className="text-sm font-medium">When do you need the job doing?</label>
<select
className="w-full rounded-md border px-3 py-2"
value={when}
onChange={(e) => setWhen(e.target.value)}
disabled={!canContinue}
>
<option value="">Select…</option>
<option value="asap">ASAP</option>
<option value="this_week">This week</option>
<option value="next_week">Next week</option>
<option value="flexible">Flexible</option>
</select>
</div>

{/* SUBMIT */}
<button
className="w-full rounded-md border px-3 py-2 disabled:opacity-50"
disabled={
!tradeId ||
!canContinue ||
!name.trim() ||
!email.trim() ||
submitStatus === "saving"
}
onClick={submitEnquiry}
>
{submitStatus === "saving" ? "Sending…" : "Continue"}
</button>

{submitStatus === "saved" && (
<p className="text-sm">✅ Sent! The trader will contact you soon.</p>
)}

{submitStatus === "error" && (
<p className="text-sm">❌ {submitError || "Something went wrong."}</p>
)}
</div>
</main>
);
}