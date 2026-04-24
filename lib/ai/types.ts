export type FixflowAiState =
  | "new"
  | "first_reply_sent"
  | "awaiting_customer_reply"
  | "awaiting_photos"
  | "awaiting_job_details"
  | "ready_for_quick_estimate"
  | "ready_for_detailed_estimate"
  | "visit_recommended"
  | "estimate_sent"
  | "follow_up_due"
  | "booking_prompt"
  | "won"
  | "lost"
  | "needs_human";

export type AiRecommendedAction =
  | "reply_now"
  | "ask_for_photos"
  | "ask_for_details"
  | "send_estimate"
  | "book_visit"
  | "follow_up"
  | "needs_human"
  | "low_priority";

export type AiMessageType =
  | "reply"
  | "question"
  | "follow_up"
  | "handoff"
  | "booking_prompt";

export type AiCustomerSentiment =
  | "positive"
  | "neutral"
  | "negative"
  | "urgent";

export type AiQuoteType = "quick" | "detailed" | null;

export type AiDecision = {
  summary: string;
  state: FixflowAiState;
  recommended_action: AiRecommendedAction;
  confidence: number;
  needs_human: boolean;
  visit_required: boolean;
  ready_to_quote: boolean;
  quote_type: AiQuoteType;
  missing_fields: string[];
  should_send_message: boolean;
  message_type: AiMessageType;
  customer_sentiment: AiCustomerSentiment;
  next_action_due_hours: number | null;
  draft_message: string;
  automation_reason: string;
};