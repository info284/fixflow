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

async function acceptQuickEstimate(id: string) {
  const supabase = getSupabase();
  const acceptedAt = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("quick_estimates")
    .select("accepted_at, request_id, plumber_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error("Estimate not found");

  const finalAcceptedAt = existing.accepted_at || acceptedAt;

  const { error } = await supabase
    .from("quick_estimates")
    .update({
      status: "accepted",
      accepted_at: finalAcceptedAt,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (existing.request_id) {
    const { error: requestError } = await supabase
      .from("quote_requests")
     .update({
  stage: "won",
})
      .eq("id", existing.request_id);

    if (requestError) throw new Error(requestError.message);

    await supabase.from("enquiry_messages").insert({
      request_id: existing.request_id,
      plumber_id: existing.plumber_id,
      direction: "out",
      channel: "status",
      subject: "Quick estimate accepted",
      body_text: "Customer accepted the quick estimate. Job is ready to be booked.",
    });
  }

  return finalAcceptedAt;
}

export async function GET(_: Request, { params }: RouteProps) {
  const { id } = await params;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://thefixflowapp.com";

  try {
    await acceptQuickEstimate(id);

    return NextResponse.redirect(
      `${siteUrl}/estimate/accepted?id=${id}`,
      303
    );
  } catch {
    return NextResponse.redirect(
      `${siteUrl}/estimate/error?id=${id}`,
      303
    );
  }
}

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing estimate id" }, { status: 400 });
    }

    const acceptedAt = await acceptQuickEstimate(id);

    return NextResponse.json({
      ok: true,
      accepted_at: acceptedAt,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to accept quick estimate" },
      { status: 500 }
    );
  }
}