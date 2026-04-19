// app/api/notifications/new-quote/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
  escapeEmailHtml,
} from "@/lib/emails/fixflowEmail";

type NewQuoteBody = {
  to?: string;
  notifyEmail?: string;
  businessName?: string;
  requestId?: string;
  createdAt?: string;
  serviceName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  postcode?: string;
  details?: string;
  dashboardUrl?: string;
};

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

    const body = (await req.json().catch(() => null)) as NewQuoteBody | null;

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const to = String(body.to || body.notifyEmail || "").trim();

    if (!to || !isValidEmail(to)) {
      return NextResponse.json(
        { ok: false, error: "Missing/invalid `to` (business notification email)" },
        { status: 400 }
      );
    }

    const from =
      process.env.RESEND_FROM || "FixFlow <invoices@send.thefixflowapp.com>";

    const businessName = String(body.businessName || "FixFlow").trim();
    const requestId = String(body.requestId || "").trim();
    const createdAt = String(body.createdAt || "").trim();
    const serviceName = String(body.serviceName || "").trim();

    const customerName = String(body.customerName || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const postcode = String(body.postcode || "").trim();
    const details = String(body.details || "").trim();
    const dashboardUrl = String(body.dashboardUrl || "").trim();

    const safeBusinessName = escapeEmailHtml(businessName);
    const safeRequestId = escapeEmailHtml(requestId);
    const safeCreatedAt = escapeEmailHtml(createdAt);
    const safeServiceName = escapeEmailHtml(serviceName || "New enquiry");
    const safeCustomerName = escapeEmailHtml(customerName || "—");
    const safeCustomerEmail = escapeEmailHtml(customerEmail || "—");
    const safeCustomerPhone = escapeEmailHtml(customerPhone || "—");
    const safePostcode = escapeEmailHtml(postcode || "—");
    const safeDetails = escapeEmailHtml(details || "—");

    const subject = `New quote request${serviceName ? ` • ${serviceName}` : ""}`;

    const html = buildFixFlowEmail({
      title: "New enquiry received",
      introHtml: `
        <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
          New enquiry for ${safeBusinessName}
        </div>

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          You’ve received a new quote request for <strong style="color:#0B1320;">${safeServiceName}</strong>.
        </div>
      `,
      bodyHtml: `
        ${buildFixFlowInfoCard(`
          ${
            requestId || createdAt || serviceName
              ? `
                <div style="padding:16px 18px; border-bottom:1px solid #E6ECF5;">
                  ${buildFixFlowSectionLabel("Request")}
                  ${
                    requestId
                      ? `<div style="font-size:16px; font-weight:800; color:#1F355C; margin-bottom:6px;">
                           ${safeRequestId}
                         </div>`
                      : ""
                  }
                  ${
                    createdAt
                      ? `<div style="font-size:13px; color:#5C6B84; margin-bottom:4px;">
                           Created: ${safeCreatedAt}
                         </div>`
                      : ""
                  }
                  ${
                    serviceName
                      ? `<div style="font-size:13px; color:#5C6B84;">
                           Service: ${safeServiceName}
                         </div>`
                      : ""
                  }
                </div>
              `
              : ""
          }

         <div style="padding:16px 18px; border-bottom:1px solid #E6ECF5; text-align:center;">
  ${buildFixFlowSectionLabel("Customer")}
  <div style="font-size:16px; font-weight:800; color:#0B1320; margin-bottom:6px;">
    ${safeCustomerName}
  </div>
  <div style="font-size:14px; line-height:1.7; color:#5C6B84;">
    ${safeCustomerEmail}
  </div>
  <div style="font-size:14px; line-height:1.7; color:#5C6B84;">
    ${safeCustomerPhone}
  </div>
</div>

          <div style="padding:16px 18px;">
            ${buildFixFlowSectionLabel("Location")}
            <div style="font-size:16px; font-weight:800; color:#0B1320;">
              ${safePostcode}
            </div>
          </div>
        `)}

        ${
          details
            ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border-collapse:collapse;">
                <tr>
                  <td style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#5C6B84; padding:0 0 10px 0;">
                    Job details
                  </td>
                </tr>
                <tr>
                  <td style="border:1px solid #E6ECF5; border-radius:16px; background:#F4F7FF; padding:22px 24px; text-align:center;">
                    <div style="max-width:340px; margin:0 auto; font-size:15px; line-height:1.7; color:#0B1320; white-space:pre-wrap;">
                      ${safeDetails}
                    </div>
                  </td>
                </tr>
              </table>
            `
            : ""
        }

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          Open this enquiry in FixFlow to reply and send a quote.
        </div>
      `,
      ctaHtml: dashboardUrl
        ? buildFixFlowButton("View enquiry", dashboardUrl)
        : "",
      closingHtml: `
        <div style="font-size:15px; line-height:1.7; color:#5C6B84;">
          <span style="font-weight:800; color:#1F355C;">FixFlow</span>
        </div>
      `,
    });

    const textLines: string[] = [];
    textLines.push(`New enquiry received for ${businessName}`);
    if (requestId) textLines.push(`Request ID: ${requestId}`);
    if (createdAt) textLines.push(`Created: ${createdAt}`);
    if (serviceName) textLines.push(`Service: ${serviceName}`);
    textLines.push("");
    textLines.push("Customer:");
    textLines.push(`- Name: ${customerName || "—"}`);
    textLines.push(`- Email: ${customerEmail || "—"}`);
    textLines.push(`- Phone: ${customerPhone || "—"}`);
    textLines.push(`- Postcode: ${postcode || "—"}`);

    if (details) {
      textLines.push("");
      textLines.push("Job details:");
      textLines.push(details);
    }

    if (dashboardUrl) {
      textLines.push("");
      textLines.push(`View enquiry: ${dashboardUrl}`);
    }

    const text = textLines.join("\n");

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