import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing estimate id" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1️⃣ Get existing data (so we don’t overwrite first accepted time)
  const { data: existing } = await supabase
    .from("quick_estimates")
    .select("accepted_at")
    .eq("id", id)
    .maybeSingle();

  // 2️⃣ Update estimate
  const { error } = await supabase
    .from("quick_estimates")
    .update({
      status: "accepted",
      accepted_at: existing?.accepted_at || new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accepted_at: existing?.accepted_at || new Date().toISOString(),
  });
}