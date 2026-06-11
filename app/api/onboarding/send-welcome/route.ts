export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildWelcomeEmail } from "@/lib/emails/buildWelcomeEmail";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("Missing RESEND_API_KEY");
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    const email = String(body?.email || "").trim();
    const publicUrl = String(body?.publicUrl || "").trim();
    const businessName = String(body?.businessName || "").trim();

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

const { html, text } = buildWelcomeEmail({
publicUrl,
businessName,
});

    const resend = new Resend(apiKey);

    const from =
      process.env.RESEND_FROM ||
      "FixFlow <hello@thefixflowapp.com>";

    const result = await resend.emails.send({
      from,
      to: email,
      subject: "Welcome to FixFlow 👋",
      html,
      text,
    });

    if (result.error) {
      console.error("Resend welcome email error:", result.error);
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, id: result.data?.id || null },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Welcome email route error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}