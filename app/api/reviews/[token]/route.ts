import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);
}

export async function GET(
_req: Request,
{ params }: { params: Promise<{ token: string }> }
) {
try {
const { token } = await params;

const supabase = supabaseAdmin();

const { data: job, error } = await supabase
  .from("quote_requests")
  .select(`
    id,
    plumber_id,
    customer_name,
    customer_email,
    job_type,
    review_token
  `)
  .eq("review_token", token)
  .maybeSingle();

if (error || !job) {
return NextResponse.json(
{ error: "Review link not found" },
{ status: 404 }
);
}
const { data: profile } = await supabase
  .from("profiles")
  .select("business_name, display_name")
  .eq("id", job.plumber_id)
  .maybeSingle();

const { data: existingReviews } = await supabase
  .from("reviews")
  .select("id")
  .eq("request_id", job.id);

return NextResponse.json({
review: {
id: job.id,
trader_id: job.plumber_id,
request_id: job.id,
customer_name: job.customer_name,
customer_email: job.customer_email,
job_type: job.job_type,
profiles: profile,
alreadySubmitted: Boolean(existingReviews?.length),
},
});
} catch (e: any) {
return NextResponse.json(
{ error: e?.message || "Couldn’t load review" },
{ status: 500 }
);
}
}

export async function PATCH(
req: Request,
{ params }: { params: Promise<{ token: string }> }
) {
try {
const { token } = await params;
const { rating, comment } = await req.json();

const safeRating = Number(rating);

if (!Number.isFinite(safeRating) || safeRating < 1 || safeRating > 5) {
return NextResponse.json(
{ error: "Rating must be between 1 and 5" },
{ status: 400 }
);
}

const supabase = supabaseAdmin();

const { data: job, error: jobError } = await supabase
.from("quote_requests")
.select("id, plumber_id, customer_name, customer_email, job_type")
.eq("review_token", token)
.maybeSingle();

if (jobError || !job) {
return NextResponse.json(
{ error: "Review link not found" },
{ status: 404 }
);
}

const { data: existingReview } = await supabase
.from("reviews")
.select("id")
.eq("request_id", job.id)
.maybeSingle();

if (existingReview) {
return NextResponse.json(
{ error: "This review has already been submitted" },
{ status: 409 }
);
}

const { error: insertError } = await supabase.from("reviews").insert({
trader_id: job.plumber_id,
request_id: job.id,
customer_name: job.customer_name,
customer_email: job.customer_email,
rating: safeRating,
comment: String(comment || "").trim() || null,
status: "published",
verified: true,
});

if (insertError) {
return NextResponse.json({ error: insertError.message }, { status: 500 });
}

await supabase
.from("quote_requests")
.update({
review_received_at: new Date().toISOString(),
})
.eq("id", job.id);

return NextResponse.json({ ok: true });
} catch (e: any) {
return NextResponse.json(
{ error: e?.message || "Couldn’t submit review" },
{ status: 500 }
);
}
}