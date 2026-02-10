// app/api/quotes/update-status/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();
    const allowed = ["requested", "accepted", "declined", "completed"];
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: `status must be one of ${allowed.join(", ")}` }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("quote_requests")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
