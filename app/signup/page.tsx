"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
* Turns "Smith Plumbing & Heating" -> "smith-plumbing-and-heating"
*/
function slugify(input: string) {
return input
.toLowerCase()
.trim()
.replace(/&/g, "and")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "");
}

/**
* Finds an available slug by checking the profiles table.
* If taken, tries: slug-2, slug-3, ... slug-10
*/
async function findAvailableSlug(base: string) {
const cleanBase = slugify(base);
if (!cleanBase) return null;

// Try the base slug first
for (let i = 1; i <= 10; i++) {
const candidate = i === 1 ? cleanBase : `${cleanBase}-${i}`;

const { data, error } = await supabase
.from("profiles")
.select("id")
.eq("slug", candidate)
.maybeSingle();

// If no record found, candidate is available
if (!error && !data) return candidate;
}

// Fallback if somehow everything is taken
const rand = Math.floor(1000 + Math.random() * 9000);
return `${cleanBase}-${rand}`;
}

export default function SignupPage() {
const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [businessName, setBusinessName] = useState("");

const [loading, setLoading] = useState(false);
const [errorMsg, setErrorMsg] = useState<string | null>(null);

async function handleSignup(e: React.FormEvent) {
e.preventDefault();
setErrorMsg(null);
setLoading(true);

try {
if (!email || !password || !businessName) {
setErrorMsg("Please fill in email, password, and business name.");
return;
}

// 1) Create auth user
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
email,
password,
});

if (signUpError) throw signUpError;

const userId = signUpData.user?.id;
if (!userId) {
setErrorMsg("Signup succeeded but user ID was missing. Please try again.");
return;
}

// 2) Create a unique slug for their branded link
const slug = await findAvailableSlug(businessName);
if (!slug) {
setErrorMsg("Could not create a branded link. Please use a different business name.");
return;
}

// 3) Save to profiles table
// IMPORTANT: profiles.id should match auth.users.id (uuid)
const { error: profileError } = await supabase
.from("profiles")
.upsert(
{
id: userId,
business_name: businessName,
slug,
},
{ onConflict: "id" }
);

if (profileError) throw profileError;

const publicUrl = `https://thefixflowapp.com/${slug}`;

try {
  await fetch("/api/onboarding/send-welcome", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      publicUrl,
    }),
  });
} catch (emailErr) {
  console.warn("Welcome email failed:", emailErr);
}

// 4) Go to dashboard
router.push("/dashboard");
} catch (err: any) {
setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
} finally {
setLoading(false);
}
}

return (
<div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
<h1 style={{ fontSize: 28, marginBottom: 6 }}>Create your FixFlow account</h1>
<p style={{ color: "#64748B", marginBottom: 20 }}>
We’ll set up your branded link automatically so customers can request a quote without calling.
</p>

<form onSubmit={handleSignup} style={{ display: "grid", gap: 12 }}>
<label style={{ display: "grid", gap: 6 }}>
<span>Email</span>
<input
value={email}
onChange={(e) => setEmail(e.target.value)}
type="email"
placeholder="you@email.com"
autoComplete="email"
required
style={{
padding: 12,
borderRadius: 10,
border: "1px solid #E5E7EB",
}}
/>
</label>

<label style={{ display: "grid", gap: 6 }}>
<span>Password</span>
<input
value={password}
onChange={(e) => setPassword(e.target.value)}
type="password"
placeholder="••••••••"
autoComplete="new-password"
required
style={{
padding: 12,
borderRadius: 10,
border: "1px solid #E5E7EB",
}}
/>
</label>

<label style={{ display: "grid", gap: 6 }}>
<span>Business name</span>
<input
value={businessName}
onChange={(e) => setBusinessName(e.target.value)}
type="text"
placeholder="Smith Plumbing"
required
style={{
padding: 12,
borderRadius: 10,
border: "1px solid #E5E7EB",
}}
/>
<small style={{ color: "#64748B" }}>
Your link will look like: <b>thefixflowapp.com/{slugify(businessName || "your-business")}</b>
</small>
</label>

{errorMsg && (
<div
style={{
background: "#FEF2F2",
border: "1px solid #FECACA",
padding: 12,
borderRadius: 10,
color: "#991B1B",
}}
>
{errorMsg}
</div>
)}

<button
type="submit"
disabled={loading}
style={{
padding: "12px 14px",
borderRadius: 12,
background: "#1F6FFF",
color: "#FFFFFF",
border: "none",
cursor: loading ? "not-allowed" : "pointer",
fontWeight: 600,
marginTop: 6,
}}
>
{loading ? "Creating account…" : "Create account"}
</button>
</form>

<p style={{ color: "#64748B", marginTop: 16, fontSize: 13 }}>
By continuing, you agree to our Terms and Privacy Policy.
</p>
</div>
);
}
