import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
  escapeEmailHtml,
} from "@/lib/emails/fixflowEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const traderName = body.traderName || "there";
    const toEmail = body.email;

    if (!toEmail) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`;
    const profileUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/profile`;

    const forwardingEmail = "reply@thefixflowapp.com";

    const html = buildFixFlowEmail({
      title: "Welcome to FixFlow 👋",
      introHtml: `
        <p>Hi ${escapeEmailHtml(traderName)},</p>
        <p>Welcome to FixFlow — built to help trade businesses stop losing work through forgotten quotes, missed follow-ups, buried messages and lost customer details.</p>
        <p><strong>The goal is simple: help you stay organised, look professional and win more of the work you're already getting.</strong></p>
      `,
      bodyHtml: `
        ${buildFixFlowSectionLabel("What you can do with FixFlow")}

        ${buildFixFlowInfoCard(`
          <p><strong>✅ Receive customer enquiries online</strong><br/>
          Share your FixFlow link so customers can send job details, photos and contact information straight to you.</p>

          <p><strong>✅ Keep every enquiry organised</strong><br/>
          No more searching through WhatsApp, texts, emails and scraps of paper.</p>

          <p><strong>✅ Reply to customers</strong><br/>
          Keep customer conversations in one place with a clear message history.</p>

          <p><strong>✅ Create and send estimates</strong><br/>
          Send professional estimates customers can view and accept online.</p>

          <p><strong>✅ Track jobs</strong><br/>
          Manage enquiries, site visits, booked jobs and follow-ups from your dashboard.</p>

          <p><strong>✅ Create invoices</strong><br/>
          Send professional invoices and keep track of what has been paid and what is outstanding.</p>
        `)}

        ${buildFixFlowSectionLabel("Forward emails into FixFlow")}

        ${buildFixFlowInfoCard(`
          <p>Already receiving customer enquiries by email?</p>
          <p>You can forward customer emails directly into FixFlow and we’ll create an enquiry for you.</p>
          <p><strong>${forwardingEmail}</strong></p>
          <p>No copying and pasting. No lost details. Everything stays organised.</p>
        `)}

        ${buildFixFlowSectionLabel("Best next step")}

        ${buildFixFlowInfoCard(`
          <p>Complete your profile so customers can trust your business.</p>
          <p>Add your logo, services, coverage areas, certificates and payment details.</p>
        `)}

        ${buildFixFlowButton(profileUrl, "Complete your profile")}
      `,
      closingHtml: `
        <p>If you need help, just reply to this email.</p>
        <p>Anna<br/>Founder, FixFlow</p>
      `,
    });

    const { error } = await resend.emails.send({
      from: "FixFlow <hello@thefixflowapp.com>",
      to: toEmail,
      subject: "Welcome to FixFlow 👋",
      html,
    });

    if (error) {
      console.error("Welcome email failed:", error);
      return NextResponse.json({ error: "Email failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Welcome email error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}