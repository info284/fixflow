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

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function isEmail(value?: string | null) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const requestId = String(body.requestId || "").trim();
    const message = String(body.message || "").trim();
    const customerEmailFromBody = String(body.customerEmail || "").trim();

    if (!requestId) {
      return json(400, { ok: false, error: "Missing requestId" });
    }

    if (!message) {
      return json(400, { ok: false, error: "Missing message" });
    }

    const supabase = supabaseAdmin();

    const { data: enquiry, error: enquiryErr } = await supabase
      .from("quote_requests")
      .select("id, plumber_id, customer_name, customer_email, job_type")
      .eq("id", requestId)
      .maybeSingle();

    if (enquiryErr) {
      return json(500, { ok: false, error: enquiryErr.message });
    }

    if (!enquiry) {
      return json(404, { ok: false, error: "Enquiry not found" });
    }

    const finalCustomerEmail =
      customerEmailFromBody || String(enquiry.customer_email || "").trim();

    if (finalCustomerEmail && !isEmail(finalCustomerEmail)) {
      return json(400, {
        ok: false,
        error: "Customer email missing or invalid",
      });
    }

    const { data: trader } = await supabase
      .from("profiles")
      .select("display_name, business_name, notify_email")
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
        channel: "portal",
        subject: `Re: ${enquiry.job_type || "Enquiry"}`,
        body_text: message,
        from_email: finalCustomerEmail || null,
        to_email: null,
        resend_id: null,
      });

    if (insertIncomingError) {
      return json(500, { ok: false, error: insertIncomingError.message });
    }

    const { error: updateError } = await supabase
      .from("quote_requests")
      .update({
        status: "customer-replied",
        read_at: null,
      })
      .eq("id", requestId);

    if (updateError) {
      console.warn("quote_requests update failed:", updateError.message);
    }

    const resendKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://thefixflowapp.com";

    const traderNotifyEmail = String(trader?.notify_email || "").trim();

    if (resendKey && resendFrom && traderNotifyEmail && isEmail(traderNotifyEmail)) {
      const resend = new Resend(resendKey);

      const dashboardUrl = `${appUrl.replace(/\/$/, "")}/dashboard/enquiries?requestId=${requestId}`;

      const sendResult = await resend.emails.send({
        from: resendFrom,
        to: traderNotifyEmail,
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
          `Open FixFlow:`,
          dashboardUrl,
        ].join("\n"),
      } as any);

      // @ts-ignore
      if (sendResult?.error) {
        return json(200, {
          ok: true,
          warning: sendResult.error.message || "Reply saved but notification email failed",
        });
      }
    }

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Server error" });
  }
}