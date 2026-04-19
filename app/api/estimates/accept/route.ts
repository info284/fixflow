import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const estimateId = String(body?.estimateId || "").trim();

    if (!estimateId) {
      return NextResponse.json(
        { error: "Missing estimateId" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 🔍 Get estimate
    const { data: existing, error: existingError } = await supabase
      .from("estimates")
      .select("id, accepted_at, request_id, plumber_id")
      .eq("id", estimateId)
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

    // ✅ Update estimate
    const { error: estimateError } = await supabase
      .from("estimates")
      .update({
        status: "accepted",
        accepted_at: acceptedAt,
      })
      .eq("id", estimateId);

    if (estimateError) {
      return NextResponse.json(
        { error: estimateError.message },
        { status: 500 }
      );
    }

    // ✅ Update enquiry
    if (existing.request_id) {
      const { error: requestError } = await supabase
        .from("quote_requests")
        .update({
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

      // 🧾 Log system message
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
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to accept estimate" },
      { status: 500 }
    );
  }
}