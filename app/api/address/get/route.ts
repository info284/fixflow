export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const postcode = (url.searchParams.get("postcode") || "").trim();
    const id = (url.searchParams.get("id") || "").trim();

    if (!postcode || !id) {
      return NextResponse.json({ error: "Missing postcode or id" }, { status: 400 });
    }

    const apiKey =
      process.env.GETADDRESS_API_KEY ||
      process.env.NEXT_PUBLIC_GETADDRESS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Address provider error", detail: "Missing API key" },
        { status: 500 }
      );
    }

    // ✅ GetAddress "get" endpoint
    const endpoint = `https://api.getaddress.io/get/${encodeURIComponent(
      id
    )}?api-key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const text = await r.text();

    if (!r.ok) {
      return NextResponse.json(
        { error: "Address provider error", detail: `GetAddress ${r.status}: ${text}` },
        { status: 500 }
      );
    }

    const data = JSON.parse(text);

    // You can return the whole object or build your own formatted string
    const formatted =
      data?.formatted_address?.join(", ") ||
      [data?.line_1, data?.line_2, data?.town_or_city, data?.postcode]
        .filter(Boolean)
        .join(", ");

    return NextResponse.json({ address: data, formatted }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Address provider error", detail: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}