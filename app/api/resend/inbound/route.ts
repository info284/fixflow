import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractRequestIdFromTo(toEmail: string) {
  const match = toEmail.match(/\+([0-9a-fA-F-]{36})@/);
  return match?.[1] || null;
}

function getEmailText(payload: any) {
  return (
    String(payload?.text || "") ||
    String(payload?.body_text || "") ||
    String(payload?.plain || "") ||
    String(payload?.body?.text || "") ||
    ""
  ).trim();
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const from = String(payload?.from || payload?.sender || "").trim();
    const to = String(payload?.to || payload?.recipient || "").trim();
    const subject = String(payload?.subject || "").trim();
    const text = getEmailText(payload);
    const resendId = String(payload?.id || payload?.email_id || "").trim() || null;

    if (!to) {
      return NextResponse.json({ ok: true, note: "Missing recipient" });
    }

    const requestId = extractRequestIdFromTo(to);

    if (!requestId) {
      return NextResponse.json({
        ok: true,
        note: "No request id found in recipient address",
      });
    }

    const { data: enquiry, error: enquiryError } = await supabaseAdmin
      .from("quote_requests")
      .select("id, plumber_id, stage")
      .eq("id", requestId)
      .maybeSingle();

    if (enquiryError) throw enquiryError;

    if (!enquiry?.plumber_id) {
      return NextResponse.json({
        ok: true,
        note: "No matching enquiry found",
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("enquiry_messages")
      .insert({
        request_id: requestId,
        plumber_id: enquiry.plumber_id,
        direction: "in",
        channel: "email",
        subject: subject || null,
        body_text: text || null,
        from_email: from || null,
        to_email: to || null,
        resend_id: resendId,
      });

    if (insertError) throw insertError;

    const currentStage = String(enquiry.stage || "").toLowerCase();

    const updatePayload: Record<string, any> = {
      read_at: null,
    };

    if (currentStage === "lost") {
      updatePayload.stage = "contacted";
    }

    const { error: updateError } = await supabaseAdmin
      .from("quote_requests")
      .update(updatePayload)
      .eq("id", requestId);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      requestId,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Inbound webhook failed",
      },
      { status: 500 }
    );
  }
}