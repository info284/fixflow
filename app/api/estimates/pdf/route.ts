console.log("✅ PDF ROUTE HIT: app/api/estimates/pdf/route.ts (v4)");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderEstimatePdfBuffer } from "@/lib/estimates/renderEstimatePdf";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}

async function getAuthedUserId(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) return null;

  const anon = supabaseAnon();
  const { data, error } = await anon.auth.getUser(token);

  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const u = String(url || "").trim();
  if (!u) return null;

  try {
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) return null;

    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);

    if (!buf || buf.length < 200) return null;
    return buf;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const uid = await getAuthedUserId(req);

    if (!uid) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const quoteId = cleanId(searchParams.get("quoteId"));

    if (!quoteId || !isUuid(quoteId)) {
      return NextResponse.json({ error: "Invalid quoteId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: q, error: qErr } = await admin
      .from("quotes")
      .select(
        "id, plumber_id, request_id, customer_name, customer_email, customer_phone, postcode, address, job_type, vat_rate, subtotal, job_details, note, created_at, trader_ref"
      )
      .eq("id", quoteId)
      .eq("plumber_id", uid)
      .maybeSingle();

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    if (!q) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("display_name, business_name, logo_url, vat_number")
      .eq("id", uid)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    let fallbackEnquiryDetails = "";
    let requestJobNumber = "";

    if (q.request_id && isUuid(String(q.request_id))) {
      const { data: rq, error: rqErr } = await admin
        .from("quote_requests")
        .select("details, job_number")
        .eq("id", q.request_id)
        .eq("plumber_id", uid)
        .maybeSingle();

      if (rqErr) {
        return NextResponse.json({ error: rqErr.message }, { status: 500 });
      }

      fallbackEnquiryDetails = String(rq?.details || "").trim();
      requestJobNumber = String(rq?.job_number || "").trim();
    }

    const logoUrl = String(prof?.logo_url || "").trim();
    const logoBuf = logoUrl ? await fetchImageBuffer(logoUrl) : null;

    const pdf = await renderEstimatePdfBuffer({
      quote: {
        ...q,
        job_number: requestJobNumber || null,
      },
      profile: {
        ...prof,
        logo_buffer: logoBuf,
      },
      fallbackEnquiryDetails,
    });

    const displayRef = String(q.trader_ref || q.id.slice(0, 8)).trim();
    const safeRef = displayRef.replace(/[^a-z0-9_-]/gi, "");

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="estimate-${safeRef}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "PDF failed" },
      { status: 500 }
    );
  }
}