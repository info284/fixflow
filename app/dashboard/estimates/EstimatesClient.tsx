"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  created_at: string;
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
};

/* ================== CONSTS ================== */

const BUCKET = "quote-files";
const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;

const FF = {
  pageBg: "#F6F8FC",
  card: "#FFFFFF",
  border: "#E6ECF5",
  text: "#0B1320",
  muted: "#5C6B84",
  navySoft: "#1F355C",
  blueLine:
    "linear-gradient(90deg, rgba(36,91,255,1) 0%, rgba(31,111,255,0.35) 55%, rgba(11,42,85,0.15) 100%)",
  blueSoft2: "#F4F7FF",
  redSoft: "#FFF1F1",
  amberSoft: "#FFF7ED",
  greenSoft: "#ECFDF3",
};

/* ================== HELPERS ================== */

function cleanId(v?: string | null) {
  const s = String(v || "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

function numOrNull(v: string) {
  const t = (v || "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function money(n: number | null | undefined) {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return `£${x.toFixed(2)}`;
}

function safeFileName(name: string) {
  return (name || "file")
    .replaceAll(" ", "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .slice(0, 120);
}

function sentLabel(q: QuoteRow) {
  const isSent = String(q.status || "").toLowerCase().includes("sent");
  if (!isSent) return "Draft";
  if (!q.sent_at) return "Sent";

  const date = new Date(q.sent_at);
  const label = date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });

  return `Sent ${label}`;
}
function formatPostcode(pc?: string | null) {
  if (!pc) return "";
  const clean = pc.replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  return clean.slice(0, -3) + " " + clean.slice(-3);
}

function sentStatusChip(q: QuoteRow) {
  const isSent = String(q.status || "").toLowerCase().includes("sent");

  return isSent
    ? { text: sentLabel(q), cls: "ff-chip ff-chipGreen" }
    : { text: "Draft", cls: "ff-chip ff-chipNeutral" };
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
async function listFilesWithSignedUrls(folder: string): Promise<FileItem[]> {
  const bucket = supabase.storage.from(BUCKET);
  const { data, error } = await bucket.list(folder, { limit: 100 });
  if (error || !data) return [];

  const files = data.filter((f) => f.name && f.name !== ".emptyFolderPlaceholder");
  const out: FileItem[] = [];

  for (const f of files) {
    const path = `${folder}/${f.name}`;
    const { data: signed, error: signErr } = await bucket.createSignedUrl(path, 60 * 10);
    out.push({
      name: f.name,
      path,
      url: signErr ? null : signed?.signedUrl ?? null,
    });
  }

  return out;
}

function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ff-empty">
      <div className="ff-emptyTitle">{title}</div>
      {sub ? <div className="ff-emptySub">{sub}</div> : null}
    </div>
  );
}

/* ================== PAGE ================== */

export default function EstimatesClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const requestIdFromUrl = cleanId(sp.get("requestId"));
  const quoteIdFromUrl = cleanId(sp.get("quoteId"));

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [postcodeFilter, setPostcodeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "sent">("");

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) || null,
    [quotes, selectedQuoteId]
  );

  const [rq, setRq] = useState<QuoteRequestRow | null>(null);
  const [tab, setTab] = useState<"details" | "files" | "visit">("details");

  const [customerEmail, setCustomerEmail] = useState("");
  const [vatRate, setVatRate] = useState<"0" | "20">("20");
  const [subtotal, setSubtotal] = useState("");
  const [emailSubject, setEmailSubject] = useState("Your estimate");
  const [customerNote, setCustomerNote] = useState("");
  const [vatRegistered, setVatRegistered] = useState(true);
  const [workDescription, setWorkDescription] = useState("");
  const [traderRef, setTraderRef] = useState("");

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [custFiles, setCustFiles] = useState<FileItem[]>([]);
  const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [siteVisit, setSiteVisit] = useState<SiteVisitRow | null>(null);
  const [siteVisitLoading, setSiteVisitLoading] = useState(false);

  const [requestUrgencyById, setRequestUrgencyById] = useState<Record<string, string | null>>(
    {}
  );
const [requestJobNumberById, setRequestJobNumberById] = useState<Record<string, string | null>>(
  {}
);
  const [sendOk, setSendOk] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const initRef = useRef<string>("");
  const lastAutoCreateRef = useRef<string>("");

  const effectiveRequestId = useMemo(() => {
    const a = cleanId(selectedQuote?.request_id || "");
    if (a && isUuid(a)) return a;

    const b = cleanId(requestIdFromUrl);
    if (b && isUuid(b)) return b;

    return "";
  }, [selectedQuote?.request_id, requestIdFromUrl]);

 async function loadRequestUrgencies(traderId: string, requestIds: string[]) {
  const ids = Array.from(new Set(requestIds.map(cleanId).filter((id) => id && isUuid(id))));

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
    const row = r as { id: string; urgency: string | null; job_number?: string | null };
    urgencyMap[row.id] = row.urgency ?? null;
    jobNumberMap[row.id] = row.job_number ?? null;
  }

  setRequestUrgencyById(urgencyMap);
  setRequestJobNumberById(jobNumberMap);
}



  async function loadQuotes(traderId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "id,plumber_id,request_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,vat_rate,subtotal,note,job_details,trader_ref,status,sent_at,created_at"
      )
      .eq("plumber_id", traderId)
      .order("created_at", { ascending: false });

    if (error) {
      setToast(`Load failed: ${error.message}`);
      setQuotes([]);
      return;
    }

    const list = (data || []) as QuoteRow[];
    setQuotes(list);

    await loadRequestUrgencies(
      traderId,
      list.map((q) => q.request_id || "")
    );
  }

  async function loadRequest(traderId: string, rqId: string) {
    const id = cleanId(rqId);
    if (!id || !isUuid(id)) return;

    const { data } = await supabase
      .from("quote_requests")
      .select(
        "id,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,created_at"
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
    if (!id || !isUuid(id)) return;

    setFilesLoading(true);
    setFileMsg(null);

    try {
      const [c, t] = await Promise.all([
        listFilesWithSignedUrls(customerFolder(id)),
        listFilesWithSignedUrls(traderFolder(id)),
      ]);
      setCustFiles(c);
      setTraderFiles(t);
    } finally {
      setFilesLoading(false);
    }
  }

  function fillFormFromQuote(q: QuoteRow) {
    setCustomerEmail((q.customer_email || "").trim());

    const vr = Number(q.vat_rate ?? 20);
    if (vr > 0) {
      setVatRegistered(true);
      setVatRate(String(vr) as "0" | "20");
    } else {
      setVatRegistered(false);
      setVatRate("0");
    }

    setSubtotal(q.subtotal != null ? String(q.subtotal) : "");
    setEmailSubject("Your estimate");
    setCustomerNote("");
    setSendOk(null);
    setSendError(null);
    setWorkDescription((q.job_details || "").trim());
    setTraderRef((q.trader_ref || "").trim());
  }

  async function ensureDraftQuoteForRequest(requestId: string, traderId: string) {
    const rid = cleanId(requestId);
    if (!rid || !isUuid(rid)) return;

    const key = `${traderId}:${rid}`;
    if (lastAutoCreateRef.current === key) return;
    lastAutoCreateRef.current = key;

    const existing = await supabase
      .from("quotes")
      .select("id")
      .eq("plumber_id", traderId)
      .eq("request_id", rid)
      .maybeSingle();

    if (existing.data?.id) {
      setSelectedQuoteId(existing.data.id);
      router.replace(`/dashboard/estimates?quoteId=${encodeURIComponent(existing.data.id)}`);
      return;
    }

    const rqRes = await supabase
      .from("quote_requests")
      .select("id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency")
      .eq("id", rid)
      .eq("plumber_id", traderId)
      .maybeSingle();

    if (!rqRes.data) {
      setToast("Cannot create estimate: enquiry not found.");
      return;
    }

    const created = await supabase
      .from("quotes")
      .insert({
        plumber_id: traderId,
        request_id: rid,
        customer_name: rqRes.data.customer_name,
        customer_email: rqRes.data.customer_email,
        customer_phone: rqRes.data.customer_phone,
        postcode: rqRes.data.postcode,
        address: rqRes.data.address,
        job_type: rqRes.data.job_type,
        urgency: rqRes.data.urgency,
        vat_rate: 0,
        subtotal: 0,
        status: "draft",
      })
      .select("id")
      .single();

    if (created.error) {
      setToast(`Create estimate failed: ${created.error.message}`);
      return;
    }

    setSelectedQuoteId(created.data.id);
    router.replace(`/dashboard/estimates?quoteId=${encodeURIComponent(created.data.id)}`);
    setToast("Estimate draft created ✓");
    setTimeout(() => setToast(null), 1200);
    await loadQuotes(traderId);
  }

  async function saveQuote() {
    if (!uid || !selectedQuote) return false;
    setSaving(true);

    const patch = {
      customer_email: (customerEmail || "").trim() || null,
      trader_ref: (traderRef || "").trim() || null,
      job_details: (workDescription || "").trim() || null,
      note: (customerNote || "").trim() || null,
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
      setToast(`Save failed: ${error.message}`);
      return false;
    }

    setToast("Saved ✓");
    setTimeout(() => setToast(null), 900);

    await loadQuotes(uid);
    return true;
  }

  async function downloadPdf() {
    try {
      if (!selectedQuote) return;

      const ok = await saveQuote();
      if (!ok) return;

      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;
      if (!token) return alert("Please log in again.");

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
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      alert(e?.message || "PDF failed");
    }
  }

  async function deleteQuote() {
    if (!uid || !selectedQuote) return;
    const ok = confirm("Delete this estimate? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", selectedQuote.id)
      .eq("plumber_id", uid);

    if (error) {
      setToast(`Delete failed: ${error.message}`);
      return;
    }

    setSelectedQuoteId(null);
    setRq(null);
    setCustFiles([]);
    setTraderFiles([]);
    setSiteVisit(null);
    router.replace("/dashboard/estimates");
    setToast("Deleted ✓");
    setTimeout(() => setToast(null), 900);
    await loadQuotes(uid);
  }

  async function onUploadTraderFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    if (!effectiveRequestId) {
      setFileMsg("This estimate isn’t linked to an enquiry.");
      return;
    }

    setUploading(true);
    setFileMsg(null);

    try {
      const fd = new FormData();
      fd.append("requestId", effectiveRequestId);
      fd.append("kind", "trader");
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
    const ok = confirm("Delete this attachment?");
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

  function goToCreateBooking() {
    const rid = cleanId(selectedQuote?.request_id || "");
    if (!rid) {
      setToast("This estimate is not linked to an enquiry.");
      return;
    }

    router.push(`/dashboard/bookings?requestId=${encodeURIComponent(rid)}`);
  }

  async function sendEstimateEmail() {
    if (!uid || !selectedQuote) return;

    setSending(true);
    setSendOk(null);
    setSendError(null);

    await saveQuote();

    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes.session?.access_token;

    if (!token) {
      setToast("You're not logged in. Please log in again.");
      setSending(false);
      return;
    }

    try {
      const res = await fetch("/api/estimates/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quoteId: selectedQuote.id,
          subject: (emailSubject || "").trim() || "Your estimate",
          customerNote: (customerNote || "").trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Send failed");

      setSendOk("Sent ✓");
      setToast("Estimate sent ✓");
      setTimeout(() => setToast(null), 1800);
      await loadQuotes(uid);
    } catch (e: any) {
      setSendError(e?.message || "Send failed");
      setToast(e?.message || "Send failed");
    } finally {
      setSending(false);
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
        setToast("Please log in.");
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
    if (!uid) return;
    const rid = cleanId(requestIdFromUrl);
    if (!rid || !isUuid(rid)) return;

    const key = `${uid}:${rid}`;
    if (initRef.current === key) return;
    initRef.current = key;

    ensureDraftQuoteForRequest(rid, uid);
  }, [uid, requestIdFromUrl]);

  useEffect(() => {
    if (!uid || !selectedQuote) return;

    fillFormFromQuote(selectedQuote);
    setTab("details");

    const rid = cleanId(selectedQuote.request_id || "");
    if (rid && isUuid(rid)) {
      loadRequest(uid, rid);
      loadAttachments(rid);
      loadSiteVisit(rid, uid);
    } else {
      setRq(null);
      setCustFiles([]);
      setTraderFiles([]);
      setSiteVisit(null);
    }
  }, [uid, selectedQuote?.id]);

  /* ================== MEMOS ================== */
    const visibleQuotes = useMemo(() => {
    let list = [...quotes];

    if (statusFilter) {
      list = list.filter((q) => {
        const isSent = String(q.status || "").toLowerCase().includes("sent");
        return statusFilter === "sent" ? isSent : !isSent;
      });
    }

    if (postcodeFilter.trim()) {
      const needle = postcodeFilter.trim().toLowerCase();
      list = list.filter((q) =>
        String(q.postcode || "").toLowerCase().includes(needle)
      );
    }

    return list;
  }, [quotes, statusFilter, postcodeFilter]);

  if (loading) {
    return (
      <div style={{ padding: 14, fontSize: 13, color: FF.muted }}>
        Loading estimates…
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
                <div className="ff-heroTitle">Estimates</div>
                <div className="ff-heroRule" />
                <div className="ff-sub">Create, send and track estimates.</div>
              </div>

              <div className="ff-actions">
                <button
                  className="ff-btnGhost"
                  type="button"
                  onClick={() => router.refresh()}
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="ff-controls">
            <div className="ff-filterRow">
              <button
                className={`ff-pillSmall ${!statusFilter ? "ff-pillNeutralActive" : ""}`}
                type="button"
                onClick={() => setStatusFilter("")}
              >
                All {quotes.length}
              </button>

              <button
                className={`ff-pillSmall ${statusFilter === "draft" ? "ff-pillNeutralActive" : ""}`}
                type="button"
                onClick={() => setStatusFilter("draft")}
              >
                Draft
              </button>

              <button
                className={`ff-pillSmall ${statusFilter === "sent" ? "ff-pillNeutralActive" : ""}`}
                type="button"
                onClick={() => setStatusFilter("sent")}
              >
                Sent
              </button>
            </div>

            <div className="ff-filterRow">
              <input
                className="ff-input"
                placeholder="Postcode / area"
                value={postcodeFilter}
                onChange={(e) => setPostcodeFilter(e.target.value)}
              />
            </div>
          </div>

          {toast ? <div className="ff-toast">{toast}</div> : null}
        </div>

        <div className="ff-grid">
          <div className="ff-card ff-leftPane">
            <div className="ff-leftHeadRow">
              <div className="ff-leftTitle">All estimates</div>
              <div className="ff-leftCount">{visibleQuotes.length}</div>
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
  const sentChip = sentStatusChip(q);
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
      className={`ff-leftItem ${urgencyGlow}`}
      data-active={active ? "1" : "0"}
      type="button"
      onClick={() => {
        setSelectedQuoteId(q.id);
        setTab("details");
        router.replace(
          `/dashboard/estimates?quoteId=${encodeURIComponent(q.id)}`
        );
      }}
    >
      <div className="ff-leftItemInner">
        <div className="ff-leftItemTop">
          <div className="ff-jobNumber">
            {requestJobNumber || q.customer_name || "Estimate"}
          </div>
          <div className="ff-leftDate">{niceDateOnly(q.created_at)}</div>
        </div>

        <div className="ff-leftMeta">
          {q.postcode ? `${formatPostcode(q.postcode)} • ` : ""}
          {titleCase(q.job_type || "Estimate")}
        </div>

        <div className="ff-jobQuickRow">
  <div className="ff-jobBudget">{money(q.subtotal ?? 0)}</div>
</div>
        
        <div className="ff-leftChips">
          {urg.text ? <span className={urg.cls}>{urg.text}</span> : null}
          <span className={sentChip.cls}>{sentChip.text}</span>
        </div>

        <div className="ff-leftVisit">
  <span>Estimate</span>
</div>
      </div>
    </button>
  );
})
                
              ) : (
                <div style={{ padding: 12, color: FF.muted, fontSize: 13 }}>
                  No estimates match your filters.
                </div>
              )}
            </div>
          </div>

          <div className="ff-card ff-rightPane">
            <div className="ff-rightBody">
              {!selectedQuote ? (
                <div className="ff-emptyWrap">
                  <EmptyState
                    title="Select an estimate"
                    sub="Pick one from the list to view details."
                  />
                </div>
              ) : (
                <>
                  <button
                    className="ff-backMobile"
                    type="button"
                    onClick={() => {
                      setSelectedQuoteId(null);
                      router.replace("/dashboard/estimates");
                    }}
                  >
                    ← Back to estimates
                  </button>

              <div className="ff-enquiryHeader">
  <div className="ff-enquiryHeaderLeft">
    <div className="ff-enquiryTitle">
      {(requestJobNumberById[cleanId(selectedQuote.request_id)] || "Estimate")} · {titleCase(selectedQuote.job_type || "Estimate")}
    </div>

    <div className="ff-enquiryMeta">
      {selectedQuote.customer_name || "Customer"} ·{" "}
      <span className="ff-postcode">
        {formatPostcode(selectedQuote.postcode) || "—"}
      </span>
    </div>
  </div>

                    <div className="ff-headerBtnRow">
                      <button
                        className="ff-btnGhost"
                        type="button"
                        onClick={saveQuote}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>

                      <button
                        className="ff-btnGhost"
                        type="button"
                        onClick={goToCreateBooking}
                        disabled={!selectedQuote?.request_id}
                      >
                        Create booking
                      </button>

                      <button
                        className="ff-btnGhost"
                        type="button"
                        onClick={downloadPdf}
                        disabled={!selectedQuote}
                      >
                        Download PDF
                      </button>

                      <button
                        className="ff-btnPrimary"
                        type="button"
                        onClick={sendEstimateEmail}
                        disabled={sending}
                      >
                        {sending ? "Sending…" : "Send"}
                      </button>

                      <button
                        className="ff-btnDanger ff-btnDangerSm"
                        type="button"
                        onClick={deleteQuote}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="ff-rightTabs">
                    <button
                      className={`ff-tabPill ${tab === "details" ? "isActive" : ""}`}
                      onClick={() => setTab("details")}
                      type="button"
                    >
                      Details
                    </button>

                    <button
                      className={`ff-tabPill ${tab === "files" ? "isActive" : ""}`}
                      onClick={() => setTab("files")}
                      type="button"
                    >
                      Attachments
                    </button>

                    <button
                      className={`ff-tabPill ${tab === "visit" ? "isActive" : ""}`}
                      onClick={() => setTab("visit")}
                      type="button"
                    >
                      Site visit
                    </button>
                  </div>

                  <div className="ff-rightInner">
                    {tab === "details" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Customer email</div>
                            <input
                              className="ff-inputWide"
                              value={customerEmail}
                              onChange={(e) => setCustomerEmail(e.target.value)}
                              placeholder="customer@email.com"
                            />
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
                              placeholder="Describe the work included in this estimate…"
                            />
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Subtotal</div>

                            <div style={{ position: "relative", maxWidth: 220 }}>
                              <span
                                style={{
                                  position: "absolute",
                                  left: 12,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  fontWeight: 900,
                                  color: "#1F355C",
                                  pointerEvents: "none",
                                }}
                              >
                                £
                              </span>

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
                                  setSubtotal(Number.isFinite(n) ? n.toFixed(2) : "0.00");
                                }}
                                placeholder="0.00"
                                style={{ paddingLeft: 28 }}
                              />
                            </div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">VAT registered?</div>

                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className={`ff-pillSmall ${vatRegistered ? "ff-pillNeutralActive" : ""}`}
                                onClick={() => setVatRegistered(true)}
                              >
                                Yes
                              </button>

                              <button
                                type="button"
                                className={`ff-pillSmall ${!vatRegistered ? "ff-pillNeutralActive" : ""}`}
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
                                  onChange={(e) => setVatRate(e.target.value as "0" | "20")}
                                  style={{ maxWidth: 140 }}
                                >
                                  <option value="20">20%</option>
                                  <option value="0">0%</option>
                                </select>
                              ) : (
                                <div className="ff-detailValueSub">VAT will not be added.</div>
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
                                    <div className="ff-detailValue">£{vatAmount.toFixed(2)}</div>
                                  </div>
                                ) : null}

                                <div className="ff-detailRow">
                                  <div className="ff-detailLabel">Total</div>
                                  <div
                                    className="ff-detailValue"
                                    style={{
                                      fontSize: 18,
                                      fontWeight: 950,
                                      color: "#1F355C",
                                    }}
                                  >
                                    £{total.toFixed(2)}
                                  </div>
                                </div>
                              </>
                            );
                          })()}

                          {rq ? (
                            <>
                              <div className="ff-detailRow">
                                <div className="ff-detailLabel">Enquiry details</div>
                                <div className="ff-detailValue">{rq.details || "—"}</div>
                              </div>

                              <div className="ff-detailRow">
                                <div className="ff-detailLabel">Urgency</div>
                                <div className="ff-detailValue">{titleCase(rq.urgency || "—")}</div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {tab === "files" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
                            Customer files
                          </div>

                          {filesLoading ? (
                            <div className="ff-detailSub">Loading…</div>
                          ) : custFiles.length ? (
                            custFiles.map((f, idx) => (
                              <div className="ff-fileRow" key={`${f.path}-${idx}`}>
                                <div className="ff-fileName">{f.name}</div>
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
                          <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
                            Trader files
                          </div>

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
                                <div className="ff-fileName">{f.name}</div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "center",
                                  }}
                                >
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

                    {tab === "visit" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailLabel" style={{ marginBottom: 10 }}>
                            Site visit
                          </div>

                          {siteVisitLoading ? (
                            <div className="ff-detailSub">Loading…</div>
                          ) : siteVisit ? (
                            <>
                              <div className="ff-detailRow">
                                <div className="ff-detailLabel">Starts</div>
                                <div className="ff-detailValue">{niceDate(siteVisit.starts_at)}</div>
                              </div>
                              <div className="ff-detailRow">
                                <div className="ff-detailLabel">Duration</div>
                                <div className="ff-detailValue">
                                  {siteVisit.duration_mins} mins
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="ff-detailSub">No site visit booked.</div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {sendOk ? (
                      <div style={{ marginTop: 12 }} className="ff-detailSub">
                        {sendOk}
                      </div>
                    ) : null}

                    {sendError ? (
                      <div style={{ marginTop: 12, color: "#b91c1c" }} className="ff-detailSub">
                        {sendError}
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
            background: transparent;
            padding: 0;
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
            height: 100%;
          }

          .ff-wrap {
            flex: 1 1 auto;
            min-height: 0;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .ff-top {
            border: 1px solid ${FF.border};
            background: ${FF.card};
            border-radius: 18px;
            overflow: hidden;
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
            flex: 0 0 auto;
          }

          .ff-hero {
            position: relative;
            padding: 18px 16px 14px;
            overflow: hidden;
            background: linear-gradient(
              135deg,
              rgba(36, 91, 255, 0.1),
              rgba(255, 255, 255, 0.96)
            );
          }

          .ff-heroGlow {
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 16% 20%, rgba(36, 91, 255, 0.14), transparent 55%),
              radial-gradient(circle at 86% 24%, rgba(11, 42, 85, 0.07), transparent 60%);
            pointer-events: none;
          }

          .ff-heroRow {
            position: relative;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
          }

          .ff-heroLeft {
            display: grid;
            gap: 8px;
          }

          .ff-heroTitle {
            font-size: 28px;
            font-weight: 950;
            color: ${FF.navySoft};
            letter-spacing: -0.02em;
            line-height: 1.05;
          }

          .ff-heroRule {
            height: 3px;
            width: 220px;
            border-radius: 999px;
            background: ${FF.blueLine};
            opacity: 0.95;
          }

          .ff-sub {
            margin-top: 2px;
            font-size: 12px;
            color: ${FF.muted};
            font-weight: 600;
          }

          .ff-actions {
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .ff-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 24px;
            padding: 0 10px;
            border-radius: 999px;
            border: 1px solid ${FF.border};
            font-size: 11px;
            font-weight: 900;
            line-height: 1;
            white-space: nowrap;
          }

          .ff-chipGray {
            background: #f7f9fc;
            color: ${FF.muted};
            border-color: ${FF.border};
          }
.ff-chipNeutral {
  background: #f7f9fc;
  border: 1px solid #e6ecf5;
  color: #5c6b84;
}
          .ff-chipGreen {
            background: ${FF.greenSoft};
            color: #166534;
            border-color: rgba(22, 101, 52, 0.18);
          }

          .ff-chipRed {
            background: ${FF.redSoft};
            color: #b91c1c;
            border-color: rgba(185, 28, 28, 0.18);
          }

          .ff-chipAmber {
            background: ${FF.amberSoft};
            color: #92400e;
            border-color: rgba(146, 64, 14, 0.18);
          }

          .ff-chipBlueSoft {
            background: ${FF.blueSoft2};
            color: ${FF.navySoft};
            border-color: rgba(36, 91, 255, 0.22);
          }

          .ff-controls {
            padding: 12px 14px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: space-between;
            border-top: 1px solid ${FF.border};
            background: linear-gradient(
              180deg,
              rgba(36, 91, 255, 0.06),
              rgba(255, 255, 255, 0)
            );
          }
.ff-postcode {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
          .ff-filterRow {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
          }

          .ff-input {
            height: 38px;
            border-radius: 14px;
            border: 1px solid ${FF.border};
            background: #fff;
            padding: 0 12px;
            outline: none;
            font-size: 13px;
            color: ${FF.text};
            width: 260px;
            max-width: 260px;
            min-width: 0;
            box-sizing: border-box;
          }

          .ff-pillSmall {
            height: 32px;
            border-radius: 999px;
            border: 1px solid ${FF.border};
            padding: 0 12px;
            font-size: 12px;
            font-weight: 900;
            background: #fff;
            color: ${FF.muted};
            cursor: pointer;
          }

          .ff-pillNeutralActive {
            border-color: rgba(36, 91, 255, 0.35);
            background: rgba(36, 91, 255, 0.12);
            color: ${FF.navySoft};
          }

          .ff-toast {
            margin-top: 12px;
            border-radius: 14px;
            border: 1px solid ${FF.border};
            background: #fff;
            padding: 10px 12px;
            font-size: 13px;
            color: ${FF.text};
            flex: 0 0 auto;
          }

          .ff-grid {
            display: grid;
            gap: 14px;
            grid-template-columns: 360px minmax(0, 1fr);
            flex: 1 1 auto;
            min-height: 0;
          }

          .ff-grid > * {
            min-height: 0;
            min-width: 0;
          }

          .ff-card {
            border: 1px solid ${FF.border};
            border-radius: 18px;
            background: #fff;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            min-height: 0;
            min-width: 0;
            box-shadow:
              0 1px 0 rgba(15, 23, 42, 0.03),
              0 14px 30px rgba(15, 23, 42, 0.08);
          }

          .ff-leftPane {
            display: flex;
            flex-direction: column;
            min-height: 0;
            min-width: 0;
          }

          .ff-leftHeadRow {
            padding: 12px;
            border-bottom: 1px solid ${FF.border};
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            flex: 0 0 auto;
          }

          .ff-leftTitle {
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
            padding: 12px 12px 22px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }

          .ff-leftItem {
  position: relative;
  width: 100%;
  text-align: left;
  border-radius: 22px;
  padding: 0;
  overflow: visible;
  border: 1px solid #E6ECF5;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.18s ease;
  display: block;
  min-height: 175px;
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.03),
    0 10px 22px rgba(15, 23, 42, 0.06);
                }


          .ff-leftItem:hover {
            border-color: rgba(36, 91, 255, 0.25);
            background: linear-gradient(
              90deg,
              rgba(36, 91, 255, 0.1) 0%,
              rgba(36, 91, 255, 0.04) 40%,
              #ffffff 85%
            );
            box-shadow:
              0 1px 0 rgba(15, 23, 42, 0.04),
              0 16px 32px rgba(15, 23, 42, 0.1);
            transform: translateY(-2px);
          }

         .ff-leftItem[data-active="1"]::before {
  content: "";
  position: absolute;
  left: 12px;
  top: 20px;
  bottom: 20px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    #1D4ED8 0%,
    #2563EB 35%,
    #60A5FA 72%,
    rgba(96, 165, 250, 0.18) 100%
  );
  box-shadow: 0 0 8px rgba(37, 99, 235, 0.22);
  z-index: 3;
  pointer-events: none;
}
.ff-leftItemInner {
  position: relative;
  z-index: 2;
  padding: 18px 18px 16px 30px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
          .ff-leftItem[data-active="1"] {
            background: linear-gradient(
              90deg,
              rgba(36, 91, 255, 0.18) 0%,
              rgba(36, 91, 255, 0.06) 45%,
              #ffffff 100%
            );
            border-color: rgba(36, 91, 255, 0.35);
            box-shadow:
              0 0 0 2px rgba(36, 91, 255, 0.18),
              0 18px 40px rgba(15, 23, 42, 0.12);
          }

          .ff-leftItemTop {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
          }

         .ff-leftName,
.ff-jobNumber {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #1F355C;
  font-size: 20px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: -0.03em;
}

          .ff-leftDate {
            font-size: 11px;
            color: #94a3b8;
            white-space: nowrap;
            font-weight: 700;
            line-height: 1.1;
          }

          .ff-leftMeta {
  margin-top: 0px;
  color: #8a94a6;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 700;
}

          .ff-leftChips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

          .ff-jobQuickRow {
  display: flex;
  align-items: center;
  gap: 10px 14px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.ff-jobBudget {
  color: #102a56;
  font-size: 15px;
  line-height: 1.15;
  font-weight: 950;
  letter-spacing: -0.01em;
}
         .ff-jobPhotos {
  color: #9aa4b2;
  font-size: 13px;
  line-height: 1.15;
  font-weight: 700;
}
          .ff-leftVisit {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: #102a56;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 900;
}

.ff-leftVisitMuted {
  color: #9aa4b2;
  font-weight: 700;
}
.ff-leftGlowASAP {
  box-shadow:
    0 0 0 3px rgba(239, 68, 68, 0.22),
    0 14px 30px rgba(15, 23, 42, 0.1) !important;
}

.ff-leftGlowWeek {
  box-shadow:
    0 0 0 3px rgba(245, 158, 11, 0.2),
    0 14px 30px rgba(15, 23, 42, 0.1) !important;
}

.ff-leftGlowNext {
  box-shadow:
    0 0 0 3px rgba(34, 197, 94, 0.18),
    0 12px 28px rgba(15, 23, 42, 0.08) !important;
}

.ff-leftGlowFlexible {
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.14),
    0 14px 30px rgba(15, 23, 42, 0.1) !important;
}
          .ff-rightPane {
            display: flex;
            flex-direction: column;
            min-height: 0;
            min-width: 0;
          }

          .ff-rightBody {
            flex: 1 1 auto;
            min-height: 0;
            min-width: 0;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 24px 28px 28px;
            box-sizing: border-box;
            -webkit-overflow-scrolling: touch;
          }

          .ff-rightInner {
            min-width: 0;
          }

          :global(.ff-emptyWrap) {
            min-height: 260px;
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          :global(.ff-empty) {
            border: 1px dashed rgba(36, 91, 255, 0.28);
            background: ${FF.blueSoft2};
            border-radius: 18px;
            padding: 24px;
            text-align: center;
            width: 100%;
            max-width: 520px;
            box-shadow: none;
          }

          :global(.ff-emptyTitle) {
            font-weight: 900;
            color: ${FF.navySoft};
            font-size: 16px;
          }

          :global(.ff-emptySub) {
            margin-top: 6px;
            font-size: 13px;
            color: ${FF.muted};
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .ff-enquiryHeader {
            border: 1px solid rgba(36, 91, 255, 0.3);
            border-radius: 18px;
            padding: 16px 18px;
            background: linear-gradient(
              90deg,
              rgba(36, 91, 255, 0.16) 0%,
              rgba(36, 91, 255, 0.08) 35%,
              rgba(36, 91, 255, 0.03) 60%,
              #ffffff 100%
            );
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 16px;
          }

          .ff-enquiryHeaderLeft {
            min-width: 0;
          }

          .ff-enquiryTitle {
            font-weight: 950;
            color: ${FF.navySoft};
            font-size: 16px;
            margin-bottom: 6px;
          }

          .ff-enquiryMeta {
            color: ${FF.muted};
            font-size: 13px;
            font-weight: 750;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .ff-backMobile {
            display: none;
            background: rgba(31, 53, 92, 0.06);
            border: 1px solid rgba(31, 53, 92, 0.12);
            padding: 6px 12px;
            border-radius: 999px;
            margin: 0 0 12px 0;
            font-weight: 800;
            font-size: 13px;
            color: #1f355c;
            cursor: pointer;
          }

          .ff-btnGhost {
            height: 38px;
            padding: 0 14px;
            border-radius: 999px;
            border: 1px solid ${FF.border};
            background: #fff;
            font-weight: 800;
            font-size: 12px;
            color: ${FF.navySoft};
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .ff-btnGhost:hover {
            transform: translateY(-1px);
          }

          .ff-btnPrimary {
            height: 38px;
            padding: 0 14px;
            border-radius: 999px;
            border: none;
            background: ${FF.navySoft};
            color: #fff;
            font-weight: 800;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .ff-btnPrimary:hover {
            transform: translateY(-1px);
          }

          .ff-btnDanger {
            height: 38px;
            padding: 0 14px;
            padding-top: 1px;
            border-radius: 999px;
            font-weight: 800;
            font-size: 12px;
            color: #dc2626;
            background: #fff;
            border: 1px solid #fecaca;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
          }

          .ff-btnDanger:hover {
            transform: translateY(-1px);
          }

          .ff-headerBtnRow {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            align-items: center;
            justify-content: end;
            max-width: 420px;
          }

          .ff-headerBtnRow > button {
            width: 100%;
            min-width: 0;
          }

          .ff-btnDangerSm {
            height: 32px;
            padding: 0 12px;
            font-size: 12px;
            border-radius: 999px;
          }

          .ff-rightTabs {
            margin: 8px 0 18px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .ff-tabPill {
            height: 34px;
            padding: 0 14px;
            border-radius: 999px;
            border: 1px solid ${FF.border};
            background: #fff;
            font-weight: 850;
            font-size: 13px;
            color: ${FF.navySoft};
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .ff-tabPill:hover {
            transform: translateY(-1px);
          }

          .ff-tabPill.isActive {
            border-color: rgba(36, 91, 255, 0.35);
            background: rgba(36, 91, 255, 0.1);
          }

          .ff-detailGrid {
            display: grid;
            gap: 12px;
          }

          .ff-detailCard {
            border: 1px solid rgba(36, 91, 255, 0.18);
            border-radius: 18px;
            background: linear-gradient(
              180deg,
              rgba(36, 91, 255, 0.08) 0%,
              rgba(36, 91, 255, 0.04) 40%,
              #ffffff
            );
            box-shadow:
              0 1px 0 rgba(36, 91, 255, 0.06),
              0 12px 28px rgba(15, 23, 42, 0.06);
            padding: 16px;
            min-width: 0;
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

          .ff-detailLabel {
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: ${FF.muted};
            opacity: 0.9;
          }

          .ff-detailValue {
            font-size: 14px;
            font-weight: 650;
            color: ${FF.text};
            line-height: 1.45;
            overflow-wrap: anywhere;
            word-break: break-word;
            min-width: 0;
          }

          .ff-detailSub,
          .ff-detailValueSub {
            margin-top: 4px;
            font-size: 13px;
            font-weight: 500;
            color: ${FF.muted};
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
            min-width: 0;
          }

          .ff-inputWide {
            height: 38px;
            width: 100%;
            border-radius: 14px;
            border: 1px solid ${FF.border};
            padding: 0 12px;
            font-size: 13px;
            font-weight: 700;
            outline: none;
            color: ${FF.navySoft};
            box-sizing: border-box;
            min-width: 0;
          }

          .ff-textarea {
            width: 100%;
            min-height: 120px;
            border-radius: 16px;
            border: 1px solid ${FF.border};
            padding: 12px;
            font-size: 13px;
            outline: none;
            color: ${FF.navySoft};
            box-sizing: border-box;
            min-width: 0;
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
            min-width: 0;
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .ff-a {
            color: ${FF.navySoft};
            font-size: 12px;
            font-weight: 800;
            text-decoration: none;
          }

          .ff-inlineBtn {
            height: 30px;
            border-radius: 999px;
            border: 1px solid ${FF.border};
            background: #fff;
            padding: 0 10px;
            font-size: 12px;
            font-weight: 800;
            color: ${FF.navySoft};
            cursor: pointer;
          }

          @media (max-width: 980px) {
            .ff-grid {
              grid-template-columns: 1fr;
            }

            .ff-page[data-mobile-detail="1"] .ff-leftPane {
              display: none;
            }

            .ff-page[data-mobile-detail="0"] .ff-rightPane {
              display: none;
            }

            .ff-rightBody {
              padding: 16px;
            }

            .ff-backMobile {
              display: inline-flex;
            }

            .ff-enquiryHeader {
              flex-direction: column;
              align-items: stretch;
            }

            .ff-headerBtnRow {
              max-width: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}