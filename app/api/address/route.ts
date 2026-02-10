// app/api/address/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json({ error, detail: detail || "" }, { status });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("postcode") || "").trim();

    if (!raw) return jsonError(400, "Missing postcode");

    // GetAddress Autocomplete works best with partial postcode too (e.g. "SW1A", "RH16")
    // We'll just send what the user typed.
    const term = raw.replace(/\s+/g, "");

    const apiKey =
      process.env.GETADDRESS_API_KEY ||
      process.env.NEXT_PUBLIC_GETADDRESS_API_KEY ||
      "";

    console.log("GETADDRESS_API_KEY exists?", !!apiKey);

    if (!apiKey) {
      return jsonError(500, "Address provider error", "Missing API key");
    }

    // ✅ Autocomplete endpoint (this is what your GetAddress docs screenshot shows working)
    const endpoint = `https://api.getaddress.io/autocomplete/${encodeURIComponent(
      term
    )}?api-key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const text = await r.text();

    if (!r.ok) {
      // Return upstream status/text so you can see 401/404/429/etc
      return jsonError(
        500,
        "Address provider error",
        `GetAddress ${r.status}: ${text}`
      );
    }

    const data = JSON.parse(text);

    // GetAddress autocomplete returns: { suggestions: [{ address, id, url? }, ...] }
    const suggestions = Array.isArray(data?.suggestions)
      ? data.suggestions
          .map((s: any) => (typeof s?.address === "string" ? s.address : ""))
          .filter(Boolean)
      : [];

    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (e: any) {
    return jsonError(500, "Address provider error", e?.message || "Unknown error");
  }
}