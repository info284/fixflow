export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAnonWithToken(token: string) {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, anon, {
auth: { persistSession: false },
global: { headers: { Authorization: `Bearer ${token}` } },
});
}

function supabaseService() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service =
process.env.SUPABASE_SERVICE_ROLE_KEY ||
process.env.SUPABASE_SERVICE_ROLE ||
"";
if (!service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in env");
return createClient(url, service, { auth: { persistSession: false } });
}

function escapeHtml(input: string) {
return (input || "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}

function normalizeOutward(input: string) {
const trimmed = (input || "").trim().toUpperCase();
const first = trimmed.split(/\s+/)[0] || "";
return first.replace(/[^A-Z0-9]/g, "");
}

function clamp(n: number, min: number, max: number) {
return Math.min(max, Math.max(min, n));
}

async function resendSendEmail(args: {
from: string;
to: string;
subject: string;
html: string;
text?: string;
}) {
const key = process.env.RESEND_API_KEY;
if (!key) throw new Error("Missing RESEND_API_KEY");

const res = await fetch("https://api.resend.com/emails", {
method: "POST",
headers: {
Authorization: `Bearer ${key}`,
"Content-Type": "application/json",
},
body: JSON.stringify({
from: args.from,
to: [args.to],
subject: args.subject,
html: args.html,
text: args.text,
}),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
const msg = json?.message || json?.error || "Resend error";
throw new Error(msg);
}
return json;
}

export async function POST(req: Request) {
try {
const token =
req.headers.get("authorization")?.replace("Bearer ", "").trim() || "";

if (!token) {
return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
}

const supaAuth = supabaseAnonWithToken(token);
const { data: userData, error: userErr } = await supaAuth.auth.getUser();

if (userErr || !userData?.user) {
return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
}

const userId = userData.user.id;

const body = await req.json().catch(() => null);

const requestId = String(body?.requestId || "");
const to = String(body?.to || "").trim();

const subtotalRaw = Number(body?.subtotal);
const vatRateRaw = Number(body?.vatRate);

const note = body?.note ? String(body.note) : "";
const jobDetails = body?.jobDetails ? String(body.jobDetails) : "";

if (!requestId) return NextResponse.json({ ok: false, error: "Missing requestId" }, { status: 400 });
if (!to) return NextResponse.json({ ok: false, error: "Missing to email" }, { status: 400 });
if (!Number.isFinite(subtotalRaw) || subtotalRaw <= 0)
return NextResponse.json({ ok: false, error: "Invalid subtotal" }, { status: 400 });
if (!Number.isFinite(vatRateRaw))
return NextResponse.json({ ok: false, error: "Invalid VAT rate" }, { status: 400 });
if (!jobDetails.trim())
return NextResponse.json({ ok: false, error: "Missing job details" }, { status: 400 });

const subtotal = subtotalRaw;
const vatRate = clamp(vatRateRaw, 0, 25);
const vatAmount = (subtotal * vatRate) / 100;
const total = subtotal + vatAmount;

const supabase = supabaseService();

// request must belong to trader
const { data: reqRow, error: reqErr } = await supabase
.from("requests")
.select("id,user_id,name,email,phone,postcode,details,created_at")
.eq("id", requestId)
.eq("user_id", userId)
.maybeSingle();

if (reqErr) return NextResponse.json({ ok: false, error: reqErr.message }, { status: 500 });
if (!reqRow) return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });

await supabase.from("enquiry_messages").insert({
  request_id: requestId,
  plumber_id: reqRow.plumber_id, 
  direction: "inbound",
  channel: "email",
  subject: email.subject || null,
  body_text: email.text || email.html || null,
  from_email: email.from?.email || null,
  to_email: to,
  resend_id: payload.id,
});
// letterhead
const { data: profile } = await supabase
.from("profiles")
.select("display_name, logo_url, headline")
.eq("id", userId)
.maybeSingle();

const traderName = (profile?.display_name || "FixFlow Trader").trim();
const traderLogo = (profile?.logo_url || "").trim();
const traderHeadline = (profile?.headline || "").trim();

// ✅ TRADER ATTACHMENTS ONLY
let attachmentLinksHtml = "";
try {
const folder = `quote/${requestId}/trader`;
const { data: files } = await supabase.storage
.from("quote-files")
.list(folder, { limit: 100 });

const list = (files || []).filter((f) => f?.name);

if (list.length > 0) {
const linkItems: string[] = [];

for (const f of list) {
const path = `${folder}/${f.name}`;
const signed = await supabase.storage
.from("quote-files")
.createSignedUrl(path, 60 * 60 * 24 * 7);

const url = signed.data?.signedUrl;
if (url) {
linkItems.push(
`<li style="margin:6px 0;">
<a href="${url}" target="_blank" rel="noreferrer" style="color:#111827;">
${escapeHtml(f.name)}
</a>
</li>`
);
}
}

if (linkItems.length > 0) {
attachmentLinksHtml = `
<div style="margin-top:16px;">
<div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Attachments from ${escapeHtml(
traderName
)}</div>
<ul style="margin:0; padding-left:18px; font-size:13px;">
${linkItems.join("")}
</ul>
</div>
`;
}
}
} catch {
// don't block email
}

const outward = normalizeOutward(reqRow.postcode || "");
const subject = "Your enquiry";
const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "FixFlow <onboarding@resend.dev>";

const headerHtml = `
<div style="display:flex; align-items:center; gap:12px; padding:16px; border:1px solid #e5e7eb; border-radius:16px; background:#ffffff;">
${
traderLogo
? `<img src="${traderLogo}" alt="${escapeHtml(traderName)}" style="width:44px; height:44px; border-radius:12px; object-fit:cover; border:1px solid #e5e7eb;" />`
: `<div style="width:44px; height:44px; border-radius:12px; background:#f3f4f6; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; font-weight:700; color:#111827;">${escapeHtml(
traderName.charAt(0).toUpperCase()
)}</div>`
}
<div style="min-width:0;">
<div style="font-size:12px; color:#6b7280;">FixFlow Enquiries</div>
<div style="font-size:16px; font-weight:700; color:#111827; line-height:1.2;">${escapeHtml(traderName)}</div>
${
traderHeadline
? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">${escapeHtml(traderHeadline)}</div>`
: ""
}
</div>
</div>
`;

const quoteSummaryHtml = `
<div style="margin-top:14px; padding:14px; border:1px solid #e5e7eb; border-radius:14px; background:#f9fafb;">
<div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Quote summary</div>
<table style="width:100%; border-collapse:collapse; font-size:13px; color:#111827;">
<tr>
<td style="padding:6px 0; color:#374151;">Subtotal</td>
<td style="padding:6px 0; text-align:right; font-weight:600;">£${subtotal.toFixed(2)}</td>
</tr>
<tr>
<td style="padding:6px 0; color:#374151;">VAT (${vatRate.toFixed(0)}%)</td>
<td style="padding:6px 0; text-align:right; font-weight:600;">£${vatAmount.toFixed(2)}</td>
</tr>
<tr>
<td style="padding:10px 0 0; border-top:1px solid #e5e7eb; font-weight:800;">Total</td>
<td style="padding:10px 0 0; border-top:1px solid #e5e7eb; text-align:right; font-weight:900;">£${total.toFixed(2)}</td>
</tr>
</table>
${
note.trim()
? `<div style="margin-top:10px; font-size:13px; color:#374151;">${escapeHtml(note)}</div>`
: ""
}
</div>
`;

const html = `
<div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f9fafb; padding:24px;">
<div style="max-width:720px; margin:0 auto;">
${headerHtml}

<div style="margin-top:14px; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; padding:16px;">
<div style="font-size:18px; font-weight:800; color:#111827;">Quote</div>
<div style="font-size:13px; color:#6b7280; margin-top:4px;">
For: ${escapeHtml(reqRow.name || "Customer")}
${outward ? ` • Area: ${escapeHtml(outward)}` : ""}
</div>

${quoteSummaryHtml}

<div style="margin-top:14px;">
<div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Job details</div>
<div style="white-space:pre-wrap; font-size:13px; border:1px solid #e5e7eb; border-radius:14px; padding:12px; background:#ffffff; color:#111827;">
${escapeHtml(jobDetails)}
</div>
</div>

${attachmentLinksHtml}

<div style="margin-top:16px; padding-top:14px; border-top:1px solid #e5e7eb;">
<div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Your original enquiry</div>
<div style="white-space:pre-wrap; font-size:13px; color:#111827;">
${escapeHtml(reqRow.details || "—")}
</div>
</div>
</div>

<div style="margin-top:12px; font-size:11px; color:#9ca3af; text-align:center;">
Sent via FixFlow
</div>
</div>
</div>
`;

const text = [
`Quote from ${traderName}`,
``,
`Subtotal: £${subtotal.toFixed(2)}`,
`VAT (${vatRate.toFixed(0)}%): £${vatAmount.toFixed(2)}`,
`Total: £${total.toFixed(2)}`,
note.trim() ? `Note: ${note.trim()}` : "",
``,
`Job details:`,
jobDetails,
``,
`Original enquiry:`,
reqRow.details || "—",
]
.filter(Boolean)
.join("\n");

const sent = await resendSendEmail({ from, to, subject, html, text });

return NextResponse.json({
ok: true,
sent,
totals: { subtotal, vatRate, vatAmount, total },
});
} catch (e: any) {
return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
}
}