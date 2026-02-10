import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
try {
const body = await req.json().catch(() => ({}));

// Accept either UI names OR DB-ish names (so it works either way)
const slug = String(body.slug || body.traderSlug || "").trim();

const customer_name = String(body.customer_name || body.name || "").trim();
const customer_email = String(body.customer_email || body.email || "").trim();
const customer_phone = String(body.customer_phone || body.phone || "").trim() || null;

const postcode = String(body.postcode || "").trim();
const address = String(body.address || "").trim();

const job_type = String(body.job_type || body.jobType || "").trim();
const urgency = String(body.urgency || "").trim();
const details = String(body.details || "").trim();

// Basic validation (the “missing required fields” you’re seeing)
const missing: string[] = [];
if (!slug) missing.push("slug");
if (!customer_name) missing.push("name");
if (!customer_email) missing.push("email");
if (!postcode) missing.push("postcode");
if (!address) missing.push("address");
if (!job_type) missing.push("job_type");
if (!urgency) missing.push("urgency");
if (!details) missing.push("details");

if (missing.length) {
return NextResponse.json(
{ error: `Missing required fields: ${missing.join(", ")}` },
{ status: 400 }
);
}

// 1) Look up trader by slug
// ✅ Change "profiles" to whatever table actually stores your traders
const { data: trader, error: tErr } = await supabaseAdmin
.from("profiles")
.select("id, slug")
.eq("slug", slug)
.maybeSingle();

if (tErr) {
return NextResponse.json({ error: tErr.message }, { status: 400 });
}

if (!trader?.id) {
return NextResponse.json({ error: "Trader not found" }, { status: 404 });
}

// 2) Insert into quote_requests
const { data: inserted, error: iErr } = await supabaseAdmin
.from("quote_requests")
.insert({
plumber_id: trader.id,
customer_name,
customer_email,
customer_phone,
postcode,
address,
job_type,
urgency,
details,
status: "requested",
})
.select("id")
.single();

if (iErr) {
return NextResponse.json({ error: iErr.message }, { status: 400 });
}

return NextResponse.json({ request: inserted }, { status: 200 });
} catch (e: any) {
return NextResponse.json(
{ error: e?.message || "Create request failed" },
{ status: 500 }
);
}
}