import { createClient } from "@supabase/supabase-js";
import type { AiDecision } from "@/lib/ai/types";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RunEnquiryAiEngineResult = {
  decision: AiDecision;
  sent: boolean;
};

export async function runEnquiryAiEngine(
  enquiryId: string
): Promise<RunEnquiryAiEngineResult> {
  const { data: enquiry, error: enquiryError } = await supabaseAdmin
    .from("quote_requests")
    .select("*")
    .eq("id", enquiryId)
    .single();

  if (enquiryError || !enquiry) {
    throw new Error("Enquiry not found");
  }

  const { data: settings } = await supabaseAdmin
    .from("ai_settings")
    .select("*")
    .eq("plumber_id", enquiry.plumber_id)
    .maybeSingle();

  if (enquiry.ai_status === "paused") {
    return {
      decision: {
        summary: "AI is paused for this enquiry.",
        state: "needs_human",
        recommended_action: "needs_human",
        confidence: 100,
        needs_human: true,
        visit_required: false,
        ready_to_quote: false,
        quote_type: null,
        missing_fields: [],
        should_send_message: false,
        message_type: "handoff",
        customer_sentiment: "neutral",
        next_action_due_hours: null,
        draft_message: "",
        automation_reason: "AI paused by trader",
      },
      sent: false,
    };
  }

  const analysisRes = await fetch("http://localhost:3000/api/ai/analyse-enquiry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enquiryId }),
    cache: "no-store",
  });

  let analysisJson: any = null;

  try {
    analysisJson = await analysisRes.json();
  } catch {
    throw new Error("Analyse enquiry route returned invalid JSON");
  }

  if (!analysisRes.ok || !analysisJson?.decision) {
    throw new Error(analysisJson?.error || "AI analysis failed");
  }

  const decision = analysisJson.decision as AiDecision;
  console.log("runEnquiryAiEngine decision", enquiryId, decision);

  if (decision.needs_human) {
    await supabaseAdmin
      .from("quote_requests")
      .update({
        ai_state: "needs_human",
        ai_status: "active",
        ai_needs_human: true,
        ai_last_action: decision.automation_reason,
        ai_last_action_at: new Date().toISOString(),
        ai_next_action_due_at: null,
      })
      .eq("id", enquiryId);

    return { decision, sent: false };
  }

  const autoReplyEnabled = settings?.auto_reply_enabled ?? true;
  const autoFollowUpEnabled = settings?.auto_follow_up_enabled ?? true;
  const maxFollowUps = settings?.max_follow_ups ?? 2;

  const isFollowUpMessage = decision.message_type === "follow_up";
  const followUpsUsed = enquiry.ai_follow_up_count ?? 0;

  const canSendFollowUp =
    !isFollowUpMessage || (autoFollowUpEnabled && followUpsUsed < maxFollowUps);

  const shouldSend =
    decision.should_send_message &&
    autoReplyEnabled &&
    canSendFollowUp &&
    !!enquiry.customer_email;

  let sent = false;

  if (shouldSend) {
    await sendAiMessage({
      enquiryId,
      plumberId: enquiry.plumber_id,
      customerEmail: enquiry.customer_email,
      customerName: enquiry.customer_name,
      message: decision.draft_message,
      decision,
    });

    sent = true;
  }

  const nowIso = new Date().toISOString();

  const nextActionDueAt =
    decision.next_action_due_hours != null
      ? new Date(Date.now() + decision.next_action_due_hours * 60 * 60 * 1000).toISOString()
      : null;

  const shouldSetFirstReplyAt =
    !enquiry.ai_sent_first_reply_at &&
    decision.message_type === "reply" &&
    sent;

  const nextFirstReplyAt = shouldSetFirstReplyAt
    ? nowIso
    : enquiry.ai_sent_first_reply_at;

  const nextFollowUpCount =
    sent && isFollowUpMessage
      ? (enquiry.ai_follow_up_count ?? 0) + 1
      : enquiry.ai_follow_up_count ?? 0;

  await supabaseAdmin
    .from("quote_requests")
    .update({
      ai_state: decision.state,
      ai_status: "active",
      ai_needs_human: false,
      ai_last_action: decision.automation_reason,
      ai_last_action_at: nowIso,
      ai_next_action_due_at: nextActionDueAt,
      ai_last_ai_message_at: sent ? nowIso : enquiry.ai_last_ai_message_at,
      ai_sent_first_reply_at: nextFirstReplyAt,
      ai_follow_up_count: nextFollowUpCount,
      ai_thread_status: sent ? "awaiting_customer_reply" : enquiry.ai_thread_status,
    })
    .eq("id", enquiryId);

    console.log("runEnquiryAiEngine sent?", {
  enquiryId,
  sent,
  shouldSend,
  customerEmail: enquiry.customer_email,
});
  return { decision, sent };
}

async function sendAiMessage({
  enquiryId,
  plumberId,
  customerEmail,
  customerName,
  message,
  decision,
}: {
  enquiryId: string;
  plumberId: string;
  customerEmail: string;
  customerName: string | null;
  message: string;
  decision: AiDecision;
}) {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return;
  }

  const subject = buildSubject({
    customerName,
    decision,
  });

  const sendRes = await fetch("http://localhost:3000/api/ai/send-customer-message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      enquiryId,
      toEmail: customerEmail,
      subject,
      message: trimmedMessage,
    }),
    cache: "no-store",
  });

  let sendJson: any = null;

  try {
    sendJson = await sendRes.json();
  } catch {
    throw new Error("Customer email route returned invalid JSON");
  }

  if (!sendRes.ok) {
    throw new Error(sendJson?.error || "Failed to send customer email");
  }

  const { error } = await supabaseAdmin.from("enquiry_messages").insert({
    request_id: enquiryId,
    plumber_id: plumberId,
    direction: "out",
    channel: "email",
    subject,
    body_text: trimmedMessage,
    to_email: customerEmail,
    sent_by: "ai",
    message_type: decision.message_type,
    automation_reason: decision.automation_reason,
    ai_confidence: decision.confidence,
    requires_review: false,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function buildSubject({
  customerName,
  decision,
}: {
  customerName: string | null;
  decision: AiDecision;
}) {
  if (decision.message_type === "follow_up") {
    return "Just checking in about your enquiry";
  }

  if (decision.message_type === "booking_prompt") {
    return "Next step for your enquiry";
  }

  if (decision.message_type === "handoff") {
    return "Update on your enquiry";
  }

  if (decision.message_type === "question") {
    return "A couple of quick details needed";
  }

  return customerName ? `Re: ${customerName}` : "Update on your enquiry";
}