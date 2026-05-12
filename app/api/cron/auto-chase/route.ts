import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resend = new Resend(process.env.RESEND_API_KEY);

  const now = new Date();

  // 1. Get unpaid invoices
const { data: quotes, error } = await supabase
  .from("quotes")
  .select(`
    id,
    request_id,
    customer_email,
    customer_name,
    status,
    sent_at,
    created_at,
    last_chased_at,
    chase_count,
    plumber_id,

    enquiry_messages:request_id (
      id,
      direction,
      created_at
    )
  `)
  .eq("status", "invoiced");

  if (error) {
    return NextResponse.json({ error: error.message });
  }

  let sent = 0;

  for (const q of quotes || []) {

    const messages = q.enquiry_messages || [];

const hasReplyAfterChase = messages.some((m: any) => {
  if (m.direction === "out") return false;

  if (!q.last_chased_at) return true;

  return new Date(m.created_at) > new Date(q.last_chased_at);
});

if (hasReplyAfterChase) continue;

    const baseDate = q.sent_at || q.created_at;
    if (!baseDate) continue;

    const sentDate = new Date(baseDate);

    const hours =
      (now.getTime() - sentDate.getTime()) /
      (1000 * 60 * 60);

    // ⛔ LIMIT: max 3 chases
    if ((q.chase_count || 0) >= 3) continue;

    // ⛔ LIMIT: don’t send again within 48h
    if (q.last_chased_at) {
      const last = new Date(q.last_chased_at);
      const sinceLast =
        (now.getTime() - last.getTime()) /
        (1000 * 60 * 60);

      if (sinceLast < 48) continue;
    }

    let message = "";

    const name = q.customer_name
      ? q.customer_name.split(" ")[0]
      : "there";

    // 🚨 URGENT
    if (hours > 120) {
      message = `Hi ${name}, just a quick reminder about the invoice — please let me know if you need anything from me.`;
    }

    // ⏰ SOFT
    else if (hours > 72) {
      message = `Hi ${name}, just checking if you’ve had a chance to look at the invoice.`;
    }

    if (!message) continue;

    // 📧 Send email
    try {
      await resend.emails.send({
        from: "FixFlow <noreply@yourdomain.com>",
        to: q.customer_email,
        subject: "Invoice reminder",
        text: message,
      });

      // 🧾 Log message
      await supabase.from("enquiry_messages").insert({
        request_id: q.request_id,
        plumber_id: q.plumber_id,
        direction: "out",
        channel: "email",
        subject: "Invoice reminder",
        body_text: message,
      });

      // 🧠 Update tracking
      await supabase
        .from("quotes")
        .update({
          last_chased_at: now.toISOString(),
          chase_count: (q.chase_count || 0) + 1,
        })
        .eq("id", q.id);

      sent++;
    } catch (err) {
      console.error("Send failed", err);
    }
  }

  return NextResponse.json({ sent });
}