// app/api/message-thread/reply/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const requestId = String(body.requestId || "").trim();
    const message = String(body.message || "").trim();

    if (!requestId) {
      return json(400, { ok: false, error: "Missing requestId" });
    }

    if (!message) {
      return json(400, { ok: false, error: "Missing message" });
    }

    const supabase = supabaseAdmin();

    const { data: enquiry, error: enquiryErr } = await supabase
      .from("quote_requests")
      .select(
        "id, plumber_id, customer_name, customer_email, job_type"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (enquiryErr) {
      return json(500, { ok: false, error: enquiryErr.message });
    }

    if (!enquiry) {
      return json(404, { ok: false, error: "Enquiry not found" });
    }

    const customerEmail = String(enquiry.customer_email || "").trim();

    if (!customerEmail || !isEmail(customerEmail)) {
      return json(400, {
        ok: false,
        error: "Customer email missing or invalid",
      });
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

    const { error: insertIncomingError } = await supabase
      .from("enquiry_messages")
      .insert({
        request_id: requestId,
        plumber_id: enquiry.plumber_id,
        direction: "in",
        channel: "message",
        subject: `Re: ${enquiry.job_type || "Enquiry"}`,
        body_text: message,
        from_email: customerEmail,
        to_email: null,
        resend_id: null,
      });

    if (insertIncomingError) {
      return json(500, { ok: false, error: insertIncomingError.message });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM = process.env.RESEND_FROM;

    if (!RESEND_API_KEY) {
      return json(500, { ok: false, error: "Missing RESEND_API_KEY" });
    }

    if (!RESEND_FROM) {
      return json(500, { ok: false, error: "Missing RESEND_FROM" });
    }

    const resend = new Resend(RESEND_API_KEY);

    const traderInboxAddress = `info@thefixflowapp.com`;

    const sendResult = await resend.emails.send({
      from: RESEND_FROM,
      to: traderInboxAddress,
      subject: `${traderName}: new customer reply`,
      text: [
        `You have a new customer reply in FixFlow.`,
        ``,
        `Customer: ${enquiry.customer_name || "Customer"}`,
        `Job: ${enquiry.job_type || "Enquiry"}`,
        `Request ID: ${requestId}`,
        ``,
        `Message:`,
        message,
        ``,
        `Open FixFlow to reply.`,
        `https://thefixflowapp.com/dashboard/enquiries?requestId=${requestId}&tab=all`,
      ].join("\n"),
    } as any);

    // @ts-ignore
    if (sendResult?.error) {
      // message is already saved, so don't lose it
      return json(200, {
        ok: true,
        warning: sendResult.error.message || "Reply saved but email notification failed",
      });
    }

    await supabase
      .from("quote_requests")
      .update({
        status: "customer-replied",
      })
      .eq("id", requestId);

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Server error" });
  }
}