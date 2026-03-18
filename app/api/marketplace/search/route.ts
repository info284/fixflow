import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ✅ Do NOT throw during build
  if (!url || !key) {
    console.warn("Supabase env vars missing at build time");
    return null;
  }

  return createClient(url, key);
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json({ traders: [] });
    }

    const { searchParams } = new URL(req.url);
    const postcode = searchParams.get("postcode");

    if (!postcode) {
      return NextResponse.json({ traders: [] });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, business_name, slug, trades")
      .ilike("postcode_coverage", `%${postcode}%`);

    if (error) {
      return NextResponse.json({ traders: [] });
    }

    return NextResponse.json({ traders: data ?? [] });

  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Search failed" },
      { status: 500 }
    );
  }
}