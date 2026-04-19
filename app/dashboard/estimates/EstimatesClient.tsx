"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ================== TYPES ================== */

type QuoteRequestRow = {
  id: string;
  plumber_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  postcode: string | null;
  address: string | null;
  job_type: string | null;
  urgency: string | null;
  details: string | null;
  trader_notes: string | null;
  created_at: string;
  job_number?: string | null;
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
  id?: string;
  name: string;
  path: string;
  url: string | null;
  area?: "customer" | "trader" | "documents";
  label?: string | null;
};

type TabKey =
  | "overview"
  | "visit"
  | "files"
  | "notes"
  | "timeline"
  | "documents";

/* ================== CONSTS ================== */

const BUCKET = "quote-files";

const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;
const docsFolder = (requestId: string) => `job/${requestId}/documents`;

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

const CUSTOMER_FILE_LABELS = [
  { value: "customer_photo", text: "Customer photo" },
  { value: "customer_document", text: "Customer document" },
];

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

/* ================== HELPERS ================== */

function cleanId(v?: string | null) {
  const s = String(v || "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function titleCase(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w[0] ? w[0].toUpperCase() : "") + w.slice(1))
    .join(" ");
}

function niceDateOnly(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString([], {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function niceDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString([], {
      year: "2-digit",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
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

function safeFileName(name: string) {
  return (name || "file")
    .replaceAll(" ", "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .slice(0, 120);
}

function telHref(phone?: string | null) {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function labelText(value?: string | null) {
  if (!value) return "";

  const all = [
    ...CUSTOMER_FILE_LABELS,
    ...TRADER_FILE_LABELS,
    ...DOCUMENT_LABELS,
  ];

  return all.find((x) => x.value === value)?.text || value;
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

  if (v.includes("flex")) {
    return { text: "Flexible", cls: "ff-chip ff-chipBlueSoft" };
  }

  return { text: "", cls: "" };
}

function normalizeJobStatus(q: QuoteRow, visit?: SiteVisitRow | null) {
  const status = String(q.status || "").toLowerCase().trim();

  if (status.includes("paid")) return "paid";
  if (status.includes("invoice")) return "invoiced";
  if (status.includes("complete")) return "complete";
  if (status.includes("in progress")) return "in_progress";
  if (status.includes("approved") || status.includes("accepted")) {
    return visit ? "booked" : "approved";
  }
  if (visit) return "booked";
  return "approved";
}

function jobStatusChip(q: QuoteRow, visit?: SiteVisitRow | null) {
  const s = normalizeJobStatus(q, visit);

  if (s === "paid") return { text: "Paid", cls: "ff-chip ff-chipGreen" };
  if (s === "invoiced") return { text: "Invoiced", cls: "ff-chip ff-chipBlueSoft" };
  if (s === "complete") return { text: "Complete", cls: "ff-chip ff-chipGreen" };
  if (s === "in_progress") {
    return { text: "In progress", cls: "ff-chip ff-chipBlueSoft" };
  }
  if (s === "booked") return { text: "Booked", cls: "ff-chip ff-chipBlueSoft" };
  return { text: "Approved", cls: "ff-chip ff-chipAmber" };
}

function getJobStage(q: QuoteRow, visit?: SiteVisitRow | null) {
  const s = normalizeJobStatus(q, visit);

  if (s === "paid") return 5;
  if (s === "invoiced") return 4;
  if (s === "complete") return 3;
  if (s === "in_progress") return 2;
  if (s === "booked") return 1;
  return 0;
}

function nextActionLabel(q: QuoteRow, visit?: SiteVisitRow | null) {
  const s = normalizeJobStatus(q, visit);

  if (s === "paid") return "Job closed";
  if (s === "invoiced") return "Await payment";
  if (s === "complete") return "Send invoice";
  if (s === "in_progress") return "Mark complete";
  if (s === "booked") return "Open booking";
  return "Create booking";
}

function nextActionDescription(q: QuoteRow, visit?: SiteVisitRow | null) {
  const s = normalizeJobStatus(q, visit);

  if (s === "paid") {
    return "Everything is finished and paid. Keep documents and notes here for future reference.";
  }

  if (s === "invoiced") {
    return "Invoice has been sent. The next step is to track payment and close the job.";
  }

  if (s === "complete") {
    return "The work is marked complete. Send the invoice and make sure final documents are uploaded.";
  }

  if (s === "in_progress") {
    return "The job is underway. Use this page to keep notes, site photos and completion documents together.";
  }

  if (s === "booked") {
    return "This job is booked in. Check the visit details, notes and files before you go.";
  }

  return "This job has been approved but not booked in yet. Get a date in the diary so nothing gets missed.";
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

function getMissingItems(args: {
  q: QuoteRow | null;
  visit: SiteVisitRow | null;
  rq: QuoteRequestRow | null;
  traderFiles: FileItem[];
  jobDocs: FileItem[];
}) {
  const { q, visit, rq, traderFiles, jobDocs } = args;
  if (!q) return [];

  const out: string[] = [];
  const status = normalizeJobStatus(q, visit);

  if (!q.customer_phone && !rq?.customer_phone) {
    out.push("Customer phone number missing");
  }

  if (!q.address && !rq?.address) {
    out.push("Customer address missing");
  }

  if (!visit && (status === "approved" || status === "booked")) {
    out.push("No booking set yet");
  }

  if (!String(q.job_details || "").trim()) {
    out.push("Work description not added");
  }

  if (!String(rq?.trader_notes || "").trim()) {
    out.push("Private notes not added");
  }

  if (status === "complete" || status === "invoiced" || status === "paid") {
    const hasDocs = jobDocs.length > 0;
    if (!hasDocs) {
      out.push("No final documents uploaded");
    }
  }

  if ((status === "in_progress" || status === "complete") && traderFiles.length === 0) {
    out.push("No site files uploaded");
  }

  return out;
}

function getLeftNextAction(params: {
  estimateStatus?: string | null;
  hasVisit: boolean;
  missingCount: number;
  score: number;
}) {
  const { estimateStatus, hasVisit, missingCount, score } = params;

  if (estimateStatus === "accepted") {
    return {
      text: "Next: Book job",
      cls: "ff-leftHint ff-leftHintGreen",
    };
  }

  if (estimateStatus === "sent") {
    return {
      text: "Next: Follow up",
      cls: "ff-leftHint ff-leftHintBlue",
    };
  }

  if (!estimateStatus && hasVisit) {
    return {
      text: "Next: Quote now",
      cls: "ff-leftHint ff-leftHintGreen",
    };
  }

  if (!estimateStatus && missingCount >= 2) {
    return {
      text: "Next: Get more info",
      cls: "ff-leftHint ff-leftHintAmber",
    };
  }

  if (!hasVisit && score < 65) {
    return {
      text: "Next: Book visit",
      cls: "ff-leftHint ff-leftHintAmber",
    };
  }

  return {
    text: "Next: Quote now",
    cls: "ff-leftHint ff-leftHintBlue",
  };
}

function getJobHealth(args: {
  q: QuoteRow | null;
  visit: SiteVisitRow | null;
  rq: QuoteRequestRow | null;
  traderFiles: FileItem[];
  jobDocs: FileItem[];
}) {
  const { q, visit, rq, traderFiles, jobDocs } = args;
  if (!q) return [];

  return [
    {
      label: "Customer contact",
      ok: Boolean(q.customer_phone || rq?.customer_phone || q.customer_email || rq?.customer_email),
    },
    {
      label: "Booking",
      ok: Boolean(visit),
    },
    {
      label: "Work description",
      ok: Boolean(String(q.job_details || "").trim()),
    },
    {
      label: "Private notes",
      ok: Boolean(String(rq?.trader_notes || "").trim()),
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

async function listFilesWithSignedUrls(folder: string): Promise<FileItem[]> {
  const bucket = supabase.storage.from(BUCKET);
  const { data, error } = await bucket.list(folder, { limit: 100 });

  if (error || !data) return [];

  const files = data.filter((f) => f.name && f.name !== ".emptyFolderPlaceholder");
  const out: FileItem[] = [];

  for (const f of files) {
    const path = `${folder}/${f.name}`;
    const { data: signed, error: signErr } = await bucket.createSignedUrl(
      path,
      60 * 10
    );

    out.push({
      name: f.name,
      path,
      url: signErr ? null : signed?.signedUrl ?? null,
    });
  }

  return out;
}

async function getFileMetaMap(
  requestId: string,
  area: "customer" | "trader" | "documents"
) {
  const { data, error } = await supabase
    .from("job_files")
    .select("id, path, area, label")
    .eq("request_id", requestId)
    .eq("area", area);

  if (error || !data) return {};

  const map: Record<
    string,
    {
      id?: string;
      area?: "customer" | "trader" | "documents";
      label?: string | null;
    }
  > = {};

  for (const row of data as Array<{
    id: string;
    path: string;
    area: "customer" | "trader" | "documents";
    label: string | null;
  }>) {
    map[row.path] = {
      id: row.id,
      area: row.area,
      label: row.label,
    };
  }

  return map;
}

/* ================== SMALL UI ================== */

function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ff-empty">
      <div className="ff-emptyTitle">{title}</div>
      {sub ? <div className="ff-emptySub">{sub}</div> : null}
    </div>
  );
}

/* ================== PAGE ================== */

export default function JobsClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const quoteIdFromUrl = cleanId(sp.get("quoteId"));

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
 const [toast, setToast] = useState<{
  text: string;
  type?: "success" | "error";
} | null>(null);

  const [postcodeFilter, setPostcodeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | "approved" | "booked" | "in_progress" | "complete"
  >("");

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const [rq, setRq] = useState<QuoteRequestRow | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  const [workDescription, setWorkDescription] = useState("");
  const [traderRef, setTraderRef] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [vatRate, setVatRate] = useState<"0" | "20">("20");
  const [vatRegistered, setVatRegistered] = useState(true);

  const [jobNotes, setJobNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const [saving, setSaving] = useState(false);

  const [custFiles, setCustFiles] = useState<FileItem[]>([]);
  const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [siteVisit, setSiteVisit] = useState<SiteVisitRow | null>(null);
  const [siteVisitLoading, setSiteVisitLoading] = useState(false);

  const [jobDocs, setJobDocs] = useState<FileItem[]>([]);
  const [traderFileLabel, setTraderFileLabel] = useState("site_photo");
  const [docLabel, setDocLabel] = useState("certificate");
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsMsg, setDocsMsg] = useState<string | null>(null);
  const [docsUploading, setDocsUploading] = useState(false);

  const [requestUrgencyById, setRequestUrgencyById] = useState<
    Record<string, string | null>
  >({});
  const [requestJobNumberById, setRequestJobNumberById] = useState<
    Record<string, string | null>
  >({});
  const [visitMap, setVisitMap] = useState<Record<string, SiteVisitRow | null>>(
    {}
  );

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) || null,
    [quotes, selectedQuoteId]
  );

  const effectiveRequestId = useMemo(() => {
    const id = cleanId(selectedQuote?.request_id || "");
    return id && isUuid(id) ? id : "";
  }, [selectedQuote?.request_id]);

  const currentVisit = useMemo(() => {
    if (!selectedQuote) return null;
    return visitMap[cleanId(selectedQuote.request_id)] ?? siteVisit ?? null;
  }, [selectedQuote, visitMap, siteVisit]);

  const currentJobChip = useMemo(() => {
    if (!selectedQuote) return null;
    return jobStatusChip(selectedQuote, currentVisit);
  }, [selectedQuote, currentVisit]);

  const currentStage = useMemo(() => {
    if (!selectedQuote) return 0;
    return getJobStage(selectedQuote, currentVisit);
  }, [selectedQuote, currentVisit]);

  const currentAction = useMemo(() => {
    if (!selectedQuote) return "";
    return nextActionLabel(selectedQuote, currentVisit);
  }, [selectedQuote, currentVisit]);

  const currentActionText = useMemo(() => {
    if (!selectedQuote) return "";
    return nextActionDescription(selectedQuote, currentVisit);
  }, [selectedQuote, currentVisit]);

  const stageItems = useMemo(() => stageItemsForJobs(), []);

  const missingItems = useMemo(() => {
    return getMissingItems({
      q: selectedQuote,
      visit: currentVisit,
      rq,
      traderFiles,
      jobDocs,
    });
  }, [selectedQuote, currentVisit, rq, traderFiles, jobDocs]);

  const jobHealth = useMemo(() => {
    return getJobHealth({
      q: selectedQuote,
      visit: currentVisit,
      rq,
      traderFiles,
      jobDocs,
    });
  }, [selectedQuote, currentVisit, rq, traderFiles, jobDocs]);

  /* ================== LOADERS ================== */

  async function loadRequestUrgencies(traderId: string, requestIds: string[]) {
    const ids = Array.from(
      new Set(requestIds.map(cleanId).filter((id) => id && isUuid(id)))
    );

    if (!ids.length) {
      setRequestUrgencyById({});
      setRequestJobNumberById({});
      return;
    }

    const { data, error } = await supabase
      .from("quote_requests")
      .select("id, urgency, job_number")
      .eq("plumber_id", traderId)
      .in("id", ids);

    if (error) {
      setRequestUrgencyById({});
      setRequestJobNumberById({});
      return;
    }

    const urgencyMap: Record<string, string | null> = {};
    const jobNumberMap: Record<string, string | null> = {};

    for (const r of data || []) {
      const row = r as {
        id: string;
        urgency: string | null;
        job_number?: string | null;
      };

      urgencyMap[row.id] = row.urgency ?? null;
      jobNumberMap[row.id] = row.job_number ?? null;
    }

    setRequestUrgencyById(urgencyMap);
    setRequestJobNumberById(jobNumberMap);
  }

  async function loadVisitMap(traderId: string, requestIds: string[]) {
    const ids = Array.from(
      new Set(requestIds.map(cleanId).filter((id) => id && isUuid(id)))
    );

    if (!ids.length) {
      setVisitMap({});
      return;
    }

    const { data, error } = await supabase
      .from("site_visits")
      .select("id, request_id, plumber_id, starts_at, duration_mins, created_at")
      .eq("plumber_id", traderId)
      .in("request_id", ids)
      .order("created_at", { ascending: false });

    if (error) {
      setVisitMap({});
      return;
    }

    const map: Record<string, SiteVisitRow | null> = {};
    ids.forEach((id) => {
      map[id] = null;
    });

    for (const row of (data || []) as SiteVisitRow[]) {
      if (!map[row.request_id]) {
        map[row.request_id] = row;
      }
    }

    setVisitMap(map);
  }

  async function loadQuotes(traderId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "id,plumber_id,request_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,vat_rate,subtotal,note,job_details,trader_ref,status,sent_at,created_at"
      )
      .eq("plumber_id", traderId)
      .or("status.ilike.%approved%,status.ilike.%accepted%,status.ilike.%booked%,status.ilike.%progress%,status.ilike.%complete%,status.ilike.%invoice%,status.ilike.%paid%")
      .order("created_at", { ascending: false });

    if (error) {
      setToast({ text: `Load failed: ${error.message}`, type: "error" });
      setQuotes([]);
      return;
    }

    const list = (data || []) as QuoteRow[];
    setQuotes(list);

    const requestIds = list.map((q) => q.request_id || "");
    await loadRequestUrgencies(traderId, requestIds);
    await loadVisitMap(traderId, requestIds);
  }

  async function loadRequest(traderId: string, rqId: string) {
    const id = cleanId(rqId);
    if (!id || !isUuid(id)) return;

    const { data } = await supabase
      .from("quote_requests")
      .select(
        "id,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,trader_notes,created_at,job_number"
      )
      .eq("id", id)
      .eq("plumber_id", traderId)
      .maybeSingle();

    setRq((data as QuoteRequestRow) || null);
  }

  async function loadSiteVisit(requestId: string, plumberId: string) {
    const rid = cleanId(requestId);
    if (!rid || !isUuid(rid)) {
      setSiteVisit(null);
      return;
    }

    setSiteVisitLoading(true);

    try {
      const { data } = await supabase
        .from("site_visits")
        .select("id, request_id, plumber_id, starts_at, duration_mins, created_at")
        .eq("request_id", rid)
        .eq("plumber_id", plumberId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setSiteVisit((data as SiteVisitRow) || null);
    } finally {
      setSiteVisitLoading(false);
    }
  }

  async function loadAttachments(rqId: string) {
    const id = cleanId(rqId);
    if (!id || !isUuid(id)) {
      setCustFiles([]);
      setTraderFiles([]);
      return;
    }

    setFilesLoading(true);
    setFileMsg(null);

    try {
      const [customerFiles, traderFiles, customerMeta, traderMeta] =
        await Promise.all([
          listFilesWithSignedUrls(customerFolder(id)),
          listFilesWithSignedUrls(traderFolder(id)),
          getFileMetaMap(id, "customer"),
          getFileMetaMap(id, "trader"),
        ]);

      setCustFiles(
        customerFiles.map((f) => ({
          ...f,
          id: customerMeta[f.path]?.id,
          area: "customer" as const,
          label: customerMeta[f.path]?.label ?? null,
        }))
      );

      setTraderFiles(
        traderFiles.map((f) => ({
          ...f,
          id: traderMeta[f.path]?.id,
          area: "trader" as const,
          label: traderMeta[f.path]?.label ?? null,
        }))
      );
    } finally {
      setFilesLoading(false);
    }
  }

  async function loadJobDocuments(requestId: string) {
    const id = cleanId(requestId);
    if (!id || !isUuid(id)) {
      setJobDocs([]);
      return;
    }

    setDocsLoading(true);
    setDocsMsg(null);

    try {
      const [docs, docsMeta] = await Promise.all([
        listFilesWithSignedUrls(docsFolder(id)),
        getFileMetaMap(id, "documents"),
      ]);

      setJobDocs(
        docs.map((f) => ({
          ...f,
          id: docsMeta[f.path]?.id,
          area: "documents" as const,
          label: docsMeta[f.path]?.label ?? null,
        }))
      );
    } finally {
      setDocsLoading(false);
    }
  }

  function fillFormFromQuote(q: QuoteRow) {
    const vr = Number(q.vat_rate ?? 0);
    setVatRegistered(vr > 0);
    setVatRate(vr > 0 ? (String(vr) as "0" | "20") : "0");
    setSubtotal(q.subtotal != null ? String(q.subtotal) : "");
    setWorkDescription((q.job_details || "").trim());
    setTraderRef((q.trader_ref || "").trim());
  }

  /* ================== ACTIONS ================== */

  async function saveJobCore() {
    if (!uid || !selectedQuote) return false;

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
  setToast({ text: `Save failed: ${error.message}`, type: "error" });
  return false;
}

    setToast({ text: "Saved ✓", type: "success" });
    setTimeout(() => setToast(null), 1000);
    await loadQuotes(uid);
    return true;
  }

  async function updateJobStatus(nextStatus: string, okText: string) {
    if (!uid || !selectedQuote) return;

    const { error } = await supabase
      .from("quotes")
      .update({ status: nextStatus })
      .eq("id", selectedQuote.id)
      .eq("plumber_id", uid);

   if (error) {
  setToast({ text: `Update failed: ${error.message}`, type: "error" });
  return;
}

   setToast({ text: okText, type: "success" });
    setTimeout(() => setToast(null), 1200);
    await loadQuotes(uid);
  }

  async function markInProgress() {
    await updateJobStatus("in progress", "Job marked in progress ✓");
  }

  async function markComplete() {
    await updateJobStatus("complete", "Job marked complete ✓");
  }

  async function markInvoiced() {
    await updateJobStatus("invoiced", "Job marked invoiced ✓");
  }

  async function markPaid() {
    await updateJobStatus("paid", "Job marked paid ✓");
  }

  async function downloadPdf() {
    try {
      if (!selectedQuote) return;

      const ok = await saveJobCore();
      if (!ok) return;

      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;

      if (!token) {
        alert("Please log in again.");
        return;
      }

      const url = `/api/estimates/pdf?quoteId=${encodeURIComponent(selectedQuote.id)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PDF failed (${res.status}): ${text.slice(0, 250)}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e: any) {
      alert(e?.message || "PDF failed");
    }
  }

  async function deleteQuote() {
    if (!uid || !selectedQuote) return;

    const ok = confirm("Delete this job? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", selectedQuote.id)
      .eq("plumber_id", uid);

   if (error) {
  setToast({ text: `Delete failed: ${error.message}`, type: "error" });
  return;
}

    setSelectedQuoteId(null);
    setRq(null);
    setCustFiles([]);
    setTraderFiles([]);
    setJobDocs([]);
    setSiteVisit(null);
    router.replace("/dashboard/bookings");
    setToast({ text: "Deleted ✓", type: "success" });
    setTimeout(() => setToast(null), 900);
    await loadQuotes(uid);
  }

  async function saveJobNotes() {
if (!uid || !effectiveRequestId) return;

setNotesSaving(true);

const { error } = await supabase
.from("quote_requests")
.update({
trader_notes: (jobNotes || "").trim() || null,
})
.eq("id", effectiveRequestId)
.eq("plumber_id", uid);

setNotesSaving(false);

if (error) {
setToast({ text: `Notes save failed: ${error.message}`, type: "error" });
return;
}

setToast({ text: "Notes saved ✓", type: "success" });
setTimeout(() => setToast(null), 1000);

await loadRequest(uid, effectiveRequestId);
}
  function goToCreateBooking() {
    const rid = cleanId(selectedQuote?.request_id || "");
    if (!rid) {
      setToast({ text: "This job is not linked to an enquiry.", type: "error" });
      return;
    }

    router.push(`/dashboard/bookings?requestId=${encodeURIComponent(rid)}`);
  }

  async function onUploadTraderFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    if (!effectiveRequestId) {
      setFileMsg("This job isn’t linked to an enquiry.");
      return;
    }

    setUploading(true);
    setFileMsg(null);

    try {
      const fd = new FormData();
      fd.append("requestId", effectiveRequestId);
      fd.append("kind", "trader");
      fd.append("label", traderFileLabel);
      files.forEach((f) => fd.append("files", f, safeFileName(f.name)));

      const res = await fetch("/api/quote-requests/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Upload failed");

      e.target.value = "";
      setFileMsg("Uploaded ✓");
      await loadAttachments(effectiveRequestId);
    } catch (err: any) {
      setFileMsg(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deleteTraderFile(filePath: string) {
    if (!effectiveRequestId) return;

    const ok = confirm("Delete this file?");
    if (!ok) return;

    setUploading(true);
    setFileMsg(null);

    try {
      const fd = new FormData();
      fd.append("requestId", effectiveRequestId);
      fd.append("kind", "trader");
      fd.append("path", filePath);

      const res = await fetch("/api/quote-requests/delete", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Delete failed");

      setFileMsg("Deleted ✓");
      await loadAttachments(effectiveRequestId);
    } catch (e: any) {
      setFileMsg(e?.message || "Delete failed");
    } finally {
      setUploading(false);
    }
  }

  async function onUploadJobDocs(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    if (!effectiveRequestId) {
      setDocsMsg("This job isn’t linked to an enquiry.");
      return;
    }

    setDocsUploading(true);
    setDocsMsg(null);

    try {
      const fd = new FormData();
      fd.append("requestId", effectiveRequestId);
      fd.append("kind", "documents");
      fd.append("label", docLabel);
      files.forEach((f) => fd.append("files", f, safeFileName(f.name)));

      const res = await fetch("/api/quote-requests/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Upload failed");

      e.target.value = "";
      setDocsMsg("Uploaded ✓");
      await loadJobDocuments(effectiveRequestId);
    } catch (err: any) {
      setDocsMsg(err?.message || "Upload failed");
    } finally {
      setDocsUploading(false);
    }
  }

  async function deleteJobDoc(filePath: string) {
    if (!effectiveRequestId) return;

    const ok = confirm("Delete this document?");
    if (!ok) return;

    setDocsUploading(true);
    setDocsMsg(null);

    try {
      const fd = new FormData();
      fd.append("requestId", effectiveRequestId);
      fd.append("kind", "documents");
      fd.append("path", filePath);

      const res = await fetch("/api/quote-requests/delete", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Delete failed");

      setDocsMsg("Deleted ✓");
      await loadJobDocuments(effectiveRequestId);
    } catch (e: any) {
      setDocsMsg(e?.message || "Delete failed");
    } finally {
      setDocsUploading(false);
    }
  }

  /* ================== EFFECTS ================== */

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      if (!mounted) return;
      setUid(userId);

      if (!userId) {
        setLoading(false);
        setToast({ text: "Please log in.", type: "error" });
        return;
      }

      await loadQuotes(userId);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const qid = cleanId(quoteIdFromUrl);
    if (!qid) return;
    setSelectedQuoteId(qid);
  }, [quoteIdFromUrl]);

  useEffect(() => {
    if (!uid || !selectedQuote) return;

    fillFormFromQuote(selectedQuote);
    setTab("overview");

    const rid = cleanId(selectedQuote.request_id || "");
    if (rid && isUuid(rid)) {
      loadRequest(uid, rid);
      loadAttachments(rid);
      loadSiteVisit(rid, uid);
      loadJobDocuments(rid);
    } else {
      setRq(null);
      setCustFiles([]);
      setTraderFiles([]);
      setJobDocs([]);
      setSiteVisit(null);
    }
  }, [uid, selectedQuote?.id]);

  useEffect(() => {
    setJobNotes((rq?.trader_notes || "").trim());
  }, [rq?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ================== MEMOS ================== */

 const visibleQuotes = useMemo(() => {
  let list = [...quotes];

  if (statusFilter) {
    list = list.filter((q) => {
      const s = normalizeJobStatus(q, visitMap[cleanId(q.request_id)] ?? null);
      return s === statusFilter;
    });
  }

  if (postcodeFilter.trim()) {
    const needle = postcodeFilter.trim().toLowerCase();
    list = list.filter((q) =>
      `${q.postcode || ""} ${q.address || ""}`.toLowerCase().includes(needle)
    );
  }

  return list;
}, [quotes, statusFilter, postcodeFilter, visitMap]);

  const counts = useMemo(() => {
    const all = quotes.length;
    const approved = quotes.filter((q) => {
      const s = normalizeJobStatus(q, visitMap[cleanId(q.request_id)] ?? null);
      return s === "approved";
    }).length;

    const booked = quotes.filter((q) => {
      const s = normalizeJobStatus(q, visitMap[cleanId(q.request_id)] ?? null);
      return s === "booked";
    }).length;

    const live = quotes.filter((q) => {
      const s = normalizeJobStatus(q, visitMap[cleanId(q.request_id)] ?? null);
      return s === "in_progress" || s === "complete";
    }).length;

    return { all, approved, booked, live };
  }, [quotes, visitMap]);

 if (loading) {
  return (
    <div style={{ padding: 14, fontSize: 13, color: FF.muted }}>
      Loading jobs…
    </div>
  );
}

const mobileDetail = selectedQuote ? "1" : "0";

return (
  <div className="ff-page" data-mobile-detail={mobileDetail}>
    <div className="ff-wrap">
      <div className="ff-top">
        <div className="ff-hero">
          <div className="ff-heroGlow" />

          <div className="ff-heroRow">
            <div className="ff-heroLeft">
              <div className="ff-heroTitle">Jobs</div>
              <div className="ff-heroRule" />
              <div className="ff-heroSub">
                Approved work, bookings, notes, files and completion documents
                in one place.
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
              className={`ff-pillSmall ${
                !statusFilter ? "ff-pillNeutralActive" : ""
              }`}
              type="button"
              onClick={() => setStatusFilter("")}
            >
              All {counts.all}
            </button>

            <button
              className={`ff-pillSmall ${
                statusFilter === "approved" ? "ff-pillNeutralActive" : ""
              }`}
              type="button"
              onClick={() => setStatusFilter("approved")}
            >
              Approved {counts.approved}
            </button>

            <button
              className={`ff-pillSmall ${
                statusFilter === "booked" ? "ff-pillNeutralActive" : ""
              }`}
              type="button"
              onClick={() => setStatusFilter("booked")}
            >
              Booked {counts.booked}
            </button>

            <button
              className={`ff-pillSmall ${
                statusFilter === "in_progress" ? "ff-pillNeutralActive" : ""
              }`}
              type="button"
              onClick={() => setStatusFilter("in_progress")}
            >
              Live {counts.live}
            </button>
          </div>

          <div className="ff-filterRight">
            <input
              className="ff-input"
              placeholder="Postcode / area"
              value={postcodeFilter}
              onChange={(e) => setPostcodeFilter(e.target.value)}
            />

            <button
              className="ff-btn ff-btnGhost ff-btnSm"
              type="button"
              onClick={() => uid && loadQuotes(uid)}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

     {toast ? (
  <div className={`ff-toast ${toast.type === "error" ? "ff-toastError" : "ff-toastSuccess"}`}>
    {toast.text}
  </div>
) : null}

      <div className="ff-mainShell">
        <div className="ff-leftPane">
          <div className="ff-leftTop">
            <div className="ff-leftTitleRow">
              <div className="ff-leftTitle">All jobs</div>
              <div className="ff-leftCount">{visibleQuotes.length}</div>
            </div>
          </div>

          <div className="ff-leftList">
            {visibleQuotes.length ? (
              visibleQuotes.map((q) => {
                const active = q.id === selectedQuoteId;

                const requestUrgency =
                  q.urgency ?? requestUrgencyById[cleanId(q.request_id)] ?? "";

                const requestJobNumber =
                  requestJobNumberById[cleanId(q.request_id)] ?? null;

                const urg = urgencyChip(requestUrgency);
                const visit = visitMap[cleanId(q.request_id)] ?? null;
                const jobChip = jobStatusChip(q, visit);
                const nextStep = nextActionLabel(q, visit);

                const urgencyGlow =
                  urg.text === "ASAP"
                    ? "ff-leftGlowASAP"
                    : urg.text === "This week"
                    ? "ff-leftGlowWeek"
                    : urg.text === "Next week"
                    ? "ff-leftGlowNext"
                    : urg.text === "Flexible"
                    ? "ff-leftGlowFlexible"
                    : "";

                return (
                  <button
                    key={q.id}
                    className={`ff-leftItem ${urgencyGlow} ${
                      active ? "isActive" : ""
                    }`}
                    type="button"
                    onClick={() => {
                      setSelectedQuoteId(q.id);
                      setTab("overview");
                      router.replace(
                        `/dashboard/bookings?quoteId=${encodeURIComponent(q.id)}`
                      );
                    }}
                  >
                    <div className="ff-leftItemTop">
                      <div className="ff-leftJobWrap">
                        <div className="ff-jobNumber">
                          {requestJobNumber || q.customer_name || "Job"}
                        </div>
                        <div className="ff-leftDate">
                          {niceDateOnly(q.created_at)}
                        </div>
                      </div>

                      <div className="ff-leftChipRow">
                        {urg.text ? (
                          <span className={urg.cls}>{urg.text}</span>
                        ) : null}
                        <span className={jobChip.cls}>{jobChip.text}</span>
                      </div>
                    </div>

                    <div className="ff-leftMain">
                      <div className="ff-leftJobTitle">
                        {titleCase(q.job_type || "Job")}
                      </div>

                      <div className="ff-leftAddress">
                        {q.address || formatPostcode(q.postcode) || "No address"}
                      </div>
                    </div>

                    <div className="ff-leftMetaRow">
                      <div className="ff-leftMetaText">
                        {money(q.subtotal ?? 0)}
                      </div>
                      <div className="ff-leftMetaText">
                        {visit ? niceDate(visit.starts_at) : "Not booked yet"}
                      </div>
                    </div>

                    <div className="ff-leftHintWrap">
                      <div className="ff-leftHint ff-leftHintBlue">
                        Next: {nextStep}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="ff-emptyWrap">
                <EmptyState
                  title="No jobs match your filters"
                  sub="Try another status or postcode."
                />
              </div>
            )}
          </div>
        </div>

       <div className="ff-rightPane">
  <div className="ff-rightBody">
    {!selectedQuote ? (
      <div className="ff-emptyWrap">
        <EmptyState
          title="Select a job"
          sub="Choose a job from the list to view booking details, notes, files, progress and final documents."
        />
      </div>
    ) : (
              <>
                <button
                  className="ff-backMobile"
                  type="button"
                  onClick={() => {
                    setSelectedQuoteId(null);
                    router.replace("/dashboard/bookings");
                  }}
                >
                  ← Back to jobs
                </button>

                <div className="ff-rightTop">
                  <div className="ff-rightTopLeft">
                    <div className="ff-rightJobNo">
                      {requestJobNumberById[cleanId(selectedQuote.request_id)] ||
                        "Job"}
                    </div>
                    <div className="ff-rightTitle">
                      {titleCase(selectedQuote.job_type || "Job")}
                    </div>
                    <div className="ff-rightSub">
                      {selectedQuote.customer_name || rq?.customer_name || "Customer"} •{" "}
                      {formatPostcode(selectedQuote.postcode || rq?.postcode) || "—"}
                    </div>

                    <div className="ff-rightStatusRow">
                      {currentJobChip ? (
                        <span className={currentJobChip.cls}>
                          {currentJobChip.text}
                        </span>
                      ) : null}

                      <span className="ff-chip ff-chipNeutral">{currentAction}</span>
                    </div>
                  </div>

                  <div className="ff-rightTopActions">
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
                      className="ff-btn ff-btnGhost ff-btnSm"
                      onClick={downloadPdf}
                    >
                      Job PDF
                    </button>

                    <button
                      type="button"
                      className="ff-btn ff-btnPrimary ff-btnSm"
                      onClick={goToCreateBooking}
                      disabled={!selectedQuote?.request_id}
                    >
                      Create booking
                    </button>

                    <button
                      type="button"
                      className="ff-btn ff-btnDanger ff-btnSm"
                      onClick={deleteQuote}
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
                  <button
                    className={`ff-tabBtn ${
                      tab === "overview" ? "isActive" : ""
                    }`}
                    onClick={() => setTab("overview")}
                    type="button"
                  >
                    Overview
                  </button>

                  <button
                    className={`ff-tabBtn ${tab === "visit" ? "isActive" : ""}`}
                    onClick={() => setTab("visit")}
                    type="button"
                  >
                    Booking
                  </button>

                  <button
                    className={`ff-tabBtn ${tab === "files" ? "isActive" : ""}`}
                    onClick={() => setTab("files")}
                    type="button"
                  >
                    Files
                  </button>

                  <button
                    className={`ff-tabBtn ${tab === "notes" ? "isActive" : ""}`}
                    onClick={() => setTab("notes")}
                    type="button"
                  >
                    Notes
                  </button>

                  <button
                    className={`ff-tabBtn ${
                      tab === "timeline" ? "isActive" : ""
                    }`}
                    onClick={() => setTab("timeline")}
                    type="button"
                  >
                    Timeline
                  </button>

                  <button
                    className={`ff-tabBtn ${
                      tab === "documents" ? "isActive" : ""
                    }`}
                    onClick={() => setTab("documents")}
                    type="button"
                  >
                    Documents
                  </button>
                </div>

                <div className="ff-rightInner">
                  {tab === "overview" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-nextStepCard">
                        <div className="ff-nextStepTop">
                          <div>
                            <div className="ff-nextStepEyebrow">Best next action</div>
                            <div className="ff-nextStepTitle">{currentAction}</div>
                            <div className="ff-nextStepText">{currentActionText}</div>
                          </div>

                          <div className="ff-nextStepActions">
                            {normalizeJobStatus(selectedQuote, currentVisit) ===
                            "approved" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnPrimary ff-btnSm"
                                onClick={goToCreateBooking}
                              >
                                Create booking
                              </button>
                            ) : null}

                            {normalizeJobStatus(selectedQuote, currentVisit) ===
                            "booked" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnPrimary ff-btnSm"
                                onClick={markInProgress}
                              >
                                Start job
                              </button>
                            ) : null}

                            {normalizeJobStatus(selectedQuote, currentVisit) ===
                            "in_progress" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnPrimary ff-btnSm"
                                onClick={markComplete}
                              >
                                Mark complete
                              </button>
                            ) : null}

                            {normalizeJobStatus(selectedQuote, currentVisit) ===
                            "complete" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnPrimary ff-btnSm"
                                onClick={markInvoiced}
                              >
                                Mark invoiced
                              </button>
                            ) : null}

                            {normalizeJobStatus(selectedQuote, currentVisit) ===
                            "invoiced" ? (
                              <button
                                type="button"
                                className="ff-btn ff-btnPrimary ff-btnSm"
                                onClick={markPaid}
                              >
                                Mark paid
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {missingItems.length ? (
                        <div className="ff-detailCard ff-warningCard">
                          <div className="ff-cardTitleRow">
                            <div>
                              <div className="ff-detailLabel">Attention</div>
                              <div className="ff-cardTitle">Missing items</div>
                            </div>
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
                        <div className="ff-detailCard ff-successCard">
                          <div className="ff-cardTitleRow">
                            <div>
                              <div className="ff-detailLabel">Status</div>
                              <div className="ff-cardTitle">
                                Nothing important missing
                              </div>
                            </div>
                          </div>

                          <div className="ff-detailSub">
                            This job is looking organised. Booking, notes, files
                            and documents are on track.
                          </div>
                        </div>
                      )}

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

                      <div className="ff-detailCard">
                        <div className="ff-cardTitleRow">
                          <div>
                            <div className="ff-detailLabel">Job overview</div>
                            <div className="ff-cardTitle">Customer and site</div>
                          </div>

                          <div className="ff-cardTitleChips">
                            {currentJobChip ? (
                              <span className={currentJobChip.cls}>
                                {currentJobChip.text}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Customer</div>
                          <div className="ff-detailValue">
                            {selectedQuote.customer_name || rq?.customer_name || "—"}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Phone</div>
                          <div className="ff-detailValue">
                            {selectedQuote.customer_phone || rq?.customer_phone || "—"}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Email</div>
                          <div className="ff-detailValue">
                            {selectedQuote.customer_email || rq?.customer_email || "—"}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Address</div>
                          <div className="ff-detailValue">
                            {selectedQuote.address || rq?.address || "—"}
                            {selectedQuote.postcode || rq?.postcode ? (
                              <div className="ff-detailValueSub">
                                {formatPostcode(
                                  selectedQuote.postcode || rq?.postcode || ""
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Quick actions</div>
                          <div className="ff-inlineActions">
                            {selectedQuote.customer_phone || rq?.customer_phone ? (
                              <a
                                className="ff-inlineBtn"
                                href={telHref(
                                  selectedQuote.customer_phone || rq?.customer_phone
                                )}
                              >
                                Call customer
                              </a>
                            ) : null}

                            {selectedQuote.customer_email || rq?.customer_email ? (
                              <button
                                type="button"
                                className="ff-inlineBtn"
                                onClick={() => {
                                  window.location.href = `mailto:${
                                    selectedQuote.customer_email ||
                                    rq?.customer_email ||
                                    ""
                                  }`;
                                }}
                              >
                                Email customer
                              </button>
                            ) : null}

                            {selectedQuote.address ||
                            rq?.address ||
                            selectedQuote.postcode ||
                            rq?.postcode ? (
                              <button
                                type="button"
                                className="ff-inlineBtn"
                                onClick={() => {
                                  const query = encodeURIComponent(
                                    `${
                                      selectedQuote.address || rq?.address || ""
                                    } ${
                                      selectedQuote.postcode || rq?.postcode || ""
                                    }`.trim()
                                  );

                                  window.open(
                                    `https://www.google.com/maps/search/?api=1&query=${query}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                  );
                                }}
                              >
                                Open maps
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="ff-inlineBtn"
                              onClick={downloadPdf}
                            >
                              Open PDF
                            </button>
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Job type</div>
                          <div className="ff-detailValue">
                            {titleCase(selectedQuote.job_type || rq?.job_type || "—")}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Urgency</div>
                          <div className="ff-detailValue">
                            {titleCase(
                              selectedQuote.urgency ||
                                rq?.urgency ||
                                requestUrgencyById[cleanId(selectedQuote.request_id)] ||
                                "—"
                            )}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Trader ref</div>
                          <input
                            className="ff-inputWide"
                            value={traderRef}
                            onChange={(e) => setTraderRef(e.target.value)}
                            placeholder="Optional reference"
                          />
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Work description</div>
                          <textarea
                            className="ff-textarea"
                            value={workDescription}
                            onChange={(e) => setWorkDescription(e.target.value)}
                            placeholder="Describe the work being carried out…"
                          />
                        </div>
                      </div>

                      <div className="ff-detailCard">
                        <div className="ff-cardTitleRow">
                          <div>
                            <div className="ff-detailLabel">Job value</div>
                            <div className="ff-cardTitle">Price summary</div>
                          </div>
                        </div>

                        <div className="ff-priceHero">
                          <div className="ff-priceHeroLabel">Current total</div>
                          <div className="ff-priceHeroValue">
                            {(() => {
                              const s = Number(subtotal || 0) || 0;
                              const vr = vatRegistered ? Number(vatRate) : 0;
                              const vatAmount = s * (vr / 100);
                              const total = s + vatAmount;
                              return `£${total.toFixed(2)}`;
                            })()}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Subtotal</div>

                          <div style={{ position: "relative", maxWidth: 240 }}>
                            <span className="ff-currencyPrefix">£</span>

                            <input
                              className="ff-inputWide"
                              inputMode="decimal"
                              value={subtotal}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^\d.]/g, "");
                                setSubtotal(val);
                              }}
                              onBlur={() => {
                                if (!subtotal) {
                                  setSubtotal("0.00");
                                  return;
                                }

                                const n = Number(subtotal);
                                setSubtotal(
                                  Number.isFinite(n) ? n.toFixed(2) : "0.00"
                                );
                              }}
                              placeholder="0.00"
                              style={{ paddingLeft: 28 }}
                            />
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">VAT registered?</div>

                          <div className="ff-vatRow">
                            <button
                              type="button"
                              className={`ff-pillSmall ${
                                vatRegistered ? "ff-pillNeutralActive" : ""
                              }`}
                              onClick={() => setVatRegistered(true)}
                            >
                              Yes
                            </button>

                            <button
                              type="button"
                              className={`ff-pillSmall ${
                                !vatRegistered ? "ff-pillNeutralActive" : ""
                              }`}
                              onClick={() => {
                                setVatRegistered(false);
                                setVatRate("0");
                              }}
                            >
                              No
                            </button>

                            {vatRegistered ? (
                              <select
                                className="ff-inputWide"
                                value={vatRate}
                                onChange={(e) =>
                                  setVatRate(e.target.value as "0" | "20")
                                }
                                style={{ maxWidth: 140 }}
                              >
                                <option value="20">20%</option>
                                <option value="0">0%</option>
                              </select>
                            ) : (
                              <div className="ff-detailValueSub">
                                VAT will not be added.
                              </div>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const s = Number(subtotal || 0) || 0;
                          const vr = vatRegistered ? Number(vatRate) : 0;
                          const vatAmount = s * (vr / 100);
                          const total = s + vatAmount;

                          return (
                            <>
                              {vatRegistered && vr > 0 ? (
                                <div className="ff-detailRow">
                                  <div className="ff-detailLabel">VAT ({vr}%)</div>
                                  <div className="ff-detailValue">
                                    £{vatAmount.toFixed(2)}
                                  </div>
                                </div>
                              ) : null}

                              <div className="ff-detailRow">
                                <div className="ff-detailLabel">Total</div>
                                <div className="ff-detailValue ff-totalValue">
                                  £{total.toFixed(2)}
                                </div>
                              </div>
                            </>
                          );
                        })()}

                        <div className="ff-sendRow">
                          <button
                            type="button"
                            className="ff-btn ff-btnGhost ff-btnSm"
                            onClick={saveJobCore}
                            disabled={saving}
                          >
                            {saving ? "Saving…" : "Save changes"}
                          </button>

                          <button
                            type="button"
                            className="ff-btn ff-btnPrimary ff-btnSm"
                            onClick={downloadPdf}
                          >
                            View job PDF
                          </button>
                        </div>
                      </div>

                      {rq ? (
                        <div className="ff-detailCard">
                          <div className="ff-cardTitleRow">
                            <div>
                              <div className="ff-detailLabel">Original enquiry</div>
                              <div className="ff-cardTitle">Customer request</div>
                            </div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Enquiry details</div>
                            <div className="ff-detailValue">{rq.details || "—"}</div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Received</div>
                            <div className="ff-detailValue">{niceDate(rq.created_at)}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {tab === "visit" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-detailCard">
                        <div className="ff-cardTitleRow">
                          <div>
                            <div className="ff-detailLabel">Booking</div>
                            <div className="ff-cardTitle">Visit details</div>
                          </div>
                        </div>

                        {siteVisitLoading ? (
                          <div className="ff-detailSub">Loading…</div>
                        ) : (
                          <>
                            <div className="ff-detailRow">
                              <div className="ff-detailLabel">Booking status</div>
                              <div className="ff-detailValue">
                                <span
                                  className={
                                    currentVisit
                                      ? "ff-chip ff-chipBlueSoft"
                                      : "ff-chip ff-chipNeutral"
                                  }
                                >
                                  {currentVisit ? "Booked" : "Not booked"}
                                </span>
                              </div>
                            </div>

                            <div className="ff-detailRow">
                              <div className="ff-detailLabel">Date</div>
                              <div className="ff-detailValue">
                                {currentVisit
                                  ? new Date(currentVisit.starts_at).toLocaleDateString(
                                      [],
                                      {
                                        weekday: "short",
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      }
                                    )
                                  : "—"}
                              </div>
                            </div>

                            <div className="ff-detailRow">
                              <div className="ff-detailLabel">Time</div>
                              <div className="ff-detailValue">
                                {currentVisit
                                  ? new Date(currentVisit.starts_at).toLocaleTimeString(
                                      [],
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )
                                  : "—"}
                              </div>
                            </div>

                            <div className="ff-detailRow">
                              <div className="ff-detailLabel">Duration</div>
                              <div className="ff-detailValue">
                                {currentVisit
                                  ? `${currentVisit.duration_mins} mins`
                                  : "—"}
                              </div>
                            </div>

                            <div className="ff-detailRow">
                              <div className="ff-detailLabel">Next action</div>
                              <div className="ff-detailValue">{currentAction}</div>
                            </div>

                            <div className="ff-sendRow">
                              <button
                                type="button"
                                className="ff-btn ff-btnPrimary ff-btnSm"
                                onClick={goToCreateBooking}
                              >
                                {currentVisit ? "Open booking" : "Create booking"}
                              </button>

                              {normalizeJobStatus(selectedQuote, currentVisit) ===
                              "booked" ? (
                                <button
                                  type="button"
                                  className="ff-btn ff-btnGhost ff-btnSm"
                                  onClick={markInProgress}
                                >
                                  Start job
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {tab === "files" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-detailCard">
                        <div className="ff-cardTitleRow">
                          <div>
                            <div className="ff-detailLabel">Customer files</div>
                            <div className="ff-cardTitle">
                              Photos and customer uploads
                            </div>
                          </div>
                        </div>

                        {filesLoading ? (
                          <div className="ff-detailSub">Loading…</div>
                        ) : custFiles.length ? (
                          custFiles.map((f, idx) => (
                            <div className="ff-fileRow" key={`${f.path}-${idx}`}>
                              <div style={{ minWidth: 0 }}>
                                <div className="ff-fileName">{f.name}</div>
                                <div className="ff-fileMeta">
                                  {fileTypeLabel(f.name)}
                                </div>
                                {f.label ? (
                                  <div className="ff-detailSub" style={{ marginTop: 4 }}>
                                    {labelText(f.label)}
                                  </div>
                                ) : null}
                              </div>

                              {f.url ? (
                                <a
                                  className="ff-a"
                                  href={f.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              ) : (
                                <span className="ff-detailSub">—</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="ff-detailSub">No customer files.</div>
                        )}
                      </div>

                      <div className="ff-detailCard">
                        <div className="ff-cardTitleRow">
                          <div>
                            <div className="ff-detailLabel">Trader files</div>
                            <div className="ff-cardTitle">
                              Site photos and working files
                            </div>
                          </div>
                        </div>

                        <select
                          className="ff-inputWide"
                          value={traderFileLabel}
                          onChange={(e) => setTraderFileLabel(e.target.value)}
                          style={{ maxWidth: 220, marginBottom: 10 }}
                        >
                          {TRADER_FILE_LABELS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.text}
                            </option>
                          ))}
                        </select>

                        <input
                          type="file"
                          multiple
                          onChange={onUploadTraderFiles}
                          disabled={uploading || !effectiveRequestId}
                        />

                        <div style={{ height: 10 }} />

                        {fileMsg ? <div className="ff-detailSub">{fileMsg}</div> : null}

                        {filesLoading ? (
                          <div className="ff-detailSub">Loading…</div>
                        ) : traderFiles.length ? (
                          traderFiles.map((f, idx) => (
                            <div className="ff-fileRow" key={`${f.path}-${idx}`}>
                              <div style={{ minWidth: 0 }}>
                                <div className="ff-fileName">{f.name}</div>
                                <div className="ff-fileMeta">
                                  {fileTypeLabel(f.name)}
                                </div>
                                {f.label ? (
                                  <div className="ff-detailSub" style={{ marginTop: 4 }}>
                                    {labelText(f.label)}
                                  </div>
                                ) : null}
                              </div>

                              <div className="ff-fileActions">
                                {f.url ? (
                                  <a
                                    className="ff-a"
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Open
                                  </a>
                                ) : (
                                  <span className="ff-detailSub">—</span>
                                )}

                                <button
                                  className="ff-inlineBtn"
                                  type="button"
                                  onClick={() => deleteTraderFile(f.path)}
                                  disabled={uploading}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="ff-detailSub">No trader files.</div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {tab === "notes" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-detailCard">
                        <div className="ff-cardTitleRow">
                          <div>
                            <div className="ff-detailLabel">Private notes</div>
                            <div className="ff-cardTitle">Job notes</div>
                          </div>
                        </div>

                        <div className="ff-notesPrompts">
                          <div className="ff-notesPrompt">Access notes</div>
                          <div className="ff-notesPrompt">Parking</div>
                          <div className="ff-notesPrompt">Parts needed</div>
                          <div className="ff-notesPrompt">Anything to remember</div>
                        </div>

                        <textarea
                          className="ff-textarea"
                          value={jobNotes}
                          onChange={(e) => setJobNotes(e.target.value)}
                          placeholder="Access notes, parking info, tools needed, parts needed, customer preferences…"
                        />

                        <div className="ff-sendRow" style={{ marginTop: 12 }}>
                          <button
                            className="ff-btn ff-btnGhost ff-btnSm"
                            type="button"
                            onClick={saveJobNotes}
                            disabled={notesSaving}
                          >
                            {notesSaving ? "Saving…" : "Save notes"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "timeline" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-detailCard">
                        <div className="ff-cardTitleRow">
                          <div>
                            <div className="ff-detailLabel">Progress</div>
                            <div className="ff-cardTitle">Job timeline</div>
                          </div>
                        </div>

                        <div className="ff-timeline">
                          {rq ? (
                            <div className="ff-timelineItem">
                              <div className="ff-timelineDot" />
                              <div>
                                <div className="ff-timelineTitle">Enquiry received</div>
                                <div className="ff-timelineMeta">
                                  {niceDate(rq.created_at)}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="ff-timelineItem">
                            <div className="ff-timelineDot" />
                            <div>
                              <div className="ff-timelineTitle">Job created</div>
                              <div className="ff-timelineMeta">
                                {niceDate(selectedQuote.created_at)}
                              </div>
                            </div>
                          </div>

                          <div className="ff-timelineItem">
                            <div className="ff-timelineDot" />
                            <div>
                              <div className="ff-timelineTitle">Job approved</div>
                              <div className="ff-timelineMeta">Ready for booking</div>
                            </div>
                          </div>

                          {currentVisit ? (
                            <div className="ff-timelineItem">
                              <div className="ff-timelineDot" />
                              <div>
                                <div className="ff-timelineTitle">Booking added</div>
                                <div className="ff-timelineMeta">
                                  {niceDate(currentVisit.starts_at)}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {["in_progress", "complete", "invoiced", "paid"].includes(
                            normalizeJobStatus(selectedQuote, currentVisit)
                          ) ? (
                            <div className="ff-timelineItem">
                              <div className="ff-timelineDot" />
                              <div>
                                <div className="ff-timelineTitle">Job started</div>
                                <div className="ff-timelineMeta">
                                  Marked in progress
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {["complete", "invoiced", "paid"].includes(
                            normalizeJobStatus(selectedQuote, currentVisit)
                          ) ? (
                            <div className="ff-timelineItem">
                              <div className="ff-timelineDot" />
                              <div>
                                <div className="ff-timelineTitle">Job completed</div>
                                <div className="ff-timelineMeta">
                                  Work marked complete
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {["invoiced", "paid"].includes(
                            normalizeJobStatus(selectedQuote, currentVisit)
                          ) ? (
                            <div className="ff-timelineItem">
                              <div className="ff-timelineDot" />
                              <div>
                                <div className="ff-timelineTitle">Invoice stage</div>
                                <div className="ff-timelineMeta">
                                  Job marked invoiced
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {normalizeJobStatus(selectedQuote, currentVisit) ===
                          "paid" ? (
                            <div className="ff-timelineItem">
                              <div className="ff-timelineDot" />
                              <div>
                                <div className="ff-timelineTitle">Paid</div>
                                <div className="ff-timelineMeta">
                                  Job fully closed
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "documents" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-detailCard">
                        <div className="ff-cardTitleRow">
                          <div>
                            <div className="ff-detailLabel">Completion pack</div>
                            <div className="ff-cardTitle">Job documents</div>
                          </div>
                        </div>

                        <div className="ff-detailSub" style={{ marginBottom: 12 }}>
                          Store certificates, warranties, manuals, invoices and
                          handover files here.
                        </div>

                        <select
                          className="ff-inputWide"
                          value={docLabel}
                          onChange={(e) => setDocLabel(e.target.value)}
                          style={{ maxWidth: 220, marginBottom: 10 }}
                        >
                          {DOCUMENT_LABELS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.text}
                            </option>
                          ))}
                        </select>

                        <input
                          type="file"
                          multiple
                          onChange={onUploadJobDocs}
                          disabled={docsUploading || !effectiveRequestId}
                        />

                        <div style={{ height: 10 }} />

                        {docsMsg ? <div className="ff-detailSub">{docsMsg}</div> : null}

                        {docsLoading ? (
                          <div className="ff-detailSub">Loading…</div>
                        ) : jobDocs.length ? (
                          jobDocs.map((f, idx) => (
                            <div className="ff-fileRow" key={`${f.path}-${idx}`}>
                              <div style={{ minWidth: 0 }}>
                                <div className="ff-fileName">{f.name}</div>
                                <div className="ff-fileMeta">
                                  {fileTypeLabel(f.name)}
                                </div>
                                {f.label ? (
                                  <div className="ff-detailSub" style={{ marginTop: 4 }}>
                                    {labelText(f.label)}
                                  </div>
                                ) : null}
                              </div>

                              <div className="ff-fileActions">
                                {f.url ? (
                                  <a
                                    className="ff-a"
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Open
                                  </a>
                                ) : (
                                  <span className="ff-detailSub">—</span>
                                )}

                                <button
                                  className="ff-inlineBtn"
                                  type="button"
                                  onClick={() => deleteJobDoc(f.path)}
                                  disabled={docsUploading}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="ff-detailSub">No documents added yet.</div>
                        )}

                        <div className="ff-sendRow" style={{ marginTop: 14 }}>
                          {normalizeJobStatus(selectedQuote, currentVisit) ===
                          "complete" ? (
                            <button
                              type="button"
                              className="ff-btn ff-btnPrimary ff-btnSm"
                              onClick={markInvoiced}
                            >
                              Mark invoiced
                            </button>
                          ) : null}

                          {normalizeJobStatus(selectedQuote, currentVisit) ===
                          "invoiced" ? (
                            <button
                              type="button"
                              className="ff-btn ff-btnPrimary ff-btnSm"
                              onClick={markPaid}
                            >
                              Mark paid
                            </button>
                          ) : null}
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

      <style jsx>{`
        .ff-page {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: transparent;
          padding: 0;
        }

        .ff-wrap {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .ff-top {
          overflow: hidden;
          border: 1px solid ${FF.border};
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.9) inset,
            0 14px 32px rgba(15, 23, 42, 0.05);
        }

        .ff-hero {
          position: relative;
          overflow: hidden;
          padding: 20px 18px 16px;
          background: linear-gradient(
            135deg,
            rgba(143, 169, 214, 0.18),
            rgba(255, 255, 255, 0.98)
          );
        }

        .ff-heroGlow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 14% 18%, rgba(143, 169, 214, 0.18), transparent 52%),
            radial-gradient(circle at 84% 20%, rgba(31, 53, 92, 0.07), transparent 58%);
        }

        .ff-heroRow {
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
        }

        .ff-heroLeft {
          min-width: 0;
          display: grid;
          gap: 8px;
        }

        .ff-heroTitle {
          font-size: 30px;
          line-height: 1.02;
          letter-spacing: -0.03em;
          font-weight: 950;
          color: ${FF.navySoft};
        }

        .ff-heroRule {
          width: 230px;
          height: 3px;
          border-radius: 999px;
          background: ${FF.blueLine};
        }

        .ff-heroSub {
          max-width: 620px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.55;
          color: ${FF.muted};
        }

        .ff-heroStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
          min-width: 0;
        }

        .ff-statCard {
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

        .ff-statLabel {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7b8798;
        }

        .ff-statValue {
          margin-top: 6px;
          font-size: 22px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.03em;
          color: ${FF.text};
        }

        .ff-controls {
          padding: 12px 14px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          border-top: 1px solid ${FF.border};
          background:
            linear-gradient(180deg, rgba(143, 169, 214, 0.08), rgba(255, 255, 255, 0)),
            #fff;
        }

        .ff-filterRow,
        .ff-filterRight {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ff-input {
          height: 38px;
          width: 260px;
          max-width: 100%;
          padding: 0 12px;
          border: 1px solid ${FF.border};
          border-radius: 14px;
          background: #fff;
          outline: none;
          font-size: 13px;
          color: ${FF.text};
          box-sizing: border-box;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
        }

        .ff-input:focus,
        .ff-inputWide:focus,
        .ff-textarea:focus {
          border-color: rgba(36, 91, 255, 0.22);
          box-shadow:
            0 0 0 3px rgba(36, 91, 255, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.82);
        }

        .ff-pillSmall {
          height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid ${FF.border};
          background: #fff;
          font-size: 12px;
          font-weight: 900;
          color: ${FF.muted};
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ff-pillNeutralActive {
          border-color: rgba(143, 169, 214, 0.34);
          background: rgba(143, 169, 214, 0.14);
          color: ${FF.navySoft};
        }

.ff-toastSuccess {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.ff-toastError {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

        .ff-toast {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 80;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid ${FF.border};
          background: #fff;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 700;
          color: ${FF.text};
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
        }

        .ff-mainShell {
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: 370px minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }

        .ff-leftPane,
        .ff-rightPane {
          min-height: 0;
          border: 1px solid ${FF.border};
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.9) inset,
            0 14px 32px rgba(15, 23, 42, 0.05);
          overflow: hidden;
        }

        .ff-leftPane {
          display: flex;
          flex-direction: column;
          height: 930px;
        }

        .ff-leftTop {
          padding: 14px;
          border-bottom: 1px solid ${FF.border};
          background:
            linear-gradient(180deg, rgba(143, 169, 214, 0.08), rgba(255, 255, 255, 0)),
            #fff;
        }

        .ff-leftTitleRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .ff-leftTitle {
          font-size: 15px;
          font-weight: 900;
          color: ${FF.navySoft};
        }

        .ff-leftCount {
          font-weight: 900;
          color: ${FF.muted};
          border: 1px solid ${FF.border};
          background: #f7f9fc;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
        }

        .ff-leftList {
          flex: 1 1 auto;
          min-height: 0;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
        }

        .ff-leftItem {
          position: relative;
          width: 100%;
          display: block;
          text-align: left;
          padding: 16px 16px 16px 22px;
          border: 1px solid ${FF.border};
          border-radius: 22px;
          background: #fff;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.88) inset,
            0 10px 22px rgba(15, 23, 42, 0.06);
        }

        .ff-leftItem:hover {
          transform: translateY(-2px);
          border-color: rgba(36, 91, 255, 0.16);
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          box-shadow:
            0 12px 26px rgba(15, 23, 42, 0.08),
            0 20px 40px rgba(15, 23, 42, 0.06);
        }

        .ff-leftItem.isActive {
          border-color: rgba(36, 91, 255, 0.24);
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow:
            0 0 0 2px rgba(36, 91, 255, 0.06),
            0 16px 34px rgba(36, 91, 255, 0.08);
        }

        .ff-leftItem.isActive::before {
          content: "";
          position: absolute;
          left: 10px;
          top: 18px;
          bottom: 18px;
          width: 3px;
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(31, 53, 92, 0.95) 0%,
            rgba(143, 169, 214, 0.72) 52%,
            rgba(143, 169, 214, 0.18) 100%
          );
        }

        .ff-leftItemTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .ff-leftJobWrap {
          min-width: 0;
          display: grid;
          gap: 8px;
        }

        .ff-jobNumber {
          font-size: 16px;
          font-weight: 950;
          line-height: 1.1;
          letter-spacing: -0.02em;
          color: ${FF.text};
        }

        .ff-leftDate {
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
        }

        .ff-leftChipRow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .ff-leftMain {
          margin-top: 14px;
          display: grid;
          gap: 8px;
        }

        .ff-leftJobTitle {
          font-size: 17px;
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: ${FF.text};
        }

        .ff-leftAddress {
          font-size: 13px;
          line-height: 1.45;
          color: ${FF.muted};
          overflow-wrap: anywhere;
        }

        .ff-leftMetaRow {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ff-leftMetaText {
          font-size: 12px;
          font-weight: 800;
          color: ${FF.muted};
        }

        .ff-leftHintWrap {
          margin-top: 12px;
        }

        .ff-leftHint {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          width: fit-content;
          max-width: 100%;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          border: 1px solid transparent;
        }

        .ff-leftHintBlue {
          background: #eef4ff;
          border-color: rgba(36, 91, 255, 0.16);
          color: ${FF.navySoft};
        }

        .ff-leftGlowASAP {
          border-color: rgba(239, 68, 68, 0.3) !important;
          box-shadow:
            0 0 0 3px rgba(239, 68, 68, 0.14),
            0 14px 30px rgba(15, 23, 42, 0.08) !important;
        }

        .ff-leftGlowWeek {
          border-color: rgba(245, 158, 11, 0.28) !important;
          box-shadow:
            0 0 0 3px rgba(245, 158, 11, 0.13),
            0 14px 30px rgba(15, 23, 42, 0.08) !important;
        }

        .ff-leftGlowNext {
          border-color: rgba(34, 197, 94, 0.26) !important;
          box-shadow:
            0 0 0 3px rgba(34, 197, 94, 0.12),
            0 14px 30px rgba(15, 23, 42, 0.08) !important;
        }

        .ff-leftGlowFlexible {
          border-color: rgba(36, 91, 255, 0.26) !important;
          box-shadow:
            0 0 0 3px rgba(36, 91, 255, 0.13),
            0 14px 30px rgba(15, 23, 42, 0.08) !important;
        }

       .ff-rightBody {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 20px 28px;
  -webkit-overflow-scrolling: touch;
}

        .ff-backMobile {
          display: none;
          margin: 0 0 14px 2px;
          padding: 8px 14px;
          border: 1px solid rgba(31, 53, 92, 0.12);
          border-radius: 999px;
          background: rgba(31, 53, 92, 0.06);
          color: ${FF.navySoft};
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .ff-rightTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 20px 20px 18px;
          border: 1px solid ${FF.border};
          border-radius: 22px;
          margin-bottom: 18px;
          background:
            linear-gradient(180deg, rgba(143, 169, 214, 0.08), rgba(255, 255, 255, 0)),
            #fff;
        }

        .ff-rightTopLeft {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ff-rightJobNo {
          font-size: 11px;
          font-weight: 900;
          color: #7b8798;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          line-height: 1;
        }

        .ff-rightTitle {
          font-size: 31px;
          line-height: 1.04;
          letter-spacing: -0.035em;
          font-weight: 950;
          color: ${FF.text};
        }

        .ff-rightSub {
          font-size: 15px;
          font-weight: 700;
          color: #66748a;
          line-height: 1.5;
        }

        .ff-rightStatusRow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ff-rightTopActions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .ff-tabs {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 14px 2px 12px;
          margin-bottom: 8px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .ff-tabs::-webkit-scrollbar {
          display: none;
        }

        .ff-tabBtn {
          position: relative;
          flex: 0 0 auto;
          height: 38px;
          padding: 0 14px;
          border: 1px solid #dbe5f0;
          border-radius: 999px;
          background: #ffffff;
          color: ${FF.muted};
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.16s ease;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
        }

        .ff-tabBtn:hover {
          transform: translateY(-1px);
          border-color: #c7d6ea;
          background: #f8fbff;
          color: ${FF.navySoft};
        }

        .ff-tabBtn.isActive {
          border-color: #bfd2ee;
          background: linear-gradient(180deg, #eef4ff 0%, #e8f0ff 100%);
          color: ${FF.navy};
          box-shadow:
            0 0 0 1px rgba(143, 169, 214, 0.14),
            0 6px 16px rgba(15, 23, 42, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.95);
        }

        .ff-tabBtn.isActive::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 5px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, ${FF.navySoft} 0%, #8fa9d6 100%);
        }

        .ff-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .ff-chipNeutral {
          background: #f7f9fc;
          border-color: ${FF.border};
          color: ${FF.muted};
        }

        .ff-chipRed {
          background: ${FF.redSoft};
          border-color: #ffcaca;
          color: #9f1d1d;
        }

        .ff-chipAmber {
          background: ${FF.amberSoft};
          border-color: #ffd8a8;
          color: #9a5a00;
        }

        .ff-chipGreen {
          background: ${FF.greenSoft};
          border-color: #bde7cc;
          color: #166534;
        }

        .ff-chipBlueSoft {
          background: ${FF.blueSoft2};
          border-color: rgba(31, 53, 92, 0.18);
          color: #16325c;
        }

        .ff-stageStrip {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 18px;
        }

        .ff-stageItem {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 10px;
          border-radius: 16px;
          border: 1px solid ${FF.border};
          background: #fbfcff;
        }

        .ff-stageItem.isDone {
          background: linear-gradient(180deg, #eef4ff 0%, #f8fbff 100%);
          border-color: rgba(143, 169, 214, 0.3);
        }

        .ff-stageItem.isCurrent {
          box-shadow:
            0 0 0 1px rgba(143, 169, 214, 0.2),
            0 8px 18px rgba(15, 23, 42, 0.05);
        }

        .ff-stageDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #d6deea;
          flex: 0 0 auto;
        }

        .ff-stageItem.isDone .ff-stageDot,
        .ff-stageItem.isCurrent .ff-stageDot {
          background: ${FF.blue};
          box-shadow: 0 0 0 4px rgba(36, 91, 255, 0.12);
        }

        .ff-stageText {
          min-width: 0;
          font-size: 12px;
          line-height: 1.25;
          font-weight: 800;
          color: ${FF.navySoft};
        }

        .ff-rightInner,
        .ff-detailGrid {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .ff-detailCard {
          padding: 18px;
          border: 1px solid rgba(143, 169, 214, 0.18);
          border-radius: 22px;
          background: linear-gradient(
            180deg,
            rgba(143, 169, 214, 0.08) 0%,
            rgba(143, 169, 214, 0.03) 42%,
            #ffffff 100%
          );
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.88) inset,
            0 10px 24px rgba(15, 23, 42, 0.04);
        }

        .ff-warningCard {
          border-color: rgba(245, 158, 11, 0.24);
          background: linear-gradient(
            180deg,
            rgba(255, 247, 237, 0.92) 0%,
            #ffffff 100%
          );
        }

        .ff-successCard {
          border-color: rgba(22, 101, 52, 0.18);
          background: linear-gradient(
            180deg,
            rgba(236, 253, 243, 0.92) 0%,
            #ffffff 100%
          );
        }

        .ff-cardTitleRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .ff-cardTitle {
          font-size: 16px;
          line-height: 1.15;
          font-weight: 900;
          color: ${FF.navySoft};
          letter-spacing: -0.01em;
        }

        .ff-cardTitleChips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ff-detailLabel {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${FF.muted};
        }

        .ff-detailValue {
          color: ${FF.text};
          font-size: 14px;
          line-height: 1.5;
          font-weight: 700;
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .ff-detailSub,
        .ff-detailValueSub {
          margin-top: 4px;
          color: ${FF.muted};
          font-size: 13px;
          font-weight: 500;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .ff-detailRow {
          display: grid;
          grid-template-columns: 120px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          padding: 10px 0;
        }

        .ff-detailRow + .ff-detailRow {
          border-top: 1px solid rgba(230, 236, 245, 0.9);
        }

        .ff-inputWide {
          height: 38px;
          width: 100%;
          padding: 0 12px;
          border: 1px solid ${FF.border};
          border-radius: 14px;
          background: #fff;
          outline: none;
          font-size: 13px;
          color: ${FF.text};
          box-sizing: border-box;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
        }

        .ff-textarea {
          width: 100%;
          min-height: 120px;
          border-radius: 16px;
          border: 1px solid ${FF.border};
          padding: 12px;
          font-size: 13px;
          line-height: 1.55;
          outline: none;
          color: ${FF.navySoft};
          box-sizing: border-box;
          resize: vertical;
          background: #fff;
        }

        .ff-inlineActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ff-inlineBtn {
          height: 34px;
          border-radius: 999px;
          border: 1px solid ${FF.border};
          background: #fff;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 800;
          color: ${FF.navySoft};
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .ff-inlineBtn:hover,
        .ff-btn:hover {
          transform: translateY(-1px);
        }

        .ff-btn {
          height: 38px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${FF.border};
          border-radius: 999px;
          background: #fff;
          color: ${FF.navySoft};
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease,
            background 0.15s ease;
        }

        .ff-btnSm {
          height: 36px;
          padding: 0 14px;
          font-size: 12px;
        }

        .ff-btnGhost {
          background: #fff;
          color: ${FF.navySoft};
        }

        .ff-btnPrimary {
          border: none;
          background: linear-gradient(180deg, ${FF.navySoft}, #182b49);
          color: #fff;
          box-shadow:
            0 14px 28px rgba(31, 53, 92, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        .ff-btnDanger {
          border-color: #fecaca;
          background: #fff;
          color: #dc2626;
        }

        .ff-priceHero {
          margin-bottom: 8px;
          padding: 18px;
          border-radius: 18px;
          border: 1px solid rgba(143, 169, 214, 0.2);
          background: linear-gradient(
            180deg,
            rgba(234, 241, 255, 0.85) 0%,
            #ffffff 100%
          );
        }

        .ff-priceHeroLabel {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${FF.muted};
        }

        .ff-priceHeroValue {
          margin-top: 8px;
          font-size: 30px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.03em;
          color: ${FF.navySoft};
        }

        .ff-totalValue {
          font-weight: 900;
          color: ${FF.navySoft};
        }

        .ff-currencyPrefix {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 13px;
          font-weight: 800;
          color: ${FF.muted};
        }

        .ff-vatRow,
        .ff-sendRow,
        .ff-fileActions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ff-nextStepCard {
          position: relative;
          overflow: hidden;
          padding: 18px 18px 18px 20px;
          border: 1px solid rgba(31, 53, 92, 0.14);
          border-radius: 22px;
          background: linear-gradient(
            135deg,
            rgba(234, 241, 255, 0.92) 0%,
            #ffffff 72%
          );
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.88) inset,
            0 14px 34px rgba(15, 23, 42, 0.06);
        }

        .ff-nextStepCard::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: linear-gradient(
            180deg,
            ${FF.navySoft} 0%,
            #6b88b8 55%,
            rgba(107, 136, 184, 0.16) 100%
          );
        }

        .ff-nextStepTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .ff-nextStepEyebrow {
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: ${FF.muted};
        }

        .ff-nextStepTitle {
          font-size: 18px;
          font-weight: 900;
          line-height: 1.15;
          color: ${FF.navy};
        }

        .ff-nextStepText {
          margin-top: 6px;
          max-width: 520px;
          font-size: 13px;
          line-height: 1.5;
          color: ${FF.muted};
        }

        .ff-nextStepActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .ff-overviewTopGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .ff-overviewMiniCard {
          min-height: 118px;
          padding: 16px 16px 18px;
          border: 1px solid rgba(230, 236, 245, 0.92);
          border-radius: 20px;
          background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.035);
        }

        .ff-overviewMiniLabel {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #7b8798;
        }

        .ff-overviewMiniValue {
          margin-top: 6px;
          font-size: 18px;
          font-weight: 900;
          line-height: 1.1;
          color: #10284f;
          overflow-wrap: anywhere;
        }

        .ff-overviewMiniSub {
          margin-top: 6px;
          font-size: 11px;
          line-height: 1.45;
          color: ${FF.muted};
        }

        .ff-warningList {
          display: grid;
          gap: 8px;
        }

        .ff-warningItem {
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(245, 158, 11, 0.18);
          color: #92400e;
          font-size: 13px;
          font-weight: 700;
        }

        .ff-fileRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
        }

        .ff-fileRow + .ff-fileRow {
          border-top: 1px solid rgba(230, 236, 245, 0.9);
        }

        .ff-fileName {
          font-size: 13px;
          font-weight: 700;
          color: ${FF.text};
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .ff-fileMeta {
          margin-top: 4px;
          color: ${FF.muted};
          font-size: 12px;
          font-weight: 700;
        }

        .ff-a {
          color: ${FF.navySoft};
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
        }

        .ff-a:hover {
          text-decoration: underline;
        }

        .ff-notesPrompts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .ff-notesPrompt {
          padding: 6px 10px;
          border-radius: 999px;
          background: #f8fbff;
          border: 1px solid rgba(143, 169, 214, 0.24);
          color: ${FF.muted};
          font-size: 12px;
          font-weight: 700;
        }

        .ff-timeline {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .ff-timelineItem {
          display: grid;
          grid-template-columns: 16px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }

        .ff-timelineDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: ${FF.blue};
          margin-top: 5px;
          box-shadow: 0 0 0 4px rgba(36, 91, 255, 0.12);
        }

        .ff-timelineTitle {
          font-size: 14px;
          font-weight: 800;
          color: ${FF.navySoft};
          line-height: 1.2;
        }

        .ff-timelineMeta {
          margin-top: 4px;
          font-size: 13px;
          color: ${FF.muted};
          font-weight: 600;
        }

.ff-emptyWrap {
  min-height: 520px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 20px;
}

.ff-empty {
  width: 100%;
  max-width: 620px;
  padding: 38px 32px;
  border: 1px solid rgba(143, 169, 214, 0.22);
  border-radius: 26px;
  background: linear-gradient(
    180deg,
    rgba(248, 251, 255, 0.96) 0%,
    rgba(244, 247, 255, 0.92) 100%
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 18px 40px rgba(15, 23, 42, 0.05);
  text-align: center;
}

.ff-emptyTitle {
  font-size: 18px;
  line-height: 1.15;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: ${FF.navySoft};
}

.ff-emptySub {
  margin-top: 10px;
  max-width: 440px;
  margin-left: auto;
  margin-right: auto;
  font-size: 13px;
  line-height: 1.6;
  color: ${FF.muted};
  white-space: normal;
  word-break: break-word;
}

        @media (max-width: 980px) {
          .ff-mainShell {
            grid-template-columns: 1fr;
          }

          .ff-page[data-mobile-detail="1"] .ff-leftPane {
            display: none;
          }

          .ff-page[data-mobile-detail="0"] .ff-rightPane {
            display: none;
          }

          .ff-leftPane {
            height: auto;
            min-height: 0;
          }

          .ff-rightBody {
            padding: 16px;
          }

          .ff-backMobile {
            display: inline-flex;
            align-items: center;
          }

          .ff-rightTop {
            flex-direction: column;
            align-items: stretch;
            padding: 16px;
          }

          .ff-rightTopActions {
            justify-content: flex-start;
          }

          .ff-stageStrip {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .ff-overviewTopGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ff-detailRow {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .ff-nextStepTop {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 640px) {
          .ff-heroStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ff-rightTitle {
            font-size: 22px;
          }

          .ff-stageStrip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ff-tabs {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .ff-tabBtn {
            width: 100%;
            min-width: 0;
            padding: 0 8px;
            justify-content: center;
            text-align: center;
          }

          .ff-overviewTopGrid {
            grid-template-columns: 1fr;
          }

          .ff-sendRow,
          .ff-rightTopActions,
          .ff-fileActions {
            flex-direction: column;
            align-items: stretch;
          }

          .ff-sendRow .ff-btn,
          .ff-rightTopActions .ff-btn {
            width: 100%;
          }

          .ff-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  </div>
);
}