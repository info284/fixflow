export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";

type InvoiceEmailRequest = {
  to: string; // recipient email
  customerName?: string;
  invoiceNumber?: string;
  amount?: string; // e.g. "£120.00"
  dueDate?: string; // e.g. "2026-01-15" or "15 Jan 2026"
  message?: string; // optional note
  invoiceUrl?: string; // optional link to view/pay invoice
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    const body = (await req.json().catch(() => null)) as InvoiceEmailRequest | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const to = (body.to || "").trim();
    if (!to || !isValidEmail(to)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid `to` email address." },
        { status: 400 }
      );
    }

    // ✅ Use your subdomain sender to avoid Resend domain verification blocking
    // You can override with RESEND_FROM in .env.local if you want.
    const from =
      process.env.RESEND_FROM || "FixFlow <invoices@send.thefixflowapp.com>";

    const customerName = (body.customerName || "").trim();
    const invoiceNumber = (body.invoiceNumber || "").trim();
    const amount = (body.amount || "").trim();
    const dueDate = (body.dueDate || "").trim();
    const message = (body.message || "").trim();
    const invoiceUrl = (body.invoiceUrl || "").trim();

    const subject =
      invoiceNumber
        ? `Your FixFlow invoice ${invoiceNumber}`
        : "Your FixFlow invoice";

    const textLines: string[] = [];
    textLines.push(`Hi${customerName ? ` ${customerName}` : ""},`);
    textLines.push("");
    textLines.push("Your invoice is ready.");
    if (invoiceNumber) textLines.push(`Invoice: ${invoiceNumber}`);
    if (amount) textLines.push(`Amount: ${amount}`);
    if (dueDate) textLines.push(`Due: ${dueDate}`);
    if (invoiceUrl) textLines.push(`View/Pay: ${invoiceUrl}`);
    if (message) {
      textLines.push("");
      textLines.push(message);
    }
    textLines.push("");
    textLines.push("Thanks,");
    textLines.push("FixFlow");

    const text = textLines.join("\n");

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5; color: #111;">
        <h2 style="margin:0 0 12px;">Your invoice is ready</h2>
        <p style="margin:0 0 12px;">Hi${customerName ? ` ${escapeHtml(customerName)}` : ""},</p>

        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:14px; background:#f9fafb; margin: 0 0 12px;">
          ${invoiceNumber ? row("Invoice", escapeHtml(invoiceNumber)) : ""}
          ${amount ? row("Amount", escapeHtml(amount)) : ""}
          ${dueDate ? row("Due", escapeHtml(dueDate)) : ""}
        </div>

        ${
          invoiceUrl
            ? `<p style="margin:0 0 14px;">
                 <a href="${escapeAttr(invoiceUrl)}" style="display:inline-block; background:#111827; color:#fff; padding:10px 14px; border-radius:10px; text-decoration:none;">
                   View / Pay invoice
                 </a>
               </p>`
            : ""
        }

        ${
          message
            ? `<p style="margin:0 0 14px; white-space:pre-wrap;">${escapeHtml(message)}</p>`
            : ""
        }

        <p style="margin:0;">Thanks,<br/>FixFlow</p>
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

    // Resend returns either { data } or { error } depending on SDK version/response
    const anyResult = result as any;
    if (anyResult?.error) {
      return NextResponse.json(
        { ok: false, error: anyResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

function row(label: string, value: string) {
  return `
    <div style="display:flex; gap:10px; margin:6px 0;">
      <div style="width:80px; color:#6b7280;">${label}</div>
      <div style="font-weight:600;">${value}</div>
    </div>
  `;
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(input: string) {
  // minimal safe escaping for attribute context
  return escapeHtml(input).replace(/`/g, "&#096;");
}
