export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";

function extractEmail(input: any): string {
if (!input) return "";
let s = "";

if (Array.isArray(input)) s = String(input[0] ?? "");
else s = String(input);

s = s.trim();

// "Name <email@domain.com>" -> email@domain.com
const m = s.match(/<([^>]+)>/);
if (m?.[1]) s = m[1].trim();

// "email@a.com, other@b.com" -> email@a.com
if (s.includes(",")) s = s.split(",")[0].trim();

return s;
}

function isValidEmail(email: string) {
return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
try {
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM; // e.g. FixFlow <hello@send.thefixflowapp.com>

if (!apiKey) {
return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
}
if (!from) {
return NextResponse.json({ ok: false, error: "Missing RESEND_FROM" }, { status: 500 });
}

const body: any = await req.json().catch(() => ({}));

// accept a few common names your UI might send
const to = extractEmail(
body.to ??
body.email ??
body.toEmail ??
body.customerEmail ??
body.recipient ??
body.recipientEmail
);

const subject = String(body.subject ?? "Invoice from FixFlow").trim();
const text = String(body.text ?? "").trim();
const html = body.html ? String(body.html) : undefined;

if (!to || !isValidEmail(to)) {
return NextResponse.json(
{
ok: false,
error: "Missing or invalid 'to' email address",
debug: {
receivedKeys: Object.keys(body || {}),
receivedTo: body?.to ?? null,
extractedTo: to || null,
},
},
{ status: 400 }
);
}

if (!subject) {
return NextResponse.json({ ok: false, error: "Missing subject" }, { status: 400 });
}

if (!text && !html) {
return NextResponse.json({ ok: false, error: "Provide text or html" }, { status: 400 });
}

const resend = new Resend(apiKey);

const result = await resend.emails.send({
  from,
  to,
  subject,
  text: text || "",
  html: html || "",
});

// Resend returns { data, error }
if ((result as any).error) {
return NextResponse.json({ ok: false, error: (result as any).error }, { status: 400 });
}

return NextResponse.json({ ok: true, sent: result });
} catch (e: any) {
return NextResponse.json(
{ ok: false, error: e?.message || "Server error" },
{ status: 500 }
);
}
}
