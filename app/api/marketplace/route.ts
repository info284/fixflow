import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isUUID(v: string) {
return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
try {
const body = await req.json();

const tradeId = String(body.tradeId || "").trim(); // this should be trader user_id (uuid)
const slug = String(body.slug || "").trim();

const name = String(body.name || "").trim();
const email = String(body.email || "").trim();
const phone = String(body.phone || "").trim();
const postcode = String(body.postcode || "").trim();

const jobType = String(body.jobType || "").trim();
const when = String(body.when || "").trim();
const details = String(body.details || "").trim();

const photo_names = Array.isArray(body.photo_names) ? body.photo_names : [];

if (!tradeId || !isUUID(tradeId)) {
return NextResponse.json(
{ error: "Invalid tradeId (must be trader user_id uuid)" },
{ status: 400 }
);
}

if (!name || !email || !postcode) {
return NextResponse.json(
{ error: "Missing required fields (name, email, postcode)" },
{ status: 400 }
);
}

// ✅ Most common table name in your DB appears to be "requests"
// We'll insert into requests first, and if that fails, try quote_requests.
const row = {
// trader linkage
trade_id: tradeId, // if your table uses trade_id as trader user_id
user_id: tradeId, // if your table uses user_id instead
slug,

// customer
name,
email,
phone,
postcode,

// job
job_type: jobType,
when_needed: when,
details,

// attachments (filenames for now)
photo_names,

// store raw data as backup if you have a json/meta column
payload: body,
};

// Try "requests"
let inserted: any = null;

{
const { data, error } = await supabase
.from("requests")
.insert([row])
.select("*")
.maybeSingle();

if (!error) inserted = data;
}

// Fallback to "quote_requests" if "requests" insert failed
if (!inserted) {
const { data, error } = await supabase
.from("quote_requests")
.insert([row])
.select("*")
.maybeSingle();

if (error) {
// Return the actual DB error so we can map column names correctly
return NextResponse.json(
{ error: "Insert failed", details: error.message },
{ status: 500 }
);
}

inserted = data;
}

// Optional: trigger your notification endpoint (if you have it)
// We won't fail the request if notifications fail.
try {
await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/notifications/new-quote`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ request: inserted }),
});
} catch {}

return NextResponse.json({ ok: true, request: inserted });
} catch (e: any) {
return NextResponse.json(
{ error: "Bad request", details: e?.message || "Unknown error" },
{ status: 400 }
);
}
}

// Nice to have: quick health check
export async function GET() {
return NextResponse.json({ ok: true });
}