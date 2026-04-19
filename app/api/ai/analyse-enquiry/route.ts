import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   TYPES
========================= */

type AiRecommendedAction =
  | "reply_now"
  | "book_visit"
  | "send_estimate"
  | "ask_for_photos"
  | "low_priority"
  | "follow_up";

type AiResult = {
  urgency_score: number;
  job_value_band: "low" | "medium" | "high";
  conversion_score: number;
  recommended_action: AiRecommendedAction;
  summary: string;
  suggested_reply: string;
};

/* =========================
   HELPERS
========================= */

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function createSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase anon environment variables");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}

async function getAuthedUserId(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) return null;

  const supabaseAnon = createSupabaseAnon();
  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data?.user?.id) return null;
  return data.user.id;
}

function safeJsonParse(content: string): AiResult | null {
  try {
    const parsed = JSON.parse(content);

    return {
      urgency_score: clampNumber(parsed?.urgency_score, 0, 100, 50),
      job_value_band: normaliseBand(parsed?.job_value_band),
      conversion_score: clampNumber(parsed?.conversion_score, 0, 100, 50),
      recommended_action: normaliseAction(parsed?.recommended_action),
      summary: String(parsed?.summary || "").trim(),
      suggested_reply: String(parsed?.suggested_reply || "").trim(),
    };
  } catch {
    return null;
  }
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normaliseBand(value: unknown): "low" | "medium" | "high" {
  const v = String(value || "").trim().toLowerCase();
  if (v === "low" || v === "medium" || v === "high") return v;
  return "medium";
}

function normaliseAction(value: unknown): AiRecommendedAction {
  const v = String(value || "").trim().toLowerCase();

  if (
    v === "reply_now" ||
    v === "book_visit" ||
    v === "send_estimate" ||
    v === "ask_for_photos" ||
    v === "low_priority" ||
    v === "follow_up"
  ) {
    return v;
  }

  return "reply_now";
}

function buildFallbackReply(input: {
  customerName?: string | null;
  recommendedAction: AiRecommendedAction;
  jobType?: string | null;
}) {
  const customerName = String(input.customerName || "there").trim();
  const jobType = String(input.jobType || "the job").trim();

  if (input.recommendedAction === "ask_for_photos") {
    return `Hi ${customerName}, thanks for your message. Please could you send over a few photos of ${jobType} so I can advise properly and work out the next step?`;
  }

  if (input.recommendedAction === "book_visit") {
    return `Hi ${customerName}, thanks for your message. This looks like something I’d need to see in person before confirming the price. Let me know a couple of times that suit you and I can get a visit booked in.`;
  }

  if (input.recommendedAction === "send_estimate") {
    return `Hi ${customerName}, thanks for your message. I’ve had a look and I should be able to put an estimate together for you shortly. I’ll send that over as soon as I can.`;
  }

  if (input.recommendedAction === "follow_up") {
    return `Hi ${customerName}, just checking in on this one in case you still need help. Let me know if you’d like to go ahead or if you have any questions.`;
  }

  if (input.recommendedAction === "low_priority") {
    return `Hi ${customerName}, thanks for your message. I’ve got this and I’ll come back to you as soon as I can.`;
  }

  return `Hi ${customerName}, thanks for your message. I’ve had a look and I’ll get back to you shortly.`;
}

/* =========================
   ROUTE
========================= */

export async function POST(req: Request) {
  try {
    const userId = await getAuthedUserId(req);

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: openaiKey,
    });

    const body = await req.json();
    const enquiryId = String(body?.enquiryId || "").trim();

    if (!enquiryId) {
      return NextResponse.json(
        { error: "Missing enquiryId" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { data: enquiry, error: enquiryError } = await supabase
      .from("quote_requests")
      .select(`
        id,
        plumber_id,
        customer_name,
        customer_email,
        customer_phone,
        postcode,
        address,
        job_type,
        urgency,
        details,
        status,
        stage,
        created_at,
        trader_notes,
        budget,
        property_type,
        ai_urgency_score,
        ai_job_value_band,
        ai_conversion_score,
        ai_recommended_action,
        ai_summary,
        ai_suggested_reply
      `)
      .eq("id", enquiryId)
      .eq("plumber_id", userId)
      .maybeSingle();

    if (enquiryError) {
      return NextResponse.json(
        { error: enquiryError.message },
        { status: 500 }
      );
    }

    if (!enquiry) {
      return NextResponse.json(
        { error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const { data: messages, error: messagesError } = await supabase
      .from("enquiry_messages")
      .select(`
        id,
        direction,
        channel,
        subject,
        body_text,
        from_email,
        to_email,
        created_at
      `)
      .eq("request_id", enquiryId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 }
      );
    }

    const { data: estimates, error: estimatesError } = await supabase
      .from("estimates")
      .select(`
        id,
        status,
        subtotal,
        vat,
        total,
        created_at,
        accepted_at,
        first_viewed_at,
        last_viewed_at,
        view_count
      `)
      .eq("request_id", enquiryId)
      .eq("plumber_id", userId)
      .order("created_at", { ascending: false });

    if (estimatesError) {
      return NextResponse.json(
        { error: estimatesError.message },
        { status: 500 }
      );
    }

    const { data: visits, error: visitsError } = await supabase
      .from("site_visits")
      .select(`
        id,
        starts_at,
        duration_mins,
        created_at
      `)
      .eq("request_id", enquiryId)
      .eq("plumber_id", userId)
      .order("created_at", { ascending: false });

    if (visitsError) {
      return NextResponse.json(
        { error: visitsError.message },
        { status: 500 }
      );
    }

    const enquiryPayload = {
      enquiry,
      messages: messages || [],
      estimates: estimates || [],
      visits: visits || [],
    };

    const systemPrompt = `
You are an AI assistant for FixFlow, a trades enquiry app for plumbers and similar trades.

Your job is to analyse one enquiry and return JSON only.

Rules:
- Be practical, concise, and commercially useful.
- urgency_score must be a number from 0 to 100.
- conversion_score must be a number from 0 to 100.
- job_value_band must be one of: low, medium, high.
- recommended_action must be one of:
  reply_now, book_visit, send_estimate, ask_for_photos, low_priority, follow_up
- summary must be 1 to 3 short sentences.
- suggested_reply must sound natural, human, and helpful. No markdown. No emojis.
- If enough detail exists and it sounds quotable remotely, prefer send_estimate.
- If more visual/detail info is needed, prefer ask_for_photos.
- If it clearly needs seeing in person, prefer book_visit.
- If the customer is waiting on a response, prefer reply_now.
- If the trader already sent something and it is time to chase, prefer follow_up.

Return strictly valid JSON with this shape:
{
  "urgency_score": 72,
  "job_value_band": "medium",
  "conversion_score": 68,
  "recommended_action": "reply_now",
  "summary": "Customer has given decent detail and looks genuine. They are waiting for a reply and this could likely move forward quickly.",
  "suggested_reply": "Hi Sarah, thanks for your message..."
}
`.trim();

    const userPrompt = `
Analyse this enquiry data and return JSON only.

${JSON.stringify(enquiryPayload, null, 2)}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content =
      completion.choices?.[0]?.message?.content?.trim() || "";

    const parsed = safeJsonParse(content);

    if (!parsed) {
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: content },
        { status: 500 }
      );
    }

    const summary =
      parsed.summary || "This enquiry has been analysed by AI.";
    const suggestedReply =
      parsed.suggested_reply ||
      buildFallbackReply({
        customerName: enquiry.customer_name,
        recommendedAction: parsed.recommended_action,
        jobType: enquiry.job_type,
      });

    const updatePayload = {
      ai_urgency_score: parsed.urgency_score,
      ai_job_value_band: parsed.job_value_band,
      ai_conversion_score: parsed.conversion_score,
      ai_recommended_action: parsed.recommended_action,
      ai_summary: summary,
      ai_suggested_reply: suggestedReply,
      ai_last_processed_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("quote_requests")
      .update(updatePayload)
      .eq("id", enquiryId)
      .eq("plumber_id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      enquiryId,
      ...updatePayload,
    });
  } catch (error: any) {
    console.error("AI analyse enquiry error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to analyse enquiry" },
      { status: 500 }
    );
  }
}