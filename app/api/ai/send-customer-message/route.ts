import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { renderFixFlowCustomerMessageEmail } from "@/lib/emails/renderFixFlowCustomerMessageEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const enquiryId = String(body?.enquiryId || "").trim();
    const toEmail = String(body?.toEmail || "").trim();
    const subject =
      String(body?.subject || "").trim() || "Update on your enquiry";
    const message = String(body?.message || "").trim();

    if (!enquiryId || !toEmail || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing enquiryId, toEmail or message" },
        { status: 400 }
      );
    }

    const { data: enquiry, error: enquiryError } = await supabaseAdmin
      .from("quote_requests")
      .select("id, customer_name, plumber_id")
      .eq("id", enquiryId)
      .single();

    if (enquiryError || !enquiry) {
      return NextResponse.json(
        { ok: false, error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_name, display_name")
      .eq("id", enquiry.plumber_id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: profileError.message },
        { status: 500 }
      );
    }

    const traderName =
      String(profile?.business_name || "").trim() ||
      String(profile?.display_name || "").trim() ||
      "FixFlow";

    const html = renderFixFlowCustomerMessageEmail({
      customerName: enquiry.customer_name || null,
      traderName,
      subject,
      message,
    });

    const text = [
      `Hi ${enquiry.customer_name || "there"},`,
      "",
      message,
      "",
      "Thanks,",
      traderName,
    ].join("\n");


const from = `${traderName} <quotes@send.thefixflowapp.com>`;

const replyTo = `enquiries+${enquiryId}@send.thefixflowapp.com`;

const sendResult = await resend.emails.send({
  from,
  to: [toEmail],
  subject,
  html,
  text,
  replyTo,
});

    const resendError = (sendResult as any)?.error;
    if (resendError) {
      throw new Error(resendError.message || "Resend failed");
    }

    const { error: insertError } = await supabaseAdmin
      .from("enquiry_messages")
      .insert({
        request_id: enquiryId,
        plumber_id: enquiry.plumber_id,
        direction: "out",
        channel: "email",
        subject,
        body_text: message,
        from_email: from,
        to_email: toEmail,
        sent_by: "ai",
        message_type: body?.messageType || "manual",
        automation_reason: body?.automationReason || null,
        ai_confidence:
          typeof body?.confidence === "number" ? body.confidence : null,
        requires_review: false,
      });

    if (insertError) {
      console.warn("Failed to log message:", insertError.message);
    }

    return NextResponse.json({
      ok: true,
      sendResult,
    });
  } catch (error: any) {
    console.error("send-customer-message error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to send customer email" },
      { status: 500 }
    );
  }
}