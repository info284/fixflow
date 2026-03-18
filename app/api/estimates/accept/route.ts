export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function cleanToken(v?: string | null) {
  const s = String(v || "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const token = cleanToken(body?.token);

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Find quote by token
    const { data: q, error: qErr } = await admin
      .from("quotes")
      .select("id, plumber_id, customer_name, customer_email, postcode, job_type, subtotal, vat_rate, accepted_at, status")
      .eq("accept_token", token)
      .maybeSingle();

    if (qErr) {
      return NextResponse.json({ ok: false, error: qErr.message }, { status: 500 });
    }
    if (!q) {
      return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 404 });
    }
    if (q.accepted_at) {
      return NextResponse.json({ ok: true, already: true }, { status: 200 });
    }

    const patch: Record<string, any> = {
      accepted_at: new Date().toISOString(),
      status: "accepted",
    };

    const { error: uErr } = await admin
      .from("quotes")
      .update(patch)
      .eq("id", q.id)
      .eq("accept_token", token)
      .is("accepted_at", null); // prevents double-accept race

    if (uErr) {
      return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Accept failed" },
      { status: 500 }
    );
  }
}