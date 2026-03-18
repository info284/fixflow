export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function extractRequestId(input: string): string | null {
  if (!input) return null;

  // 1) Subject tag like: "Re: ... [FF:abcd-123]"
  const m1 = input.match(/\[FF:([a-zA-Z0-9-]{6,})\]/);
  if (m1?.[1]) return m1[1];

  // 2) reply+REQUESTID@domain
  const m2 = input.match(/reply\+([a-zA-Z0-9-]{6,})@/);
  if (m2?.[1]) return m2[1];

  return null;
}

// Resend signature verify (works with `resend-signature` header + secret)
function verifyResendSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) return false;

  // Header can look like: "t=...,v1=...."
  const parts = Object.fromEntries(signatureHeader.split(",").map(p => p.split("=").map(s => s.trim())));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const payload = `${t}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export async function POST(req: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return json(500, { ok: false, error: "Missing RESEND_WEBHOOK_SECRET" });

    // IMPORTANT: use raw body for signature verification
    const rawBody = await req.text();
    const sig = req.headers.get("resend-signature");

    // If verification fails, reject (or temporarily return 200 while you test)
    const okSig = verifyResendSignature(rawBody, sig, secret);
    if (!okSig) return json(401, { ok: false, error: "Invalid webhook signature" });

    const payload = JSON.parse(rawBody);

    // Resend inbound payload varies by product config, so we defensively read fields
    const subject =
      payload?.data?.subject ||
      payload?.data?.headers?.subject ||
      payload?.data?.email?.subject ||
      "";

    const fromEmail =
      payload?.data?.from ||
      payload?.data?.headers?.from ||
      payload?.data?.email?.from ||
      "";

    const toEmail =
      payload?.data?.to ||
      payload?.data?.headers?.to ||
      payload?.data?.email?.to ||
      "";

    const text =
      payload?.data?.text ||
      payload?.data?.email?.text ||
      payload?.data?.body?.text ||
      payload?.data?.body ||
      "";

    const html =
      payload?.data?.html ||
      payload?.data?.email?.html ||
      payload?.data?.body?.html ||
      "";

    const bodyText = String(text || "").trim() || (String(html || "").trim() ? "[HTML email received]" : "");

    // We try extract requestId from subject OR reply-to address contents
    const requestId =
      extractRequestId(String(subject || "")) ||
      extractRequestId(String(toEmail || "")) ||
      extractRequestId(String(fromEmail || ""));

    if (!requestId) {
      // Don’t fail the webhook (Resend will retry). Just acknowledge and log.
      return json(200, { ok: true, ignored: true, reason: "No requestId found in subject/to/from" });
    }

    const admin = supabaseAdmin();

    // Find the request to get plumber_id (so it shows up in the trader’s thread)
    const { data: reqRow, error: reqErr } = await admin
      .from("quote_requests")
      .select("id, plumber_id")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !reqRow?.plumber_id) {
      return json(200, { ok: true, ignored: true, reason: "Request not found" });
    }

    const ins = await admin.from("enquiry_messages").insert({
      request_id: requestId,
      plumber_id: reqRow.plumber_id,
      direction: "in",
      channel: "email",
      subject: subject || null,
      body_text: bodyText || null,
      from_email: fromEmail || null,
      to_email: toEmail || null,
      resend_id: payload?.data?.id || payload?.data?.email_id || null,
    });

    if (ins.error) return json(500, { ok: false, error: ins.error.message });

    return json(200, { ok: true, saved: true, requestId });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Server error" });
  }
}