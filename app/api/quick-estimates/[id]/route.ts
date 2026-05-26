import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request, { params }: RouteProps) {
  const { id } = await params;
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

  const { data: existing, error } = await supabase
    .from("quick_estimates")
    .select("id, view_count, first_viewed_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !existing) {
    return NextResponse.json({ error: "Quick estimate not found" }, { status: 404 });
  }

  await supabase
    .from("quick_estimates")
    .update({
      view_count: Number(existing.view_count || 0) + 1,
      first_viewed_at: existing.first_viewed_at || nowIso,
      last_viewed_at: nowIso,
    })
    .eq("id", id);

  return NextResponse.redirect(
    new URL(`/quick-estimates/${id}`, req.url)
  );
}