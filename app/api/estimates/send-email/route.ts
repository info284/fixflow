export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { cookies } from "next/headers";
import crypto from "crypto";

// IMPORTANT: standalone build avoids Helvetica.afm ENOENT in Next bundling
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFKit = require("pdfkit/js/pdfkit.standalone");
// Fix "PDFDocument is not a constructor" (Next can wrap CommonJS exports)
const PDFDocument = PDFKit?.default ?? PDFKit;

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
 const serviceKey =
 process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
 return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function supabaseAnonForAuth() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
 const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 return createClient(url, anon, { auth: { persistSession: false } });
}

async function getAuthedUserId(req: Request) {
 // 1) Authorization header
 const authHeader = req.headers.get("authorization") || "";
 const bearer = authHeader.toLowerCase().startsWith("bearer ")
 ? authHeader.slice(7).trim()
 : "";

 // 2) Cookie fallback (Next 15: cookies() is async)
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

async function listSignedLinks(
 admin: ReturnType<typeof supabaseAdmin>,
 folder: string
) {
 const bucket = "quote-files";
 const { data: list, error } = await admin.storage
 .from(bucket)
 .list(folder, { limit: 100 });

 if (error || !Array.isArray(list)) return [];

 const links: { name: string; url: string }[] = [];
 for (const f of list) {
 if (!f?.name || f.name === ".emptyFolderPlaceholder") continue;
 const filePath = `${folder}/${f.name}`;
 const { data: signed } = await admin.storage
 .from(bucket)
 .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days
 if (signed?.signedUrl) links.push({ name: f.name, url: signed.signedUrl });
 }
 return links;
}

/* ---------------- PDF builder ---------------- */

async function buildEstimatePdf(opts: {
 traderName: string;
 customerEmail: string;
 sentAtISO: string;

 postcode: string;
 jobType: string;
 address: string;

 enquiryDetails: string;
 jobDetails: string;

 subtotal: number;
 vatRate: number;
 vat: number;
 total: number;

 note: string;
 acceptUrl: string;

 traderLinks: { name: string; url: string }[];
 customerLinks: { name: string; url: string }[];
}) {
 const doc = new PDFDocument({
 size: "A4",
 margin: 50,
 });

 const chunks: Buffer[] = [];
 const bufferPromise = new Promise<Buffer>((resolve, reject) => {
 doc.on("data", (d: Buffer) => chunks.push(d));
 doc.on("end", () => resolve(Buffer.concat(chunks)));
 doc.on("error", reject);
 });

 // Standalone build has fonts bundled – safe to use
 doc.font("Helvetica");

 const sentNice = new Date(opts.sentAtISO).toLocaleString();

 // Header
 doc.fontSize(20).fillColor("#111").text(opts.traderName || "FixFlow Trader");
 doc.moveDown(0.4);

 doc.fontSize(10).fillColor("#555").text(`Estimate sent: ${sentNice}`);
 doc.text(`Customer: ${opts.customerEmail || "—"}`);
 doc.moveDown(0.8);

 // Job details
 doc.fontSize(13).fillColor("#111").text("Job details");
 doc.moveDown(0.25);

 doc.fontSize(11).fillColor("#333").text(`Postcode: ${opts.postcode || "—"}`);
 doc.text(`Trade: ${opts.jobType || "—"}`);
 if ((opts.address || "").trim()) doc.text(`Address: ${opts.address}`);
 doc.moveDown(0.6);

 const block = (label: string, value: string) => {
 const v = (value || "").trim();
 if (!v) return;
 doc.fontSize(11).fillColor("#111").text(label);
 doc.fontSize(11).fillColor("#333").text(v, { width: 520 });
 doc.moveDown(0.5);
 };

 block("Customer message:", opts.enquiryDetails);
 block("Your estimate details:", opts.jobDetails);

 // Price
 doc.fontSize(13).fillColor("#111").text("Price");
 doc.moveDown(0.25);

 doc.fontSize(11).fillColor("#333").text(`Subtotal: £${opts.subtotal.toFixed(2)}`);
 doc.text(`VAT (${opts.vatRate}%): £${opts.vat.toFixed(2)}`);
 doc.fontSize(12).fillColor("#111").text(`Total: £${opts.total.toFixed(2)}`);
 doc.moveDown(0.7);

 if ((opts.note || "").trim()) {
 doc.fontSize(11).fillColor("#111").text("Note:");
 doc.fontSize(11).fillColor("#333").text(opts.note);
 doc.moveDown(0.7);
 }

 // Accept link
 doc.fontSize(12).fillColor("#111").text("Accept estimate:");
 doc
 .fontSize(10)
 .fillColor("#1a73e8")
 .text(opts.acceptUrl, { link: opts.acceptUrl, underline: true });
 doc.moveDown(0.3);
 doc.fontSize(9).fillColor("#555").text("No payment required yet.");
 doc.moveDown(0.8);

 const linksSection = (title: string, links: { name: string; url: string }[]) => {
 if (!links?.length) return;
 doc.fontSize(11).fillColor("#111").text(title);
 doc.moveDown(0.2);
 doc.fontSize(10).fillColor("#1a73e8");
 for (const l of links) doc.text(l.name, { link: l.url, underline: true });
 doc.fillColor("#333");
 doc.moveDown(0.6);
 };

 linksSection("Attachments from your trader (links):", opts.traderLinks);
 linksSection("Your original attachments (links):", opts.customerLinks);

 doc.fontSize(9).fillColor("#999").text("Powered by FixFlow");

 doc.end();
 return bufferPromise;
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
 const quoteId = cleanId(body?.quoteId);
 const subjectIn = String(body?.subject || "").trim();
 const customerNote = String(body?.customerNote || "").trim();

 if (!quoteId || !isUuid(quoteId)) {
 return NextResponse.json({ ok: false, error: "Invalid quoteId" }, { status: 400 });
 }

 const admin = supabaseAdmin();

 const { data: q, error: qErr } = await admin
 .from("quotes")
 .select(
 "id, plumber_id, request_id, customer_email, postcode, address, job_type, vat_rate, subtotal, note, job_details, accept_token"
 )
 .eq("id", quoteId)
 .eq("plumber_id", uid)
 .maybeSingle();

 if (qErr) return NextResponse.json({ ok: false, error: qErr.message }, { status: 500 });
 if (!q) return NextResponse.json({ ok: false, error: "Quote not found" }, { status: 404 });

 const to = String(q.customer_email || "").trim();
 if (!to) {
 return NextResponse.json(
 { ok: false, error: "Customer email missing on quote" },
 { status: 400 }
 );
 }

 // accept token
 let acceptToken = String(q.accept_token || "").trim();
 if (!acceptToken) {
 acceptToken = crypto.randomBytes(24).toString("hex");
 await admin
 .from("quotes")
 .update({ accept_token: acceptToken })
 .eq("id", q.id)
 .eq("plumber_id", uid);
 }

 const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
 const acceptUrl = `${siteUrl}/estimate/accept/${acceptToken}`;

 // branding
 const { data: prof } = await admin
 .from("profiles")
 .select("display_name, logo_url")
 .eq("id", uid)
 .maybeSingle();

 const traderName = String(prof?.display_name || "Your trader").trim();
 const logoUrl = String(prof?.logo_url || "").trim();

 // enquiry + attachments
 const rqId = cleanId(q.request_id);
 const hasRq = rqId && isUuid(rqId);

 let enquiryDetails = "";
 let enquiryAddress = "";

 if (hasRq) {
 const { data: rq } = await admin
 .from("quote_requests")
 .select("details, address")
 .eq("id", rqId)
 .eq("plumber_id", uid)
 .maybeSingle();

 enquiryDetails = String(rq?.details || "");
 enquiryAddress = String(rq?.address || "");
 }

 const traderLinks = hasRq ? await listSignedLinks(admin, `quote/${rqId}/trader`) : [];
 const customerLinks = hasRq ? await listSignedLinks(admin, `request/${rqId}/customer`) : [];

 // totals
 const subtotal = Number(q.subtotal || 0);
 if (subtotal <= 0) {
 return NextResponse.json(
 { ok: false, error: "Estimate subtotal must be greater than £0" },
 { status: 400 }
 );
 }

 const vatRate = q.vat_rate === 20 ? 20 : 0;
 const vat = subtotal * (vatRate / 100);
 const total = subtotal + vat;

 // resend
 const resendKey = process.env.RESEND_API_KEY;
 if (!resendKey) {
 return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
 }

 const from =
 process.env.RESEND_FROM ||
 process.env.EMAIL_FROM ||
 "FixFlow <onboarding@resend.dev>";

 const subject = subjectIn || `Your estimate from ${traderName}`;
 const resend = new Resend(resendKey);

 const sentAtISO = new Date().toISOString();

 // PDF
 const pdfBuffer = await buildEstimatePdf({
 traderName,
 customerEmail: to,
 sentAtISO,
 postcode: String(q.postcode || ""),
 jobType: String(q.job_type || ""),
 address: String(enquiryAddress || q.address || ""),
 enquiryDetails,
 jobDetails: String(q.job_details || ""),
 subtotal,
 vatRate,
 vat,
 total,
 note: String(q.note || ""),
 acceptUrl,
 traderLinks,
 customerLinks,
 });

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

 <div style="background:#f7f7f7;border:1px solid #eee;padding:12px;border-radius:12px;margin-bottom:16px;">
 <b>PDF attached:</b> your estimate is included as a PDF attachment in this email.
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

 const sent = await resend.emails.send({
 from,
 to,
 subject,
 html,
 attachments: [
 {
 filename: `estimate-${String(q.id).slice(0, 8)}.pdf`,
 content: pdfBuffer.toString("base64"),
 contentType: "application/pdf",
 },
 ],
 });

 // update status + try sent_at (fallback if column doesn't exist)
 const update1 = await admin
 .from("quotes")
 .update({ status: "sent", sent_at: sentAtISO })
 .eq("id", q.id)
 .eq("plumber_id", uid);

 if (update1.error) {
 await admin.from("quotes").update({ status: "sent" }).eq("id", q.id).eq("plumber_id", uid);
 }

 return NextResponse.json({ ok: true, sent, sent_at: sentAtISO });
 } catch (e: any) {
 return NextResponse.json(
 { ok: false, error: e?.message || "Send failed" },
 { status: 500 }
 );
 }
}