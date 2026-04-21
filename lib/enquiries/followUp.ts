type MessageLite = {
  id: string;
  direction: "in" | "out";
  created_at: string;
};

type EstimateLite = {
  id: string;
  status: string | null;
  created_at: string | null;
  sent_at?: string | null;
  accepted_at?: string | null;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
};

type EnquiryLite = {
  id: string;
  stage: string | null;
  created_at: string;
  snoozed_until?: string | null;
  job_booked_at?: string | null;
};

export type FollowUpStatus =
  | "needs_reply"
  | "customer_replied"
  | "awaiting_customer"
  | "follow_up_due"
  | "estimate_follow_up_due"
  | "booked"
  | "lost"
  | "snoozed"
  | "all_good";

export type FollowUpResult = {
  status: FollowUpStatus;
  label: string;
  reason: string;
  priority: number;
  bucket: "needsAction" | "followUp" | "waiting" | "allGood" | "hidden";
  daysSinceLastTouch: number | null;
};

function toTime(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function hoursBetween(older: number, newer: number) {
  return (newer - older) / (1000 * 60 * 60);
}

function daysBetween(older: number, newer: number) {
  return (newer - older) / (1000 * 60 * 60 * 24);
}

function getLatestMessage(messages: MessageLite[], direction: "in" | "out") {
  return (
    messages
      .filter((m) => m.direction === direction)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0] || null
  );
}

function getLatestTouchAt(
  enquiry: EnquiryLite,
  messages: MessageLite[],
  estimate: EstimateLite | null
): number {
  const times = [
    toTime(enquiry.created_at),
    ...messages.map((m) => toTime(m.created_at)),
    toTime(estimate?.sent_at || estimate?.created_at || null),
    toTime(estimate?.accepted_at || null),
  ].filter((v): v is number => v !== null);

  return times.length ? Math.max(...times) : Date.now();
}

export function getFollowUpState(args: {
  enquiry: EnquiryLite;
  messages: MessageLite[];
  estimate: EstimateLite | null;
  now?: number;
}): FollowUpResult {
  const { enquiry, estimate } = args;
  const messages = [...args.messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const now = args.now ?? Date.now();

  const stage = (enquiry.stage || "").toLowerCase().trim();
  const snoozedUntil = toTime(enquiry.snoozed_until || null);
  const bookedAt = toTime(enquiry.job_booked_at || null);

  const latestInbound = getLatestMessage(messages, "in");
  const latestOutbound = getLatestMessage(messages, "out");

  const latestInboundAt = toTime(latestInbound?.created_at);
  const latestOutboundAt = toTime(latestOutbound?.created_at);

  const estimateSentAt = toTime(estimate?.sent_at || estimate?.created_at || null);
  const estimateAcceptedAt = toTime(estimate?.accepted_at || null);
  const estimateStatus = (estimate?.status || "").toLowerCase().trim();

  const lastTouchAt = getLatestTouchAt(enquiry, messages, estimate);
  const daysSinceLastTouch = Math.floor(daysBetween(lastTouchAt, now));

  const isWon =
    stage === "won" ||
    estimateStatus === "accepted" ||
    estimateAcceptedAt !== null ||
    bookedAt !== null;

  if (stage === "lost" || stage === "completed") {
    return {
      status: "lost",
      label: stage === "completed" ? "Completed" : "Lost",
      reason: "This enquiry is no longer active.",
      priority: 0,
      bucket: "hidden",
      daysSinceLastTouch,
    };
  }

  if (isWon) {
    return {
      status: "booked",
      label: "Booked",
      reason: "This enquiry has already been won or booked in.",
      priority: 0,
      bucket: "hidden",
      daysSinceLastTouch,
    };
  }

  if (snoozedUntil && snoozedUntil > now) {
    return {
      status: "snoozed",
      label: "Snoozed",
      reason: "This enquiry is snoozed until later.",
      priority: 0,
      bucket: "hidden",
      daysSinceLastTouch,
    };
  }

  if (!latestOutboundAt) {
    const enquiryCreatedAt = toTime(enquiry.created_at) ?? now;
    const ageHours = hoursBetween(enquiryCreatedAt, now);

    return {
      status: "needs_reply",
      label: ageHours >= 24 ? "Reply now" : "Customer waiting",
      reason:
        ageHours >= 24
          ? "Customer has not had a first reply yet."
          : "New enquiry waiting for first response.",
      priority: ageHours >= 24 ? 100 : 90,
      bucket: "needsAction",
      daysSinceLastTouch,
    };
  }

  if (latestInboundAt && latestOutboundAt && latestInboundAt > latestOutboundAt) {
    return {
      status: "customer_replied",
      label: "Customer replied",
      reason: "Customer replied after your last message.",
      priority: 95,
      bucket: "needsAction",
      daysSinceLastTouch,
    };
  }

  if (
    estimateStatus === "sent" &&
    estimateSentAt &&
    !estimateAcceptedAt &&
    (!latestInboundAt || latestInboundAt < estimateSentAt)
  ) {
    const estimateHours = hoursBetween(estimateSentAt, now);

    if (estimateHours >= 24 * 7) {
      return {
        status: "estimate_follow_up_due",
        label: "Quote going cold",
        reason: "Estimate was sent 7+ days ago with no reply.",
        priority: 92,
        bucket: "followUp",
        daysSinceLastTouch,
      };
    }

    if (estimateHours >= 24 * 4) {
      return {
        status: "estimate_follow_up_due",
        label: "Chase estimate",
        reason: "Estimate was sent 4+ days ago with no reply.",
        priority: 88,
        bucket: "followUp",
        daysSinceLastTouch,
      };
    }

    if (estimateHours >= 24 * 2) {
      return {
        status: "estimate_follow_up_due",
        label: "Check in on quote",
        reason: "Estimate was sent 2+ days ago with no reply.",
        priority: 82,
        bucket: "followUp",
        daysSinceLastTouch,
      };
    }
  }

  if (latestOutboundAt && (!latestInboundAt || latestOutboundAt > latestInboundAt)) {
    const waitHours = hoursBetween(latestOutboundAt, now);

    if (waitHours >= 72) {
      return {
        status: "follow_up_due",
        label: "Follow up now",
        reason: "Customer has not replied for 3+ days.",
        priority: 80,
        bucket: "followUp",
        daysSinceLastTouch,
      };
    }

    if (waitHours >= 48) {
      return {
        status: "follow_up_due",
        label: "Follow up soon",
        reason: "Customer has not replied for 2+ days.",
        priority: 72,
        bucket: "followUp",
        daysSinceLastTouch,
      };
    }

    if (waitHours >= 24) {
      return {
        status: "awaiting_customer",
        label: "Waiting on customer",
        reason: "Message sent 1+ day ago.",
        priority: 40,
        bucket: "waiting",
        daysSinceLastTouch,
      };
    }
  }

  return {
    status: "all_good",
    label: "All good",
    reason: "Nothing needs chasing right now.",
    priority: 10,
    bucket: "allGood",
    daysSinceLastTouch,
  };
}