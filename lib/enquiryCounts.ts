// lib/enquiryCounts.ts

import { getFollowUpState, type FollowUpResult } from "@/lib/enquiries/followUp";

export type QuoteRequestCountRow = {
  id: string;
  stage: string | null;
  read_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  job_booked_at?: string | null;
};

export type QuickEstimateCountLite = {
  id?: string;
  status: string | null;
  accepted_at: string | null;
  created_at: string | null;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
};

export type SiteVisitCountLite = {
  starts_at: string;
} | null;

export type EnquiryMessageCountRow = {
  id?: string;
  direction: string | null;
  created_at: string;
};

export type EnquiryCountsInput = {
  rows: QuoteRequestCountRow[];
  estimateMap: Record<string, QuickEstimateCountLite | null>;
  visitMap: Record<string, SiteVisitCountLite | null>;
  threadMap: Record<string, EnquiryMessageCountRow[]>;
};

export type EnquiryCounts = {
enquiriesOpen: number;
enquiriesUnread: number;
needsAction: number;
followUp: number;
wonJobs: number;
allGood: number;
};

function isOutboundDirection(direction?: string | null) {
  const v = String(direction || "").toLowerCase();
  return v === "out" || v === "outbound" || v === "sent";
}

function deriveEnquiryStage(params: {
  row: QuoteRequestCountRow;
  estimate?: QuickEstimateCountLite | null;
  visit?: SiteVisitCountLite | null;
  messages?: EnquiryMessageCountRow[];
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

export function getEnquiryCounts({
  rows,
  estimateMap,
  visitMap,
  threadMap,
}: EnquiryCountsInput): EnquiryCounts {
  let enquiriesOpen = 0;
  let enquiriesUnread = 0;
  let needsAction = 0;
  let followUp = 0;
  let wonJobs = 0;
  let allGood = 0;

  for (const row of rows) {
    const estimate = estimateMap[row.id] || null;
    const visit = visitMap[row.id] || null;
    const messages = threadMap[row.id] || [];

    const derivedStage = deriveEnquiryStage({
      row,
      estimate,
      visit,
      messages,
    });

    const isOpen = derivedStage !== "won" && derivedStage !== "lost";

    if (isOpen) enquiriesOpen += 1;
    if (derivedStage === "won") wonJobs += 1;

    if (!row.read_at && isOpen) {
      enquiriesUnread += 1;
    }

    const followUpState: FollowUpResult = getFollowUpState({
      enquiry: {
        id: row.id,
        stage: row.stage ?? null,
        created_at: row.created_at,
        snoozed_until: row.snoozed_until ?? null,
        job_booked_at: row.job_booked_at ?? null,
      },
      messages: messages.map((m, index) => ({
        id: m.id || `${row.id}-${index}`,
        direction: m.direction === "in" ? "in" : "out",
        created_at: m.created_at,
      })),
      estimate: estimate
        ? {
            id: estimate.id || row.id,
            status: estimate.status,
            created_at: estimate.created_at,
            sent_at: estimate.created_at,
            accepted_at: estimate.accepted_at,
            first_viewed_at: estimate.first_viewed_at ?? null,
            last_viewed_at: estimate.last_viewed_at ?? null,
          }
        : null,
    });

if (isOpen) {
  if (followUpState.bucket === "needsAction") {
    needsAction += 1;
  } else if (followUpState.bucket === "followUp") {
    followUp += 1;
  } else {
    allGood += 1;
  }
}
  }


return {
enquiriesOpen,
enquiriesUnread,
needsAction,
followUp,
wonJobs,
allGood,
};
}