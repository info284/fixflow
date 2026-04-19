// app/api/message-thread/[id]/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE!;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestId = String(id || "").trim();

    if (!requestId) {
      return json(400, { error: "Missing request id" });
    }

    const supabase = supabaseAdmin();

    const { data: enquiry, error: enquiryErr } = await supabase
      .from("quote_requests")
      .select("id, customer_name, customer_email, job_type, plumber_id")
      .eq("id", requestId)
      .maybeSingle();

    if (enquiryErr) {
      return json(500, { error: enquiryErr.message });
    }

    if (!enquiry) {
      return json(404, { error: "Enquiry not found" });
    }

    const { data: trader } = await supabase
      .from("profiles")
      .select("display_name, business_name")
      .eq("id", enquiry.plumber_id)
      .maybeSingle();

    const traderName =
      trader?.business_name ||
      trader?.display_name ||
      "Your trader";

    const { data: messages, error: msgErr } = await supabase
      .from("enquiry_messages")
      .select("id, direction, body_text, subject, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      return json(500, { error: msgErr.message });
    }

    return json(200, {
      requestId,
      customerName: enquiry.customer_name,
      customerEmail: enquiry.customer_email,
      traderName,
      jobType: enquiry.job_type,
      messages: messages || [],
    });
  } catch (e: any) {
    return json(500, { error: e?.message || "Server error" });
  }
}