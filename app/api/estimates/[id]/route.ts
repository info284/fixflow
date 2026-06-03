import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: RouteProps) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing estimate id" }, { status: 400 });
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

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select(`
      id,
      total,
      status,
      request_id,
      view_count,
      first_viewed_at,
      last_viewed_at,
      accepted_at
    `)
    .eq("id", id)
    .single();

  if (error || !estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

const { data: enquiry } = await supabase
  .from("quote_requests")
  .select("customer_name, job_type, plumber_id")
  .eq("id", estimate.request_id)
  .maybeSingle();

const { data: profile } = enquiry?.plumber_id
  ? await supabase
      .from("profiles")
      .select("display_name, business_name, notify_email, phone, logo_url")
      .eq("id", enquiry.plumber_id)
      .maybeSingle()
  : { data: null };

  return NextResponse.json({
    estimate: {
      id: estimate.id,
      total: estimate.total,
      status: estimate.status,
      request_id: estimate.request_id,
      customer_name: enquiry?.customer_name || null,
      job_type: enquiry?.job_type || null,
      view_count: estimate.view_count || 0,
      first_viewed_at: estimate.first_viewed_at || null,
      last_viewed_at: estimate.last_viewed_at || null,
      accepted_at: estimate.accepted_at || null,
      trader_name: profile?.display_name || null,
business_name: profile?.business_name || null,
trader_email: profile?.notify_email || null,
trader_phone: profile?.phone || null,
logo_url: profile?.logo_url || null,
    },
  });
}