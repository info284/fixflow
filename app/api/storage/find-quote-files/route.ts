import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
const enqId = searchParams.get("enqId") || "";

if (!enqId) return NextResponse.json({ error: "Missing enqId" }, { status: 400 });

const bucket = supabaseAdmin.storage.from("quote-files");

const prefixes = [
`quote/${enqId}`,
`quote/${enqId}/customer`,
`quote/${enqId}/trader`,
`request/${enqId}`,
`requests/${enqId}`,
];

const found: { name: string; path: string }[] = [];
const seen = new Set<string>();

for (const prefix of prefixes) {
const { data, error } = await bucket.list(prefix, { limit: 100 });
if (error || !data) continue;

for (const f of data) {
if (!f?.name || f.name === ".emptyFolderPlaceholder") continue;
const full = `${prefix}/${f.name}`;
if (seen.has(full)) continue;
seen.add(full);
found.push({ name: f.name, path: full });
}
}

const files = await Promise.all(
found.map(async (f) => {
const { data } = await bucket.createSignedUrl(f.path, 60 * 60);
return { ...f, url: data?.signedUrl ?? null };
})
);

return NextResponse.json({ files });
}