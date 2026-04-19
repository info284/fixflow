import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing estimate id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: estimate, error: loadError } = await supabase
      .from("estimates")
      .select("id, view_count, first_viewed_at, last_viewed_at")
      .eq("id", id)
      .single();

    if (loadError || !estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const nextViewCount = Number(estimate.view_count || 0) + 1;

    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        view_count: nextViewCount,
        first_viewed_at: estimate.first_viewed_at || now,
        last_viewed_at: now,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      view_count: nextViewCount,
      first_viewed_at: estimate.first_viewed_at || now,
      last_viewed_at: now,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to track view" },
      { status: 500 }
    );
  }
}