"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";


/* ================================
   TYPES
================================ */

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
  read_at: string | null;
  created_at: string;
  trader_notes: string | null;
  is_still_working: string | null;
has_happened_before: string | null;
budget: string | null;
parking: string | null;
property_type: string | null;
problem_location: string | null;
};

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

type FileItem = {
  name: string;
  path: string;
  url: string | null;
};

type SiteVisitRow = {
  id: string;
  request_id: string;
  plumber_id: string;
  starts_at: string;
  duration_mins: number;
  created_at: string;
};

/* ================================
   HELPERS
================================ */

function titleCase(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function niceDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    year: "2-digit",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function niceDateOnly(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}
function formatPostcode(pc?: string | null) {
  if (!pc) return "";

  const clean = pc.replace(/\s+/g, "").toUpperCase();

  if (clean.length <= 3) return clean;

  return clean.slice(0, -3) + " " + clean.slice(-3);
}

function formatBudget(budget?: string | null) {
  if (!budget) return "No budget";

  const v = String(budget).trim();

  if (v === "under-100") return "Under £100";
  if (v === "100-250") return "£100–£250";
  if (v === "250-500") return "£250–£500";
  if (v === "500-1000") return "£500–£1,000";
  if (v === "1000-3000") return "£1,000–£3,000";
  if (v === "3000-plus") return "£3,000+";
  if (v === "not-sure") return "Not sure";

  const parts = v.split("-");
  if (parts.length === 2) {
    const min = Number(parts[0]);
    const max = Number(parts[1]);

    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return `£${min.toLocaleString()}–£${max.toLocaleString()}`;
    }
  }

  return v.startsWith("£") ? v : `£${v}`;
}

function urgencyChip(u?: string | null) {
  const v = String(u || "").toLowerCase();
  if (v.includes("asap") || v.includes("urgent") || v.includes("today"))
    return { text: "ASAP", cls: "ff-chip ff-chipRed" };
  if (v.includes("this week") || v.includes("this-week"))
    return { text: "This week", cls: "ff-chip ff-chipAmber" };
  if (v.includes("next week") || v.includes("next-week"))
    return { text: "Next week", cls: "ff-chip ff-chipGreen" };
  return { text: "Flexible", cls: "ff-chip ff-chipBlue" };
}
/* ================================
   CONSTS
================================ */

const BUCKET = "quote-files";
const SITE_VISIT_BOOK_URL = "/api/site-visit/book";

const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;

function safeFileName(name: string) {
  return (name || "file")
    .replaceAll(" ", "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .slice(0, 120);
}

function isOutboundDirection(d?: string | null) {
  const v = String(d || "").toLowerCase();
  return v === "out" || v === "outbound" || v.includes("out");
}

function directionChip(d?: string | null) {
  return isOutboundDirection(d)
    ? { text: "You", cls: "ff-chip ff-chipGray" }
    : { text: "Customer", cls: "ff-chip ff-chipBlue" };
}

function channelChip(c?: string | null) {
  const v = String(c || "").toLowerCase();
  if (v.includes("estimate")) return { text: "Estimate", cls: "ff-chip ff-chipGreen" };
  if (v.includes("enquiry")) return { text: "Enquiry", cls: "ff-chip ff-chipBlue" };
  return { text: "Email", cls: "ff-chip ff-chipBlue" };
}

/* ================================
   COMPONENT
================================ */

export default function EnquiriesClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const requestIdParam = sp.get("requestId");
  const tabParam = sp.get("tab");

  const cleanId = (v?: string | null) => {
    const s = String(v || "").trim();
    if (!s || s === "null" || s === "undefined") return "";
    return s;
  };

  const requestIdFromUrl = cleanId(requestIdParam);
  const urlTab = cleanId(tabParam);

  const [selectedIdState, setSelectedIdState] = useState<string | null>(
    requestIdFromUrl || null
  );

  // Selected enquiry id comes from URL (source of truth) or fallback state
  const selectedId = selectedIdState || requestIdFromUrl;
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

  // Tabs (left header)
  const [tab, setTab] = useState<"all" | "unread" | "notReplied">("all");

  // Global auth + UI
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [postcodeFilter, setPostcodeFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

  // Data
  const [rows, setRows] = useState<QuoteRequestRow[]>([]);

  // Selected row derived from URL
 const selectedRow = useMemo(() => {
  if (!selectedId) return null;
  return rows.find((r) => r.id === selectedId) ?? null;
}, [rows, selectedId]);

  // Right panel tab
  const [rightTab, setRightTab] = useState<
    "details" | "files" | "visit" | "notes" | "messages"
  >("details");

  // Thread
  const [thread, setThread] = useState<EnquiryMessageRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const threadBottomRef = useRef<HTMLDivElement | null>(null);

  // Full message modal
  const [expandedMsg, setExpandedMsg] = useState<EnquiryMessageRow | null>(null);

  // Collapse toggle per message
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const toggleCollapse = (id: string) =>
    setCollapsedIds((p) => ({ ...p, [id]: !p[id] }));

  // Files
  const [custFiles, setCustFiles] = useState<FileItem[]>([]);
  const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoCountMap, setPhotoCountMap] = useState<Record<string, number>>({});

  // Site visit
  const [siteVisit, setSiteVisit] = useState<SiteVisitRow | null>(null);
  const [siteVisitLoading, setSiteVisitLoading] = useState(false);
  const [visitMap, setVisitMap] = useState<Record<string, SiteVisitRow | null>>(
    {}
  );

  // Book visit modal
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [siteVisitStartsAt, setSiteVisitStartsAt] = useState("");
  const [siteVisitDuration, setSiteVisitDuration] = useState(60);
  const [siteVisitSending, setSiteVisitSending] = useState(false);
  const [siteVisitMsg, setSiteVisitMsg] = useState<string | null>(null);

  // Notes
  const [traderNotes, setTraderNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMsg, setNotesMsg] = useState<string | null>(null);

  // Reply
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("Re:");
  const [replyBody, setReplyBody] = useState("");

  // mark-read once
  const lastMarkedRef = useRef<string | null>(null);

  // Persist URL tab + state
  function setTabAndUrl(next: "all" | "unread" | "notReplied") {
    setTab(next);
    if (typeof window !== "undefined")
      window.localStorage.setItem("ff_enquiries_tab", next);

    const parts: string[] = [];
    if (selectedId) parts.push(`requestId=${encodeURIComponent(selectedId)}`);
    parts.push(`tab=${encodeURIComponent(next)}`);

    router.replace(`/dashboard/enquiries?${parts.join("&")}`);
  }

  function openEnquiry(id: string) {
    setSelectedIdState(id);
    const t = tab || "all";
    router.replace(
      `/dashboard/enquiries?requestId=${encodeURIComponent(
        id
      )}&tab=${encodeURIComponent(t)}`
    );
  }

  /* ================================
     SMALL UI HELPERS
  ================================ */

  function Chip({ children, cls }: { children: React.ReactNode; cls: string }) {
    const base: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 10,
      fontWeight: 800,
      lineHeight: 1,
      whiteSpace: "nowrap",
      border: "1px solid transparent",
    };

    const style: React.CSSProperties = { ...base };

    if (cls.includes("ff-chipBlue")) {
      style.background = FF.blueSoft;
      style.borderColor = "rgba(36,91,255,0.32)";
      style.color = FF.navySoft;
    } else if (cls.includes("ff-chipGray")) {
      style.background = "#F7F9FC";
      style.borderColor = FF.border;
      style.color = FF.muted;
    } else if (cls.includes("ff-chipRed")) {
      style.background = FF.redSoft;
      style.borderColor = "#FFC0C0";
      style.color = "#8A1F1F";
    } else if (cls.includes("ff-chipAmber")) {
      style.background = FF.amberSoft;
      style.borderColor = "#FFD7A3";
      style.color = "#8A4B00";
    } else if (cls.includes("ff-chipGreen")) {
      style.background = FF.greenSoft;
      style.borderColor = "#BFE9CF";
      style.color = "#116B3A";
    } else {
      style.background = "#fff";
      style.borderColor = FF.border;
      style.color = FF.navySoft;
    }

    return <span style={style}>{children}</span>;
  }

  function EmptyState({ title, sub }: { title: string; sub?: string }) {
    return (
      <div className="ff-empty">
        <div className="ff-emptyTitle">{title}</div>
        {sub ? <div className="ff-emptySub">{sub}</div> : null}
      </div>
    );
  }

  function Modal({
    open,
    title,
    onClose,
    children,
  }: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
  }) {
    if (!open) return null;

    return (
      <div className="ff-modalOverlay" onMouseDown={onClose} role="dialog" aria-modal="true">
        <div className="ff-modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="ff-modalHead">
            <div className="ff-modalTitle">{title}</div>
            <button type="button" className="ff-x" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="ff-modalBody">{children}</div>
        </div>
      </div>
    );
  }
    /* ================================
     LOADERS + ACTIONS
  ================================ */

  async function listFilesWithSignedUrls(folder: string): Promise<FileItem[]> {
    const bucket = supabase.storage.from(BUCKET);
    const { data, error } = await bucket.list(folder, { limit: 100 });
    if (error || !data) return [];

    const files = data.filter((f) => f.name && f.name !== ".emptyFolderPlaceholder");

    const out: FileItem[] = [];
    for (const f of files) {
      const path = `${folder}/${f.name}`;
      const { data: signed, error: signErr } = await bucket.createSignedUrl(path, 60 * 10);
      out.push({ name: f.name, path, url: signErr ? null : signed?.signedUrl ?? null });
    }
    return out;
  }

  async function loadRequestsForTrader(traderId: string) {
    setToast(null);

    const { data, error } = await supabase
      .from("quote_requests")
    .select(
  "id,job_number,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,status,read_at,created_at,trader_notes,is_still_working,has_happened_before,budget,parking,property_type,problem_location"
)
      .eq("plumber_id", traderId)
      .order("created_at", { ascending: false });

    if (error) {
      setRows([]);
      setToast(`Load failed: ${error.message}`);
      return;
    }
const list = (data || []) as QuoteRequestRow[];
setRows(list);

// load photo counts in background
(async () => {
  const counts: Record<string, number> = {};

  await Promise.all(
    list.map(async (r) => {
      const { data } = await supabase.storage
        .from(BUCKET)
        .list(`request/${r.id}/customer`, { limit: 100 });

      counts[r.id] = data ? data.length : 0;
    })
  );

  setPhotoCountMap(counts);
})();

    // If URL has requestId but it's gone, bounce back
    if (requestIdFromUrl) {
      const exists = list.some((r) => r.id === requestIdFromUrl);
      if (!exists) router.replace("/dashboard/enquiries");
    }

    await loadSiteVisitMap(traderId, list.map((r) => r.id));
  }

  async function loadSiteVisitMap(traderId: string, requestIds: string[]) {
    if (!requestIds.length) {
      setVisitMap({});
      return;
    }

    const { data, error } = await supabase
      .from("site_visits")
      .select("id,request_id,plumber_id,starts_at,duration_mins,created_at")
      .eq("plumber_id", traderId)
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });

    if (error) return;

    const map: Record<string, SiteVisitRow | null> = {};
    for (const id of requestIds) map[id] = null;

    (data || []).forEach((v: any) => {
      if (!map[v.request_id]) map[v.request_id] = v as SiteVisitRow;
    });

    setVisitMap(map);
  }

  async function markReadOnce(requestId: string) {
    if (!uid) return;
    if (lastMarkedRef.current === requestId) return;
    lastMarkedRef.current = requestId;

    // Optimistic UI
    setRows((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, read_at: r.read_at ?? new Date().toISOString() } : r
      )
    );

    const { error } = await supabase
      .from("quote_requests")
      .update({ read_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("plumber_id", uid);

    if (error) console.warn("markReadOnce error:", error.message);
  }

  async function loadThread(requestId: string, plumberId: string) {
    setThreadLoading(true);
    try {
      const { data, error } = await supabase
        .from("enquiry_messages")
        .select(
          "id,request_id,plumber_id,direction,channel,subject,body_text,from_email,to_email,resend_id,created_at"
        )
        .eq("request_id", requestId)
        .eq("plumber_id", plumberId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const list = (data || []) as EnquiryMessageRow[];
      setThread(list);

      // Ensure collapse map has keys
      setCollapsedIds((prev) => {
        const next = { ...prev };
        for (const m of list) if (next[m.id] === undefined) next[m.id] = false;
        return next;
      });
    } catch (e: any) {
      setThread([]);
      console.warn("loadThread error:", e?.message || e);
    } finally {
      setThreadLoading(false);
      setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    }
  }

  async function loadSiteVisit(requestId: string, plumberId: string) {
    setSiteVisitLoading(true);
    try {
      const { data, error } = await supabase
        .from("site_visits")
        .select("id, request_id, plumber_id, starts_at, duration_mins, created_at")
        .eq("request_id", requestId)
        .eq("plumber_id", plumberId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSiteVisit((data as SiteVisitRow) || null);
    } catch {
      setSiteVisit(null);
    } finally {
      setSiteVisitLoading(false);
    }
  }

  async function loadAttachments(requestId: string) {
    setFilesLoading(true);
    setFileMsg(null);
    try {
      const [c, t] = await Promise.all([
        listFilesWithSignedUrls(customerFolder(requestId)),
        listFilesWithSignedUrls(traderFolder(requestId)),
      ]);
      setCustFiles(c);
      setTraderFiles(t);
    } finally {
      setFilesLoading(false);
    }
  }

  async function onUploadTraderFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length || !selectedRow) return;

    setUploading(true);
    setFileMsg(null);

    try {
      const fd = new FormData();
      fd.append("requestId", selectedRow.id);
      fd.append("kind", "trader");
      files.forEach((f) => fd.append("files", f, safeFileName(f.name)));

      const res = await fetch("/api/quote-requests/upload", { method: "POST", body: fd });
      const result = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(result?.error || "Upload failed");

      e.target.value = "";
      setFileMsg("Uploaded ✓");
      await loadAttachments(selectedRow.id);
    } catch (err: any) {
      setFileMsg(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deleteTraderFile(filePath: string) {
    if (!selectedRow) return;
    const ok = confirm("Delete this attachment?");
    if (!ok) return;

    setUploading(true);
    setFileMsg(null);

    try {
      const fd = new FormData();
      fd.append("requestId", selectedRow.id);
      fd.append("kind", "trader");
      fd.append("path", filePath);

      const res = await fetch("/api/quote-requests/delete", { method: "POST", body: fd });
      const result = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(result?.error || "Delete failed");

      setFileMsg("Deleted ✓");
      await loadAttachments(selectedRow.id);
    } catch (e: any) {
      setFileMsg(e?.message || "Delete failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveTraderNotes() {
    if (!selectedRow || !uid) return;

    setNotesSaving(true);
    setNotesMsg(null);

    const { error } = await supabase
      .from("quote_requests")
      .update({ trader_notes: traderNotes })
      .eq("id", selectedRow.id)
      .eq("plumber_id", uid);

    if (error) setNotesMsg(error.message);
    else {
      setNotesMsg("Saved ✓");
      setRows((prev) =>
        prev.map((r) => (r.id === selectedRow.id ? { ...r, trader_notes: traderNotes } : r))
      );
      setTimeout(() => setNotesMsg(null), 1200);
    }

    setNotesSaving(false);
  }

  function openSiteVisitModal() {
    if (!selectedRow) return;
    setSiteVisitMsg(null);

    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);

    const pad = (n: number) => String(n).padStart(2, "0");
    const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;

    setSiteVisitStartsAt(v);
    setSiteVisitDuration(60);
    setSiteVisitOpen(true);
  }

  async function confirmSiteVisit() {
    if (!selectedRow) return;
    if (!siteVisitStartsAt) return setSiteVisitMsg("Pick a date/time.");

    setSiteVisitSending(true);
    setSiteVisitMsg(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const res = await fetch(SITE_VISIT_BOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedRow.id,
          plumberId: user.id,
          startsAtLocal: siteVisitStartsAt,
          durationMins: siteVisitDuration,
        }),
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("API route not found (returned HTML). Check URL + route folder name.");
      }
      if (!res.ok) throw new Error(data?.error || "Failed to book site visit");

      await loadSiteVisit(selectedRow.id, user.id);
      await loadSiteVisitMap(user.id, rows.map((r) => r.id));

      setSiteVisitMsg("Booked + email sent ✓");
      setTimeout(() => {
        setSiteVisitOpen(false);
        setSiteVisitMsg(null);
      }, 900);
    } catch (e: any) {
      setSiteVisitMsg(e?.message || "Failed to book site visit");
    } finally {
      setSiteVisitSending(false);
    }
  }

  async function goToCreateEstimate() {
    if (!selectedRow) return;
    router.push(`/dashboard/estimates?requestId=${encodeURIComponent(selectedRow.id)}`);
  }

  async function deleteEnquiry() {
    if (!selectedRow || !uid) return;
    const ok = confirm("Delete this enquiry? This cannot be undone.");
    if (!ok) return;

    setToast(null);

    try {
      await supabase
        .from("enquiry_messages")
        .delete()
        .eq("request_id", selectedRow.id)
        .eq("plumber_id", uid);

      await supabase
        .from("site_visits")
        .delete()
        .eq("request_id", selectedRow.id)
        .eq("plumber_id", uid);

      const { error } = await supabase
        .from("quote_requests")
        .delete()
        .eq("id", selectedRow.id)
        .eq("plumber_id", uid);

      if (error) throw error;

      setToast("Deleted ✓");
      router.replace("/dashboard/enquiries");
      await loadRequestsForTrader(uid);
      setTimeout(() => setToast(null), 1400);
    } catch (e: any) {
      setToast(e?.message || "Delete failed");
    }
  }

  async function sendReply() {
    if (!selectedRow || !uid) return;

    setToast(null);

    const to = (replyTo || "").trim();
    if (!to) return setToast("Missing customer email.");

    const subject = (replySubject || "").trim() || "Re:";
    const text = (replyBody || "").trim();
    if (!text) return setToast("Message is empty.");

    try {
      const res = await fetch("/api/enquiries/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: selectedRow.id, to, subject, text }),
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        const looksLikeHtml = /<!doctype html>|<html/i.test(raw || "");
        throw new Error(
          looksLikeHtml
            ? "API route not found (returned HTML). Check /app/api/enquiries/send-email/route.ts"
            : "Invalid JSON returned from send-email API."
        );
      }

      if (!res.ok) throw new Error(data?.error || `Send failed (${res.status})`);

      // Optimistic add
      const optimisticMsg: EnquiryMessageRow = {
        id: `optimistic-${Date.now()}`,
        request_id: selectedRow.id,
        plumber_id: uid,
        direction: "out",
        channel: "email",
        subject,
        body_text: text,
        from_email: null,
        to_email: to,
        resend_id: data?.resend_id ?? null,
        created_at: new Date().toISOString(),
      };

      setThread((prev) => [...prev, optimisticMsg]);
      setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

      // Mark replied in DB
      const { error: statusErr } = await supabase
        .from("quote_requests")
        .update({ status: "replied" })
        .eq("id", selectedRow.id)
        .eq("plumber_id", uid);

      if (statusErr) console.warn("status update failed:", statusErr.message);

      // Update local
      setRows((prev) => prev.map((r) => (r.id === selectedRow.id ? { ...r, status: "replied" } : r)));

      setToast("Reply sent ✓");
      setReplyBody("");

      await loadThread(selectedRow.id, uid);
      await loadRequestsForTrader(uid);

      setTimeout(() => setToast(null), 1500);
    } catch (e: any) {
      setToast(e?.message || "Send failed");
    }
  }

  /* ================================
     EFFECTS
  ================================ */

  useEffect(() => {
    setSelectedIdState(requestIdFromUrl || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestIdFromUrl]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      if (!mounted) return;
      setUid(userId);

      // initial tab from URL -> localStorage -> default all
      const saved =
        typeof window !== "undefined" ? window.localStorage.getItem("ff_enquiries_tab") : null;

      const pick =
        urlTab === "all" || urlTab === "unread" || urlTab === "notReplied"
          ? (urlTab as any)
          : saved === "all" || saved === "unread" || saved === "notReplied"
          ? (saved as any)
          : "all";

      setTab(pick);

      if (!userId) {
        setLoading(false);
        setToast("Please log in.");
        return;
      }

      await loadRequestsForTrader(userId);

      const ch = supabase
        .channel("ff_enquiries_quote_requests")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "quote_requests", filter: `plumber_id=eq.${userId}` },
          () => loadRequestsForTrader(userId)
        )
        .subscribe();

      setLoading(false);

      return () => {
        supabase.removeChannel(ch);
      };
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
useEffect(() => {
  if (!selectedRow || !uid) return;

  setTraderNotes(selectedRow.trader_notes || "");
  setReplyTo((selectedRow.customer_email || "").trim());
  setReplySubject(`Re: ${selectedRow.job_type ? titleCase(selectedRow.job_type) : "Enquiry"}`);
  setReplyBody("");

  markReadOnce(selectedRow.id);

  if (rightTab === "messages") {
    loadThread(selectedRow.id, uid);
  }

  if (rightTab === "visit") {
    loadSiteVisit(selectedRow.id, uid);
  }

  if (rightTab === "files") {
    loadAttachments(selectedRow.id);
  }

  let msgCh: any = null;

  if (rightTab === "messages") {
    msgCh = supabase
      .channel(`ff_enquiry_messages_${selectedRow.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "enquiry_messages",
          filter: `request_id=eq.${selectedRow.id}`,
        },
        () => loadThread(selectedRow.id, uid)
      )
      .subscribe();
  }

  return () => {
    if (msgCh) supabase.removeChannel(msgCh);
  };
}, [selectedRow?.id, uid, rightTab]);

  /* ================================
     MEMOS
  ================================ */

  const metrics = useMemo(() => {
    const total = rows.length;

    const notReplied = rows.filter(
      (r) => !String(r.status || "").toLowerCase().includes("replied")
    ).length;

    const thisWeek = rows.filter((r) => {
      const created = new Date(r.created_at);
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return created >= weekAgo;
    }).length;

    const siteVisits = Object.values(visitMap).filter(Boolean).length;

    return { total, notReplied, thisWeek, siteVisits };
  }, [rows, visitMap]);

  const visibleRows = useMemo(() => {
    let list = [...rows];

    if (tab === "unread") list = list.filter((r) => !r.read_at);
    if (tab === "notReplied")
      list = list.filter((r) => !String(r.status || "").toLowerCase().includes("replied"));

    if (postcodeFilter.trim()) {
      const needle = postcodeFilter.trim().toLowerCase();
      list = list.filter((r) => String(r.postcode || "").toLowerCase().includes(needle));
    }

    if (urgencyFilter.trim()) {
      const needle = urgencyFilter.trim().toLowerCase();
      list = list.filter((r) => String(r.urgency || "").toLowerCase().includes(needle));
    }

    return list;
  }, [rows, tab, postcodeFilter, urgencyFilter]);

  const counts = useMemo(() => {
    const all = rows.length;
    const unread = rows.filter((r) => !r.read_at).length;
    const notReplied = rows.filter(
      (r) => !String(r.status || "").toLowerCase().includes("replied")
    ).length;
    return { all, unread, notReplied };
  }, [rows]);

  const siteVisitLabel = siteVisitLoading
    ? "Loading…"
    : siteVisit
    ? `Booked • ${niceDate(siteVisit.starts_at)}`
    : "Not booked";
      /* ================================
     RETURN (FULL JSX + CSS)
  ================================ */

  return (


   <div
  className="ff-page"
  data-mobile-detail={selectedRow ? "1" : "0"}
  suppressHydrationWarning
>
 <div className="ff-wrap" suppressHydrationWarning>
    {/* TOP */}
<div className="ff-top">
  <div className="ff-hero">
    <div className="ff-heroGlow" />
    <div className="ff-heroRow">
      <div className="ff-heroLeft">
        <div className="ff-heroTitle">Enquiries</div>
        <div className="ff-heroRule" />
        <div className="ff-heroSub">
          Full message trail, quick reply, attachments and site visits.
        </div>
        {/* FULL EMAIL MODAL (this is what makes "Open" work) */}
<Modal
  open={siteVisitOpen}
  title="Book site visit"
  onClose={() => setSiteVisitOpen(false)}
>
  <div
    style={{
      maxWidth: 420,
      margin: "0 auto",
      display: "grid",
      gap: 16,
    }}
  ></div>
  <div style={{ display: "grid", gap: 12 }}>
    {siteVisitMsg ? (
      <div style={{ fontSize: 13, color: FF.muted }}>{siteVisitMsg}</div>
    ) : null}

    <div>
      <div className="ff-detailLabel" style={{ marginBottom: 6 }}>
        Date and time
      </div>

      <input
        type="datetime-local"
        className="ff-input"
        value={siteVisitStartsAt}
        onChange={(e) => setSiteVisitStartsAt(e.target.value)}
      />
    </div>

    <div>
      <div className="ff-detailLabel" style={{ marginBottom: 6 }}>
        Duration
      </div>

      <select
        className="ff-input"
        value={siteVisitDuration}
        onChange={(e) => setSiteVisitDuration(Number(e.target.value))}
      >
        <option value={30}>30 minutes</option>
        <option value={60}>1 hour</option>
        <option value={90}>1.5 hours</option>
        <option value={120}>2 hours</option>
      </select>
    </div>

    <div style={{ display: "flex", gap: 10 }}>
      <button
        className="ff-btn ff-btnPrimary ff-btnSm"
        onClick={confirmSiteVisit}
        disabled={siteVisitSending}
      >
        {siteVisitSending ? "Booking…" : "Confirm booking"}
      </button>

      <button
        className="ff-btn ff-btnGhost ff-btnSm"
        onClick={() => setSiteVisitOpen(false)}
      >
        Cancel
      </button>
    </div>
  </div>
</Modal>
<Modal
  open={!!expandedMsg}
  title={expandedMsg?.subject ? expandedMsg.subject : "Email"}
  onClose={() => setExpandedMsg(null)}
>
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ fontSize: 12, color: FF.muted, fontWeight: 800 }}>
      {expandedMsg?.from_email ? <>From: {expandedMsg.from_email}</> : null}
      {expandedMsg?.from_email && expandedMsg?.to_email ? <> • </> : null}
      {expandedMsg?.to_email ? <>To: {expandedMsg.to_email}</> : null}
    </div>

    <div style={{ fontSize: 12, color: FF.muted }}>
      {expandedMsg?.created_at ? niceDate(expandedMsg.created_at) : ""}
    </div>

    <div
      style={{
        border: `1px solid ${FF.border}`,
        background: FF.blueSoft2,
        borderRadius: 16,
        padding: 12,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        fontSize: 13,
        lineHeight: 1.55,
        color: FF.text,
      }}
    >
      {(expandedMsg?.body_text ?? "").trim() || "—"}
    </div>
  </div>
</Modal>
      </div>

      <div className="ff-actions">
        <button
          className="ff-btn ff-btnGhost"
          type="button"
          onClick={() => {
            if (uid) loadRequestsForTrader(uid);
            if (selectedRow && uid) loadThread(selectedRow.id, uid);
          }}
        >
          Refresh
        </button>

        <button className="ff-btn ff-btnGhost" type="button" disabled={!selectedRow}>
          Call
        </button>

        <button className="ff-btn ff-btnGhost" type="button" disabled={!selectedRow}>
          Email
        </button>

        <button
          className="ff-btn ff-btnPrimary"
          type="button"
          onClick={openSiteVisitModal}
          disabled={!selectedRow}
        >
          Book visit
        </button>
      </div>
    </div>
  </div>

  {/* CONTROLS */}
  <div className="ff-controls">
    <div className="ff-filterRow">
      <button
        type="button"
        className={`ff-pillSmall ${tab === "all" ? "ff-pillNeutralActive" : ""}`}
        onClick={() => setTabAndUrl("all")}
      >
        All {counts.all}
      </button>

      <button
        type="button"
        className={`ff-pillSmall ${tab === "unread" ? "ff-pillNeutralActive" : ""}`}
        onClick={() => setTabAndUrl("unread")}
      >
        Unread {counts.unread}
      </button>

      <button
        type="button"
        className={`ff-pillSmall ${tab === "notReplied" ? "ff-pillNeutralActive" : ""}`}
        onClick={() => setTabAndUrl("notReplied")}
      >
        Not replied {counts.notReplied}
      </button>
    </div>

    <div className="ff-filterRow">
      <input
        className="ff-input"
        placeholder="Postcode / area"
        value={postcodeFilter}
        onChange={(e) => setPostcodeFilter(e.target.value)}
      />

      <div className="ff-pillGroup">
        <button
          type="button"
          className={`ff-pillSmall ${urgencyFilter === "" ? "ff-pillNeutralActive" : ""}`}
          onClick={() => setUrgencyFilter("")}
        >
          All urgency
        </button>

        <button
          type="button"
          className={`ff-pillSmall ff-pillRed ${urgencyFilter === "asap" ? "ff-pillRedActive" : ""}`}
          onClick={() => setUrgencyFilter("asap")}
        >
          ASAP
        </button>

        <button
          type="button"
          className={`ff-pillSmall ff-pillAmber ${
            urgencyFilter === "this week" ? "ff-pillAmberActive" : ""
          }`}
          onClick={() => setUrgencyFilter("this week")}
        >
          This week
        </button>

        <button
          type="button"
          className={`ff-pillSmall ff-pillGreen ${
            urgencyFilter === "next week" ? "ff-pillGreenActive" : ""
          }`}
          onClick={() => setUrgencyFilter("next week")}
        >
          Next week
        </button>

        <button
          type="button"
          className={`ff-pillSmall ff-pillBlue ${
            urgencyFilter === "flex" ? "ff-pillBlueActive" : ""
          }`}
          onClick={() => setUrgencyFilter("flex")}
        >
          Flexible
        </button>
      </div>
    </div>
  </div>

  {toast ? <div className="ff-toast">{toast}</div> : null}
</div>
    

    {/* GRID */}
    <div className="ff-grid">
      {/* LEFT */}
     <div className="ff-card ff-leftPane">
  <div className="ff-leftHeadRow">
    <div className="ff-leftTitle">All enquiries</div>
    <div className="ff-leftCount">{visibleRows.length}</div>
  </div>

  <div className="ff-leftList">
    {loading ? (
      <div style={{ padding: 12, color: FF.muted, fontSize: 13 }}>Loading…</div>
    ) : visibleRows.length ? (
      visibleRows.map((r) => {
        const active = r.id === selectedId;
        const urg = urgencyChip(r.urgency);

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

        const read = r.read_at
          ? { text: "Read", cls: "ff-chip ff-chipGray" }
          : { text: "Unread", cls: "ff-chip ff-chipBlue" };

        const replied = String(r.status || "").toLowerCase().includes("replied")
          ? { text: "Replied", cls: "ff-chip ff-chipGreen" }
          : { text: "Awaiting reply", cls: "ff-chip ff-chipAmber" };

        const v = visitMap[r.id];

        return (
          <button
            key={r.id}
            className={`ff-leftItem ${urgencyGlow}`}
            data-active={active ? "1" : "0"}
            type="button"
            onClick={() => {
              setRightTab("details");
              openEnquiry(r.id);
            }}
          >
            <div className="ff-leftItemInner">
              <div className="ff-leftItemTop">
                <div className="ff-jobNumber">
                  {!r.read_at && <span className="ff-unreadDot" />}
                  {r.job_number || `FF-${r.id.slice(0, 4).toUpperCase()}`}
                </div>

                <div className="ff-leftDate">{niceDateOnly(r.created_at)}</div>
              </div>

              <div className="ff-leftMeta">
                {r.postcode ? `${formatPostcode(r.postcode)} • ` : ""}
                {titleCase(r.job_type || "Enquiry")}
              </div>

              <div className="ff-jobQuickRow">
                <div className="ff-jobBudget">{formatBudget(r.budget)}</div>
                <div className="ff-jobPhotos">Photos: {photoCountMap[r.id] ?? 0}</div>
                <div className="ff-jobContextInline">
                  {r.property_type ? titleCase(r.property_type) : "—"}
                  {" • "}
                  {r.problem_location ? titleCase(r.problem_location) : "—"}
                </div>
              </div>

              <div className="ff-leftChips">
                <Chip cls={urg.cls}>{urg.text}</Chip>
                <Chip cls={read.cls}>{read.text}</Chip>
                <Chip cls={replied.cls}>{replied.text}</Chip>
              </div>

              <div className="ff-leftVisit">
                <span className="ff-leftVisitLabel">Site visit</span>
                <span className="ff-leftVisitMuted">
                  {v ? niceDate(v.starts_at) : "Not booked yet"}
                </span>
              </div>
            </div>
          </button>
        );
      })
    ) : (
      <div style={{ padding: 12, color: FF.muted, fontSize: 13 }}>
        No enquiries match your filters.
      </div>
    )}
  </div>
</div>
      {/* RIGHT */}
      <div className="ff-card ff-rightPane">
        <div className="ff-rightBody">
          {!selectedRow ? (
            <div className="ff-emptyWrap">
              <EmptyState title="Select an enquiry" sub="Pick one from the list to view details." />
            </div>
          ) : (
            <>
              {/* Back (mobile) */}
              <button
                type="button"
                className="ff-backMobile"
                onClick={() => {
                  setSelectedIdState(null);
                  setRightTab("details");
                  router.replace(`/dashboard/enquiries?tab=${encodeURIComponent(tab || "all")}`);
                }}
              >
                ← Back to enquiries
              </button>

      {/* Header card */}
<div className="ff-enquiryHeader">
  <div className="ff-enquiryHeaderLeft">
    <div className="ff-enquiryTitle">
      {selectedRow.job_number || "—"} · {titleCase(selectedRow.job_type || "Enquiry")}
    </div>
    <div className="ff-enquiryMeta">
      {titleCase(selectedRow.customer_name || "Customer")} · {formatPostcode(selectedRow.postcode) || "—"}
    </div>
  </div>

  <div className="ff-enquiryHeaderRight">
    <button
      type="button"
      className="ff-btn ff-btnPrimary ff-btnSm"
      onClick={goToCreateEstimate}
    >
      Create estimate
    </button>

    <button
      type="button"
      className="ff-btn ff-btnDanger ff-btnSm"
      onClick={deleteEnquiry}
    >
      Delete
    </button>
  </div>
</div>

{/* Tabs (PILLS back ✅) */}
<div className="ff-rightTabs">
  {(["details", "files", "visit", "notes", "messages"] as const).map((t) => {
    const active = rightTab === t;
    return (
      <button
        key={t}
        type="button"
        className={`ff-tabPill ${active ? "isActive" : ""}`}
        onClick={() => setRightTab(t)}
      >
        {t === "details"
          ? "Job details"
          : t === "files"
          ? "Attachments"
          : t === "visit"
          ? "Site visit"
          : t === "notes"
          ? "Notes"
          : "Messages"}
      </button>
    );
  })}
</div>

<div className="ff-rightInner">
               {/* DETAILS */}
{rightTab === "details" ? (
  
  <div className="ff-detailGrid">
    <div className="ff-detailCard">
<div className="ff-detailRow">
  <div className="ff-detailLabel">Job number</div>
  <div className="ff-detailValue">
    {selectedRow.job_number || "—"}
  </div>
</div>
      <div className="ff-detailRow">
        <div className="ff-detailLabel">Urgency</div>
        <div className="ff-detailValue">
          {titleCase(selectedRow.urgency || "Flexible")}
        </div>
      </div>

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Customer</div>
        <div style={{ minWidth: 0 }}>
          <div className="ff-detailValue">
            {selectedRow.customer_name || "Customer"}
          </div>
          <div className="ff-detailSub">
            {selectedRow.customer_email || "—"}
            {selectedRow.customer_phone ? `\n${selectedRow.customer_phone}` : ""}
          </div>
        </div>
      </div>

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Address</div>
        <div className="ff-detailValue">
          {selectedRow.address || selectedRow.postcode || "—"}
        </div>
      </div>

      {/* NEW FIELDS */}

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Still working</div>
        <div className="ff-detailValue">
          {selectedRow.is_still_working || "—"}
        </div>
      </div>

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Happened before</div>
        <div className="ff-detailValue">
          {selectedRow.has_happened_before || "—"}
        </div>
      </div>

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Budget</div>
      <div className="ff-detailValue">
  {formatBudget(selectedRow.budget)}
</div>
      </div>

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Property type</div>
        <div className="ff-detailValue">
          {selectedRow.property_type || "—"}
        </div>
      </div>

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Parking / access</div>
        <div className="ff-detailValue">
          {selectedRow.parking || "—"}
        </div>
      </div>

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Problem location</div>
        <div className="ff-detailValue">
          {selectedRow.problem_location || "—"}
        </div>
      </div>

      {/* EXISTING */}

      <div className="ff-detailRow">
        <div className="ff-detailLabel">Details</div>
        <div className="ff-detailValue">{selectedRow.details || "—"}</div>
      </div>

    </div>
  </div>
) : null}

                {/* FILES */}
                {rightTab === "files" ? (
  <div className="ff-detailGrid">
    <div className="ff-detailCard">
      <div className="ff-detailLabel">Attachments</div>
      <div className="ff-detailSub">
        Customer photos and trader uploads for this enquiry.
      </div>

      {fileMsg ? (
        <div style={{ marginTop: 10, fontSize: 13, color: FF.muted }}>
          {fileMsg}
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
          Customer photos
        </div>

        {filesLoading ? (
          <div style={{ fontSize: 13, color: FF.muted }}>Loading attachments…</div>
        ) : custFiles.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
            }}
          >
            {custFiles.map((file) => {
              const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
              return (
                <a
                  key={file.path}
                  href={file.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    textDecoration: "none",
                    border: `1px solid ${FF.border}`,
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      height: 120,
                      background: FF.blueSoft2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isImage && file.url ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 12, color: FF.muted, padding: 10 }}>
                        Open file
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: 10,
                      fontSize: 12,
                      color: FF.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {file.name}
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: FF.muted }}>No customer photos.</div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
          Upload trader files
        </div>

        <input
          type="file"
          multiple
          onChange={onUploadTraderFiles}
          disabled={uploading}
          className="ff-input"
        />

        {uploading ? (
          <div style={{ marginTop: 8, fontSize: 13, color: FF.muted }}>Uploading…</div>
        ) : null}
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
          Trader files
        </div>

        {filesLoading ? (
          <div style={{ fontSize: 13, color: FF.muted }}>Loading attachments…</div>
        ) : traderFiles.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {traderFiles.map((file) => (
              <div
                key={file.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: 10,
                  border: `1px solid ${FF.border}`,
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <a
                  href={file.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: FF.navy,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {file.name}
                </a>

                <button
                  type="button"
                  className="ff-btn ff-btnGhost ff-btnSm"
                  onClick={() => deleteTraderFile(file.path)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: FF.muted }}>No trader files uploaded yet.</div>
        )}
      </div>
    </div>
  </div>
) : null}

                {/* VISIT */}
                {rightTab === "visit" ? (
                  <div className="ff-detailGrid">
                    <div className="ff-detailCard">
                      <div className="ff-detailLabel">Site visit</div>
                      <div className="ff-detailValue">{siteVisitLabel}</div>

                      <div style={{ marginTop: 10 }}>
                        <button
                          className="ff-btn ff-btnPrimary ff-btnSm"
                          type="button"
                          onClick={openSiteVisitModal}
                        >
                          Book
                        </button>
                      </div>

                      <div style={{ marginTop: 10, fontSize: 12, color: FF.muted }}>
                        Book a visit and we’ll email the customer with the date/time.
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* NOTES */}
                {rightTab === "notes" ? (
                  <div className="ff-detailGrid">
                    <div className="ff-detailCard">
                      {notesMsg ? (
                        <div style={{ marginBottom: 10, fontSize: 13, color: FF.muted }}>
                          {notesMsg}
                        </div>
                      ) : null}

                      <textarea
                        style={{
                          width: "100%",
                          minHeight: 140,
                          borderRadius: 16,
                          border: `1px solid ${FF.border}`,
                          padding: 12,
                          outline: "none",
                          fontSize: 13,
                          lineHeight: 1.45,
                          color: FF.text,
                        }}
                        value={traderNotes}
                        onChange={(e) => setTraderNotes(e.target.value)}
                        placeholder="Materials, access notes, pricing thoughts, follow-ups…"
                      />

                      <div style={{ marginTop: 10 }}>
                        <button
                          className="ff-btn ff-btnPrimary ff-btnSm"
                          type="button"
                          onClick={saveTraderNotes}
                          disabled={notesSaving}
                        >
                          {notesSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* MESSAGES */}
{rightTab === "messages" ? (
  <div className="ff-detailGrid">
    <div className="ff-detailCard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div className="ff-detailLabel">Email trail</div>
          <div className="ff-detailSub">All emails to and from the customer for this enquiry.</div>
        </div>

        <button
          className="ff-btn ff-btnGhost ff-btnSm"
          type="button"
          onClick={() => uid && selectedRow && loadThread(selectedRow.id, uid)}
          disabled={threadLoading}
        >
          {threadLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="ff-threadBody" style={{ marginTop: 12 }}>
        {threadLoading ? (
          <div style={{ color: FF.muted, fontSize: 13 }}>Loading emails…</div>
        ) : thread.length ? (
          thread.map((m) => {
            const outbound = isOutboundDirection(m.direction);
            const dir = directionChip(m.direction);
            const ch = channelChip(m.channel);

            const body = (m.body_text ?? "").trim();
            const collapsed = !!collapsedIds[m.id];
            const shouldClamp = body.length > 260;

            return (
              <div key={m.id} className={`ff-mail ${outbound ? "ff-mailOut" : ""}`}>
                <div className="ff-mailHead">
                  <div className="ff-mailLeft">
                    <div className="ff-mailMeta">
                      <div className="ff-mailTopRow">
                        <Chip cls={dir.cls}>{dir.text}</Chip>
                        <Chip cls={ch.cls}>{ch.text}</Chip>
                        <div className="ff-mailSubject">{m.subject || "(No subject)"}</div>
                      </div>

                      {(m.from_email || m.to_email) ? (
                        <div className="ff-mailFromTo">
                          {m.from_email ? <>From: {m.from_email}</> : null}
                          {m.from_email && m.to_email ? <> • </> : null}
                          {m.to_email ? <>To: {m.to_email}</> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="ff-mailRight">
                    <div style={{ fontSize: 12, color: FF.muted, whiteSpace: "nowrap" }}>
                      {niceDate(m.created_at)}
                    </div>
                    <button
                      className="ff-btn ff-btnGhost ff-btnSm"
                      type="button"
                      onClick={() => setExpandedMsg(m)}
                    >
                      Open
                    </button>
                  </div>
                </div>

                <div className={`ff-mailBody ${shouldClamp && collapsed ? "ff-mailBodyClamp" : ""}`}>
                  {body || "—"}
                </div>

                {shouldClamp ? (
                  <button
                    className="ff-btn ff-btnGhost ff-btnSm"
                    style={{ marginTop: 10 }}
                    type="button"
                    onClick={() => toggleCollapse(m.id)}
                  >
                    {collapsed ? "Show full email" : "Collapse"}
                  </button>
                ) : null}
              </div>
            );
          })
        ) : (
          <EmptyState title="No emails yet" sub="When you send or receive emails, they will appear here." />
        )}

        <div ref={threadBottomRef} />
      </div>

      {/* SEND EMAIL */}
      <div style={{ marginTop: 14 }}>
        <div className="ff-detailLabel" style={{ marginBottom: 8 }}>
          Send email
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

<textarea
  className="ff-input ff-replyBox"
  style={{ marginTop: 10 }}
  value={replyBody}
  onChange={(e) => setReplyBody(e.target.value)}
  placeholder="Type your email…"
/>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="ff-btn ff-btnPrimary ff-btnSm" type="button" onClick={sendReply}>
            Send email
          </button>
          <button className="ff-btn ff-btnGhost ff-btnSm" type="button" onClick={() => setReplyBody("")}>
            Clear
          </button>
        </div>
      </div>
    </div>
  </div>
) : null}

<Modal
  open={!!expandedMsg}
  title={expandedMsg?.subject || "Email"}
  onClose={() => setExpandedMsg(null)}
>
  <div style={{ display: "grid", gap: 8 }}>
    <div style={{ fontSize: 12, color: FF.muted }}>
      {expandedMsg?.created_at ? niceDate(expandedMsg.created_at) : ""}
    </div>

    {(expandedMsg?.from_email || expandedMsg?.to_email) ? (
      <div style={{ fontSize: 12, color: FF.muted }}>
        {expandedMsg?.from_email ? <>From: {expandedMsg.from_email}</> : null}
        {expandedMsg?.from_email && expandedMsg?.to_email ? <> • </> : null}
        {expandedMsg?.to_email ? <>To: {expandedMsg.to_email}</> : null}
      </div>
    ) : null}

   <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55 }}>
  {(expandedMsg?.body_text || "").trim() || "—"}
</div>
</div>
</Modal>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
</div>
</div>
);
}