export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
{ auth: { persistSession: false } }
);
}

function normalizeOutward(input: string) {
const trimmed = (input || "").trim().toUpperCase();
const outward = trimmed.split(/\s+/)[0] || "";
return outward.replace(/[^A-Z0-9]/g, "");
}

export async function POST(req: Request) {
const sb = supabase();

const body = await req.json().catch(() => null);
const userId = (body?.userId as string | undefined) || "";
const postcode = (body?.postcode as string | undefined) || "";

if (!userId) {
return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
}
if (!postcode) {
return NextResponse.json({ ok: false, error: "Missing postcode" }, { status: 400 });
}

const outward = normalizeOutward(postcode);
if (!outward) {
return NextResponse.json({ ok: false, error: "Invalid postcode" }, { status: 400 });
}

const { data: rows, error } = await sb
.from("trade_locations")
.select("id, postcode_prefix, label")
.eq("user_id", userId);

if (error) {
return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
}

const normalizedRows = (rows || []).map((r: any) => {
const raw = String(r.postcode_prefix || "");
return {
id: r.id,
postcode_prefix: r.postcode_prefix ?? null,
label: r.label ?? null,
norm: normalizeOutward(raw),
};
});

const match = normalizedRows.find((r: any) => r.norm === outward) || null;

return NextResponse.json({
ok: true,
outward,
covers: !!match,
matchedValue: match?.postcode_prefix ?? null,
label: match?.label ?? null,
totalRows: normalizedRows.length,
debug: {
outward,
normalizedRows,
},
});
}