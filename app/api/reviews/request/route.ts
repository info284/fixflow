import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: job, error: jobError } = await supabaseAdmin
      .from("quote_requests")
      .select("id, plumber_id, customer_name, customer_email, job_type, review_token")
      .eq("id", requestId)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.customer_email) {
      return NextResponse.json(
        { error: "Customer email missing" },
        { status: 400 }
      );
    }

    const token = job.review_token || crypto.randomBytes(24).toString("hex");

    if (!job.review_token) {
      const { error: tokenError } = await supabaseAdmin
        .from("quote_requests")
        .update({
          review_token: token,
          review_requested_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (tokenError) {
        return NextResponse.json({ error: tokenError.message }, { status: 500 });
      }
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const reviewUrl = `${baseUrl}/review/${token}`;

    const customerName = job.customer_name || "there";
const traderName = "your trader";

await resend.emails.send({
  from: "FixFlow Enquiries <hello@send.thefixflowapp.com>",
  to: job.customer_email,
  subject: "Quick favour — how did we do?",
  html: `
<div style="background:#f4f7fb;padding:40px 20px;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:white;border-radius:22px;overflow:hidden;border:1px solid #e5e7eb;">

   <div style="background:#0b2a55;padding:28px 36px;">
      <div style="font-size:14px;letter-spacing:2px;font-weight:700;color:#c7d2fe;">FIXFLOW</div>
      <div style="margin-top:14px;font-size:34px;line-height:1;font-weight:800;color:white;">Quick review</div>
      <div style="margin-top:18px;height:6px;width:160px;background:#2f6bff;border-radius:999px;"></div>
    </div>

    <div style="padding:38px 36px;color:#111827;">
      <div style="font-size:18px;font-weight:700;">Hi ${customerName},</div>

      <div style="margin-top:18px;font-size:18px;line-height:1.7;color:#4b5563;">
        Thanks again for choosing ${traderName}.
      </div>

      <div style="margin-top:18px;font-size:18px;line-height:1.7;color:#4b5563;">
        If you're happy with the work, we'd really appreciate a quick review.
      </div>

      <div style="margin-top:28px;background:#f8fafc;border:1px solid #dbe4f0;border-radius:18px;padding:28px;text-align:center;">
        <div style="font-size:14px;font-weight:700;letter-spacing:2px;color:#667085;">
          VERIFIED FIXFLOW REVIEW
        </div>

        <div style="margin-top:18px;font-size:17px;line-height:1.7;color:#374151;">
          Your feedback helps other customers choose trusted tradespeople.
        </div>

        <a href="${reviewUrl}" style="display:inline-block;margin-top:28px;background:#1f355c;color:white;text-decoration:none;padding:16px 34px;border-radius:14px;font-size:18px;font-weight:700;">
          Leave a review
        </a>
      </div>

      <div style="margin-top:26px;font-size:14px;color:#6b7280;line-height:1.7;">
        Reviews are linked to real completed jobs inside FixFlow.
      </div>

      <div style="margin-top:30px;font-size:18px;font-weight:700;color:#111827;">
        Thanks again,
      </div>

      <div style="margin-top:8px;font-size:18px;color:#4b5563;">
        ${traderName}
      </div>
    </div>
  </div>
</div>
`,
  text: `Hi ${customerName},

Thanks again for choosing ${traderName}.

If you're happy with the work, we'd really appreciate a quick review:

${reviewUrl}

Reviews are linked to real completed jobs inside FixFlow.

Thanks again,
${traderName}`,
});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to send review request" },
      { status: 500 }
    );
  }
}