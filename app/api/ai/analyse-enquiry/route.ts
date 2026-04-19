import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type QuoteRequestRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  postcode: string | null;
  address: string | null;
  job_type: string | null;
  urgency: string | null;
  details: string | null;
  budget: string | null;
  property_type: string | null;
  problem_location: string | null;
  has_happened_before: string | null;
  is_still_working: string | null;
};

type AIAnalysis = {
  urgency_score?: number;
  conversion_score?: number;
  job_value_band?: "low" | "medium" | "high";
  recommended_action?:
    | "reply_now"
    | "book_visit"
    | "send_estimate"
    | "ask_for_photos"
    | "low_priority";
  summary?: string;
  suggested_reply?: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing" },
        { status: 500 },
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { error: "Supabase server env vars are missing" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const enquiryId =
      typeof body?.enquiryId === "string" ? body.enquiryId : undefined;

    if (!enquiryId) {
      return NextResponse.json(
        { error: "Missing enquiryId" },
        { status: 400 },
      );
    }

    const { data: enquiry, error: enquiryError } = await supabaseAdmin
      .from("quote_requests")
      .select(
        `
        id,
        customer_name,
        customer_email,
        customer_phone,
        postcode,
        address,
        job_type,
        urgency,
        details,
        budget,
        property_type,
        problem_location,
        has_happened_before,
        is_still_working
      `,
      )
      .eq("id", enquiryId)
      .single<QuoteRequestRow>();

    if (enquiryError || !enquiry) {
      return NextResponse.json(
        { error: enquiryError?.message || "Enquiry not found" },
        { status: 404 },
      );
    }

    const prompt = buildPrompt(enquiry);

    let raw = "";

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You analyse trade enquiries and return valid JSON only. No markdown. No extra text.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      raw = completion.choices[0]?.message?.content?.trim() || "";
    } catch (error: any) {
      console.error("OpenAI analyse error:", {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type,
      });

      return NextResponse.json(
        {
          error:
            error?.message || "OpenAI request failed while analysing enquiry",
        },
        { status: error?.status || 500 },
      );
    }

    if (!raw) {
      return NextResponse.json(
        { error: "AI returned no content" },
        { status: 500 },
      );
    }

    let parsed: AIAnalysis;

    try {
      parsed = JSON.parse(raw) as AIAnalysis;
    } catch {
      console.error("AI returned invalid JSON:", raw);

      return NextResponse.json(
        { error: "AI response was not valid JSON", raw },
        { status: 500 },
      );
    }

    const urgencyScore = clampScore(parsed.urgency_score);
    const conversionScore = clampScore(parsed.conversion_score);
    const jobValueBand = normaliseValueBand(parsed.job_value_band);
    const recommendedAction = normaliseAction(parsed.recommended_action);
    const summary = safeText(parsed.summary, 500);
    const suggestedReply = safeText(parsed.suggested_reply, 2000);

    const { error: updateError } = await supabaseAdmin
      .from("quote_requests")
      .update({
        ai_urgency_score: urgencyScore,
        ai_job_value_band: jobValueBand,
        ai_conversion_score: conversionScore,
        ai_recommended_action: recommendedAction,
        ai_summary: summary,
        ai_suggested_reply: suggestedReply,
        ai_last_processed_at: new Date().toISOString(),
      })
      .eq("id", enquiryId);

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to save AI analysis",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      enquiryId,
      ai: {
        urgencyScore,
        conversionScore,
        jobValueBand,
        recommendedAction,
        summary,
        suggestedReply,
      },
    });
  } catch (error: any) {
    console.error("AI analyse enquiry route error:", {
      message: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: error?.message || "Something went wrong while analysing enquiry",
      },
      { status: 500 },
    );
  }
}

function buildPrompt(enquiry: QuoteRequestRow) {
  return `
You are an expert plumbing office manager helping a UK trades business decide what to do with a new customer enquiry.

Analyse this enquiry and return JSON only using this exact shape:

{
  "urgency_score": 1,
  "conversion_score": 1,
  "job_value_band": "low",
  "recommended_action": "reply_now",
  "summary": "short useful summary",
  "suggested_reply": "short human first reply"
}

Rules:
- urgency_score: integer 1 to 5
- conversion_score: integer 1 to 5
- job_value_band: "low" | "medium" | "high"
- recommended_action: one of:
  "reply_now", "book_visit", "send_estimate", "ask_for_photos", "low_priority"
- summary should be short, practical, and commercially useful
- suggested_reply should sound human, warm, professional, and UK-based
- do not mention AI
- do not include markdown
- do not include any keys outside the schema above

Enquiry:
${JSON.stringify(enquiry, null, 2)}
`.trim();
}

function clampScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(1, Math.min(5, Math.round(num)));
}

function normaliseValueBand(value: unknown): "low" | "medium" | "high" | null {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : null;
}

function normaliseAction(
  value: unknown,
):
  | "reply_now"
  | "book_visit"
  | "send_estimate"
  | "ask_for_photos"
  | "low_priority"
  | null {
  const allowed = new Set([
    "reply_now",
    "book_visit",
    "send_estimate",
    "ask_for_photos",
    "low_priority",
  ]);

  return typeof value === "string" && allowed.has(value as any)
    ? (value as
        | "reply_now"
        | "book_visit"
        | "send_estimate"
        | "ask_for_photos"
        | "low_priority")
    : null;
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}