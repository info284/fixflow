"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

const [selectedRequestIdState, setSelectedRequestIdState] = useState<string | null>(
  requestIdParam || null
);
const selectedRequestId = requestIdParam || selectedRequestIdState;

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

  const currentStage = selectedRequest
    ? getStageIndex(selectedQuote, selectedRequest, selectedVisit)
    : 0;

  const nextAction = selectedRequest
    ? getNextAction(selectedQuote, selectedRequest, selectedVisit)
    : { title: "", text: "" };

  const stageItems = useMemo(() => stageItemsForJobs(), []);

  function pushToast(text: string, type: "success" | "error" = "success") {
    setToast({ text, type });
    window.clearTimeout((pushToast as any)._t);
    (pushToast as any)._t = window.setTimeout(() => setToast(null), 2400);
  }

async function loadJobsForTrader(plumberId: string) {
  const { data, error } = await supabase
    .from("quote_requests")
    .select(
      "id,job_number,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,status,created_at,trader_notes,calendar_html_link,site_visit_start,job_booked_at,job_calendar_html_link"
    )
    .eq("plumber_id", plumberId)
    .order("created_at", { ascending: false });

  console.log("Jobs query user:", plumberId);
  console.log("Jobs query data:", data);
  console.log("Jobs query error:", error);

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
      "id,plumber_id,request_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,vat_rate,subtotal,note,job_details,trader_ref,status,sent_at,created_at"
    )
    .eq("plumber_id", plumberId)
    .in("request_id", requestIds)
    .order("created_at", { ascending: false });

  console.log("loadQuoteMap requestIds:", requestIds);
  console.log("loadQuoteMap data:", data);
  console.log("loadQuoteMap error:", error);

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

 async function updateJobStatus(nextStatus: string, okText: string) {
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

    const ok = window.confirm("Delete this file?");
    if (!ok) return;

    const { error } = await supabase.storage.from(BUCKET).remove([path]);

    if (error) {
      console.error(error);
      pushToast("Couldn’t delete file", "error");
      return;
    }

    await loadFiles(selectedRequest.id);
    pushToast("File deleted");
  }

  async function deleteJobDoc(path: string) {
    if (!selectedRequest) return;

    const ok = window.confirm("Delete this document?");
    if (!ok) return;

    const { error } = await supabase.storage.from(BUCKET).remove([path]);

    if (error) {
      console.error(error);
      pushToast("Couldn’t delete document", "error");
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
  if (!uid || !selectedRequest) return;

  const ok = window.confirm("Delete this job?");
  if (!ok) return;

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
        supabase.storage.from(BUCKET).remove([customerFolder(selectedRequest.id)]),
        supabase.storage.from(BUCKET).remove([traderFolder(selectedRequest.id)]),
        supabase.storage.from(BUCKET).remove([docsFolder(selectedRequest.id)]),
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

      console.log("USE EFFECT RUNNING");

const {
  data: { session },
} = await supabase.auth.getSession();

console.log("SESSION:", session);

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
    const visit = visitMap[request.id] || null;

    const requestStatus = String(request.status || "").toLowerCase().trim();
    const quoteStatus = String(quote?.status || "").toLowerCase().trim();

    const isRealJob =
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
      quoteStatus === "paid";

    return isRealJob;
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

  return list;
}, [jobs, statusFilter, postcodeFilter, quoteMap, visitMap]);

const sortedJobs = useMemo(() => {
  return [...visibleJobs].sort((a, b) => {
    const aSelected = a.id === selectedRequestId;
    const bSelected = b.id === selectedRequestId;

    if (aSelected !== bSelected) return aSelected ? -1 : 1;

    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();

    if (Number.isNaN(da) && Number.isNaN(db)) return 0;
    if (Number.isNaN(da)) return 1;
    if (Number.isNaN(db)) return -1;

    return db - da;
  });
}, [visibleJobs, selectedRequestId]);

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

  const isMobileDetail = !!selectedRequest;

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
                    Manage approved work, booked jobs, progress, files, notes,
                    completion documents and invoicing in one place.
                  </div>
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

          <div className="ff-grid">
            <div className="ff-card ff-leftPane">
              <div className="ff-leftHeadRow">
                <div className="ff-leftTitle">All jobs</div>
                <div className="ff-leftCount">
                  {loading ? "…" : sortedJobs.length}
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
const status = jobStatusChip(quote, request, visit);
const urgency = urgencyChip(request.urgency);
const messages = threadMap[request.id] || [];
const hasUnread = hasIncomingReply(messages);
const alert = getJobAlert(messages);
const state = normalizeJobStatus(quote, request, visit);

                    return (
                      <button
                        key={request.id}
                        ref={active ? activeRowRef : null}
                        className={`ff-leftItem ${getUrgencyGlowClass(
                          request.urgency || request?.urgency
                        )}`}
                        data-active={active ? "1" : "0"}
                        type="button"
                        onClick={() => openJob(request.id)}
                      >
                        <div className="ff-leftItemInner">
                          <div className="ff-leftItemTop">
                            <div className="ff-jobNumber">
                              {request?.job_number ||
                                `FF-${request.id.slice(0, 4).toUpperCase()}`}
                              {hasUnread ? <span className="ff-unreadDot" /> : null}
                            </div>

                            <div className="ff-leftDate">
                              {niceDateOnly(request.created_at)}
                            </div>
                          </div>

                          <div className="ff-leftJobTitle">
                            {titleCase(request.job_type || request?.job_type || "Job")}
                          </div>

                          <div className="ff-leftCustomer">
                            {titleCase(
                              request.customer_name || request?.customer_name || "Customer"
                            )}
                          </div>

                          <div className="ff-leftAddress">
                            {request.address ||
                              request?.address ||
                              formatPostcode(request.postcode || request?.postcode) ||
                              "No address"}
                          </div>

                          <div className="ff-leftMetaRow">
                           <div className="ff-leftMetaText">{money(quote?.subtotal)}</div>

                            <div className="ff-leftMetaText">
                              {visit?.starts_at
                                ? niceDate(visit.starts_at)
                                : request?.job_booked_at
                                ? niceDate(request.job_booked_at)
                                : "Not booked yet"}
                            </div>
                          </div>

                          <div className="ff-leftChipRow">
                            <span className={urgency.cls}>{urgency.text}</span>
                            <span className={status.cls}>{status.text}</span>
                            {alert ? (
                              <span className={alert.cls}>{alert.text}</span>
                            ) : null}
                          </div>

                          <div className="ff-leftHint">
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

            <div className="ff-card ff-rightPane">
              <div className="ff-rightBody">
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
                      className="ff-backMobile"
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
                          {titleCase(
                            selectedQuote?.job_type ||
                              selectedRequest?.job_type ||
                              "Job"
                          )}
                        </div>

                        <div className="ff-rightSub">
                          {titleCase(
                            selectedQuote?.customer_name ||
                              selectedRequest?.customer_name ||
                              "Customer"
                          )}{" "}
                          •{" "}
                          {formatPostcode(
                            selectedQuote?.postcode || selectedRequest?.postcode || ""
                          ) || "—"}
                        </div>

                        <div className="ff-rightStatusRow">
                          <span className={selectedStatusChip?.cls}>
                            {selectedStatusChip?.text}
                          </span>

                          <span className="ff-chip ff-chipBlue">
                            {nextAction.title}
                          </span>
                        </div>
                      </div>

                      <div className="ff-rightTopActions">
                        {(selectedQuote?.customer_phone ||
                          selectedRequest?.customer_phone) && (
                          <a
                            href={telHref(
                              selectedQuote?.customer_phone ||
                                selectedRequest?.customer_phone
                            )}
                            className="ff-btn ff-btnGhost ff-btnSm"
                            style={{ textDecoration: "none" }}
                          >
                            Call customer
                          </a>
                        )}

                        <button
                          type="button"
                          className="ff-btn ff-btnGhost ff-btnSm"
                          onClick={saveJobCore}
                          disabled={saving}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>

                        <button
                          type="button"
                          className="ff-btn ff-btnPrimary ff-btnSm"
                          onClick={() =>
                            selectedRequest && goToCreateInvoice(selectedRequest.id)
                          }
                          disabled={!selectedRequest}
                        >
                          Create invoice
                        </button>

                        {normalizeJobStatus(
                          selectedQuote,
                          selectedRequest,
                          selectedVisit
                        ) === "booked" ? (
                          <button
                            type="button"
                            className="ff-btn ff-btnGreen ff-btnSm"
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
                            className="ff-btn ff-btnGreen ff-btnSm"
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
                            className="ff-btn ff-btnGreen ff-btnSm"
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
                            className="ff-btn ff-btnGreen ff-btnSm"
                            onClick={markPaid}
                            disabled={saving}
                          >
                            Mark paid
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="ff-btn ff-btnDanger ff-btnSm"
                          onClick={deleteJob}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="ff-stageStrip">
                      {stageItems.map((item, index) => {
                        const done = currentStage >= index;
                        const current = currentStage === index;

                        return (
                          <div
                            key={item}
                            className={`ff-stageItem ${done ? "isDone" : ""} ${
                              current ? "isCurrent" : ""
                            }`}
                          >
                            <span className="ff-stageDot" />
                            <span className="ff-stageText">{item}</span>
                          </div>
                        );
                      })}
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
                        <div className="ff-overviewTopGrid">
                          {jobHealth.map((item) => (
                            <div className="ff-overviewMiniCard" key={item.label}>
                              <div className="ff-overviewMiniLabel">{item.label}</div>
                              <div className="ff-overviewMiniValue">
                                {item.ok ? "Complete" : "Missing"}
                              </div>
                              <div className="ff-overviewMiniSub">
                                {item.ok
                                  ? "This part of the job is covered."
                                  : "This still needs attention."}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="ff-detailGrid" style={{ marginTop: 20 }}>
                          <div className="ff-detailCard ff-detailCardHero">
                            <div className="ff-problemHead">
                              <div>
                                <div
                                  className="ff-detailLabel"
                                  style={{ marginBottom: 8 }}
                                >
                                  Best next action
                                </div>
                                <div className="ff-problemTitle">
                                  {nextAction.title}
                                </div>
                              </div>

                              <span className={selectedStatusChip?.cls}>
                                {selectedStatusChip?.text}
                              </span>
                            </div>

                            <div className="ff-problemText" style={{ marginTop: 14 }}>
                              {nextAction.text}
                            </div>

                            <div className="ff-problemMetaRow">
                              <span className="ff-problemMetaPill">
                                {titleCase(
                                  selectedQuote?.urgency ||
                                    selectedRequest?.urgency ||
                                    "Flexible"
                                )}
                              </span>

                              <span className="ff-problemMetaPill">
                                {formatPostcode(
                                  selectedQuote?.postcode ||
                                    selectedRequest?.postcode ||
                                    ""
                                ) || "—"}
                              </span>

                              <span className="ff-problemMetaPill">
                                Created {niceDate(selectedQuote?.created_at)}
                              </span>

                              {selectedVisit?.starts_at ? (
                                <span className="ff-problemMetaPill">
                                  Visit {niceDate(selectedVisit.starts_at)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {missingItems.length ? (
                            <div className="ff-detailCard">
                              <div className="ff-detailSectionTitle">
                                Missing items
                              </div>

                              <div className="ff-warningList">
                                {missingItems.map((item) => (
                                  <div key={item} className="ff-warningItem">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="ff-detailCard">
                              <div className="ff-detailSectionTitle">
                                Job health
                              </div>

                              <div className="ff-detailSub">
                                Nothing important is missing. This job looks well
                                organised and ready to move forward.
                              </div>
                            </div>
                          )}

                          <div className="ff-detailCard">
                            <div className="ff-detailSectionTitle">Customer</div>

                            <div className="ff-customerGrid">
                              <div className="ff-customerItem">
                                <span className="ff-customerLabel">Name</span>
                                <strong>
                                  {nice(
                                    titleCase(
                                      selectedQuote?.customer_name ||
                                        selectedRequest?.customer_name
                                    )
                                  )}
                                </strong>
                              </div>

                              <div className="ff-customerItem">
                                <span className="ff-customerLabel">Email</span>
                                <strong>
                                  {nice(
                                    selectedQuote?.customer_email ||
                                      selectedRequest?.customer_email
                                  )}
                                </strong>
                              </div>

                              <div className="ff-customerItem">
                                <span className="ff-customerLabel">Phone</span>
                                <strong>
                                  {nice(
                                    selectedQuote?.customer_phone ||
                                      selectedRequest?.customer_phone
                                  )}
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
                                  onChange={(e) =>
                                    setWorkDescription(e.target.value)
                                  }
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
                                  onChange={(e) =>
                                    setSubtotal(
                                      e.target.value.replace(/[^\d.]/g, "")
                                    )
                                  }
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
                                    className={`ff-pillSmall ${
                                      vatRegistered
                                        ? "ff-pillNeutralActive"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      setVatRegistered(true);
                                      setVatRate("20");
                                    }}
                                  >
                                    VAT registered
                                  </button>

                                  <button
                                    type="button"
                                    className={`ff-pillSmall ${
                                      !vatRegistered
                                        ? "ff-pillNeutralActive"
                                        : ""
                                    }`}
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
                                  const total = s + s * (vr / 100);
                                  return `£${total.toFixed(2)}`;
                                })()}
                              </div>
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

                        <div className="ff-chatBody">
                          {threadLoading ? (
                            <div className="ff-loadingText">Loading messages…</div>
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
                                >
                                  <div
                                    className={`ff-chatBubble ${
                                      outbound
                                        ? "ff-chatBubbleOut"
                                        : "ff-chatBubbleIn"
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

      <style jsx>{styles}</style>
    </>
  );
}
const styles = `
:global(body){
  background: ${FF.pageBg};
}

/* PAGE */
.ff-page{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  padding:0;
}

.ff-wrap{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  gap:14px;
}

/* TOP */
.ff-top{
  min-width: 0;
  min-height: 0;
  border: 1px solid #e6ecf5;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 14px 32px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.ff-hero{
  position: relative;
  overflow: hidden;
  padding: 20px 18px 16px;
  background: linear-gradient(
    135deg,
    rgba(143, 169, 214, 0.18),
    rgba(255, 255, 255, 0.98)
  );
}

.ff-heroGlow{
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 14% 18%, rgba(143, 169, 214, 0.18), transparent 52%),
    radial-gradient(circle at 84% 20%, rgba(31, 53, 92, 0.07), transparent 58%);
  pointer-events: none;
}

.ff-heroRow{
  position:relative;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
}

.ff-heroLeft{
  display:grid;
  gap:8px;
  max-width: 620px;
}

.ff-heroTitle{
  font-size: 30px;
  font-weight: 950;
  color: ${FF.navySoft};
  letter-spacing: -0.03em;
  line-height:1.02;
}

.ff-heroRule{
  height: 3px;
  width: 240px;
  border-radius: 999px;
  background: ${FF.blueLine};
  opacity: 0.95;
}

.ff-heroSub{
  font-size: 13px;
  color: ${FF.muted};
  font-weight: 600;
  line-height: 1.5;
}

.ff-heroStats{
  display:grid;
  grid-template-columns: repeat(4, minmax(110px, 1fr));
  gap:10px;
  min-width: min(100%, 460px);
}

.ff-statCard{
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(230, 236, 245, 0.96);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.92) inset,
    0 8px 18px rgba(15, 23, 42, 0.04);
  backdrop-filter: blur(6px);
}

.ff-statLabel{
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7b8798;
}

.ff-statValue{
  margin-top: 6px;
  font-size: 22px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: -0.03em;
  color: #0b1320;
}

/* CONTROLS */
.ff-controls{
  padding: 12px 14px;
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  justify-content:space-between;
  border-top: 1px solid ${FF.border};
  background: linear-gradient(180deg, rgba(36,91,255,0.06), rgba(255,255,255,0));
}

.ff-filterRow{
  display:flex;
  gap:8px;
  align-items:center;
  flex-wrap:wrap;
}

.ff-input{
  height: 38px;
  border-radius: 14px;
  border: 1px solid ${FF.border};
  background:#fff;
  padding: 0 12px;
  outline:none;
  font-size: 13px;
  color: ${FF.text};
  box-sizing: border-box;
  width: 100%;
}

.ff-pillSmall{
  height: 32px;
  border-radius: 999px;
  border: 1px solid ${FF.border};
  padding: 0 12px;
  font-size: 12px;
  font-weight: 900;
  background:#fff;
  color: ${FF.muted};
  cursor:pointer;
}

.ff-pillNeutralActive{
  border-color: rgba(36,91,255,0.35);
  background: rgba(36,91,255,0.12);
  color: ${FF.navySoft};
}

/* TOAST */
.ff-toast{
  border: 1px solid ${FF.border};
  background:#fff;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 13px;
  color: ${FF.text};
  box-shadow: 0 10px 22px rgba(15,23,42,0.05);
}

.ff-toastSuccess{
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.ff-toastError{
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

/* GRID */
.ff-grid{
  display:grid;
  gap:14px;
  grid-template-columns: 360px minmax(0, 1fr);
  flex:1;
  min-height:0;
}

.ff-grid > *{
  min-height:0;
}

.ff-card{
  border: 1px solid ${FF.border};
  border-radius: 18px;
  background:#fff;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  min-height:0;
  box-shadow:
    0 1px 0 rgba(15,23,42,0.03),
    0 14px 30px rgba(15,23,42,0.08);
}

/* LEFT */
.ff-leftHeadRow{
  padding: 12px;
  border-bottom: 1px solid ${FF.border};
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.ff-leftTitle{
  font-weight: 900;
  color:${FF.navySoft};
}

.ff-leftCount{
  font-weight: 900;
  color:${FF.muted};
  border: 1px solid ${FF.border};
  background:#F7F9FC;
  border-radius:999px;
  padding: 4px 10px;
  font-size: 12px;
}

.ff-unreadDot{
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ef4444;
  margin-left: 6px;
}

.ff-leftList{
  padding: 12px 12px 22px;
  display:flex;
  flex-direction:column;
  gap:12px;
  flex:1;
  min-height:0;
  overflow:auto;
  -webkit-overflow-scrolling: touch;
}

.ff-leftGlowASAP {
  box-shadow:
    0 0 0 3px rgba(239, 68, 68, 0.24),
    0 14px 30px rgba(15, 23, 42, 0.10) !important;
}

.ff-leftGlowWeek {
  box-shadow:
    0 0 0 3px rgba(245, 158, 11, 0.22),
    0 14px 30px rgba(15, 23, 42, 0.10) !important;
}

.ff-leftGlowNext {
  box-shadow:
    0 0 0 3px rgba(34, 197, 94, 0.22),
    0 12px 28px rgba(15, 23, 42, 0.08) !important;
}

.ff-leftGlowFlexible {
  box-shadow:
    0 0 0 3px rgba(96, 165, 250, 0.24),
    0 14px 30px rgba(15, 23, 42, 0.10) !important;
}

.ff-leftItem{
  width:100%;
  text-align:left;
  border-radius: 22px;
  padding:0;
  overflow:visible;
  border: 1px solid #e6ecf5;
  background:#ffffff;
  cursor:pointer;
  transition: all 0.18s ease;
  display:block;
  min-height: 188px;
  position:relative;
  box-shadow:
    0 1px 0 rgba(15,23,42,0.03),
    0 10px 22px rgba(15,23,42,0.06);
}

.ff-leftItem:hover{
  transform: translateY(-3px);
  border-color: rgba(36,91,255,0.25);
  background: linear-gradient(
    90deg,
    rgba(36,91,255,0.08) 0%,
    rgba(36,91,255,0.03) 40%,
    #ffffff 85%
  );
  box-shadow:
    0 6px 18px rgba(15,23,42,0.08),
    0 20px 42px rgba(15,23,42,0.12);
}

.ff-leftItem[data-active="1"]{
  border-color: rgba(36,91,255,0.35);
  background: linear-gradient(
    90deg,
    rgba(36,91,255,0.18) 0%,
    rgba(36,91,255,0.06) 45%,
    #ffffff 100%
  );
  box-shadow:
    0 0 0 2px rgba(36,91,255,0.18),
    0 18px 40px rgba(15,23,42,0.12);
}

.ff-leftItem[data-active="1"]::before{
  content:"";
  position:absolute;
  left:12px;
  top:20px;
  bottom:20px;
  width:3px;
  border-radius:999px;
  background: linear-gradient(
    180deg,
    #1d4ed8 0%,
    #2563eb 35%,
    #60a5fa 72%,
    rgba(96,165,250,0.18) 100%
  );
  box-shadow: 0 0 8px rgba(37,99,235,0.22);
  z-index:3;
  pointer-events:none;
}

.ff-leftItemInner{
  position:relative;
  z-index:2;
  padding: 18px 18px 16px 30px;
  display:flex;
  flex-direction:column;
  gap:8px;
}

.ff-leftItemTop{
  display:flex;
  justify-content:space-between;
  gap:10px;
}

.ff-jobNumber{
  display:flex;
  align-items:center;
  gap:8px;
  color:#1f355c;
  font-size: 20px;
  line-height:1;
  font-weight:950;
  letter-spacing:-0.03em;
}

.ff-leftDate{
  white-space:nowrap;
  color:#94a3b8;
  font-size:12px;
  line-height:1;
  font-weight:700;
}

.ff-leftJobTitle{
  color:${FF.text};
  font-size: 16px;
  line-height:1.2;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.ff-leftCustomer{
  color:${FF.navySoft};
  font-size: 14px;
  line-height:1.2;
  font-weight: 800;
}

.ff-leftAddress{
  color:#8a94a6;
  font-size:13px;
  line-height:1.3;
  font-weight:700;
}

.ff-leftMetaRow{
  display:flex;
  align-items:center;
  gap:10px 14px;
  flex-wrap:wrap;
  margin-top: 2px;
}

.ff-leftMetaText{
  color:#9aa4b2;
  font-size:13px;
  line-height:1.15;
  font-weight:700;
}

.ff-leftChipRow{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top: 2px;
}

.ff-leftHint{
  margin-top: 2px;
  color:#102a56;
  font-size:13px;
  line-height:1.2;
  font-weight:900;
}

/* RIGHT */
.ff-rightBody{
  flex:1;
  min-height:0;
  overflow:auto;
  padding: 24px 28px 28px;
  box-sizing:border-box;
}

.ff-rightTop{
  border: 1px solid rgba(36,91,255,0.30);
  border-radius: 20px;
  padding: 18px 18px;
  background: linear-gradient(
    90deg,
    rgba(36,91,255,0.16) 0%,
    rgba(36,91,255,0.08) 35%,
    rgba(36,91,255,0.03) 60%,
    #ffffff 100%
  );
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:18px;
  margin-bottom: 16px;
}

.ff-rightTopLeft{
  display:grid;
  gap:6px;
}

.ff-rightJobNo{
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${FF.muted};
}

.ff-rightTitle{
  font-weight: 950;
  color:${FF.navySoft};
  font-size: 24px;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.ff-rightSub{
  color:${FF.muted};
  font-size: 13px;
  font-weight: 750;
}

.ff-rightStatusRow{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
}

.ff-rightTopActions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  justify-content:flex-end;
}

.ff-tabs{
  margin: 8px 0 18px;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.ff-tabBtn{
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid ${FF.border};
  background:#fff;
  font-weight: 850;
  font-size: 13px;
  color:${FF.navySoft};
  cursor:pointer;
}

.ff-tabBtn.isActive{
  border-color: rgba(36,91,255,0.35);
  background: rgba(36,91,255,0.10);
}

/* OVERVIEW */
.ff-overviewTopGrid{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap:12px;
}

.ff-overviewMiniCard{
  border: 1px solid rgba(36,91,255,0.16);
  border-radius: 18px;
  background: linear-gradient(
    180deg,
    rgba(36,91,255,0.08) 0%,
    rgba(255,255,255,1) 100%
  );
  padding: 16px;
  box-shadow:
    0 1px 0 rgba(36,91,255,0.05),
    0 10px 24px rgba(15,23,42,0.05);
}

.ff-overviewMiniLabel{
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${FF.muted};
}

.ff-overviewMiniValue{
  margin-top: 8px;
  font-size: 18px;
  line-height: 1.15;
  font-weight: 900;
  color: ${FF.navySoft};
  letter-spacing: -0.02em;
}

.ff-overviewMiniSub{
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: ${FF.muted};
}

/* EMPTY */
.ff-emptyWrap{
  min-height: 260px;
  padding: 16px;
  display:flex;
  align-items:center;
  justify-content:center;
}

.ff-empty{
  border: 1px dashed rgba(36,91,255,0.28);
  background: ${FF.blueSoft2};
  border-radius: 18px;
  padding: 24px;
  text-align:center;
  width:100%;
  max-width: 520px;
}

.ff-emptyTitle{
  font-weight: 900;
  color:${FF.navySoft};
  font-size: 18px;
}

.ff-emptySub{
  margin-top: 6px;
  font-size: 13px;
  color:${FF.muted};
  line-height: 1.5;
}

/* DETAIL CARDS */
.ff-detailGrid{
  display:grid;
  gap:12px;
}

.ff-detailCard{
  border: 1px solid rgba(36,91,255,0.18);
  border-radius: 18px;
  background: linear-gradient(
    180deg,
    rgba(36,91,255,0.08) 0%,
    rgba(36,91,255,0.04) 40%,
    #ffffff
  );
  box-shadow:
    0 1px 0 rgba(36,91,255,0.06),
    0 12px 28px rgba(15,23,42,0.06);
  padding: 16px;
}

.ff-detailCardHero{
  padding: 18px;
}

.ff-detailSectionTitle{
  font-size: 16px;
  font-weight: 900;
  color: ${FF.navySoft};
  letter-spacing: -0.02em;
}

.ff-detailRow{
  display:grid;
  grid-template-columns: 140px minmax(0,1fr);
  gap: 10px;
  align-items:start;
  padding: 12px 0;
}

.ff-detailRow + .ff-detailRow{
  border-top: 1px solid rgba(230,236,245,0.9);
}

.ff-detailLabel{
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color:${FF.muted};
  opacity: 0.9;
}

.ff-detailValue{
  font-size: 14px;
  font-weight: 650;
  color:${FF.text};
  line-height: 1.45;
  word-break: break-word;
  overflow-wrap:anywhere;
}

.ff-detailSub{
  margin-top: 4px;
  font-size: 13px;
  font-weight: 500;
  color:${FF.muted};
  white-space: pre-wrap;
  overflow-wrap:anywhere;
  word-break: break-word;
}

/* HERO CARD */
.ff-problemHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
}

.ff-problemTitle{
  font-size: 22px;
  line-height: 1.08;
  font-weight: 950;
  color: ${FF.text};
  letter-spacing: -0.03em;
}

.ff-problemText{
  font-size: 15px;
  line-height: 1.7;
  color: #1f355c;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.ff-problemMetaRow{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top: 16px;
}

.ff-problemMetaPill{
  display:inline-flex;
  align-items:center;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid ${FF.border};
  color: ${FF.navySoft};
  font-size: 12px;
  font-weight: 800;
}

.ff-warningList{
  display:grid;
  gap:8px;
  margin-top: 14px;
}

.ff-warningItem{
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 13px;
  font-weight: 700;
}

/* CUSTOMER GRID */
.ff-customerGrid{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap:12px;
  margin-top: 14px;
}

.ff-customerItem{
  border: 1px solid ${FF.border};
  border-radius: 16px;
  background: #fff;
  padding: 14px;
  display:grid;
  gap:6px;
}

.ff-customerLabel{
  font-size: 11px;
  font-weight: 800;
  color:${FF.muted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ff-customerItem strong{
  color:${FF.text};
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap:anywhere;
}

/* FILES */
.ff-fileHeaderChips{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.ff-fileMsg{
  margin-top: 12px;
  font-size: 13px;
  color: ${FF.muted};
}

.ff-fileSection{
  margin-top: 20px;
}

.ff-fileGrid{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap:12px;
}

.ff-fileTile{
  border: 1px solid ${FF.border};
  background:#fff;
  border-radius: 16px;
  overflow:hidden;
  text-decoration:none;
  box-shadow: 0 10px 24px rgba(15,23,42,0.05);
}

.ff-fileThumb{
  width:100%;
  height:150px;
  object-fit:cover;
  display:block;
  background:#eef3fb;
}

.ff-fileFallback{
  width:100%;
  height:150px;
  display:grid;
  place-items:center;
  font-size: 13px;
  font-weight: 800;
  color:${FF.navySoft};
  background: ${FF.blueSoft2};
}

.ff-fileTileBody{
  padding: 10px;
}

.ff-fileName{
  font-size: 13px;
  font-weight: 800;
  color:${FF.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ff-fileMeta{
  margin-top: 4px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  font-size: 11px;
  color:${FF.muted};
}

.ff-uploadedList{
  display:grid;
  gap:10px;
}

.ff-uploadedRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px;
  border: 1px solid ${FF.border};
  border-radius: 14px;
  background:#fff;
}

.ff-uploadedInfo{
  min-width:0;
  flex:1;
}

.ff-uploadedActions{
  display:flex;
  gap:8px;
  flex-shrink:0;
}

/* CHAT */
.ff-chatWrap{
  display:grid;
  gap:14px;
}

.ff-chatTop{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:16px;
  border: 1px solid rgba(36,91,255,0.18);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(36,91,255,0.08) 0%, #fff 100%);
}

.ff-chatBody{
  display: grid;
  gap: 12px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.ff-chatRow{
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.ff-chatRowOut{
  display:flex;
  justify-content:flex-end;
}

.ff-chatRowIn{
  display:flex;
  justify-content:flex-start;
}

.ff-chatBubble{
  width: fit-content;
  max-width: min(78%, 640px);
  padding: 12px 14px;
  border-radius: 18px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ff-chatBubbleOut{
  background: #0b2a55;
  border: 1px solid #0b2a55;
  color: #fff;
}

.ff-chatBubbleIn{
  background: #ffffff;
  border: 1px solid #e6ecf5;
  color: #0B1320;
}

.ff-chatMeta{
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 800;
  opacity: 0.88;
}

.ff-chatName{
  font-weight: 900;
}

.ff-chatTime{
  font-weight: 700;
}

.ff-chatSubject{
  font-size: 12px;
  font-weight: 900;
  margin-bottom: 8px;
}

.ff-chatText{
  white-space: pre-wrap;
  line-height: 1.55;
  font-size: 13px;
}

.ff-chatComposer{
  border: 1px solid rgba(36,91,255,0.18);
  border-radius: 18px;
  background: #fff;
  padding: 16px;
  box-shadow: 0 10px 24px rgba(15,23,42,0.05);
}

.ff-chatComposerTop{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:10px;
}

.ff-quickReplyRow{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top: 12px;
}

.ff-quickReplyBtn{
  border: 1px solid ${FF.border};
  background: #F7F9FC;
  color:${FF.navySoft};
  font-size: 12px;
  font-weight: 800;
  border-radius: 999px;
  padding: 8px 12px;
  cursor: pointer;
}

.ff-chatInput{
  width:100%;
  min-height: 130px;
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid ${FF.border};
  padding: 12px;
  outline:none;
  font-size: 13px;
  line-height: 1.55;
  color:${FF.text};
  resize: vertical;
  box-sizing: border-box;
}

.ff-chatActions{
  margin-top: 12px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
}

.ff-chatHint{
  font-size: 12px;
  color:${FF.muted};
  font-weight: 700;
}

.ff-chatActionButtons{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

/* NOTES */
.ff-textarea{
  width:100%;
  min-height: 180px;
  border-radius: 16px;
  border: 1px solid ${FF.border};
  padding: 12px;
  outline:none;
  font-size: 13px;
  line-height: 1.55;
  color:${FF.text};
  resize: vertical;
  box-sizing:border-box;
}

.ff-noteFoot{
  margin-top: 12px;
  display:flex;
  justify-content:flex-end;
  gap:10px;
}

.ff-inlineActions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
}

/* BOOKING ACTIONS */
.ff-bookingActions{
  margin-top: 16px;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

/* BUTTONS */
.ff-btn{
  height: 36px;
  border-radius: 12px;
  border: 1px solid ${FF.border};
  background: #fff;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 800;
  color: ${FF.navySoft};
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.ff-btn:hover{
  transform: translateY(-1px);
}

.ff-btnPrimary{
  height: 38px;
  border-radius: 999px;
  border:none;
  background: ${FF.navySoft};
  color:#fff;
  padding: 0 14px;
  font-weight: 850;
  font-size: 12px;
}

.ff-btnGhost{
  border-radius: 999px;
  font-weight: 850;
  font-size: 12px;
}

.ff-btnSm{
  height: 36px;
  padding:0 14px;
  font-size:12px;
  border-radius:999px;
}

.ff-btnGreen{
  height: 38px;
  border-radius: 999px;
  border: none;
  background: #15803d;
  color: #ffffff;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ff-btnGreen:hover{
  background:#166534;
}

.ff-btnDanger{
  height: 38px;
  border-radius: 999px;
  border: 1px solid #fecaca;
  background: #fff;
  color: #dc2626;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

/* CHIP */
.ff-chip{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  border: 1px solid transparent;
  white-space:nowrap;
}

.ff-chipBlue{
  background:${FF.blueSoft};
  border-color: rgba(36,91,255,0.32);
  color:${FF.navySoft};
}

.ff-chipGray{
  background:#F7F9FC;
  border-color:${FF.border};
  color:${FF.muted};
}

.ff-chipRed{
  background:${FF.redSoft};
  border-color:#FFC0C0;
  color:#8A1F1F;
}

.ff-chipAmber{
  background:${FF.amberSoft};
  border-color:#FFD7A3;
  color:#8A4B00;
}

.ff-chipGreen{
  background:${FF.greenSoft};
  border-color:#BFE9CF;
  color:#116B3A;
}

/* STAGE STRIP */
.ff-stageStrip{
  display:grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap:8px;
  margin-bottom:16px;
}

.ff-stageItem{
  min-width:0;
  display:flex;
  align-items:center;
  gap:8px;
  padding:12px 10px;
  border-radius:16px;
  border:1px solid ${FF.border};
  background:#fbfcff;
}

.ff-stageItem.isDone{
  background: linear-gradient(180deg, #eef4ff 0%, #f8fbff 100%);
  border-color: rgba(143,169,214,0.3);
}

.ff-stageItem.isCurrent{
  box-shadow:
    0 0 0 1px rgba(143,169,214,0.2),
    0 8px 18px rgba(15,23,42,0.05);
}

.ff-stageDot{
  width:10px;
  height:10px;
  border-radius:999px;
  background:#d6deea;
  flex:0 0 auto;
}

.ff-stageItem.isDone .ff-stageDot,
.ff-stageItem.isCurrent .ff-stageDot{
  background:${FF.blue};
  box-shadow: 0 0 0 4px rgba(36,91,255,0.12);
}

.ff-stageText{
  min-width:0;
  font-size:12px;
  line-height:1.25;
  font-weight:800;
  color:${FF.navySoft};
}

/* LOADING */
.ff-loadingWrap{
  padding: 18px;
}

.ff-loadingText{
  font-size: 13px;
  color: ${FF.muted};
  font-weight: 700;
}

/* MODAL */
.ff-modalOverlay{
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(11, 19, 32, 0.42);
  backdrop-filter: blur(6px);
}

.ff-modal{
  width: min(720px, 100%);
  max-height: calc(100vh - 36px);
  overflow: hidden;
  border: 1px solid rgba(230, 236, 245, 0.96);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.18);
}

.ff-modalHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding: 16px 18px;
  border-bottom: 1px solid ${FF.border};
}

.ff-modalTitle{
  font-size: 16px;
  font-weight: 900;
  color:${FF.navySoft};
}

.ff-x{
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid ${FF.border};
  background:#fff;
  cursor:pointer;
  font-size: 14px;
  font-weight: 900;
  color:${FF.navySoft};
}

.ff-modalBody{
  padding: 18px;
  overflow:auto;
  max-height: calc(100vh - 120px);
}

.ff-expandedMsgBody{
  border: 1px solid ${FF.border};
  background: ${FF.blueSoft2};
  border-radius: 16px;
  padding: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.55;
  color: ${FF.text};
}

/* MOBILE */
.ff-backMobile{
  display:none;
}

@media (max-width: 1100px){
  .ff-heroRow{
    flex-direction: column;
  }

  .ff-heroStats{
    width:100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: 0;
  }

  .ff-overviewTopGrid{
    grid-template-columns: repeat(2, minmax(0,1fr));
  }

  .ff-fileGrid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ff-stageStrip{
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 980px){
  .ff-grid{
    grid-template-columns: 1fr;
  }

  .ff-rightBody{
    padding: 16px;
  }

  .ff-backMobile{
    display:inline-flex;
    background: rgba(31,53,92,0.06);
    border: 1px solid rgba(31,53,92,0.12);
    padding: 6px 12px;
    border-radius: 999px;
    margin: 0 0 16px 0;
    font-weight: 700;
    font-size: 13px;
    color: #1f355c;
    cursor:pointer;
  }

  .ff-page[data-mobile-detail="1"] .ff-leftPane{
    display:none;
  }

  .ff-page[data-mobile-detail="0"] .ff-rightPane{
    display:none;
  }

  .ff-leftItem[data-active="1"]::before{
    content:none;
  }

  .ff-leftItem[data-active="1"]{
    background:#fff;
    border-color:${FF.border};
    box-shadow: 0 10px 22px rgba(15,23,42,0.06);
  }

  .ff-rightTop{
    flex-direction: column;
  }

  .ff-rightTopActions{
    width:100%;
    justify-content:flex-start;
  }

  .ff-chatComposerTop{
    grid-template-columns: 1fr;
  }

  .ff-uploadedRow{
    flex-direction: column;
    align-items: flex-start;
  }

  .ff-uploadedActions{
    width: 100%;
    flex-wrap: wrap;
  }

  .ff-chatBubble{
    max-width: 92%;
  }
}

@media (max-width: 720px){
  .ff-heroTitle{
    font-size: 26px;
  }

  .ff-heroRule{
    width: 180px;
  }

  .ff-overviewTopGrid{
    grid-template-columns: 1fr;
  }

  .ff-customerGrid{
    grid-template-columns: 1fr;
  }

  .ff-detailRow{
    grid-template-columns: 1fr;
  }

  .ff-leftItem{
    min-height: 178px;
  }

  .ff-fileGrid{
    grid-template-columns: 1fr;
  }

  .ff-stageStrip{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;