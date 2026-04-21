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
  | "waiting";

type BestAction = {
  title: string;
  text: string;
  button: null | {
    label: string;
    action: () => void;
  };
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
function getEnquiryPriority(args: {
  followUp?: FollowUpResult | null;
  replyStatus: string | null;
  estimate?: QuickEstimateLite | null;
}) {
  const { followUp, estimate } = args;

  if (followUp?.status === "customer_replied") return 100;
  if (followUp?.status === "needs_reply") return 90;
  if (followUp?.status === "estimate_follow_up_due") return 80;
  if (followUp?.status === "follow_up_due") return 70;

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
  if (photos > 0) score += 15;
  if (photos >= 3) score += 5;
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
  const name = titleCase(params.customerName) || "there";
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

/* ================================
   COMPONENT
================================ */

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

  const [tab, setTab] = useState<ListTab>("all");
 const [searchFilter, setSearchFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

  const [rows, setRows] = useState<QuoteRequestRow[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("details");

  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const [thread, setThread] = useState<EnquiryMessageRow[]>([]);
  const [threadMap, setThreadMap] = useState<Record<string, EnquiryMessageRow[]>>({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState<EnquiryMessageRow | null>(null);

  const [custFiles, setCustFiles] = useState<FileItem[]>([]);
  const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoCountMap, setPhotoCountMap] = useState<Record<string, number>>({});

  const [siteVisit, setSiteVisit] = useState<SiteVisitRow | null>(null);
  const [siteVisitLoading, setSiteVisitLoading] = useState(false);
  const [visitMap, setVisitMap] = useState<Record<string, SiteVisitRow | null>>({});

  const [detailedEstimate, setDetailedEstimate] = useState<DetailedEstimateRow | null>(null);
  const [detailedEstimateItems, setDetailedEstimateItems] = useState<DetailedEstimateItemRow[]>([]);
  const [detailedEstimateLoading, setDetailedEstimateLoading] = useState(false);
  const [estimateMap, setEstimateMap] = useState<Record<string, QuickEstimateLite | null>>({});

  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [siteVisitStartsAt, setSiteVisitStartsAt] = useState("");
  const [siteVisitDuration, setSiteVisitDuration] = useState(60);
  const [siteVisitSending, setSiteVisitSending] = useState(false);
  const [siteVisitMsg, setSiteVisitMsg] = useState<string | null>(null);
const [aiJustUpdatedId, setAiJustUpdatedId] = useState<string | null>(null);
const autoAnalysingRef = useRef<string | null>(null);

const [snoozeSaving, setSnoozeSaving] = useState(false);

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



  const lastMarkedRef = useRef<string | null>(null);
  const activeEnquiryRef = useRef<HTMLButtonElement | null>(null);
  const rightPaneScrollRef = useRef<HTMLDivElement | null>(null);
const messageComposerRef = useRef<HTMLDivElement | null>(null);
const replyBodyRef = useRef<HTMLTextAreaElement | null>(null);
const [scrollToComposerPending, setScrollToComposerPending] = useState(false);

const estimateFormRef = useRef<HTMLDivElement | null>(null);
const [scrollToEstimatePending, setScrollToEstimatePending] = useState(false);

const visitSectionRef = useRef<HTMLDivElement | null>(null);
const [scrollToVisitPending, setScrollToVisitPending] = useState(false);
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
    ? photoCountMap[selectedRow.id] || 0
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
  
const selectedFollowUp = selectedRow
  ? followUpMap[selectedRow.id]
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

        const followUpMessage =
          followUpState.status === "estimate_follow_up_due"
            ? `Hi ${customerName}, just checking you received the estimate I sent over and whether you'd like to go ahead.`
            : `Hi ${customerName}, just checking in to see if you'd still like to go ahead with this job.`;

        setReplyBody(followUpMessage);
        setScrollToComposerPending(true);
      },
    },
  };
}

  if (estimateSent) {
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

  if (!hasVisit && (selectedPhotoCount === 0 || selectedMissingInfo.length >= 2)) {
    return {
      title: selectedPhotoCount === 0 ? "Ask for photos" : "Get missing details",
      text:
        selectedPhotoCount === 0
          ? "A few photos will make this much easier to price accurately."
          : "A couple more details will help you quote this job with more confidence.",
button: {
  label: "Ask customer",
  action: () => {
    syncRightTab("messages");

    const customerName =
      titleCase(selectedRow.customer_name) || "there";

    setReplyBody(
      `Hi ${customerName}, could you please send:\n- ${selectedMissingInfo.join("\n- ")}`
    );

    // 🔥 scroll + focus
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

  if (!hasVisit && (selectedPhotoCount === 0 || selectedMissingInfo.length >= 2)) {
    return {
      title: "Get a bit more info",
      text: "Ask for missing details or photos before pricing this one properly.",
button: {
  label: "Ask customer",
  action: () => {
    syncRightTab("messages");

    const customerName =
      titleCase(selectedRow.customer_name) || "there";

    setReplyBody(
      `Hi ${customerName}, could you please send:\n- ${selectedMissingInfo.join("\n- ")}`
    );

    // 🔥 scroll + focus to composer
    setScrollToComposerPending(true);
  },
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


 const filteredRows = useMemo(() => {
  let out = [...rows];

  if (tab === "unread") {
    out = out.filter((r) => !r.read_at);
  }

  if (tab === "needsAction") {
    out = out.filter((r) => {
      return followUpMap[r.id]?.bucket === "needsAction";
    });
  }

  if (tab === "followUp") {
    out = out.filter((r) => {
      return followUpMap[r.id]?.bucket === "followUp";
    });
  }

  if (tab === "waiting") {
  out = out.filter((r) => {
    return followUpMap[r.id]?.bucket === "allGood";
  });
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
}, [rows, tab, searchFilter, urgencyFilter, followUpMap]);
function getReplyStatus(messages: EnquiryMessageRow[]) {
  const hasOutbound = messages.some((m) => isOutboundDirection(m.direction));
  const hasCustomerReply = hasCustomerReplyAfterOutbound(messages);

  if (hasCustomerReply) return "Customer replied";
  if (hasOutbound) return "Awaiting reply";
  return "Awaiting first reply";
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

const sortedRows = useMemo(() => {
  return [...filteredRows].sort((a, b) => {
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

    const aPriority = getEnquiryPriority({
      followUp: aFollowUp,
      replyStatus: aReplyStatus,
      estimate: aEstimate,
    });

    const bPriority = getEnquiryPriority({
      followUp: bFollowUp,
      replyStatus: bReplyStatus,
      estimate: bEstimate,
    });

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
}, [filteredRows, selectedId, tab, followUpMap, estimateMap, visitMap, threadMap]);

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

  /* ================================
     LOCAL HELPERS
  ================================= */

  function pushToast(text: string, type: "success" | "error" = "success") {
    setToast({ text, type });
    window.clearTimeout((pushToast as any)._t);
    (pushToast as any)._t = window.setTimeout(() => setToast(null), 2800);
  }

  function selectEnquiry(id: string, tabOverride?: RightTab) {
    setSelectedIdState(id);

    const params = new URLSearchParams(sp.toString());
    params.set("requestId", id);
    if (tabOverride) params.set("tab", tabOverride);
    router.replace(`/dashboard/enquiries?${params.toString()}`);

    if (tabOverride) setRightTab(tabOverride);
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
    router.replace(`/dashboard/enquiries?${params.toString()}`);
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

  async function loadPhotoCounts(requests: QuoteRequestRow[]) {
    const entries = await Promise.all(
      requests.map(async (r) => {
        const { data } = await supabase.storage
          .from(BUCKET)
          .list(customerFolder(r.id), {
            limit: 100,
            sortBy: { column: "name", order: "asc" },
          });

        const count = (data || []).filter((f) => isImageFile(f.name)).length;
        return [r.id, count] as const;
      })
    );

    const map = Object.fromEntries(entries);
    setPhotoCountMap(map);
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
    .eq("plumber_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setThread([]);
    setThreadLoading(false);
    return;
  }

  const messages = (data || []) as EnquiryMessageRow[];

  setThread(messages);
  setThreadMap((prev) => ({
    ...prev,
    [requestId]: messages,
  }));

  setThreadLoading(false);

  requestAnimationFrame(() => {
    threadBottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
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
    .eq("plumber_id", userId)
    .in("request_id", requestIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("loadThreadMapForRows error:", error);
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

    const res = await fetch("/api/ai/analyse-enquiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      ai_urgency_score: data.ai.urgencyScore,
      ai_job_value_band: data.ai.jobValueBand,
      ai_conversion_score: data.ai.conversionScore,
      ai_recommended_action: data.ai.recommendedAction,
      ai_summary: data.ai.summary,
      ai_suggested_reply: data.ai.suggestedReply,
      ai_last_processed_at: new Date().toISOString(),
    };

    setRows((prev) =>
      prev.map((row) =>
        row.id === enquiryId
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );

 setAiJustUpdatedId(enquiryId);

window.setTimeout(() => {
  setAiJustUpdatedId((prev) => (prev === enquiryId ? null : prev));
}, 2200);


  } catch (error) {
    console.error("AI analyse error:", error);
    alert("Something went wrong analysing this enquiry");
  } finally {
    setAiLoadingId(null);
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
  if (!selectedRow) return;

  setNotesSaving(true);
  setNotesMsg(null);

  const { error } = await supabase
    .from("quote_requests")
    .update({ trader_notes: traderNotes })
    .eq("id", selectedRow.id);

  if (error) {
    console.error(error);
    setNotesMsg("Couldn’t save notes");
    setNotesSaving(false);
    return;
  }

  setRows((prev) =>
    prev.map((r) =>
      r.id === selectedRow.id ? { ...r, trader_notes: traderNotes } : r
    )
  );

  setNotesMsg("Notes saved");
  pushToast("Notes saved");
  setNotesSaving(false);
}

async function onUploadTraderFiles(
  e: React.ChangeEvent<HTMLInputElement>
) {
  if (!selectedRow || !e.target.files?.length) return;

  setUploading(true);
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
    pushToast("Files uploaded");
  } catch (err) {
    console.error(err);
    setFileMsg("Upload failed");
    pushToast("Upload failed", "error");
  }

  setUploading(false);
  e.target.value = "";
}

async function deleteTraderFile(path: string) {
  if (!selectedRow) return;

  const ok = window.confirm("Delete this file?");
  if (!ok) return;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    console.error(error);
    pushToast("Couldn’t delete file", "error");
    return;
  }

  await loadFiles(selectedRow.id);
  pushToast("File deleted");
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

  setSiteVisitSending(true);
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
        customerEmail: selectedRow.customer_email,
        customerName: selectedRow.customer_name,
        traderName:
          traderProfile?.business_name ||
          traderProfile?.display_name ||
          "Your trader",
      }),
    });

    const json = await res.json().catch(() => null);

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
          status: "booked",
          job_booked_at: bookedAtIso,
        })
        .eq("id", selectedRow.id);

      if (error) {
        console.error(error);
        pushToast("Couldn’t update booking status", "error");
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === selectedRow.id
              ? {
                  ...r,
                  stage: "visit_booked",
                  status: "booked",
                  job_booked_at: bookedAtIso,
                }
              : r
          )
        );
      }
    }

    pushToast("Site visit booked");
  } catch (err: any) {
    console.error(err);
    setSiteVisitMsg(err?.message || "Couldn’t book visit");
  }

  setSiteVisitSending(false);
}

async function sendReply() {
  if (!selectedRow || !uid) return;
  if (!replyTo.trim() || !replyBody.trim()) return;

  try {
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
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.error || "Couldn’t send");
    }

    setReplyBody("");
    await loadThread(selectedRow.id, uid);


if (String(selectedRow.stage || "").toLowerCase() === "new") {
  await updateStage("contacted");
}
    pushToast("Message sent");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t send message", "error");
  }
}

async function deleteEnquiry() {
  if (!selectedRow) return;

  const ok = window.confirm(
    "Delete this enquiry? This will remove it from your list."
  );
  if (!ok) return;

  const { error } = await supabase
    .from("quote_requests")
    .delete()
    .eq("id", selectedRow.id);

  if (error) {
    console.error(error);
    pushToast("Couldn’t delete enquiry", "error");
    return;
  }

  const remaining = rows.filter((r) => r.id !== selectedRow.id);
  setRows(remaining);

  setThreadMap((prev) => {
  const next = { ...prev };
  delete next[selectedRow.id];
  return next;
});

setVisitMap((prev) => {
  const next = { ...prev };
  delete next[selectedRow.id];
  return next;
});

setEstimateMap((prev) => {
  const next = { ...prev };
  delete next[selectedRow.id];
  return next;
});

setPhotoCountMap((prev) => {
  const next = { ...prev };
  delete next[selectedRow.id];
  return next;
});

  if (remaining.length) {
    selectEnquiry(remaining[0].id);
  } else {
    clearSelected();
  }

  pushToast("Enquiry deleted");
}

async function saveDetailedEstimate(
  status: "draft" | "sent" = "draft",
  opts?: { showToast?: boolean }
) {
  if (!selectedRow || !uid) return false;

  const showToast = opts?.showToast ?? true;
  setEstimateSaving(true);

  try {
    const subtotal = estimateSubtotal;
    const vat = estimateVat;
    const total = estimateTotal;

    let estimateId = detailedEstimate?.id || null;

    if (!estimateId) {
      const { data, error } = await supabase
        .from("estimates")
        .insert({
          request_id: selectedRow.id,
          user_id: uid,
          plumber_id: uid,
          status,
          labour: num(estimateForm.labour),
          materials: materialsSell,
          callout: num(estimateForm.callout),
          parts: num(estimateForm.parts),
          other: num(estimateForm.other),
          subtotal,
          vat,
          total,
          valid_until: estimateForm.validUntil || null,
          customer_message: estimateForm.customerMessage || null,
          included_notes: estimateForm.includedNotes || null,
          excluded_notes: estimateForm.excludedNotes || null,
        })
        .select("*")
        .single();

      if (error) throw error;
      estimateId = data.id;
    } else {
      const { error } = await supabase
        .from("estimates")
        .update({
          status,
          labour: num(estimateForm.labour),
          materials: materialsSell,
          callout: num(estimateForm.callout),
          parts: num(estimateForm.parts),
          other: num(estimateForm.other),
          subtotal,
          vat,
          total,
          valid_until: estimateForm.validUntil || null,
          customer_message: estimateForm.customerMessage || null,
          included_notes: estimateForm.includedNotes || null,
          excluded_notes: estimateForm.excludedNotes || null,
        })
        .eq("id", estimateId);

      if (error) throw error;
    }

    await loadDetailedEstimate(selectedRow.id);
    await loadEstimateMap(uid);

    if (status === "sent") {
      await updateStage("estimate_sent");
    }

    if (showToast) {
      pushToast(status === "draft" ? "Estimate saved" : "Estimate updated");
    }

    return true;
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

  try {
    const saved = await saveDetailedEstimate("draft", { showToast: false });
    if (!saved) {
      throw new Error("Couldn’t save estimate before sending");
    }

    const estimateIdToSend =
      detailedEstimate?.id || estimateMap[selectedRow.id]?.id;

    if (!estimateIdToSend) {
      throw new Error("No estimate found to send");
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

    await updateStage("estimate_sent");
    await loadDetailedEstimate(selectedRow.id);
    await loadEstimateMap(uid);

    pushToast(`Estimate sent to ${selectedRow.customer_email || "customer"}`);
  } catch (err: any) {
    console.error("sendEstimate failed:", err);
    pushToast(err?.message || "Couldn’t send estimate", "error");
  } finally {
    setEstimateSending(false);
  }
}
async function saveEstimateDraft() {
  await saveDetailedEstimate("draft", { showToast: true });
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

  const { error: requestError } = await supabase
    .from("quote_requests")
    .update({
      stage: "won",
      status: "booked",
      job_booked_at: nowIso,
    })
    .eq("id", selectedRow.id);

  if (requestError) {
    console.error(requestError);
    pushToast("Quote record created but enquiry could not be moved", "error");
    return;
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

  /* ================================
     EFFECTS
  ================================= */




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
    ]);

    const { data, error } = await supabase
      .from("quote_requests")
      .select("*")
      .eq("plumber_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      pushToast("Couldn’t load enquiries", "error");
      setLoading(false);
      return;
    }

    const loaded = (data || []) as QuoteRequestRow[];
    setRows(loaded);

    if (!selectedId && loaded.length) {
      setSelectedIdState(loaded[0].id);
    }

    await Promise.all([
      loadPhotoCounts(loaded),
      loadThreadMapForRows(loaded, user.id),
    ]);

    setLoading(false);
  })();
}, [router]);

useEffect(() => {
  if (!selectedRow || !uid) return;

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

  if (rightPaneScrollRef.current) {
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
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        });

        window.setTimeout(() => {
          replyBodyRef.current?.focus({ preventScroll: true });
          setScrollToComposerPending(false);
        }, 220);
      });
    });
  }, 120);

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
  /* ================================
     EARLY EMPTY STATE
  ================================= */

  if (!selectedRow && !loading && filteredRows.length === 0) {
    return (
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

          <div className="ff-card">
            <div className="ff-emptyWrap">
              <EmptyState
                title="No enquiries yet"
                sub="When customers send enquiries, they’ll appear here."
              />
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
  <div className="ff-statLabel">Active jobs</div>
  <div className="ff-statValue">{activeJobsCount}</div>
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

  const photos = photoCountMap[r.id] || 0;
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
    <button
      key={r.id}
      type="button"
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
      onClick={() => selectEnquiry(r.id)}
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
                        </div>

<div className="ff-leftMetaRow">
  <div className="ff-leftMetaText">
    {photos} photo{photos === 1 ? "" : "s"}
  </div>

  <div className="ff-leftMetaText">
    {formatBudget(r.budget)}
  </div>

  <Chip cls={strength.cls}>{strength.text}</Chip>
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
  <button
    type="button"
    className={
      aiActionMeta
        ? aiActionMeta.cls
        : nextAction.cls
    }
    onClick={(e) => {
      e.stopPropagation();

      if (aiActionMeta?.text === "Message customer" || nextAction.text === "Reply now" || nextAction.text === "Next: First reply") {
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

      if (aiActionMeta?.text === "Book visit" || nextAction.text === "Next: Book visit") {
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
  >
    {aiActionMeta
      ? aiActionMeta.text
      : nextAction.text}
  </button>
)}

{followUp ? (
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
  </button>
) : null}
    </>
  )}
</div>
                                            </button>
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

                    const photos = photoCountMap[r.id] || 0;
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
                    <button
  key={r.id}
  type="button"
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
  onClick={() => selectEnquiry(r.id)}
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
                        </div>

                        <div className="ff-leftMetaRow">
                          <div className="ff-leftMetaText">
                            {photos} photo{photos === 1 ? "" : "s"}
                          </div>

                          <div className="ff-leftMetaText">
                            {formatBudget(r.budget)}
                          </div>

                          <Chip cls={strength.cls}>{strength.text}</Chip>
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
                      </button>
                    );
                  })}
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
    setRightTab("messages");
    setScrollToComposerPending(true);
  }}
>
  {String(selectedDisplayedAiAction || "").toLowerCase().includes("reply") ||
  String(selectedDisplayedAiAction || "").toLowerCase().includes("follow")
    ? "⚡ Message customer"
    : "Message customer"}
</button>

 <button
  type="button"
  className="ff-btn ff-btnGhost ff-btnSm"
  onClick={() => handleAnalyseEnquiry(selectedRow.id)}
  disabled={aiLoadingId === selectedRow.id}
>
  {aiLoadingId === selectedRow.id ? "Refreshing..." : "Refresh AI"}
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
    setRightTab("estimate");
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
</div>
                  

                  <div className="ff-tabs">
                    {[
                      ["details", "Details"],
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
                                        {rightTab === "details" ? (
                      <>
                        <div className="ff-mobileNextStep">
                          <div className="ff-nextStepCard">
                            <div className="ff-nextStepTop">
                              <div>
                                <div className="ff-nextStepEyebrow">
                                  Suggested next step
                                </div>
                                <div className="ff-nextStepTitle">
                                  {selectedBestAction.title}
                                </div>
                                <div className="ff-nextStepText">
                                  {selectedBestAction.text}
                                </div>
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

{selectedRow?.ai_summary && (
  <div className="ff-card">
    <div className="ff-aiInner">
      <div className="ff-aiEyebrow">Best next step</div>

{selectedRow.ai_recommended_action && (
  <button
    type="button"
    className={`ff-aiAction ff-aiAction--${selectedDisplayedAiAction}`}
    onClick={() => {
      if (
        selectedDisplayedAiAction === "reply_now" ||
        selectedDisplayedAiAction === "follow_up" ||
        selectedDisplayedAiAction === "ask_for_photos"
      ) {
        setRightTab("messages");
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
        setRightTab("visit");
        return;
      }

      if (selectedDisplayedAiAction === "send_estimate") {
        setRightTab("estimate");
        return;
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
      "📸 Ask for photos — you need a bit more detail"}
    {selectedDisplayedAiAction === "low_priority" &&
      "🕓 Low priority — no need to jump on this first"}
    {selectedDisplayedAiAction === "follow_up" &&
      "💬 Follow up — time to nudge this one"}
  </button>
)}

      <div className="ff-aiSection">
        <div className="ff-aiLabel">What’s going on</div>
        <p>{selectedRow.ai_summary}</p>
      </div>

      {selectedRow.ai_suggested_reply && (
        <div className="ff-aiReplyBox">
          <div className="ff-aiLabel">Quick reply</div>
          <p>{selectedRow.ai_suggested_reply}</p>
        </div>
      )}

      {selectedRow.ai_suggested_reply && (
        <button
          type="button"
          className="ff-btn ff-btnPrimary ff-btnSm ff-btnFull"
          style={{ marginTop: 22 }}
          onClick={() => {
            setRightTab("messages");
            setReplyBody(selectedRow.ai_suggested_reply || "");

            if (!replySubject.trim()) {
              setReplySubject(
                `Re: ${titleCase(selectedRow.job_type || "Enquiry")}`
              );
            }

            setScrollToComposerPending(true);
          }}
        >
          Use this reply
        </button>
      )}
    </div>
  </div>
)}

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
    : selectedRow?.snoozed_until && isSnoozedUntilActive(selectedRow.snoozed_until)
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
    <div className="ff-overviewMiniValue">{selectedEstimateLabel}</div>
    <div className="ff-overviewMiniSub">
      {selectedEstimateStatus === "accepted"
        ? "Accepted by the customer and now moved into your Jobs workflow."
        : selectedEstimateStatus === "sent"
        ? "Sent to customer and ready for follow-up."
        : selectedEstimateStatus === "draft"
        ? "Draft started and ready to finish."
        : "No estimate created yet."}
    </div>
  </div>

<div className="ff-overviewMiniCard">
  <div className="ff-overviewMiniLabel">Visit</div>
  <div className="ff-overviewMiniValue">{selectedVisitLabel}</div>
  <div className="ff-overviewMiniSub">
    {selectedVisit
      ? selectedDerivedStage === "won"
        ? "Visit completed and this enquiry is now in Jobs."
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


  <div className="ff-overviewMiniCard ff-bestActionCard">
    <div className="ff-bestActionEyebrow">Best next action</div>

    <div className="ff-bestActionTitle">{selectedBestAction.title}</div>

    <div className="ff-bestActionText">{selectedBestAction.text}</div>

    {selectedBestAction.button ? (
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="ff-btn ff-btnPrimary ff-btnSm"
          onClick={selectedBestAction.button.action}
        >
          {selectedBestAction.button.label}
        </button>
      </div>
    ) : null}
  </div>

<div className="ff-overviewMiniCard ff-overviewMiniCardWide">
  <div className="ff-overviewMiniLabel">Snooze</div>

  <div className="ff-overviewMiniValue">
    {selectedRow?.snoozed_until && isSnoozedUntilActive(selectedRow.snoozed_until)
      ? "Reminder paused"
      : "Pause this enquiry"}
  </div>

  <div className="ff-overviewMiniSub">
    {selectedRow?.snoozed_until && isSnoozedUntilActive(selectedRow.snoozed_until)
      ? `Snoozed until ${niceDateOnly(selectedRow.snoozed_until)}`
      : "Hide this enquiry from your immediate list until later."}
  </div>

  {selectedRow?.snoozed_until && isSnoozedUntilActive(selectedRow.snoozed_until) ? (
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
      titleCase(selectedRow?.customer_name) || "there";

    const text = `Hi ${customerName}, could you please send:\n- ${selectedMissingInfo.join(
      "\n- "
    )}`;

    syncRightTab("messages");
    setReplyBody(text);

    // 🔥 scroll + focus
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
        <div
          className="ff-detailLabel"
          style={{ marginBottom: 8 }}
        >
          Job brief
        </div>
        <div className="ff-problemTitle">
          {titleCase(selectedRow.job_type || "Enquiry")}
        </div>
      </div>
    </div>

    <div
      className="ff-problemText"
      style={{ marginTop: 14 }}
    >
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
        <strong>
          {formatPostcode(selectedRow.postcode) || "—"}
        </strong>
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
        <div
          className="ff-detailLabel"
          style={{ marginBottom: 6 }}
        >
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
        <strong>
          {selectedRow.address || selectedRow.postcode || "—"}
        </strong>
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
      <div
        className="ff-detailLabel"
        style={{ marginBottom: 6 }}
      >
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

<div style={{ marginTop: 18 }}>
  <button
    type="button"
    className="ff-btn ff-btnDanger ff-btnSm"
    onClick={deleteEnquiry}
  >
    Delete enquiry
  </button>
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
                    className="ff-btn ff-btnGhost ff-btnSm"
                    onClick={saveEstimateDraft}
                  >
                    Save draft
                  </button>

                  <button
                    type="button"
                    className="ff-btn ff-btnPrimary ff-btnSm"
                    onClick={sendEstimate}
                    disabled={estimateSending}
                  >
                    {estimateSending ? "Sending…" : "Send estimate"}
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

                            <input
                              type="file"
                              multiple
                              onChange={onUploadTraderFiles}
                              disabled={uploading}
                              className="ff-input"
                            />

                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: FF.muted,
                              }}
                            >
                              Upload quotes, PDFs, photos, job notes or parts
                              lists.
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
                              className="ff-btn ff-btnPrimary ff-btnSm"
                              type="button"
                              onClick={saveTraderNotes}
                              disabled={notesSaving}
                            >
                              {notesSaving ? "Saving…" : "Save notes"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {rightTab === "messages" ? (
  <div className="ff-chatWrap">
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

    <div className="ff-chatTop">
      <div>
        <div className="ff-detailLabel">Customer messages</div>
        <div className="ff-detailSub">
          View replies and send updates from this enquiry.
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

      <button
        className="ff-btn ff-btnGhost ff-btnSm"
        type="button"
        onClick={() => uid && selectedRow && loadThread(selectedRow.id, uid)}
        disabled={threadLoading}
      >
        {threadLoading ? "Loading…" : "Refresh"}
      </button>
    </div>

    <div className="ff-chatBody">
      {threadLoading ? (
        <div style={{ color: FF.muted, fontSize: 13 }}>
          Loading messages…
        </div>
      ) : thread.length ? (
        thread.map((m) => {
          const outbound = isOutboundDirection(m.direction);
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
                  outbound ? "ff-chatBubbleOut" : "ff-chatBubbleIn"
                }`}
              >
                <div className="ff-chatMeta">
                  <span className="ff-chatName">
                    {outbound ? "You" : "Customer"}
                  </span>
                  <span className="ff-chatTime">
                    {niceDate(m.created_at)}
                  </span>
                </div>

                {m.subject ? (
                  <div className="ff-chatSubject">{m.subject}</div>
                ) : null}

                <div className="ff-chatText">{body || "—"}</div>
              </div>
            </button>
          );
        })
      ) : (
        <EmptyState
          title="No messages yet"
          sub="When you send or receive messages, they will appear here."
        />
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
        {selectedFollowUp &&
        (selectedFollowUp.status === "follow_up_due" ||
          selectedFollowUp.status === "estimate_follow_up_due") ? (
          <>
            <button
              type="button"
              className="ff-quickReplyBtn"
              onClick={() =>
                setReplyBody(
                  `Hi ${titleCase(selectedRow?.customer_name) || ""}, just checking in to see if you'd like to go ahead with this.`
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
                    `Hi ${titleCase(selectedRow?.customer_name) || ""}, just following up on the estimate I sent over. Let me know if you'd like to move forward.`
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
                  `Hi ${titleCase(selectedRow?.customer_name) || ""}, just checking whether you'd still like me to quote for this job.`
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

          {isAutoFilled ? (
            <button
              className="ff-btn ff-btnGhost ff-btnSm ff-btnPulse"
              type="button"
              onClick={sendReply}
              disabled={!replyTo.trim() || !replyBody.trim()}
            >
              ⚡ Send now
            </button>
          ) : null}

          <button
            className="ff-btn ff-btnPrimary ff-btnSm"
            type="button"
            onClick={sendReply}
            disabled={!replyTo.trim() || !replyBody.trim()}
          >
            Send message
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
              className="ff-btn ff-btnGhost"
              onClick={() => setSiteVisitOpen(false)}
            >
              Cancel
            </button>

            <button
              type="button"
              className="ff-btn ff-btnPrimary"
              disabled={siteVisitSending}
              onClick={bookSiteVisit}
            >
              {siteVisitSending ? "Booking…" : "Confirm booking"}
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
    </>
  );
}
