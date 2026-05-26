export type JobCountRequestRow = {
  id: string;
  status: string | null;
  stage?: string | null; // 👈 ADD THIS
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
  const requestStage = cleanStatus(request.stage); // 👈 ADD
  const quoteStatus = cleanStatus(quote?.status);

  return (
    requestStage === "won" || // 👈 THIS FIXES EVERYTHING

    Boolean(request.job_booked_at) ||

    requestStatus === "booked" ||
requestStatus === "in progress" ||
requestStatus === "in_progress" ||
requestStatus === "complete" ||
requestStatus === "completed" ||
    requestStatus === "invoiced" ||
    requestStatus === "paid" ||

    quoteStatus === "booked" ||
quoteStatus === "in progress" ||
quoteStatus === "in_progress" ||
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