import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, serviceKey);
}

async function acceptEstimate(id: string) {
  if (!id) {
    throw new Error("Missing estimate id");
  }

  const supabase = supabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("estimates")
    .select("accepted_at, request_id, plumber_id, status")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existing) {
    throw new Error("Estimate not found");
  }

  if (existing.status === "accepted") {
    return {
      ok: true,
      accepted_at: existing.accepted_at,
      alreadyAccepted: true,
    };
  }

  const acceptedAt = existing.accepted_at || new Date().toISOString();

  const { error: estimateError } = await supabase
    .from("estimates")
    .update({
      status: "accepted",
      accepted_at: acceptedAt,
    })
    .eq("id", id);

  if (estimateError) {
    throw new Error(estimateError.message);
  }

  if (existing.request_id) {
    const { error: requestError } = await supabase
      .from("quote_requests")
.update({
  stage: "won",
  status: "won",
})
      .eq("id", existing.request_id);

    if (requestError) {
      throw new Error(requestError.message);
    }

    const { error: messageError } = await supabase
      .from("enquiry_messages")
      .insert({
        request_id: existing.request_id,
        plumber_id: existing.plumber_id,
        direction: "out",
        channel: "status",
        subject: "Estimate accepted",
       body_text: "Customer accepted the estimate. Job is ready to be booked.",
      });

    if (messageError) {
      throw new Error(messageError.message);
    }
  }

  return {
    ok: true,
    accepted_at: acceptedAt,
    alreadyAccepted: false,
  };
}

export async function GET(_: Request, { params }: RouteProps) {
  const { id } = await params;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL || "https://thefixflowapp.com";

  try {
    await acceptEstimate(id);

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
    const result = await acceptEstimate(id);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to accept estimate" },
      { status: 500 }
    );
  }
}