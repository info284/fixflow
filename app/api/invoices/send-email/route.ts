export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { cookies } from "next/headers";
import { renderInvoicePdfBuffer } from "@/lib/invoices/renderInvoicePdf";
import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
  escapeEmailHtml,
} from "@/lib/emails/fixflowEmail";

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

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function supabaseAnonForAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

function formatMoney(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount || 0);
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
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
    const invoiceId = cleanId(body?.invoiceId);
    const subjectIn = String(body?.subject || "").trim();

    if (!invoiceId || !isUuid(invoiceId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid invoiceId" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const { data: inv, error: invErr } = await admin
      .from("invoices")
      .select(`
        id,
        user_id,
        request_id,
        invoice_number,
        amount,
        currency,
        status,
        notes,
        created_at,
        updated_at,
        issued_at,
        due_at,
        to_email,
        subtotal,
        vat_rate
      `)
      .eq("id", invoiceId)
      .eq("user_id", uid)
      .maybeSingle();

    if (invErr) throw new Error(`Invoice load failed: ${invErr.message}`);

    if (!inv) {
      return NextResponse.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    const to = String(inv.to_email || "").trim();

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Customer email missing on invoice" },
        { status: 400 }
      );
    }

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("display_name, slug, logo_url, business_name, vat_number")
      .eq("id", uid)
      .maybeSingle();

    if (profErr) throw new Error(`Profile load failed: ${profErr.message}`);

    const traderName =
      String(prof?.business_name || "").trim() ||
      String(prof?.display_name || "").trim() ||
      String(prof?.slug || "").trim() ||
      "Your trader";

    let linkedRequest: any = null;
    let enquiryDetails = "";
    let enquiryAddress = "";

    const rqId = cleanId(inv.request_id);
    if (rqId && isUuid(rqId)) {
      const { data: rq, error: rqErr } = await admin
        .from("quote_requests")
        .select(
          "id, job_number, customer_name, customer_email, customer_phone, postcode, address, job_type, details"
        )
        .eq("id", rqId)
        .eq("plumber_id", uid)
        .maybeSingle();

      if (rqErr) throw new Error(`Enquiry load failed: ${rqErr.message}`);

      linkedRequest = rq || null;
      enquiryDetails = String((rq as any)?.details || "").trim();
      enquiryAddress = String((rq as any)?.address || "").trim();
    }

    const amount = Number(inv.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invoice amount must be greater than £0" },
        { status: 400 }
      );
    }

    const currency = String(inv.currency || "GBP");
    const sentAtISO = new Date().toISOString();
    const refDefault = String(inv.id).slice(0, 8);

    const subtotalAmount =
      inv.subtotal != null ? Number(inv.subtotal) : Number(inv.amount ?? 0);

    const vatRate = inv.vat_rate != null ? Number(inv.vat_rate) : 0;
    const vatAmount =
      vatRate > 0 ? Number((subtotalAmount * (vatRate / 100)).toFixed(2)) : 0;
    const totalAmount = Number(inv.amount ?? 0);

    const invoiceForPdf = {
      id: inv.id,
      invoice_number: inv.invoice_number,
      created_at: inv.created_at,
      issued_at: inv.issued_at,
      due_at: inv.due_at,
      to_email: inv.to_email,
      notes: inv.notes,
      status: inv.status,
      currency,

      subtotal: subtotalAmount,
      vat_rate: vatRate,
      amount: totalAmount,

      trader_ref: inv.invoice_number || refDefault,
      job_number: linkedRequest?.job_number || "",

      customer_name: linkedRequest?.customer_name || "Customer",
      customer_email: linkedRequest?.customer_email || inv.to_email || "",
      customer_phone: linkedRequest?.customer_phone || "",
      postcode: linkedRequest?.postcode || "",
      address: linkedRequest?.address || "",
      job_type: linkedRequest?.job_type || "Invoice",

      job_details:
        enquiryDetails || enquiryAddress || String(inv.notes || "").trim() || "—",
    };

    const pdfBuffer = await renderInvoicePdfBuffer({
      invoice: invoiceForPdf,
      profile: prof,
      fallbackEnquiryDetails: enquiryDetails || enquiryAddress || "",
    });

    if (!pdfBuffer || pdfBuffer.length < 500) {
      throw new Error("PDF render returned empty/too small buffer");
    }

    const pdfFileName = `invoice-${String(inv.id).slice(0, 8)}.pdf`;
    const pdfPath = `invoices/${uid}/${pdfFileName}`;

    const up = await admin.storage.from("quote-files").upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (up.error) throw new Error(`PDF upload failed: ${up.error.message}`);

    const { data: signedPdf, error: signedErr } = await admin.storage
      .from("quote-files")
      .createSignedUrl(pdfPath, 60 * 60 * 24 * 7);

    if (signedErr || !signedPdf?.signedUrl) {
      throw new Error(
        `PDF signed URL failed: ${signedErr?.message || "No signedUrl"}`
      );
    }

    const pdfDownloadUrl = signedPdf.signedUrl;

    const customerName = String(linkedRequest?.customer_name || "there").trim();
    const invoiceNumber = String(inv.invoice_number || refDefault).trim();
    const dueDateText = formatDate(inv.due_at);
    const notesText =
      typeof inv.notes === "string" && inv.notes.trim()
        ? inv.notes.trim()
        : "Please use the invoice reference when making payment.";

    const safeCustomerName = escapeEmailHtml(customerName);
    const safeTraderName = escapeEmailHtml(traderName);
    const safeInvoiceNumber = escapeEmailHtml(invoiceNumber);
    const safeDueDate = escapeEmailHtml(dueDateText);
    const safeNotes = escapeEmailHtml(notesText);

    const html = buildFixFlowEmail({
      title: "Invoice ready",
      introHtml: `
        <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
          Hi ${safeCustomerName},
        </div>

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          Your invoice from <strong style="color:#0B1320;">${safeTraderName}</strong> is ready.
        </div>
      `,
      bodyHtml: `
        ${buildFixFlowInfoCard(`
          <div style="padding:16px 18px; border-bottom:1px solid #E6ECF5;">
            ${buildFixFlowSectionLabel("Invoice number")}
            <div style="font-size:18px; font-weight:800; color:#1F355C;">
              ${safeInvoiceNumber}
            </div>
          </div>

          <div style="padding:16px 18px; border-bottom:1px solid #E6ECF5;">
            <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #E6ECF5;">
              <span style="color:#5C6B84; font-size:14px;">Subtotal</span>
              <span style="font-weight:700; font-size:14px; color:#0B1320;">${escapeEmailHtml(
                formatMoney(subtotalAmount, currency)
              )}</span>
            </div>

            <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #E6ECF5;">
              <span style="color:#5C6B84; font-size:14px;">VAT${
                vatRate > 0 ? ` (${vatRate}%)` : ""
              }</span>
              <span style="font-weight:700; font-size:14px; color:#0B1320;">${escapeEmailHtml(
                formatMoney(vatAmount, currency)
              )}</span>
            </div>

            <div style="display:flex; justify-content:space-between; gap:12px; padding:14px 0 4px;">
              <span style="color:#0B1320; font-size:18px; font-weight:800;">Total due</span>
              <span style="color:#0B1320; font-size:22px; font-weight:900;">${escapeEmailHtml(
                formatMoney(totalAmount, currency)
              )}</span>
            </div>
          </div>

          <div style="padding:18px;">
            ${buildFixFlowSectionLabel("Due date")}
            <div style="font-size:18px; font-weight:800; color:#0B1320;">
              ${safeDueDate}
            </div>
          </div>
        `)}

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border-collapse:collapse;">
          <tr>
            <td style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#5C6B84; padding:0 0 10px 0;">
              Notes
            </td>
          </tr>
          <tr>
            <td style="border:1px solid #E6ECF5; border-radius:16px; background:#F4F7FF; padding:22px 24px; text-align:center;">
              <div style="max-width:340px; margin:0 auto; font-size:15px; line-height:1.7; color:#0B1320;">
                ${safeNotes}
              </div>
            </td>
          </tr>
        </table>

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          A PDF copy of your invoice is attached and also available using the button below.
        </div>
      `,
      ctaHtml: buildFixFlowButton("Download invoice", pdfDownloadUrl),
      closingHtml: `
        <div style="font-size:15px; line-height:1.7; color:#5C6B84;">
          Thanks,<br />
          <span style="font-weight:800; color:#1F355C;">${safeTraderName}</span>
        </div>
      `,
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error("Missing RESEND_API_KEY");

    const from =
      process.env.RESEND_FROM ||
      process.env.EMAIL_FROM ||
      "FixFlow <onboarding@resend.dev>";

    const subject = subjectIn || `Invoice ${invoiceNumber} from ${traderName}`;

    const resend = new Resend(resendKey);

    const sent = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text: `Hi ${customerName},

Your invoice from ${traderName} is ready.

Invoice number: ${invoiceNumber}
Subtotal: ${formatMoney(subtotalAmount, currency)}
VAT${vatRate > 0 ? ` (${vatRate}%)` : ""}: ${formatMoney(vatAmount, currency)}
Total due: ${formatMoney(totalAmount, currency)}
Due date: ${dueDateText}

Download invoice:
${pdfDownloadUrl}

Notes:
${notesText}

Thanks,
${traderName}`,
      attachments: [
        {
          filename: `invoice-${String(inv.id).slice(0, 8)}.pdf`,
          content: pdfBuffer.toString("base64"),
          contentType: "application/pdf",
        },
      ],
    });

    const update1 = await admin
      .from("invoices")
      .update({ status: "sent", issued_at: sentAtISO })
      .eq("id", inv.id)
      .eq("user_id", uid);

    if (update1.error) {
      await admin
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", inv.id)
        .eq("user_id", uid);
    }

    return NextResponse.json({
      ok: true,
      sent,
      sent_at: sentAtISO,
      pdfDownloadUrl,
    });
  } catch (e: any) {
    console.error("❌ invoice send-email crashed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Send failed" },
      { status: 500 }
    );
  }
}