// app/api/quotes/create/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { service_id, customer_name, customer_email, details } = await req.json();

    if (!service_id) {
      return NextResponse.json({ error: "service_id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("quote_requests")
      .insert([{ service_id, customer_name, customer_email, details }])
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
