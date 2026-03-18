// app/api/enquiries/send-email/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE)");
  return createClient(url, key, { auth: { persistSession: false } });
}

function isEmail(value: string) {
  // Simple/robust enough for UI validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM = process.env.RESEND_FROM;
    const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO;

    if (!RESEND_API_KEY) return json(500, { ok: false, error: "Missing RESEND_API_KEY" });
    if (!RESEND_FROM) return json(500, { ok: false, error: "Missing RESEND_FROM" });
    if (!RESEND_REPLY_TO) return json(500, { ok: false, error: "Missing RESEND_REPLY_TO" });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const cookieStore = await cookies();

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) return json(401, { ok: false, error: "Not authenticated" });

    const body = await req.json().catch(() => ({}));

    const requestId = String(body.requestId || "").trim();
    const to = String(body.to || body.email || "").trim();
    const subjectRaw = String(body.subject || "Your enquiry").trim();
    const text = String(body.text || body.message || body.body || "").trim();

    if (!requestId) return json(400, { ok: false, error: "Missing requestId" });
    if (!to) return json(400, { ok: false, error: "Missing to" });
    if (!isEmail(to)) return json(400, { ok: false, error: "Invalid email address" });
    if (!text) return json(400, { ok: false, error: "Missing text" });

    // Admin client (bypasses RLS) for reading/writing tables safely
    const admin = supabaseAdmin();

    // ✅ Confirm the request exists AND belongs to the logged-in trader
    const { data: reqRow, error: reqErr } = await admin
      .from("quote_requests")
      .select("id, plumber_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr) return json(500, { ok: false, error: reqErr.message });
    if (!reqRow) return json(404, { ok: false, error: "Enquiry not found" });
    if (reqRow.plumber_id !== user.id) return json(403, { ok: false, error: "Forbidden" });

    // Tag subject (helps you match threads even if headers get stripped)
    const subject = subjectRaw.includes("[FF:")
      ? subjectRaw
      : `${subjectRaw} [FF:${requestId}]`;

    // Reply-To can optionally include "{requestId}"
    const replyTo = RESEND_REPLY_TO.includes("{requestId}")
      ? RESEND_REPLY_TO.replace("{requestId}", requestId)
      : RESEND_REPLY_TO;

    const resend = new Resend(RESEND_API_KEY);

    const sent = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      text,
      replyTo,
      headers: {
        "X-Fixflow-Request-Id": requestId,
        "X-Fixflow-Plumber-Id": user.id,
      },
    } as any);

    // @ts-ignore
    if (sent?.error) {
      // @ts-ignore
      return json(500, { ok: false, error: sent.error.message || "Resend error" });
    }

    // Log outbound message
    const ins = await admin.from("enquiry_messages").insert({
      request_id: requestId,
      plumber_id: user.id,
      direction: "out",
      channel: "email",
      subject: subject || null,
      body_text: text || null,
      from_email: RESEND_FROM,
      to_email: to,
      // @ts-ignore
      resend_id: sent?.data?.id || null,
    });

    if (ins.error) return json(500, { ok: false, error: ins.error.message });

    // ✅ Mark as replied
    // NOTE: This will make it disappear from your "Not replied" tab (by design).
    const upd = await admin
      .from("quote_requests")
      .update({
        status: "replied",
        // If you want it to also leave "Unread", uncomment:
        // read_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("plumber_id", user.id);

    if (upd.error) {
      // Don't fail the send if status update fails
      console.warn("quote_requests status update failed:", upd.error.message);
    }

    return json(200, {
      ok: true,
      // @ts-ignore
      id: (sent as any)?.data?.id || null,
      replyTo,
      requestId,
      to,
      statusUpdated: !upd.error,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Server error" });
  }
}