export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderInvoicePdfBuffer } from "@/lib/invoices/renderInvoicePdf";

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
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
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

export async function GET(req: Request) {
  try {
    const uid = await getAuthedUserId(req);

    if (!uid) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const invoiceId = cleanId(searchParams.get("invoiceId"));

    if (!invoiceId || !isUuid(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoiceId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: inv, error: invErr } = await admin
      .from("invoices")
      .select(`
        id,
        user_id,
        request_id,
        invoice_number,
        amount,
        currency,
        status,
        notes,
        created_at,
        updated_at,
        issued_at,
        due_at,
        to_email,
        subtotal,
        vat_rate
      `)
      .eq("id", invoiceId)
      .eq("user_id", uid)
      .maybeSingle();

    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    if (!inv) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("display_name, business_name, logo_url, vat_number")
      .eq("id", uid)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    let linkedRequest: any = null;
    let fallbackEnquiryDetails = "";

    if (inv.request_id && isUuid(String(inv.request_id))) {
      const { data: rq } = await admin
        .from("quote_requests")
        .select(`
          id,
          job_number,
          customer_name,
          customer_email,
          customer_phone,
          postcode,
          address,
          job_type,
          details
        `)
        .eq("id", inv.request_id)
        .eq("plumber_id", uid)
        .maybeSingle();

      linkedRequest = rq || null;
      fallbackEnquiryDetails = String((rq as any)?.details || "").trim();
    }

    const invoiceForPdf = {
      id: inv.id,
      invoice_number: inv.invoice_number,
      created_at: inv.created_at,
      issued_at: inv.issued_at,
      due_at: inv.due_at,
      to_email: inv.to_email,
      notes: inv.notes,
      subtotal: inv.subtotal,
      vat_rate: inv.vat_rate,
      amount: inv.amount,
      customer_name: linkedRequest?.customer_name || "Customer",
      customer_email: linkedRequest?.customer_email || inv.to_email || "",
      customer_phone: linkedRequest?.customer_phone || "",
      postcode: linkedRequest?.postcode || "",
      address: linkedRequest?.address || "",
      job_type: linkedRequest?.job_type || "Invoice",
      job_number: linkedRequest?.job_number || "",
      job_details:
        fallbackEnquiryDetails || String(inv.notes || "").trim() || "—",
    };

    const pdf = await renderInvoicePdfBuffer({
      invoice: invoiceForPdf,
      profile: prof,
      fallbackEnquiryDetails,
    });

    const refDefault = String(inv.id).slice(0, 8);
    const displayRef = String(inv.invoice_number || refDefault).trim();

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${displayRef.replace(
          /[^a-z0-9_-]/gi,
          ""
        )}.pdf"`,
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