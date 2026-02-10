import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "quote-files";

export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
const requestId = searchParams.get("requestId");

if (!requestId) {
return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
}

const folder = `request/${requestId}/customer`;

const { data, error } = await supabaseAdmin.storage
.from(BUCKET)
.list(folder, { limit: 100 });

if (error) {
return NextResponse.json({ error: error.message }, { status: 500 });
}

const files = (data || [])
.filter((x) => x.name)
.map((x) => {
const path = `${folder}/${x.name}`;
const publicUrl =
supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

return { name: x.name, path, publicUrl };
});

return NextResponse.json({ files });
}