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
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM = process.env.RESEND_FROM;

    if (!RESEND_API_KEY) return json(500, { ok: false, error: "Missing RESEND_API_KEY" });
    if (!RESEND_FROM) return json(500, { ok: false, error: "Missing RESEND_FROM" });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Cookie auth (browser)
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
    if (!text) return json(400, { ok: false, error: "Missing text" });

    // Helpful tag for inbound mapping later
    const subject = subjectRaw.includes("[FF:")
      ? subjectRaw
      : `${subjectRaw} [FF:${requestId}]`;

    // Optional: route replies back to a catch-all you control
    // (Only works if you actually have inbound configured for this domain)
    const replyTo = `reply+${requestId}@send.thefixflowapp.com`;

    const resend = new Resend(RESEND_API_KEY);

    const sent = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      text,
      replyTo,
    } as any);

    // @ts-ignore
    if (sent?.error) {
      // @ts-ignore
      return json(500, { ok: false, error: sent.error.message || "Resend error" });
    }

    // ✅ Log OUTBOUND message using service role (no RLS pain)
    const admin = supabaseAdmin();

    // Insert in a “try body, fallback to body_text” way (so it works with your schema)
    const baseInsert: any = {
      request_id: requestId,
      plumber_id: user.id,
      direction: "out",          // your table screenshot shows "out"
      channel: "enquiry",
      subject: subject || null,
      from_email: RESEND_FROM,
      to_email: to,
      // @ts-ignore
      resend_id: sent?.data?.id || null,
    };

    // attempt 1: body
    let insErr = await admin.from("enquiry_messages").insert({
      ...baseInsert,
      body: text,
    });

    // if column 'body' doesn't exist, attempt 2: body_text
    if (insErr.error && String(insErr.error.message || "").toLowerCase().includes("body")) {
      const ins2 = await admin.from("enquiry_messages").insert({
        ...baseInsert,
        body_text: text,
      });
      if (ins2.error) {
        return json(500, { ok: false, error: ins2.error.message });
      }
    } else if (insErr.error) {
      return json(500, { ok: false, error: insErr.error.message });
    }

    return json(200, {
      ok: true,
      // @ts-ignore
      id: sent?.data?.id || null,
      replyTo,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Server error" });
  }
}