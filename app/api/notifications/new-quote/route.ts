// app/api/notifications/new-quote/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";

type NewQuoteBody = {
  // Where the *business owner* should receive the alert
  to?: string; // preferred
  notifyEmail?: string; // fallback (same meaning)

  businessName?: string;

  // Quote/request details
  requestId?: string;
  createdAt?: string; // ISO optional
  serviceName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  postcode?: string;
  details?: string;

  // Optional links
  dashboardUrl?: string; // e.g. `${origin}/dashboard/quotes/${requestId}`
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function esc(s: string) {
  return (s || "")
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
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as NewQuoteBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const to = (body.to || body.notifyEmail || "").trim();
    if (!to || !isValidEmail(to)) {
      return NextResponse.json(
        { ok: false, error: "Missing/invalid `to` (business notification email)" },
        { status: 400 }
      );
    }

    // ✅ Use subdomain sender to avoid Resend root-domain verification issues
    // You can override in .env.local: RESEND_FROM="FixFlow <invoices@send.thefixflowapp.com>"
    const from =
      process.env.RESEND_FROM || "FixFlow <invoices@send.thefixflowapp.com>";

    const businessName = (body.businessName || "FixFlow").trim();
    const requestId = (body.requestId || "").trim();
    const createdAt = (body.createdAt || "").trim();
    const serviceName = (body.serviceName || "").trim();

    const customerName = (body.customerName || "").trim();
    const customerEmail = (body.customerEmail || "").trim();
    const customerPhone = (body.customerPhone || "").trim();
    const postcode = (body.postcode || "").trim();
    const details = (body.details || "").trim();
    const dashboardUrl = (body.dashboardUrl || "").trim();

    const subject = `New quote request${serviceName ? ` • ${serviceName}` : ""}`;

    const textLines: string[] = [];
    textLines.push(`New quote received for ${businessName}`);
    if (requestId) textLines.push(`Request ID: ${requestId}`);
    if (createdAt) textLines.push(`Created: ${createdAt}`);
    if (serviceName) textLines.push(`Service: ${serviceName}`);
    textLines.push("");
    textLines.push("Customer:");
    if (customerName) textLines.push(`- Name: ${customerName}`);
    if (customerEmail) textLines.push(`- Email: ${customerEmail}`);
    if (customerPhone) textLines.push(`- Phone: ${customerPhone}`);
    if (postcode) textLines.push(`- Postcode: ${postcode}`);
    if (details) {
      textLines.push("");
      textLines.push("Details:");
      textLines.push(details);
    }
    if (dashboardUrl) {
      textLines.push("");
      textLines.push(`Open in FixFlow: ${dashboardUrl}`);
    }

    const text = textLines.join("\n");

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5; color:#111;">
        <h2 style="margin:0 0 10px;">New quote received</h2>
        <p style="margin:0 0 12px;">A new quote request was submitted for <strong>${esc(businessName)}</strong>.</p>

        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:12px; background:#f9fafb; margin:0 0 12px;">
          ${requestId ? `<div><span style="color:#6b7280;">Request ID:</span> <strong>${esc(requestId)}</strong></div>` : ""}
          ${createdAt ? `<div><span style="color:#6b7280;">Created:</span> <strong>${esc(createdAt)}</strong></div>` : ""}
          ${serviceName ? `<div><span style="color:#6b7280;">Service:</span> <strong>${esc(serviceName)}</strong></div>` : ""}
        </div>

        <h3 style="margin:16px 0 6px; font-size:14px;">Customer</h3>
        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:12px; background:#fff; margin:0 0 12px;">
          ${customerName ? `<div><span style="color:#6b7280;">Name:</span> <strong>${esc(customerName)}</strong></div>` : ""}
          ${customerEmail ? `<div><span style="color:#6b7280;">Email:</span> <strong>${esc(customerEmail)}</strong></div>` : ""}
          ${customerPhone ? `<div><span style="color:#6b7280;">Phone:</span> <strong>${esc(customerPhone)}</strong></div>` : ""}
          ${postcode ? `<div><span style="color:#6b7280;">Postcode:</span> <strong>${esc(postcode)}</strong></div>` : ""}
        </div>

        ${
          details
            ? `<h3 style="margin:16px 0 6px; font-size:14px;">Details</h3>
               <div style="border:1px solid #e5e7eb; border-radius:12px; padding:12px; background:#fff; white-space:pre-wrap;">${esc(details)}</div>`
            : ""
        }

        ${
          dashboardUrl
            ? `<p style="margin:16px 0 0;">
                 <a href="${esc(dashboardUrl)}" style="display:inline-block; background:#111827; color:#fff; padding:10px 14px; border-radius:10px; text-decoration:none;">
                   Open in FixFlow
                 </a>
               </p>`
            : ""
        }
      </div>
    `;

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to,
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

