import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "quote-files";
const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;

export async function POST(req: Request) {
try {
const form = await req.formData();

const requestId = String(form.get("requestId") || "").trim();
const kind = String(form.get("kind") || "customer").trim(); // customer | trader
const files = form.getAll("files") as File[];

// 🔎 debug: prove what the server received
if (!requestId) {
return NextResponse.json(
{ error: "Missing requestId", got: { requestId, kind, filesCount: files?.length || 0 } },
{ status: 400 }
);
}

if (!files || files.length === 0) {
return NextResponse.json(
{ error: "No files uploaded", got: { requestId, kind, filesCount: 0 } },
{ status: 400 }
);
}

const supabaseAdmin = createAdminClient();
const baseFolder = kind === "trader" ? traderFolder(requestId) : customerFolder(requestId);

const uploaded: string[] = [];

for (const file of files) {
const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);

const safeName = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
const filePath = `${baseFolder}/${Date.now()}_${safeName}`;

const { error: upErr } = await supabaseAdmin.storage
.from(BUCKET)
.upload(filePath, buffer, {
contentType: file.type || "application/octet-stream",
upsert: false,
});

if (upErr) {
return NextResponse.json({ error: upErr.message }, { status: 400 });
}

uploaded.push(filePath);
}

return NextResponse.json({ ok: true, requestId, kind, uploaded }, { status: 200 });
} catch (e: any) {
return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 });
}
}