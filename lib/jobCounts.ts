export type JobCountRequestRow = {
  id: string;
  status: string | null;
  job_booked_at: string | null;
};

export type JobCountQuoteRow = {
  request_id: string | null;
  status: string | null;
};

function cleanStatus(value?: string | null) {
  return String(value || "").toLowerCase().trim();
}

export function isRealJob(
  request: JobCountRequestRow,
  quote?: JobCountQuoteRow | null
) {
  const requestStatus = cleanStatus(request.status);
  const quoteStatus = cleanStatus(quote?.status);

  return (
    Boolean(request.job_booked_at) ||
    requestStatus === "booked" ||
    requestStatus === "in progress" ||
    requestStatus === "complete" ||
    requestStatus === "completed" ||
    requestStatus === "invoiced" ||
    requestStatus === "paid" ||
    quoteStatus === "booked" ||
    quoteStatus === "in progress" ||
    quoteStatus === "complete" ||
    quoteStatus === "completed" ||
    quoteStatus === "invoiced" ||
    quoteStatus === "paid"
  );
}

export function getJobCounts(args: {
  requests: JobCountRequestRow[];
  quoteMap?: Record<string, JobCountQuoteRow | null>;
}) {
  const { requests, quoteMap = {} } = args;

  const jobs = requests.filter((request) =>
    isRealJob(request, quoteMap[request.id] || null)
  ).length;

  return { jobs };
}