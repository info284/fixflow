// app/api/services/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("services")
      .select("id,name,price")
      .order("name", { ascending: true });

    if (error) {
      console.error("Admin list error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    console.error("API /services/list error:", e);
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
