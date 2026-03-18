export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { cookies } from "next/headers";
import crypto from "crypto";
import { renderEstimatePdfBuffer } from "@/lib/estimates/renderEstimatePdf";

/* ---------------- helpers ---------------- */

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function cleanId(v?: string | null) {
  const s = String(v || "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function supabaseAnonForAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

async function getAuthedUserId(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  const c = await cookies();
  const cookieToken = c.get("sb-access-token")?.value || c.get("supabase-auth-token")?.value || "";

  const accessToken = bearer || cookieToken;
  if (!accessToken) return null;

  const anon = supabaseAnonForAuth();
  const { data, error } = await anon.auth.getUser(accessToken);
  if (error || !data?.user?.id) return null;

  return data.user.id;
}

function getBaseUrl(req: Request) {
  // you already set NEXT_PUBLIC_SITE_URL in .env.local – great
  const env = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (env) return env.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`.replace(/\/$/, "");
}

/* ---------------- route ---------------- */

export async function POST(req: Request) {
  try {
    console.log("✅ send-email: start");

    const uid = await getAuthedUserId(req);
    if (!uid) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const quoteId = cleanId(body?.quoteId);
    const subjectIn = String(body?.subject || "").trim();
    const customerNote = String(body?.customerNote || "").trim();

    if (!quoteId || !isUuid(quoteId)) {
      return NextResponse.json({ ok: false, error: "Invalid quoteId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    console.log("✅ send-email: load quote");
    const { data: q, error: qErr } = await admin
      .from("quotes")
      .select(
        "id, plumber_id, request_id, customer_email, postcode, address, job_type, vat_rate, subtotal, note, job_details, accept_token"
      )
      .eq("id", quoteId)
      .eq("plumber_id", uid)
      .maybeSingle();

    if (qErr) throw new Error(`Quote load failed: ${qErr.message}`);
    if (!q) return NextResponse.json({ ok: false, error: "Quote not found" }, { status: 404 });

    const to = String(q.customer_email || "").trim();
    if (!to) return NextResponse.json({ ok: false, error: "Customer email missing on quote" }, { status: 400 });

    // token
    let acceptToken = String(q.accept_token || "").trim();
    if (!acceptToken) {
      acceptToken = crypto.randomBytes(24).toString("hex");
      const upTok = await admin.from("quotes").update({ accept_token: acceptToken }).eq("id", q.id).eq("plumber_id", uid);
      if (upTok.error) throw new Error(`accept_token update failed: ${upTok.error.message}`);
    }

    console.log("✅ send-email: load profile");
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("display_name, slug, logo_url")
      .eq("id", uid)
      .maybeSingle();

    if (profErr) throw new Error(`Profile load failed: ${profErr.message}`);

    const traderName = String(prof?.display_name || "").trim() || String(prof?.slug || "").trim() || "Your trader";
    const logoUrl = String(prof?.logo_url || "").trim();

    const baseUrl = getBaseUrl(req);
    const acceptUrl = `${baseUrl}/accept?quoteId=${encodeURIComponent(q.id)}&token=${encodeURIComponent(acceptToken)}`;

    // enquiry
    const rqId = cleanId(q.request_id);
    const hasRq = !!(rqId && isUuid(rqId));

    let enquiryDetails = "";
    let enquiryAddress = "";

    if (hasRq) {
      console.log("✅ send-email: load enquiry");
      const { data: rq, error: rqErr2 } = await admin
        .from("quote_requests")
        .select("details, address")
        .eq("id", rqId)
        .eq("plumber_id", uid)
        .maybeSingle();

      if (rqErr2) throw new Error(`Enquiry load failed: ${rqErr2.message}`);
      enquiryDetails = String(rq?.details || "");
      enquiryAddress = String(rq?.address || "");
    }

    // subtotal check
    const subtotal = Number(q.subtotal || 0);
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return NextResponse.json({ ok: false, error: "Estimate subtotal must be greater than £0" }, { status: 400 });
    }

    // PDF
    const sentAtISO = new Date().toISOString();

    const pdfBuffer = await renderEstimatePdfBuffer({
  quote: q,
  profile: prof,
  fallbackEnquiryDetails: enquiryDetails || enquiryAddress || "",
});

    if (!pdfBuffer || pdfBuffer.length < 500) {
      throw new Error("PDF render returned empty/too small buffer");
    }

    // Upload PDF + signed link (ONCE)
    const pdfFileName = `estimate-${String(q.id).slice(0, 8)}.pdf`;
    const pdfPath = `estimates/${uid}/${pdfFileName}`;

    console.log("✅ send-email: upload PDF", pdfPath);
    const up = await admin.storage.from("quote-files").upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (up.error) throw new Error(`PDF upload failed: ${up.error.message}`);

    console.log("✅ send-email: signed url");
    const { data: signedPdf, error: signedErr } = await admin.storage
      .from("quote-files")
      .createSignedUrl(pdfPath, 60 * 60 * 24 * 7);

    if (signedErr || !signedPdf?.signedUrl) {
      throw new Error(`PDF signed URL failed: ${signedErr?.message || "No signedUrl"}`);
    }

    const pdfDownloadUrl = signedPdf.signedUrl;

    // Email HTML (simple + iPhone friendly)
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
font-size:15px;line-height:1.6;color:#111;background:#fff;max-width:680px;margin:0 auto;padding:18px;">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
    ${
      logoUrl
        ? `<img src="${logoUrl}" alt="${escapeHtml(traderName)}"
           style="height:44px;width:44px;object-fit:contain;border-radius:10px;border:1px solid #eee;background:#fff;" />`
        : ""
    }
    <div>
      <div style="font-size:18px;font-weight:700;">${escapeHtml(traderName)}</div>
      <div style="font-size:13px;color:#666;">Estimate</div>
    </div>
  </div>

  <div style="font-size:12px;color:#666;margin-bottom:12px;">
    <b>Estimate sent:</b> ${new Date(sentAtISO).toLocaleString()}
  </div>

  <div style="margin-bottom:16px;">
    <a href="${pdfDownloadUrl}" style="display:inline-block;background:#1f355c;color:#fff;
    text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;">
      Download estimate (PDF)
    </a>
  </div>

  ${
    customerNote
      ? `<div style="background:#f7f7f7;border:1px solid #eee;padding:14px;border-radius:12px;margin-bottom:16px;white-space:pre-wrap;">${escapeHtml(
          customerNote
        )}</div>`
      : ""
  }

  <div style="margin:18px 0 10px;">
    <a href="${acceptUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
    padding:12px 16px;border-radius:12px;font-weight:700;">Accept estimate</a>
    <div style="margin-top:8px;font-size:12px;color:#777;">No payment required yet.</div>
  </div>

  <div style="margin-top:26px;font-size:12px;color:#999;">Powered by FixFlow</div>
</div>
`;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error("Missing RESEND_API_KEY");

    const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "FixFlow <onboarding@resend.dev>";
    const subject = subjectIn || `Your estimate from ${traderName}`;
    const resend = new Resend(resendKey);

    console.log("✅ send-email: resend send");
   const sent = await resend.emails.send({
  from,
  to,
  subject,
  html,
  text: `Download your estimate (PDF): ${pdfDownloadUrl}\n\nAccept estimate: ${acceptUrl}`,
  attachments: [
    {
      filename: `estimate-${String(q.id).slice(0, 8)}.pdf`,
      content: pdfBuffer.toString("base64"),
      contentType: "application/pdf",
    },
  ],
});

    console.log("✅ send-email: update quote sent status");
    const update1 = await admin
      .from("quotes")
      .update({ status: "sent", sent_at: sentAtISO })
      .eq("id", q.id)
      .eq("plumber_id", uid);

    if (update1.error) {
      await admin.from("quotes").update({ status: "sent" }).eq("id", q.id).eq("plumber_id", uid);
    }

    return NextResponse.json({ ok: true, sent, sent_at: sentAtISO, pdfDownloadUrl });
  } catch (e: any) {
    console.error("❌ send-email crashed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Send failed" },
      { status: 500 }
    );
  }
}