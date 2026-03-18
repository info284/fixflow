// app/api/traders/search/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const trade = (searchParams.get("trade") || "").trim().toLowerCase();
    const area = (searchParams.get("area") || "").trim().toLowerCase();
    const minRating = Number(searchParams.get("minRating") || 0);

    let query = supabase
      .from("tradespeople")
      .select("id, business_name, trade, bio, phone, email, cover_area, hourly_rate, min_callout_fee, rating, reviews_count")
      .gte("rating", minRating);

    if (trade) query = query.ilike("trade", `%${trade}%`);
    if (area)  query = query.ilike("cover_area", `%${area}%`);
    if (q) {
      // broad text search
      query = query.or([
        `business_name.ilike.%${q}%`,
        `bio.ilike.%${q}%`,
        `trade.ilike.%${q}%`,
        `cover_area.ilike.%${q}%`
      ].join(","));
    }

    const { data, error } = await query.order("rating", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
