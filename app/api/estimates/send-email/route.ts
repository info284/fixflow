export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { cookies } from "next/headers";
import { renderEstimatePdfBuffer } from "@/lib/estimates/renderEstimatePdf";
import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
  escapeEmailHtml,
} from "@/lib/emails/fixflowEmail";

/* ---------------- constants ---------------- */

const BUCKET = "quote-files";

/* ---------------- helpers ---------------- */

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function cleanId(v?: string | null) {
  const s = String(v || "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

function money(n?: number | null) {
  const x = Number(n || 0);
  return `£${x.toFixed(2)}`;
}

function formatPostcode(pc?: string | null) {
  if (!pc) return "";
  const clean = String(pc).replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  return clean.slice(0, -3) + " " + clean.slice(-3);
}

function titleCase(s?: string | null) {
  return String(s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function safeDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB");
}

function safeFileBase(v?: string | null) {
  const cleaned = String(v || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned.slice(0, 80);
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function supabaseAnonForAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}

async function getAuthedUserId(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const c = await cookies();
  const cookieToken =
    c.get("sb-access-token")?.value || c.get("supabase-auth-token")?.value || "";

  const accessToken = bearer || cookieToken;
  if (!accessToken) return null;

  const anon = supabaseAnonForAuth();
  const { data, error } = await anon.auth.getUser(accessToken);

  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function saveEstimatePdfToJobFiles(params: {
  admin: ReturnType<typeof supabaseAdmin>;
  requestId: string;
  plumberId: string;
  fileBase: string;
  pdfBuffer: Buffer;
}) {
  const { admin, requestId, plumberId, fileBase, pdfBuffer } = params;

  const safeBase = safeFileBase(fileBase) || "estimate";
  const fileName = `${safeBase}.pdf`;
  const filePath = `quote/${requestId}/trader/${Date.now()}_${fileName}`;

  const { data: oldRows, error: oldRowsErr } = await admin
    .from("job_files")
    .select("id, path")
    .eq("request_id", requestId)
    .eq("area", "trader")
    .eq("label", "quote_pdf");

  if (oldRowsErr) {
    throw new Error(`Existing PDF lookup failed: ${oldRowsErr.message}`);
  }

  const oldPaths = (oldRows || [])
    .map((row) => String(row.path || "").trim())
    .filter(Boolean);

  if (oldPaths.length) {
    const { error: removeStorageErr } = await admin.storage
      .from(BUCKET)
      .remove(oldPaths);

    if (removeStorageErr) {
      console.warn("Old quote pdf storage cleanup failed:", removeStorageErr.message);
    }

    const { error: removeMetaErr } = await admin
      .from("job_files")
      .delete()
      .eq("request_id", requestId)
      .eq("area", "trader")
      .eq("label", "quote_pdf");

    if (removeMetaErr) {
      console.warn("Old quote pdf metadata cleanup failed:", removeMetaErr.message);
    }
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`PDF upload failed: ${uploadError.message}`);
  }

  const { error: insertError } = await admin.from("job_files").insert({
    request_id: requestId,
    plumber_id: plumberId,
    path: filePath,
    file_name: fileName,
    area: "trader",
    label: "quote_pdf",
  });

  if (insertError) {
    await admin.storage.from(BUCKET).remove([filePath]);
    throw new Error(`job_files insert failed: ${insertError.message}`);
  }

  return { filePath, fileName };
}

/* ---------------- route ---------------- */

export async function POST(req: Request) {
  try {
    const uid = await getAuthedUserId(req);

    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    const requestId = cleanId(body?.requestId);
    const estimateId = cleanId(body?.estimateId);
    const subjectIn = String(body?.subject || "").trim();
    const customerNoteIn = String(body?.customerNote || "").trim();

    if (!requestId && !estimateId) {
      return NextResponse.json(
        { ok: false, error: "Missing requestId or estimateId" },
        { status: 400 }
      );
    }

    if (requestId && !isUuid(requestId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid requestId" },
        { status: 400 }
      );
    }

    if (estimateId && !isUuid(estimateId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid estimateId" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    let estimateQuery = admin
      .from("estimates")
      .select("*")
      .eq("plumber_id", uid)
      .order("created_at", { ascending: false })
      .limit(1);

    if (estimateId) {
      estimateQuery = estimateQuery.eq("id", estimateId);
    } else {
      estimateQuery = estimateQuery.eq("request_id", requestId);
    }

    const { data: estimate, error: estimateErr } = await estimateQuery.maybeSingle();

    if (estimateErr) {
      throw new Error(`Estimate load failed: ${estimateErr.message}`);
    }

    if (!estimate) {
      return NextResponse.json(
        { ok: false, error: "Estimate not found" },
        { status: 404 }
      );
    }

    const finalRequestId = cleanId(estimate.request_id);

    if (!finalRequestId || !isUuid(finalRequestId)) {
      return NextResponse.json(
        { ok: false, error: "Estimate is not linked to a valid enquiry" },
        { status: 400 }
      );
    }

    const { data: enquiry, error: enquiryErr } = await admin
      .from("quote_requests")
      .select(`
        id,
        job_number,
        customer_name,
        customer_email,
        customer_phone,
        postcode,
        address,
        job_type,
        urgency,
        details
      `)
      .eq("id", finalRequestId)
      .eq("plumber_id", uid)
      .maybeSingle();

    if (enquiryErr) {
      throw new Error(`Enquiry load failed: ${enquiryErr.message}`);
    }

    if (!enquiry) {
      return NextResponse.json(
        { ok: false, error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const { data: items, error: itemsErr } = await admin
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", estimate.id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      throw new Error(`Estimate items load failed: ${itemsErr.message}`);
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("display_name, business_name, slug, logo_url")
      .eq("id", uid)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`Profile load failed: ${profileErr.message}`);
    }

    const to = String(
      enquiry.customer_email || estimate.customer_email || ""
    ).trim();

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Customer email missing on enquiry/estimate" },
        { status: 400 }
      );
    }

    const traderName =
      String(profile?.business_name || "").trim() ||
      String(profile?.display_name || "").trim() ||
      String(profile?.slug || "").trim() ||
      "Your trader";

    const subtotal = Number(estimate.subtotal || 0);
    const vat = Number(estimate.vat || 0);
    const total = Number(estimate.total || 0);

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        { ok: false, error: "Estimate total must be greater than £0" },
        { status: 400 }
      );
    }

    const createdText = safeDate(estimate.created_at);
    const validUntilText = safeDate(estimate.valid_until);
    const jobTypeText = titleCase(estimate.job_type || enquiry.job_type || "Estimate");
    const customerName =
      estimate.customer_name || enquiry.customer_name || "there";

    const customerMessage =
      customerNoteIn || String(estimate.customer_message || "").trim();

    const pdfBuffer = await renderEstimatePdfBuffer({
      estimate: {
        ...estimate,
        job_number: enquiry.job_number ?? null,
        customer_name: estimate.customer_name ?? enquiry.customer_name ?? null,
        customer_email: estimate.customer_email ?? enquiry.customer_email ?? null,
        customer_phone: estimate.customer_phone ?? enquiry.customer_phone ?? null,
        postcode: estimate.postcode ?? enquiry.postcode ?? null,
        address: estimate.address ?? enquiry.address ?? null,
        job_type: estimate.job_type ?? enquiry.job_type ?? null,
        enquiry_details:
          estimate.enquiry_details || enquiry.details || "",
        customer_message: customerMessage || estimate.customer_message || null,
      },
      items: items || [],
      profile,
    });

    if (!pdfBuffer || pdfBuffer.length < 500) {
      throw new Error("PDF render returned empty/too small buffer");
    }

    const savedPdf = await saveEstimatePdfToJobFiles({
      admin,
      requestId: finalRequestId,
      plumberId: uid,
      fileBase:
        String(enquiry.job_number || "").trim() ||
        String(estimate.id).slice(0, 8),
      pdfBuffer,
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const resend = new Resend(resendKey);

    const from =
      process.env.RESEND_FROM ||
      process.env.EMAIL_FROM ||
      "FixFlow <quotes@send.thefixflowapp.com>";

    const replyTo =
      process.env.RESEND_REPLY_TO ||
      process.env.EMAIL_REPLY_TO ||
      "hello@thefixflowapp.com";

    const subject = subjectIn || `Your estimate from ${traderName}`;

    const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "https://thefixflowapp.com";

    const acceptUrl = `${appUrl.replace(/\/$/, "")}/estimate/${estimate.id}/accept`;

    const itemRowsHtml = (items || [])
      .map((item: any) => {
        const title = String(item.title || "Item").trim();
        const description = String(item.description || "").trim();
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal =
          Number(item.line_total || 0) || quantity * unitPrice;

        return `
          <div style="padding:16px 18px; border-bottom:1px solid #E6ECF5;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
              <div style="min-width:0; flex:1;">
                <div style="font-size:14px; font-weight:800; color:#0B1320;">
                  ${escapeEmailHtml(title)}
                </div>
                ${
                  description
                    ? `<div style="font-size:12px; line-height:1.6; color:#5C6B84; margin-top:4px;">
                        ${escapeEmailHtml(description)}
                      </div>`
                    : ""
                }
                ${
                  quantity
                    ? `<div style="font-size:12px; color:#5C6B84; margin-top:4px;">
                        Qty: ${escapeEmailHtml(String(quantity))}${
                        unitPrice ? ` · ${escapeEmailHtml(money(unitPrice))} each` : ""
                      }
                      </div>`
                    : ""
                }
              </div>
              <div style="font-size:14px; font-weight:800; color:#0B1320; white-space:nowrap;">
                ${escapeEmailHtml(money(lineTotal))}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const safeCustomerName = escapeEmailHtml(customerName);
    const safeTraderName = escapeEmailHtml(traderName);
    const safeJobTypeText = escapeEmailHtml(jobTypeText);
    const safeJobHeader = escapeEmailHtml(
      [enquiry.job_number || null, jobTypeText].filter(Boolean).join(" · ") || "Estimate"
    );
    const safeMeta = escapeEmailHtml(
      [customerName, formatPostcode(estimate.postcode || enquiry.postcode || "")]
        .filter(Boolean)
        .join(" · ")
    );
    const safeCustomerMessage = escapeEmailHtml(customerMessage);
    const safeEnquiryDetails = escapeEmailHtml(
      String(estimate.enquiry_details || enquiry.details || "")
    );
    const safeCreatedText = escapeEmailHtml(createdText);
    const safeValidUntilText = escapeEmailHtml(validUntilText);

    const html = buildFixFlowEmail({
      title: "Estimate ready",
      introHtml: `
        <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
          Hi ${safeCustomerName},
        </div>

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          Here is your estimate for <strong style="color:#0B1320;">${safeJobTypeText.toLowerCase()}</strong>.
        </div>
      `,
      bodyHtml: `
        ${buildFixFlowInfoCard(`
          <div style="padding:18px 18px 16px 18px; border-bottom:1px solid #E6ECF5;">
            ${buildFixFlowSectionLabel("Estimate")}
            <div style="font-size:18px; font-weight:800; color:#1F355C; margin-bottom:6px;">
              ${safeJobHeader}
            </div>
            ${
              safeMeta
                ? `<div style="font-size:13px; color:#5C6B84;">${safeMeta}</div>`
                : ""
            }
            ${
              safeCreatedText
                ? `<div style="font-size:12px; font-weight:700; color:#5C6B84; margin-top:8px;">
                    Created ${safeCreatedText}
                  </div>`
                : ""
            }
          </div>

          <div style="padding:18px; border-bottom:1px solid #E6ECF5;">
            <div style="font-size:22px; font-weight:900; color:#0B1320; margin-bottom:8px;">
              ${escapeEmailHtml(money(total))}
            </div>
            ${
              safeValidUntilText
                ? `<div style="font-size:12px; font-weight:700; color:#5C6B84;">
                    Valid until ${safeValidUntilText}
                  </div>`
                : ""
            }
            ${
              safeCustomerMessage
                ? `<div style="margin-top:12px; font-size:14px; line-height:1.7; color:#5C6B84; white-space:pre-wrap;">
                    ${safeCustomerMessage}
                  </div>`
                : ""
            }
          </div>

          ${
            itemRowsHtml
              ? `
                <div style="padding:16px 18px 0 18px;">
                  ${buildFixFlowSectionLabel("Included in this estimate")}
                </div>
                ${itemRowsHtml}
              `
              : ""
          }

          <div style="padding:16px 18px;">
            ${buildFixFlowSectionLabel("Price breakdown")}
            <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #E6ECF5;">
              <span style="color:#5C6B84; font-size:14px;">Subtotal</span>
              <span style="font-weight:700; font-size:14px; color:#0B1320;">${escapeEmailHtml(
                money(subtotal)
              )}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #E6ECF5;">
              <span style="color:#5C6B84; font-size:14px;">VAT</span>
              <span style="font-weight:700; font-size:14px; color:#0B1320;">${escapeEmailHtml(
                money(vat)
              )}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; padding:14px 0 4px;">
              <span style="color:#0B1320; font-size:18px; font-weight:800;">Total</span>
              <span style="color:#0B1320; font-size:22px; font-weight:900;">${escapeEmailHtml(
                money(total)
              )}</span>
            </div>
          </div>
        `)}

        ${
          safeEnquiryDetails
            ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border-collapse:collapse;">
                <tr>
                  <td style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#5C6B84; padding:0 0 10px 0;">
                    Job details
                  </td>
                </tr>
                <tr>
                  <td style="border:1px solid #E6ECF5; border-radius:16px; background:#F4F7FF; padding:22px 24px; text-align:center;">
                   <div style="max-width:420px; margin:0 auto; font-size:15px; line-height:1.7; color:#0B1320; white-space:pre-wrap; text-align:center;">
  ${safeEnquiryDetails}
</div>
                  </td>
                </tr>
              </table>
            `
            : ""
        }

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          Your PDF estimate is attached to this email.
        </div>
      `,
      ctaHtml: buildFixFlowButton("Accept estimate", acceptUrl),
      closingHtml: `
        <div style="font-size:15px; line-height:1.7; color:#5C6B84;">
          Thanks,<br />
          <span style="font-weight:800; color:#1F355C;">${safeTraderName}</span>
        </div>
      `,
    });

    const textLines = [
      `Hi ${customerName},`,
      ``,
      `Here is your estimate for ${jobTypeText.toLowerCase()}.`,
      ``,
    ];

    if (items && items.length) {
      textLines.push(`Included items:`);
      for (const item of items as any[]) {
        const title = String(item.title || "Item").trim();
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal =
          Number(item.line_total || 0) || quantity * unitPrice;

        textLines.push(
          `- ${title}${quantity ? ` (x${quantity})` : ""}: ${money(lineTotal)}`
        );
      }
      textLines.push(``);
    }

    textLines.push(
      `Subtotal: ${money(subtotal)}`,
      `VAT: ${money(vat)}`,
      `Total: ${money(total)}`
    );

    if (validUntilText) {
      textLines.push(`Valid until: ${validUntilText}`);
    }

    if (customerMessage) {
      textLines.push(``, customerMessage);
    }

    textLines.push(
      ``,
      `Accept estimate: ${acceptUrl}`,
      ``,
      `Thanks,`,
      traderName
    );

    const text = textLines.filter(Boolean).join("\n");

    const fileNameBase =
      String(enquiry.job_number || "").trim() ||
      String(estimate.id).slice(0, 8) ||
      "estimate";

    const sent = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
      attachments: [
        {
          filename: `${safeFileBase(fileNameBase) || "estimate"}.pdf`,
          content: pdfBuffer.toString("base64"),
          contentType: "application/pdf",
        },
      ],
    });

    const resendError = (sent as any)?.error;
    if (resendError) {
      throw new Error(resendError.message || "Resend failed");
    }

    const { error: logError } = await admin.from("enquiry_messages").insert({
      request_id: finalRequestId,
      plumber_id: uid,
      direction: "out",
      channel: "estimate",
      subject,
      body_text: text,
      from_email: from,
      to_email: to,
      resend_id: sent.data?.id ?? null,
    });

    if (logError) {
      console.warn("Failed to log estimate email:", logError.message);
    }

    const { error: updateEstimateErr } = await admin
      .from("estimates")
      .update({
        status: "sent",
      })
      .eq("id", estimate.id)
      .eq("plumber_id", uid);

    if (updateEstimateErr) {
      throw new Error(`Estimate status update failed: ${updateEstimateErr.message}`);
    }

    return NextResponse.json({
      ok: true,
      sent,
      status: "sent",
      savedPdf,
      estimateId: estimate.id,
      requestId: finalRequestId,
    });
  } catch (e: any) {
    console.error("send estimate crashed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Send failed" },
      { status: 500 }
    );
  }
}