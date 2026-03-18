// app/api/quotes/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Returns quote requests and merges service name/price without relying on DB relationships
export async function GET() {
  try {
    // 1) fetch quotes
    const { data: quotes, error: qErr } = await supabaseAdmin
      .from("quote_requests")
      .select("id, service_id, customer_name, customer_email, details, status, created_at")
      .order("created_at", { ascending: false });

    if (qErr) {
      console.error("quotes list error:", qErr);
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    // 2) fetch services for the referenced IDs
    const ids = Array.from(new Set((quotes ?? []).map(r => r.service_id).filter(Boolean)));
    let servicesById: Record<string, { id: string; name: string; price: number }> = {};

    if (ids.length > 0) {
      const { data: services, error: sErr } = await supabaseAdmin
        .from("services")
        .select("id, name, price")
        .in("id", ids);

      if (sErr) {
        console.error("services fetch error:", sErr);
        return NextResponse.json({ error: sErr.message }, { status: 500 });
      }

      for (const s of services ?? []) {
        servicesById[String(s.id)] = s as any;
      }
    }

    // 3) merge and return
    const merged = (quotes ?? []).map(r => ({
      ...r,
      services: servicesById[String(r.service_id)] ?? null,
    }));

    return NextResponse.json({ data: merged }, { status: 200 });
  } catch (e: any) {
    console.error("API /quotes/list fatal:", e);
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
