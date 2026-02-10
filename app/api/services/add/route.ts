// app/api/services/add/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { name, price } = await req.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
    }

    // Call the SECURITY DEFINER function (bypasses RLS)
    const { error } = await supabaseAdmin.rpc("add_service", {
      _name: name,
      _price: numericPrice,
    });

    if (error) {
      console.error("RPC add_service error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("API /services/add fatal:", e);
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
