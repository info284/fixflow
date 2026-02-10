import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
try {
const body = await req.json();

const {
trader_slug,
customer_name,
customer_email,
customer_phone,
postcode,
selected_address,
job_type,
urgency,
details,
} = body || {};

if (!trader_slug || !customer_name || !customer_email || !postcode || !selected_address || !job_type || !urgency || !details) {
return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
}

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY! // server only
);

const { data, error } = await supabase
.from("enquiries")
.insert([
{
trader_slug,
customer_name,
customer_email,
customer_phone: customer_phone || null,
postcode,
selected_address,
job_type,
urgency,
details,
},
])
.select("id")
.single();

if (error) {
return NextResponse.json({ error: "Insert failed", debug: error.message }, { status: 500 });
}

return NextResponse.json({ ok: true, id: data.id });
} catch (e: any) {
return NextResponse.json({ error: "Server error", debug: e?.message }, { status: 500 });
}
}