"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import QuickEstimateCard from "../../components/QuickEstimateCard";
import { getEnquiryCounts } from "@/lib/enquiryCounts";
import { getJobCounts } from "@/lib/jobCounts";
import { getFollowUpState, type FollowUpResult } from "@/lib/enquiries/followUp";
/* ================================
   TYPES
================================ */

type QuoteRequestRow = {
  id: string;
  job_number: string | null;
  plumber_id: string;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  postcode: string | null;
  address: string | null;

  job_type: string | null;
  urgency: string | null;
  details: string | null;

  status: string | null;
  stage: string | null;
photo_count: number | null;
  job_booked_at: string | null;
  read_at: string | null;
  snoozed_until: string | null;

  created_at: string;
  trader_notes: string | null;

  is_still_working: string | null;
  has_happened_before: string | null;
  budget: string | null;
  parking: string | null;
  property_type: string | null;
  problem_location: string | null;
source: string | null;
  // 🔥 AI fields
  ai_urgency_score: number | null;

  ai_job_value_band:
    | "low"
    | "medium"
    | "high"
    | null;

  ai_conversion_score: number | null;

 ai_recommended_action :
    | "reply_now"
    | "book_visit"
    | "send_estimate"
    | "ask_for_photos"
    | "low_priority"
    | null;

  ai_summary: string | null;
  ai_suggested_reply: string | null;

  ai_last_processed_at: string | null;


ai_next_action_due_at?: string | null;
ai_thread_status?: string | null;
ai_follow_up_count?: number | null;
lost_reason?: string | null;
};

type EnquiryMessageRow = {
  id: string;
  request_id: string;
  plumber_id: string;
  direction: string | null;
  channel: string | null;
  subject: string | null;
  body_text: string | null;
  from_email: string | null;
  to_email: string | null;
  resend_id: string | null;
  created_at: string;
  is_follow_up?: boolean | null;
follow_up_number?: number | null;
};

type FileItem = {
  name: string;
  path: string;
  url: string | null;
  size?: number | null;
  created_at?: string | null;
};

type QuickEstimateLite = {
  id: string;
  request_id: string;
  status: string;
  total_amount: number;
  accepted_at: string | null;
  created_at: string;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
};

type SiteVisitRow = {
  id: string;
  request_id: string;
  plumber_id: string;
  starts_at: string;
  duration_mins: number;
  created_at: string;
};

type TraderProfile = {
  display_name: string | null;
  business_name: string | null;
  logo_url: string | null;
};

type DetailedEstimateRow = {
  id: string;
  request_id: string;
  status: string | null;
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  valid_until: string | null;
  created_at: string;
  labour?: number | null;
  materials?: number | null;
  callout?: number | null;
  parts?: number | null;
  other?: number | null;
  customer_message?: string | null;
  included_notes?: string | null;
  excluded_notes?: string | null;
  view_count?: number | null;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  accepted_at?: string | null;
};

type DetailedEstimateItemRow = {
  id: string;
  estimate_id: string;
  title: string | null;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  created_at?: string | null;
};

type EstimateFormState = {
  labour: string;
  materials: string;
  callout: string;
  parts: string;
  other: string;
  vatPercent: string;
  validUntil: string;
  customerMessage: string;
  includedNotes: string;
  excludedNotes: string;
  materialsMarkupType: "percent" | "custom";
  materialsMarkupPercent: string;
  materialsMarkupCustom: string;
};

type RightTab =
  | "details"
  | "estimate"
  | "files"
  | "visit"
  | "notes"
  | "messages";

type ListTab =
  | "all"
  | "unread"
  | "needsAction"
  | "followUp"
  | "waiting"
  | "cold";

type BestAction = {
  title: string;
  text: string;
  button: null | {
    label: string;
    action: () => void;
  };
};

type CustomerHistory = {
  count: number;
  jobs: {
    id: string;
    job_type: string | null;
    created_at: string;
    stage: string | null;
  }[];
};

/* ================================
   CONSTS
================================ */


function estimateFollowUp(estimate?: QuickEstimateLite | null) {
  if (!estimate) return null;
  if (estimate.status !== "sent") return null;
  if (estimate.accepted_at) return null;

  const lastTouch =
    estimate.last_viewed_at ||
    estimate.first_viewed_at ||
    null;

  const baseDate = lastTouch || null;
  const compareDate = baseDate ? new Date(baseDate).getTime() : Date.now();
  const ageDays = Math.floor((Date.now() - compareDate) / (1000 * 60 * 60 * 24));

  if (!estimate.first_viewed_at && ageDays >= 2) {
    return {
      eyebrow: "FOLLOW UP",
      title: "Estimate sent — check in",
      text: "Your estimate has been sent but not viewed yet.",
      action: "Follow up",
    };
  }

  if (estimate.first_viewed_at && !estimate.accepted_at && ageDays >= 2) {
    return {
      eyebrow: "FOLLOW UP",
      title: "Estimate viewed — chase now",
      text: "The customer has seen the estimate but has not replied yet.",
      action: "Follow up",
    };
  }

  return null;
}

const ENQUIRY_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "estimate_sent", label: "Estimate sent" },
  { value: "visit_booked", label: "Visit booked" },
  { value: "won", label: "Won" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "lost", label: "Lost" },
] as const;

const BUCKET = "quote-files";
const SITE_VISIT_BOOK_URL = "/api/site-visit/book";

const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;

const FF = {
  pageBg: "#F6F8FC",
  card: "#FFFFFF",
  border: "#E6ECF5",
  text: "#0B1320",
  muted: "#5C6B84",
  navy: "#0B2A55",
  navySoft: "#1F355C",
  blue: "#245BFF",
  blueSoft: "#EAF1FF",
  blueSoft2: "#F4F7FF",
  greenSoft: "#ECFDF3",
  redSoft: "#FFF1F1",
  amberSoft: "#FFF7ED",
};

/* ================================
   HELPERS
================================ */

function getJobCategory(text: string) {
  const t = text.toLowerCase();

  if (/(tap|leak|drip|faucet)/.test(t)) return "tap";
  if (/(toilet|flush|cistern)/.test(t)) return "toilet";
  if (/(boiler|heating|radiator)/.test(t)) return "boiler";
  if (/(drain|blocked|clog)/.test(t)) return "drain";
  if (/(shower|bath)/.test(t)) return "bathroom";
  if (/(pipe|burst)/.test(t)) return "pipe";

  return "other";
}

function getEnquiryPriority(args: {
  followUp?: FollowUpResult | null;
  replyStatus: string | null;
  estimate?: QuickEstimateLite | null;
}) {
  const { followUp, replyStatus, estimate } = args;

  if (followUp?.status === "customer_replied") return 100;
  if (followUp?.status === "needs_reply") return 90;
  if (replyStatus === "Customer replied") return 85;
  if (replyStatus === "Awaiting first reply") return 80;
  if (followUp?.status === "estimate_follow_up_due") return 70;
  if (followUp?.status === "follow_up_due") return 60;
  if (String(estimate?.status || "").toLowerCase() === "sent") return 50;

  return 10;
}

function getAlertState(params: {
  row: QuoteRequestRow;
  messages: EnquiryMessageRow[];
  estimate?: QuickEstimateLite | null;
}) {
  const { row, messages, estimate } = params;

  if (!row.read_at) {
    if (
      estimate?.accepted_at ||
      String(estimate?.status || "").toLowerCase() === "accepted"
    ) {
      return {
        text: "Estimate accepted",
        cls: "ff-chip ff-chipGreen",
      };
    }

    if (hasCustomerReplyAfterOutbound(messages)) {
      return {
        text: "Customer replied",
        cls: "ff-chip ff-chipBlue",
      };
    }

    return {
      text: "New enquiry",
      cls: "ff-chip ff-chipAmber",
    };
  }

  return null;
}


function isSnoozedUntilActive(value?: string | null) {
  if (!value) return false;
  return new Date(value).getTime() > Date.now();
}

function isImageFile(name?: string | null) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(String(name || ""));
}

function prettyFileSize(bytes?: number | null) {
  const n = Number(bytes || 0);
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(name?: string | null) {
  const n = String(name || "").toLowerCase();

  if (/\.(jpg|jpeg|png|webp|gif)$/.test(n)) return "Image";
  if (/\.(pdf)$/.test(n)) return "PDF";
  if (/\.(doc|docx)$/.test(n)) return "Document";
  if (/\.(xls|xlsx|csv)$/.test(n)) return "Spreadsheet";

  return "File";
}

function ReadinessBar({ score }: { score: number }) {
  const background =
    score >= 85
      ? "linear-gradient(90deg, #16A34A 0%, #4ADE80 100%)"
      : score >= 60
      ? "linear-gradient(90deg, #1F355C 0%, #8FA9D6 100%)"
      : "linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)";

  return (
    <div
      style={{
        marginTop: 14,
        height: 10,
        borderRadius: 999,
        background: "#EAF1FF",
        overflow: "hidden",
        border: `1px solid ${FF.border}`,
      }}
    >
      <div
        style={{
          width: `${score}%`,
          height: "100%",
          borderRadius: 999,
          background,
          transition: "width 240ms ease",
        }}
      />
    </div>
  );
}
function getUrgencyGlowClass(urgency?: string | null) {
  const u = (urgency || "").toLowerCase().trim();

  if (
    u.includes("asap") ||
    u.includes("urgent") ||
    u.includes("emergency") ||
    u.includes("24")
  ) {
    return "ff-leftGlowASAP";
  }

  if (
    u.includes("48") ||
    u.includes("this week") ||
    u.includes("soon")
  ) {
    return "ff-leftGlowWeek";
  }

  if (
    u.includes("next week") ||
    u.includes("next")
  ) {
    return "ff-leftGlowNext";
  }

  if (
    u.includes("flexible") ||
    u.includes("no rush") ||
    u.includes("whenever")
  ) {
    return "ff-leftGlowFlexible";
  }

  return "";
}

function money(value?: number | null) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function titleCase(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function niceDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    year: "2-digit",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function niceDateOnly(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatBudget(budget?: string | null) {
  if (!budget) return "No budget";

  const v = String(budget).trim();

  if (v === "under-100") return "Under £100";
  if (v === "100-250") return "£100–£250";
  if (v === "250-500") return "£250–£500";
  if (v === "500-1000") return "£500–£1,000";
  if (v === "1000-3000") return "£1,000–£3,000";
  if (v === "3000-plus") return "£3,000+";
  if (v === "not-sure") return "Not sure";

  return v.startsWith("£") ? v : `£${v}`;
}

function formatPostcode(postcode?: string | null) {
  if (!postcode) return "";
  return String(postcode).trim().toUpperCase();
}

function telHref(phone?: string | null) {
  if (!phone) return "#";
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}

function safeFileName(name: string) {
  return (name || "file")
    .replaceAll(" ", "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .slice(0, 120);
}

function urgencyChip(urgency?: string | null) {
  const v = String(urgency || "").toLowerCase().trim();

  if (
    v.includes("asap") ||
    v.includes("urgent") ||
    v.includes("emergency") ||
    v.includes("24")
  ) {
    return { text: "ASAP", cls: "ff-chip ff-chipRed" };
  }

  if (
    v.includes("48") ||
    v.includes("this week") ||
    v.includes("soon")
  ) {
    return { text: "This week", cls: "ff-chip ff-chipAmber" };
  }

  if (
    v.includes("next week") ||
    v.includes("next")
  ) {
    return { text: "Next week", cls: "ff-chip ff-chipGreen" };
  }

  if (
    v.includes("flex") ||
    v.includes("flexible") ||
    v.includes("no rush") ||
    v.includes("whenever")
  ) {
    return { text: "Flexible", cls: "ff-chip ff-chipBlue" };
  }

  return { text: "Unknown", cls: "ff-chip ff-chipGray" };
}

function stageChip(stage?: string | null) {
  const v = String(stage || "").toLowerCase();

  if (v === "new") return { text: "New", cls: "ff-chip ff-chipBlue" };
  if (v === "contacted") return { text: "Contacted", cls: "ff-chip ff-chipAmber" };
  if (v === "estimate_sent") return { text: "Estimate sent", cls: "ff-chip ff-chipBlue" };
  if (v === "visit_booked") return { text: "Visit booked", cls: "ff-chip ff-chipGreen" };
  if (v === "won") return { text: "Booked", cls: "ff-chip ff-chipGreen" };
  if (v === "in_progress") return { text: "In progress", cls: "ff-chip ff-chipBlue" };
  if (v === "completed") return { text: "Completed", cls: "ff-chip ff-chipGreen" };
  if (v === "lost") return { text: "Lost", cls: "ff-chip ff-chipRed" };

  return { text: "Open", cls: "ff-chip ff-chipGray" };
}

function deriveEnquiryStage(params: {
  row: QuoteRequestRow;
  estimate?: QuickEstimateLite | null;
  visit?: SiteVisitRow | null;
  messages?: EnquiryMessageRow[];
}) {
  const { row, estimate, visit, messages = [] } = params;

  const savedStage = String(row.stage || "").toLowerCase();
  const estimateStatus = String(estimate?.status || "").toLowerCase();
  const estimateAccepted =
    estimateStatus === "accepted" || !!estimate?.accepted_at;
  const hasVisit = !!visit;
  const hasOutbound = messages.some((m) => isOutboundDirection(m.direction));

  if (savedStage === "lost") return "lost";
  if (savedStage === "in_progress") return "in_progress";
  if (savedStage === "completed") return "completed";
  if (savedStage === "won" || estimateAccepted) return "won";
  if (estimateStatus === "sent") return "estimate_sent";
  if (hasVisit) return "visit_booked";
  if (savedStage === "contacted" || hasOutbound) return "contacted";
  return "new";
}

function isOutboundDirection(direction?: string | null) {
  const v = String(direction || "").toLowerCase();
  return v === "out" || v === "outbound" || v === "sent";
}



function hasCustomerReplyAfterOutbound(messages: EnquiryMessageRow[]) {
  if (!messages.length) return false;

  const lastOutbound = [...messages]
    .filter((m) => isOutboundDirection(m.direction))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

  if (!lastOutbound) return false;

  return messages.some((m) => {
    const inbound = !isOutboundDirection(m.direction);
    if (!inbound) return false;

    return (
      new Date(m.created_at).getTime() >
      new Date(lastOutbound.created_at).getTime()
    );
  });
}

function getEstimateEngagementState(estimate?: QuickEstimateLite | null) {
  if (!estimate) return "none";

  const status = String(estimate.status || "").toLowerCase();
  if (status !== "sent") return "none";
  if (estimate.accepted_at) return "accepted";

  if (estimate.last_viewed_at || estimate.first_viewed_at) {
    return "viewed";
  }

  return "sent_not_viewed";
}


function insertReplyText(current: string, text: string) {
  if (!current.trim()) return text;
  return `${current.trim()}\n\n${text}`;
}

function enquiryScore(r: QuoteRequestRow, photos: number) {
  let score = 0;

  if (r.customer_name) score += 10;
  if (r.customer_email) score += 10;
  if (r.customer_phone) score += 10;
  if (r.address || r.postcode) score += 10;
  if (r.details && r.details.trim().length >= 30) score += 20;
  if (r.urgency) score += 10;
if (photos === 0) score -= 10;     
else if (photos >= 3) score += 15;  
else score += 8;                    
  if (r.budget) score += 5;
  if (r.property_type) score += 5;

  return Math.min(score, 100);
}

function enquiryStrength(r: QuoteRequestRow, photos: number) {
  const score = enquiryScore(r, photos);

  if (score >= 80) return { text: "Strong", cls: "ff-chip ff-chipGreen" };
  if (score >= 55) return { text: "Fair", cls: "ff-chip ff-chipBlue" };
  return { text: "Needs info", cls: "ff-chip ff-chipAmber" };
}

function missingInfoList(r: QuoteRequestRow, photos: number) {
  const missing: string[] = [];

  if (!r.customer_phone) missing.push("Phone");
  if (!r.budget || r.budget === "not-sure") missing.push("Budget");
  if (!photos) missing.push("Photos");
  if (!r.details || r.details.length < 30) missing.push("Details");
  if (!r.address && !r.postcode) missing.push("Address");
  if (!r.property_type) missing.push("Property");

  return missing;
}

function quoteReadinessItems(r: QuoteRequestRow, photos: number) {
  return [
    { label: "Details", ok: !!r.details && r.details.length >= 30 },
    { label: "Photos", ok: photos > 0 },
    { label: "Budget", ok: !!r.budget && r.budget !== "not-sure" },
    { label: "Contact", ok: !!r.customer_phone || !!r.customer_email },
    { label: "Address", ok: !!r.address || !!r.postcode },
    { label: "Property", ok: !!r.property_type },
  ];
}

function quoteReadinessScore(r: QuoteRequestRow, photos: number) {
  const items = quoteReadinessItems(r, photos);
  const okCount = items.filter((i) => i.ok).length;
  return Math.round((okCount / items.length) * 100);
}

function quoteReadinessState(score: number) {
  if (score >= 85) {
    return {
      text: "Ready to estimate",
      sub: "You’ve got enough info to price this confidently.",
      cls: "ff-chip ff-chipGreen",
    };
  }

  if (score >= 60) {
    return {
      text: "Almost ready",
      sub: "A couple more details could help you quote more accurately.",
      cls: "ff-chip ff-chipBlue",
    };
  }

  return {
    text: "Needs more info",
    sub: "Ask a few follow-up questions before pricing this job.",
    cls: "ff-chip ff-chipAmber",
  };
}



function getFollowUpMessage(params: {
  customerName?: string | null;
  status?: string | null;
}) {
const name = params.customerName
  ? titleCase(params.customerName).split(" ")[0]
  : "there";
  const status = String(params.status || "").toLowerCase();

  if (status === "estimate_follow_up_due") {
    return `Hi ${name}, just checking you received the estimate I sent over. Let me know if you'd like to go ahead or if you'd like me to talk anything through.`;
  }

  if (status === "needs_reply") {
    return `Hi ${name}, thanks for your enquiry — I’m just reviewing this now and will get back to you shortly.`;
  }

  if (status === "customer_replied") {
    return `Hi ${name}, thanks for your reply — I’ll take a look and come back to you shortly.`;
  }

  return `Hi ${name}, just checking in to see if you'd still like to move forward with this job.`;
}

function getAiFollowUpDueState(row: QuoteRequestRow | null) {
  if (!row?.ai_next_action_due_at) return null;
  if (row.ai_thread_status === "customer_replied") return null;

  const followUpCount = Number(row.ai_follow_up_count || 0);
  if (followUpCount >= 2) return null;

  const dueAt = new Date(row.ai_next_action_due_at).getTime();
  if (Number.isNaN(dueAt)) return null;

  if (dueAt > Date.now()) return null;

  return {
    due: true,
    followUpCount,
    label:
      followUpCount === 0 ? "First follow-up due" : "Second follow-up due",
    message:
      followUpCount === 0
        ? "It’s been 24 hours with no reply."
        : "It’s been another 48 hours with no reply.",
  };
}

function buildAiFollowUpReply(
  row: QuoteRequestRow | null,
  followUpCount: number
) {
  const name = titleCase(row?.customer_name) || "there";
  const job = String(row?.job_type || "job").toLowerCase();

  // 1️⃣ First follow-up (soft, friendly)
  if (followUpCount === 0) {
    return `Hi ${name},

Just checking in to see if you’re still looking to go ahead with the ${job}?

No rush — just let me know when you get a chance.

Thanks`;
  }

  // 2️⃣ Second follow-up (more direct, introduces urgency)
  if (followUpCount === 1) {
    return `Hi ${name},

Just following up again on the ${job}. I’ve got some availability coming up, so let me know if you’d like me to get this booked in.

Happy to get this sorted for you.

Thanks`;
  }

  // 3️⃣ Final follow-up (closing tone)
  return `Hi ${name},

Just a final check-in about the ${job}. I’ll assume this is no longer needed unless I hear back, but feel free to message me if you’d still like help.

Thanks`;
}

function getLeftNextAction(params: {
  stage?: string | null;
  estimateStatus?: string | null;
  estimate?: QuickEstimateLite | null;
  hasVisit: boolean;
  missingCount: number;
  score: number;
  replyStatus?: string | null;
}) {
  const {
    stage,
    estimateStatus,
    estimate,
    hasVisit,
    missingCount,
    score,
    replyStatus,
  } = params;

  const status = String(estimateStatus || "").toLowerCase();
  const stageValue = String(stage || "").toLowerCase();
  
  const estimateEngagement = getEstimateEngagementState(estimate);
  const reply = String(replyStatus || "");
  if (stageValue === "lost") {
  return {
    text: "Closed",
    cls: "ff-leftHint ff-leftHintGray",
    type: "hint" as const,
  };
}

  if (stageValue === "won") {
    return {
      text: "Moved to jobs",
      cls: "ff-leftHint ff-leftHintGreen",
      type: "hint" as const,
    };
  }

  if (status === "accepted") {
    return {
      text: "Now in jobs",
      cls: "ff-leftHint ff-leftHintGreen",
      type: "hint" as const,
    };
  }

if (reply === "Customer replied") {
  return {
    text: "Reply now",
    cls: "ff-leftHint ff-leftHintBlue ff-leftHintPulse",
    type: "primary" as const,
  };
}

  if (reply === "Awaiting first reply") {
    return {
      text: "Next: First reply",
      cls: "ff-leftHint ff-leftHintAmber",
      type: "primary" as const,
    };
  }

  if (status === "sent" && estimateEngagement === "viewed") {
    return {
      text: "Next: Chase estimate",
      cls: "ff-leftHint ff-leftHintBlue",
      type: "primary" as const,
    };
  }

  if (status === "sent") {
    return {
      text: "Next: Check estimate",
      cls: "ff-leftHint ff-leftHintBlue",
      type: "primary" as const,
    };
  }

  if (!status && hasVisit) {
    return {
      text: "Create estimate",
      cls: "ff-leftHint ff-leftHintGreen",
      type: "primary" as const,
    };
  }

  if (!status && missingCount >= 2) {
    return {
      text: "Next: Get more info",
      cls: "ff-leftHint ff-leftHintAmber",
      type: "primary" as const,
    };
  }

  if (!hasVisit && score < 65) {
    return {
      text: "Next: Book visit",
      cls: "ff-leftHint ff-leftHintAmber",
      type: "primary" as const,
    };
  }

  return {
    text: "Next: Quote now",
    cls: "ff-leftHint ff-leftHintBlue",
    type: "primary" as const,
  };
}



/* ================================
   SMALL UI
================================ */

function Chip({
  children,
  cls,
}: {
  children: React.ReactNode;
  cls: string;
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1,
    whiteSpace: "nowrap",
    border: "1px solid transparent",
  };

 if (cls.includes("ff-chipBlue")) {
  style.background = "#E7F0FF";
  style.borderColor = "rgba(31,53,92,0.18)";
  style.color = "#16325c";


  } else if (cls.includes("ff-chipGray")) {
    style.background = "#F7F9FC";
    style.borderColor = FF.border;
    style.color = FF.muted;
  } else if (cls.includes("ff-chipRed")) {
    style.background = FF.redSoft;
    style.borderColor = "#FFCACA";
    style.color = "#9F1D1D";
  } else if (cls.includes("ff-chipAmber")) {
    style.background = FF.amberSoft;
    style.borderColor = "#FFD8A8";
    style.color = "#9A5A00";
  } else if (cls.includes("ff-chipGreen")) {
    style.background = FF.greenSoft;
    style.borderColor = "#BDE7CC";
    style.color = "#166534";
  } else {
    style.background = "#fff";
    style.borderColor = FF.border;
    style.color = FF.navySoft;
  }

  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}

function EmptyState({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="ff-empty">
      <div className="ff-emptyTitle">{title}</div>
      {sub ? <div className="ff-emptySub">{sub}</div> : null}
    </div>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="ff-modalOverlay"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="ff-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ff-modalHead">
          <div className="ff-modalTitle">{title}</div>
          <button
            type="button"
            className="ff-x"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="ff-modalBody">{children}</div>
      </div>
    </div>
  );
}


function isAiFollowUpDue(row: QuoteRequestRow | null) {
  if (!row?.ai_next_action_due_at) return false;
  if (row.ai_thread_status === "customer_replied") return false;

  const dueAt = new Date(row.ai_next_action_due_at).getTime();
  if (Number.isNaN(dueAt)) return false;

  return dueAt <= Date.now();
}

/* ================================
   COMPONENT
================================ */

const followUps24h = (customerName: string, jobType: string) => [
  `Hi ${customerName}, just checking you saw the estimate for the ${jobType} — let me know if you want me to go ahead 👍`,
  `Hi ${customerName}, just making sure the ${jobType} estimate came through okay — happy to run through anything`,
];

const followUps48h = (customerName: string, jobType: string) => [
  `Hi ${customerName}, just checking what you thought of the ${jobType} estimate — I’ve got space coming up if you’d like me to get this booked in 👍`,
  `Hi ${customerName}, I’ve got availability for the ${jobType} this week — let me know if you want me to lock this in`,
];

const followUps5d = (customerName: string, jobType: string) => [
  `Hi ${customerName}, just checking if you still want to go ahead with the ${jobType} — I can get this sorted this week 👍`,
  `Hi ${customerName}, I’ll leave this with you, but if you want the ${jobType} booked in just let me know`,
];

export default function EnquiriesClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const requestIdParam = sp.get("requestId");
  const tabParam = sp.get("tab");

  const cleanId = (v?: string | null) => {
    const s = String(v || "").trim();
    if (!s || s === "null" || s === "undefined") return "";
    return s;
  };

  const requestIdFromUrl = cleanId(requestIdParam);
  const urlTab = cleanId(tabParam);

  const [selectedIdState, setSelectedIdState] = useState<string | null>(
    requestIdFromUrl || null
  );

  const selectedId = selectedIdState || requestIdFromUrl;
const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [traderProfile, setTraderProfile] = useState<TraderProfile | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
const [visitBooking, setVisitBooking] = useState(false);

  const [tab, setTab] = useState<ListTab>("all");
 const [searchFilter, setSearchFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [lostReasonFilter, setLostReasonFilter] = useState("");

  const [rows, setRows] = useState<QuoteRequestRow[]>([]);

  const [aiRunStatus, setAiRunStatus] = useState<
  "idle" | "running" | "sent" | "draft" | "error"
>("idle");



const [aiRunMessage, setAiRunMessage] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("details");

  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
const [estimateSent, setEstimateSent] = useState(false);
const [estimateDraftSaved, setEstimateDraftSaved] = useState(false);
  const [thread, setThread] = useState<EnquiryMessageRow[]>([]);
  const [threadMap, setThreadMap] = useState<Record<string, EnquiryMessageRow[]>>({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState<EnquiryMessageRow | null>(null);

  const [custFiles, setCustFiles] = useState<FileItem[]>([]);
  const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
 
const [showDeclineModal, setShowDeclineModal] = useState(false);
const [declineReason, setDeclineReason] = useState("too_busy");
const [declineNote, setDeclineNote] = useState("");
const [declineBusy, setDeclineBusy] = useState(false);
  const [siteVisit, setSiteVisit] = useState<SiteVisitRow | null>(null);
  const [siteVisitLoading, setSiteVisitLoading] = useState(false);
  const [visitMap, setVisitMap] = useState<Record<string, SiteVisitRow | null>>({});
const [customerHistory, setCustomerHistory] = useState<QuoteRequestRow[]>([]);
const [historyLoading, setHistoryLoading] = useState(false);
const [pricingHistory, setPricingHistory] = useState<any[]>([]);
  const [detailedEstimate, setDetailedEstimate] = useState<DetailedEstimateRow | null>(null);
  const [detailedEstimateItems, setDetailedEstimateItems] = useState<DetailedEstimateItemRow[]>([]);
  const [detailedEstimateLoading, setDetailedEstimateLoading] = useState(false);
  const [estimateMap, setEstimateMap] = useState<Record<string, QuickEstimateLite | null>>({});
const [notesSaved, setNotesSaved] = useState(false);
const [replySending, setReplySending] = useState(false);
const [sendAndNextLoading, setSendAndNextLoading] = useState(false);
const [replySent, setReplySent] = useState(false);
const [quickEstimateSending, setQuickEstimateSending] = useState(false);
const [quickEstimateSent, setQuickEstimateSent] = useState(false);
const [siteVisitBooked, setSiteVisitBooked] = useState(false);
const [fileUploading, setFileUploading] = useState(false);
const [fileUploaded, setFileUploaded] = useState(false);
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [siteVisitStartsAt, setSiteVisitStartsAt] = useState("");
  const [siteVisitDuration, setSiteVisitDuration] = useState(60);
  const [siteVisitSending, setSiteVisitSending] = useState(false);
  const [siteVisitMsg, setSiteVisitMsg] = useState<string | null>(null);
const [aiJustUpdatedId, setAiJustUpdatedId] = useState<string | null>(null);
const autoAnalysingRef = useRef<string | null>(null);
const runAutoFollowUpsRef = useRef<() => void>(() => {});
const [autoFollowUpsEnabled, setAutoFollowUpsEnabled] = useState(false);
const [snoozeSaving, setSnoozeSaving] = useState(false);
const [limitCount, setLimitCount] = useState(100);
  const [traderNotes, setTraderNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMsg, setNotesMsg] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("Re:");
  const [replyBody, setReplyBody] = useState("");

  const [estimateSaving, setEstimateSaving] = useState(false);
  const [estimateSending, setEstimateSending] = useState(false);

  const [estimateForm, setEstimateForm] = useState<EstimateFormState>({
    labour: "",
    materials: "",
    callout: "",
    parts: "",
    other: "",
    vatPercent: "20",
    validUntil: "",
    customerMessage: "",
    includedNotes: "",
    excludedNotes: "",
    materialsMarkupType: "percent",
    materialsMarkupPercent: "0",
    materialsMarkupCustom: "",
  });

  const threadBottomRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

const [showCallModal, setShowCallModal] = useState(false);

const [callForm, setCallForm] = useState({
  customer_name: "",
  customer_phone: "",
  job_type: "",
  urgency: "Flexible",
  details: "",
  source: "manual", 
});

  const lastMarkedRef = useRef<string | null>(null);
  const activeEnquiryRef = useRef<HTMLDivElement | null>(null);
  const rightPaneScrollRef = useRef<HTMLDivElement | null>(null);
const messageComposerRef = useRef<HTMLDivElement | null>(null);
const replyBodyRef = useRef<HTMLTextAreaElement | null>(null);
const [scrollToComposerPending, setScrollToComposerPending] = useState(false);

const estimateFormRef = useRef<HTMLDivElement | null>(null);
const [scrollToEstimatePending, setScrollToEstimatePending] = useState(false);

const visitSectionRef = useRef<HTMLDivElement | null>(null);
const [scrollToVisitPending, setScrollToVisitPending] = useState(false);

const [confirmModal, setConfirmModal] = useState<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
} | null>(null);

const [inputModal, setInputModal] = useState<{
  open: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void | Promise<void>;
} | null>(null);

const [inputModalValue, setInputModalValue] = useState("");

function openConfirmModal(args: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  setConfirmModal({
    open: true,
    title: args.title,
    message: args.message,
    confirmLabel: args.confirmLabel || "Confirm",
    danger: args.danger ?? false,
    onConfirm: args.onConfirm,
  });
}

function openInputModal(args: {
  title: string;
  message?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  setInputModalValue("");

  setInputModal({
    open: true,
    title: args.title,
    message: args.message,
    placeholder: args.placeholder,
    submitLabel: args.submitLabel || "Save",
    onSubmit: args.onSubmit,
  });
}
  const selectedRow = useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [rows, selectedId]);

useEffect(() => {
  if (!selectedRow?.id) return;
  if (rightTab !== "details") return;
  if (aiLoadingId) return;

  const alreadyAnalysed =
    !!selectedRow.ai_summary ||
    !!selectedRow.ai_suggested_reply ||
    !!selectedRow.ai_last_processed_at;

  if (alreadyAnalysed) return;
  if (autoAnalysingRef.current === selectedRow.id) return;

  autoAnalysingRef.current = selectedRow.id;
  handleAnalyseEnquiry(selectedRow.id);
}, [
  selectedRow?.id,
  selectedRow?.ai_summary,
  selectedRow?.ai_suggested_reply,
  selectedRow?.ai_last_processed_at,
  rightTab,
  aiLoadingId,
]);

  const materialsBase = num(estimateForm.materials);
  const materialsMarkupPercent =
    estimateForm.materialsMarkupType === "custom"
      ? num(estimateForm.materialsMarkupCustom)
      : num(estimateForm.materialsMarkupPercent);
  const materialsMarkupAmount = materialsBase * (materialsMarkupPercent / 100);
  const materialsSell = materialsBase + materialsMarkupAmount;

  const estimateSubtotal =
    num(estimateForm.labour) +
    materialsSell +
    num(estimateForm.callout) +
    num(estimateForm.parts) +
    num(estimateForm.other);

  const estimateVat = estimateSubtotal * (num(estimateForm.vatPercent) / 100);
  const estimateTotal = estimateSubtotal + estimateVat;

const selectedPhotoCount = selectedRow
  ? selectedRow.photo_count || 0
  : 0;


 

  const selectedMissingInfo = selectedRow
    ? missingInfoList(selectedRow, selectedPhotoCount)
    : [];

  const selectedReadinessItems = selectedRow
    ? quoteReadinessItems(selectedRow, selectedPhotoCount)
    : [];

  const selectedReadinessScore = selectedRow
    ? quoteReadinessScore(selectedRow, selectedPhotoCount)
    : 0;

  const selectedReadinessState = quoteReadinessState(selectedReadinessScore);

const selectedEstimateStatus = selectedRow
  ? estimateMap[selectedRow.id]?.status ||
    (detailedEstimate?.request_id === selectedRow.id ? detailedEstimate?.status : null) ||
    null
  : null;

const selectedAiFollowUpDue = getAiFollowUpDueState(selectedRow);

const estimateCardStatus = (() => {
  const status = String(selectedEstimateStatus || "").toLowerCase();

  if (status === "accepted") {
    return { text: "Accepted", cls: "ff-chip ff-chipGreen" };
  }

  if (status === "sent") {
    return { text: "Sent", cls: "ff-chip ff-chipBlue" };
  }

  if (status === "draft") {
    return { text: "Draft", cls: "ff-chip ff-chipAmber" };
  }

  return { text: "Not created", cls: "ff-chip ff-chipGray" };
})();

const selectedEstimateLabel = selectedEstimateStatus
  ? titleCase(selectedEstimateStatus)
  : "No estimate";


  
const selectedVisit = selectedRow ? visitMap[selectedRow.id] || null : null;

const selectedVisitLabel = selectedVisit
  ? niceDate(selectedVisit.starts_at)
  : "No visit booked";


const selectedDerivedStage = selectedRow
  ? deriveEnquiryStage({
      row: selectedRow,
      estimate: estimateMap[selectedRow.id],
      visit: selectedVisit,
      messages: threadMap[selectedRow.id] || [],
    })
  : null;

const selectedStage = selectedDerivedStage
  ? stageChip(selectedDerivedStage)
  : null;

const selectedEstimateFollow = selectedRow
  ? estimateFollowUp(estimateMap[selectedRow.id])
  : null;

const followUpMap = useMemo(() => {
  const map: Record<string, FollowUpResult> = {};

  for (const row of rows) {
    const estimate = estimateMap[row.id];
    const messages = threadMap[row.id] || [];

    map[row.id] = getFollowUpState({
      enquiry: {
        id: row.id,
        stage: row.stage ?? null,
        created_at: row.created_at,
        snoozed_until: row.snoozed_until ?? null,
        job_booked_at: row.job_booked_at ?? null,
      },
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction === "in" ? "in" : "out",
        created_at: m.created_at,
      })),
      estimate: estimate
        ? {
            id: estimate.id,
            status: estimate.status,
            created_at: estimate.created_at,
            sent_at: estimate.created_at,
            accepted_at: estimate.accepted_at,
            first_viewed_at: estimate.first_viewed_at,
            last_viewed_at: estimate.last_viewed_at,
          }
        : null,
    });
  }


  return map;
}, [rows, estimateMap, threadMap]);

function applySuggestedPrice() {
  if (!pricingInsight) return;

  const total = pricingInsight.suggested;

  const labour = total * 0.6;
  const materials = total * 0.4;

  setEstimateForm((prev) => ({
    ...prev,
    labour: labour.toFixed(0),
    materials: materials.toFixed(0),
    callout: "0",
    parts: "0",
    other: "0",
  }));

  syncRightTab("estimate");
  setScrollToEstimatePending(true);
}

function applySuggestedReply() {
  if (!selectedRow || !pricingInsight) return;

  const name = getCustomerFirstName(selectedRow.customer_name);
  const job = titleCase(selectedRow.job_type || "job");

  const text = `Hi ${name},

Thanks for your enquiry about the ${job}.

Based on the details, this would be around ${money(
    pricingInsight.suggested
  )}.

Let me know if you’d like me to get this booked in 👍`;

  setReplyBody(text);
  setReplySubject(`Re: ${job}`);

  syncRightTab("messages");
  setScrollToComposerPending(true);
}

function createMessageWithPrice() {
  if (!pricingInsight || !selectedRow) return;

const price = pricingInsight?.suggested ?? 0;

const name = getCustomerFirstName(selectedRow.customer_name);
const job = selectedRow?.job_type || "job";

// 💰 derive tone from value
const profit = pricingInsight
  ? Math.round(pricingInsight.suggested * 0.5)
  : 0;

const margin = pricingInsight && pricingInsight.suggested > 0
  ? Math.round((profit / pricingInsight.suggested) * 100)
  : 0;

const band =
  margin >= 60 ? "high" :
  margin >= 40 ? "medium" :
  "low";

// 🧠 smart tone based on job quality
const tone =
  band === "high"
    ? "I’ve got availability to get this sorted quickly 👍"
    : band === "medium"
    ? "Let me know if you'd like me to get this booked in 👍"
    : "Happy to go through a couple of options with you 👍";

// ✉️ final message
const message = `Hi ${name},

For the ${job}, you're looking at around ${money(price)}.

${tone}`;

// 🚀 push to UI
syncRightTab("messages");
setReplyBody(message);
setScrollToComposerPending(true);
}

const customerStats = useMemo(() => {
  const previous = customerHistory.filter(
    (r) => r.id !== selectedRow?.id
  );

  const totalJobs = previous.length;

  let totalValue = 0;

  for (const job of previous) {
    const value = estimateMap?.[job.id]?.total_amount || 0;
    totalValue += value;
  }

  return {
    totalJobs,
    totalValue,
  };
}, [customerHistory, selectedRow?.id, estimateMap]);

const customerInsight = useMemo(() => {
  const previous = customerHistory.filter(
    (r) => r.id !== selectedRow?.id
  );

  if (!previous.length) return null;

  let totalReplyTime = 0;
  let replyCount = 0;

  for (const job of previous) {
    const messages = threadMap?.[job.id] || [];

    let lastOut: Date | null = null;

    for (const m of messages) {
      const isOut = m.direction === "out";

      if (isOut) {
        lastOut = new Date(m.created_at);
      } else if (lastOut) {
        const replyTime =
          new Date(m.created_at).getTime() - lastOut.getTime();

        if (replyTime > 0) {
          totalReplyTime += replyTime;
          replyCount++;
        }

        lastOut = null;
      }
    }
  }

  const avgReplyHours =
    replyCount > 0
      ? totalReplyTime / replyCount / (1000 * 60 * 60)
      : null;

  if (avgReplyHours !== null && avgReplyHours < 2) {
    return {
      text: "⚡ Customer replies quickly — high chance of engagement",
      type: "good",
    };
  }

  if (avgReplyHours !== null && avgReplyHours > 24) {
    return {
      text: "🕓 Slow responder — follow-ups may be needed",
      type: "warn",
    };
  }

  if (customerStats.totalJobs >= 2) {
    return {
      text: "⭐ Repeat customer — more likely to accept",
      type: "good",
    };
  }

  return {
    text: "ℹ️ New or unknown customer behaviour",
    type: "neutral",
  };
}, [customerHistory, selectedRow?.id, threadMap, customerStats]);

const customerHistoryMap = useMemo(() => {
  const map: Record<string, CustomerHistory> = {};

  for (const row of rows) {
    const email = row.customer_email?.toLowerCase().trim();
    if (!email) continue;

    if (!map[email]) {
      map[email] = {
        count: 0,
        jobs: [],
      };
    }

    map[email].count += 1;

    map[email].jobs.push({
      id: row.id,
      job_type: row.job_type,
      created_at: row.created_at,
      stage: row.stage,
    });
  }

 
  Object.keys(map).forEach((email) => {
    map[email].jobs = map[email].jobs
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .slice(0, 3);
  });

  return map;
}, [rows]);

const autoAction = useMemo(() => {
  if (!selectedRow) return null;

  const messages = threadMap?.[selectedRow.id] || [];

  const lastMessage = messages[messages.length - 1];
  const customerName = selectedRow.customer_name
    ? selectedRow.customer_name.split(" ")[0]
    : "there";

  // 🧠 Rules
  if (!messages.length) {
    return {
      title: "Send first reply",
      text: "Customer is waiting — replying quickly increases your chance of winning.",
      message: `Hi ${customerName}, thanks for your enquiry — I’ll take a look and get back to you shortly.`,
    };
  }

  if (lastMessage && lastMessage.direction !== "out") {
    return {
      title: "Reply now",
      text: "Customer has replied — jump back in while they’re engaged.",
      message: `Hi ${customerName}, thanks for your message — I’ll get this sorted for you.`,
    };
  }

  const lastOut = messages
    .filter((m) => m.direction === "out")
    .slice(-1)[0];

  if (lastOut) {
    const hours =
      (Date.now() - new Date(lastOut.created_at).getTime()) /
      (1000 * 60 * 60);

    if (hours > 24) {
      return {
        title: "Follow up",
        text: "No response — a quick follow-up can win this job.",
        message: `Hi ${customerName}, just checking if you’d like me to go ahead with this — happy to help.`,
      };
    }
  }

  return {
    title: "Keep moving",
    text: "Keep the conversation active to secure the job.",
    message: `Hi ${customerName}, just keeping you updated — let me know if you have any questions.`,
  };
}, [selectedRow, threadMap]);

const selectedFollowUp = selectedRow
  ? followUpMap[selectedRow.id]
  : null;

const selectedFollowUpState = selectedRow
  ? followUpMap[selectedRow.id] || null
  : null;

const selectedDisplayedAiAction = getDisplayedAiAction({
  row: selectedRow,
  estimateStatus: selectedEstimateStatus,
  hasVisit: !!selectedVisit,
  derivedStage: selectedDerivedStage,
});

const selectedReplyStatus = useMemo(() => {
  if (!selectedRow) return "Awaiting reply";

  const messages = threadMap[selectedRow.id] || [];
  const hasOutbound = messages.some((m) => isOutboundDirection(m.direction));
  const hasCustomerReply = hasCustomerReplyAfterOutbound(messages);

  if (hasCustomerReply) return "Customer replied";
  if (hasOutbound) return "Awaiting reply";
  return "Awaiting first reply";
}, [selectedRow, threadMap]);

async function moveToJobs() {
  if (!selectedRow) return;

  const nowIso = new Date().toISOString();

  const { data: existingQuote, error: existingQuoteError } = await supabase
    .from("quotes")
    .select("id")
    .eq("request_id", selectedRow.id)
    .maybeSingle();

  if (existingQuoteError) {
    console.error("Quote lookup failed:", existingQuoteError);
    pushToast("Couldn’t check quote record", "error");
    return;
  }

  if (existingQuote?.id) {
    const { error: quoteUpdateError } = await supabase
      .from("quotes")
      .update({
        status: "booked",
      })
      .eq("id", existingQuote.id);

    if (quoteUpdateError) {
      console.error("Quote update failed:", quoteUpdateError);
      pushToast("Couldn’t update quote record", "error");
      return;
    }
  } else {
    const { error: quoteInsertError } = await supabase
      .from("quotes")
      .insert({
        plumber_id: selectedRow.plumber_id,
        request_id: selectedRow.id,
        customer_name: selectedRow.customer_name,
        customer_email: selectedRow.customer_email,
        customer_phone: selectedRow.customer_phone,
        postcode: selectedRow.postcode,
        address: selectedRow.address,
        job_type: selectedRow.job_type,
        urgency: selectedRow.urgency,
        job_details: selectedRow.details,
        status: "booked",
        created_at: nowIso,
      });

    if (quoteInsertError) {
      console.error("Quote insert failed:", quoteInsertError);
      pushToast("Couldn’t create job record", "error");
      return;
    }
  }


  setRows((prev) =>
    prev.map((r) =>
      r.id === selectedRow.id
        ? {
            ...r,
            stage: "won",
            status: "booked",
            job_booked_at: nowIso,
          }
        : r
    )
  );

  pushToast("Moved to jobs");
  router.push(`/dashboard/bookings?requestId=${selectedRow.id}`);
}

async function getCustomerHistoryMap(
  plumberId: string,
  enquiries: QuoteRequestRow[]
) {
  const emails = Array.from(
    new Set(
      enquiries
        .map((e) => e.customer_email?.toLowerCase().trim())
        .filter(Boolean)
    )
  );

  if (!emails.length) return {};

  const { data, error } = await supabase
    .from("quote_requests")
    .select("id, customer_email, created_at")
    .eq("plumber_id", plumberId)
    .in("customer_email", emails);

  if (error || !data) return {};

  const map: Record<string, { count: number }> = {};

  for (const row of data) {
    const email = row.customer_email?.toLowerCase().trim();
    if (!email) continue;

    if (!map[email]) {
      map[email] = { count: 0 };
    }

    map[email].count += 1;
  }

  return map;
}

async function markAsLost(reason: string) {
  if (!selectedRow) return;

  const rowId = selectedRow.id;

  const { error } = await supabase
    .from("quote_requests")
    .update({
      stage: "lost",
      lost_reason: reason,
    })
    .eq("id", rowId);

  if (error) {
    pushToast("Couldn’t mark as lost", "error");
    return;
  }

  setRows((prev) =>
    prev.map((r) =>
      r.id === rowId
        ? { ...r, stage: "lost", lost_reason: reason }
        : r
    )
  );

  pushToast("Marked as lost");
}

const customerValueInsight = useMemo(() => {
  const previous = customerHistory.filter(
    (r) => r.id !== selectedRow?.id
  );

  if (!previous.length) return null;

  let total = 0;
  let count = 0;

  for (const job of previous) {
    const est = estimateMap?.[job.id];

    if (est?.total_amount) {
      total += est.total_amount;
      count++;
    }
  }

  if (!count) return null;

  const avg = total / count;

  let band: "low" | "medium" | "high" = "low";

  if (avg > 1000) band = "high";
  else if (avg > 300) band = "medium";

  return {
    avg,
    band,
    count,
  };
}, [customerHistory, selectedRow?.id, estimateMap]);


const pricingInsight = useMemo(() => {
  if (!customerValueInsight || !selectedRow) return null;

  // 🧠 1. Detect job category
  const category = getJobCategory(
    `${selectedRow.job_type || ""} ${selectedRow.details || ""}`
  );

  // 💰 2. ONLY use WON jobs
  const relevantJobs = pricingHistory.filter((j) => {
    const jobType =
      j.quote_requests?.job_type ||
      j.job_type ||
      "";

    return (
      j.status === "accepted" &&
      getJobCategory(jobType) === category
    );
  });

  const prices = relevantJobs
  .map((j) => j.total || 0)
  .filter(Boolean)
  .sort((a, b) => a - b);

const rangeLow =
  prices.length > 0
    ? prices[Math.floor(prices.length * 0.25)]
    : null;

const rangeHigh =
  prices.length > 0
    ? prices[Math.floor(prices.length * 0.75)]
    : null;

const confidence =
  relevantJobs.length >= 5
    ? "high"
    : relevantJobs.length >= 2
    ? "medium"
    : "low";

  // 📊 3. Average from REAL wins
  const avgFromHistory =
    relevantJobs.length > 0
      ? Math.round(
          relevantJobs.reduce(
            (sum, j) => sum + (j.total || 0),
            0
          ) / relevantJobs.length
        )
      : null;

  // 🎯 4. Base price
  const base = avgFromHistory || customerValueInsight.avg;

  let multiplier = 1;

  const urgency = String(selectedRow.urgency || "").toLowerCase();
  const photos = selectedRow.photo_count || 0;
  const budget = selectedRow.budget;
  const repeatCustomer = customerStats.totalJobs > 0;

  // 🔥 URGENCY
  if (urgency.includes("asap") || urgency.includes("urgent")) {
    multiplier += 0.15;
  }

  // 📸 LOW DETAIL
  if (photos === 0) {
    multiplier -= 0.1;
  }

  // 💰 BUDGET SIGNAL
  if (budget && budget !== "not-sure") {
    const num = parseInt(budget.replace(/\D/g, ""));
    if (!isNaN(num) && num > base) {
      multiplier += 0.1;
    }
  }

  // 🔁 REPEAT CUSTOMER
  if (repeatCustomer) {
    multiplier += 0.05;
  }

  // 🎯 HIGH VALUE CUSTOMER
  if (customerValueInsight.band === "high") {
    multiplier += 0.1;
  }

  const suggested = Math.round(base * multiplier);

  // 💸 COST MODEL
  const LABOUR_COST_RATIO = 0.4;
  const OVERHEAD_RATIO = 0.1;

  const labour = suggested * 0.5;
  const materials = suggested * 0.5;

  const labourCost = labour * LABOUR_COST_RATIO;
  const baseCost = materials + labourCost;
  const overhead = baseCost * OVERHEAD_RATIO;

  const cost = Math.round(baseCost + overhead);
  const profit = suggested - cost;

  const margin =
    suggested > 0
      ? Math.round((profit / suggested) * 100)
      : 0;

return {
  suggested,
  base,
  avgFromHistory, // 👈 important
  multiplier,
  cost,
  profit,
  margin,
  jobsUsed: relevantJobs.length,

  // 👇 NEW (for UI range)
  rangeLow: Math.round(base * 0.85),
  rangeHigh: Math.round(base * 1.15),
};
}, [
  customerValueInsight,
  selectedRow,
  pricingHistory,
  customerStats.totalJobs,
]);

const pricingExplainText = (() => {
  if (!selectedRow || !estimateTotal) return null;

  const sell = estimateTotal || 0;
  const cost = materialsBase || 0;

  const profit = sell - cost;

  const margin =
    sell > 0 ? Math.round((profit / sell) * 100) : 0;

  const urgency = String(selectedRow.urgency || "").toLowerCase();
  const isUrgent =
    urgency.includes("asap") || urgency.includes("urgent");

  const isRepeat = customerStats.totalJobs >= 2;

  const valueBand = customerValueInsight?.band || "medium";

  if (margin < 30) {
    return "⚠️ Low margin — only worth it if it leads to more work";
  }

  if (isUrgent && margin >= 50) {
    return "🔥 Urgent job + strong margin — high value opportunity";
  }

  if (isRepeat && margin >= 40) {
    return "🔁 Repeat customer — good chance they’ll accept";
  }

  if (valueBand === "high" && margin >= 50) {
    return "💰 High-value customer — strong profit potential";
  }

  if (margin >= 60) {
    return "💰 Strong margin — great profit on this job";
  }

  if (margin >= 40) {
    return "👍 Solid pricing — good balance of win rate and profit";
  }

  return "⚡ Competitive price — higher chance of winning this job";
})();

const selectedBestAction = useMemo<BestAction>(() => {
  if (!selectedRow) {
    return {
      title: "No enquiry selected",
      text: "Choose an enquiry to see the best next action.",
      button: null,
    };
  }

  const estimate = estimateMap[selectedRow.id];
  const visit = visitMap[selectedRow.id] || null;
  const messages = threadMap[selectedRow.id] || [];

  const derivedStage = deriveEnquiryStage({
    row: selectedRow,
    estimate,
    visit,
    messages,
  });

  const estimateStatus = String(selectedEstimateStatus || "").toLowerCase();
  const hasVisit = !!visit;
  const hasReply = hasCustomerReplyAfterOutbound(messages);
  const estimateAccepted = estimateStatus === "accepted";
  const estimateSent = estimateStatus === "sent";
  const estimateDraft = estimateStatus === "draft";
  const estimateEngagement = getEstimateEngagementState(estimate);

 const followUpState = selectedRow ? followUpMap[selectedRow.id] : null;

if (selectedDerivedStage === "won") {
  return {
    title: "See job in jobs",
    text: "This enquiry is already booked. Open it in Jobs to manage the appointment, notes, files and customer updates.",
    button: {
      label: "Open job",
      action: () => {
        router.push(`/dashboard/bookings?requestId=${selectedRow.id}`);
      },
    },
  };
}

if (estimateAccepted) {
  return {
    title: "Move to jobs",
    text: "This estimate has been accepted. Move it into Jobs so it becomes part of your live workflow.",
    button: {
      label: "Move to jobs",
      action: () => {
        moveToJobs();
      },
    },
  };
}


if (selectedReplyStatus === "Customer replied") {
  return {
    title: "Reply now",
    text: "The customer replied last, so this enquiry needs your attention before it goes cold.",
    button: {
      label: "Reply now",
action: () => {
  syncRightTab("messages");

  const customerName =
    titleCase(selectedRow.customer_name) || "there";

  const message = `Hi ${customerName}, thanks for your reply — I’ll take a look and get back to you shortly.`;

  setReplyBody(message);

  // 🔥 auto scroll + focus
  setScrollToComposerPending(true);
},
    },
  };
}

if (selectedReplyStatus === "Awaiting first reply") {
  return {
    title: "Send first reply",
    text: "This customer is still waiting for your first response. A quick reply now keeps the enquiry warm.",
button: {
  label: "Reply now",
  action: () => {
    syncRightTab("messages");

    const customerName =
      titleCase(selectedRow.customer_name) || "there";

    setReplyBody(
      `Hi ${customerName}, thanks for your enquiry — I’m just reviewing this now and will come back to you shortly.`
    );

    // 🔥 makes it jump + focus
    setScrollToComposerPending(true);
  },
},
  };
}
const isHighChance =
  selectedReadinessScore >= 80 ||
  hasReply ||
  estimateEngagement === "viewed" ||
  selectedPhotoCount >= 3; // 👈 NEW

if (
  followUpState &&
  (followUpState.status === "follow_up_due" ||
    followUpState.status === "estimate_follow_up_due") &&
  isHighChance
) {
  return {
    title: "Follow up now — high chance of winning",
    text:
      "This enquiry looks strong. The customer has shown interest, so a quick follow-up now could help win the job.",
    button: {
      label: "Send follow-up",
action: () => {
  syncRightTab("messages");

  const customerName =
    titleCase(selectedRow.customer_name) || "there";

  let message = "";
if (selectedPhotoCount >= 3) {
  message = `Hi ${customerName}, thanks for the photos — that really helps. Let me know if you'd like me to get this booked in 👍`;
}
  if (estimateEngagement === "viewed") {
    message = `Hi ${customerName}, just checking you saw the estimate — happy to get this booked in if you're ready 👍`;
  } else if (selectedReadinessScore >= 80) {
    message = `Hi ${customerName}, just checking in — do you want me to get this booked in?`;
  } else {
    message = `Hi ${customerName}, just checking what you thought — let me know if you want me to go ahead 👍`;
  }

  setReplyBody(message);
  setScrollToComposerPending(true);
},
    },
  };
}
if (
  followUpState &&
  (followUpState.status === "follow_up_due" ||
    followUpState.status === "estimate_follow_up_due")
) {
  return {
    title:
      followUpState.status === "estimate_follow_up_due"
        ? "Follow up on estimate"
        : "Follow up now",
    text:
      followUpState.status === "estimate_follow_up_due"
        ? followUpState.label === "Quote going cold"
          ? "This estimate has been sitting for a while with no reply. This is a good time to chase it."
          : followUpState.label === "Chase estimate"
          ? "The estimate has been out for a few days now. A quick nudge could win the job."
          : "The estimate was sent recently and is ready for a follow-up."
        : "You’ve already messaged this customer and they’ve gone quiet. A follow-up now could bring the job back.",
    button: {
      label: "Follow up now",
      action: () => {
        syncRightTab("messages");

        const customerName =
          titleCase(selectedRow.customer_name) || "there";

const jobType = selectedRow.job_type?.toLowerCase() || "job";

let pool = followUps24h(customerName, jobType);

// stronger push (estimate sent, no reply)
if (followUpState.status === "estimate_follow_up_due") {
  pool = followUps48h(customerName, jobType);
}

// going cold (long time no reply)
if (followUpState.status === "follow_up_due") {
  pool = followUps5d(customerName, jobType);
}

// random = feels human
const followUpMessage =
  pool[Math.floor(Math.random() * pool.length)];

setReplyBody(followUpMessage);
setScrollToComposerPending(true);
      },
    },
  };
}

  if (estimateStatus === "sent") {
    return {
      title:
        estimateEngagement === "viewed"
          ? "Chase viewed estimate"
          : "Check estimate received",
      text:
        estimateEngagement === "viewed"
          ? "The customer has viewed the estimate but not accepted yet. This is a good moment to chase."
          : "The estimate has been sent but not viewed yet. A quick check-in could bring it back to the top of their inbox.",
button: {
  label: "Follow up now",
  action: () => {
    syncRightTab("messages");

    const customerName =
      titleCase(selectedRow.customer_name) || "there";

    const message =
      estimateEngagement === "viewed"
        ? `Hi ${customerName}, just checking what you thought of the estimate I sent over. Let me know if you'd like to go ahead or if you'd like me to adjust anything.`
        : `Hi ${customerName}, just checking you received the estimate I sent over. Let me know if you'd like me to talk anything through.`;

    setReplyBody(message);

    // 🔥 THIS is the important part
    setScrollToComposerPending(true);
  },
},
    };
  }

  if (estimateDraft) {
    return {
      title: "Finish estimate",
      text: "You already started a draft. The next step is to finish it and send it to the customer.",
      button: {
        label: "Open estimate",
        action: () => syncRightTab("estimate"),
      },
    };
  }

if (!hasVisit && selectedPhotoCount === 0) {
  return {
    title: "Ask for photos",
    text: "Photos will help you price this faster and more accurately.",
    button: {
      label: "Ask customer",
      action: () => {
        syncRightTab("messages");

        const customerName =
          titleCase(selectedRow.customer_name) || "there";

        setReplyBody(
          `Hi ${customerName}, could you send a couple of photos of the job? That’ll help me give you an accurate price 👍`
        );

        setScrollToComposerPending(true);
      },
    },
  };
}

if (!hasVisit && selectedMissingInfo.length >= 2) {
  return {
    title: "Get missing details",
    text:
      "A couple more details will help you quote this job with more confidence.",
    button: {
      label: "Ask customer",
      action: () => {
        syncRightTab("messages");

        const customerName =
          titleCase(selectedRow.customer_name) || "there";

        setReplyBody(
          `Hi ${customerName}, could you please send:\n- ${selectedMissingInfo.join("\n- ")}`
        );

        setScrollToComposerPending(true);
      },
    },
  };
}

  if (selectedReadinessScore >= 85) {
    return {
      title: "Ready to estimate",
      text: "You’ve got enough information to send pricing with confidence.",
      button: {
        label: "Create estimate",
        action: () => syncRightTab("estimate"),
      },
    };
  }



  if (!hasVisit) {
    return {
      title: "Book a site visit",
      text: "A quick visit will help you quote more accurately and move this forward faster.",
      button: {
        label: "Book visit",
        action: () => {
          syncRightTab("visit");
          setSiteVisitOpen(true);
        },
      },
    };
  }

  return {
    title: "Create estimate",
    text: "This enquiry is ready for the next commercial step: sending the customer a proper estimate.",
    button: {
      label: "Create estimate",
      action: () => syncRightTab("estimate"),
    },
  };
}, [
  selectedRow,
  selectedEstimateStatus,
  selectedVisit,
  selectedReadinessScore,
  selectedPhotoCount,
  selectedMissingInfo,
  estimateMap,
  visitMap,
  threadMap,
  followUpMap,
  selectedReplyStatus,
  router,
  syncRightTab,
  setReplyBody,
  setScrollToComposerPending,
  followUps24h,
  followUps48h,
  followUps5d,
]);

const quickReplies = useMemo(() => {
  const customerName = selectedRow?.customer_name
    ? titleCase(selectedRow.customer_name)
    : "there";

  return [
    `Hi ${customerName}, thanks for your enquiry — I’m just reviewing this now.`,
    `Could you send over a couple more photos so I can price this more accurately?`,
    `Would you like me to book a quick site visit to take a proper look?`,
    `I’ve sent your estimate over — let me know if you’d like to go ahead.`,
    `Just checking in to see if you'd like to move forward with this job.`,
  ];
}, [selectedRow]);


const isAutoFilled = replyBody.trim().startsWith("Hi ");

const lostJobInsights = useMemo(() => {
  const lostRows = rows.filter((r) => r.stage === "lost");

  const reasonCounts = lostRows.reduce<Record<string, number>>((acc, row) => {
    const reason = row.lost_reason || "No reason given";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});

  const topReason = Object.entries(reasonCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];

  return {
    totalLost: lostRows.length,
    topReason: topReason?.[0] || null,
    topReasonCount: topReason?.[1] || 0,
  };
}, [rows]);

const lostJobAdvice = useMemo(() => {
  const reason = (lostJobInsights.topReason || "").toLowerCase();

  if (reason.includes("expensive")) {
    return {
      title: "You're losing jobs on price",
      text: "Try breaking the estimate down clearly or offering a lower-cost first step.",
    };
  }

  if (reason.includes("no response")) {
    return {
      title: "Customers are going quiet",
      text: "Follow up within 24–48 hours. Most quiet leads need a simple nudge.",
    };
  }

  if (reason.includes("another")) {
    return {
      title: "Losing to other quotes",
      text: "Speed matters. Reply quickly and make the next step obvious.",
    };
  }

  if (reason.includes("cancelled")) {
    return {
      title: "Jobs are being cancelled",
      text: "Check whether customers are delaying, changing scope, or losing urgency.",
    };
  }

  return null;
}, [lostJobInsights]);

const lostReasons = useMemo(() => {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    if (row.stage !== "lost" || !row.lost_reason) return acc;

    acc[row.lost_reason] = (acc[row.lost_reason] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({
      reason,
      count,
    }));
}, [rows]);

const salesPulse = useMemo(() => {
const now = new Date();

// ⚡ Needs action
const needsAction = rows.filter((r) => {
const follow = followUpMap[r.id];
return follow?.bucket === "needsAction";
}).length;

// 📉 Lost this week
const lostThisWeek = rows.filter((r) => {
if (r.stage !== "lost") return false;
const created = new Date(r.created_at);
return now.getTime() - created.getTime() < 7 * 24 * 60 * 60 * 1000;
}).length;

// 💰 Value waiting (estimates sent but not accepted)
const valueWaiting = rows.reduce((sum, r) => {
const est = estimateMap[r.id];
if (!est) return sum;

const status = String(est.status || "").toLowerCase();

if (status === "sent") {
return sum + (est.total_amount || 0);
}

return sum;
}, 0);

// 👉 Best move
let bestMove = "Stay on top of replies";

if (needsAction > 0) {
bestMove = "Follow up on active enquiries";
} else if (valueWaiting > 0) {
bestMove = "Chase sent estimates";
}

return {
needsAction,
lostThisWeek,
valueWaiting,
bestMove,
};
}, [rows, followUpMap, estimateMap]);

const moneyCoach = useMemo(() => {
  const lost = rows.filter((r) => r.stage === "lost");

  const noResponseLost = lost.filter((r) =>
    (r.lost_reason || "").toLowerCase().includes("no response")
  ).length;

  const quietLeads = rows.filter((r) => {
    const messages = threadMap[r.id] || [];
    return messages.length > 0 && !hasCustomerReplyAfterOutbound(messages);
  }).length;

  let message = "Everything looks under control today.";

  if (noResponseLost >= 2) {
    message =
      "A few customers have gone quiet recently. A friendly follow-up can often bring these jobs back.";
  } else if (quietLeads >= 3) {
    message =
      "You have a few conversations waiting on customers. A gentle nudge today could help move them forward.";
  } else if (salesPulse.valueWaiting > 0) {
    message =
      "There’s work waiting to be followed up. A quick check-in could help secure it.";
  }

  return { message };
}, [rows, threadMap, salesPulse]);

 const filteredRows = useMemo(() => {
  let out = [...rows];

  if (tab === "unread") {
    out = out.filter((r) => !r.read_at);
  }

if (tab === "needsAction") {
  out = out.filter((r) => {
    return (
      r.ai_thread_status !== "cold_after_follow_up" &&
      followUpMap[r.id]?.bucket === "needsAction"
    );
  });
}

if (tab === "followUp") {
  out = out.filter((r) => {
    return (
      r.ai_thread_status !== "cold_after_follow_up" &&
      followUpMap[r.id]?.bucket === "followUp"
    );
  });
}

if (tab === "cold") {
  out = out.filter((r) => {
    return r.ai_thread_status === "cold_after_follow_up";
  });
}

  if (tab === "waiting") {
  out = out.filter((r) => {
    return followUpMap[r.id]?.bucket === "allGood";
  });
}
if (lostReasonFilter) {
  out = out.filter((r) => r.lost_reason === lostReasonFilter);
}
 if (searchFilter.trim()) {
  const q = searchFilter.trim().toLowerCase();

  out = out.filter((r) => {
    const postcode = String(r.postcode || "").toLowerCase();
    const address = String(r.address || "").toLowerCase();
    const customerName = String(r.customer_name || "").toLowerCase();
    const jobNumber = String(r.job_number || "").toLowerCase();
    const phone = String(r.customer_phone || "").toLowerCase();

    return (
      postcode.includes(q) ||
      address.includes(q) ||
      customerName.includes(q) ||
      jobNumber.includes(q) ||
      phone.includes(q)
    );
  });
}

  if (urgencyFilter) {
    out = out.filter((r) =>
      String(r.urgency || "")
        .toLowerCase()
        .includes(urgencyFilter.toLowerCase())
    );
  }

  return out.sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );
}, [rows, tab, searchFilter, urgencyFilter, lostReasonFilter, followUpMap]);
function getReplyStatus(messages: EnquiryMessageRow[]) {
  const hasOutbound = messages.some((m) => isOutboundDirection(m.direction));
  const hasCustomerReply = hasCustomerReplyAfterOutbound(messages);

  if (hasCustomerReply) return "Customer replied";
  if (hasOutbound) return "Awaiting reply";
  return "Awaiting first reply";
}



const sortedRows = useMemo(() => {
  return [...filteredRows].sort((a, b) => {

    if (a.id === selectedId) return -1;
if (b.id === selectedId) return 1;
    const aEstimate = estimateMap[a.id];
    const bEstimate = estimateMap[b.id];

    const aVisit = visitMap[a.id] || null;
    const bVisit = visitMap[b.id] || null;

    const aMessages = threadMap[a.id] || [];
    const bMessages = threadMap[b.id] || [];

    const aDerivedStage = deriveEnquiryStage({
      row: a,
      estimate: aEstimate,
      visit: aVisit,
      messages: aMessages,
    });

    const bDerivedStage = deriveEnquiryStage({
      row: b,
      estimate: bEstimate,
      visit: bVisit,
      messages: bMessages,
    });

    const aIsWon = aDerivedStage === "won";
    const bIsWon = bDerivedStage === "won";

    if (aIsWon !== bIsWon) return aIsWon ? 1 : -1;

    const aUnread = !a.read_at;
    const bUnread = !b.read_at;

    const aSelected = a.id === selectedId;
    const bSelected = b.id === selectedId;

    const aFollowUp = followUpMap[a.id];
    const bFollowUp = followUpMap[b.id];

    const aReplyStatus = getReplyStatus(aMessages);
    const bReplyStatus = getReplyStatus(bMessages);



const aPhotos = a.photo_count || 0;
const bPhotos = b.photo_count || 0;

const aScore = enquiryScore(a, aPhotos);
const bScore = enquiryScore(b, bPhotos);

const aUrgent =
  String(a.urgency || "").toLowerCase().includes("asap") ||
  String(a.urgency || "").toLowerCase().includes("urgent");

const bUrgent =
  String(b.urgency || "").toLowerCase().includes("asap") ||
  String(b.urgency || "").toLowerCase().includes("urgent");

const valueBoost = (row: QuoteRequestRow) => {
  const band = String(row.ai_job_value_band || "").toLowerCase();

  if (band === "high") return 30;
  if (band === "medium") return 15;
  if (band === "low") return 5;

  const budget = String(row.budget || "").toLowerCase();

  if (budget.includes("3000")) return 30;
  if (budget.includes("1000")) return 25;
  if (budget.includes("500")) return 15;
  if (budget.includes("250")) return 10;

  return 0;
};

const aValueBoost = valueBoost(a);
const bValueBoost = valueBoost(b);



const aAiFollowUpReady =
  a.ai_thread_status === "awaiting_trader_review" &&
  !!a.ai_suggested_reply;

const bAiFollowUpReady =
  b.ai_thread_status === "awaiting_trader_review" &&
  !!b.ai_suggested_reply;

const aHotLead =
  aScore >= 80 &&
  (aReplyStatus === "Customer replied" ||
    aUrgent ||
    String(a.ai_job_value_band || "").toLowerCase() === "high");

const bHotLead =
  bScore >= 80 &&
  (bReplyStatus === "Customer replied" ||
    bUrgent ||
    String(b.ai_job_value_band || "").toLowerCase() === "high");

const aPriority =
  getEnquiryPriority({
    followUp: aFollowUp,
    replyStatus: aReplyStatus,
    estimate: aEstimate,
  }) +
  aScore +
  (aUrgent ? 20 : 0) +
  aValueBoost +
 (aHotLead ? 40 : 0) +
(aAiFollowUpReady ? 50 : 0);

const bPriority =
  getEnquiryPriority({
    followUp: bFollowUp,
    replyStatus: bReplyStatus,
    estimate: bEstimate,
  }) +
  bScore +
  (bUrgent ? 20 : 0) +
  bValueBoost +
 (bHotLead ? 40 : 0) +
(bAiFollowUpReady ? 50 : 0);

if (aAiFollowUpReady !== bAiFollowUpReady) {
  return aAiFollowUpReady ? -1 : 1;
}

    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }

    if (tab === "followUp" && aFollowUp.priority !== bFollowUp.priority) {
      return bFollowUp.priority - aFollowUp.priority;
    }

    if (aUnread && bUnread) {
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    if (aSelected !== bSelected) return aSelected ? -1 : 1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}, [
  filteredRows,
  selectedId,
  tab,
  followUpMap,
  estimateMap,
  visitMap,
  threadMap,
  
]);

const enquiryCounts = useMemo(() => {
  return getEnquiryCounts({
    rows,
    estimateMap,
    visitMap,
    threadMap,
  });
}, [rows, estimateMap, visitMap, threadMap]);

const activeEnquiryRows = useMemo(() => {
  return sortedRows.filter((r) => {
    const estimate = estimateMap[r.id];
    const visit = visitMap[r.id] || null;
    const messages = threadMap[r.id] || [];

    const stage = deriveEnquiryStage({
      row: r,
      estimate,
      visit,
      messages,
    });

    return stage !== "won";
  });
}, [sortedRows, estimateMap, visitMap, threadMap]);

const bookedEnquiryRows = useMemo(() => {
  return sortedRows.filter((r) => {
    const estimate = estimateMap[r.id];
    const visit = visitMap[r.id] || null;
    const messages = threadMap[r.id] || [];

    const stage = deriveEnquiryStage({
      row: r,
      estimate,
      visit,
      messages,
    });

    return stage === "won";
  });
}, [sortedRows, estimateMap, visitMap, threadMap]);

const followUpReadyRows = useMemo(() => {
  return rows.filter((r) => {
    return (
      r.ai_thread_status === "awaiting_trader_review" &&
      !!r.ai_suggested_reply
    );
  });
}, [rows]);

function jumpToNextFollowUp() {
  if (!followUpReadyRows.length) return;

  const next = followUpReadyRows[0];

  selectEnquiry(next.id, "messages");
  setReplyBody(next.ai_suggested_reply || "");
  setScrollToComposerPending(true);
}
const pricingMessage = useMemo(() => {
 if (!selectedRow || estimateTotal <= 0) return null;

const sell = estimateTotal;        // what customer pays
const cost = materialsBase;        // your real cost

const profit = sell - cost;

const margin =
  sell > 0 ? Math.round((profit / sell) * 100) : 0;

  const urgency = String(selectedRow.urgency || "").toLowerCase();
  const isUrgent =
    urgency.includes("asap") || urgency.includes("urgent");

  const isRepeat = customerStats.totalJobs >= 2;

  const valueBand = customerValueInsight?.band || "medium";

  // 🎯 Smart messaging logic
  if (margin < 30) {
    return "⚠️ Low margin — only proceed if this helps win future work";
  }

  if (isUrgent && margin >= 50) {
    return "🔥 Urgent job + strong margin — high value opportunity";
  }

  if (isRepeat && margin >= 40) {
    return "🔁 Repeat customer — good chance they’ll accept";
  }

  if (valueBand === "high" && margin >= 50) {
    return "💰 High-value customer — strong profit potential";
  }

  if (margin >= 60) {
    return "💰 Strong margin — great profit on this job";
  }

  if (margin >= 40) {
    return "👍 Solid pricing — good balance of profit and win rate";
  }

  return "⚡ Competitive price — higher chance of winning this job";
}, [
  estimateTotal,
  materialsBase,
  selectedRow,
  customerStats,
  customerValueInsight
]);

const activeJobsCount = useMemo(() => {
  return rows.filter((row) => {
    const estimate = estimateMap[row.id];
    const visit = visitMap[row.id] || null;
    const messages = threadMap[row.id] || [];

    const stage = deriveEnquiryStage({
      row,
      estimate,
      visit,
      messages,
    });

    const estimateStatus = String(estimate?.status || "").toLowerCase();
    const requestStatus = String(row.status || "").toLowerCase();

    const isActiveJob =
      ["won", "in_progress", "completed"].includes(stage) &&
      (
        !!row.job_booked_at ||
        !!visit ||
        requestStatus === "booked" ||
        requestStatus === "in progress" ||
        requestStatus === "complete" ||
        requestStatus === "completed" ||
        requestStatus === "invoiced" ||
        requestStatus === "paid" ||
        estimateStatus === "accepted"
      );

    return isActiveJob;
  }).length;
}, [rows, estimateMap, visitMap, threadMap]);

function findNextActionRow(currentId?: string) {
  const candidates = rows.filter((r) => {
    if (r.id === currentId) return false;

    const estimate = estimateMap[r.id];
    const visit = visitMap[r.id] || null;
    const messages = threadMap[r.id] || [];

    const stage = deriveEnquiryStage({
      row: r,
      estimate,
      visit,
      messages,
    });

    if (stage === "won" || stage === "lost") return false;

    return true;
  });

  const scored = candidates.map((r) => {
    const estimate = estimateMap[r.id];
    const messages = threadMap[r.id] || [];

    let score = 0;

    const replyStatus = hasCustomerReplyAfterOutbound(messages)
      ? "customer_replied"
      : messages.some((m) => isOutboundDirection(m.direction))
      ? "awaiting_reply"
      : "needs_reply";

    if (replyStatus === "customer_replied") score += 50;
    if (replyStatus === "needs_reply") score += 30;

    if (String(r.urgency || "").toLowerCase().includes("asap")) score += 25;

    if (r.ai_job_value_band === "high") score += 20;

    if (estimate?.status === "sent") score += 15;

    return { row: r, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.row || null;
}
  /* ================================
     LOCAL HELPERS
  ================================= */

  function buildDeclineMessage(reason: string) {
  const name = selectedRow?.customer_name || "there";
  const traderName = traderProfile?.display_name || "the team";

  if (reason === "too_busy") {
    return `Hi ${name},

Thanks for getting in touch.

Unfortunately, we’re fully booked at the moment and won’t be able to take this job on.

We really appreciate you contacting us and wish you the best getting the work sorted.

Kind regards,
${traderName}`;
  }

  if (reason === "outside_area") {
    return `Hi ${name},

Thanks for your enquiry.

Unfortunately, this job is outside the area we currently cover, so we won’t be able to help on this occasion.

We appreciate you getting in touch and hope you get it sorted quickly.

Kind regards,
${traderName}`;
  }

  return `Hi ${name},

Thanks for your enquiry.

After reviewing the job, we don’t think we’re the right fit for this particular work, so we won’t be progressing further.

We appreciate you contacting us and wish you all the best.

Kind regards,
${traderName}`;
}

function getCustomerFirstName(name?: string | null) {
  const first = String(name || "").trim().split(/\s+/)[0];
  return first ? titleCase(first) : "there";
}

function pushToast(text: string, type: "success" | "error" = "success") {
  setToast({ text, type });

  if (toastTimerRef.current) {
    window.clearTimeout(toastTimerRef.current);
  }

  toastTimerRef.current = window.setTimeout(() => {
    setToast(null);
    toastTimerRef.current = null;
  }, 2800);
}

 function selectEnquiry(id: string, tabOverride?: RightTab) {
  setSelectedIdState(id);

  const nextTab = tabOverride || "details";

  const params = new URLSearchParams(sp.toString());

  params.set("requestId", id);
  params.set("tab", nextTab);

  router.replace(`/dashboard/enquiries?${params.toString()}`, {
    scroll: false,
  });

  setRightTab(nextTab);
}

  function clearSelected() {
    setSelectedIdState(null);
    const params = new URLSearchParams(sp.toString());
    params.delete("requestId");
    params.delete("tab");
    router.replace(
      `/dashboard/enquiries${params.toString() ? `?${params.toString()}` : ""}`
    );
  }

function syncRightTab(next: RightTab) {
  setRightTab(next);

  const params = new URLSearchParams(sp.toString());
  if (selectedId) params.set("requestId", selectedId);
  params.set("tab", next);

  router.replace(`/dashboard/enquiries?${params.toString()}`, {
    scroll: false,
  });
}
function openFollowUpComposer(params: {
  customerName?: string | null;
  status?: string | null;
}) {
  syncRightTab("messages");
  setReplyBody(
    getFollowUpMessage({
      customerName: params.customerName,
      status: params.status,
    })
  );
  setScrollToComposerPending(true);
}

function getAiActionMeta(action: string | null) {
  const a = String(action || "").toLowerCase();

  if (a.includes("reply")) {
    return { text: "Message customer", cls: "ff-leftHint ff-leftHintBlue" };
  }

  if (a.includes("visit")) {
    return { text: "Book visit", cls: "ff-leftHint ff-leftHintBlue" };
  }

  if (a.includes("estimate")) {
    return { text: "Create estimate", cls: "ff-leftHint ff-leftHintGreen" };
  }

  return null;
}

function getAiButtonClass(
  action: string | null,
  target: "messages" | "visit" | "estimate"
): string {
  const value = String(action || "").toLowerCase();

  if (
    target === "messages" &&
    (value.includes("reply") || value.includes("follow"))
  ) {
    return "ff-btnAiActive ff-btnPulse";
  }

  if (target === "visit" && value.includes("visit")) {
    return "ff-btnAiActive ff-btnPulse";
  }

  if (target === "estimate" && value.includes("estimate")) {
    return "ff-btnAiActive ff-btnPulse";
  }

  return "";
}

function getDisplayedAiAction(params: {
  row: QuoteRequestRow | null;
  estimateStatus?: string | null;
  hasVisit?: boolean;
  derivedStage?: string | null;
}): QuoteRequestRow["ai_recommended_action"] | "follow_up" | null {
  const { row, estimateStatus, hasVisit, derivedStage } = params;

  if (!row) return null;

  const estimate = String(estimateStatus || "").toLowerCase();

  if (derivedStage === "won") return null;

  if (hasVisit) {
    if (estimate === "sent") return "follow_up";
    if (estimate === "draft") return "send_estimate";
    if (!estimate) return "send_estimate";
  }

  if (estimate === "sent") return "follow_up";

  return row.ai_recommended_action;
}
  /* ================================
     LOADERS
  ================================= */

async function handleRunAiEngine(enquiryId: string) {
  try {
    setAiRunStatus("running");
    setAiRunMessage("AI assistant is analysing the enquiry…");

    const res = await fetch("/api/ai/run-enquiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enquiryId }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to run AI");
    }

    const action = data?.decision?.recommended_action;

    if (data?.sent) {
      setAiRunStatus("sent");

      if (action === "ask_for_details") {
        setAiRunMessage("Asked the customer for more details and photos");
      } else if (action === "ask_for_photos") {
        setAiRunMessage("Asked the customer to send photos");
      } else if (action === "follow_up") {
        setAiRunMessage("Sent a follow-up to the customer");
      } else if (action === "book_visit") {
        setAiRunMessage("Asked the customer for visit availability");
      } else if (action === "send_estimate") {
        setAiRunMessage("Prompted the customer about the estimate");
      } else {
        setAiRunMessage("AI contacted the customer");
      }
    } else {
      setAiRunStatus("draft");

      if (action === "ask_for_details") {
        setAiRunMessage("AI decided more details are needed before quoting");
      } else if (action === "follow_up") {
        setAiRunMessage("AI prepared a follow-up for this enquiry");
      } else if (action === "book_visit") {
        setAiRunMessage("AI decided this needs a visit");
      } else if (action === "send_estimate") {
        setAiRunMessage("AI decided an estimate should be sent");
      } else {
        setAiRunMessage("AI updated the next step");
      }
    }

    setTimeout(() => {
      window.location.reload();
    }, 1200);

  } catch (err) {
    console.error("run AI error", err);
    setAiRunStatus("error");
    setAiRunMessage("Something went wrong. Try again.");
  }
}

  async function loadTraderProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name,business_name,logo_url")
      .eq("id", userId)
      .maybeSingle();

    setTraderProfile((data as TraderProfile) || null);
  }

async function loadEstimateMap(userId: string) {
  const { data, error } = await supabase
    .from("estimates")
    .select(
      "id, request_id, status, total, accepted_at, created_at, first_viewed_at, last_viewed_at, plumber_id"
    )
    .eq("plumber_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadEstimateMap error:", error);
    return;
  }

  const map: Record<string, QuickEstimateLite | null> = {};

for (const row of (data || []) as any[]) {
  if (!row.request_id) continue;

  if (!map[row.request_id]) {
    map[row.request_id] = {
      id: row.id,
      request_id: row.request_id,
      status: row.status || "draft",
      total_amount: Number(row.total || 0),
      accepted_at: row.accepted_at || null,
      created_at: row.created_at,
      first_viewed_at: row.first_viewed_at || null,
      last_viewed_at: row.last_viewed_at || null,
    };
  }
}

  setEstimateMap(map);
}

  async function loadVisitMap(userId: string) {
    const { data, error } = await supabase
      .from("site_visits")
      .select("*")
      .eq("plumber_id", userId)
      .order("starts_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const map: Record<string, SiteVisitRow | null> = {};
    for (const row of (data || []) as SiteVisitRow[]) {
      if (!map[row.request_id]) map[row.request_id] = row;
    }
    setVisitMap(map);
  }



  async function markRead(requestId: string) {
    if (!requestId || lastMarkedRef.current === requestId) return;

    lastMarkedRef.current = requestId;

    const { error } = await supabase
      .from("quote_requests")
      .update({ read_at: new Date().toISOString() })
      .eq("id", requestId)
      .is("read_at", null);

    if (!error) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, read_at: r.read_at || new Date().toISOString() }
            : r
        )
      );
    }
  }

async function loadThread(requestId: string, userId: string) {
  setThreadLoading(true);

  const { data, error } = await supabase
    .from("enquiry_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setThread([]);
    setThreadLoading(false);
    return;
  }

  const messages = (data || []) as EnquiryMessageRow[];

  console.log("THREAD MESSAGES:", messages);

  setThread(messages);
  setThreadMap((prev) => ({
    ...prev,
    [requestId]: messages,
  }));

  setThreadLoading(false);

  requestAnimationFrame(() => {
    threadBottomRef.current?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
    });
  });
}

  async function loadThreadMapForRows(
  requests: QuoteRequestRow[],
  userId: string
) {
  if (!requests.length) {
    setThreadMap({});
    return;
  }

  const requestIds = requests.map((r) => r.id);

const { data, error } = await supabase
  .from("enquiry_messages")
  .select("*")
  .in("request_id", requestIds)
  .order("created_at", { ascending: true });

  if (error) {
    console.error("loadThreadMapForRows error:", error?.message, error);
    return;
  }

  const grouped: Record<string, EnquiryMessageRow[]> = {};

  for (const row of (data || []) as EnquiryMessageRow[]) {
    if (!grouped[row.request_id]) grouped[row.request_id] = [];
    grouped[row.request_id].push(row);
  }

  setThreadMap(grouped);
}

  async function loadFiles(requestId: string) {
    setFilesLoading(true);
    setFileMsg(null);

    try {
      const [custRes, traderRes] = await Promise.all([
        supabase.storage.from(BUCKET).list(customerFolder(requestId), {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        }),
        supabase.storage.from(BUCKET).list(traderFolder(requestId), {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        }),
      ]);

      const makeSignedItems = async (
        folder: string,
        items: { name: string; metadata?: any; created_at?: string | null }[]
      ) => {
        const paths = items.map((f) => `${folder}/${f.name}`);
        if (!paths.length) return [];

        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(paths, 60 * 60);

        return items.map((f, i) => ({
          name: f.name,
          path: `${folder}/${f.name}`,
          url: signed?.[i]?.signedUrl || null,
          size: f.metadata?.size || null,
          created_at: f.created_at || null,
        })) as FileItem[];
      };

      const customerItems = await makeSignedItems(
        customerFolder(requestId),
        (custRes.data || []) as any[]
      );

      const traderItems = await makeSignedItems(
        traderFolder(requestId),
        (traderRes.data || []) as any[]
      );

      setCustFiles(customerItems);
      setTraderFiles(traderItems);
    } catch (e) {
      console.error(e);
      setFileMsg("Couldn’t load files");
    }

    setFilesLoading(false);
  }

  async function loadSiteVisit(requestId: string) {
    setSiteVisitLoading(true);

    const { data, error } = await supabase
      .from("site_visits")
      .select("*")
      .eq("request_id", requestId)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setSiteVisit(null);
      setSiteVisitLoading(false);
      return;
    }

    setSiteVisit((data as SiteVisitRow) || null);
    setSiteVisitLoading(false);
  }

  async function loadDetailedEstimate(requestId: string) {
    setDetailedEstimateLoading(true);

    const { data: est, error: estErr } = await supabase
      .from("estimates")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (estErr) {
      console.error(estErr);
      setDetailedEstimate(null);
      setDetailedEstimateItems([]);
      setDetailedEstimateLoading(false);
      return;
    }

    const estimate = (est as DetailedEstimateRow) || null;
    setDetailedEstimate(estimate);

    if (!estimate?.id) {
      setDetailedEstimateItems([]);
      setDetailedEstimateLoading(false);
      return;
    }

    const { data: items, error: itemsErr } = await supabase
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", estimate.id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      console.error(itemsErr);
      setDetailedEstimateItems([]);
      setDetailedEstimateLoading(false);
      return;
    }

    setDetailedEstimateItems((items || []) as DetailedEstimateItemRow[]);
    setDetailedEstimateLoading(false);
  }

async function handleAnalyseEnquiry(enquiryId: string) {
  try {
    setAiLoadingId(enquiryId);



  const {
  data: { session },
} = await supabase.auth.getSession();

const accessToken = session?.access_token;

const res = await fetch("/api/ai/analyse-enquiry", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ enquiryId }),
});

    const data = await res.json();

    if (!res.ok) {
      console.error("AI analyse failed:", res.status, data);
      alert(data?.error || `Failed to analyse enquiry (${res.status})`);
      return;
    }

    const patch = {
      ai_urgency_score: data.ai_urgency_score,
      ai_job_value_band: data.ai_job_value_band,
      ai_conversion_score: data.ai_conversion_score,
      ai_recommended_action: data.ai_recommended_action,
      ai_summary: data.ai_summary,
      ai_suggested_reply: data.ai_suggested_reply,
      ai_last_processed_at: data.ai_last_processed_at,
    };

    setRows((prev) =>
      prev.map((row) =>
        row.id === enquiryId
          ? {
              ...row,
              ...patch,
            }
          : row
      )
    );

    setAiJustUpdatedId(enquiryId);

    window.setTimeout(() => {
      setAiJustUpdatedId((prev) => (prev === enquiryId ? null : prev));
    }, 2200);
  } catch (error) {
    console.error("AI analyse error:", error);
    alert(
  error instanceof Error
    ? error.message
    : "Something went wrong analysing this enquiry"
);
  } finally {
    setAiLoadingId(null);
  }
}

async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  if (!selectedRow || !uid) return;

  const file = e.target.files?.[0];
  if (!file) return;

  try {
    setFileUploading(true);
    setFileUploaded(false);

   const filePath = `${customerFolder(selectedRow.id)}/${Date.now()}_${safeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("quote-files")
      .upload(filePath, file);

if (uploadError) throw uploadError;


await supabase
.from("quote_requests")
.update({
photo_count: (selectedRow.photo_count || 0) + 1,
})
.eq("id", selectedRow.id);

setRows((prev) =>
prev.map((r) =>
r.id === selectedRow.id
? { ...r, photo_count: (r.photo_count || 0) + 1 }
: r
)
);



    // optional: save metadata
    const { error: insertError } = await supabase.from("job_files").insert({
      request_id: selectedRow.id,
      plumber_id: uid,
      path: filePath,
      file_name: file.name,
      area: "customer",
      label: "other",
    });

    if (insertError) throw insertError;

    await loadFiles(selectedRow.id);

    // ✅ success state
    setFileUploaded(true);
    window.setTimeout(() => {
      setFileUploaded(false);
    }, 2000);

    pushToast("File uploaded");
  } catch (err) {
    console.error(err);
    pushToast("Upload failed", "error");
  } finally {
    setFileUploading(false);
  }
}
  /* ================================
     ACTIONS
  ================================= */

async function snoozeEnquiry(days: number) {
  if (!selectedRow) return;

  setSnoozeSaving(true);

  try {
    const until = new Date();
    until.setDate(until.getDate() + days);
    until.setHours(9, 0, 0, 0);

    const iso = until.toISOString();

    const { error } = await supabase
      .from("quote_requests")
      .update({ snoozed_until: iso })
      .eq("id", selectedRow.id);

    if (error) throw error;

    setRows((prev) =>
      prev.map((r) =>
        r.id === selectedRow.id ? { ...r, snoozed_until: iso } : r
      )
    );

    pushToast("Follow-up snoozed");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t snooze enquiry", "error");
  } finally {
    setSnoozeSaving(false);
  }
}

async function clearSnooze() {
  if (!selectedRow) return;

  setSnoozeSaving(true);

  try {
    const { error } = await supabase
      .from("quote_requests")
      .update({ snoozed_until: null })
      .eq("id", selectedRow.id);

    if (error) throw error;

    setRows((prev) =>
      prev.map((r) =>
        r.id === selectedRow.id ? { ...r, snoozed_until: null } : r
      )
    );

    pushToast("Snooze cleared");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t clear snooze", "error");
  } finally {
    setSnoozeSaving(false);
  }
}

async function updateStage(nextStage: string) {
  if (!selectedRow) return;

  const { error } = await supabase
    .from("quote_requests")
    .update({ stage: nextStage })
    .eq("id", selectedRow.id);

  if (error) {
    console.error(error);
    pushToast("Couldn’t update stage", "error");
    return;
  }

  setRows((prev) =>
    prev.map((r) =>
      r.id === selectedRow.id ? { ...r, stage: nextStage } : r
    )
  );

  pushToast("Stage updated");
}

async function saveTraderNotes() {
  if (!selectedRow || !uid) return;

  try {
    setNotesSaving(true);
    setNotesSaved(false);

    const { error } = await supabase
      .from("quote_requests")
      .update({
        trader_notes: traderNotes,
      })
      .eq("id", selectedRow.id)
      .eq("plumber_id", uid);

    if (error) throw error;

    setNotesSaved(true);
    window.setTimeout(() => {
      setNotesSaved(false);
    }, 2000);

    pushToast("Notes saved");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t save notes", "error");
  } finally {
    setNotesSaving(false);
  }
}

async function onUploadTraderFiles(
  e: React.ChangeEvent<HTMLInputElement>
) {
  if (!selectedRow || !e.target.files?.length) return;

  setUploading(true);
  setFileUploaded(false);
  setFileMsg(null);

  try {
    for (const file of Array.from(e.target.files)) {
      const path = `${traderFolder(selectedRow.id)}/${Date.now()}-${safeFileName(
        file.name
      )}`;

      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;
    }

    await loadFiles(selectedRow.id);

    setFileUploaded(true);
    window.setTimeout(() => {
      setFileUploaded(false);
    }, 2000);

    pushToast("Files uploaded");
  } catch (err) {
    console.error(err);
    setFileMsg("Upload failed");
    pushToast("Upload failed", "error");
  } finally {
    setUploading(false);
    e.target.value = "";
  }
}
async function deleteTraderFile(path: string) {
  if (!selectedRow) return;

  const rowId = selectedRow.id;

  openConfirmModal({
    title: "Delete file?",
    message: "This will permanently remove this uploaded file.",
    confirmLabel: "Delete file",
    danger: true,
    onConfirm: async () => {
      const { error } = await supabase.storage.from(BUCKET).remove([path]);

      if (error) {
        console.error(error);
        pushToast("Couldn’t delete file", "error");
        return;
      }

      await loadFiles(rowId);
      pushToast("File deleted", "success");
    },
  });
}

function openSiteVisitModal() {
  setSiteVisitMsg(null);

  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);

  const fallback = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(
    now.getHours()
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (!siteVisitStartsAt) setSiteVisitStartsAt(fallback);
  setSiteVisitOpen(true);
}

async function bookSiteVisit() {
  if (!selectedRow || !uid || !siteVisitStartsAt) return;

  const customerEmail = String(selectedRow.customer_email || "").trim();

if (!customerEmail || !customerEmail.includes("@")) {
  setSiteVisitMsg("Customer email is missing or invalid");
  return;
}


  setSiteVisitSending(true);
  setSiteVisitBooked(false);
  setSiteVisitMsg(null);

  try {
    const res = await fetch(SITE_VISIT_BOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
body: JSON.stringify({
  requestId: selectedRow.id,
  plumberId: uid,
  startsAtLocal: siteVisitStartsAt,
  durationMins: siteVisitDuration,
  customerEmail,
  customerName: selectedRow.customer_name,
  traderName:
    traderProfile?.business_name ||
    traderProfile?.display_name ||
    "Your trader",
}),
    });

    const json = await res.json().catch(() => null);

console.log("response json:", json);

if (!res.ok) {
  throw new Error(json?.error || "Booking failed");
}

    await loadSiteVisit(selectedRow.id);
    await loadVisitMap(uid);

    setSiteVisitOpen(false);
    syncRightTab("visit");

    if (
      selectedDerivedStage === "new" ||
      selectedDerivedStage === "contacted"
    ) {
      const bookedAtIso = new Date(siteVisitStartsAt).toISOString();

      const { error } = await supabase
        .from("quote_requests")
.update({
  stage: "visit_booked",
  status: "open",
  job_booked_at: null,
})
        .eq("id", selectedRow.id);

      if (error) {
        console.error("bookSiteVisit error:", error);
        pushToast("Couldn’t update booking status", "error");
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === selectedRow.id
              ? {
                  ...r,
                 stage: "visit_booked",
status: "open",
job_booked_at: null,
                }
              : r
          )
        );
      }
    }

    setSiteVisitBooked(true);
    window.setTimeout(() => {
      setSiteVisitBooked(false);
    }, 2000);

    pushToast("Site visit booked");
  } catch (err: any) {
    console.error(err);
    setSiteVisitMsg(err?.message || "Couldn’t book visit");
  } finally {
    setSiteVisitSending(false);
  }
}

async function sendReply() {
  if (!selectedRow || !uid) return;
  if (!replyTo.trim() || !replyBody.trim()) return;

  try {
    setReplySending(true);
    setReplySent(false);

    const wasAiFollowUp =
      selectedRow.ai_thread_status === "awaiting_trader_review" &&
      !!selectedRow.ai_suggested_reply;

    const res = await fetch("/api/enquiries/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: selectedRow.id,
        plumberId: uid,
        to: replyTo.trim(),
        subject:
          replySubject.trim() || `Re: ${selectedRow.job_type || "Your enquiry"}`,
        body: replyBody.trim(),
        customerName: selectedRow.customer_name,
        isFollowUp: wasAiFollowUp,
        followUpNumber: wasAiFollowUp
          ? (selectedRow.ai_follow_up_count || 0) + 1
          : null,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.error || "Couldn’t send");
    }

    const nextFollowUpCount = wasAiFollowUp
      ? (selectedRow.ai_follow_up_count || 0) + 1
      : selectedRow.ai_follow_up_count || 0;

    const isFinalFollowUp = wasAiFollowUp && nextFollowUpCount >= 3;

    await supabase
      .from("quote_requests")
      .update({
        ai_thread_status: isFinalFollowUp
          ? "cold_after_follow_up"
          : "awaiting_customer_reply",
        ai_suggested_reply: null,
        ai_follow_up_count: nextFollowUpCount,
        ai_next_action_due_at:
          wasAiFollowUp && !isFinalFollowUp
            ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            : selectedRow.ai_next_action_due_at ?? null,
        ai_last_ai_message_at: new Date().toISOString(),
      })
      .eq("id", selectedRow.id);

    setRows((prev) =>
      prev.map((r) =>
        r.id === selectedRow.id
          ? {
              ...r,
              ai_thread_status: isFinalFollowUp
                ? "cold_after_follow_up"
                : "awaiting_customer_reply",
              ai_suggested_reply: null,
              ai_follow_up_count: nextFollowUpCount,
              ai_next_action_due_at:
                wasAiFollowUp && !isFinalFollowUp
                  ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                  : r.ai_next_action_due_at ?? null,
            }
          : r
      )
    );

    setReplyBody("");
    await loadThread(selectedRow.id, uid);

    if (String(selectedRow.stage || "").toLowerCase() === "new") {
      await updateStage("contacted");
    }

    setReplySent(true);
    window.setTimeout(() => setReplySent(false), 2000);

    pushToast(wasAiFollowUp ? "Follow-up sent" : "Message sent");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t send message", "error");
  } finally {
    setReplySending(false);
  }
}
async function deleteEnquiry() {
  if (!selectedRow) return;

  openConfirmModal({
    title: "Delete enquiry?",
    message: "Delete this enquiry and all related messages? This cannot be undone.",
    confirmLabel: "Delete enquiry",
    danger: true,
 onConfirm: async () => {
if (!selectedRow) return;
const rowId = selectedRow!.id;

      const { error } = await supabase
        .from("quote_requests")
        .delete()
        .eq("id", rowId);

      if (error) {
        console.error(error);
        pushToast("Couldn’t delete enquiry", "error");
        return;
      }

      const remaining = rows.filter((r) => r.id !== rowId);
      setRows(remaining);

      setThreadMap((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });

      setVisitMap((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });

      setEstimateMap((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });

     

      if (remaining.length) {
        selectEnquiry(remaining[0].id);
      } else {
        clearSelected();
      }

      pushToast("Enquiry deleted", "success");
    },
  });
}
async function handleDeclineEnquiry() {
  if (!selectedRow || !uid) return;

  try {
    setDeclineBusy(true);

    const message = buildDeclineMessage(declineReason);

    // send message using your existing reply box flow
setReplyBody(message);
setReplyTo(selectedRow.customer_email || "");
setReplySubject(`Re: ${selectedRow.job_type || "Your enquiry"}`);

await sendReply();

    const { error } = await supabase
      .from("quote_requests")
      .update({
        status: "declined",
        stage: "lost",
        declined_at: new Date().toISOString(),
        decline_reason: declineReason,
        decline_note: declineNote || null,
        ai_thread_status: "closed_declined",
      })
      .eq("id", selectedRow.id)
      .eq("plumber_id", uid);

    if (error) throw error;

    setRows((prev) =>
      prev.map((r) =>
        r.id === selectedRow.id
          ? {
              ...r,
              status: "declined",
              stage: "lost",
              declined_at: new Date().toISOString(),
              decline_reason: declineReason,
              decline_note: declineNote || null,
              ai_thread_status: "closed_declined",
            }
          : r
      )
    );

    setShowDeclineModal(false);
    pushToast("Polite decline prepared", "success");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t decline enquiry", "error");
  } finally {
    setDeclineBusy(false);
  }
}
async function saveDetailedEstimate(
  status: "draft" | "sent" = "draft",
  opts?: { showToast?: boolean }
) {
  if (!selectedRow || !uid) return false;

  const showToast = opts?.showToast ?? true;
  setEstimateSaving(true);

  try {
    const payload = {
      request_id: selectedRow.id,
      user_id: uid,
      plumber_id: uid,
      status,
      labour: num(estimateForm.labour),
      materials: materialsSell,
      callout: num(estimateForm.callout),
      parts: num(estimateForm.parts),
      other: num(estimateForm.other),
      subtotal: estimateSubtotal,
      vat: estimateVat,
      total: estimateTotal,
      valid_until: estimateForm.validUntil || null,
      customer_message: estimateForm.customerMessage || null,
      included_notes: estimateForm.includedNotes || null,
      excluded_notes: estimateForm.excludedNotes || null,
    };

    const { data, error } = await supabase
      .from("estimates")
      .upsert(payload, {
        onConflict: "request_id,user_id",
      })
      .select("*")
      .single();

    if (error) throw error;

    await loadDetailedEstimate(selectedRow.id);
    await loadEstimateMap(uid);

    if (status === "sent") {
      await updateStage("estimate_sent");
    }

    if (showToast) {
      pushToast(status === "draft" ? "Estimate saved" : "Estimate updated");
    }

    return data?.id || true;
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t save estimate", "error");
    return false;
  } finally {
    setEstimateSaving(false);
  }
}

async function sendEstimate() {
  if (!selectedRow || !uid) return;

  setEstimateSending(true);
  setEstimateSent(false);
  setEstimateDraftSaved(false);

  try {
    const savedEstimateId = await saveDetailedEstimate("draft", {
      showToast: false,
    });

    if (!savedEstimateId) {
      throw new Error("Couldn’t save estimate before sending");
    }

    const estimateIdToSend =
      typeof savedEstimateId === "string"
        ? savedEstimateId
        : detailedEstimate?.id || estimateMap[selectedRow.id]?.id;

    if (!estimateIdToSend) {
      throw new Error("Couldn’t find estimate to send");
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token || "";

    if (!accessToken) {
      throw new Error("You are not authenticated");
    }

    const res = await fetch("/api/estimates/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requestId: selectedRow.id,
        estimateId: estimateIdToSend,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.error || "Couldn’t send estimate email");
    }

    setEstimateMap((prev) => ({
      ...prev,
      [selectedRow.id]: prev[selectedRow.id]
        ? { ...prev[selectedRow.id]!, status: "sent" }
        : prev[selectedRow.id],
    }));

    setDetailedEstimate((prev) =>
      prev ? { ...prev, status: "sent" } : prev
    );

    await updateStage("estimate_sent");
    await loadDetailedEstimate(selectedRow.id);
    await loadEstimateMap(uid);

    setEstimateSent(true);
    window.setTimeout(() => {
      setEstimateSent(false);
    }, 2000);

    pushToast(`Estimate sent to ${selectedRow.customer_email || "customer"}`);
  } catch (err: any) {
    console.error("sendEstimate failed:", err);
    pushToast(err?.message || "Couldn’t send estimate", "error");
  } finally {
    setEstimateSending(false);
  }
}

async function saveEstimateDraft() {
  try {
    setEstimateDraftSaved(false);

    const saved = await saveDetailedEstimate("draft", { showToast: true });

    if (!saved) {
      throw new Error("Couldn’t save estimate draft");
    }

    setEstimateDraftSaved(true);
    window.setTimeout(() => {
      setEstimateDraftSaved(false);
    }, 2000);
  } catch (err) {
    console.error("saveEstimateDraft failed:", err);
  }
}

async function downloadEstimatePdf() {
  if (!selectedRow) return;
  pushToast("PDF download can be wired to your existing estimate PDF route");
}



function fillEstimateFromRequest() {
  if (!selectedRow) return;

  const urgency = String(selectedRow.urgency || "").toLowerCase();
  const isEmergency = urgency.includes("asap");

  setEstimateForm((prev) => ({
    ...prev,
    labour: prev.labour || (isEmergency ? "120" : "85"),
    callout: prev.callout || (isEmergency ? "95" : "0"),
    materials: prev.materials || "40",
    parts: prev.parts || "0",
    other: prev.other || "0",
    customerMessage:
      prev.customerMessage ||
      `Hi ${titleCase(selectedRow.customer_name) || ""}, thanks for your enquiry. Please find your estimate below.`,
    includedNotes:
      prev.includedNotes ||
      "Labour, standard installation time and materials listed.",
    excludedNotes:
      prev.excludedNotes ||
      "Any additional hidden faults, specialist parts or unexpected access issues.",
  }));
}

async function logCallOnCurrentEnquiry() {
  if (!selectedRow || !uid) return;

  setCallForm({
    customer_name: selectedRow.customer_name || "",
    customer_phone: selectedRow.customer_phone || "",
    job_type: selectedRow.job_type || "",
    urgency: selectedRow.urgency || "Flexible",
    details: "",
    source: "phone",
  });

  setShowCallModal(true);
}

async function createCallEnquiry() {
  if (!uid) return;

  const { data, error } = await supabase
    .from("quote_requests")
    .insert({
      plumber_id: uid,
      customer_name: callForm.customer_name.trim() || null,
      customer_phone: callForm.customer_phone.trim() || null,
      job_type: callForm.job_type.trim() || "Phone enquiry",
      details: callForm.details.trim() || "Phone call enquiry",
      urgency: callForm.urgency,
      status: "new",
      stage: "new",
      source: callForm.source,
    })
    .select()
    .single();

  if (error || !data) {
    pushToast("Couldn’t save phone enquiry", "error");
    return;
  }

  if (callForm.source === "phone") {
    await supabase.from("enquiry_messages").insert({
      request_id: data.id,
      plumber_id: uid,
      direction: "in",
      channel: "phone",
      subject: "Phone call",
      body_text: callForm.details.trim() || "Phone call logged",
      from_email: callForm.customer_phone.trim() || "Phone call",
      to_email: null,
    });
  }

  setRows((prev) => [data as QuoteRequestRow, ...prev]);

  setShowCallModal(false);

  setCallForm({
    customer_name: "",
    customer_phone: "",
    job_type: "",
    urgency: "Flexible",
    details: "",
    source: "manual",
  });

  selectEnquiry(data.id, "messages");

  setReplyBody(
    `Hi ${data.customer_name || "there"}, nice speaking to you earlier — I’ll take a look at this and get back to you shortly.`
  );

  setScrollToComposerPending(true);

  pushToast(
    callForm.source === "phone" ? "Phone call logged" : "Enquiry added"
  );
}

async function sendAutoMessage(row: QuoteRequestRow, body: string) {
  if (!uid) return;

  const customerEmail = String(row.customer_email || "").trim();
  if (!customerEmail || !customerEmail.includes("@")) return;

  const res = await fetch("/api/enquiries/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: row.id,
      plumberId: uid,
      to: customerEmail,
      subject: `Re: ${row.job_type || "Your enquiry"}`,
      body,
      customerName: row.customer_name,
      isAuto: true,
    }),
  });

  if (!res.ok) return;

  await supabase
    .from("quote_requests")
    .update({
      ai_thread_status: "awaiting_customer_reply",
      ai_last_ai_message_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  setRows((prev) =>
    prev.map((r) =>
      r.id === row.id
        ? {
            ...r,
            ai_thread_status: "awaiting_customer_reply",
          }
        : r
    )
  );

  await loadThreadMapForRows(rows, uid);
}

async function loadCustomerHistory(email?: string | null, phone?: string | null) {
  if (!email && !phone) return;

  setHistoryLoading(true);

  let query = supabase
    .from("quote_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (email) {
    query = query.eq("customer_email", email);
  } else if (phone) {
    query = query.eq("customer_phone", phone);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    setCustomerHistory([]);
  } else {
    setCustomerHistory(data || []);
  }

  setHistoryLoading(false);
}

async function loadPricingHistory(userId: string) {
  const { data, error } = await supabase
    .from("estimates")
    .select(`
      total,
      status,
      request_id,
      quote_requests (
        job_type
      )
    `)
    .eq("plumber_id", userId)
    .eq("status", "accepted") // ✅ ONLY REAL WON JOBS
    .not("total", "is", null);

  if (error) {
    console.error("Pricing history load error:", JSON.stringify(error, null, 2));
    return;
  }

  setPricingHistory(data || []);
}

async function runAutoFollowUps() {
  if (!uid || !rows.length) return;

  for (const row of rows) {
    const estimate = estimateMap[row.id];
    const visit = visitMap[row.id] || null;
    const messages = threadMap[row.id] || [];


if (
  autoFollowUpsEnabled &&
  messages.length === 0 &&
  row.customer_email
) {
const name = row?.customer_name
  ? titleCase(row.customer_name).split(" ")[0]
  : "there";
  const job = row.job_type?.toLowerCase() || "job";

 const safeName = name || "there";

const firstReply = `Hi ${safeName}, thanks for your enquiry — I’ll take a look and get back to you shortly.`;

  await sendAutoMessage(row, firstReply);

  continue;
}

const lastMessage = [...messages].sort(
  (a, b) =>
    new Date(b.created_at).getTime() -
    new Date(a.created_at).getTime()
)[0];

if (!lastMessage) continue;

if (!isOutboundDirection(lastMessage.direction)) continue;

    const derivedStage = deriveEnquiryStage({
      row,
      estimate,
      visit,
      messages,
    });

    if (derivedStage === "won" || derivedStage === "lost") continue;

const followUp = followUpMap[row.id];
if (!followUp) continue;

if (
  row.ai_next_action_due_at &&
  new Date(row.ai_next_action_due_at).getTime() > Date.now()
) {
  continue;
}
const canPrepareSuggestion =
  row.ai_thread_status !== "awaiting_trader_review" &&
  row.ai_thread_status !== "awaiting_customer_reply" &&
  !row.ai_suggested_reply &&
  !hasCustomerReplyAfterOutbound(messages);

const shouldSend =
  followUp.status === "follow_up_due" ||
  followUp.status === "estimate_follow_up_due";

if (!shouldSend) continue;


if (!canPrepareSuggestion) continue;

const followUpCount = Number(row.ai_follow_up_count || 0);
const name = getCustomerFirstName(row?.customer_name);

const message =
  followUpCount === 0
    ? `Hi ${name}, just checking in to see if you’re still looking to get this sorted?`
    : followUpCount === 1
    ? `Hi ${name}, just checking again — I’ve got some availability coming up if you’d like me to get this booked in.`
    : `Hi ${name}, just a final check-in. Would you like me to keep this open, or close it off for now?`;

if (autoFollowUpsEnabled && row.customer_email) {
  const res = await fetch("/api/enquiries/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: row.id,
      plumberId: uid,
      to: row.customer_email,
      subject: `Re: ${row.job_type || "Your enquiry"}`,
      body: message,
      customerName: row.customer_name,
      isFollowUp: true,
      followUpNumber: followUpCount + 1,
    }),
  });

  if (!res.ok) continue;

  const nextFollowUpCount = followUpCount + 1;
  const isFinalFollowUp = nextFollowUpCount >= 3;

  await supabase
    .from("quote_requests")
    .update({
      ai_suggested_reply: null,
      ai_thread_status: isFinalFollowUp
        ? "cold_after_follow_up"
        : "awaiting_customer_reply",
      ai_follow_up_count: nextFollowUpCount,
      ai_next_action_due_at: isFinalFollowUp
        ? null
        : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      ai_last_ai_message_at: new Date().toISOString(),
    })
    .eq("id", row.id);
} else {
  await supabase
    .from("quote_requests")
    .update({
      ai_suggested_reply: null,
      ai_recommended_action: "low_priority",
      ai_last_processed_at: new Date().toISOString(),
      ai_thread_status: "awaiting_customer_reply",
      ai_follow_up_count: followUpCount,
    })
    .eq("id", row.id);
}
  }
}
  useEffect(() => {
  runAutoFollowUpsRef.current = runAutoFollowUps;
}, [runAutoFollowUps]);



  /* ================================
     EFFECTS
  ================================= */

useEffect(() => {
  if (!autoFollowUpsEnabled) return;

  const id = window.setInterval(() => {
    runAutoFollowUpsRef.current();
  }, 1000 * 60 * 10);

  return () => window.clearInterval(id);
}, [autoFollowUpsEnabled]);


useEffect(() => {
  (async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setUid(user.id);
    setLoading(true);

await Promise.all([
  loadTraderProfile(user.id),
  loadEstimateMap(user.id),
  loadVisitMap(user.id),
  loadPricingHistory(user.id),
]);

const { data, error } = await supabase
  .from("quote_requests")
  .select("*")
  .eq("plumber_id", user.id)
  .order("created_at", { ascending: false })
  .limit(limitCount);

    if (error) {
      console.error(error);
      pushToast("Couldn’t load enquiries", "error");
      setLoading(false);
      return;
    }

    const loaded = (data || []) as QuoteRequestRow[];
    const history = await getCustomerHistoryMap(user.id, loaded);


    setRows(loaded);


await loadThreadMapForRows(loaded, user.id);

    setLoading(false);
  })();
}, [router]);

useEffect(() => {
  if (!selectedRow || !uid) return;

  if (!urlTab) {
  setRightTab("messages");
}

  setTraderNotes(selectedRow.trader_notes || "");
  setReplyTo(selectedRow.customer_email || "");
  setReplySubject(`Re: ${selectedRow.job_type || "Your enquiry"}`);

  setThread([]);
  setCustFiles([]);
  setTraderFiles([]);
  setSiteVisit(null);
  setDetailedEstimate(null);
  setDetailedEstimateItems([]);

  loadThread(selectedRow.id, uid);
  loadFiles(selectedRow.id);
  loadSiteVisit(selectedRow.id);
  loadDetailedEstimate(selectedRow.id);
  markRead(selectedRow.id);

if (rightPaneScrollRef.current && rightTab !== "messages") {
  rightPaneScrollRef.current.scrollTop = 0;
}
}, [selectedRow?.id, uid]);

useEffect(() => {
  if (!urlTab) return;

  const validTabs: RightTab[] = [
    "details",
    "estimate",
    "files",
    "visit",
    "notes",
    "messages",
  ];

  if (validTabs.includes(urlTab as RightTab)) {
    setRightTab(urlTab as RightTab);
  }
}, [urlTab]);

useEffect(() => {
  if (!selectedRow) return;

  if (detailedEstimate) {
    setEstimateForm({
      labour: String(detailedEstimate.labour ?? ""),
      materials: String(detailedEstimate.materials ?? ""),
      callout: String(detailedEstimate.callout ?? ""),
      parts: String(detailedEstimate.parts ?? ""),
      other: String(detailedEstimate.other ?? ""),
      vatPercent: "20",
      validUntil: detailedEstimate.valid_until
        ? new Date(detailedEstimate.valid_until).toISOString().slice(0, 10)
        : "",
      customerMessage: detailedEstimate.customer_message || "",
      includedNotes: detailedEstimate.included_notes || "",
      excludedNotes: detailedEstimate.excluded_notes || "",
      materialsMarkupType: "percent",
      materialsMarkupPercent: "0",
      materialsMarkupCustom: "",
    });
  } else {
    setEstimateForm({
      labour: "",
      materials: "",
      callout: "",
      parts: "",
      other: "",
      vatPercent: "20",
      validUntil: "",
      customerMessage: "",
      includedNotes: "",
      excludedNotes: "",
      materialsMarkupType: "percent",
      materialsMarkupPercent: "0",
      materialsMarkupCustom: "",
    });
  }
}, [detailedEstimate?.id, selectedRow?.id]);

useEffect(() => {
  if (!activeEnquiryRef.current) return;

  activeEnquiryRef.current.scrollIntoView({
    behavior: "auto",
    block: "nearest",
  });
}, [selectedId]);

useEffect(() => {
if (rightTab !== "messages") return;
if (!scrollToComposerPending) return;

const id = window.setTimeout(() => {
requestAnimationFrame(() => {
requestAnimationFrame(() => {
replyBodyRef.current?.scrollIntoView({
behavior: "auto",
block: "nearest",
inline: "nearest",
});

replyBodyRef.current?.focus({ preventScroll: true });

const el = replyBodyRef.current;
if (el) {
el.selectionStart = el.value.length;
el.selectionEnd = el.value.length;
}

setScrollToComposerPending(false);
});
});
}, 180);

return () => window.clearTimeout(id);
}, [rightTab, scrollToComposerPending]);

useEffect(() => {
  if (rightTab !== "estimate") return;
  if (!scrollToEstimatePending) return;

  const id = window.setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        estimateFormRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });

        setScrollToEstimatePending(false);
      });
    });
  }, 120);

  return () => window.clearTimeout(id);
}, [rightTab, scrollToEstimatePending]);

useEffect(() => {
  if (rightTab !== "visit") return;
  if (!scrollToVisitPending) return;

  const id = window.setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        visitSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });

        setScrollToVisitPending(false);
      });
    });
  }, 120);

  return () => window.clearTimeout(id);
}, [rightTab, scrollToVisitPending]);

useEffect(() => {
  if (!selectedRow) return;
  if (rightTab !== "messages") return;

  if (
    selectedRow.ai_thread_status === "awaiting_trader_review" &&
    selectedRow.ai_suggested_reply &&
    !replyBody.trim()
  ) {
    setReplyBody(selectedRow.ai_suggested_reply);

    setScrollToComposerPending(true);
  }
}, [selectedRow, rightTab]);

useEffect(() => {
  if (!selectedRow) return;

  loadCustomerHistory(
    selectedRow.customer_email,
    selectedRow.customer_phone
  );
}, [selectedRow?.id]);

  /* ================================
     EARLY EMPTY STATE
  ================================= */

  if (!selectedRow && !loading && filteredRows.length === 0) {
    return (
     <div className="ff-appShell">
     <div className="ff-page">
        <div className="ff-wrap">
          <div className="ff-top">
            <div className="ff-hero">
              <div className="ff-heroGlow" />
              <div className="ff-heroRow">
                <div className="ff-heroLeft">
                  <div className="ff-heroTitle">Enquiries</div>
                  <div className="ff-heroRule" />
                  <div className="ff-heroSub">
                    Manage leads, pricing, replies and site visits in one place.
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>

          <div className="ff-card">
            <div className="ff-emptyWrap">
<div className="ff-emptySales">
  <div className="ff-emptyBadge">
    ⚡ Your sales engine is ready
  </div>

  <div className="ff-emptyTitleBig">
    Win your first job with FixFlow
  </div>

  <div className="ff-emptyText">
    New customer enquiries, replies, quotes and follow-ups
    will appear here automatically.
  </div>

  <div className="ff-emptySteps">
    <div className="ff-emptyStep">
      <span>1</span>
      Share your enquiry link
    </div>

    <div className="ff-emptyStep">
      <span>2</span>
      Customers message you
    </div>

    <div className="ff-emptyStep">
      <span>3</span>
      FixFlow helps you win the work
    </div>
  </div>

  <div className="ff-emptyDemo">
    <div className="ff-demoTop">
      <div>
        <div className="ff-demoName">
          Sarah M — Boiler repair
        </div>

        <div className="ff-demoMeta">
          CR4 • Customer replied 2 mins ago
        </div>
      </div>

      <div className="ff-chip ff-chipBlue">
        Hot lead
      </div>
    </div>

    <div className="ff-demoAction">
      ⚡ AI suggests: Reply now
    </div>
  </div>

  <button
    type="button"
    className="ff-btnPrimary"
    onClick={() => setShowCallModal(true)}
  >
    + Add first enquiry
  </button>
</div>
            </div>
          </div>
        </div>
      </div>
    
    );
  }

  /* ================================
     RETURN
  ================================= */

  return (
    <>
     <div className="ff-appShell"></div>
      <div className="ff-page">
        <div className="ff-wrap">
          <div className="ff-top">
            <div className="ff-hero">
              <div className="ff-heroGlow" />

              <div className="ff-heroRow">
                <div className="ff-heroLeft">
                  <div className="ff-heroTitle">Enquiries</div>
                  <div className="ff-heroRule" />
                  <div className="ff-heroSub">
                    Keep every lead organised — quote faster, follow up properly,
                    and never lose a job because something slipped through.
                  </div>
                </div>
                

                <div className="ff-heroStats">
                  <div className="ff-statCard">
                    <div className="ff-statLabel">Open</div>
                    <div className="ff-statValue">{enquiryCounts.enquiriesOpen}</div>
                  </div>

                  <div className="ff-statCard">
                    <div className="ff-statLabel">Unread</div>
                   <div className="ff-statValue">{enquiryCounts.enquiriesUnread}</div>
                  </div>

<div className="ff-statCard">
<div className="ff-statLabel">Booked</div>
<div className="ff-statValue">{bookedEnquiryRows.length}</div>
</div>

                  <div className="ff-statCard">
  <div className="ff-statLabel">Needs action</div>
 <div className="ff-statValue">{enquiryCounts.needsAction}</div>
</div>
<div className="ff-statCard">
  <div className="ff-statLabel">Follow up</div>
 <div className="ff-statValue">{enquiryCounts.followUp}</div>
</div>
<div className="ff-statCard ff-statCardSoft">
<div className="ff-statLabel">Waiting on customer</div>
<div className="ff-statValue">{enquiryCounts.allGood}</div>
</div>
                </div>
              </div>
            </div>
          </div>
          

          <div className={`ff-mainShell ${selectedRow ? "hasSelection" : ""}`}>
            <div className="ff-leftPane">
             <div className="ff-leftTop">
  <div className="ff-leftTitle">All enquiries</div>

  {lostJobInsights.totalLost > 0 && (
  <div className="ff-followUpBar">
    <div>
      <div className="ff-followUpText">
        📉 {lostJobInsights.totalLost} lost job
        {lostJobInsights.totalLost === 1 ? "" : "s"}
        {lostJobInsights.topReason
          ? ` — ${lostJobInsights.topReason}`
          : ""}
      </div>

      {lostJobAdvice && (
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          💡 {lostJobAdvice.text}
        </div>
      )}
    </div>

    {lostJobInsights.topReason && (
      <button
        className="ff-btn ff-btnGhost ff-btnSm"
        onClick={() =>
          setLostReasonFilter(lostJobInsights.topReason || "")
        }
      >
        View
      </button>
    )}
  </div>
)}



{followUpReadyRows.length > 0 && (
<div className="ff-followUpBar">
<div className="ff-followUpText">
⚡ {followUpReadyRows.length} job
{followUpReadyRows.length > 1 ? "s" : ""} ready to follow up
</div>

<button
className="ff-btn ff-btnPrimary ff-btnSm"
onClick={jumpToNextFollowUp}
>
Review now
</button>
</div>
)}

<div className="ff-followUpBar">
<div>
<div className="ff-followUpText">
⚡ {salesPulse.needsAction} need action
{" • "}
📉 {salesPulse.lostThisWeek} lost this week
</div>

<div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
💰 £{salesPulse.valueWaiting.toLocaleString("en-GB")} waiting
</div>

<div style={{ fontSize: 12, marginTop: 4 }}>
👉 {salesPulse.bestMove}
</div>
</div>
</div>

<div
className={`ff-salesPulse ${
salesPulse.valueWaiting > 0 || salesPulse.needsAction > 0
? "ff-salesPulseHot"
: ""
}`}
>
<div className="ff-salesPulseTop">
<div>
<div className="ff-salesPulseEyebrow">Today’s sales pulse</div>
<div className="ff-salesPulseTitle">
{salesPulse.needsAction > 0
? `${salesPulse.needsAction} job${salesPulse.needsAction === 1 ? "" : "s"} need action`
: "You’re in control"}
</div>
</div>

<div className="ff-salesPulseMoney">
£{salesPulse.valueWaiting.toLocaleString("en-GB")}
</div>
</div>

<div className="ff-salesPulseGrid">
<div>
<span>⚡ Action</span>
<strong>{salesPulse.needsAction}</strong>
</div>

<div>
<span>📉 Lost this week</span>
<strong>{salesPulse.lostThisWeek}</strong>
</div>

<div>
<span>💰 Waiting</span>
<strong>£{salesPulse.valueWaiting.toLocaleString("en-GB")}</strong>
</div>
</div>

<div className="ff-salesPulseMove">
👉 {salesPulse.bestMove}
</div>
<div className="ff-moneyCoach">
  💡 {moneyCoach.message}
</div>
</div>

<button
  type="button"
  className="ff-btn ff-btnPrimary ff-btnSm"
  onClick={() => {
    setCallForm({
      customer_name: "",
      customer_phone: "",
      job_type: "",
      urgency: "Flexible",
      details: "",
      source: "manual", // or "phone" depending on button
    });

    setShowCallModal(true);
  }}
>
  + Add enquiry
</button>

<div className="ff-leftFilters">
  <div className="ff-segmented">
    <button
      type="button"
      className={`ff-segBtn ${tab === "all" ? "isActive" : ""}`}
      onClick={() => setTab("all")}
    >
      All
    </button>

    <button
      type="button"
      className={`ff-segBtn ${tab === "unread" ? "isActive" : ""}`}
      onClick={() => setTab("unread")}
    >
      Unread
    </button>

    <button
      type="button"
      className={`ff-segBtn ${tab === "needsAction" ? "isActive" : ""}`}
      onClick={() => setTab("needsAction")}
    >
      Needs action
    </button>

    <button
      type="button"
      className={`ff-segBtn ${tab === "followUp" ? "isActive" : ""}`}
      onClick={() => setTab("followUp")}
    >
      Follow up
    </button>

    <button
      type="button"
      className={`ff-segBtn ${tab === "waiting" ? "isActive" : ""}`}
      onClick={() => setTab("waiting")}
    >
      Waiting
    </button>

    <button
  type="button"
  className={`ff-segBtn ${tab === "cold" ? "isActive" : ""}`}
  onClick={() => setTab("cold")}
>
  Cold 🧊
</button>
  </div>

                  <input
  className="ff-input"
  placeholder="Search by postcode, name or job no."
  value={searchFilter}
  onChange={(e) => setSearchFilter(e.target.value)}
/>

                  <select
                    className="ff-input"
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                  >
                    <option value="">All urgency</option>
                    <option value="asap">ASAP</option>
                    <option value="this week">This week</option>
                    <option value="next week">Next week</option>
                    <option value="flex">Flexible</option>
                  </select>



{lostReasons.length > 0 && (
  <select
    className="ff-input"
    value={lostReasonFilter}
    onChange={(e) => setLostReasonFilter(e.target.value)}
  >
    <option value="">All lost reasons</option>

{lostReasons.map((item, index) => (
  <option key={item.reason} value={item.reason}>
    {index === 0 ? "🔥 " : ""}
    {item.reason} ({item.count})
  </option>
))}
  </select>
)}
                </div>
              </div>



<div className="ff-leftList">
  {loading ? (
    <div className="ff-loadingWrap">
      <div className="ff-loadingText">Loading enquiries…</div>
    </div>
  ) : activeEnquiryRows.length || bookedEnquiryRows.length ? (
    
<>

    {/* ACTIVE */}
{activeEnquiryRows.map((r) => {
  const isActive = selectedId === r.id;
  const urgency = urgencyChip(r.urgency);
  const estimate = estimateMap[r.id];
  const visit = visitMap[r.id] || null;
  const messages = threadMap[r.id] || [];
  const latestMessage = messages[messages.length - 1];

const cardPreview =
  latestMessage?.body_text ||
  r.ai_summary ||
  r.details ||
  "No message yet";
const email = r.customer_email?.toLowerCase().trim();
const history = email ? customerHistoryMap[email] : null;
const repeatCount = history ? history.count - 1 : 0;
const isRepeat = repeatCount > 0;
  const hasAiFollowUpReady =
  r.ai_thread_status === "awaiting_trader_review" &&
  !!r.ai_suggested_reply;

  const alert = getAlertState({
    row: r,
    estimate,
    messages,
  });

  const derivedStage = deriveEnquiryStage({
    row: r,
    estimate,
    visit,
    messages,
  });

  const displayedAiAction = getDisplayedAiAction({
    row: r,
    estimateStatus: estimate?.status || null,
    hasVisit: !!visit,
    derivedStage,
  });

  const aiActionMeta =
    displayedAiAction === "follow_up"
      ? { text: "Follow up now", cls: "ff-leftHint ff-leftHintAmber" }
      : getAiActionMeta(
          displayedAiAction as QuoteRequestRow["ai_recommended_action"]
        );

  const isWon = derivedStage === "won";
  const stage = stageChip(derivedStage);

  const photos = r.photo_count || 0;
  const strength = enquiryStrength(r, photos);
  const score = enquiryScore(r, photos);

  const missing = missingInfoList(r, photos);

const replyStatus = hasCustomerReplyAfterOutbound(messages)
  ? "Customer replied"
  : messages.some((m) => isOutboundDirection(m.direction))
  ? "Awaiting reply"
  : "Awaiting first reply";

const nextAction = getLeftNextAction({
  stage: derivedStage,
  estimateStatus: estimate?.status,
  estimate,
  hasVisit: !!visit,
  missingCount: missing.length,
  score,
  replyStatus,
});

const showBottomHint = nextAction.type === "hint";

const followUp = followUpMap[r.id];

return (
  <div
  key={r.id}
  role="button"
  tabIndex={0}
  ref={isActive ? activeEnquiryRef : null}
className={`ff-leftItem 
  ${isActive ? "isActive" : ""} 
  ${isWon ? "ff-leftWon" : getUrgencyGlowClass(r.urgency)} 
  ${
    !isWon &&
    score >= 80 &&
    (replyStatus === "Customer replied" ||
      String(r.urgency || "").toLowerCase().includes("asap") ||
      String(r.ai_job_value_band || "").toLowerCase() === "high")
      ? "ff-hotLeadCard"
      : ""
  }
  ${
!isWon &&
(
  followUp?.status === "follow_up_due" ||
  followUp?.status === "estimate_follow_up_due"
)
  ? `ff-leftFollowUp ${
      (r.ai_follow_up_count || 0) >= 2 ? "ff-leftFollowUpHot" : ""
    }`
  : ""
  }
`}
  onClick={() => selectEnquiry(r.id)}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectEnquiry(r.id);
    }
  }}
>
                        <div className="ff-leftItemTop">
  <div className="ff-leftJobWrap">
    <div className="ff-jobNumber">
      {r.job_number || "No job no."}
      {!r.read_at ? <span className="ff-unreadDot" /> : null}
    </div>

    <div className="ff-leftDate">{niceDate(r.created_at)}</div>
  </div>

<div className="ff-leftChipRow">
  {r.source === "phone" && (
    <Chip cls="ff-chip ff-chipGray">📞 Call</Chip>
  )}

  {isWon ? (
    <>
      <Chip cls="ff-chip ff-chipGreen">Booked</Chip>
      <Chip cls="ff-chip ff-chipGray">In jobs</Chip>
    </>
  ) : (
    <>
      {urgency.text !== "Unknown" ? (
        <Chip cls={urgency.cls}>{urgency.text}</Chip>
      ) : null}

      <Chip cls={stage.cls}>{stage.text}</Chip>

      {String(estimate?.status || "").toLowerCase() === "accepted" ? (
        <Chip cls="ff-chip ff-chipGreen">Accepted</Chip>
      ) : null}

      {isRepeat && (
        <Chip cls="ff-chip ff-chipGreen">
          🔁 Repeat ({repeatCount})
        </Chip>
      )}

      {hasAiFollowUpReady && (
        <Chip cls="ff-chip ff-chipBlue ff-chipPulse">
          Follow-up ready
        </Chip>
      )}
    </>
  )}
</div>
</div>



                        <div className="ff-leftMain">
                         <div className={`ff-leftJobTitle ${isWon ? "ff-leftJobTitleWon" : ""}`}>
  {titleCase(r.job_type || "Enquiry")}
</div>

                          <div className="ff-leftCustomer">
                            {titleCase(r.customer_name || "Customer")}
                          </div>

<div className="ff-leftAddress">
  {r.address || formatPostcode(r.postcode) || "No address"}
</div>
{latestMessage?.direction === "in" ? (
  <div className="ff-leftReplyAlert">
    ⚡ Customer replied — reply now
  </div>
) : null}


                        </div>

<div className="ff-leftMetaRow">
  <div className="ff-leftMetaText">
    {photos} photo{photos === 1 ? "" : "s"}
  </div>

  <div className="ff-leftMetaText">
    {formatBudget(r.budget)}
  </div>

  <Chip cls={strength.cls}>{strength.text}</Chip>

  <Chip
    cls={
      score >= 80
        ? "ff-chip ff-chipGreen"
        : score >= 55
        ? "ff-chip ff-chipBlue"
        : "ff-chip ff-chipAmber"
    }
  >
    {score}% ready
  </Chip>

  {!isWon &&
  score >= 80 &&
  (replyStatus === "Customer replied" ||
    String(r.urgency || "").toLowerCase().includes("asap") ||
    String(r.ai_job_value_band || "").toLowerCase() === "high") ? (
    <Chip cls="ff-chip ff-chipRed">🔥 Hot lead</Chip>
  ) : null}
</div>

<div style={{ display: "grid", gap: 8 }}>
  {isWon ? (
    <>
      <div className="ff-leftHint ff-leftHintWon">Job booked</div>
      <Chip cls="ff-chip ff-chipGray">No follow-up needed</Chip>
    </>
  ) : (
    <>
      {alert ? (
        <Chip cls={alert.cls}>{alert.text}</Chip>
      ) : null}

{(aiActionMeta || nextAction.type === "primary") && (
  <div
    className={
      aiActionMeta
        ? aiActionMeta.cls
        : nextAction.cls
    }
    onClick={(e) => {
      e.stopPropagation();

      if (
        aiActionMeta?.text === "Message customer" ||
        nextAction.text === "Reply now" ||
        nextAction.text === "Next: First reply"
      ) {
        selectEnquiry(r.id);
        openFollowUpComposer({
          customerName: r.customer_name,
          status:
            replyStatus === "Customer replied"
              ? "customer_replied"
              : replyStatus === "Awaiting first reply"
              ? "needs_reply"
              : "follow_up_due",
        });
        return;
      }

      if (
        aiActionMeta?.text === "Book visit" ||
        nextAction.text === "Next: Book visit"
      ) {
        selectEnquiry(r.id);
        syncRightTab("visit");
        setScrollToVisitPending(true);
        return;
      }

      if (
        aiActionMeta?.text === "Create estimate" ||
        nextAction.text === "Create estimate" ||
        nextAction.text === "Next: Quote now" ||
        nextAction.text === "Next: Chase estimate" ||
        nextAction.text === "Next: Check estimate"
      ) {
        selectEnquiry(r.id);
        syncRightTab("estimate");
        setScrollToEstimatePending(true);
        return;
      }
    }}
    style={{ cursor: "pointer" }}
  >
    {aiActionMeta ? aiActionMeta.text : nextAction.text}
  </div>
)}

{hasAiFollowUpReady ? (
  <button
    type="button"
    className="ff-leftQuickAction"
    onClick={(e) => {
      e.stopPropagation();

      selectEnquiry(r.id);
      syncRightTab("messages");
      setReplyBody(r.ai_suggested_reply || "");
      setScrollToComposerPending(true);
    }}
  >
    ⚡ Review follow-up
  </button>
) : null}

{followUp && latestMessage?.direction !== "in" && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();

      if (
        followUp.status === "needs_reply" ||
        followUp.status === "customer_replied" ||
        followUp.status === "follow_up_due" ||
        followUp.status === "estimate_follow_up_due"
      ) {
        selectEnquiry(r.id);
        openFollowUpComposer({
          customerName: r.customer_name,
          status: followUp.status,
        });
      }
    }}
    className="ff-chipButton"
  >
    <Chip
      cls={
        followUp.status === "customer_replied" ||
        followUp.status === "needs_reply"
          ? "ff-chip ff-chipBlue"
          : followUp.status === "estimate_follow_up_due"
          ? "ff-chip ff-chipAmber"
          : followUp.status === "follow_up_due"
          ? "ff-chip ff-chipRed"
          : "ff-chip ff-chipGray"
      }
    >
      {r.ai_thread_status === "cold_after_follow_up"
        ? "Cold — no more chase"
        : followUp.status === "customer_replied" ||
          followUp.status === "needs_reply"
        ? "⚡ Reply now"
        : followUp.status === "estimate_follow_up_due"
        ? (r.ai_follow_up_count || 0) >= 2
          ? "🔥 Final estimate chase"
          : "🔥 Chase estimate"
        : followUp.status === "follow_up_due"
        ? (r.ai_follow_up_count || 0) >= 2
          ? "🔥 Final follow-up"
          : "🔥 Follow up now"
        : followUp.label}
    </Chip>
  </button>
)}
    </>
  )}
</div>
                                            </div>
                    );
                  })}

                  {bookedEnquiryRows.length > 0 && (
                    <div className="ff-divider">
                      <span>Booked jobs</span>
                    </div>
                  )}

                  {bookedEnquiryRows.map((r) => {
                    const isActive = selectedId === r.id;
                    const urgency = urgencyChip(r.urgency);
                    const estimate = estimateMap[r.id];
                    const visit = visitMap[r.id] || null;
                    const messages = threadMap[r.id] || [];
                    const latestMessage = messages[messages.length - 1];

const cardPreview =
  latestMessage?.body_text ||
  r.ai_summary ||
  r.details ||
  "No message yet";
const email = r.customer_email?.toLowerCase().trim();
const history = email ? customerHistoryMap[email] : null;
const repeatCount = history ? history.count - 1 : 0;
const isRepeat = repeatCount > 0;
                    const alert = getAlertState({
                      row: r,
                      estimate,
                      messages,
                    });

                    const derivedStage = deriveEnquiryStage({
                      row: r,
                      estimate,
                      visit,
                      messages,
                    });

                    const displayedAiAction = getDisplayedAiAction({
                      row: r,
                      estimateStatus: estimate?.status || null,
                      hasVisit: !!visit,
                      derivedStage,
                    });

                    const aiActionMeta =
                      displayedAiAction === "follow_up"
                        ? { text: "Follow up now", cls: "ff-leftHint ff-leftHintAmber" }
                        : getAiActionMeta(
                            displayedAiAction as QuoteRequestRow["ai_recommended_action"]
                          );

                    const isWon = derivedStage === "won";
                    const stage = stageChip(derivedStage);

                    const photos = r.photo_count || 0;
                    const strength = enquiryStrength(r, photos);
                    const score = enquiryScore(r, photos);

                    const missing = missingInfoList(r, photos);

                    const replyStatus = hasCustomerReplyAfterOutbound(messages)
  ? "Customer replied"
  : messages.some((m) => isOutboundDirection(m.direction))
  ? "Awaiting reply"
  : "Awaiting first reply";

const nextAction = getLeftNextAction({
  stage: derivedStage,
  estimateStatus: estimate?.status,
  estimate,
  hasVisit: !!visit,
  missingCount: missing.length,
  score,
  replyStatus,
});

                   const followUp = followUpMap[r.id];
                    return (
                   <div
  key={r.id}
  role="button"
  tabIndex={0}
  ref={isActive ? activeEnquiryRef : null}
  className={`ff-leftItem 
    ${isActive ? "isActive" : ""} 
    ${isWon ? "ff-leftWon" : getUrgencyGlowClass(r.urgency)} 
    ${
      !isWon &&
      (followUp?.status === "follow_up_due" ||
        followUp?.status === "estimate_follow_up_due")
        ? "ff-leftFollowUp"
        : ""
    }
  `}
onClick={() => selectEnquiry(r.id, "details")}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectEnquiry(r.id, "details");
    }
  }}
>
                        <div className="ff-leftItemTop">
                          <div className="ff-leftJobWrap">
                            <div className="ff-jobNumber">
                              {r.job_number || "No job no."}
                              {!r.read_at ? <span className="ff-unreadDot" /> : null}
                            </div>

                            <div className="ff-leftDate">{niceDate(r.created_at)}</div>
                          </div>

                          <div className="ff-leftChipRow">
                            {isWon ? (
                              <>
                                <Chip cls="ff-chip ff-chipGreen">Booked</Chip>
                                <Chip cls="ff-chip ff-chipGray">In jobs</Chip>
                              </>
                            ) : (
                              <>
                                {urgency.text !== "Unknown" ? (
                                  <Chip cls={urgency.cls}>{urgency.text}</Chip>
                                ) : null}

                                <Chip cls={stage.cls}>{stage.text}</Chip>

                                {String(estimate?.status || "").toLowerCase() === "accepted" ? (
                                  <Chip cls="ff-chip ff-chipGreen">Accepted</Chip>
                                ) : null}
                                {isRepeat && (
  <Chip cls="ff-chip ff-chipGreen">
    🔁 Repeat ({repeatCount})
  </Chip>
)}
                              </>
                                            
                              
                            )}
                          </div>
                        </div>

                        <div className="ff-leftMain">
                          <div className={`ff-leftJobTitle ${isWon ? "ff-leftJobTitleWon" : ""}`}>
                            {titleCase(r.job_type || "Enquiry")}
                          </div>

  {r.stage === "lost" && r.lost_reason && (

    <div className="ff-leftLostReason">

      Lost — {r.lost_reason}

    </div>

  )}
                          <div className="ff-leftCustomer">
                            {titleCase(r.customer_name || "Customer")}
                          </div>

                          <div className="ff-leftAddress">
                            {r.address || formatPostcode(r.postcode) || "No address"}
                          </div>
<div
  style={{
    color: "red",
    fontSize: "18px",
    fontWeight: 800,
    padding: "8px 0",
    background: "yellow",
    display: "block",
  }}
>
  TEST PREVIEW IS SHOWING
</div>
                        </div>

                        <div className="ff-leftMetaRow">
                          <div className="ff-leftMetaText">
                            {photos} photo{photos === 1 ? "" : "s"}
                          </div>

                          <div className="ff-leftMetaText">
                            {formatBudget(r.budget)}
                          </div>

                          <Chip cls={strength.cls}>{strength.text}</Chip>
                          {!isWon && score >= 80 ? (
  <Chip cls="ff-chip ff-chipGreen">High chance</Chip>
) : null}
                        </div>

                        <div style={{ display: "grid", gap: 8 }}>
                          {isWon ? (
                            <>
                              <div className="ff-leftHint ff-leftHintWon">Job booked</div>
                              <Chip cls="ff-chip ff-chipGray">No follow-up needed</Chip>
                            </>
                          ) : (
                            <>
                              {alert ? <Chip cls={alert.cls}>{alert.text}</Chip> : null}

                              {aiActionMeta ? (
                                <div className={aiActionMeta.cls}>{aiActionMeta.text}</div>
                              ) : null}

                              {!aiActionMeta && nextAction.type === "primary" ? (
  <div className={nextAction.cls}>{nextAction.text}</div>
) : null}

                              {followUp ? (
  <Chip
    cls={
      followUp.status === "needs_reply" ||
      followUp.status === "customer_replied"
        ? "ff-chip ff-chipBlue"
        : followUp.status === "follow_up_due" ||
          followUp.status === "estimate_follow_up_due"
        ? "ff-chip ff-chipAmber"
        : "ff-chip ff-chipGray"
    }
  >
    {followUp.label}
  </Chip>
) : null}
                            </>
                          )}
                        </div>
                     </div>
                                   );
                  })}

                  {rows.length >= limitCount && (
                    <div style={{ padding: 12 }}>
                      <button
                        className="ff-btn ff-btnGhost ff-btnSm"
                        onClick={() => {
  setLimitCount((prev) => prev + 100);
  pushToast("Loading more enquiries…", "success");
}}
                      >
                        Show older enquiries
                      </button>
                    </div>
                  )}
                </>
              ) : (
              
                  <div className="ff-emptyWrap">
                    <EmptyState
                      title="No matching enquiries"
                      sub="Try changing your filters."
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="ff-rightPane">
              {!selectedRow ? (
                <div className="ff-emptyWrap">
                  <EmptyState
                    title="Select an enquiry"
                    sub="Choose one from the left to view full details."
                  />
                </div>
              ) : (
                <>
                 <div className="ff-rightTop">
  <div className="ff-rightTopLeft">
    <button
      type="button"
      className="ff-backBtn ff-backBtnMobile"
      onClick={clearSelected}
    >
      ← Back
    </button>

    <div>
      <div className="ff-rightJobNo">
        {selectedRow.job_number || "No job number"}
      </div>
      <div className="ff-rightTitle">
        {titleCase(selectedRow.job_type || "Enquiry")}
      </div>
      <div className="ff-rightSub">
        {titleCase(selectedRow.customer_name || "Customer")} •{" "}
        {formatPostcode(selectedRow.postcode) || "No postcode"}
      </div>
    </div>
  </div>

        <div className="ff-rightTopActions">
  <button
    type="button"
    className={`ff-btn ff-btnGhost ff-btnSm ${getAiButtonClass(selectedDisplayedAiAction, "messages")}`}
    onClick={() => {
      syncRightTab("messages");
      setScrollToComposerPending(true);
    }}
  >
    {String(selectedDisplayedAiAction || "").toLowerCase().includes("reply") ||
    String(selectedDisplayedAiAction || "").toLowerCase().includes("follow")
      ? "⚡ Message customer"
      : "Message customer"}
  </button>

  {String(selectedEstimateStatus || "").toLowerCase() === "accepted" ? (
    <button
      type="button"
      className="ff-btn ff-btnPrimary ff-btnSm"
      onClick={() =>
        router.push(`/dashboard/bookings?requestId=${selectedRow.id}`)
      }
    >
      Open job
    </button>
  ) : (
    <>
      <button
        type="button"
        className={`ff-btn ff-btnGhost ff-btnSm ${getAiButtonClass(selectedDisplayedAiAction, "visit")}`}
        onClick={() => syncRightTab("visit")}
      >
        {selectedRow?.ai_recommended_action?.toLowerCase().includes("visit")
          ? "⚡ Book visit"
          : "Book visit"}
      </button>

      <button
        type="button"
        className={`ff-btn ff-btnPrimary ff-btnSm ${getAiButtonClass(selectedDisplayedAiAction, "estimate")}`}
        onClick={() => {
          syncRightTab("estimate");
          setScrollToEstimatePending(true);
        }}
      >
        {String(selectedDisplayedAiAction || "").toLowerCase().includes("estimate")
          ? "⚡ Create estimate"
          : "Create estimate"}
      </button>
    </>
  )}
</div>

{aiRunStatus !== "idle" && aiRunMessage && (
  <div className={`ff-aiRunStatus ff-aiRunStatus--${aiRunStatus}`}>
    {aiRunStatus === "running" && "⚡ "}
    {aiRunStatus === "sent" && "✓ "}
    {aiRunStatus === "draft" && "• "}
    {aiRunStatus === "error" && "⚠ "}
    {aiRunMessage}
  </div>
  
)}
              </div>
                  <div className="ff-tabs">
                    {[
                      ["details", "Overview"],
                      ["estimate", "Estimate"],
                      ["files", "Files"],
                      ["visit", "Visit"],
                      ["notes", "Notes"],
                      ["messages", "Messages"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`ff-tabBtn ${rightTab === value ? "isActive" : ""}`}
                        onClick={() => syncRightTab(value as RightTab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="ff-rightInner" ref={rightPaneScrollRef}>
{selectedDerivedStage !== "won" &&
selectedReadinessScore >= 80 &&
(
  selectedReplyStatus === "Customer replied" ||
  String(selectedRow?.urgency || "").toLowerCase().includes("asap") ||
  String(selectedRow?.ai_job_value_band || "").toLowerCase() === "high"
) ? (
  <div className="ff-hotLeadBanner">
    🔥 Hot lead — high chance of winning this job

    <button
      type="button"
      className="ff-btn ff-btnSm ff-btnPrimary"
onClick={() => {
  syncRightTab("messages");
  setScrollToComposerPending(true);
}}
    >
      Act now
    </button>
  </div>
) : null}

{selectedRow ? (
  <div className="ff-salesHero">
    <div>
      <div className="ff-salesEyebrow">Next job-winning move</div>
      <div className="ff-salesTitle">
  ⚡ {selectedBestAction.title}
</div>
<div className="ff-salesText">
  {selectedBestAction.text}
</div>
    </div>

    {selectedBestAction.button ? (
      <button
        type="button"
        className="ff-btn ff-btnPrimary"
        onClick={selectedBestAction.button.action}
      >
        ⚡ {selectedBestAction.button.label}
      </button>
    ) : null}
  </div>
) : null}
                    

{rightTab === "details" ? (
  <>
    <div className="ff-mobileNextStep">
      <div className="ff-nextStepCard">
        <div className="ff-nextStepTop">
          <div>
            <div className="ff-nextStepEyebrow">Next job-winning move</div>
            <div className="ff-nextStepTitle">{selectedBestAction.title}</div>
            <div className="ff-nextStepText">{selectedBestAction.text}</div>
          </div>

          {selectedBestAction.button ? (
            <button
              type="button"
              className="ff-btn ff-btnPrimary ff-btnSm"
              onClick={selectedBestAction.button.action}
            >
              {selectedBestAction.button.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>

{selectedFollowUpState?.label ? (
<div className="ff-followUpBanner">
  <div className="ff-followUpText">
{selectedFollowUpState.status === "follow_up_due"
  ? "No reply — follow up"
  : selectedFollowUpState.status === "estimate_follow_up_due"
  ? "Estimate sent — chase"
  : selectedFollowUpState.status === "customer_replied"
  ? "Customer replied — act now"
  : selectedFollowUpState.label}
  </div>

  <button
    type="button"
    className="ff-btn ff-btnSm ff-btnPrimary"
    onClick={() => {
      syncRightTab("messages");
      setScrollToComposerPending(true);
    }}
  >
    Follow up
  </button>
</div>
) : null}

    {selectedRow?.ai_summary ? (
      <div className="ff-card">
        <div className="ff-aiInner">
          <div className="ff-aiEyebrow">Best next step</div>

          {selectedRow.ai_recommended_action ? (
            <button
              type="button"
              className={`ff-aiAction ff-aiAction--${selectedDisplayedAiAction}`}
              onClick={() => {
                if (
                  selectedDisplayedAiAction === "reply_now" ||
                  selectedDisplayedAiAction === "follow_up" ||
                  selectedDisplayedAiAction === "ask_for_photos"
                ) {
                  syncRightTab("messages");
                  setReplyBody(selectedRow.ai_suggested_reply || "");

                  if (!replySubject.trim()) {
                    setReplySubject(
                      `Re: ${titleCase(selectedRow.job_type || "Enquiry")}`
                    );
                  }

                  setScrollToComposerPending(true);
                  return;
                }

if (selectedDisplayedAiAction === "book_visit") {
  syncRightTab("visit");
  return;
}

if (selectedDisplayedAiAction === "send_estimate") {
  syncRightTab("estimate");
}
              }}
            >
              {selectedDisplayedAiAction === "reply_now" &&
                "⚡ Reply now — customer is waiting"}
              {selectedDisplayedAiAction === "book_visit" &&
                "📅 Book a visit — this needs seeing in person"}
              {selectedDisplayedAiAction === "send_estimate" &&
                "🧾 Send estimate — good chance to win this job"}
              {selectedDisplayedAiAction === "ask_for_photos" &&
                "📸 Ask for photos — you need more detail"}
              {selectedDisplayedAiAction === "low_priority" &&
                "🕓 Low priority — no need to rush"}
              {selectedDisplayedAiAction === "follow_up" &&
                "💬 Follow up — time to nudge this one"}
            </button>
          ) : null}


<div className="ff-aiSection">
  <div className="ff-aiLabel">What’s going on</div>
  <p>{selectedRow.ai_summary}</p>
</div>

{selectedAiFollowUpDue && selectedRow && (
  <div
    className="ff-aiRunStatus ff-aiRunStatus--draft"
    style={{ marginTop: 12 }}
  >
    💬 {selectedAiFollowUpDue.label} — {selectedAiFollowUpDue.message}

    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="ff-btn ff-btnPrimary ff-btnSm"
onClick={() => {
  syncRightTab("messages");
  setReplyBody(
    buildAiFollowUpReply(
      selectedRow,
      selectedAiFollowUpDue.followUpCount
    )
  );

          if (!replySubject.trim()) {
            setReplySubject(
              `Re: ${titleCase(selectedRow.job_type || "Enquiry")}`
            );
          }

          setScrollToComposerPending(true);
        }}
      >
       ⚡ Nudge customer
      </button>
    </div>
  </div>
)}
{selectedRow.ai_thread_status === "awaiting_trader_review" && (
  <div className="ff-aiRunStatus ff-aiRunStatus--draft" style={{ marginTop: 12 }}>
    💬 Follow-up ready — FixFlow has prepared a message for you to review.

    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="ff-btn ff-btnPrimary ff-btnSm"
onClick={() => {
  syncRightTab("messages");
  setReplyBody(selectedRow.ai_suggested_reply || "");
  setScrollToComposerPending(true);
}}
      >
        Review message
      </button>
    </div>
  </div>
)}


{selectedRow.ai_suggested_reply ? (
  <div className="ff-aiReplyBox">
    <div className="ff-aiLabel">Suggested reply</div>

    <p className="ff-aiReplyText">
      {selectedRow.ai_suggested_reply}
    </p>

    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      <button
        type="button"
        className="ff-btn ff-btnPrimary ff-btnSm"
        onClick={() => {
          syncRightTab("messages");
          setReplyBody(selectedRow.ai_suggested_reply || "");

          if (!replySubject.trim()) {
            setReplySubject(
              `Re: ${titleCase(selectedRow.job_type || "Enquiry")}`
            );
          }

          setScrollToComposerPending(true);
        }}
      >
        Use reply
      </button>

      <button
        type="button"
        className="ff-btn ff-btnGhost ff-btnSm"
        onClick={() => {
          syncRightTab("messages");
          setReplyBody("");
          setScrollToComposerPending(true);
        }}
      >
        Write different reply
      </button>
    </div>
  </div>
) : null}
    </div>
  </div>
) : null}

    <div className="ff-overviewTopGrid" style={{ marginBottom: 4 }}>
      <div className="ff-overviewMiniCard">
        <div className="ff-overviewMiniLabel">Follow up</div>
        <div className="ff-overviewMiniValue">
          {selectedFollowUp?.label || "All good"}
        </div>
        <div className="ff-overviewMiniSub">
          {selectedFollowUp &&
          (selectedFollowUp.status === "follow_up_due" ||
            selectedFollowUp.status === "estimate_follow_up_due" ||
            selectedFollowUp.status === "needs_reply" ||
            selectedFollowUp.status === "customer_replied")
            ? selectedFollowUp.reason
            : selectedRow?.snoozed_until &&
              isSnoozedUntilActive(selectedRow.snoozed_until)
            ? "This enquiry is currently snoozed."
            : selectedDerivedStage === "won"
            ? "This enquiry has moved into booked work."
            : selectedDerivedStage === "lost"
            ? "This enquiry is closed."
            : "No follow-up needed right now."}
        </div>
      </div>

<div className="ff-overviewMiniCard">
  <div className="ff-overviewMiniLabel">Estimate</div>

  <div className="ff-overviewMiniValue">
    {selectedEstimateLabel}
  </div>

  <div className="ff-overviewMiniSub">
    {selectedEstimateStatus === "accepted"
      ? "Accepted by the customer and now moved into your Jobs workflow."
      : selectedEstimateStatus === "sent"
      ? "Sent to customer and ready for follow-up."
      : selectedEstimateStatus === "draft"
      ? "Draft started and ready to finish."
      : "No estimate created yet."}
  </div>

{pricingInsight && (() => {
  const profit = Math.round(pricingInsight.profit ?? 0);
  const margin = pricingInsight.margin ?? 0;

  const band =
    margin >= 60 ? "high" :
    margin >= 40 ? "medium" :
    "low";

  let visualClass = "ff-pricingExplainNeutral";

  if (pricingExplainText?.includes("🔥")) {
    visualClass = "ff-pricingExplainHot";
  } else if (pricingExplainText?.includes("⚠️")) {
    visualClass = "ff-pricingExplainWarn";
  } else if (pricingExplainText?.includes("💰")) {
    visualClass = "ff-pricingExplainGood";
  } else if (pricingExplainText?.includes("⚡")) {
    visualClass = "ff-pricingExplainFast";
  }

  return (
    <>
      <div className={`ff-overviewMiniMeta ff-profit-${band}`}>
        💰 £{profit} profit • {margin}% margin
      </div>

      {pricingExplainText && (
        <div className={`ff-pricingExplain ${visualClass}`}>
          {pricingExplainText}
        </div>
      )}
    </>
  );
})()}
</div>
      <div className="ff-overviewMiniCard">
        <div className="ff-overviewMiniLabel">Visit</div>
        <div className="ff-overviewMiniValue">{selectedVisitLabel}</div>
        <div className="ff-overviewMiniSub">
          {selectedVisit
            ? selectedDerivedStage === "won"
              ? "Visit booked. Next step is usually estimate or follow-up."
              : "Visit booked. Next step is usually estimate or follow-up."
            : selectedDerivedStage === "won"
            ? "This enquiry is now managed in Jobs."
            : "No appointment booked yet."}
        </div>
      </div>

      <div className="ff-overviewMiniCard">
        <div className="ff-overviewMiniLabel">Reply</div>
        <div className="ff-overviewMiniValue">{selectedReplyStatus}</div>
        <div className="ff-overviewMiniSub">
          {selectedReplyStatus === "Customer replied"
            ? "The customer has replied after your last message."
            : selectedReplyStatus === "Awaiting reply"
            ? "You have replied and are waiting for the customer."
            : "Customer is still waiting for your first reply."}
        </div>
      </div>

{selectedRow?.stage === "lost" && selectedRow?.lost_reason && (
  <div className="ff-overviewMiniCard">
    <div className="ff-overviewMiniLabel">Lost reason</div>
    <div className="ff-overviewMiniValue">
      {selectedRow.lost_reason}
    </div>
  </div>
)}

{pricingInsight && (
  <div className="ff-overviewMiniCard ff-pricingCard">
    
    <div className="ff-overviewMiniLabel">Suggested price</div>

    <div className="ff-overviewMiniValue">
      £{pricingInsight.suggested}
    </div>

    {pricingInsight.rangeLow && pricingInsight.rangeHigh && (
      <div className="ff-overviewMiniSub">
        Most jobs won between £{pricingInsight.rangeLow}–£{pricingInsight.rangeHigh}
      </div>
    )}

    <div className="ff-overviewMiniSub">
      {pricingInsight.jobsUsed >= 5
        ? "📊 Based on your past winning jobs"
        : "⚠️ Limited data — estimate carefully"}
    </div>

    <div className="ff-overviewMiniSub">
      💰 Profit: £{pricingInsight.profit} ({pricingInsight.margin}%)
    </div>

  </div>
)}

      <div className="ff-overviewMiniCard ff-overviewMiniCardWide">
        <div className="ff-overviewMiniLabel">Snooze</div>

        <div className="ff-overviewMiniValue">
          {selectedRow?.snoozed_until &&
          isSnoozedUntilActive(selectedRow.snoozed_until)
            ? "Reminder paused"
            : "Pause this enquiry"}
        </div>

        <div className="ff-overviewMiniSub">
          {selectedRow?.snoozed_until &&
          isSnoozedUntilActive(selectedRow.snoozed_until)
            ? `Snoozed until ${niceDateOnly(selectedRow.snoozed_until)}`
            : "Hide this enquiry from your immediate list until later."}
        </div>

        {selectedRow?.snoozed_until &&
        isSnoozedUntilActive(selectedRow.snoozed_until) ? (
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 8,
              justifyItems: "start",
              maxWidth: 220,
            }}
          >
            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={clearSnooze}
              disabled={snoozeSaving}
            >
              Clear snooze
            </button>
          </div>
        ) : (
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 8,
              justifyItems: "start",
              maxWidth: 220,
            }}
          >
            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={() => snoozeEnquiry(1)}
              disabled={snoozeSaving}
            >
              Snooze until tomorrow
            </button>

            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={() => snoozeEnquiry(3)}
              disabled={snoozeSaving}
            >
              Snooze for 3 days
            </button>

            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={() => snoozeEnquiry(7)}
              disabled={snoozeSaving}
            >
              Snooze until next week
            </button>
          </div>
        )}
      </div>
    </div>

    <div style={{ marginTop: 24, marginBottom: 4 }}>
      <div className="ff-sectionLabel">Quick price guide</div>

      <div
        className={`ff-overviewEstimateWrap ${getUrgencyGlowClass(
          selectedRow?.urgency
        )}`}
      >
        <QuickEstimateCard
          selectedQuote={selectedRow}
          trader={traderProfile}
        />
      </div>
    </div>

    <div style={{ marginTop: 18 }}>
      <div className="ff-detailCard">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div className="ff-detailLabel" style={{ marginBottom: 6 }}>
              Quote readiness
            </div>
            <div className="ff-detailSub">
              Can you confidently price this job yet?
            </div>
          </div>

          <Chip cls={selectedReadinessState.cls}>
            {selectedReadinessState.text}
          </Chip>
        </div>

        <div style={{ marginTop: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                color: FF.text,
              }}
            >
              {selectedReadinessScore}%
            </div>

            <div
              style={{
                fontSize: 13,
                color: FF.muted,
                lineHeight: 1.4,
              }}
            >
              {selectedReadinessState.sub}
            </div>
          </div>

          <ReadinessBar score={selectedReadinessScore} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          {selectedReadinessItems.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${FF.border}`,
                background: item.ok ? "#F8FBFF" : "#fff",
                fontSize: 12,
                fontWeight: 700,
                color: item.ok ? FF.navySoft : FF.muted,
              }}
            >
              <span style={{ fontSize: 14 }}>{item.ok ? "✓" : "—"}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {selectedMissingInfo.length ? (
          <>
            <div
              className="ff-detailLabel"
              style={{ marginTop: 18, marginBottom: 8 }}
            >
              Missing before quote
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selectedMissingInfo.map((item) => (
                <Chip key={item} cls="ff-chip ff-chipAmber">
                  {item}
                </Chip>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                className="ff-btn ff-btnGhost ff-btnSm"
                onClick={() => {
                  const customerName =
                    getCustomerFirstName(selectedRow.customer_name) || "there";

                  const text = `Hi ${customerName}, could you please send:\n- ${selectedMissingInfo.join(
                    "\n- "
                  )}`;

                  syncRightTab("messages");
                  setReplyBody(text);
                  setScrollToComposerPending(true);
                }}
              >
                Ask for missing info
              </button>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="ff-btn ff-btnPrimary ff-btnSm"
              onClick={() => syncRightTab("estimate")}
            >
              Create estimate
            </button>
          </div>
        )}
      </div>
    </div>

    <div className="ff-detailGrid" style={{ marginTop: 32 }}>
      <div className="ff-detailCard ff-detailCardHero">
        <div className="ff-problemHead">
          <div>
            <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
              Job brief
            </div>
            <div className="ff-problemTitle">
              {titleCase(selectedRow.job_type || "Enquiry")}
            </div>
          </div>
        </div>

        <div className="ff-problemText" style={{ marginTop: 14 }}>
          {selectedRow.details || "No job details provided."}
        </div>

        <div className="ff-problemMetaRow">
          <span className="ff-problemMetaPill">
            {titleCase(selectedRow.urgency || "Flexible")}
          </span>

          <span className="ff-problemMetaPill">
            {formatBudget(selectedRow.budget)}
          </span>

          {selectedRow.property_type ? (
            <span className="ff-problemMetaPill">
              {titleCase(selectedRow.property_type)}
            </span>
          ) : null}

          {selectedRow.problem_location ? (
            <span className="ff-problemMetaPill">
              {titleCase(selectedRow.problem_location)}
            </span>
          ) : null}

          <span className="ff-problemMetaPill">
            {selectedPhotoCount} file{selectedPhotoCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="ff-problemFooter">
          <div className="ff-problemFooterItem">
            <span className="ff-problemFooterLabel">Customer</span>
            <strong>
              {titleCase(selectedRow.customer_name || "Customer")}
            </strong>
          </div>

          <div className="ff-problemFooterItem">
            <span className="ff-problemFooterLabel">Postcode</span>
            <strong>{formatPostcode(selectedRow.postcode) || "—"}</strong>
          </div>

          <div className="ff-problemFooterItem">
            <span className="ff-problemFooterLabel">Status</span>
            <strong>{selectedStage?.text || "Open"}</strong>
          </div>
        </div>
      </div>

      <div className="ff-detailCard">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div className="ff-detailLabel" style={{ marginBottom: 6 }}>
              Customer
            </div>
            <div className="ff-customerName">
              {titleCase(selectedRow.customer_name || "Customer")}
            </div>
          </div>

          {selectedRow.customer_phone ? (
            <a
              href={telHref(selectedRow.customer_phone)}
              className="ff-btn ff-btnPrimary ff-btnSm"
              style={{ textDecoration: "none" }}
            >
              Call
            </a>
          ) : null}
        </div>

        <div className="ff-customerGrid">
          <div className="ff-customerItem">
            <span className="ff-customerLabel">Email</span>
            <strong>{selectedRow.customer_email || "—"}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Phone</span>
            <strong>{selectedRow.customer_phone || "—"}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Address</span>
            <strong>{selectedRow.address || selectedRow.postcode || "—"}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Property</span>
            <strong>{selectedRow.property_type || "—"}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Problem area</span>
            <strong>{selectedRow.problem_location || "—"}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Urgency</span>
            <strong>{titleCase(selectedRow.urgency || "Flexible")}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Budget</span>
            <strong>{formatBudget(selectedRow.budget)}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Parking / access</span>
            <strong>{selectedRow.parking || "—"}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Still working</span>
            <strong>{selectedRow.is_still_working || "—"}</strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Happened before</span>
            <strong>{selectedRow.has_happened_before || "—"}</strong>
          </div>
        </div>
      </div>

<div className="ff-detailCard">
  <div className="ff-detailSectionTitle">Customer history</div>



  {historyLoading ? (
    <div className="ff-detailSub">Loading…</div>
  ) : customerHistory.length <= 1 ? (
    <div className="ff-detailSub">No previous jobs</div>
  ) : (
   <>
  {/* 🔥 CUSTOMER VALUE HERO */}
  {customerStats.totalJobs > 0 && (
    <div className="ff-historyHero">
      <div className="ff-historyHeroText">
        {customerStats.totalJobs >= 3
          ? "🔥 Loyal customer — strong chance of winning this job"
          : "🔁 Returning customer — higher chance of winning this job"}
      </div>
    </div>
  )}

  {/* 💰 PRICING CARD */}
  {customerValueInsight && (
    <div className="ff-pricingInsightCard">

      <div className="ff-pricingMain">
        Typical job: {money(customerValueInsight.avg)}
      </div>

      <div className="ff-pricingSub">
        Based on {customerValueInsight.count} previous job
        {customerValueInsight.count > 1 ? "s" : ""}
      </div>

      <div className="ff-pricingActions">
        {pricingInsight && (
          <>
            <button
              type="button"
              className="ff-btn ff-btnPrimary ff-btnSm"
              onClick={applySuggestedPrice}
            >
              ⚡ Use suggested price
            </button>

            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={createMessageWithPrice}
            >
              💬 Send price
            </button>
          </>
        )}
      </div>
    </div>
  )}

  {/* 📊 STATS */}
  <div className="ff-historyStatsRow">
    <div className="ff-historyStat">
      <div className="ff-historyValue">
        {customerStats.totalJobs}
      </div>
      <div className="ff-historyLabel">Previous jobs</div>
    </div>

    <div className="ff-historyStat">
      <div className="ff-historyValue">
        {money(customerStats.totalValue)}
      </div>
      <div className="ff-historyLabel">Total value</div>
    </div>
  </div>

  {/* 📜 HISTORY LIST */}
  <div className="ff-historyList">
    {customerHistory
      .filter((r) => r.id !== selectedRow?.id)
      .slice(0, 5)
      .map((job) => (
        <div key={job.id} className="ff-historyItem">
          <div className="ff-historyTitle">
            {titleCase(job.job_type || "Job")}
          </div>

          <div className="ff-historyMeta">
            {job.created_at
              ? new Date(job.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : ""}
          </div>
        </div>
      ))}
  </div>
</>
  )}
</div>

{/* 🧠 AI INSIGHT (separate card) */}
{customerInsight && (
  <div
    className={`ff-detailCard ${
      customerInsight.type === "good"
        ? "ff-successCard"
        : customerInsight.type === "warn"
        ? "ff-warningCard"
        : ""
    }`}
    style={{ marginTop: 12 }}
  >
    <div className="ff-detailSectionTitle">AI insight</div>
    <div className="ff-detailSub">{customerInsight.text}</div>
  </div>
)}

      <div className="ff-detailCard">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="ff-detailLabel" style={{ marginBottom: 6 }}>
              Photos & files
            </div>
            <div className="ff-detailSub">
              {selectedPhotoCount > 0
                ? "Customer uploaded files are ready to review."
                : "No customer photos yet."}
            </div>
          </div>

          <Chip cls="ff-chip ff-chipBlue">
            {selectedPhotoCount} file{selectedPhotoCount === 1 ? "" : "s"}
          </Chip>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="ff-btn ff-btnGhost ff-btnSm"
            onClick={() => syncRightTab("files")}
          >
            View all files
          </button>
        </div>
      </div>

      <div className="ff-detailCard">
        <div style={{ marginBottom: 14 }}>
          <div className="ff-detailLabel" style={{ marginBottom: 6 }}>
            Quick status
          </div>
          <div className="ff-detailSub">
            A quick view of where this enquiry currently stands.
          </div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Stage</div>
          <div className="ff-detailValue">{selectedStage?.text || "Open"}</div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Reply</div>
          <div className="ff-detailValue">{selectedReplyStatus}</div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Estimate</div>
          <div className="ff-detailValue">{selectedEstimateLabel}</div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Visit</div>
          <div className="ff-detailValue">{selectedVisitLabel}</div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Follow up</div>
          <div className="ff-detailValue">
            {selectedFollowUp?.label || "All good"}
          </div>
        </div>

        {selectedFollowUp &&
        (selectedFollowUp.status === "follow_up_due" ||
          selectedFollowUp.status === "estimate_follow_up_due" ||
          selectedFollowUp.status === "needs_reply" ||
          selectedFollowUp.status === "customer_replied") ? (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={() => {
                openFollowUpComposer({
                  customerName: selectedRow?.customer_name,
                  status: selectedFollowUp.status,
                });
              }}
            >
              Follow up now
            </button>
          </div>
        ) : selectedRow?.snoozed_until &&
          isSnoozedUntilActive(selectedRow.snoozed_until) ? (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Chip cls="ff-chip ff-chipGray">
              Snoozed until {niceDateOnly(selectedRow.snoozed_until)}
            </Chip>

            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={clearSnooze}
              disabled={snoozeSaving}
            >
              Clear snooze
            </button>
          </div>
        ) : null}

<div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <button
    type="button"
    className="ff-btn ff-btnGhost ff-btnSm"
    onClick={() => markAsLost("Too expensive")}
  >
    Lost: Too expensive
  </button>

  <button
    type="button"
    className="ff-btn ff-btnGhost ff-btnSm"
    onClick={() => markAsLost("Went with another quote")}
  >
    Lost: Went elsewhere
  </button>

  <button
    type="button"
    className="ff-btn ff-btnGhost ff-btnSm"
    onClick={() => markAsLost("No response")}
  >
    Lost: No response
  </button>

  <button
    type="button"
    className="ff-btn ff-btnGhost ff-btnSm"
    onClick={() => markAsLost("Job cancelled")}
  >
    Lost: Cancelled
  </button>
</div>


<button
  type="button"
  className="ff-btn ff-btnGhost ff-btnSm"
  onClick={() => markAsLost("Job cancelled")}
>
  Lost: Cancelled
</button>
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="ff-btn ff-btnDanger ff-btnSm"
onClick={deleteEnquiry}
          >
            Delete enquiry
          </button>

<div style={{ marginTop: 10 }}>
  <button
    type="button"
    className="ff-btn ff-btnGhost ff-btnSm"
    onClick={() => {
      setDeclineReason("too_busy");
      setDeclineNote("");
      setShowDeclineModal(true);
    }}
  >
    Politely decline
  </button>
</div>

<div style={{ marginTop: 10 }}>
  <button
    type="button"
    className="ff-btn ff-btnGhost ff-btnSm"
    onClick={() =>
      openInputModal({
        title: "Mark as lost",
        message: "Why did you lose this job?",
        placeholder: "Too expensive / no response / chose another quote",
        submitLabel: "Save",
        onSubmit: (value) => markAsLost(value),
      })
    }
  >
    Mark as lost
  </button>
</div>
        </div>
      </div>
    </div>
  </>
) : null}

{rightTab === "estimate" ? (
  <div className="ff-detailGrid">
    {detailedEstimateLoading ? (
      <div className="ff-detailCard">
        <div style={{ fontSize: 13, color: FF.muted }}>
          Loading estimate…
        </div>
      </div>
    ) : (
      <>
        <div className="ff-detailCard">
          <div className="ff-detailLabel">Full estimate</div>
          <div className="ff-detailSub">
            Build, save and send a proper estimate to the customer.
          </div>

          <div
            className={`ff-overviewEstimateWrap ${getUrgencyGlowClass(
              selectedRow?.urgency
            )}`}
            style={{ marginTop: 16 }}
          >
            <div
  className="ff-estimateCard"
  style={{ marginTop: 0 }}
  ref={estimateFormRef}
>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div className="ff-estimateHead">Estimate summary</div>
                  <div className="ff-estimateSub">
                    Price this job clearly and professionally.
                  </div>
                </div>

                <Chip cls={estimateCardStatus.cls}>
                  {estimateCardStatus.text}
                </Chip>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: FF.muted,
                  marginTop: 6,
                }}
              >
                {estimateSaving
                  ? "Saving…"
                  : selectedEstimateStatus === "accepted"
                  ? "Customer has accepted this estimate"
                  : selectedEstimateStatus === "sent"
                  ? "Estimate has been emailed to the customer"
                  : detailedEstimate
                  ? "Draft saved"
                  : "Draft not saved yet"}
              </div>

              <div className="ff-estimateMetaClean">
                <div className="ff-estimateJob">
                  {selectedRow.job_number || "—"} ·{" "}
                  {titleCase(selectedRow.job_type || "Enquiry")}
                </div>
                <div className="ff-estimateMetaLine">
                  {titleCase(selectedRow.customer_name || "Customer")} ·{" "}
                  {formatPostcode(selectedRow.postcode) || "—"}
                </div>
              </div>

              <div className="ff-estimateFooter">
                <div className="ff-estimateTotalWrap">
                  <div className="ff-estimateTotalLabel">Estimate total</div>
                  <div className="ff-quickTotal">{money(estimateTotal)}</div>
                </div>

                <div className="ff-estimateFooterActions">
                  <button
                    type="button"
                    className="ff-btn ff-btnGhost ff-btnSm"
                    onClick={fillEstimateFromRequest}
                  >
                    Auto-fill
                  </button>

                  <button
  type="button"
  className={`ff-btn ff-btnSm ${
    estimateDraftSaved ? "ff-btnSuccess" : "ff-btnGhost"
  }`}
  onClick={saveEstimateDraft}
  disabled={estimateSaving}
>
  {estimateSaving ? "Saving…" : estimateDraftSaved ? "Saved ✓" : "Save draft"}
</button>

                 <button
  className={`ff-btn ff-btnSm ${
    estimateSent ? "ff-btnSuccess" : "ff-btnPrimary"
  }`}
  type="button"
  onClick={sendEstimate}
  disabled={estimateSending}
>
  {estimateSending
    ? "Sending…"
    : estimateSent
    ? "Sent ✓"
    : "Send estimate"}
</button>
                </div>
              </div>
            </div>
          </div>
        </div>

  
  


                            <div className="ff-detailCard">
                              <div className="ff-detailLabel">Price breakdown</div>
                              <div className="ff-detailSub">
                                Add the main parts of the job below.
                              </div>
                                                            <div className="ff-estimateGrid" style={{ marginTop: 14 }}>
                                <div>
                                  <label>Labour</label>
                                  <input
                                    value={estimateForm.labour}
                                    onChange={(e) =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        labour: e.target.value,
                                      }))
                                    }
                                    placeholder="0"
                                  />
                                </div>

                                <div>
                                  <label>Materials (trade cost)</label>
                                  <input
                                    value={estimateForm.materials}
                                    onChange={(e) =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        materials: e.target.value,
                                      }))
                                    }
                                    placeholder="0"
                                  />
                                </div>

                                <div>
                                  <label>Callout fee</label>
                                  <input
                                    value={estimateForm.callout}
                                    onChange={(e) =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        callout: e.target.value,
                                      }))
                                    }
                                    placeholder="0"
                                  />
                                </div>

                                <div>
                                  <label>Parts</label>
                                  <input
                                    value={estimateForm.parts}
                                    onChange={(e) =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        parts: e.target.value,
                                      }))
                                    }
                                    placeholder="0"
                                  />
                                </div>

                                <div>
                                  <label>Other</label>
                                  <input
                                    value={estimateForm.other}
                                    onChange={(e) =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        other: e.target.value,
                                      }))
                                    }
                                    placeholder="0"
                                  />
                                </div>

                                <div>
                                  <label>VAT %</label>
                                  <input
                                    value={estimateForm.vatPercent}
                                    onChange={(e) =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        vatPercent: e.target.value,
                                      }))
                                    }
                                    placeholder="20"
                                  />
                                </div>

                                <div>
                                  <label>Valid until</label>
                                  <input
                                    type="date"
                                    value={estimateForm.validUntil}
                                    onChange={(e) =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        validUntil: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              </div>

                              <div
                                style={{
                                  marginTop: 18,
                                  border: `1px solid ${FF.border}`,
                                  borderRadius: 18,
                                  background: "#F8FBFF",
                                  padding: 16,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: FF.muted,
                                    marginBottom: 8,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  Materials markup
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                  }}
                                >
                                  {["0", "10", "15", "20"].map((pct) => (
                                    <button
                                      key={pct}
                                      type="button"
                                      className={`ff-pillSmall ${
                                        estimateForm.materialsMarkupType === "percent" &&
                                        estimateForm.materialsMarkupPercent === pct
                                          ? "ff-pillNeutralActive"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        setEstimateForm((p) => ({
                                          ...p,
                                          materialsMarkupType: "percent",
                                          materialsMarkupPercent: pct,
                                        }))
                                      }
                                    >
                                      +{pct}%
                                    </button>
                                  ))}

                                  <button
                                    type="button"
                                    className={`ff-pillSmall ${
                                      estimateForm.materialsMarkupType === "custom"
                                        ? "ff-pillNeutralActive"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        materialsMarkupType: "custom",
                                      }))
                                    }
                                  >
                                    Custom
                                  </button>
                                </div>

                                {estimateForm.materialsMarkupType === "custom" ? (
                                  <input
                                    className="ff-input"
                                    style={{ marginTop: 10 }}
                                    value={estimateForm.materialsMarkupCustom}
                                    onChange={(e) =>
                                      setEstimateForm((p) => ({
                                        ...p,
                                        materialsMarkupCustom: e.target.value,
                                      }))
                                    }
                                    placeholder="Enter %"
                                  />
                                ) : null}

                                <div
                                  style={{
                                    marginTop: 10,
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    border: `1px solid ${FF.border}`,
                                    background: "#fff",
                                    fontSize: 12,
                                    color: FF.muted,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  The customer only sees the final materials
                                  amount.
                                </div>

                                <div
                                  style={{
                                    marginTop: 10,
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    border: `1px solid ${FF.border}`,
                                    background: "#F8FBFF",
                                    fontSize: 12,
                                    color: FF.navySoft,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  <div>Trade cost: {money(materialsBase)}</div>
                                  <div>Markup: {materialsMarkupPercent}%</div>
                                  <div>
                                    Profit on materials:{" "}
                                    {money(materialsMarkupAmount)}
                                  </div>
                                  <div style={{ fontWeight: 800 }}>
                                    Customer materials total: {money(materialsSell)}
                                  </div>
                                </div>

                                <div className="ff-profitHint">
                                  Estimated profit: {money(materialsMarkupAmount)}
                                </div>
                              </div>

                              <div
                                className="ff-detailEstimateTotals"
                                style={{ marginTop: 16 }}
                              >
                                <div className="ff-detailEstimateTotalRow">
                                  <span>Subtotal</span>
                                  <strong>{money(estimateSubtotal)}</strong>
                                </div>
                                <div className="ff-detailEstimateTotalRow">
                                  <span>VAT</span>
                                  <strong>{money(estimateVat)}</strong>
                                </div>
                                <div className="ff-detailEstimateTotalRow ff-detailEstimateTotalRowGrand">
                                  <span>Total</span>
                                  <strong>{money(estimateTotal)}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="ff-detailCard">
                              <div className="ff-detailLabel">Notes</div>
                              <div className="ff-detailSub">
                                Optional detail for the customer.
                              </div>

                              <textarea
                                className="ff-estimateNotes"
                                style={{ marginTop: 14, minHeight: 64 }}
                                placeholder="Short message to customer..."
                                value={estimateForm.customerMessage}
                                onChange={(e) =>
                                  setEstimateForm((p) => ({
                                    ...p,
                                    customerMessage: e.target.value,
                                  }))
                                }
                              />

                              <textarea
                                className="ff-estimateNotes"
                                style={{ marginTop: 12 }}
                                placeholder="What’s included..."
                                value={estimateForm.includedNotes}
                                onChange={(e) =>
                                  setEstimateForm((p) => ({
                                    ...p,
                                    includedNotes: e.target.value,
                                  }))
                                }
                              />

                              <textarea
                                className="ff-estimateNotes"
                                style={{ marginTop: 12 }}
                                placeholder="What’s excluded..."
                                value={estimateForm.excludedNotes}
                                onChange={(e) =>
                                  setEstimateForm((p) => ({
                                    ...p,
                                    excludedNotes: e.target.value,
                                  }))
                                }
                              />
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}

                    {rightTab === "files" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailLabel">Attachments</div>
                          <div className="ff-detailSub">
                            View customer files and upload your own.
                          </div>

                          <div
                            style={{
                              marginTop: 14,
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <Chip cls="ff-chip ff-chipBlue">
                              Customer files {custFiles.length}
                            </Chip>
                            <Chip cls="ff-chip ff-chipGray">
                              Your files {traderFiles.length}
                            </Chip>
                          </div>

                          {fileMsg ? (
                            <div
                              style={{
                                marginTop: 10,
                                fontSize: 13,
                                color: FF.muted,
                              }}
                            >
                              {fileMsg}
                            </div>
                          ) : null}

                          <div style={{ marginTop: 18 }}>
                            <div
                              className="ff-detailLabel"
                              style={{ marginBottom: 8 }}
                            >
                              Customer files
                            </div>

                            {filesLoading ? (
                              <div style={{ fontSize: 13, color: FF.muted }}>
                                Loading attachments…
                              </div>
                            ) : custFiles.length ? (
                              <div className="ff-overviewPhotoGrid">
                                {custFiles.map((file) => {
                                  const isImage = isImageFile(file.name);

                                  return (
                                    <a
                                      key={file.path}
                                      href={file.url || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ff-overviewPhotoTile"
                                    >
                                      {isImage && file.url ? (
                                        <img
                                          src={file.url}
                                          alt={file.name}
                                          className="ff-overviewPhotoImg"
                                        />
                                      ) : (
                                        <div className="ff-overviewPhotoFallback">
                                          {fileTypeLabel(file.name)}
                                        </div>
                                      )}

                                      <div style={{ padding: 10 }}>
                                        <div
                                          style={{
                                            fontSize: 12,
                                            fontWeight: 800,
                                            color: FF.text,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                          }}
                                        >
                                          {file.name}
                                        </div>

                                        <div
                                          style={{
                                            marginTop: 4,
                                            display: "flex",
                                            gap: 8,
                                            flexWrap: "wrap",
                                            fontSize: 11,
                                            color: FF.muted,
                                          }}
                                        >
                                          <span>{fileTypeLabel(file.name)}</span>
                                          {file.size ? (
                                            <span>{prettyFileSize(file.size)}</span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: FF.muted }}>
                                No customer files.
                              </div>
                            )}
                          </div>

<div style={{ marginTop: 20 }}>
  <div
    className="ff-detailLabel"
    style={{ marginBottom: 8 }}
  >
    Upload your files
  </div>

  <label
    className={`ff-btn ff-btnSm ${
      fileUploaded ? "ff-btnSuccess" : "ff-btnPrimary"
    }`}
    style={{
      display: "inline-flex",
      alignItems: "center",
      cursor: uploading ? "not-allowed" : "pointer",
      opacity: uploading ? 0.7 : 1,
    }}
  >
    {uploading
      ? "Uploading..."
      : fileUploaded
      ? "Uploaded ✓"
      : "Upload files"}

    <input
      type="file"
      multiple
      onChange={onUploadTraderFiles}
      disabled={uploading}
      style={{ display: "none" }}
    />
  </label>

  <div
    style={{
      marginTop: 8,
      fontSize: 12,
      color: FF.muted,
    }}
  >
    Upload quotes, PDFs, photos, job notes or parts lists.
  </div>
</div>

                          <div style={{ marginTop: 20 }}>
                            <div
                              className="ff-detailLabel"
                              style={{ marginBottom: 8 }}
                            >
                              Your files
                            </div>

                            {filesLoading ? (
                              <div style={{ fontSize: 13, color: FF.muted }}>
                                Loading attachments…
                              </div>
                            ) : traderFiles.length ? (
                              <div style={{ display: "grid", gap: 10 }}>
                                {traderFiles.map((file) => (
                                  <div
                                    key={file.path}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      padding: 12,
                                      border: `1px solid ${FF.border}`,
                                      borderRadius: 14,
                                      background: "#fff",
                                    }}
                                  >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 800,
                                          color: FF.text,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {file.name}
                                      </div>

                                      <div
                                        style={{
                                          marginTop: 4,
                                          display: "flex",
                                          gap: 8,
                                          flexWrap: "wrap",
                                          fontSize: 11,
                                          color: FF.muted,
                                        }}
                                      >
                                        <span>{fileTypeLabel(file.name)}</span>
                                        {file.size ? (
                                          <span>{prettyFileSize(file.size)}</span>
                                        ) : null}
                                        {file.created_at ? (
                                          <span>{niceDate(file.created_at)}</span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <a
                                        href={file.url || "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ff-btn ff-btnGhost ff-btnSm"
                                        style={{ textDecoration: "none" }}
                                      >
                                        Open
                                      </a>

                                      <button
                                        type="button"
                                        className="ff-btn ff-btnGhost ff-btnSm"
                                        onClick={() => deleteTraderFile(file.path)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: FF.muted }}>
                                No files uploaded yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                                        {rightTab === "visit" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard" ref={visitSectionRef}>
                          <div className="ff-detailLabel">Site visit</div>
                          <div className="ff-detailSub">
                            Book a visit and send the customer the appointment
                            details.
                          </div>

                          <div
                            style={{
                              marginTop: 14,
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <Chip
                              cls={
                                selectedVisit
                                  ? "ff-chip ff-chipBlue"
                                  : "ff-chip ff-chipGray"
                              }
                            >
                              {selectedVisit ? "Visit booked" : "Not booked"}
                            </Chip>

                            {selectedVisit ? (
                              <Chip cls="ff-chip ff-chipGray">
                                {niceDate(selectedVisit.starts_at)}
                              </Chip>
                            ) : null}
                          </div>

                          <div style={{ marginTop: 14 }}>
                           <button
  className={`ff-btn ff-btnPrimary ff-btnSm ${getAiButtonClass(selectedDisplayedAiAction, "visit")}`}
  type="button"
  onClick={openSiteVisitModal}
>
  {selectedVisit
    ? "Rebook visit"
    : String(selectedDisplayedAiAction || "").toLowerCase().includes("visit")
    ? "⚡ Book visit"
    : "Book visit"}
</button>
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 12,
                              color: FF.muted,
                            }}
                          >
                            {selectedVisit
                              ? "You can rebook this visit if the time changes."
                              : "Choose a date and time, then the customer gets the details."}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {rightTab === "notes" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailLabel">Private notes</div>
                          <div className="ff-detailSub">
                            Save internal notes for access, materials, pricing
                            and follow-up.
                          </div>

                          <div
                            style={{
                              marginTop: 12,
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <Chip cls="ff-chip ff-chipGray">Internal only</Chip>
                            <Chip cls="ff-chip ff-chipGray">
                              Not visible to customer
                            </Chip>
                          </div>

                          {notesMsg ? (
                            <div
                              style={{
                                marginTop: 12,
                                fontSize: 13,
                                color: FF.muted,
                              }}
                            >
                              {notesMsg}
                            </div>
                          ) : null}

                          <textarea
                            style={{
                              width: "100%",
                              minHeight: 140,
                              borderRadius: 16,
                              border: `1px solid ${FF.border}`,
                              padding: 12,
                              outline: "none",
                              fontSize: 13,
                              lineHeight: 1.45,
                              color: FF.text,
                              marginTop: 14,
                            }}
                            value={traderNotes}
                            onChange={(e) => setTraderNotes(e.target.value)}
                            placeholder="Materials, access notes, pricing thoughts, follow-ups…"
                          />

                          <div style={{ marginTop: 10 }}>
                          <button
  className={`ff-btn ff-btnSm ${
    notesSaved ? "ff-btnSuccess" : "ff-btnPrimary"
  }`}
  type="button"
  onClick={saveTraderNotes}
  disabled={notesSaving}
>
  {notesSaving ? "Saving…" : notesSaved ? "Saved ✓" : "Save notes"}
</button>
                          </div>
                        </div>
                      </div>
                    ) : null}

{rightTab === "messages" ? (
  <div className="ff-chatWrap">
    {selectedReplyStatus === "Customer replied" ? (
  <div className="ff-followUpBanner">
    ⚡ Customer replied — reply now before this job goes cold

    <button
      type="button"
      className="ff-btn ff-btnSm ff-btnPrimary"
      onClick={() => {
       const name = selectedRow?.customer_name
  ? titleCase(selectedRow.customer_name).split(" ")[0]
  : "there";

        setReplyBody(
          `Hi ${name}, thanks for your reply — I’ll take a look and come back to you shortly.`
        );

        setScrollToComposerPending(true);
      }}
    >
      Write reply
    </button>
  </div>
) : null}
{selectedReplyStatus === "Awaiting first reply" ? (
  <div className="ff-followUpBanner">
    ⚡ New enquiry — send a fast first reply

    <button
      type="button"
      className="ff-btn ff-btnSm ff-btnPrimary"
      onClick={() => {
       const name = selectedRow?.customer_name
  ? titleCase(selectedRow.customer_name).split(" ")[0]
  : "there";

        setReplyBody(
          `Hi ${name}, thanks for your enquiry — I’m just reviewing this now and will come back to you shortly.`
        );

        setScrollToComposerPending(true);
      }}
    >
      Write reply
    </button>
  </div>
) : null}

{selectedReplyStatus === "Awaiting reply" ? (
  <div className="ff-followUpBanner ff-followUpBannerSoft">
    Waiting on customer — no action needed right now
  </div>
) : null}

    {selectedFollowUp &&
    (selectedFollowUp.status === "follow_up_due" ||
      selectedFollowUp.status === "estimate_follow_up_due") ? (
      <div
        style={{
          marginBottom: 14,
          padding: 14,
          borderRadius: 16,
          border: `1px solid ${FF.border}`,
          background:
            selectedFollowUp.status === "estimate_follow_up_due"
              ? "#FFF7ED"
              : "#F4F7FF",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: FF.muted,
            marginBottom: 6,
          }}
        >
          Follow-up reminder
        </div>

        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: FF.text,
            marginBottom: 6,
          }}
        >
          {selectedFollowUp.label}
        </div>

        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: FF.muted,
          }}
        >
          A quick, polite message now could help bring this job back.
        </div>
      </div>
    ) : null}

{selectedRow?.ai_thread_status === "awaiting_trader_review" &&
selectedRow?.ai_suggested_reply ? (
  <div className="ff-followUpReviewCard">
    <div>
      <div className="ff-detailLabel">Follow-up ready</div>
      <div className="ff-detailSub">
        FixFlow has prepared this message. Review it, edit if needed, then send.
      </div>
    </div>

<Chip cls="ff-chip ff-chipBlue">
  Follow-up {(selectedRow.ai_follow_up_count || 0) + 1}
</Chip>
  </div>
) : null}

    <div className="ff-chatTop">
      <div>
<div className="ff-detailLabel">Win this job</div>
<div className="ff-detailSub">
  Reply quickly, follow up clearly, and keep the customer moving.
</div>

        <div className="ff-chatStatusRow">
          <Chip
            cls={
              selectedReplyStatus === "Customer replied"
                ? "ff-chip ff-chipBlue"
                : selectedReplyStatus === "Awaiting first reply"
                ? "ff-chip ff-chipAmber"
                : "ff-chip ff-chipGray"
            }
          >
            {selectedReplyStatus === "Customer replied"
              ? "Customer waiting"
              : selectedReplyStatus === "Awaiting first reply"
              ? "Awaiting first reply"
              : "Waiting on customer"}
          </Chip>
        </div>
      </div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  <button
type="button"
className={`ff-btn ff-btnGhost ff-btnSm ${
autoFollowUpsEnabled ? "ff-btnSuccess" : ""
}`}
onClick={() => setAutoFollowUpsEnabled((v) => !v)}
>
{autoFollowUpsEnabled ? "🤖 Autopilot on" : "Turn on Autopilot"}
</button>
  <button
    className="ff-btn ff-btnGhost ff-btnSm"
    type="button"
    onClick={logCallOnCurrentEnquiry}
  >
    + Log call
  </button>

  <button
    className="ff-btn ff-btnGhost ff-btnSm"
    type="button"
    onClick={() => uid && selectedRow && loadThread(selectedRow.id, uid)}
    disabled={threadLoading}
  >
    {threadLoading ? "Loading…" : "Refresh"}
  </button>
</div>
    </div>

    <div className="ff-chatBody">
      {threadLoading ? (
        <div style={{ color: FF.muted, fontSize: 13 }}>
          Loading messages…
        </div>
      ) : thread.length ? (
        thread.map((m) => {
          const outbound = isOutboundDirection(m.direction);
          const isPhone = m.channel === "phone";
          const body = (m.body_text ?? "").trim();

          return (
            <button
              key={m.id}
              type="button"
              className={`ff-chatRow ${
                outbound ? "ff-chatRowOut" : "ff-chatRowIn"
              }`}
              onClick={() => setExpandedMsg(m)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
            <div
  className={`ff-chatBubble ${
    isPhone
      ? "ff-chatBubblePhone"
      : outbound
      ? "ff-chatBubbleOut"
      : "ff-chatBubbleIn"
  }`}
>
                <div className="ff-chatMeta">
<span className="ff-chatName">
  {isPhone ? "📞 Phone call" : outbound ? "You" : "Customer"}
</span>
                  <span className="ff-chatTime">
                    {niceDate(m.created_at)}
                  </span>
                </div>

{m.subject ? (
  <div className="ff-chatSubject">{m.subject}</div>
) : null}

{m.is_follow_up && (
  <div
    className={`ff-followUpBadge ${
      m.follow_up_number === 2 ? "ff-followUpBadgeFinal" : ""
    }`}
  >
    💬 {m.follow_up_number === 2 ? "Final follow-up" : "Follow-up"}
  </div>
)}

<div className="ff-chatText">
  {String(body || "—")
    .split("\n")
    .map((line, index) => {
      const isUrl = line.startsWith("http");

      if (isUrl) {
        return (
          <a
            key={index}
            href={line}
            target="_blank"
            rel="noopener noreferrer"
            className="ff-fileBubble"
          >
            📎 Open uploaded file
          </a>
        );
      }

      return <div key={index}>{line}</div>;
    })}
</div>
              </div>
            </button>
          );
        })
      ) : (
        <div className="ff-emptyState">
          <div className="ff-emptyIcon">💬</div>
          <div className="ff-emptyTitle">No messages yet</div>
          <div className="ff-emptyText">
            When you send or receive messages, they will appear here.
          </div>
        </div>
      )}

      <div ref={threadBottomRef} />
    </div>

    <div className="ff-chatComposer" ref={messageComposerRef}>
      <div className="ff-chatComposerTop">
        <input
          className="ff-input"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="Customer email"
        />
        <input
          className="ff-input"
          value={replySubject}
          onChange={(e) => setReplySubject(e.target.value)}
          placeholder="Subject"
        />
      </div>

      <div className="ff-quickReplyRow">
        <button
  type="button"
  className="ff-quickReplyBtn ff-quickReplyBtnHot"
  onClick={() => {
 const name = selectedRow?.customer_name
  ? titleCase(selectedRow.customer_name).split(" ")[0]
  : "there";
    setReplyBody(
      `Hi ${name}, thanks for your enquiry — I can help with this. I’ll just check a couple of details and come back to you shortly.`
    );
  }}
>
  ⚡ Fast reply
</button>

<button
  type="button"
  className="ff-quickReplyBtn"
  onClick={() => {
    const name = selectedRow?.customer_name
  ? titleCase(selectedRow.customer_name).split(" ")[0]
  : "there";
    const job = selectedRow?.job_type?.toLowerCase() || "job";
    setReplyBody(
      `Hi ${name}, thanks for sending this over. I’ve dealt with similar ${job} jobs before, so I should be able to help. Could you send over any photos or extra details so I can price it properly?`
    );
  }}
>
  🛠 Trust builder
</button>

<button
  type="button"
  className="ff-quickReplyBtn"
  onClick={() => {
    const name = selectedRow?.customer_name
  ? titleCase(selectedRow.customer_name).split(" ")[0]
  : "there";
    const job = selectedRow?.job_type?.toLowerCase() || "job";
    setReplyBody(
      `Hi ${name}, I can help with the ${job}. I’ve got some availability coming up — would you like me to get you booked in?`
    );
  }}
>
  💰 Close job
</button>
        {selectedFollowUp &&
        (selectedFollowUp.status === "follow_up_due" ||
          selectedFollowUp.status === "estimate_follow_up_due") ? (
          <>
  




            <button
              type="button"
              className="ff-quickReplyBtn"
              onClick={() =>
                setReplyBody(
                  `Hi ${ getCustomerFirstName(selectedRow.customer_name)|| ""}, just checking in to see if you'd like to go ahead with this.`
                )
              }
            >
              Still interested?
            </button>

            {selectedFollowUp.status === "estimate_follow_up_due" ? (
              <button
                type="button"
                className="ff-quickReplyBtn"
                onClick={() =>
                  setReplyBody(
                    `Hi ${getCustomerFirstName(selectedRow.customer_name) || ""}, just following up on the estimate I sent over. Let me know if you'd like to move forward.`
                  )
                }
              >
                Follow up estimate
              </button>
            ) : null}

            <button
              type="button"
              className="ff-quickReplyBtn"
              onClick={() =>
                setReplyBody(
                  `Hi ${getCustomerFirstName(selectedRow.customer_name) || ""}, just checking whether you'd still like me to quote for this job.`
                )
              }
            >
              Check if still quoting
            </button>
          </>
        ) : null}

        {quickReplies.map((text) => (
          <button
            key={text}
            type="button"
            className="ff-quickReplyBtn"
            onClick={() =>
              setReplyBody((prev) => insertReplyText(prev, text))
            }
          >
            {text}
          </button>
        ))}
      </div>

      <textarea
        ref={replyBodyRef}
        className="ff-chatInput"
        value={replyBody}
        onChange={(e) => setReplyBody(e.target.value)}
      />

      <div className="ff-chatActions">
        <div className="ff-chatHint">
          Replying to {replyTo || "customer"}
        </div>

<div className="ff-chatActionButtons">
  <button
    className="ff-btn ff-btnGhost ff-btnSm"
    type="button"
    onClick={() => setReplyBody("")}
  >
    Clear
  </button>

{replyBody.trim().startsWith("Hi ") && (
  <button
    className="ff-btn ff-btnGhost ff-btnSm ff-btnPulse"
    type="button"
    onClick={async () => {
      try {
        setSendAndNextLoading(true);

        await sendReply();

        setTimeout(() => {
          const nextRow = findNextActionRow(selectedRow?.id);

          if (nextRow) {
            selectEnquiry(nextRow.id, "messages");
          }
        }, 400);
      } catch (err) {
        console.error("Send & next failed", err);
      } finally {
        setSendAndNextLoading(false);
      }
    }}
    disabled={
      sendAndNextLoading ||
      replySending ||
      !replyTo.trim() ||
      !replyBody.trim()
    }
  >
    {sendAndNextLoading ? "Sending…" : "⚡ Send & go to next job"}
  </button>
)}

  <button
    className="ff-btn ff-btnPrimary ff-btnSm"
    type="button"
    onClick={sendReply}
    disabled={!replyTo.trim() || !replyBody.trim()}
  >
    Send to customer
  </button>
</div>
      </div>
    </div>
  </div>
) : null}

                  </div>
                </>
                     
              )}
            </div>
          </div>
        </div>
      </div>

      {toast ? (
        <div
          className={`ff-toast ${
            toast.type === "error" ? "ff-toastError" : "ff-toastSuccess"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <Modal
        open={siteVisitOpen}
        title="Book site visit"
        onClose={() => setSiteVisitOpen(false)}
      >
        <div className="ff-detailGrid">
          <div>
            <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
              Date & time
            </div>
            <input
              type="datetime-local"
              className="ff-input"
              value={siteVisitStartsAt}
              onChange={(e) => setSiteVisitStartsAt(e.target.value)}
            />
          </div>

          <div>
            <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
              Duration
            </div>
            <select
              className="ff-input"
              value={siteVisitDuration}
              onChange={(e) => setSiteVisitDuration(Number(e.target.value))}
            >
              <option value={30}>30 mins</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          {siteVisitMsg ? (
            <div style={{ fontSize: 13, color: "#b42318" }}>
              {siteVisitMsg}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={() => setSiteVisitOpen(false)}
            >
              Cancel
            </button>

            <button
              className={`ff-btn ff-btnSm ${
                siteVisitBooked ? "ff-btnSuccess" : "ff-btnPrimary"
              }`}
              type="button"
              onClick={bookSiteVisit}
              disabled={siteVisitSending || !siteVisitStartsAt}
            >
              {siteVisitSending
                ? "Booking..."
                : siteVisitBooked
                ? "Booked ✓"
                : selectedVisit
                ? "Rebook visit"
                : "Book visit"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!expandedMsg}
        title={expandedMsg?.subject || "Message"}
        onClose={() => setExpandedMsg(null)}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: FF.muted, fontWeight: 700 }}>
            {expandedMsg?.from_email ? `From: ${expandedMsg.from_email}` : ""}
            {expandedMsg?.from_email && expandedMsg?.to_email ? " • " : ""}
            {expandedMsg?.to_email ? `To: ${expandedMsg.to_email}` : ""}
          </div>

          <div style={{ fontSize: 12, color: FF.muted }}>
            {expandedMsg?.created_at ? niceDate(expandedMsg.created_at) : ""}
          </div>

          <div
            style={{
              border: `1px solid ${FF.border}`,
              background: FF.blueSoft2,
              borderRadius: 16,
              padding: 12,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              fontSize: 13,
              lineHeight: 1.55,
              color: FF.text,
            }}
          >
            {(expandedMsg?.body_text ?? "").trim() || "—"}
          </div>
        </div>
      </Modal>
      <Modal
  open={showCallModal}
  title="Add enquiry"
  onClose={() => setShowCallModal(false)}
>
  <div className="ff-detailGrid">

  <select
    className="ff-input"
    value={callForm.source}
    onChange={(e) =>
      setCallForm((p) => ({ ...p, source: e.target.value }))
    }
  >
    <option value="manual">✍️ Manual</option>
    <option value="phone">📞 Phone call</option>
    <option value="email">📧 Email</option>
    <option value="walk_in">🚶 Walk-in</option>
  </select>

  <input
    className="ff-input"
    placeholder="Customer name"
    value={callForm.customer_name}
    onChange={(e) =>
      setCallForm((p) => ({ ...p, customer_name: e.target.value }))
    }
  />

  <input
    className="ff-input"
    placeholder="Phone number"
    value={callForm.customer_phone}
    onChange={(e) =>
      setCallForm((p) => ({ ...p, customer_phone: e.target.value }))
    }
  />

  <input
    className="ff-input"
    placeholder="Job type e.g. leaking tap"
    value={callForm.job_type}
    onChange={(e) =>
      setCallForm((p) => ({ ...p, job_type: e.target.value }))
    }
  />

  <select
    className="ff-input"
    value={callForm.urgency}
    onChange={(e) =>
      setCallForm((p) => ({ ...p, urgency: e.target.value }))
    }
  >
    <option>ASAP</option>
    <option>This week</option>
    <option>Next week</option>
    <option>Flexible</option>
  </select>

  <textarea
    className="ff-textarea"
    placeholder="Notes…"
    value={callForm.details}
    onChange={(e) =>
      setCallForm((p) => ({ ...p, details: e.target.value }))
    }
  />


    <div className="ff-inlineActions" style={{ justifyContent: "flex-end" }}>
      <button
        type="button"
        className="ff-btn ff-btnGhost ff-btnSm"
        onClick={() => setShowCallModal(false)}
      >
        Cancel
      </button>

      <button
        type="button"
        className="ff-btn ff-btnPrimary ff-btnSm"
        onClick={createCallEnquiry}
      >
        Save enquiry
      </button>
    </div>
  </div>
</Modal>
{confirmModal?.open && (
  <div className="ff-modalOverlay" onClick={() => setConfirmModal(null)}>
    <div className="ff-modalCard" onClick={(e) => e.stopPropagation()}>
      <div className="ff-modalTitle">{confirmModal.title}</div>

      <div className="ff-modalText">{confirmModal.message}</div>

      <div className="ff-modalActions">
        <button
          type="button"
          className="ff-btn ff-btnGhost"
          onClick={() => setConfirmModal(null)}
        >
          Cancel
        </button>

        <button
          type="button"
          className={
            confirmModal.danger
              ? "ff-btn ff-btnDanger"
              : "ff-btn ff-btnPrimary"
          }
          onClick={() => {
            confirmModal.onConfirm();
            setConfirmModal(null);
          }}
        >
          {confirmModal.confirmLabel}
        </button>
      </div>
    </div>
  </div>
)}

{inputModal?.open && (
  <div className="ff-modalOverlay" onClick={() => setInputModal(null)}>
    <div className="ff-modalCard" onClick={(e) => e.stopPropagation()}>
      <div className="ff-modalTitle">{inputModal.title}</div>

      {inputModal.message ? (
        <div className="ff-modalText">{inputModal.message}</div>
      ) : null}

      <textarea
        className="ff-modalTextarea"
        placeholder={inputModal.placeholder || "Type here..."}
        value={inputModalValue}
        onChange={(e) => setInputModalValue(e.target.value)}
        rows={5}
        autoFocus
      />

      <div className="ff-modalActions">
        <button
          type="button"
          className="ff-btn ff-btnGhost"
          onClick={() => setInputModal(null)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="ff-btn ff-btnPrimary"
          disabled={!inputModalValue.trim()}
          onClick={() => {
            inputModal.onSubmit(inputModalValue.trim());
            setInputModal(null);
            setInputModalValue("");
          }}
        >
          {inputModal.submitLabel}
        </button>
      </div>
    </div>
  </div>
)}
{showDeclineModal && selectedRow ? (
  <div className="ff-modalBackdrop">
    <div className="ff-modal">
      <div className="ff-modalTop">
        <div>
          <h2>Politely decline enquiry</h2>
          <p>
            Send the customer a respectful reply instead of leaving them waiting.
          </p>
        </div>

        <button
          type="button"
          className="ff-iconBtn"
          onClick={() => setShowDeclineModal(false)}
        >
          ×
        </button>
      </div>

      <div className="ff-field">
        <label className="ff-label">Reason</label>
        <select
          className="ff-input"
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
        >
          <option value="too_busy">Too busy right now</option>
          <option value="outside_area">Outside service area</option>
          <option value="not_right_fit">Not the right fit</option>
        </select>
      </div>

      <div className="ff-field">
        <label className="ff-label">Optional note</label>
        <textarea
          className="ff-textarea"
          value={declineNote}
          onChange={(e) => setDeclineNote(e.target.value)}
          placeholder="Optional internal note..."
        />
      </div>

      <div className="ff-previewBox">
        <strong>Message preview</strong>
        <pre>{buildDeclineMessage(declineReason)}</pre>
      </div>

      <div className="ff-modalActions">
        <button
          type="button"
          className="ff-btn ff-btnGhost"
          onClick={() => setShowDeclineModal(false)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="ff-btn ff-btnPrimary"
          disabled={declineBusy}
          onClick={handleDeclineEnquiry}
        >
          {declineBusy ? "Sending..." : "Send polite reply"}
        </button>
      </div>
    </div>
  </div>
) : null}
   </>
  );
}
