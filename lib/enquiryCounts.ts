// lib/enquiryCounts.ts

export type QuoteRequestCountRow = {
  id: string;
  stage: string | null;
  read_at: string | null;
  snoozed_until: string | null;
  created_at: string;
};

export type QuickEstimateCountLite = {
  status: string | null;
  accepted_at: string | null;
  created_at: string | null;
};

export type SiteVisitCountLite = {
  starts_at: string;
} | null;

export type EnquiryMessageCountRow = {
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
};

function isOutboundDirection(direction?: string | null) {
  const v = String(direction || "").toLowerCase();
  return v === "out" || v === "outbound" || v === "sent";
}

function hasCustomerReplyAfterOutbound(messages: EnquiryMessageCountRow[]) {
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

function isSnoozedUntilActive(value?: string | null) {
  if (!value) return false;
  return new Date(value).getTime() > Date.now();
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

function getFollowUpState(params: {
  stage?: string | null;
  estimateStatus?: string | null;
  estimateCreatedAt?: string | null;
  hasVisit: boolean;
  hasReply: boolean;
  snoozedUntil?: string | null;
}) {
  const {
    stage,
    estimateStatus,
    estimateCreatedAt,
    hasVisit,
    hasReply,
    snoozedUntil,
  } = params;

  const stageValue = String(stage || "").toLowerCase();
  const estimateValue = String(estimateStatus || "").toLowerCase();

  if (isSnoozedUntilActive(snoozedUntil)) {
    return {
      due: false,
      text: "Snoozed",
      priority: 0,
    };
  }

  if (stageValue === "won" || stageValue === "lost") {
    return {
      due: false,
      text: "Closed",
      priority: 0,
    };
  }

  if (estimateValue === "accepted") {
    return {
      due: false,
      text: "Accepted",
      priority: 0,
    };
  }

  if (estimateValue === "sent" && estimateCreatedAt) {
    const sentAt = new Date(estimateCreatedAt).getTime();
    const now = Date.now();
    const diffDays = Math.floor((now - sentAt) / (1000 * 60 * 60 * 24));

    if (diffDays >= 7) {
      return {
        due: true,
        text: "Follow up now",
        priority: 3,
      };
    }

    if (diffDays >= 3) {
      return {
        due: true,
        text: "Estimate sent 3+ days ago",
        priority: 2,
      };
    }

    return {
      due: false,
      text: "Recently sent",
      priority: 1,
    };
  }

  if (stageValue === "contacted" && !hasReply) {
    return {
      due: true,
      text: "No reply yet",
      priority: 2,
    };
  }

  if (hasVisit && !estimateValue) {
    return {
      due: true,
      text: "Visit done — quote next",
      priority: 2,
    };
  }

  return {
    due: false,
    text: "Not due",
    priority: 0,
  };
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

    const estimateStatus = String(estimate?.status || "").toLowerCase();
    const hasVisit = !!visit;

    if (
      !isSnoozedUntilActive(row.snoozed_until) &&
      (
        !row.read_at ||
        derivedStage === "new" ||
        derivedStage === "contacted" ||
        estimateStatus === "sent" ||
        (!estimate && !hasVisit && derivedStage !== "won" && derivedStage !== "lost")
      )
    ) {
      needsAction += 1;
    }

    const followUpState = getFollowUpState({
      stage: derivedStage,
      estimateStatus: estimate?.status,
      estimateCreatedAt: estimate?.created_at,
      hasVisit,
      hasReply: hasCustomerReplyAfterOutbound(messages),
      snoozedUntil: row.snoozed_until,
    });

    if (followUpState.due) {
      followUp += 1;
    }
  }

  return {
    enquiriesOpen,
    enquiriesUnread,
    needsAction,
    followUp,
    wonJobs,
  };
}