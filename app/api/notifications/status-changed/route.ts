// app/api/notifications/status-changed/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";

type StatusChangedBody = {
  customerEmail: string;
  status: "new" | "quoted" | "won" | "lost" | string;
  customerName?: string | null;
  requestId?: string | null;
  businessName?: string | null;
  publicQuoteUrl?: string | null; // optional link back to view quote
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function statusCopy(status: string) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "new":
      return { label: "New", title: "We’ve received your request", body: "Your request has been received and is in our queue." };
    case "quoted":
      return { label: "Quoted", title: "Your quote is ready", body: "Your quote has been prepared. Please review the details below." };
    case "won":
      return { label: "Booked", title: "Booking confirmed", body: "Great news — your job has been booked in." };
    case "lost":
      return { label: "Closed", title: "Update on your request", body: "Your request has been closed. If you still need help, reply to this email." };
    default:
      return { label: status || "Updated", title: "Update on your request", body: "There’s an update on your request. See details below." };
  }
}

function escapeHtml(input: string) {
  return (input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY in environment." },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as StatusChangedBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const customerEmail = (body.customerEmail || "").trim();
    const status = (body.status || "").trim();

    if (!customerEmail || !isValidEmail(customerEmail)) {
      return NextResponse.json(
        { ok: false, error: "Missing/invalid customerEmail." },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json({ ok: false, error: "Missing status." }, { status: 400 });
    }

    const businessName = (body.businessName || "FixFlow").trim();
    const customerName = (body.customerName || "").trim();
    const requestId = (body.requestId || "").trim();
    const publicQuoteUrl = (body.publicQuoteUrl || "").trim();

    const copy = statusCopy(status);

    // ✅ Use subdomain sender to avoid Resend root-domain verification issues
    const from =
      process.env.RESEND_FROM || "FixFlow <invoices@send.thefixflowapp.com>";

    const subject = `${businessName}: ${copy.title}`;

    const greeting = customerName ? `Hi ${customerName},` : "Hi,";
    const metaLines: string[] = [];
    if (requestId) metaLines.push(`Request ID: ${requestId}`);
    metaLines.push(`Status: ${copy.label}`);

    const text = [
      greeting,
      "",
      copy.body,
      "",
      ...metaLines,
      publicQuoteUrl ? "" : "",
      publicQuoteUrl ? `View: ${publicQuoteUrl}` : "",
      "",
      `Thanks,`,
      businessName,
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5; color: #111;">
        <h2 style="margin:0 0 12px;">${escapeHtml(copy.title)}</h2>
        <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px;">${escapeHtml(copy.body)}</p>

        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:14px; background:#f9fafb; margin: 0 0 14px;">
          ${requestId ? `<div style="margin:6px 0;"><span style="color:#6b7280;">Request ID:</span> <strong>${escapeHtml(requestId)}</strong></div>` : ""}
          <div style="margin:6px 0;"><span style="color:#6b7280;">Status:</span> <strong>${escapeHtml(copy.label)}</strong></div>
        </div>

        ${
          publicQuoteUrl
            ? `<p style="margin:0 0 16px;">
                <a href="${escapeHtml(publicQuoteUrl)}" style="display:inline-block; background:#111827; color:#fff; padding:10px 14px; border-radius:10px; text-decoration:none;">
                  View update
                </a>
              </p>`
            : ""
        }

        <p style="margin:0;">Thanks,<br/>${escapeHtml(businessName)}</p>
      </div>
    `;

    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from,
      to: customerEmail,
      subject,
      text,
      html,
    });

    const anyResult = result as any;
    if (anyResult?.error) {
      return NextResponse.json({ ok: false, error: anyResult.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
