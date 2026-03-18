export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
// import { Resend } from "resend"; // optional

async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

type Body = {
  quoteId: string;
  subject?: string;
  customerNote?: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();

    // ✅ Auth (cookie-based session)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const traderId = user.id;

    // ✅ Body
    const body = (await req.json()) as Body;
    const quoteId = (body.quoteId || "").trim();
    if (!quoteId) {
      return NextResponse.json(
        { ok: false, error: "Missing quoteId" },
        { status: 400 }
      );
    }

    // ✅ Load quote (must belong to trader)
    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select(
        "id, plumber_id, request_id, customer_name, customer_email, postcode, address, job_type, urgency, vat_rate, subtotal, note, job_details, status"
      )
      .eq("id", quoteId)
      .eq("plumber_id", traderId)
      .maybeSingle();

    if (quoteErr) {
      return NextResponse.json(
        { ok: false, error: quoteErr.message },
        { status: 500 }
      );
    }
    if (!quote) {
      return NextResponse.json(
        { ok: false, error: "Quote not found (or no access)" },
        { status: 404 }
      );
    }

    const toEmail = (quote.customer_email || "").trim();
    if (!toEmail) {
      return NextResponse.json(
        { ok: false, error: "Quote has no customer email" },
        { status: 400 }
      );
    }

    // ✅ Optional branding
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, logo_url, email")
      .eq("id", traderId)
      .maybeSingle();

    const businessName = profile?.business_name || "FixFlow";
    const subject =
      (body.subject || "").trim() || `Your estimate from ${businessName}`;
    const customerNote = (body.customerNote || "").trim();

    // ✅ Build email html (you can reuse this for Resend)
    const subtotal = Number(quote.subtotal ?? 0);
    const vatRate = Number(quote.vat_rate ?? 20);
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    const html = `
      <div style="font-family: ui-sans-serif, system-ui; line-height:1.5">
        <h2 style="margin:0 0 8px 0">${businessName} – Your estimate</h2>
        <p style="margin:0 0 12px 0;color:#444">
          ${quote.customer_name ? `Hi ${quote.customer_name},` : "Hi,"}
        </p>

        ${
          customerNote
            ? `<p style="margin:0 0 12px 0">${customerNote.replace(
                /\n/g,
                "<br/>"
              )}</p>`
            : ""
        }

        <div style="border:1px solid #eee;border-radius:12px;padding:12px;margin:12px 0">
          <div><strong>Job:</strong> ${quote.job_type || "—"}</div>
          <div><strong>Postcode:</strong> ${quote.postcode || "—"}</div>
          <div><strong>Subtotal:</strong> £${subtotal.toFixed(2)}</div>
          <div><strong>VAT (${vatRate}%):</strong> £${vat.toFixed(2)}</div>
          <div style="margin-top:8px"><strong>Total:</strong> £${total.toFixed(
            2
          )}</div>
        </div>

        <p style="margin:0;color:#666;font-size:12px">Sent via FixFlow</p>
      </div>
    `;

    // ✅ Send email (optional)
    // const resend = new Resend(process.env.RESEND_API_KEY!);
    // await resend.emails.send({
    //   from: `${businessName} <${process.env.RESEND_FROM!}>`,
    //   to: toEmail,
    //   subject,
    //   html,
    // });

    // ✅ Mark quote as sent
    const { error: updateErr } = await supabase
      .from("quotes")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .eq("plumber_id", traderId);

    if (updateErr) {
      return NextResponse.json(
        { ok: false, error: updateErr.message },
        { status: 500 }
      );
    }

    // ✅ Log to enquiry_messages (THIS is where your error was)
    // IMPORTANT: always use traderId, NOT reqRow.plumber_id
    if (quote.request_id) {
      await supabase.from("enquiry_messages").insert({
        request_id: quote.request_id,
        plumber_id: traderId, // ✅ FIXED
        direction: "outbound",
        channel: "email",
        subject,
        body: customerNote || null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Send failed" },
      { status: 500 }
    );
  }
}