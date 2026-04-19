export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildFirstEnquiryEmail } from "@/lib/emails/buildFirstEnquiryEmail";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    const email = String(body?.email || "").trim();
    const publicUrl = String(body?.publicUrl || "").trim();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid email" },
        { status: 400 }
      );
    }

    if (!publicUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing publicUrl" },
        { status: 400 }
      );
    }

    const { html, text } = buildFirstEnquiryEmail(publicUrl);

    const resend = new Resend(apiKey);

    const from =
      process.env.RESEND_FROM ||
      "FixFlow <hello@send.thefixflowapp.com>";

    const subject = "Get your first enquiry";

    const result = await resend.emails.send({
      from,
      to: email,
      subject,
      html,
      text,
    });

    const anyResult = result as any;

    if (anyResult?.error) {
      return NextResponse.json(
        { ok: false, error: anyResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}