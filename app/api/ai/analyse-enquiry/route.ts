import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { buildEnquiryPrompt } from "@/lib/ai/buildEnquiryPrompt";
import type { AiDecision } from "@/lib/ai/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cleanJsonBlock(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normaliseDecision(input: any): AiDecision {
  return {
    summary:
      typeof input?.summary === "string" && input.summary.trim()
        ? input.summary.trim()
        : "No summary provided.",
    state:
      typeof input?.state === "string" && input.state.trim()
        ? input.state
        : "needs_human",
    recommended_action:
      typeof input?.recommended_action === "string" &&
      input.recommended_action.trim()
        ? input.recommended_action
        : "needs_human",
    confidence:
      typeof input?.confidence === "number"
        ? Math.max(0, Math.min(100, Math.round(input.confidence)))
        : 50,
    needs_human: Boolean(input?.needs_human),
    visit_required: Boolean(input?.visit_required),
    ready_to_quote: Boolean(input?.ready_to_quote),
    quote_type:
      input?.quote_type === "quick" || input?.quote_type === "detailed"
        ? input.quote_type
        : null,
    missing_fields: Array.isArray(input?.missing_fields)
      ? input.missing_fields.filter((v: unknown) => typeof v === "string")
      : [],
    should_send_message: Boolean(input?.should_send_message),
    message_type:
      input?.message_type === "reply" ||
      input?.message_type === "question" ||
      input?.message_type === "follow_up" ||
      input?.message_type === "handoff" ||
      input?.message_type === "booking_prompt"
        ? input.message_type
        : "handoff",
    customer_sentiment:
      input?.customer_sentiment === "positive" ||
      input?.customer_sentiment === "neutral" ||
      input?.customer_sentiment === "negative" ||
      input?.customer_sentiment === "urgent"
        ? input.customer_sentiment
        : "neutral",
    next_action_due_hours:
      typeof input?.next_action_due_hours === "number"
        ? input.next_action_due_hours
        : null,
    draft_message:
      typeof input?.draft_message === "string" ? input.draft_message.trim() : "",
    automation_reason:
      typeof input?.automation_reason === "string" &&
      input.automation_reason.trim()
        ? input.automation_reason.trim()
        : "AI analysed enquiry",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const enquiryId = body?.enquiryId as string | undefined;

    if (!enquiryId) {
      return NextResponse.json(
        { ok: false, error: "Missing enquiryId" },
        { status: 400 }
      );
    }

    const { data: enquiry, error: enquiryError } = await supabaseAdmin
      .from("quote_requests")
      .select("*")
      .eq("id", enquiryId)
      .single();

    if (enquiryError || !enquiry) {
      return NextResponse.json(
        { ok: false, error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("enquiry_messages")
      .select("*")
      .eq("request_id", enquiryId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { ok: false, error: messagesError.message },
        { status: 500 }
      );
    }

    const { data: estimate, error: estimateError } = await supabaseAdmin
      .from("estimates")
      .select("*")
      .eq("request_id", enquiryId)
      .maybeSingle();

    if (estimateError) {
      console.warn("estimate lookup failed", estimateError);
    }

    let quickEstimate: any = null;

    try {
      const { data, error } = await supabaseAdmin
        .from("quick_estimates")
        .select("*")
        .eq("request_id", enquiryId)
        .maybeSingle();

      if (error) {
        console.warn("quick_estimates failed", error);
      } else {
        quickEstimate = data ?? null;
      }
    } catch (err) {
      console.warn("quick_estimates crashed", err);
    }

    const { data: visit, error: visitError } = await supabaseAdmin
      .from("site_visits")
      .select("*")
      .eq("request_id", enquiryId)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (visitError) {
      console.warn("site_visits lookup failed", visitError);
    }

    const prompt = buildEnquiryPrompt({
      enquiry,
      messages: messages || [],
      estimate: estimate || null,
      quickEstimate: quickEstimate || null,
      visit: visit || null,
    });

    const response = await openai.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Return exactly one valid JSON object matching the requested schema. Fill every field. No markdown, no code fences, no extra text.",
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
    });

    const rawText = cleanJsonBlock(response.output_text || "");
    console.log("AI rawText", rawText);

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("AI returned invalid JSON rawText:", rawText);
      throw new Error("AI returned invalid JSON");
    }

    const decision = normaliseDecision(parsed);
    console.log("AI decision for enquiry", enquiryId, decision);

    const nowIso = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from("quote_requests")
      .update({
        ai_summary: decision.summary,
        ai_recommended_action: decision.recommended_action,
        ai_suggested_reply: decision.draft_message,
        ai_last_processed_at: nowIso,
        ai_state: decision.state,
        ai_status: "active",
        ai_confidence: decision.confidence,
        ai_needs_human: decision.needs_human,
        ai_missing_fields: decision.missing_fields,
        ai_ready_to_quote: decision.ready_to_quote,
        ai_quote_type: decision.quote_type,
        ai_visit_required: decision.visit_required,
        ai_customer_sentiment: decision.customer_sentiment,
        ai_last_action: decision.automation_reason,
        ai_last_action_at: nowIso,
      })
      .eq("id", enquiryId)
      .select("*")
      .single();

    if (updateError) {
      console.error("quote_requests update failed:", updateError);
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    console.log("Updated row after AI write", updatedRow);

    return NextResponse.json({
      ok: true,
      decision,
      updatedRow,
    });
  } catch (error: any) {
    console.error("analyse-enquiry error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to analyse enquiry",
      },
      { status: 500 }
    );
  }
}