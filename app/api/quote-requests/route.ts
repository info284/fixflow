import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function asNullableString(value: unknown) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const slug = asString(body.slug || body.traderSlug);

    const customer_name = asString(body.customer_name || body.name);
    const customer_email = asString(body.customer_email || body.email);
    const customer_phone = asNullableString(body.customer_phone || body.phone);

    const postcode = asString(body.postcode);
    const address = asString(body.address);

    const job_type = asString(body.job_type || body.jobType);
    const urgency = asString(body.urgency);
    const details = asString(body.details);

    const budget = asNullableString(body.budget);
    const parking = asNullableString(body.parking);
    const property_type = asNullableString(body.property_type || body.propertyType);
    const problem_location = asNullableString(body.problem_location || body.problemLocation);
    const is_still_working = asNullableString(body.is_still_working || body.isStillWorking);
    const has_happened_before = asNullableString(body.has_happened_before || body.hasHappenedBefore);

    const missing: string[] = [];
    if (!slug) missing.push("slug");
    if (!customer_name) missing.push("name");
    if (!customer_email) missing.push("email");
    if (!postcode) missing.push("postcode");
    if (!address) missing.push("address");
    if (!job_type) missing.push("job_type");
    if (!urgency) missing.push("urgency");
    if (!details) missing.push("details");

    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const { data: trader, error: traderError } = await supabaseAdmin
      .from("profiles")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (traderError) {
      return NextResponse.json(
        { error: traderError.message },
        { status: 400 }
      );
    }

    if (!trader?.id) {
      return NextResponse.json(
        { error: "Trader not found" },
        { status: 404 }
      );
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("quote_requests")
      .insert({
        plumber_id: trader.id,
        customer_name,
        customer_email,
        customer_phone,
        postcode,
        address,
        job_type,
        urgency,
        details,
        budget,
        parking,
        property_type,
        problem_location,
        is_still_working,
        has_happened_before,
        status: "requested",
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ request: inserted }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Create request failed" },
      { status: 500 }
    );
  }
}