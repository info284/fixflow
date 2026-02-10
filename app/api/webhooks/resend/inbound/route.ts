import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // REQUIRED
);

export async function POST(req: Request) {
  const payload = await req.json();

  // Only care about inbound emails
  if (payload.type !== "email.received") {
    return NextResponse.json({ ok: true });
  }

  const email = payload.data;

  /**
   * IMPORTANT:
   * You MUST embed the requestId in the reply address
   * e.g. reply+<requestId>@send.thefixflowapp.com
   */
  const to = email.to?.[0]?.email || "";
  const match = to.match(/\+(.*)@/);

  if (!match) {
    console.warn("No requestId found in email address");
    return NextResponse.json({ ok: true });
  }

  const requestId = match[1];

  await supabase.from("enquiry_messages").insert({
    request_id: requestId,
    plumber_id: null,            // inbound
    direction: "inbound",
    channel: "email",
    subject: email.subject || null,
    body_text: email.text || email.html || null,
    from_email: email.from?.email || null,
    to_email: to,
    resend_id: payload.id,
  });

  return NextResponse.json({ ok: true });
}