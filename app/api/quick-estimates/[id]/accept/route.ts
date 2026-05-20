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

  const acceptedAt = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("quick_estimates")
    .select("accepted_at, request_id, plumber_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const finalAcceptedAt = existing.accepted_at || acceptedAt;

  const { error } = await supabase
    .from("quick_estimates")
    .update({
      status: "accepted",
      accepted_at: finalAcceptedAt,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing.request_id) {
    const { error: requestError } = await supabase
      .from("quote_requests")
      .update({
        stage: "won",
        status: "replied",
      })
      .eq("id", existing.request_id);

    if (requestError) {
      return NextResponse.json({ error: requestError.message }, { status: 500 });
    }

    await supabase.from("enquiry_messages").insert({
      request_id: existing.request_id,
      plumber_id: existing.plumber_id,
      direction: "out",
      channel: "status",
      subject: "Quick estimate accepted",
      body_text: "Customer accepted the quick estimate. Job is ready to be booked.",
    });
  }

  return NextResponse.json({
    ok: true,
    accepted_at: finalAcceptedAt,
  });
}