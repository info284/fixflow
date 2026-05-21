export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

export async function POST(req: Request) {
  try {
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const alreadyPaid = invoice.status === "paid";

    if (!alreadyPaid) {
      const { error: updateErr } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    const { data: request } = await supabase
      .from("quote_requests")
      .select("customer_name, customer_email, job_type, job_number")
      .eq("id", invoice.request_id)
      .maybeSingle();

    const toEmail = invoice.to_email || request?.customer_email;

    if (toEmail && !alreadyPaid) {
      await resend.emails.send({
        from: "FixFlow <noreply@thefixflowapp.co.uk>",
        to: toEmail,
        subject: `Payment received for ${invoice.invoice_number || "your invoice"}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0b1320; line-height: 1.6;">
            <h2 style="color:#0b2a55;">Payment received</h2>

            <p>Hi ${request?.customer_name || "there"},</p>

            <p>Thanks, your payment has been received successfully.</p>

            <div style="padding:16px; border:1px solid #e6ecf5; border-radius:14px; background:#f8fbff; margin:18px 0;">
              <p><strong>Invoice:</strong> ${invoice.invoice_number || invoice.id}</p>
              <p><strong>Amount paid:</strong> ${money(invoice.amount)}</p>
              <p><strong>Job:</strong> ${request?.job_type || "Work completed"}</p>
              <p><strong>Reference:</strong> ${request?.job_number || invoice.request_id}</p>
            </div>

            <p>Kind regards,<br/>FixFlow</p>
          </div>
        `,
      });
    }

    return NextResponse.json({
      ok: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        status: "paid",
        customer_name: request?.customer_name || null,
        job_type: request?.job_type || null,
        job_number: request?.job_number || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Payment completion failed" },
      { status: 500 }
    );
  }
}