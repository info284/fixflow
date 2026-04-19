import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing estimate id" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing, error: existingError } = await supabase
    .from("estimates")
    .select("accepted_at, request_id, plumber_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Estimate not found" },
      { status: 404 }
    );
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
    return NextResponse.json(
      { error: estimateError.message },
      { status: 500 }
    );
  }

  if (existing.request_id) {
    const { error: requestError } = await supabase
      .from("quote_requests")
      .update({
        read_at: null,
        stage: "won",
        status: "booked",
        job_booked_at: acceptedAt,
      })
      .eq("id", existing.request_id);

    if (requestError) {
      return NextResponse.json(
        { error: requestError.message },
        { status: 500 }
      );
    }

    const { error: quoteError } = await supabase
      .from("quotes")
      .update({
        status: "booked",
      })
      .eq("request_id", existing.request_id);

    if (quoteError) {
      return NextResponse.json(
        { error: quoteError.message },
        { status: 500 }
      );
    }

    const { error: messageError } = await supabase
      .from("enquiry_messages")
      .insert({
        request_id: existing.request_id,
        plumber_id: existing.plumber_id,
        direction: "system",
        channel: "status",
        subject: "Estimate accepted",
        body_text: "Customer accepted the estimate. Job is now booked.",
      });

    if (messageError) {
      return NextResponse.json(
        { error: messageError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    accepted_at: acceptedAt,
  });
}