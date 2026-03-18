import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "quote-files";

export async function POST(req: Request) {
try {
const form = await req.formData();

const requestId = String(form.get("requestId") || "").trim();
const kind = String(form.get("kind") || "trader").trim(); // "trader" only really
const path = String(form.get("path") || "").trim();

if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
if (kind !== "trader") return NextResponse.json({ error: "Only trader delete allowed" }, { status: 400 });

// Safety: only allow deleting inside quote/<requestId>/trader/
const allowedPrefix = `quote/${requestId}/trader/`;
if (!path.startsWith(allowedPrefix)) {
return NextResponse.json({ error: "Invalid path" }, { status: 400 });
}

const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
if (error) return NextResponse.json({ error: error.message }, { status: 400 });

return NextResponse.json({ ok: true }, { status: 200 });
} catch (e: any) {
return NextResponse.json({ error: e?.message || "Delete failed" }, { status: 500 });
}
}