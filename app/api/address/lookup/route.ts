import { NextResponse } from "next/server";

export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
const postcode = searchParams.get("postcode")?.trim();

if (!postcode) {
return NextResponse.json({ error: "Postcode required" }, { status: 400 });
}

const key = process.env.GETADDRESS_API_KEY;
if (!key) {
return NextResponse.json({ error: "GETADDRESS_API_KEY missing" }, { status: 500 });
}

const url = `https://api.getaddress.io/find/${encodeURIComponent(postcode)}?api-key=${key}`;

const res = await fetch(url, { cache: "no-store" });
const text = await res.text();

if (!res.ok) {
return NextResponse.json(
{ error: "Lookup failed", status: res.status, body: text.slice(0, 200) },
{ status: 500 }
);
}

const json = JSON.parse(text);

// getaddress returns addresses as array of comma-separated strings
const addresses: string[] = (json.addresses || []).map((a: string) =>
a.replace(/\s+,/g, ",").replace(/,\s+/g, ", ").trim()
);

return NextResponse.json({ addresses });
}