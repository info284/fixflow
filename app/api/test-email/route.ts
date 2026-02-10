export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const to =
      (body?.to as string | undefined) ||
      process.env.TEST_EMAIL_TO ||
      process.env.RESEND_TEST_TO;

    const message =
      (body?.message as string | undefined) || "FixFlow test email";

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Missing 'to' (pass in JSON or set TEST_EMAIL_TO)" },
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const from =
      process.env.RESEND_FROM ||
      "FixFlow <invoices@send.thefixflowapp.com>";

    const result = await resend.emails.send({
      from,
      to,
      subject: "FixFlow Test Email",
      text: message,
      html: `<p>${message}</p>`,
    });

    // Resend returns { data, error }
    if ((result as any)?.error) {
      return NextResponse.json(
        { ok: false, sent: result },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, sent: result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
