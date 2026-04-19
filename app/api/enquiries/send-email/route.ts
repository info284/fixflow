// app/api/enquiries/send-email/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
  escapeEmailHtml,
} from "@/lib/emails/fixflowEmail";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE)");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM = process.env.RESEND_FROM;
    const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO;

    if (!RESEND_API_KEY) {
      return json(500, { ok: false, error: "Missing RESEND_API_KEY" });
    }

    if (!RESEND_FROM) {
      return json(500, { ok: false, error: "Missing RESEND_FROM" });
    }

    if (!RESEND_REPLY_TO) {
      return json(500, { ok: false, error: "Missing RESEND_REPLY_TO" });
    }

    const APP_URL = "https://thefixflowapp.com";

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

    if (userErr || !user) {
      return json(401, { ok: false, error: "Not authenticated" });
    }

    const body = await req.json().catch(() => ({}));

    const requestId = String(body.requestId || "").trim();
    const to = String(body.to || body.email || "").trim();
    const subjectRaw = String(body.subject || "New message from your trader").trim();
    const text = String(body.text || body.message || body.body || "").trim();

    if (!requestId) {
      return json(400, { ok: false, error: "Missing requestId" });
    }

    if (!to) {
      return json(400, { ok: false, error: "Missing to" });
    }

    if (!isEmail(to)) {
      return json(400, { ok: false, error: "Invalid email address" });
    }

    if (!text) {
      return json(400, { ok: false, error: "Missing text" });
    }

    const admin = supabaseAdmin();

    const { data: reqRow, error: reqErr } = await admin
      .from("quote_requests")
      .select("id, plumber_id, status, job_type, customer_name")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr) {
      return json(500, { ok: false, error: reqErr.message });
    }

    if (!reqRow) {
      return json(404, { ok: false, error: "Enquiry not found" });
    }

    if (reqRow.plumber_id !== user.id) {
      return json(403, { ok: false, error: "Forbidden" });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, business_name")
      .eq("id", user.id)
      .maybeSingle();

    const traderName =
      profile?.business_name || profile?.display_name || "Your trader";

    const messageUrl = `${APP_URL}/message/${requestId}`;

    const preview = text.length > 220 ? `${text.slice(0, 220)}…` : text;
    const safeTraderName = escapeEmailHtml(traderName);
    const safePreview = escapeEmailHtml(preview);
    const safeJobType = escapeEmailHtml(String(reqRow.job_type || "your enquiry"));
    const safeCustomerName = escapeEmailHtml(String(reqRow.customer_name || "there"));

    const subject = `New message from ${traderName}`;

    const replyTo = RESEND_REPLY_TO.includes("{requestId}")
      ? RESEND_REPLY_TO.replace("{requestId}", requestId)
      : RESEND_REPLY_TO;

    const resend = new Resend(RESEND_API_KEY);

    const html = buildFixFlowEmail({
      title: "New message",
      introHtml: `
        <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
          Hi ${safeCustomerName},
        </div>

        <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
          ${safeTraderName} sent you a message about <strong style="color:#0B1320;">${safeJobType}</strong>.
        </div>
      `,
      
      bodyHtml: `
  ${buildFixFlowInfoCard(`
    <div style="padding:16px 18px; border-bottom:1px solid #E6ECF5;">
      ${buildFixFlowSectionLabel("Message preview")}
      <div style="
  font-size:15px;
  line-height:1.7;
  color:#0B1320;
  white-space:pre-wrap;
  text-align:center;
  max-width:420px;
  margin:0 auto;
">
  ${safePreview}
</div>
    </div>

          <div style="padding:16px 18px;">
            ${buildFixFlowSectionLabel("Reply link")}
            <div style="font-size:14px; line-height:1.7; color:#1F355C; word-break:break-word;">
              ${messageUrl}
            </div>
          </div>
        `)}

<div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
  Open the message below to view and reply.
</div>
      `,
      ctaHtml: buildFixFlowButton("View and reply", messageUrl),
    });

    const sent = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      replyTo,
      text: `${traderName} sent you a message about your enquiry.

${preview}

View and reply here:
${messageUrl}`,
      html,
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

    const ins = await admin.from("enquiry_messages").insert({
      request_id: requestId,
      plumber_id: user.id,
      direction: "out",
      channel: "portal",
      subject: subjectRaw || null,
      body_text: text || null,
      from_email: RESEND_FROM,
      to_email: to,
      // @ts-ignore
      resend_id: sent?.data?.id || null,
    });

    if (ins.error) {
      return json(500, { ok: false, error: ins.error.message });
    }

    const upd = await admin
      .from("quote_requests")
      .update({
        status: "replied",
      })
      .eq("id", requestId)
      .eq("plumber_id", user.id);

    if (upd.error) {
      console.warn("quote_requests status update failed:", upd.error.message);
    }

    return json(200, {
      ok: true,
      // @ts-ignore
      id: (sent as any)?.data?.id || null,
      replyTo,
      requestId,
      to,
      messageUrl,
      statusUpdated: !upd.error,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Server error" });
  }
}