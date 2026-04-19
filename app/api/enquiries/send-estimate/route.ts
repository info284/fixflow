import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
  escapeEmailHtml,
} from "@/lib/emails/fixflowEmail";

const resend = new Resend(process.env.RESEND_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      estimateId,
      requestId,
      plumberId,
      to,
      customerName,
      traderName,
      traderLogoUrl,
      jobNumber,
      jobType,
      labourAmount,
      materialsAmount,
      otherAmount,
      totalAmount,
      notes,
    } = body ?? {};

    if (!estimateId) {
      return NextResponse.json(
        { error: "Missing estimateId" },
        { status: 400 }
      );
    }

    if (!requestId || !plumberId || !to) {
      return NextResponse.json(
        { error: "Missing requestId, plumberId or recipient email." },
        { status: 400 }
      );
    }

    const safeCustomerName = customerName || "there";
    const safeTraderName = traderName || "Your trader";
    const safeJobNumber = jobNumber || "Estimate";
    const safeJobType = jobType || "Job";

    const labour = Number(labourAmount || 0).toFixed(2);
    const materials = Number(materialsAmount || 0).toFixed(2);
    const other = Number(otherAmount || 0).toFixed(2);
    const total = Number(totalAmount || 0).toFixed(2);

    const notesText =
      typeof notes === "string" && notes.trim()
        ? notes.trim()
        : "No additional notes.";

    const safeCustomerNameEsc = escapeEmailHtml(safeCustomerName);
    const safeTraderNameEsc = escapeEmailHtml(safeTraderName);
    const safeJobNumberEsc = escapeEmailHtml(safeJobNumber);
    const safeJobTypeEsc = escapeEmailHtml(safeJobType);
    const safeNotesEsc = escapeEmailHtml(notesText);

    const subject = `Your estimate from ${safeTraderName} (£${total})`;

    const acceptUrl = `https://thefixflowapp.com/accept-estimate?id=${estimateId}`;

    const html = buildFixFlowEmail({
      title: "Estimate ready",
      introHtml: `
        <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
          Hi ${safeCustomerNameEsc},
        </div>

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          Here’s your estimate for your <strong style="color:#0B1320;">${safeJobTypeEsc.toLowerCase()}</strong>.
        </div>
      `,
      bodyHtml: `
        ${buildFixFlowInfoCard(`
          <div style="padding:16px 18px; border-bottom:1px solid #E6ECF5;">
            ${buildFixFlowSectionLabel("Reference")}
            <div style="font-size:18px; font-weight:800; color:#1F355C;">
              ${safeJobNumberEsc}
            </div>
          </div>

          <div style="padding:16px 18px; border-bottom:1px solid #E6ECF5;">
            <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #E6ECF5;">
              <span style="color:#5C6B84; font-size:14px;">Labour</span>
              <span style="font-weight:700; font-size:14px; color:#0B1320;">£${labour}</span>
            </div>

            <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #E6ECF5;">
              <span style="color:#5C6B84; font-size:14px;">Materials</span>
              <span style="font-weight:700; font-size:14px; color:#0B1320;">£${materials}</span>
            </div>

            <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;">
              <span style="color:#5C6B84; font-size:14px;">Other</span>
              <span style="font-weight:700; font-size:14px; color:#0B1320;">£${other}</span>
            </div>
          </div>

          <div style="padding:18px;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-end;">
              <span style="color:#0B1320; font-size:18px; font-weight:800;">Estimated total</span>
              <span style="color:#0B1320; font-size:22px; font-weight:900;">£${total}</span>
            </div>
          </div>
        `)}

        <div style="margin:24px 0 12px; text-align:center; font-size:14px; color:#5C6B84;">
          Happy with this estimate?
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border-collapse:collapse;">
          <tr>
            <td style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#5C6B84; padding:0 0 10px 0;">
              Notes
            </td>
          </tr>
          <tr>
            <td style="border:1px solid #E6ECF5; border-radius:16px; background:#F4F7FF; padding:22px 24px; text-align:center;">
              <div style="max-width:320px; margin:0 auto; font-size:15px; line-height:1.7; color:#0B1320;">
                ${safeNotesEsc}
              </div>
            </td>
          </tr>
        </table>

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          Please use the button below to accept this estimate.
        </div>
      `,
      ctaHtml: buildFixFlowButton("Accept estimate", acceptUrl),
      closingHtml: `
        <div style="font-size:15px; line-height:1.7; color:#5C6B84;">
          Thanks,<br />
          <span style="font-weight:800; color:#1F355C;">${safeTraderNameEsc}</span>
        </div>
      `,
    });

    const text = `Hi ${safeCustomerName},

Here is your estimate from ${safeTraderName}.

Reference: ${safeJobNumber}
Job: ${safeJobType}

Labour: £${labour}
Materials: £${materials}
Other: £${other}

Estimated total: £${total}

Notes:
${notesText}

Accept estimate:
${acceptUrl}

Thanks,
${safeTraderName}`;

    const emailResult = await resend.emails.send({
      from: "FixFlow <quotes@send.thefixflowapp.com>",
      to,
      subject,
      text,
      html,
      replyTo: "hello@thefixflowapp.com",
    });

    const { error: logError } = await supabase.from("enquiry_messages").insert({
      request_id: requestId,
      plumber_id: plumberId,
      direction: "out",
      channel: "estimate",
      subject,
      body_text: text,
      from_email: "quotes@send.thefixflowapp.com",
      to_email: to,
      resend_id: emailResult.data?.id ?? null,
    });

    if (logError) {
      console.warn("Failed to log estimate email:", logError.message);
    }

    return NextResponse.json({
      ok: true,
      resend_id: emailResult.data?.id ?? null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to send estimate." },
      { status: 500 }
    );
  }
}