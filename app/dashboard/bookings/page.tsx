"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import "../enquiries/enquiries.css";
import { isRealJob } from "@/lib/jobCounts";
/* ================================
   TYPES
================================ */

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
  resolved_at?: string | null;
};

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
  created_at: string;
  trader_notes: string | null;
  calendar_html_link: string | null;
  site_visit_start: string | null;
  job_booked_at: string | null;
  job_calendar_html_link: string | null;
  photo_count: number | null;
};

type QuoteRow = {
  id: string;
  plumber_id: string;
  request_id: string | null;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  postcode: string | null;
  address: string | null;

  job_type: string | null;
  urgency: string | null;

  vat_rate: number | null;
  subtotal: number | null;
  note: string | null;
  job_details: string | null;
  trader_ref: string | null;
  status: string | null;
  sent_at?: string | null;
  created_at: string;
  last_chased_at?: string | null;
chase_count?: number | null;
};

type SiteVisitRow = {
  id: string;
  request_id: string;
  plumber_id: string;
  starts_at: string;
  duration_mins: number;
  created_at: string;
};

type FileItem = {
  name: string;
  path: string;
  url: string | null;
  size?: number | null;
  created_at?: string | null;
  label?: string | null;
  area?: "customer" | "trader" | "documents";
};

type JobTab =
  | "overview"
  | "schedule"
  | "files"
  | "messages"
  | "notes"
  | "documents";


type JobStatus =
  | "approved"
  | "booked"
  | "in_progress"
  | "complete"
  | "invoiced"
  | "paid";

/* ================================
   DESIGN CONSTS
================================ */


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
  blueLine:
    "linear-gradient(90deg, rgba(36,91,255,1) 0%, rgba(31,111,255,0.35) 55%, rgba(11,42,85,0.15) 100%)",
};

const BUCKET = "quote-files";
const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;
const docsFolder = (requestId: string) => `job/${requestId}/documents`;

const TRADER_FILE_LABELS = [
  { value: "site_photo", text: "Site photo" },
  { value: "invoice", text: "Invoice" },
  { value: "manual", text: "Manual" },
  { value: "warranty", text: "Warranty" },
  { value: "certificate", text: "Certificate" },
  { value: "other", text: "Other" },
];

const DOCUMENT_LABELS = [
  { value: "certificate", text: "Certificate" },
  { value: "warranty", text: "Warranty" },
  { value: "manual", text: "Manual" },
  { value: "handover", text: "Handover" },
  { value: "invoice", text: "Invoice" },
  { value: "other", text: "Other" },
];

/* ================================
   HELPERS
================================ */
function getJobTimeHint(
  request?: QuoteRequestRow | null,
  visit?: SiteVisitRow | null,
  quote?: QuoteRow | null
) {
  const status = normalizeJobStatus(quote, request, visit);

  const now = new Date();

  const jobDate =
    request?.job_booked_at || visit?.starts_at || null;

  if (status === "approved") {
    return {
      text: "Needs booking",
      cls: "ff-leftHintAmber",
    };
  }

  if (status === "booked" && jobDate) {
    const d = new Date(jobDate);
    const diff = d.getTime() - now.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 0) {
      return {
        text: "Job overdue",
        cls: "ff-leftHintRed",
      };
    }

    if (hours < 6) {
      return {
        text: "Job soon",
        cls: "ff-leftHintRed",
      };
    }

    if (hours < 24) {
      return {
        text: "Job today",
        cls: "ff-leftHintAmber",
      };
    }

    if (hours < 48) {
      return {
        text: "Job tomorrow",
        cls: "ff-leftHintBlue",
      };
    }

    return {
      text: "Upcoming job",
      cls: "ff-leftHintBlue",
    };
  }

  if (status === "complete") {
    return {
      text: "Send invoice",
      cls: "ff-leftHintAmber",
    };
  }

  if (status === "invoiced") {
    return {
      text: "Awaiting payment",
      cls: "ff-leftHintBlue",
    };
  }

  if (status === "paid") {
    return {
      text: "Complete",
      cls: "ff-leftHintGreen",
    };
  }

  return null;
}
function cleanId(v?: string | null) {
  const s = String(v || "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

function titleCase(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w[0] ? w[0].toUpperCase() : "") + w.slice(1))
    .join(" ");
}

function nice(s?: string | null) {
  return (s || "").trim() || "—";
}

function niceDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      year: "2-digit",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function niceDateOnly(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString([], {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function timeAgo(iso?: string | null) {
  if (!iso) return "";

  const now = Date.now();
  const then = new Date(iso).getTime();

  const diff = now - then;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function telHref(phone?: string | null) {
  if (!phone) return "#";
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}

function money(n: number | null | undefined) {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(x);
}

function numOrNull(v: string) {
  const t = (v || "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatPostcode(pc?: string | null) {
  if (!pc) return "";
  const clean = pc.replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  return clean.slice(0, -3) + " " + clean.slice(-3);
}
function urgencyChip(u?: string | null) {
const v = String(u || "").toLowerCase();

if (v.includes("asap") || v.includes("urgent") || v.includes("today")) {
return { text: "ASAP", cls: "ff-chip ff-chip--asap" };
}

if (v.includes("this week") || v.includes("this-week") || v.includes("soon")) {
return { text: "This week", cls: "ff-chip ff-chip--soon" };
}

return { text: "Flexible", cls: "ff-chip ff-chip--flexible" };
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

  if (u.includes("48") || u.includes("this week") || u.includes("soon")) {
    return "ff-leftGlowWeek";
  }

  if (u.includes("next week") || u.includes("next")) {
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

function safeFileName(name: string) {
  return (name || "file")
    .replaceAll(" ", "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .slice(0, 120);
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

function isOutboundDirection(direction?: string | null) {
  const v = String(direction || "").toLowerCase();
  return v === "out" || v === "outbound" || v === "sent";
}

function hasIncomingReply(messages: EnquiryMessageRow[]) {
  return messages.some((m) => !isOutboundDirection(m.direction));
}

function getJobAlert(messages: EnquiryMessageRow[]) {
if (hasIncomingReply(messages)) {
return {
text: "Customer replied",
cls: "ff-chip ff-chip--replied",
};
}

return null;
}

function getJobNextAction(
  quote?: QuoteRow | null,
  request?: QuoteRequestRow | null,
  visit?: SiteVisitRow | null
) {
  const status = normalizeJobStatus(quote, request, visit);

  if (status === "approved") {
    return {
      title: "Book this job in",
      description: "The customer has said yes — lock in a date before they go elsewhere.",
      button: "Create booking",
      action: "booking",
    };
  }

  if (status === "booked") {
    return {
      title: "Keep the customer warm",
      description: "Send a quick update before the job so they feel confident and ready.",
      button: "Send update",
      action: "message",
    };
  }

  if (status === "in_progress") {
    return {
      title: "Finish strong",
      description: "Complete the work and keep notes, photos and updates in one place.",
      button: "Mark complete",
      action: "complete",
    };
  }

  if (status === "complete") {
    return {
      title: "Send the invoice",
      description: "Don’t delay — send the invoice while the job is fresh.",
      button: "Create invoice",
      action: "invoice",
    };
  }

  if (status === "invoiced") {
    return {
      title: "Get paid",
      description: "Follow up if needed — this is where cash flow matters.",
      button: "Mark as paid",
      action: "paid",
    };
  }

  if (status === "paid") {
    return {
      title: "Lock in future work",
      description: "Ask if they’re happy and turn this into repeat business or referrals.",
      button: "Ask if happy",
      action: "happy",
    };
  }

  return {
    title: "Move job forward",
    description: "Take the next step to keep this job progressing.",
    button: null,
    action: null,
  };
}

function labelText(value?: string | null) {
  if (!value) return "Other";

  const all = [...TRADER_FILE_LABELS, ...DOCUMENT_LABELS];
  return all.find((x) => x.value === value)?.text || value;
}

function insertReplyText(current: string, text: string) {
  if (!current.trim()) return text;
  return `${current.trim()}\n\n${text}`;
}

function normalizeJobStatus(
  quote?: QuoteRow | null,
  request?: QuoteRequestRow | null,
  visit?: SiteVisitRow | null
) {
  const qStatus = String(quote?.status || "").toLowerCase().trim();
  const rStatus = String(request?.status || "").toLowerCase().trim();

  if (qStatus.includes("paid")) return "paid";
  if (qStatus.includes("invoice")) return "invoiced";
  if (qStatus.includes("complete")) return "complete";
  if (qStatus.includes("progress")) return "in_progress";

  if (rStatus.includes("paid")) return "paid";
  if (rStatus.includes("invoice")) return "invoiced";
  if (rStatus.includes("complete")) return "complete";
  if (rStatus.includes("progress")) return "in_progress";

  if (
    qStatus.includes("approved") ||
    qStatus.includes("accepted") ||
    rStatus.includes("approved") ||
    rStatus.includes("accepted")
  ) {
    return visit || request?.job_booked_at ? "booked" : "approved";
  }

  if (
    qStatus.includes("book") ||
    rStatus.includes("book") ||
    request?.job_booked_at ||
    visit
  ) {
    return "booked";
  }

  return "approved";
}

function jobStatusChip(
  quote?: QuoteRow | null,
  request?: QuoteRequestRow | null,
  visit?: SiteVisitRow | null
) {
  const s = normalizeJobStatus(quote, request, visit);

  if (s === "paid") return { text: "Paid", cls: "ff-jobChip ff-jobChipGreen" };
  if (s === "invoiced") return { text: "Invoiced", cls: "ff-jobChip ff-jobChipBlue" };
  if (s === "complete") return { text: "Complete", cls: "ff-jobChip ff-jobChipGreen" };
  if (s === "in_progress") return { text: "In_progress", cls: "ff-jobChip ff-jobChipBlue" };
  if (s === "booked") return { text: "Booked", cls: "ff-jobChip ff-jobChipGreen" };

  return { text: "Approved", cls: "ff-jobChip ff-jobChipAmber" };
}




function getHealthItems(args: {
  quote: QuoteRow | null;
  request: QuoteRequestRow | null;
  visit: SiteVisitRow | null;
  traderFiles: FileItem[];
  jobDocs: FileItem[];
}) {
  const { quote, request, visit, traderFiles, jobDocs } = args;

  return [
    {
      label: "Customer contact",
      ok: Boolean(
        quote?.customer_phone ||
          request?.customer_phone ||
          quote?.customer_email ||
          request?.customer_email
      ),
    },
    {
      label: "Booking",
      ok: Boolean(visit || request?.job_booked_at),
    },
    {
      label: "Work description",
      ok: Boolean(String(quote?.job_details || request?.details || "").trim()),
    },
    {
      label: "Private notes",
      ok: Boolean(String(request?.trader_notes || "").trim()),
    },
    {
      label: "Site files",
      ok: traderFiles.length > 0,
    },
    {
      label: "Final documents",
      ok: jobDocs.length > 0,
    },
  ];
}

function getMissingItems(args: {
  quote: QuoteRow | null;
  request: QuoteRequestRow | null;
  visit: SiteVisitRow | null;
  traderFiles: FileItem[];
  jobDocs: FileItem[];
}) {
  const { quote, request, visit, traderFiles, jobDocs } = args;
  const out: string[] = [];
  const status = normalizeJobStatus(quote, request, visit);

  if (!quote?.customer_phone && !request?.customer_phone) {
    out.push("Customer phone number missing");
  }

  if (!quote?.address && !request?.address) {
    out.push("Customer address missing");
  }

  if (!visit && !request?.job_booked_at && status === "approved") {
    out.push("No confirmed booking date");
  }

  if (!String(quote?.job_details || request?.details || "").trim()) {
    out.push("Work description missing");
  }

  if (!String(request?.trader_notes || "").trim()) {
    out.push("Private notes missing");
  }

  if (
    (status === "in_progress" || status === "complete" || status === "invoiced") &&
    traderFiles.length === 0
  ) {
    out.push("No site files uploaded");
  }

  if (
    (status === "complete" || status === "invoiced" || status === "paid") &&
    jobDocs.length === 0
  ) {
    out.push("No final documents uploaded");
  }

  return out;
}



async function listFolderFiles(folder: string): Promise<FileItem[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) return [];

  const paths = data
    .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
    .map((f) => `${folder}/${f.name}`);

  if (!paths.length) return [];

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 60 * 60);

  return data
    .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
    .map((f, i) => ({
      name: f.name,
      path: `${folder}/${f.name}`,
      url: signed?.[i]?.signedUrl || null,
      size: (f as any)?.metadata?.size || null,
      created_at: (f as any)?.created_at || null,
    }));
}

function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ff-empty">
      <div className="ff-emptyTitle">{title}</div>
      {sub ? <div className="ff-emptySub">{sub}</div> : null}
    </div>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const sp = useSearchParams();

 const requestIdParam = cleanId(sp.get("requestId"));

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{
    text: string;
    type?: "success" | "error";
  } | null>(null);

const [jobs, setJobs] = useState<QuoteRequestRow[]>([]);
const [quoteMap, setQuoteMap] = useState<Record<string, QuoteRow | null>>({});

  const [requestMap, setRequestMap] = useState<Record<string, QuoteRequestRow | null>>(
    {}
  );
  const [visitMap, setVisitMap] = useState<Record<string, SiteVisitRow | null>>({});
  const [threadMap, setThreadMap] = useState<Record<string, EnquiryMessageRow[]>>({});
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  return () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  };
}, []);
const [selectedRequestIdState, setSelectedRequestIdState] = useState<string | null>(
  requestIdParam || null
);
const selectedRequestId = requestIdParam || selectedRequestIdState;

  const [statusFilter, setStatusFilter] = useState<
    "" | "approved" | "booked" | "in_progress" | "complete" | "invoiced" | "paid"
  >("");
  const [postcodeFilter, setPostcodeFilter] = useState("");

  const [rightTab, setRightTab] = useState<JobTab>("overview");
const [issueOnly, setIssueOnly] = useState(false);
  const [thread, setThread] = useState<EnquiryMessageRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState<EnquiryMessageRow | null>(null);
const [confirmModal, setConfirmModal] = useState<{
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
} | null>(null);

const [callModalOpen, setCallModalOpen] = useState(false);
const [callOutcome, setCallOutcome] = useState("Confirmed job");
const [callNote, setCallNote] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("Re:");
  const [replyBody, setReplyBody] = useState("");

  const [workDescription, setWorkDescription] = useState("");
  const [traderRef, setTraderRef] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [vatRate, setVatRate] = useState<"0" | "20">("20");
  const [vatRegistered, setVatRegistered] = useState(true);

  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bookingDateTime, setBookingDateTime] = useState("");

  const [custFiles, setCustFiles] = useState<FileItem[]>([]);
  const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);
  const [jobDocs, setJobDocs] = useState<FileItem[]>([]);
const [reviewSending, setReviewSending] = useState(false);
const [reviewSent, setReviewSent] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [docsMsg, setDocsMsg] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);

  const [traderFileLabel, setTraderFileLabel] = useState("site_photo");
  const [docLabel, setDocLabel] = useState("certificate");

  const detailBottomRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

const selectedRequest = useMemo(() => {
  if (!selectedRequestId) return null;
  return jobs.find((r) => r.id === selectedRequestId) ?? null;
}, [jobs, selectedRequestId]);

const selectedQuote = useMemo(() => {
  if (!selectedRequest) return null;
  return quoteMap[selectedRequest.id] || null;
}, [selectedRequest, quoteMap]);


  const selectedVisit = useMemo(() => {
    if (!selectedRequest) return null;
    return visitMap[selectedRequest.id] || null;
  }, [selectedRequest, visitMap]);

  const selectedStatusChip = selectedRequest
    ? jobStatusChip(selectedQuote, selectedRequest, selectedVisit)
    : null;

 





function pushToast(text: string, type: "success" | "error" = "success") {
  setToast({ text, type });

  if (toastTimerRef.current) {
    clearTimeout(toastTimerRef.current);
  }

  toastTimerRef.current = setTimeout(() => {
    setToast(null);
  }, 3000);
}

async function loadJobsForTrader(plumberId: string) {
  const { data, error } = await supabase
    .from("quote_requests")
.select(
  "id,job_number,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,status,stage,created_at,trader_notes,calendar_html_link,site_visit_start,job_booked_at,job_calendar_html_link"
)
    .eq("plumber_id", plumberId)
    .order("created_at", { ascending: false });



  if (error) {
    pushToast(`Load failed: ${error.message}`, "error");
    setJobs([]);
    return;
  }

  const list = (data || []) as QuoteRequestRow[];
  setJobs(list);

  const requestIds = list.map((r) => r.id);

  const requestMapData: Record<string, QuoteRequestRow | null> = {};
  list.forEach((r) => {
    requestMapData[r.id] = r;
  });
  setRequestMap(requestMapData);

  await Promise.all([
    loadQuoteMap(plumberId, requestIds),
    loadSiteVisitMap(plumberId, requestIds),
    loadThreadMapForRows(requestIds, plumberId),
  ]);
}

async function loadQuoteMap(plumberId: string, requestIds: string[]) {
  if (!requestIds.length) {
    setQuoteMap({});
    return;
  }

  const emptyMap: Record<string, QuoteRow | null> = {};
  requestIds.forEach((id) => {
    emptyMap[id] = null;
  });

  const { data, error } = await supabase
    .from("quotes")
   .select(
  "id,plumber_id,request_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,vat_rate,subtotal,note,job_details,trader_ref,status,sent_at,created_at,last_chased_at,chase_count"
)
    .eq("plumber_id", plumberId)
    .in("request_id", requestIds)
    .order("created_at", { ascending: false });



  if (error) {
    console.error("loadQuoteMap error:", error);
    setQuoteMap(emptyMap);
    return;
  }

  const map = { ...emptyMap };

for (const row of (data || []) as QuoteRow[]) {
  if (!row.request_id) continue;
  if (!map[row.request_id]) {
    map[row.request_id] = row;
  }
}

  setQuoteMap(map);
}



  async function loadSiteVisitMap(plumberId: string, requestIds: string[]) {
    if (!requestIds.length) {
      setVisitMap({});
      return;
    }

    const { data, error } = await supabase
      .from("site_visits")
      .select("id,request_id,plumber_id,starts_at,duration_mins,created_at")
      .eq("plumber_id", plumberId)
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });

    if (error) return;

    const map: Record<string, SiteVisitRow | null> = {};
    requestIds.forEach((id) => {
      map[id] = null;
    });

 (data || []).forEach((v) => {
  const visit = v as SiteVisitRow;
  if (!map[visit.request_id]) {
    map[visit.request_id] = visit;
  }
});

    setVisitMap(map);
  }

  async function loadThreadMapForRows(requestIds: string[], userId: string) {
    if (!requestIds.length) {
      setThreadMap({});
      return;
    }

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

    setThread((data || []) as EnquiryMessageRow[]);
    setThreadLoading(false);
  }

  async function loadFiles(requestId: string) {
    setFilesLoading(true);
    setFileMsg(null);

    try {
      const [customerItems, traderItems] = await Promise.all([
        listFolderFiles(customerFolder(requestId)),
        listFolderFiles(traderFolder(requestId)),
      ]);

      setCustFiles(customerItems.map((f) => ({ ...f, area: "customer" })));
      setTraderFiles(
        traderItems.map((f) => ({
          ...f,
          area: "trader",
          label: traderFileLabel,
        }))
      );
    } catch (e) {
      console.error(e);
      setFileMsg("Couldn’t load files");
    }

    setFilesLoading(false);
  }

  async function loadDocuments(requestId: string) {
    setDocsLoading(true);
    setDocsMsg(null);

    try {
      const docs = await listFolderFiles(docsFolder(requestId));
      setJobDocs(docs.map((f) => ({ ...f, area: "documents", label: docLabel })));
    } catch (e) {
      console.error(e);
      setDocsMsg("Couldn’t load documents");
    }

    setDocsLoading(false);
  }

function openJob(requestId: string) {
  setSelectedRequestIdState(requestId);
  setRightTab("overview");
  router.replace(`/dashboard/bookings?requestId=${encodeURIComponent(requestId)}`);
}

function backToListMobile() {
  setSelectedRequestIdState(null);
  setRightTab("overview");
  router.replace(`/dashboard/bookings`);
}

    async function saveJobCore() {
    if (!uid || !selectedQuote) return;

    setSaving(true);

    const patch = {
      trader_ref: (traderRef || "").trim() || null,
      job_details: (workDescription || "").trim() || null,
      vat_rate: vatRegistered ? Number(vatRate) : 0,
      subtotal: numOrNull(subtotal),
    };

    const { error } = await supabase
      .from("quotes")
      .update(patch)
      .eq("id", selectedQuote.id)
      .eq("plumber_id", uid);

    setSaving(false);

    if (error) {
      pushToast(`Save failed: ${error.message}`, "error");
      return;
    }

if (selectedRequest) {
  setQuoteMap((prev) => ({
    ...prev,
    [selectedRequest.id]: prev[selectedRequest.id]
      ? {
          ...prev[selectedRequest.id]!,
          trader_ref: patch.trader_ref,
          job_details: patch.job_details,
          vat_rate: patch.vat_rate,
          subtotal: patch.subtotal,
        }
      : prev[selectedRequest.id],
  }));
}

    pushToast("Saved ✓");
  }

  async function saveNotes() {
    if (!uid || !selectedRequest) return;

    setNotesSaving(true);

    const { error } = await supabase
      .from("quote_requests")
      .update({ trader_notes: notes })
      .eq("id", selectedRequest.id)
      .eq("plumber_id", uid);

    if (error) {
      pushToast(error.message, "error");
    } else {
      setRequestMap((prev) => ({
        ...prev,
        [selectedRequest.id]: {
          ...selectedRequest,
          trader_notes: notes,
        },
      }));
      pushToast("Notes saved");
    }

    setNotesSaving(false);
  }

async function updateJobStatus(nextStatus: JobStatus, okText: string){
  if (!uid || !selectedRequest) return;

  if (selectedQuote) {
    const { error } = await supabase
      .from("quotes")
      .update({ status: nextStatus })
      .eq("id", selectedQuote.id)
      .eq("plumber_id", uid);

    if (error) {
      pushToast(`Update failed: ${error.message}`, "error");
      return;
    }

    setQuoteMap((prev) => ({
      ...prev,
      [selectedRequest.id]: prev[selectedRequest.id]
        ? { ...prev[selectedRequest.id]!, status: nextStatus }
        : prev[selectedRequest.id],
    }));
  }

  const { error: requestError } = await supabase
    .from("quote_requests")
    .update({ status: nextStatus })
    .eq("id", selectedRequest.id)
    .eq("plumber_id", uid);

  if (requestError) {
    pushToast(`Update failed: ${requestError.message}`, "error");
    return;
  }

  setJobs((prev) =>
    prev.map((job) =>
      job.id === selectedRequest.id
        ? { ...job, status: nextStatus }
        : job
    )
  );

  setRequestMap((prev) => ({
    ...prev,
    [selectedRequest.id]: prev[selectedRequest.id]
      ? { ...prev[selectedRequest.id]!, status: nextStatus }
      : prev[selectedRequest.id],
  }));

  pushToast(okText);
}

async function markInProgress() {
  await updateJobStatus("in_progress", "Job marked in progress");
}

  async function markComplete() {
    await updateJobStatus("complete", "Job marked complete");
  }

  async function markInvoiced() {
    await updateJobStatus("invoiced", "Job marked invoiced");
  }

  async function markPaid() {
    await updateJobStatus("paid", "Job marked paid");
  }

  function goToCreateInvoice(requestId: string) {
    router.push(`/dashboard/invoices?requestId=${encodeURIComponent(requestId)}`);
  }

function goToCreateBooking(requestId: string) {
  setRightTab("schedule");
}

async function handleJobAction(action: string | null) {
  if (!action || !selectedRequest) return;
if (action === "message") {
  setRightTab("messages");
  return;
}

if (action === "happy") {
  await sendHappyCheckMessage();
  return;
}
  if (action === "booking") {
    goToCreateBooking(selectedRequest.id);
    return;
  }

  if (action === "start") {
    await markInProgress();
    return;
  }

  if (action === "complete") {
    await markComplete();
    return;
  }

  if (action === "invoice") {
    goToCreateInvoice(selectedRequest.id);
    return;
  }

  if (action === "paid") {
    await markPaid();
  }

}
  async function saveJobBookingDate() {
    if (!uid || !selectedRequest) return;

    if (!bookingDateTime) {
      pushToast("Pick a booking date and time.", "error");
      return;
    }

    setNotesSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        pushToast("Please log in again.", "error");
        setNotesSaving(false);
        return;
      }

      const res = await fetch("/api/bookings/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          bookingDateTime,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((json as any)?.error || "Booking failed");
      }

      const bookedAt =
        (json as any).booked_at || new Date(bookingDateTime).toISOString();

      setRequestMap((prev) => ({
        ...prev,
        [selectedRequest.id]: {
          ...selectedRequest,
          job_booked_at: bookedAt,
          status: "booked",
        },
      }));

      pushToast("Booking confirmed");
    } catch (e: any) {
      pushToast(e?.message || "Booking failed", "error");
    } finally {
      setNotesSaving(false);
    }
  }

  async function onUploadTraderFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedRequest || !e.target.files?.length) return;

    setUploading(true);
    setFileMsg(null);

    try {
      for (const file of Array.from(e.target.files)) {
        const path = `${traderFolder(selectedRequest.id)}/${Date.now()}-${safeFileName(
          file.name
        )}`;

        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (error) throw error;
      }

      await loadFiles(selectedRequest.id);
      pushToast("Files uploaded");
    } catch (err) {
      console.error(err);
      setFileMsg("Upload failed");
      pushToast("Upload failed", "error");
    }

    setUploading(false);
    e.target.value = "";
  }

  async function onUploadJobDocs(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedRequest || !e.target.files?.length) return;

    setDocsUploading(true);
    setDocsMsg(null);

    try {
      for (const file of Array.from(e.target.files)) {
        const path = `${docsFolder(selectedRequest.id)}/${Date.now()}-${safeFileName(
          file.name
        )}`;

        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (error) throw error;
      }

      await loadDocuments(selectedRequest.id);
      pushToast("Documents uploaded");
    } catch (err) {
      console.error(err);
      setDocsMsg("Upload failed");
      pushToast("Upload failed", "error");
    }

    setDocsUploading(false);
    e.target.value = "";
  }

async function deleteTraderFile(path: string) {
  if (!selectedRequest) return;

  const requestId = selectedRequest.id;

  setConfirmModal({
    title: "Delete file",
    message: "Are you sure you want to delete this file?",
    confirmText: "Delete",
    danger: true,
    onConfirm: async () => {
      setConfirmModal(null);

      const { error } = await supabase.storage.from(BUCKET).remove([path]);

      if (error) {
        console.error(error);
        pushToast("Couldn’t delete file", "error");
        return;
      }

      await loadFiles(requestId);
      pushToast("File deleted");
    },
  });
}
async function deleteFolderFiles(folder: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder);

  if (error || !data) return;

  const paths = data.map((file) => `${folder}/${file.name}`);

  if (paths.length) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
}

  async function deleteJobDoc(path: string) {
  if (!selectedRequest) return;

  const requestId = selectedRequest.id;

  setConfirmModal({
    title: "Delete document",
    message: "Are you sure you want to delete this document?",
    confirmText: "Delete",
    danger: true,
    onConfirm: async () => {
      setConfirmModal(null);

      const { error } = await supabase.storage.from(BUCKET).remove([path]);

      if (error) {
        console.error(error);
        pushToast("Couldn’t delete document", "error");
        return;
      }

      await loadDocuments(requestId);
      pushToast("Document deleted");
    },
  });
}



function logCallOnCurrentJob() {
  setCallModalOpen(true);
}
async function submitCallLog() {
  if (!selectedRequest || !uid || !callNote.trim()) return;

  const requestId = selectedRequest.id;

  const { error } = await supabase.from("enquiry_messages").insert({
    request_id: requestId,
    plumber_id: uid,
    direction: "in",
    channel: "phone",
   subject: `Phone call — ${callOutcome}`,
    body_text: callNote.trim(),
    from_email: selectedRequest.customer_phone || "Phone call",
    to_email: null,
  });

  if (error) {
    pushToast("Couldn’t log phone call", "error");
    return;
  }

  await loadThread(requestId, uid);
  await loadThreadMapForRows([requestId], uid);

  setCallModalOpen(false);
  setCallNote("");
  setCallOutcome("General");

  pushToast("Phone call logged");
}
async function sendOnMyWayMessage() {
  if (!selectedRequest || !uid) return;

  const customerName = selectedRequest.customer_name
    ? titleCase(selectedRequest.customer_name)
    : "there";

  const message = `Hi ${customerName}, I’m on my way and should be with you shortly.`;

  setReplySubject(`Re: ${selectedRequest.job_type || "Your job"}`);
  setReplyBody(message);

  try {
    const res = await fetch("/api/enquiries/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: selectedRequest.id,
        plumberId: uid,
        to: selectedRequest.customer_email,
        subject: `Re: ${selectedRequest.job_type || "Your job"}`,
        body: message,
        customerName: selectedRequest.customer_name,
      }),
    });

    if (!res.ok) throw new Error("Couldn’t send");

    setReplyBody("");
    await loadThread(selectedRequest.id, uid);
    await loadThreadMapForRows([selectedRequest.id], uid);

    pushToast("Customer notified — on your way");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t send on my way message", "error");
  }
}
async function sendRunningLateMessage() {
  if (!selectedRequest || !uid) return;

  const customerName = selectedRequest.customer_name
    ? titleCase(selectedRequest.customer_name)
    : "there";

  const message = `Hi ${customerName}, just to let you know I’m running a little behind, but I’m still coming today. I’ll keep you updated.`;

  try {
    const res = await fetch("/api/enquiries/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: selectedRequest.id,
        plumberId: uid,
        to: selectedRequest.customer_email,
        subject: `Re: ${selectedRequest.job_type || "Your job"}`,
        body: message,
        customerName: selectedRequest.customer_name,
      }),
    });

    if (!res.ok) throw new Error("Couldn’t send");

    await loadThread(selectedRequest.id, uid);
    await loadThreadMapForRows([selectedRequest.id], uid);

    pushToast("Customer notified — running late");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t send running late message", "error");
  }
}
async function sendHappyCheckMessage() {
  if (!selectedRequest || !uid) return;

  const customerName = selectedRequest.customer_name
    ? titleCase(selectedRequest.customer_name)
    : "there";

  const message = `Hi ${customerName}, just checking you’re happy with everything from the job. If there’s anything you need, just let me know.`;

  try {
    const res = await fetch("/api/enquiries/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: selectedRequest.id,
        plumberId: uid,
        to: selectedRequest.customer_email,
        subject: `Re: ${selectedRequest.job_type || "Your job"}`,
        body: message,
        customerName: selectedRequest.customer_name,
      }),
    });

    if (!res.ok) throw new Error("Couldn’t send");

    await loadThread(selectedRequest.id, uid);
    await loadThreadMapForRows([selectedRequest.id], uid);

    pushToast("Customer check-in sent");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t send check-in", "error");
  }
}
async function sendReviewRequest() {
  if (!selectedRequest) return;

  setReviewSending(true);
  setReviewSent(false);

  try {
    const res = await fetch("/api/reviews/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId: selectedRequest.id }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json?.error || "Couldn’t send review request");
    }

    setReviewSent(true);
    pushToast("Review request sent", "success");
  } catch (err: any) {
    pushToast(err?.message || "Couldn’t send review request", "error");
  } finally {
    setReviewSending(false);
  }
}

async function resolveIssue() {
  if (!selectedRequest || !uid) return;

  const requestId = selectedRequest.id;

  const issueMessages = (threadMap[requestId] || []).filter(
    (m) =>
      m.channel === "phone" &&
      !m.resolved_at &&
      (m.subject || "").toLowerCase().includes("issue")
  );

  if (!issueMessages.length) return;

  const ids = issueMessages.map((m) => m.id);

  const { error } = await supabase
    .from("enquiry_messages")
    .update({ resolved_at: new Date().toISOString() })
    .in("id", ids)
    .eq("plumber_id", uid);

  if (error) {
    pushToast("Couldn’t resolve issue", "error");
    return;
  }

  await loadThread(requestId, uid);
  await loadThreadMapForRows([requestId], uid);

  pushToast("Issue resolved");
}



async function sendIssueFollowUp() {
  if (!selectedRequest || !uid) return;

  const customerName = selectedRequest.customer_name
    ? titleCase(selectedRequest.customer_name)
    : "there";

  const message = `Hi ${customerName}, just following up on the issue mentioned. I’ll get this sorted for you — I’ll keep you updated shortly.`;

  try {
    const res = await fetch("/api/enquiries/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: selectedRequest.id,
        plumberId: uid,
        to: selectedRequest.customer_email,
        subject: `Re: ${selectedRequest.job_type || "Your job"}`,
        body: message,
        customerName: selectedRequest.customer_name,
      }),
    });

    if (!res.ok) throw new Error("Couldn’t send");

    await loadThread(selectedRequest.id, uid);
    await loadThreadMapForRows([selectedRequest.id], uid);

    pushToast("Customer updated — issue handled");
  } catch (err) {
    console.error(err);
    pushToast("Couldn’t send message", "error");
  }
}
  async function sendReply() {
    if (!selectedRequest || !uid) return;
    if (!replyTo.trim() || !replyBody.trim()) return;

    try {
      const res = await fetch("/api/enquiries/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
body: JSON.stringify({
  requestId: selectedRequest.id,
  plumberId: uid,
  to: replyTo.trim(),
  subject:
    replySubject.trim() || `Re: ${selectedRequest.job_type || "Your job"}`,
  body: replyBody.trim(),
  customerName: selectedRequest.customer_name,
}),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Couldn’t send");
      }

      setReplyBody("");
      await loadThread(selectedRequest.id, uid);
      await loadThreadMapForRows([selectedRequest.id], uid);
      pushToast("Message sent");
    } catch (err) {
      console.error(err);
      pushToast("Couldn’t send message", "error");
    }
  }

async function deleteJob() {
  if (!uid || !selectedRequest) return;

setConfirmModal({
  title: "Delete job",
  message: "Are you sure you want to delete this job? This cannot be undone.",
  confirmText: "Delete",
  danger: true,
  onConfirm: async () => {
    setConfirmModal(null);


  try {
    // 1. Delete messages
    await supabase
      .from("enquiry_messages")
      .delete()
      .eq("request_id", selectedRequest.id)
      .eq("plumber_id", uid);

    // 2. Delete site visits
    await supabase
      .from("site_visits")
      .delete()
      .eq("request_id", selectedRequest.id)
      .eq("plumber_id", uid);

    // 3. Delete quote (if exists)
    if (selectedQuote) {
      const { error: quoteError } = await supabase
        .from("quotes")
        .delete()
        .eq("id", selectedQuote.id)
        .eq("plumber_id", uid);

 

      if (quoteError) throw quoteError;
    }

    // 4. Delete request (main job)
    const { error: requestError } = await supabase
      .from("quote_requests")
      .delete()
      .eq("id", selectedRequest.id)
      .eq("plumber_id", uid);

    if (requestError) throw requestError;

    // 5. Delete storage files (best effort)
    try {
await Promise.all([
  deleteFolderFiles(customerFolder(selectedRequest.id)),
  deleteFolderFiles(traderFolder(selectedRequest.id)),
  deleteFolderFiles(docsFolder(selectedRequest.id)),
]);
    } catch (e) {
      console.warn("Storage cleanup failed (non-blocking)", e);
    }

    // 6. Update UI
    setJobs((prev) => prev.filter((j) => j.id !== selectedRequest.id));

    setQuoteMap((prev) => {
      const next = { ...prev };
      delete next[selectedRequest.id];
      return next;
    });

    setRequestMap((prev) => {
      const next = { ...prev };
      delete next[selectedRequest.id];
      return next;
    });

    setVisitMap((prev) => {
      const next = { ...prev };
      delete next[selectedRequest.id];
      return next;
    });

    setThreadMap((prev) => {
      const next = { ...prev };
      delete next[selectedRequest.id];
      return next;
    });

    backToListMobile();
    pushToast("Job deleted");
      } catch (err: any) {
        pushToast(`Delete failed: ${err.message}`, "error");
      }
    },
  });

  return;
}
  useEffect(() => {
    setSelectedRequestIdState(requestIdParam || null);
  }, [requestIdParam]);

  useEffect(() => {
    let mounted = true;
    let chQuotes: ReturnType<typeof supabase.channel> | null = null;
    let chRequests: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setLoading(true);

    

const {
  data: { session },
} = await supabase.auth.getSession();


const userId = session?.user?.id ?? null;

      if (!mounted) return;
      setUid(userId);

      if (!userId) {
        setLoading(false);
        pushToast("Please log in.", "error");
        return;
      }

      await loadJobsForTrader(userId);

      if (!mounted) return;

      chQuotes = supabase
        .channel("ff_jobs_quotes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quotes",
            filter: `plumber_id=eq.${userId}`,
          },
          () => loadJobsForTrader(userId)
        )
        .subscribe();

      chRequests = supabase
        .channel("ff_jobs_requests")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quote_requests",
            filter: `plumber_id=eq.${userId}`,
          },
          () => loadJobsForTrader(userId)
        )
        .subscribe();

      setLoading(false);
    })();

    return () => {
      mounted = false;
      if (chQuotes) supabase.removeChannel(chQuotes);
      if (chRequests) supabase.removeChannel(chRequests);
    };
  }, []);

  useEffect(() => {
    if (!selectedRequest) return;

    setWorkDescription(selectedQuote?.job_details || selectedRequest.details || "");
    setTraderRef(selectedQuote?.trader_ref || "");
    setSubtotal(selectedQuote?.subtotal != null ? String(selectedQuote.subtotal) : "");
    setVatRegistered(Number(selectedQuote?.vat_rate || 0) > 0);
    setVatRate(Number(selectedQuote?.vat_rate || 0) > 0 ? "20" : "0");
  }, [selectedRequest?.id, selectedQuote?.id]);

  useEffect(() => {
    if (!selectedRequest) return;

    setNotes(selectedRequest.trader_notes || "");
    setReplyTo(selectedRequest.customer_email || "");
    setReplySubject(`Re: ${selectedQuote?.job_type || "Your job"}`);
    setReplyBody("");

    const existingBooking =
      selectedRequest.job_booked_at || selectedVisit?.starts_at || "";

    if (existingBooking) {
      const d = new Date(existingBooking);
      const pad = (n: number) => String(n).padStart(2, "0");

      const localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

      setBookingDateTime(localValue);
    } else {
      setBookingDateTime("");
    }

    if (uid) {
      loadThread(selectedRequest.id, uid);
    }

    loadFiles(selectedRequest.id);
    loadDocuments(selectedRequest.id);
  }, [selectedRequest?.id, selectedVisit?.id, uid, selectedQuote?.job_type]);

const visibleJobs = useMemo(() => {
  let list = [...jobs].filter((request) => {
    const quote = quoteMap[request.id] || null;
    return isRealJob(request, quote);
  });

  if (statusFilter) {
    list = list.filter((request) => {
      const quote = quoteMap[request.id] || null;
      const visit = visitMap[request.id] || null;
      return normalizeJobStatus(quote, request, visit) === statusFilter;
    });
  }

  if (postcodeFilter.trim()) {
    const needle = postcodeFilter.trim().toLowerCase();
    list = list.filter((request) =>
      `${request.postcode || ""} ${request.address || ""}`
        .toLowerCase()
        .includes(needle)
    );
  }
if (issueOnly) {
  list = list.filter((request) =>
    (threadMap[request.id] || []).some((m) => {
      const text = `${m.subject || ""} ${m.body_text || ""}`.toLowerCase();

      return (
        (m.channel === "phone" && !m.resolved_at && text.includes("issue")) ||
        text.includes("not happy")
      );
    })
  );
}
  return list;
}, [jobs, statusFilter, postcodeFilter, quoteMap, visitMap, issueOnly, threadMap]);

const sortedJobs = useMemo(() => {
  return [...visibleJobs].sort((a, b) => {

    const aSelected = a.id === selectedRequestId;
    const bSelected = b.id === selectedRequestId;
    const hasIssueA = (threadMap[a.id] || []).some(
  (m) =>
    m.channel === "phone" &&
    (m.subject || "").toLowerCase().includes("issue")
);

const hasIssueB = (threadMap[b.id] || []).some(
  (m) =>
    m.channel === "phone" &&
    (m.subject || "").toLowerCase().includes("issue")
);
const atRiskA =
  hasIssueA ||
  (threadMap[a.id] || []).some((m) =>
    (m.body_text || "").toLowerCase().includes("not happy")
  );

const atRiskB =
  hasIssueB ||
  (threadMap[b.id] || []).some((m) =>
    (m.body_text || "").toLowerCase().includes("not happy")
  );

if (atRiskA !== atRiskB) return atRiskA ? -1 : 1;
if (hasIssueA !== hasIssueB) return hasIssueA ? -1 : 1;

    // ✅ keep selected job pinned at top
    if (aSelected !== bSelected) return aSelected ? -1 : 1;

    const qa = quoteMap[a.id] || null;
    const qb = quoteMap[b.id] || null;

    const va = visitMap[a.id] || null;
    const vb = visitMap[b.id] || null;

    const hintA = getJobTimeHint(a, va, qa);
    const hintB = getJobTimeHint(b, vb, qb);

    const score = (hint?: { text: string } | null) => {
      if (!hint) return 0;

      if (hint.text.includes("overdue")) return 100;
      if (hint.text.includes("soon")) return 90;
      if (hint.text.includes("today")) return 80;
      if (hint.text.includes("tomorrow")) return 70;
      if (hint.text.includes("Needs booking")) return 60;
      if (hint.text.includes("Send invoice")) return 50;
      if (hint.text.includes("Awaiting payment")) return 40;
      if (hint.text.includes("Upcoming")) return 30;
      if (hint.text.includes("Complete")) return 10;

      return 0;
    };

    const diff = score(hintB) - score(hintA);
    if (diff !== 0) return diff;

    // fallback to newest
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();

    if (Number.isNaN(da) && Number.isNaN(db)) return 0;
    if (Number.isNaN(da)) return 1;
    if (Number.isNaN(db)) return -1;

    return db - da;
  });
}, [visibleJobs, selectedRequestId, quoteMap, visitMap, threadMap]);
const counts = useMemo(() => {
  const all = visibleJobs.length;

  const approved = visibleJobs.filter((request) => {
    const quote = quoteMap[request.id] || null;
    const visit = visitMap[request.id] || null;
    return normalizeJobStatus(quote, request, visit) === "approved";
  }).length;

  const booked = visibleJobs.filter((request) => {
    const quote = quoteMap[request.id] || null;
    const visit = visitMap[request.id] || null;
    return normalizeJobStatus(quote, request, visit) === "booked";
  }).length;

  const live = visibleJobs.filter((request) => {
    const quote = quoteMap[request.id] || null;
    const visit = visitMap[request.id] || null;
    const s = normalizeJobStatus(quote, request, visit);
    return s === "in_progress" || s === "complete";
  }).length;

  const paid = visibleJobs.filter((request) => {
    const quote = quoteMap[request.id] || null;
    const visit = visitMap[request.id] || null;
    return normalizeJobStatus(quote, request, visit) === "paid";
  }).length;

  return { all, approved, booked, live, paid };
}, [visibleJobs, quoteMap, visitMap]);

const revenue = useMemo(() => {
  if (!jobs.length) {
    return {
      invoiced: 0,
      paid: 0,
      outstanding: 0,
      overdue: 0,
      overdueCount: 0,
    };
  }

  const now = new Date();

  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  let invoiced = 0;
  let paid = 0;
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;

  for (const request of jobs) {
    const quote = quoteMap[request.id];
    if (!quote) continue;

    const value = Number(quote.subtotal || 0);

    // ✅ use SENT date if available
    const baseDate = quote.sent_at || quote.created_at;
    const created = new Date(baseDate);

    const isThisMonth = created >= startOfMonth;

    if (!isThisMonth) continue;

    const status = String(quote.status || "").toLowerCase();

    if (status === "invoiced" || status === "paid") {
      invoiced += value;
    }

    if (status === "paid") {
      paid += value;
    }

    if (status === "invoiced") {
      outstanding += value;

      // ⏰ OVERDUE LOGIC (simple version)
      const ageHours =
        (now.getTime() - created.getTime()) /
        (1000 * 60 * 60);

      if (ageHours > 72) {
        overdue += value;
        overdueCount++;
      }
    }
  }

  return {
    invoiced,
    paid,
    outstanding,
    overdue,
    overdueCount,
  };
}, [jobs, quoteMap]);

const paymentInsights = useMemo(() => {
  const now = new Date();

  let needsChasing: string[] = [];
  let urgentChasing: string[] = [];

  for (const request of jobs) {
    const quote = quoteMap[request.id];
    if (!quote) continue;

    const status = String(quote.status || "").toLowerCase();
    if (status !== "invoiced") continue;

    const sentDate = new Date(quote.sent_at || quote.created_at);

    const hours =
      (now.getTime() - sentDate.getTime()) /
      (1000 * 60 * 60);

    // ⏰ 3 days → soft chase
    if (hours > 72 && hours <= 120) {
      needsChasing.push(request.id);
    }

    // 🚨 5 days → urgent
    if (hours > 120) {
      urgentChasing.push(request.id);
    }
  }

  return {
    needsChasing,
    urgentChasing,
    total:
      needsChasing.length + urgentChasing.length,
  };
}, [jobs, quoteMap]);

const quickReplies = useMemo(() => {
  const customerName = selectedRequest?.customer_name
    ? titleCase(selectedRequest.customer_name)
    : "there";

  return [
    `Hi ${customerName}, just confirming everything is still okay for the job.`,
    `Hi ${customerName}, I’m on the way and should be with you shortly.`,
    `Hi ${customerName}, the work is complete now. I’ll send the invoice over shortly.`,
    `Hi ${customerName}, just checking you’re happy with everything.`,
  ];
}, [selectedRequest]);


  const jobHealth = useMemo(() => {
    return getHealthItems({
      quote: selectedQuote,
      request: selectedRequest,
      visit: selectedVisit,
      traderFiles,
      jobDocs,
    });
  }, [selectedQuote, selectedRequest, selectedVisit, traderFiles, jobDocs]);

  const hasIssueCall = useMemo(() => {
  if (!selectedRequest) return false;

  const messages = threadMap[selectedRequest.id] || [];

return messages.some(
  (m) =>
    m.channel === "phone" &&
    !m.resolved_at &&
    (m.subject || "").toLowerCase().includes("issue")
);
}, [selectedRequest, threadMap]);

const isSelectedAtRisk = useMemo(() => {
  if (!selectedRequest) return false;

  const messages = threadMap[selectedRequest.id] || [];

  return messages.some((m) =>
    (m.body_text || "").toLowerCase().includes("not happy")
  );
}, [selectedRequest, threadMap]);

const autoAction = useMemo(() => {
  if (!selectedRequest) return null;

  const messages = threadMap?.[selectedRequest.id] || [];
  const customerName = selectedRequest.customer_name
    ? selectedRequest.customer_name.split(" ")[0]
    : "there";

  const status = normalizeJobStatus(
    selectedQuote,
    selectedRequest,
    selectedVisit
  );

  if (status === "invoiced") {
const baseDate =
  selectedQuote?.sent_at || selectedQuote?.created_at;

if (!baseDate) return null;

const sentDate = new Date(baseDate);

const hours =
  (Date.now() - sentDate.getTime()) /
  (1000 * 60 * 60);

  // 🚨 URGENT CHASE
  if (hours > 120) {
    return {
      title: "Chase overdue payment",
      text: "Invoice is overdue — follow up now to get paid.",
      message: `Hi ${customerName}, just a quick reminder about the invoice — please let me know if you need anything from me.`,
    };
  }

  // ⏰ SOFT CHASE
  if (hours > 72) {
    return {
      title: "Follow up on invoice",
      text: "Customer hasn’t paid yet — a quick nudge helps.",
      message: `Hi ${customerName}, just checking if you’ve had a chance to look at the invoice.`,
    };
  }
}

  // ✅ PRIORITY: JOB STATUS FIRST

  if (status === "approved") {
    return {
      title: "Book this job in",
      text: "Customer has said yes — lock in a date before they go elsewhere.",
      message: `Hi ${customerName}, great news — when would you like me to book this in?`,
    };
  }

  if (status === "booked") {
    return {
      title: "Keep customer warm",
      text: "Send a quick update so they feel confident before the job.",
      message: `Hi ${customerName}, just confirming everything is booked in — looking forward to getting this sorted for you.`,
    };
  }

  if (status === "in_progress") {
    return {
      title: "Keep them updated",
      text: "A quick update builds trust while work is ongoing.",
      message: `Hi ${customerName}, just a quick update — everything is going well so far.`,
    };
  }

  if (status === "complete") {
    return {
      title: "Send invoice",
      text: "Don’t delay — sending now increases chance of fast payment.",
      message: `Hi ${customerName}, the job is complete — I’ll send the invoice over now.`,
    };
  }


if (status === "invoiced") {
  return {
    title: "Invoice sent",
    text: "Give the customer a little time before following up.",
    message: "",
  };
}
  // 🧠 FALLBACK → MESSAGE LOGIC

  const lastMessage = messages[messages.length - 1];

  if (!messages.length) {
    return {
      title: "Send first reply",
      text: "Customer is waiting — replying quickly increases your chance of winning.",
      message: `Hi ${customerName}, thanks for your enquiry — I’ll get back to you shortly.`,
    };
  }

  if (lastMessage && lastMessage.direction !== "out") {
    return {
      title: "Reply now",
      text: "Customer has replied — jump back in while they’re engaged.",
      message: `Hi ${customerName}, thanks for your message — I’ll get this sorted.`,
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
        message: `Hi ${customerName}, just checking if you'd like me to go ahead.`,
      };
    }
  }

  return null;
}, [selectedRequest, selectedQuote, selectedVisit, threadMap]);

  const missingItems = useMemo(() => {
    return getMissingItems({
      quote: selectedQuote,
      request: selectedRequest,
      visit: selectedVisit,
      traderFiles,
      jobDocs,
    });
  }, [selectedQuote, selectedRequest, selectedVisit, traderFiles, jobDocs]);

  const isMobileDetail = !!selectedRequest;
const currentStatus = selectedRequest
  ? normalizeJobStatus(selectedQuote, selectedRequest, selectedVisit)
  : "approved";

const jobNext = getJobNextAction(
  selectedQuote,
  selectedRequest,
  selectedVisit
);
return (
  <>
  

    <div
  className="ff-page ff-jobsPage"
  data-mobile-detail={isMobileDetail ? "1" : "0"}
>
        <div className="ff-wrap">
          <div className="ff-top">
            <div className="ff-hero">
              <div className="ff-heroGlow" />
              <div className="ff-heroRow">
                <div className="ff-heroLeft">
                  <div className="ff-heroTitle">Jobs</div>
                                    <div className="ff-heroRule" />
                  <div className="ff-heroSub">
                    Manage approved work, booked jobs, progress, files, notes,
                    completion documents and invoicing in one place.
                  </div>
                </div>
                
<div className="ff-revenueBar">
  <div className="ff-revenueItem">
    <div className="ff-revenueValue">{money(revenue.invoiced)}</div>
    <div className="ff-revenueLabel">This month</div>
  </div>

{paymentInsights.total > 0 && (
  <div className="ff-alertBar">
    <div>
      ⚠️ {paymentInsights.total} payment
      {paymentInsights.total > 1 ? "s" : ""} need attention
    </div>

    <button
      className="ff-btn ff-btnGhost ff-btnSm"
      onClick={() => setStatusFilter("invoiced")}
    >
      View invoices
    </button>
  </div>
)}

  <div className="ff-revenueItem">
    <div className="ff-revenueValue">{money(revenue.paid)}</div>
    <div className="ff-revenueLabel">Received</div>
  </div>

  <div className="ff-revenueItem ff-revenueItemWarning">
    <div className="ff-revenueValue">{money(revenue.outstanding)}</div>
    <div className="ff-revenueLabel">Outstanding</div>
  </div>

  {revenue.overdue > 0 && (
    <div
      className="ff-revenueItem ff-revenueItemDanger"
      onClick={() => setStatusFilter("invoiced")}
    >
      <div className="ff-revenueValue">
        {money(revenue.overdue)}
      </div>
      <div className="ff-revenueLabel">
        Overdue ({revenue.overdueCount})
      </div>
    </div>
  )}
</div>

                <div className="ff-heroStats">
                  <div className="ff-statCard">
                    <div className="ff-statLabel">All</div>
                    <div className="ff-statValue">{counts.all}</div>
                  </div>

                  <div className="ff-statCard">
                    <div className="ff-statLabel">Approved</div>
                    <div className="ff-statValue">{counts.approved}</div>
                  </div>

                  <div className="ff-statCard">
                    <div className="ff-statLabel">Booked</div>
                    <div className="ff-statValue">{counts.booked}</div>
                  </div>

                  <div className="ff-statCard">
                    <div className="ff-statLabel">Live</div>
                    <div className="ff-statValue">{counts.live}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ff-controls">
              <div className="ff-filterRow">
                <button
                  type="button"
                  className={`ff-pillSmall ${
                    statusFilter === "" ? "ff-pillNeutralActive" : ""
                  }`}
                  onClick={() => setStatusFilter("")}
                >
                  All
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ${
                    statusFilter === "approved" ? "ff-pillNeutralActive" : ""
                  }`}
                  onClick={() => setStatusFilter("approved")}
                >
                  Approved
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ${
                    statusFilter === "booked" ? "ff-pillNeutralActive" : ""
                  }`}
                  onClick={() => setStatusFilter("booked")}
                >
                  Booked
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ${
                    statusFilter === "in_progress" ? "ff-pillNeutralActive" : ""
                  }`}
                  onClick={() => setStatusFilter("in_progress")}
                >
                  In progress
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ${
                    statusFilter === "complete" ? "ff-pillNeutralActive" : ""
                  }`}
                  onClick={() => setStatusFilter("complete")}
                >
                  Complete
                </button>
              </div>

              <div className="ff-filterRow">
                <input
                  className="ff-input"
                  placeholder="Filter by postcode / area"
                  value={postcodeFilter}
                  onChange={(e) => setPostcodeFilter(e.target.value)}
                />
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



<div className={`ff-mainShell ${selectedRequest ? "hasSelection" : ""}`}>
  {/* LEFT */}
  <div className="ff-leftPane">
    <div className="ff-leftTop">
      <div className="ff-leftTitle">All jobs</div>

      <div className="ff-leftFilters">
<div className="ff-segmented">
  <button
    type="button"
    className={`ff-segBtn ${statusFilter === "" ? "isActive" : ""}`}
    onClick={() => {
      setIssueOnly(false);
      setStatusFilter("");
    }}
  >
    All
  </button>

  <button
    type="button"
    className={`ff-segBtn ${issueOnly ? "isActive ff-segBtnDanger" : ""}`}
    onClick={() => {
      setStatusFilter("");
      setIssueOnly((v) => !v);
    }}
  >
    ⚠️ Issues
  </button>

  <button
    type="button"
    className={`ff-segBtn ${statusFilter === "approved" ? "isActive" : ""}`}
    onClick={() => {
      setIssueOnly(false);
      setStatusFilter("approved");
    }}
  >
    Approved
  </button>

  <button
    type="button"
    className={`ff-segBtn ${statusFilter === "booked" ? "isActive" : ""}`}
    onClick={() => {
      setIssueOnly(false);
      setStatusFilter("booked");
    }}
  >
    Booked
  </button>

  <button
    type="button"
    className={`ff-segBtn ${statusFilter === "in_progress" ? "isActive" : ""}`}
    onClick={() => {
      setIssueOnly(false);
      setStatusFilter("in_progress");
    }}
  >
    In progress
  </button>

  <button
    type="button"
    className={`ff-segBtn ${statusFilter === "complete" ? "isActive" : ""}`}
    onClick={() => {
      setIssueOnly(false);
      setStatusFilter("complete");
    }}
  >
    Complete
  </button>
</div>
{issueOnly && (
  <div className="ff-filterHint">
    Showing jobs with issues
  </div>
)}
      </div>
    </div>

    <div className="ff-leftList">
      {loading ? (
        <div className="ff-loadingWrap">
          <div className="ff-loadingText">Loading jobs…</div>
        </div>
      ) : sortedJobs.length ? (
        sortedJobs.map((request) => {
          const active = request.id === selectedRequestId;
          const quote = quoteMap[request.id] || null;
          const visit = visitMap[request.id] || null;
          const urgency = urgencyChip(request.urgency);
          const messages = threadMap[request.id] || [];
          const hasUnread = hasIncomingReply(messages);
const alert = getJobAlert(messages);
const hasIssue = messages.some(
  (m) =>
    m.channel === "phone" &&
    !m.resolved_at &&
    (m.subject || "").toLowerCase().includes("issue")
);

const isAtRisk =
  hasIssue ||
  messages.some((m) =>
    (m.body_text || "").toLowerCase().includes("not happy")
  );
const state = normalizeJobStatus(quote, request, visit);
const timeHint = getJobTimeHint(request, visit, quote);

return (
  
  <button
              key={request.id}
              ref={active ? activeRowRef : null}
className={`ff-leftItem 
  ${active ? "isActive" : ""} 
  ${getUrgencyGlowClass(request.urgency)} 
  ${hasIssue ? "ff-leftItemRisk" : ""}
`}
              type="button"
              onClick={() => openJob(request.id)}
            >
              <div className="ff-leftItemInner">
                <div className="ff-leftItemTop">
                  <div className="ff-jobNumber">
                    {request.job_number ||
                      `FF-${request.id.slice(0, 4).toUpperCase()}`}
                    {hasUnread && <span className="ff-unreadDot" />}
                  </div>

                  <div className="ff-leftDate">
                    {niceDateOnly(request.created_at)}
                  </div>
                </div>

                <div className="ff-leftJobTitle">
                  {titleCase(request.job_type || "Job")}
                </div>

                <div className="ff-leftCustomer">
                  {titleCase(request.customer_name || "Customer")}
                </div>

                <div className="ff-leftAddress">
                  {request.address ||
                    formatPostcode(request.postcode) ||
                    "No address"}
                </div>

                <div className="ff-leftMetaRow">
                  <div className="ff-leftMetaText ff-leftPrice">
                    {quote?.subtotal && quote.subtotal > 0
                      ? money(quote.subtotal)
                      : "Estimate needed"}
                  </div>

                  <span className="ff-leftMetaDot">•</span>

                  <div className="ff-leftMetaText">
                    {visit?.starts_at
                      ? niceDate(visit.starts_at)
                      : request.job_booked_at
                      ? niceDate(request.job_booked_at)
                      : "Not booked yet"}
                  </div>
                </div>
                

<div className="ff-leftChipRow ff-leftChipRowSplit">
  <span className={urgency.cls}>{urgency.text}</span>

  {alert && <span className={alert.cls}>{alert.text}</span>}

  {messages.some((m) => m.channel === "phone") && (
    <span className="ff-chip ff-chipBlue">📞 Call logged</span>
  )}

{hasIssue && (
  <button
    type="button"
    className="ff-chip ff-chip--overdue ff-chipButton"
    onClick={(e) => {
      e.stopPropagation();
      openJob(request.id);
      setRightTab("overview");
    }}
  >
    ⚠️ Issue
  </button>
)}
  {isAtRisk && !hasIssue && (
  <span className="ff-chip ff-chip--overdue">🔥 At risk</span>
)}
</div>



{timeHint && (
  <div className={`ff-leftHint ${timeHint.cls}`}>
    {timeHint.text}
  </div>
  
)}
            </div>  
            </button>
          );
        })
      ) : (
        <div className="ff-emptyWrap">
          <EmptyState
            title="No jobs found"
            sub="Approved and active jobs will appear here."
          />
        </div>
      )}
    </div>
  </div>

  {/* RIGHT */}
  <div className="ff-card ff-rightPane">
    <div className="ff-rightInner">
                {!selectedRequest ? (
  <div className="ff-emptyWrap">
    <EmptyState
      title="Select a job"
      sub="Pick one from the list to view full job details, files, notes and progress."
    />
  </div>
) : (
                  <>
                    <button
  type="button"
  className="ff-backBtn ff-backBtnMobile"
                      onClick={backToListMobile}
                    >
                      ← Back to jobs
                    </button>

                   <div className="ff-rightTop">
  <div className="ff-rightTopLeft">
    <div className="ff-rightJobNo">
      {selectedRequest?.job_number || "No job number"}
    </div>

    <div className="ff-rightTitle">
      {titleCase(selectedQuote?.job_type || selectedRequest?.job_type || "Job")}
    </div>

    <div className="ff-rightSub">
      {titleCase(selectedQuote?.customer_name || selectedRequest?.customer_name || "Customer")} •{" "}
      {formatPostcode(selectedQuote?.postcode || selectedRequest?.postcode || "") || "—"}
    </div>
  </div>

  <div className="ff-rightTopActions">
    {(selectedQuote?.customer_phone || selectedRequest?.customer_phone) ? (
      <a
        href={telHref(selectedQuote?.customer_phone || selectedRequest?.customer_phone)}
        className="ff-btn ff-btnGhost ff-btnSm"
        style={{ textDecoration: "none" }}
      >
        Call customer
      </a>
    ) : null}

    <button type="button" className="ff-btn ff-btnGhost ff-btnSm" onClick={saveJobCore} disabled={saving}>
      {saving ? "Saving…" : "Save"}
    </button>

    <button
      type="button"
      className="ff-btn ff-btnPrimary ff-btnSm"
      onClick={() => selectedRequest && goToCreateInvoice(selectedRequest.id)}
      disabled={!selectedRequest}
    >
      Create invoice
    </button>
<button
  type="button"
  className="ff-btn ff-btnGhost ff-btnSm"
  onClick={sendReviewRequest}
  disabled={!selectedRequest?.customer_email || reviewSending}
>
  {reviewSending ? "Sending…" : reviewSent ? "Sent ✓" : "Ask for review"}
</button>


    <button type="button" className="ff-btn ff-btnDanger ff-btnSm" onClick={deleteJob} disabled={saving}>
      Delete
    </button>
  </div>
</div>


                    <div className="ff-tabs">
                      {[
                        ["overview", "Overview"],
                        ["schedule", "Schedule"],
                        ["files", "Files"],
                        ["messages", "Messages"],
                        ["notes", "Notes"],
                        ["documents", "Documents"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`ff-tabBtn ${
                            rightTab === value ? "isActive" : ""
                          }`}
                          onClick={() => setRightTab(value as JobTab)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

{rightTab === "overview" ? (
  <>


    {autoAction && (

      <div className="ff-detailCard ff-bestActionCard">

        <div className="ff-bestActionEyebrow">Best next action</div>

        <div className="ff-bestActionTitle">

          {autoAction.title}

        </div>

        <div className="ff-bestActionText">

          {autoAction.text}

        </div>

        <div style={{ marginTop: 12 }}>

          <button

            className="ff-btn ff-btnPrimary"

            onClick={() => {

              setReplyBody(autoAction.message);

              setRightTab("messages");

            }}

          >

            ⚡ Use suggested message

          </button>

        </div>

      </div>

    )}

    <div className="ff-jobOverviewClean">
      {hasIssueCall && (
  <div className="ff-detailCard ff-warningCard">
    <div className="ff-detailSectionTitle">⚠️ Issue reported</div>
    <div className="ff-detailSub">
      A problem was reported during a phone call. Check messages and resolve this before continuing the job.
    </div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
  <button
    className="ff-btn ff-btnGhost ff-btnSm"
    onClick={() => setRightTab("messages")}
  >
    View call details
  </button>

  <button
    className="ff-btn ff-btnGhost ff-btnSm"
    onClick={resolveIssue}
  >
    Resolve issue
  </button>

  <button
    className="ff-btn ff-btnPrimary ff-btnSm"
    onClick={sendIssueFollowUp}
  >
    💬 Message customer
  </button>
</div>
</div>
  
)}

{isSelectedAtRisk && !hasIssueCall && (
  <div className="ff-detailCard ff-warningCard">
    <div className="ff-detailSectionTitle">🔥 Customer not happy</div>

    <div className="ff-detailSub">
      The customer sounds unhappy. Jump in quickly to protect this job and keep control.
    </div>

    <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
      <button
        className="ff-btn ff-btnPrimary ff-btnSm"
        onClick={() => setRightTab("messages")}
      >
        Open messages
      </button>

      <button
        className="ff-btn ff-btnGhost ff-btnSm"
        onClick={sendIssueFollowUp}
      >
        💬 Send reassurance
      </button>
    </div>
  </div>
)}
</div>   



     <div className="ff-jobSummary">
  <div>
    <div className="ff-summaryLabel">Status</div>
    <div className="ff-summaryValue">{selectedStatusChip?.text}</div>
  </div>

  <div>
    <div className="ff-summaryLabel">Booked</div>
    <div className="ff-summaryValue">
      {selectedRequest?.job_booked_at
        ? niceDate(selectedRequest.job_booked_at)
        : "Not booked"}
    </div>
  </div>

<div>
  <div className="ff-summaryLabel">Value</div>
  <div className="ff-summaryValue">
    {selectedQuote?.subtotal ? (
      money(selectedQuote.subtotal)
    ) : (
      <button
        type="button"
        className="ff-linkAction"
        onClick={() =>
          selectedRequest && goToCreateInvoice(selectedRequest.id)
        }
      >
        Create estimate
      </button>
    )}
  </div>
</div>

  <div>
    <div className="ff-summaryLabel">Invoice</div>
    <div className="ff-summaryValue">
      {currentStatus === "paid"
        ? "Paid"
        : currentStatus === "invoiced"
        ? "Invoice sent"
        : "Not invoiced"}
    </div>
{(selectedQuote?.chase_count ?? 0) > 0 && (
  <div className="ff-subtleText">
    ⚡ Auto-followed up {selectedQuote?.chase_count} time
    {(selectedQuote?.chase_count ?? 0) > 1 ? "s" : ""}

    {selectedQuote?.last_chased_at && (
      <div style={{ opacity: 0.7, marginTop: 2 }}>
       Last chased {timeAgo(selectedQuote.last_chased_at)}
      </div>
    )}
  </div>
)}
  </div>
</div>



<div className="ff-detailCard">
  <div className="ff-detailSectionTitle">Customer updates</div>
  <div className="ff-detailSub">
    Quick messages that keep the customer warm and protect the job.
  </div>

  <div className="ff-inlineActions" style={{ marginTop: 12 }}>
    <button
      className="ff-btn ff-btnPrimary ff-btnSm"
      type="button"
      onClick={sendOnMyWayMessage}
    >
      🚐 On my way
    </button>

    <button
      className="ff-btn ff-btnGhost ff-btnSm"
      type="button"
      onClick={sendRunningLateMessage}
    >
      ⏰ Running late
    </button>

    <button
      className="ff-btn ff-btnGhost ff-btnSm"
      type="button"
      onClick={sendHappyCheckMessage}
    >
      🙂 Ask if happy
    </button>
  </div>
</div>

      <div className="ff-jobChecklist">
        {jobHealth.map((item) => (
          <div
            key={item.label}
            className={`ff-checkItem ${item.ok ? "isDone" : "isMissing"}`}
          >
            <span className="ff-checkDot">{item.ok ? "✓" : "○"}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

{missingItems.length ? (
  <div className="ff-detailCard ff-warningCard">
    <div className="ff-detailSectionTitle">Needs attention</div>
    <div className="ff-detailSub" style={{ marginBottom: 12 }}>
      Fix these to move the job forward.
    </div>

    <div className="ff-warningList">
      {missingItems.map((item) => (
        <div key={item} className="ff-warningItem ff-warningItemRow">
          <span>{item}</span>

          {item.includes("Private notes") && (
            <button
              className="ff-btn ff-btnGhost ff-btnXs"
              onClick={() => setRightTab("notes")}
            >
              Add now
            </button>
          )}

          {item.includes("booking") && (
            <button
              className="ff-btn ff-btnGhost ff-btnXs"
              onClick={() => setRightTab("schedule")}
            >
              Book now
            </button>
          )}

          {item.includes("description") && (
            <button
              className="ff-btn ff-btnGhost ff-btnXs"
              onClick={() => setRightTab("overview")}
            >
              Add details
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
) : (
  
        <div className="ff-detailCard">
          <div className="ff-detailSectionTitle">Job health</div>
          <div className="ff-detailSub">
            Nothing important is missing. This job looks well organised and ready to move forward.
          </div>
        </div>
      )}




      <div className="ff-detailCard">
        <div className="ff-detailSectionTitle">Customer</div>

        <div className="ff-customerGrid">
          <div className="ff-customerItem">
            <span className="ff-customerLabel">Name</span>
            <strong>
              {nice(titleCase(selectedQuote?.customer_name || selectedRequest?.customer_name))}
            </strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Email</span>
            <strong>
              {nice(selectedQuote?.customer_email || selectedRequest?.customer_email)}
            </strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Phone</span>
            <strong>
              {nice(selectedQuote?.customer_phone || selectedRequest?.customer_phone)}
            </strong>
          </div>

          <div className="ff-customerItem">
            <span className="ff-customerLabel">Address</span>
            <strong>
              {nice(
                selectedQuote?.address ||
                  selectedRequest?.address ||
                  selectedQuote?.postcode ||
                  selectedRequest?.postcode
              )}
            </strong>
          </div>
        </div>
      </div>

      <div className="ff-detailCard">
        <div className="ff-detailSectionTitle">Job details</div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Work description</div>
          <div style={{ minWidth: 0 }}>
            <textarea
              className="ff-textarea"
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              placeholder="Describe the work being carried out…"
            />
          </div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Trader reference</div>
          <div className="ff-detailValue">
            <input
              className="ff-input"
              value={traderRef}
              onChange={(e) => setTraderRef(e.target.value)}
              placeholder="Optional reference"
              style={{ width: "100%", maxWidth: 320 }}
            />
          </div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Subtotal</div>
          <div className="ff-detailValue">
            <input
              className="ff-input"
              inputMode="decimal"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0.00"
              style={{ width: "100%", maxWidth: 220 }}
            />
          </div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">VAT</div>
          <div className="ff-detailValue">
            <div className="ff-inlineActions">
              <button
                type="button"
                className={`ff-pillSmall ${vatRegistered ? "ff-pillNeutralActive" : ""}`}
                onClick={() => {
                  setVatRegistered(true);
                  setVatRate("20");
                }}
              >
                VAT registered
              </button>

              <button
                type="button"
                className={`ff-pillSmall ${!vatRegistered ? "ff-pillNeutralActive" : ""}`}
                onClick={() => {
                  setVatRegistered(false);
                  setVatRate("0");
                }}
              >
                No VAT
              </button>
            </div>
          </div>
        </div>

        <div className="ff-detailRow">
          <div className="ff-detailLabel">Total</div>
          <div className="ff-detailValue">
            {(() => {
              const s = Number(subtotal || 0) || 0;
              const vr = vatRegistered ? Number(vatRate) : 0;
              return `£${(s + s * (vr / 100)).toFixed(2)}`;
            })()}
          </div>
        </div>
      </div>
   
      </>
) : null}


                    {rightTab === "schedule" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailSectionTitle">Schedule</div>
                          <div className="ff-detailSub" style={{ marginBottom: 14 }}>
                            Keep the job date visible and move the job through each stage.
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Booked date</div>
                            <div className="ff-detailValue">
                              {selectedRequest?.job_booked_at
                                ? niceDate(selectedRequest.job_booked_at)
                                : selectedVisit?.starts_at
                                ? niceDate(selectedVisit.starts_at)
                                : "Not booked yet"}
                            </div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Site visit</div>
                            <div className="ff-detailValue">
                              {selectedVisit?.starts_at
                                ? `${niceDate(selectedVisit.starts_at)}${
                                    selectedVisit.duration_mins
                                      ? ` • ${selectedVisit.duration_mins} mins`
                                      : ""
                                  }`
                                : selectedRequest?.site_visit_start
                                ? niceDate(selectedRequest.site_visit_start)
                                : "—"}
                            </div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Current stage</div>
                            <div className="ff-detailValue">
                              {jobStatusChip(
                                selectedQuote,
                                selectedRequest,
                                selectedVisit
                              ).text}
                            </div>
                          </div>

<div className="ff-detailRow">
  <div className="ff-detailLabel">Confirm booking</div>
  <div className="ff-detailValue">
    <input
      type="datetime-local"
      className="ff-input"
      value={bookingDateTime}
      onChange={(e) => setBookingDateTime(e.target.value)}
      style={{ maxWidth: 260 }}
    />
  </div>
</div>

<div className="ff-bookingActions" style={{ marginBottom: 14 }}>
  <button
    type="button"
    className="ff-btn ff-btnPrimary"
    onClick={saveJobBookingDate}
    disabled={notesSaving || !bookingDateTime}
  >
    {notesSaving ? "Saving…" : "Confirm booking"}
  </button>
</div>

                          <div className="ff-bookingActions">
                            {normalizeJobStatus(
                              selectedQuote,
                              selectedRequest,
                              selectedVisit
                            ) === "approved" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnPrimary"
                                onClick={() =>
                                  selectedRequest &&
                                  goToCreateBooking(selectedRequest.id)
                                }
                              >
                                Create booking
                              </button>
                            ) : null}

                           {normalizeJobStatus(
  selectedQuote,
  selectedRequest,
  selectedVisit
) === "booked" ? (
  <button
    type="button"
    className="ff-btn ff-btnGreen"
    onClick={markInProgress}
    disabled={saving}
  >
    Start job
  </button>
) : null}

                            {normalizeJobStatus(
                              selectedQuote,
                              selectedRequest,
                              selectedVisit
                            ) === "in_progress" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnGreen"
                                onClick={markComplete}
                                disabled={saving}
                              >
                                Mark complete
                              </button>
                            ) : null}

                            {normalizeJobStatus(
                              selectedQuote,
                              selectedRequest,
                              selectedVisit
                            ) === "complete" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnGreen"
                                onClick={markInvoiced}
                                disabled={saving}
                              >
                                Mark invoiced
                              </button>
                            ) : null}

                            {normalizeJobStatus(
                              selectedQuote,
                              selectedRequest,
                              selectedVisit
                            ) === "invoiced" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnGreen"
                                onClick={markPaid}
                                disabled={saving}
                              >
                                Mark paid
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="ff-detailCard">
                          <div className="ff-detailSectionTitle">Timeline</div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Enquiry created</div>
                            <div className="ff-detailValue">
                              {niceDate(
                                selectedRequest?.created_at || selectedQuote?.created_at
                              )}
                            </div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Quote created</div>
                            <div className="ff-detailValue">
                              {niceDate(selectedQuote?.created_at)}
                            </div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Job booked</div>
                            <div className="ff-detailValue">
                              {selectedRequest?.job_booked_at
                                ? niceDate(selectedRequest.job_booked_at)
                                : "—"}
                            </div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Status</div>
                            <div className="ff-detailValue">
                              {jobStatusChip(
                                selectedQuote,
                                selectedRequest,
                                selectedVisit
                              ).text}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {rightTab === "files" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailSectionTitle">Files</div>
                          <div className="ff-detailSub" style={{ marginBottom: 14 }}>
                            Review customer uploads and keep your own working files here.
                          </div>

                          <div className="ff-fileHeaderChips">
                            <span className="ff-chip ff-chipBlue">
                              Customer files {custFiles.length}
                            </span>
                            <span className="ff-chip ff-chipGray">
                              Trader files {traderFiles.length}
                            </span>
                          </div>

                          {fileMsg ? <div className="ff-fileMsg">{fileMsg}</div> : null}

                          <div className="ff-fileSection">
                            <div className="ff-detailLabel" style={{ marginBottom: 10 }}>
                              Customer files
                            </div>

                            {filesLoading ? (
                              <div className="ff-loadingText">Loading files…</div>
                            ) : custFiles.length ? (
                              <div className="ff-fileGrid">
                                {custFiles.map((file) => {
                                  const isImage = isImageFile(file.name);

                                  return (
                                    <a
                                      key={file.path}
                                      href={file.url || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ff-fileTile"
                                    >
                                      {isImage && file.url ? (
                                        <img
                                          src={file.url}
                                          alt={file.name}
                                          className="ff-fileThumb"
                                        />
                                      ) : (
                                        <div className="ff-fileFallback">
                                          {fileTypeLabel(file.name)}
                                        </div>
                                      )}

                                      <div className="ff-fileTileBody">
                                        <div className="ff-fileName">{file.name}</div>
                                        <div className="ff-fileMeta">
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
                              <div className="ff-loadingText">No customer files yet.</div>
                            )}
                          </div>

                          <div className="ff-fileSection">
                            <div className="ff-detailLabel" style={{ marginBottom: 10 }}>
                              Upload trader files
                            </div>

                            <div className="ff-inlineActions" style={{ marginBottom: 10 }}>
                              <select
                                className="ff-input"
                                value={traderFileLabel}
                                onChange={(e) => setTraderFileLabel(e.target.value)}
                                style={{ maxWidth: 220 }}
                              >
                                {TRADER_FILE_LABELS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.text}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <input
                              type="file"
                              multiple
                              onChange={onUploadTraderFiles}
                              disabled={uploading || !selectedRequest}
                              className="ff-input"
                              style={{ width: "100%" }}
                            />

                            <div className="ff-detailSub" style={{ marginTop: 8 }}>
                              Upload photos, parts lists, manuals, invoices or working files for this job.
                            </div>
                          </div>

                          <div className="ff-fileSection">
                            <div className="ff-detailLabel" style={{ marginBottom: 10 }}>
                              Trader files
                            </div>

                            {filesLoading ? (
                              <div className="ff-loadingText">Loading files…</div>
                            ) : traderFiles.length ? (
                              <div className="ff-uploadedList">
                                {traderFiles.map((file) => (
                                  <div key={file.path} className="ff-uploadedRow">
                                    <div className="ff-uploadedInfo">
                                      <div className="ff-fileName">{file.name}</div>
                                      <div className="ff-fileMeta">
                                        <span>{fileTypeLabel(file.name)}</span>
                                        {file.label ? (
                                          <span>{labelText(file.label)}</span>
                                        ) : null}
                                        {file.size ? (
                                          <span>{prettyFileSize(file.size)}</span>
                                        ) : null}
                                        {file.created_at ? (
                                          <span>{niceDate(file.created_at)}</span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="ff-uploadedActions">
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
                              <div className="ff-loadingText">
                                No trader files uploaded yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {rightTab === "messages" ? (
                      <div className="ff-chatWrap">
                        <div className="ff-chatTop">
                          <div>
                            <div className="ff-detailSectionTitle">
                              Customer messages
                            </div>
                            <div className="ff-detailSub">
                              Keep the full customer conversation attached to the
                              job.
                            </div>
                          </div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  <button
    className="ff-btn ff-btnPrimary ff-btnSm"
    type="button"
    onClick={sendOnMyWayMessage}
  >
    🚐 On my way
  </button>
<button
  className="ff-btn ff-btnGhost ff-btnSm"
  type="button"
  onClick={sendRunningLateMessage}
>
  ⏰ Running late
</button>
<button
  className="ff-btn ff-btnGhost ff-btnSm"
  type="button"
  onClick={sendHappyCheckMessage}
>
  🙂 Ask if happy
</button>

  <button
    className="ff-btn ff-btnGhost ff-btnSm"
    type="button"
    onClick={logCallOnCurrentJob}
  >
    + Log call
  </button>

  <button
    className="ff-btn ff-btnGhost ff-btnSm"
    type="button"
    onClick={() =>
      uid &&
      selectedRequest &&
      loadThread(selectedRequest.id, uid)
    }
    disabled={threadLoading}
  >
    {threadLoading ? "Loading…" : "Refresh"}
  </button>
</div>
                        </div>

                        <div className="ff-chatBody">
                          {threadLoading ? (
                            <div className="ff-loadingText">Loading messages…</div>
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
{isPhone && (
  <div className="ff-chatEventTag">
    📞 Call logged
  </div>
)}
                                    {m.subject ? (
                                      <div className="ff-chatSubject">
                                        {m.subject}
                                      </div>
                                    ) : null}

                                    <div className="ff-chatText">
                                      {body || "—"}
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <EmptyState
                              title="No messages yet"
                              sub="Send your first update to the customer from here."
                            />
                          )}
                        </div>

                        <div className="ff-chatComposer">
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
                            {quickReplies.map((text) => (
                              <button
                                key={text}
                                type="button"
                                className="ff-quickReplyBtn"
                                onClick={() =>
                                  setReplyBody((prev) =>
                                    insertReplyText(prev, text)
                                  )
                                }
                              >
                                {text}
                              </button>
                            ))}
                          </div>

                          <textarea
                            className="ff-chatInput"
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder="Write your message to the customer…"
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

                              <button
                                className="ff-btn ff-btnPrimary ff-btnSm"
                                type="button"
                                onClick={sendReply}
                                disabled={
                                  !replyTo.trim() || !replyBody.trim()
                                }
                              >
                                Send message
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {rightTab === "notes" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailSectionTitle">Private notes</div>
                          <div className="ff-detailSub" style={{ marginBottom: 12 }}>
                            Keep internal notes, access info, materials,
                            reminders and anything the customer should not see.
                          </div>

                          <textarea
                            className="ff-textarea"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Private notes for this job…"
                          />

                          <div className="ff-noteFoot">
                            <button
                              className="ff-btn ff-btnGhost ff-btnSm"
                              type="button"
                              onClick={() => setNotes("")}
                            >
                              Clear
                            </button>

                            <button
                              className="ff-btn ff-btnPrimary ff-btnSm"
                              type="button"
                              onClick={saveNotes}
                              disabled={notesSaving}
                            >
                              {notesSaving ? "Saving…" : "Save notes"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {rightTab === "documents" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailSectionTitle">
                            Completion documents
                          </div>
                          <div className="ff-detailSub" style={{ marginBottom: 14 }}>
                            Store certificates, warranties, manuals, handover
                            files and final paperwork.
                          </div>

                          <div className="ff-fileHeaderChips">
                            <span className="ff-chip ff-chipBlue">
                              Documents {jobDocs.length}
                            </span>
                          </div>

                          {docsMsg ? <div className="ff-fileMsg">{docsMsg}</div> : null}

                          <div className="ff-fileSection">
                            <div className="ff-detailLabel" style={{ marginBottom: 10 }}>
                              Upload completion documents
                            </div>

                            <div className="ff-inlineActions" style={{ marginBottom: 10 }}>
                              <select
                                className="ff-input"
                                value={docLabel}
                                onChange={(e) => setDocLabel(e.target.value)}
                                style={{ maxWidth: 220 }}
                              >
                                {DOCUMENT_LABELS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.text}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <input
                              type="file"
                              multiple
                              onChange={onUploadJobDocs}
                              disabled={docsUploading || !selectedRequest}
                              className="ff-input"
                              style={{ width: "100%" }}
                            />

                            <div className="ff-detailSub" style={{ marginTop: 8 }}>
                              Upload gas certs, warranties, manuals, invoices and
                              handover documents.
                            </div>
                          </div>

                          <div className="ff-fileSection">
                            <div className="ff-detailLabel" style={{ marginBottom: 10 }}>
                              Saved documents
                            </div>

                            {docsLoading ? (
                              <div className="ff-loadingText">
                                Loading documents…
                              </div>
                            ) : jobDocs.length ? (
                              <div className="ff-uploadedList">
                                {jobDocs.map((file) => (
                                  <div key={file.path} className="ff-uploadedRow">
                                    <div className="ff-uploadedInfo">
                                      <div className="ff-fileName">{file.name}</div>
                                      <div className="ff-fileMeta">
                                        <span>{fileTypeLabel(file.name)}</span>
                                        {file.label ? (
                                          <span>{labelText(file.label)}</span>
                                        ) : null}
                                        {file.size ? (
                                          <span>{prettyFileSize(file.size)}</span>
                                        ) : null}
                                        {file.created_at ? (
                                          <span>{niceDate(file.created_at)}</span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="ff-uploadedActions">
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
                                        onClick={() => deleteJobDoc(file.path)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="ff-loadingText">
                                No completion documents yet.
                              </div>
                            )}
                          </div>

                          <div className="ff-bookingActions">
                            {normalizeJobStatus(
                              selectedQuote,
                              selectedRequest,
                              selectedVisit
                            ) === "complete" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnGreen"
                                onClick={markInvoiced}
                                disabled={saving}
                              >
                                Mark invoiced
                              </button>
                            ) : null}

                            {normalizeJobStatus(
                              selectedQuote,
                              selectedRequest,
                              selectedVisit
                            ) === "invoiced" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnGreen"
                                onClick={markPaid}
                                disabled={saving}
                              >
                                Mark paid
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div ref={detailBottomRef} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
{confirmModal ? (
  <div className="ff-modalOverlay" onMouseDown={() => setConfirmModal(null)}>
    <div className="ff-modal ff-confirmModal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="ff-modalHead">
        <div className="ff-modalTitle">{confirmModal.title}</div>
        <button
          type="button"
          className="ff-x"
          onClick={() => setConfirmModal(null)}
        >
          ✕
        </button>
      </div>

      <div className="ff-modalBody">
        <p className="ff-confirmText">{confirmModal.message}</p>

        <div className="ff-confirmActions">
          <button
            type="button"
            className="ff-btn ff-btnGhost"
            onClick={() => setConfirmModal(null)}
          >
            Cancel
          </button>

          <button
            type="button"
            className={`ff-btn ${confirmModal.danger ? "ff-btnDanger" : "ff-btnPrimary"}`}
            onClick={confirmModal.onConfirm}
          >
            {confirmModal.confirmText}
          </button>
        </div>
      </div>
    </div>
  </div>
) : null}
      {expandedMsg ? (
        <div className="ff-modalOverlay" onMouseDown={() => setExpandedMsg(null)}>
          <div className="ff-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="ff-modalHead">
              <div className="ff-modalTitle">{expandedMsg.subject || "Message"}</div>
              <button
                type="button"
                className="ff-x"
                onClick={() => setExpandedMsg(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="ff-modalBody">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, color: FF.muted, fontWeight: 700 }}>
                  {expandedMsg.from_email ? `From: ${expandedMsg.from_email}` : ""}
                  {expandedMsg.from_email && expandedMsg.to_email ? " • " : ""}
                  {expandedMsg.to_email ? `To: ${expandedMsg.to_email}` : ""}
                </div>

                <div style={{ fontSize: 12, color: FF.muted }}>
                  {expandedMsg.created_at ? niceDate(expandedMsg.created_at) : ""}
                </div>

                <div className="ff-expandedMsgBody">
                  {(expandedMsg.body_text ?? "").trim() || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
{callModalOpen ? (
  <div className="ff-modalOverlay" onMouseDown={() => setCallModalOpen(false)}>
    <div className="ff-modal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="ff-modalHead">
        <div className="ff-modalTitle">Log phone call</div>
        <button
          type="button"
          className="ff-x"
          onClick={() => setCallModalOpen(false)}
        >
          ✕
        </button>
      </div>

      <div className="ff-modalBody">
        <select
          className="ff-input"
          value={callOutcome}
          onChange={(e) => setCallOutcome(e.target.value)}
          style={{ marginBottom: 12 }}
        >
          <option>Confirmed job</option>
          <option>Running late</option>
          <option>Issue</option>
          <option>General</option>
        </select>

        <textarea
          className="ff-textarea"
          placeholder="Call notes…"
          value={callNote}
          onChange={(e) => setCallNote(e.target.value)}
        />

        <div className="ff-confirmActions">
          <button
            className="ff-btn ff-btnGhost"
            onClick={() => setCallModalOpen(false)}
          >
            Cancel
          </button>

<button
  className="ff-btn ff-btnPrimary ff-btnSm"
  onClick={submitCallLog}
  disabled={!callNote.trim()}
>
  Save call
</button>
        </div>
      </div>
    </div>
  </div>
) : null}
  
    </>
  );
}
