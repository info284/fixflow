"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import "../enquiries/enquiries.css";

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
  created_at: string;
  trader_notes: string | null;

  calendar_html_link: string | null;
  site_visit_start: string | null;

  job_booked_at: string | null;
  job_calendar_html_link: string | null;
  lost_reason?: string | null;
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

type ToastState = {
  text: string;
  type?: "success" | "error";
} | null;

/* ================================
   DESIGN CONSTS
================================ */




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
    return { text: "ASAP", cls: "ff-chip ff-chipRed" };
  }

  if (v.includes("this week") || v.includes("this-week")) {
    return { text: "This week", cls: "ff-chip ff-chipAmber" };
  }

  if (v.includes("next week") || v.includes("next-week")) {
    return { text: "Next week", cls: "ff-chip ff-chipGreen" };
  }

  return { text: "Flexible", cls: "ff-chip ff-chipBlue" };
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
      cls: "ff-chip ff-chipBlue",
    };
  }

  return null;
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

  if (s === "paid") return { text: "Paid", cls: "ff-chip ff-chipGreen" };
  if (s === "invoiced") return { text: "Invoiced", cls: "ff-chip ff-chipBlue" };
  if (s === "complete") return { text: "Complete", cls: "ff-chip ff-chipGreen" };
  if (s === "in_progress") {
    return { text: "In progress", cls: "ff-chip ff-chipBlue" };
  }
  if (s === "booked") return { text: "Booked", cls: "ff-chip ff-chipGreen" };

  return { text: "Approved", cls: "ff-chip ff-chipAmber" };
}

function getStageIndex(
  quote?: QuoteRow | null,
  request?: QuoteRequestRow | null,
  visit?: SiteVisitRow | null
) {
  const s = normalizeJobStatus(quote, request, visit);

  if (s === "paid") return 5;
  if (s === "invoiced") return 4;
  if (s === "complete") return 3;
  if (s === "in_progress") return 2;
  if (s === "booked") return 1;
  return 0;
}

function getNextAction(
  quote?: QuoteRow | null,
  request?: QuoteRequestRow | null,
  visit?: SiteVisitRow | null
) {
  const s = normalizeJobStatus(quote, request, visit);

  if (s === "paid") {
    return {
      title: "Job closed",
      text: "This job is complete and paid. Keep documents, notes and files here for future reference.",
    };
  }

  if (s === "invoiced") {
    return {
      title: "Await payment",
      text: "The invoice has gone out. The next step is payment and then the job can be fully closed.",
    };
  }

  if (s === "complete") {
    return {
      title: "Mark invoiced",
      text: "The work is complete. Upload any final documents and move this job to invoiced.",
    };
  }

  if (s === "in_progress") {
    return {
      title: "Mark complete",
      text: "The job is underway. Keep notes, files and customer updates here until the work is finished.",
    };
  }

  if (s === "booked") {
    return {
      title: "Start job",
      text: "This job is booked in. Use this page to manage the visit, files, notes and customer communication.",
    };
  }

  return {
    title: "Create booking",
    text: "This work has been approved but not booked in yet. Add a confirmed date so it moves properly into the live workflow.",
  };
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

function stageItemsForJobs() {
  return [
    "Approved",
    "Booked",
    "In progress",
    "Complete",
    "Invoiced",
    "Paid",
  ];
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

  const quoteIdParam = cleanId(sp.get("quoteId"));
  const requestIdParam = cleanId(sp.get("requestId"));

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{
    text: string;
    type?: "success" | "error";
  } | null>(null);

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [requestMap, setRequestMap] = useState<Record<string, QuoteRequestRow | null>>(
    {}
  );
  const [visitMap, setVisitMap] = useState<Record<string, SiteVisitRow | null>>({});
  const [threadMap, setThreadMap] = useState<Record<string, EnquiryMessageRow[]>>({});

  const [selectedQuoteIdState, setSelectedQuoteIdState] = useState<string | null>(
    quoteIdParam || null
  );
  const selectedQuoteId = quoteIdParam || selectedQuoteIdState;

  const [statusFilter, setStatusFilter] = useState<
    "" | "approved" | "booked" | "in_progress" | "complete" | "invoiced" | "paid"
  >("");
  const [postcodeFilter, setPostcodeFilter] = useState("");

  const [rightTab, setRightTab] = useState<JobTab>("overview");

  const [thread, setThread] = useState<EnquiryMessageRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState<EnquiryMessageRow | null>(null);

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

  const selectedQuote = useMemo(() => {
    if (!selectedQuoteId) return null;
    return quotes.find((q) => q.id === selectedQuoteId) ?? null;
  }, [quotes, selectedQuoteId]);

  const selectedRequest = useMemo(() => {
    if (!selectedQuote) return null;
    const rid = cleanId(selectedQuote.request_id);
    return requestMap[rid] || null;
  }, [selectedQuote, requestMap]);

  const selectedVisit = useMemo(() => {
    if (!selectedRequest) return null;
    return visitMap[selectedRequest.id] || null;
  }, [selectedRequest, visitMap]);

  const selectedStatusChip = selectedQuote
    ? jobStatusChip(selectedQuote, selectedRequest, selectedVisit)
    : null;

  const currentStage = selectedQuote
    ? getStageIndex(selectedQuote, selectedRequest, selectedVisit)
    : 0;

  const nextAction = selectedQuote
    ? getNextAction(selectedQuote, selectedRequest, selectedVisit)
    : { title: "", text: "" };

  const stageItems = useMemo(() => stageItemsForJobs(), []);

  function pushToast(text: string, type: "success" | "error" = "success") {
    setToast({ text, type });
    window.clearTimeout((pushToast as any)._t);
    (pushToast as any)._t = window.setTimeout(() => setToast(null), 2400);
  }

async function loadQuotesForTrader(plumberId: string) {
  const { data: requestData, error: requestError } = await supabase
    .from("quote_requests")
    .select(
      "id,job_number,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,status,stage,created_at,trader_notes,calendar_html_link,site_visit_start,job_booked_at,job_calendar_html_link"
    )
 .eq("plumber_id", plumberId)
.eq("stage", "won")
.order("created_at", { ascending: false });

  if (requestError) {
    setQuotes([]);
    setRequestMap({});
    pushToast(`Load failed: ${requestError.message}`, "error");
    return;
  }

  const requests = (requestData || []) as QuoteRequestRow[];
  const requestIds = requests.map((r) => r.id);

  const requestMapData: Record<string, QuoteRequestRow | null> = {};
  requests.forEach((r) => {
    requestMapData[r.id] = r;
  });
  setRequestMap(requestMapData);

  if (!requestIds.length) {
    setQuotes([]);
    setVisitMap({});
    setThreadMap({});
    return;
  }

  const { data: quoteData, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id,plumber_id,request_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,vat_rate,subtotal,note,job_details,trader_ref,status,sent_at,created_at"
    )
    .eq("plumber_id", plumberId)
    .in("request_id", requestIds)
    .order("created_at", { ascending: false });

  if (quoteError) {
    console.error("Quote load failed:", quoteError);
  }

  const quoteRows = (quoteData || []) as QuoteRow[];

  const quoteMap = new Map<string, QuoteRow>();
  for (const q of quoteRows) {
    if (q.request_id && !quoteMap.has(q.request_id)) {
      quoteMap.set(q.request_id, q);
    }
  }

  const mergedQuotes: QuoteRow[] = requests.map((request) => {
    const existingQuote = quoteMap.get(request.id);

    if (existingQuote) return existingQuote;

    return {
      id: `request-${request.id}`,
      plumber_id: request.plumber_id,
      request_id: request.id,
      customer_name: request.customer_name,
      customer_email: request.customer_email,
      customer_phone: request.customer_phone,
      postcode: request.postcode,
      address: request.address,
      job_type: request.job_type,
      urgency: request.urgency,
      vat_rate: null,
      subtotal: null,
      note: null,
      job_details: request.details,
      trader_ref: null,
      status: request.status || "booked",
      sent_at: null,
      created_at: request.created_at,
    };
  });

  setQuotes(mergedQuotes);

  await Promise.all([
    loadSiteVisitMap(plumberId, requestIds),
    loadThreadMapForRows(requestIds, plumberId),
  ]);
}

  async function loadRequests(plumberId: string, requestIds: string[]) {
    if (!requestIds.length) {
      setRequestMap({});
      return;
    }

    const { data, error } = await supabase
      .from("quote_requests")
      .select(
        "id,job_number,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,status,created_at,trader_notes,calendar_html_link,site_visit_start,job_booked_at,job_calendar_html_link"
      )
      .eq("plumber_id", plumberId)
      .in("id", requestIds);

    if (error) {
      console.error(error);
      return;
    }

    const map: Record<string, QuoteRequestRow | null> = {};
    requestIds.forEach((id) => {
      map[id] = null;
    });

    (data || []).forEach((row) => {
      const r = row as QuoteRequestRow;
      map[r.id] = r;
    });

    setRequestMap(map);
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

    (data || []).forEach((v: any) => {
      if (!map[v.request_id]) map[v.request_id] = v as SiteVisitRow;
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
  if (!uid) return;

  setFilesLoading(true);
  setFileMsg(null);

  try {
    const [customerItems, traderStorageItems, traderDb] = await Promise.all([
      listFolderFiles(customerFolder(requestId)),
      listFolderFiles(traderFolder(requestId)),
      supabase
        .from("job_files")
        .select("path, file_name, label, created_at")
        .eq("request_id", requestId)
        .eq("plumber_id", uid)
        .eq("area", "trader")
        .order("created_at", { ascending: false }),
    ]);

    setCustFiles(customerItems.map((f) => ({ ...f, area: "customer" })));

    if (traderDb.error) throw traderDb.error;

    const traderByPath = new Map(
      (traderDb.data || []).map((row) => [row.path, row])
    );

    setTraderFiles(
      traderStorageItems.map((f) => {
        const meta = traderByPath.get(f.path);
        return {
          ...f,
          area: "trader" as const,
          label: meta?.label || "other",
          created_at: meta?.created_at || f.created_at || null,
          name: meta?.file_name || f.name,
        };
      })
    );
  } catch (e) {
    console.error(e);
    setFileMsg("Couldn’t load files");
  }

  setFilesLoading(false);
}

async function loadDocuments(requestId: string) {
  if (!uid) return;

  setDocsLoading(true);
  setDocsMsg(null);

  try {
    const [docStorageItems, docDb] = await Promise.all([
      listFolderFiles(docsFolder(requestId)),
      supabase
        .from("job_files")
        .select("path, file_name, label, created_at")
        .eq("request_id", requestId)
        .eq("plumber_id", uid)
        .eq("area", "documents")
        .order("created_at", { ascending: false }),
    ]);

    if (docDb.error) throw docDb.error;

    const docsByPath = new Map(
      (docDb.data || []).map((row) => [row.path, row])
    );

    setJobDocs(
      docStorageItems.map((f) => {
        const meta = docsByPath.get(f.path);
        return {
          ...f,
          area: "documents" as const,
          label: meta?.label || "other",
          created_at: meta?.created_at || f.created_at || null,
          name: meta?.file_name || f.name,
        };
      })
    );
  } catch (e) {
    console.error(e);
    setDocsMsg("Couldn’t load documents");
  }

  setDocsLoading(false);
}

  function openJob(quoteId: string) {
    setSelectedQuoteIdState(quoteId);
    setRightTab("overview");
    router.replace(`/dashboard/bookings?quoteId=${encodeURIComponent(quoteId)}`);
  }

  function backToListMobile() {
    setSelectedQuoteIdState(null);
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

    setQuotes((prev) =>
      prev.map((q) =>
        q.id === selectedQuote.id
          ? {
              ...q,
              trader_ref: patch.trader_ref,
              job_details: patch.job_details,
              vat_rate: patch.vat_rate,
              subtotal: patch.subtotal,
            }
          : q
      )
    );

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

  async function updateJobStatus(nextStatus: string, okText: string) {
    if (!uid || !selectedQuote) return;

    const { error } = await supabase
      .from("quotes")
      .update({ status: nextStatus })
      .eq("id", selectedQuote.id)
      .eq("plumber_id", uid);

    if (error) {
      pushToast(`Update failed: ${error.message}`, "error");
      return;
    }

    setQuotes((prev) =>
      prev.map((q) => (q.id === selectedQuote.id ? { ...q, status: nextStatus } : q))
    );

    pushToast(okText);
  }

  async function markInProgress() {
    await updateJobStatus("in progress", "Job marked in progress");
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
    router.push(`/dashboard/bookings?requestId=${encodeURIComponent(requestId)}`);
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
    if (!selectedRequest || !uid || !e.target.files?.length) return;

    setUploading(true);
    setFileMsg(null);

try {
  for (const file of Array.from(e.target.files)) {
    const path = `${traderFolder(selectedRequest.id)}/${Date.now()}-${safeFileName(
      file.name
    )}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase.from("job_files").insert({
      request_id: selectedRequest.id,
      plumber_id: uid,
      path,
      file_name: file.name,
      area: "trader",
      label: traderFileLabel,
    });

    if (dbError) throw dbError;
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
   if (!selectedRequest || !uid || !e.target.files?.length) return;

    setDocsUploading(true);
    setDocsMsg(null);

   try {
  for (const file of Array.from(e.target.files)) {
    const path = `${docsFolder(selectedRequest.id)}/${Date.now()}-${safeFileName(
      file.name
    )}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase.from("job_files").insert({
      request_id: selectedRequest.id,
      plumber_id: uid,
      path,
      file_name: file.name,
      area: "documents",
      label: docLabel,
    });

    if (dbError) throw dbError;
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

  const ok = window.confirm("Delete this file?");
  if (!ok) return;

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);

  if (storageError) {
    console.error(storageError);
    pushToast("Couldn’t delete file", "error");
    return;
  }

  const { error: dbError } = await supabase
    .from("job_files")
    .delete()
    .eq("request_id", selectedRequest.id)
    .eq("plumber_id", uid)
    .eq("path", path)
    .eq("area", "trader");

  if (dbError) {
    console.error(dbError);
    pushToast("File deleted from storage, but metadata delete failed", "error");
    return;
  }

  await loadFiles(selectedRequest.id);
  pushToast("File deleted");
}

async function deleteJobDoc(path: string) {
  if (!selectedRequest || !uid) return;

  const ok = window.confirm("Delete this document?");
  if (!ok) return;

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);

  if (storageError) {
    console.error(storageError);
    pushToast("Couldn’t delete document", "error");
    return;
  }

  const { error: dbError } = await supabase
    .from("job_files")
    .delete()
    .eq("request_id", selectedRequest.id)
    .eq("plumber_id", uid)
    .eq("path", path)
    .eq("area", "documents");

  if (dbError) {
    console.error(dbError);
    pushToast("Document deleted from storage, but metadata delete failed", "error");
    return;
  }

  await loadDocuments(selectedRequest.id);
  pushToast("Document deleted");
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
          subject: replySubject.trim() || `Re: ${selectedQuote?.job_type || "Your job"}`,
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
  if (!uid || !selectedQuote) return;

  const ok = window.confirm("Delete this job?");
  if (!ok) return;

  const requestId = cleanId(selectedQuote.request_id);

  const { error: quoteError } = await supabase
    .from("quotes")
    .delete()
    .eq("id", selectedQuote.id)
    .eq("plumber_id", uid);

  if (quoteError) {
    pushToast(`Delete failed: ${quoteError.message}`, "error");
    return;
  }

  if (requestId) {
    const { error: requestError } = await supabase
      .from("quote_requests")
      .update({
        stage: "archived",
        status: "deleted",
      })
      .eq("id", requestId)
      .eq("plumber_id", uid);

    if (requestError) {
      pushToast(`Quote deleted but request update failed: ${requestError.message}`, "error");
      return;
    }
  }

  setQuotes((prev) => prev.filter((q) => q.id !== selectedQuote.id));
  backToListMobile();
  pushToast("Job deleted");
}

  useEffect(() => {
    setSelectedQuoteIdState(quoteIdParam || null);
  }, [quoteIdParam]);

useEffect(() => {
  if (!requestIdParam || !quotes.length) return;

  const matchedQuote = quotes.find(
    (q) => cleanId(q.request_id) === requestIdParam
  );

  if (matchedQuote) {
    setSelectedQuoteIdState(matchedQuote.id);
  }
}, [requestIdParam, quotes]);

useEffect(() => {
  let mounted = true;
  let chQuotes: ReturnType<typeof supabase.channel> | null = null;
  let chRequests: ReturnType<typeof supabase.channel> | null = null;

  (async () => {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    if (!mounted) return;
    setUid(userId);

    if (!userId) {
      setLoading(false);
      pushToast("Please log in.", "error");
      return;
    }

    await loadQuotesForTrader(userId);

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
        () => loadQuotesForTrader(userId)
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
        () => loadQuotesForTrader(userId)
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
    if (!selectedQuote) return;

    setWorkDescription(selectedQuote.job_details || "");
    setTraderRef(selectedQuote.trader_ref || "");
    setSubtotal(selectedQuote.subtotal != null ? String(selectedQuote.subtotal) : "");
    setVatRegistered(Number(selectedQuote.vat_rate || 0) > 0);
    setVatRate(Number(selectedQuote.vat_rate || 0) > 0 ? "20" : "0");
  }, [selectedQuote?.id]);

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

    const visibleQuotes = useMemo(() => {
    let list = [...quotes];

    if (statusFilter) {
      list = list.filter((q) => {
        const request = requestMap[cleanId(q.request_id)] || null;
        const visit = request ? visitMap[request.id] || null : null;
        return normalizeJobStatus(q, request, visit) === statusFilter;
      });
    }

    if (postcodeFilter.trim()) {
      const needle = postcodeFilter.trim().toLowerCase();
      list = list.filter((q) =>
        `${q.postcode || ""} ${q.address || ""}`.toLowerCase().includes(needle)
      );
    }

    return list;
  }, [quotes, statusFilter, postcodeFilter, requestMap, visitMap]);

  const sortedQuotes = useMemo(() => {
    return [...visibleQuotes].sort((a, b) => {
      const aSelected = a.id === selectedQuoteId;
      const bSelected = b.id === selectedQuoteId;

      if (aSelected !== bSelected) return aSelected ? -1 : 1;

      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();

      if (Number.isNaN(da) && Number.isNaN(db)) return 0;
      if (Number.isNaN(da)) return 1;
      if (Number.isNaN(db)) return -1;

      return db - da;
    });
  }, [visibleQuotes, selectedQuoteId]);

  const counts = useMemo(() => {
    const all = quotes.length;

    const approved = quotes.filter((q) => {
      const request = requestMap[cleanId(q.request_id)] || null;
      const visit = request ? visitMap[request.id] || null : null;
      return normalizeJobStatus(q, request, visit) === "approved";
    }).length;

    const booked = quotes.filter((q) => {
      const request = requestMap[cleanId(q.request_id)] || null;
      const visit = request ? visitMap[request.id] || null : null;
      return normalizeJobStatus(q, request, visit) === "booked";
    }).length;

    const live = quotes.filter((q) => {
      const request = requestMap[cleanId(q.request_id)] || null;
      const visit = request ? visitMap[request.id] || null : null;
      const s = normalizeJobStatus(q, request, visit);
      return s === "in_progress" || s === "complete";
    }).length;

    const paid = quotes.filter((q) => {
      const request = requestMap[cleanId(q.request_id)] || null;
      const visit = request ? visitMap[request.id] || null : null;
      return normalizeJobStatus(q, request, visit) === "paid";
    }).length;

    return { all, approved, booked, live, paid };
  }, [quotes, requestMap, visitMap]);

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

  const missingItems = useMemo(() => {
    return getMissingItems({
      quote: selectedQuote,
      request: selectedRequest,
      visit: selectedVisit,
      traderFiles,
      jobDocs,
    });
  }, [selectedQuote, selectedRequest, selectedVisit, traderFiles, jobDocs]);

  
  const isMobileDetail = !!selectedQuote;

return (
  <>
    <div className="ff-page" data-mobile-detail={isMobileDetail ? "1" : "0"}>
      <div className="ff-wrap">
        <div className="ff-top">
          <div className="ff-hero">
            <div className="ff-heroGlow" />

            <div className="ff-heroRow">
              <div className="ff-heroLeft">
                <div className="ff-heroTitle">Jobs</div>
                <div className="ff-heroRule" />
                <div className="ff-heroSub">
                  Manage booked work, customer updates, files, notes and completion
                  documents in one place.
                </div>
              </div>

              <div className="ff-heroStats">
                <div className="ff-statCard">
                  <div className="ff-statLabel">All</div>
                  <div className="ff-statValue">{counts.all}</div>
                </div>
                <div className="ff-statCard">
                  <div className="ff-statLabel">Booked</div>
                  <div className="ff-statValue">{counts.booked}</div>
                </div>
                <div className="ff-statCard">
                  <div className="ff-statLabel">Live</div>
                  <div className="ff-statValue">{counts.live}</div>
                </div>
                <div className="ff-statCard">
                  <div className="ff-statLabel">Paid</div>
                  <div className="ff-statValue">{counts.paid}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {toast ? (
          <div className={`ff-toast ${toast.type === "error" ? "ff-toastError" : "ff-toastSuccess"}`}>
            {toast.text}
          </div>
        ) : null}

        <div className={`ff-mainShell ${selectedQuote ? "hasSelection" : ""}`}>
          <div className="ff-leftPane">
            <div className="ff-leftTop">
              <div className="ff-leftTitle">All jobs</div>

              <div className="ff-leftFilters">
                <div className="ff-segmented">
                  {[
                    ["", "All"],
                    ["booked", "Booked"],
                    ["in_progress", "Live"],
                    ["complete", "Complete"],
                    ["invoiced", "Invoiced"],
                    ["paid", "Paid"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`ff-segBtn ${statusFilter === value ? "isActive" : ""}`}
                      onClick={() => setStatusFilter(value as typeof statusFilter)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <input
                  className="ff-input"
                  placeholder="Search postcode / area"
                  value={postcodeFilter}
                  onChange={(e) => setPostcodeFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="ff-leftList">
              {loading ? (
                <div className="ff-loadingWrap">
                  <div className="ff-loadingText">Loading jobs…</div>
                </div>
              ) : sortedQuotes.length ? (
                sortedQuotes.map((q) => {
                  const active = q.id === selectedQuoteId;
                  const request = requestMap[cleanId(q.request_id)] || null;
                  const visit = request ? visitMap[request.id] || null : null;
                  const status = jobStatusChip(q, request, visit);
                  const urgency = urgencyChip(q.urgency || request?.urgency);
                  const requestId = cleanId(q.request_id);
                  const messages = requestId ? threadMap[requestId] || [] : [];
                  const hasUnread = hasIncomingReply(messages);
                  const state = normalizeJobStatus(q, request, visit);

                  return (
                    <button
                      key={q.id}
                      ref={active ? activeRowRef : null}
                      type="button"
                      className={`ff-leftItem ${active ? "isActive" : ""} ${getUrgencyGlowClass(q.urgency || request?.urgency)}`}
                      onClick={() => openJob(q.id)}
                    >
                      <div className="ff-leftItemTop">
                        <div className="ff-leftJobWrap">
                          <div className="ff-jobNumber">
                            {request?.job_number || `FF-${q.id.slice(0, 4).toUpperCase()}`}
                            {hasUnread ? <span className="ff-unreadDot" /> : null}
                          </div>
                          <div className="ff-leftDate">{niceDateOnly(q.created_at)}</div>
                        </div>

                        <div className="ff-leftChipRow">
                          <span className={urgency.cls}>{urgency.text}</span>
                          <span className={status.cls}>{status.text}</span>
                        </div>
                      </div>

                      <div className="ff-leftMain">
                        <div className="ff-leftJobTitle">
                          {titleCase(q.job_type || request?.job_type || "Job")}
                        </div>
                        <div className="ff-leftCustomer">
                          {titleCase(q.customer_name || request?.customer_name || "Customer")}
                        </div>
                        <div className="ff-leftAddress">
                          {q.address ||
                            request?.address ||
                            formatPostcode(q.postcode || request?.postcode) ||
                            "No address"}
                        </div>
                      </div>

                      <div className="ff-leftMetaRow">
                        <div className="ff-leftMetaText">{money(q.subtotal)}</div>
                        <div className="ff-leftMetaText">
                          {visit?.starts_at
                            ? niceDate(visit.starts_at)
                            : request?.job_booked_at
                            ? niceDate(request.job_booked_at)
                            : "Not booked yet"}
                        </div>
                      </div>

                      <div
                        className={`ff-leftHint ${
                          state === "booked" || state === "paid"
                            ? "ff-leftHintGreen"
                            : state === "complete" || state === "invoiced"
                            ? "ff-leftHintBlue"
                            : "ff-leftHintAmber"
                        }`}
                      >
                        {state === "paid"
                          ? "Job paid"
                          : state === "invoiced"
                          ? "Awaiting payment"
                          : state === "complete"
                          ? "Ready for invoice"
                          : state === "in_progress"
                          ? "Job in progress"
                          : state === "booked"
                          ? "Booked and ready"
                          : "Needs booking"}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="ff-emptyWrap">
                  <EmptyState title="No jobs found" sub="Booked jobs will appear here." />
                </div>
              )}
            </div>
          </div>

<div className="ff-rightPane">
  {!selectedQuote ? (
    <div className="ff-emptyWrap">
      <EmptyState title="Select a job" sub="Pick a job from the list to manage it." />
    </div>
  ) : (
    <div className="ff-rightInner">
      <button type="button" className="ff-backBtn ff-backBtnMobile" onClick={backToListMobile}>
        ← Back
      </button>

      <div className="ff-rightTop">
        <div className="ff-rightTopLeft">
          <div>
            <div className="ff-rightJobNo">
              {selectedRequest?.job_number || "No job number"}
            </div>

            <div className="ff-rightTitle">
              {titleCase(selectedQuote.job_type || selectedRequest?.job_type || "Job")}
            </div>

            <div className="ff-rightSub">
              {titleCase(selectedQuote.customer_name || selectedRequest?.customer_name || "Customer")} •{" "}
              {selectedQuote.address ||
                selectedRequest?.address ||
                formatPostcode(selectedQuote.postcode || selectedRequest?.postcode || "") ||
                "No address"}
            </div>
          </div>
        </div>

        <div className="ff-rightTopActions">
          {(selectedQuote.customer_phone || selectedRequest?.customer_phone) ? (
            <a
              href={telHref(selectedQuote.customer_phone || selectedRequest?.customer_phone)}
              className="ff-btn ff-btnGhost ff-btnSm"
              style={{ textDecoration: "none" }}
            >
              Call customer
            </a>
          ) : null}

          <button className="ff-btn ff-btnGhost ff-btnSm" onClick={saveJobCore} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>

          {normalizeJobStatus(selectedQuote, selectedRequest, selectedVisit) === "booked" ? (
            <button className="ff-btn ff-btnSuccess ff-btnSm" onClick={markInProgress}>
              Start job
            </button>
          ) : null}

          {normalizeJobStatus(selectedQuote, selectedRequest, selectedVisit) === "in_progress" ? (
            <button className="ff-btn ff-btnSuccess ff-btnSm" onClick={markComplete}>
              Mark complete
            </button>
          ) : null}

          <button
            className="ff-btn ff-btnPrimary ff-btnSm"
            onClick={() => selectedRequest && goToCreateInvoice(selectedRequest.id)}
            disabled={!selectedRequest}
          >
            Create invoice
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
            className={`ff-tabBtn ${rightTab === value ? "isActive" : ""}`}
            onClick={() => setRightTab(value as JobTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {rightTab === "overview" ? (
        <div className="ff-detailGrid">
          <div className="ff-bestActionCard">
            <div className="ff-bestActionEyebrow">Best next step</div>
            <div className="ff-bestActionTitle">{nextAction.title}</div>
            <div className="ff-bestActionText">{nextAction.text}</div>
          </div>

          <div className="ff-detailCard">
            <div className="ff-detailSectionTitle">Job details</div>

            <div className="ff-detailRow">
              <div className="ff-detailLabel">Description</div>
              <textarea
                className="ff-chatInput"
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Describe the work..."
              />
            </div>

            <div className="ff-detailRow">
              <div className="ff-detailLabel">Reference</div>
              <input
                className="ff-input"
                value={traderRef}
                onChange={(e) => setTraderRef(e.target.value)}
                placeholder="Optional trader reference"
              />
            </div>

            <div className="ff-detailRow">
              <div className="ff-detailLabel">Value</div>
              <input
                className="ff-input"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="ff-overviewTopGrid">
            {jobHealth.map((item) => (
              <div className="ff-overviewMiniCard" key={item.label}>
                <div className="ff-overviewMiniLabel">{item.label}</div>
                <div className="ff-overviewMiniValue">
                  {item.ok ? "Complete" : "Missing"}
                </div>
              </div>
            ))}
          </div>

          {missingItems.length ? (
            <div className="ff-detailCard">
              <div className="ff-detailSectionTitle">Things to tidy up</div>
              <div className="ff-warningList">
                {missingItems.map((item) => (
                  <div className="ff-warningItem" key={item}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {rightTab === "schedule" ? (
        <div className="ff-detailGrid">
          <div className="ff-detailCard">
            <div className="ff-detailSectionTitle">Schedule</div>
            <div className="ff-detailSub">
              Current booking:{" "}
              {selectedVisit?.starts_at
                ? niceDate(selectedVisit.starts_at)
                : selectedRequest?.job_booked_at
                ? niceDate(selectedRequest.job_booked_at)
                : "Not booked yet"}
            </div>

            <div style={{ marginTop: 14 }}>
              <input
                className="ff-input"
                type="datetime-local"
                value={bookingDateTime}
                onChange={(e) => setBookingDateTime(e.target.value)}
              />
            </div>

            <div className="ff-actions" style={{ marginTop: 14 }}>
              <button className="ff-btn ff-btnPrimary ff-btnSm" onClick={saveJobBookingDate}>
                Save booking
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rightTab === "files" ? (
        <div className="ff-detailGrid">
          <div className="ff-detailCard">
            <div className="ff-detailSectionTitle">Files</div>
            <div className="ff-detailSub">Customer files and trader site files.</div>

            <select
              className="ff-input"
              value={traderFileLabel}
              onChange={(e) => setTraderFileLabel(e.target.value)}
              style={{ marginTop: 14 }}
            >
              {TRADER_FILE_LABELS.map((x) => (
                <option key={x.value} value={x.value}>{x.text}</option>
              ))}
            </select>

            <input type="file" multiple onChange={onUploadTraderFiles} style={{ marginTop: 12 }} />

            {fileMsg ? <div className="ff-warningItem">{fileMsg}</div> : null}

            <div className="ff-fileList" style={{ marginTop: 16 }}>
              {traderFiles.length ? traderFiles.map((f) => (
                <div className="ff-fileRow" key={f.path}>
                  <div className="ff-fileRowMeta">
                    <strong>{f.name}</strong>
                    <div className="ff-detailSub">{labelText(f.label)} {prettyFileSize(f.size)}</div>
                  </div>
                  <div className="ff-fileActions">
                    {f.url ? <a className="ff-btn ff-btnGhost ff-btnSm" href={f.url} target="_blank">Open</a> : null}
                    <button className="ff-btn ff-btnDanger ff-btnSm" onClick={() => deleteTraderFile(f.path)}>Delete</button>
                  </div>
                </div>
              )) : <div className="ff-detailSub">No trader files yet.</div>}
            </div>
          </div>
        </div>
      ) : null}

      {rightTab === "messages" ? (
        <div className="ff-chatWrap">
          <div className="ff-chatTop">
            <div>
              <div className="ff-detailSectionTitle">Messages</div>
              <div className="ff-detailSub">Keep customer updates linked to this job.</div>
            </div>
          </div>

          <div className="ff-chatBody">
            {threadLoading ? (
              <div className="ff-detailSub">Loading messages…</div>
            ) : thread.length ? (
              thread.map((m) => {
                const out = isOutboundDirection(m.direction);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`ff-chatRow ${out ? "ff-chatRowOut" : "ff-chatRowIn"}`}
                    onClick={() => setExpandedMsg(m)}
                  >
                    <div className={`ff-chatBubble ${out ? "ff-chatBubbleOut" : "ff-chatBubbleIn"}`}>
                      <div className="ff-chatMeta">
                        <span className="ff-chatName">{out ? "You" : "Customer"}</span>
                        <span className="ff-chatTime">{niceDate(m.created_at)}</span>
                      </div>
                      {m.subject ? <div className="ff-chatSubject">{m.subject}</div> : null}
                      <div className="ff-chatText">{m.body_text || "No message body"}</div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="ff-detailSub">No messages yet.</div>
            )}
          </div>

          <div className="ff-chatComposer">
            <div className="ff-chatComposerTop">
              <input className="ff-input" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
              <input className="ff-input" value={replySubject} onChange={(e) => setReplySubject(e.target.value)} />
            </div>

            <div className="ff-quickReplyRow">
              {quickReplies.map((text) => (
                <button key={text} type="button" className="ff-quickReplyBtn" onClick={() => setReplyBody((prev) => insertReplyText(prev, text))}>
                  {text}
                </button>
              ))}
            </div>

            <textarea className="ff-chatInput" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />

            <div className="ff-chatActions">
              <div className="ff-chatHint">Sends from FixFlow and saves to the message trail.</div>
              <button className="ff-btn ff-btnPrimary ff-btnSm" onClick={sendReply} disabled={!replyTo.trim() || !replyBody.trim()}>
                Send message
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rightTab === "notes" ? (
        <div className="ff-detailGrid">
          <div className="ff-detailCard">
            <div className="ff-detailSectionTitle">Private notes</div>
            <textarea
              className="ff-chatInput"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private notes for this job..."
            />
            <div className="ff-actions" style={{ marginTop: 14 }}>
              <button className="ff-btn ff-btnPrimary ff-btnSm" onClick={saveNotes}>
                Save notes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rightTab === "documents" ? (
        <div className="ff-detailGrid">
          <div className="ff-detailCard">
            <div className="ff-detailSectionTitle">Documents</div>
            <div className="ff-detailSub">Certificates, warranties, manuals and handover files.</div>

            <select className="ff-input" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} style={{ marginTop: 14 }}>
              {DOCUMENT_LABELS.map((x) => (
                <option key={x.value} value={x.value}>{x.text}</option>
              ))}
            </select>

            <input type="file" multiple onChange={onUploadJobDocs} style={{ marginTop: 12 }} />

            <div className="ff-fileList" style={{ marginTop: 16 }}>
              {jobDocs.length ? jobDocs.map((f) => (
                <div className="ff-fileRow" key={f.path}>
                  <div className="ff-fileRowMeta">
                    <strong>{f.name}</strong>
                    <div className="ff-detailSub">{labelText(f.label)} {prettyFileSize(f.size)}</div>
                  </div>
                  <div className="ff-fileActions">
                    {f.url ? <a className="ff-btn ff-btnGhost ff-btnSm" href={f.url} target="_blank">Open</a> : null}
                    <button className="ff-btn ff-btnDanger ff-btnSm" onClick={() => deleteJobDoc(f.path)}>Delete</button>
                  </div>
                </div>
              )) : <div className="ff-detailSub">No documents uploaded yet.</div>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )}
</div>

           <div ref={detailBottomRef} />
        </div>
      </div>
    </div>

    {expandedMsg ? (
      <div className="ff-modalOverlay" onClick={() => setExpandedMsg(null)}>
        <div className="ff-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ff-modalHead">
            <div className="ff-modalTitle">{expandedMsg.subject || "Message"}</div>
            <button className="ff-x" type="button" onClick={() => setExpandedMsg(null)}>×</button>
          </div>
          <div className="ff-modalBody">{expandedMsg.body_text || "No message body"}</div>
        </div>
      </div>
    ) : null}
  </>
);
}