console.log("✅ PDF ROUTE HIT: app/api/estimates/pdf/route.ts (quotes)");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderEstimatePdfBuffer } from "@/lib/estimates/renderEstimatePdf";

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

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

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

    const { data: quote, error: quoteErr } = await admin
      .from("quotes")
      .select(
        `
        id,
        plumber_id,
        request_id,
        status,
        subtotal,
        vat_rate,
        note,
        job_details,
        trader_ref,
        created_at,
        customer_name,
        customer_email,
        customer_phone,
        postcode,
        address,
        job_type,
        urgency
        `
      )
      .eq("id", quoteId)
      .eq("plumber_id", uid)
      .maybeSingle();

    if (quoteErr) {
      return NextResponse.json({ error: quoteErr.message }, { status: 500 });
    }

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("display_name, business_name, logo_url, vat_number")
      .eq("id", uid)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    let requestData: {
      job_number: string | null;
      customer_name: string | null;
      customer_email: string | null;
      customer_phone: string | null;
      postcode: string | null;
      address: string | null;
      job_type: string | null;
      details: string | null;
    } | null = null;

if (quote.request_id && isUuid(String(quote.request_id))) {
  const { data: rq, error: rqErr } = await admin
    .from("quote_requests")
    .select(
      `
      job_number,
      customer_name,
      customer_email,
      customer_phone,
      postcode,
      address,
      job_type,
      details
      `
    )
    .eq("id", quote.request_id)
    .eq("plumber_id", uid)
    .maybeSingle();

  if (rqErr) {
    return NextResponse.json({ error: rqErr.message }, { status: 500 });
  }

  requestData = rq || null;
}

const { data: detailedEstimate, error: detailedEstimateErr } = await admin
  .from("estimates")
  .select(
    `
    id,
    request_id,
    status,
    created_at,
    valid_until,
    labour,
    materials,
    callout,
    parts,
    other,
    customer_message,
    included_notes,
    excluded_notes
    `
  )
  .eq("request_id", quote.request_id)
  .eq("user_id", uid)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (detailedEstimateErr) {
  return NextResponse.json(
    { error: detailedEstimateErr.message },
    { status: 500 }
  );
}

const logoUrl = String(profile?.logo_url || "").trim();
const logoBuf = logoUrl ? await fetchImageBuffer(logoUrl) : null;

const subtotal =
  detailedEstimate?.labour ||
  detailedEstimate?.materials ||
  detailedEstimate?.callout ||
  detailedEstimate?.parts ||
  detailedEstimate?.other
    ? Number(detailedEstimate?.labour || 0) +
      Number(detailedEstimate?.materials || 0) +
      Number(detailedEstimate?.callout || 0) +
      Number(detailedEstimate?.parts || 0) +
      Number(detailedEstimate?.other || 0)
    : Number(quote.subtotal || 0);

const vatRate = Number(quote.vat_rate || 0);
const vat = subtotal * (vatRate / 100);
const total = subtotal + vat;

const pdf = await renderEstimatePdfBuffer({
  estimate: {
    id: quote.id,
    request_id: quote.request_id,
    status: detailedEstimate?.status || quote.status,
    created_at: detailedEstimate?.created_at || quote.created_at,
    subtotal,
    vat,
    total,
    valid_until: detailedEstimate?.valid_until || null,
    labour: detailedEstimate?.labour ?? null,
    materials: detailedEstimate?.materials ?? null,
    callout: detailedEstimate?.callout ?? null,
    parts: detailedEstimate?.parts ?? null,
    other: detailedEstimate?.other ?? null,
    customer_message:
      detailedEstimate?.customer_message || quote.note || "",
    included_notes: detailedEstimate?.included_notes || null,
    excluded_notes: detailedEstimate?.excluded_notes || null,
    trader_ref: quote.trader_ref || null,
    job_number: requestData?.job_number || null,
    customer_name: quote.customer_name || requestData?.customer_name || null,
    customer_email: quote.customer_email || requestData?.customer_email || null,
    customer_phone: quote.customer_phone || requestData?.customer_phone || null,
    postcode: quote.postcode || requestData?.postcode || null,
    address: quote.address || requestData?.address || null,
    job_type: quote.job_type || requestData?.job_type || null,
    enquiry_details: requestData?.details || "",
  },
  profile: {
    ...profile,
    logo_buffer: logoBuf,
  },
});

if (!pdf || pdf.length < 500) {
  return NextResponse.json({ error: "PDF render failed" }, { status: 500 });
}

    const safeRef = String(
      requestData?.job_number || quote.trader_ref || quote.id.slice(0, 8)
    ).replace(/[^a-z0-9_-]/gi, "");

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="estimate-${safeRef}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("estimate pdf route error:", e);

    return NextResponse.json(
      { error: e?.message || "PDF failed" },
      { status: 500 }
    );
  }
}