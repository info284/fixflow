import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { token, rating, comment } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Missing review token" }, { status: 400 });
    }

    const ratingNumber = Number(rating);

    if (!Number.isFinite(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: job, error: jobError } = await supabaseAdmin
      .from("quote_requests")
      .select("id, plumber_id, customer_name, customer_email, review_received_at")
      .eq("review_token", token)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json({ error: "Review link not found" }, { status: 404 });
    }

    if (job.review_received_at) {
      return NextResponse.json({ error: "Review already submitted" }, { status: 409 });
    }

    const { error: reviewError } = await supabaseAdmin
      .from("job_reviews")
      .insert({
        request_id: job.id,
        plumber_id: job.plumber_id,
        customer_name: job.customer_name,
        customer_email: job.customer_email,
        rating: ratingNumber,
        comment: String(comment || "").trim() || null,
      });

    if (reviewError) {
      return NextResponse.json({ error: reviewError.message }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("quote_requests")
      .update({ review_received_at: new Date().toISOString() })
      .eq("id", job.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Couldn’t save review" },
      { status: 500 }
    );
  }
}