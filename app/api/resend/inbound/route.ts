import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
);

function extractRequestIdFromTo(toEmail: string) {
  // expects: enquiries+<requestId>@send.thefixflowapp.com
  const m = toEmail.match(/\+([0-9a-fA-F-]{36})@/);
  return m?.[1] || null;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Resend inbound payloads vary depending on setup; these are common fields:
    const from = (payload?.from || payload?.sender || "").toString();
    const to = (payload?.to || payload?.recipient || "").toString();
    const subject = (payload?.subject || "").toString();
    const text =
      (payload?.text || payload?.body_text || payload?.plain || "").toString() ||
      (payload?.body?.text || "").toString();

    if (!to) return NextResponse.json({ ok: true });

    const requestId = extractRequestIdFromTo(to);
    if (!requestId) {
      return NextResponse.json({ ok: true, note: "No requestId in to address" });
    }

    // Find plumber_id for this request
    const { data: qr, error: qrErr } = await supabaseAdmin
      .from("quote_requests")
      .select("id, plumber_id")
      .eq("id", requestId)
      .maybeSingle();

    if (qrErr) throw qrErr;
    if (!qr?.plumber_id) {
      return NextResponse.json({ ok: true, note: "No matching quote_request" });
    }

    // Insert inbound message
    const { error: insErr } = await supabaseAdmin.from("enquiry_messages").insert({
      request_id: requestId,
      plumber_id: qr.plumber_id,
      direction: "in",        // ✅ inbound
      channel: "email",
      subject: subject || null,
      body_text: text || null,
      from_email: from || null,
      to_email: to || null,
      resend_id: payload?.id || payload?.email_id || null,
    });

    if (insErr) throw insErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Inbound webhook failed" },
      { status: 500 }
    );
  }
}