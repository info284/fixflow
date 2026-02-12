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

 status: string | null; // e.g. "replied"
 read_at: string | null;

 created_at: string;
 trader_notes: string | null;
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

// IMPORTANT: your DB DOES NOT have `body` (your screenshot shows that).
// So this page uses ONLY `body_text`.
type EnquiryMessageRow = {
 id: string;
 request_id: string;
 plumber_id: string;

 direction: string | null; // "inbound" | "outbound" OR "in" | "out"
 channel: string | null;

 subject: string | null;
 body_text: string | null;

 from_email: string | null;
 to_email: string | null;

 resend_id: string | null;

 created_at: string;
};

/* ================== CONSTS ================== */

const BUCKET = "quote-files";
const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;

const SITE_VISIT_BOOK_URL = "/api/site-visit/book";

/* ================== HELPERS ================== */

function cleanId(v?: string | null) {
 const s = String(v || "").trim();
 if (!s || s === "null" || s === "undefined") return "";
 return s;
}

function niceDate(iso?: string | null) {
 if (!iso) return "";
 try {
 return new Date(iso).toLocaleString([], {
 year: "2-digit",
 month: "2-digit",
 day: "2-digit",
 hour: "2-digit",
 minute: "2-digit",
 });
 } catch {
 return String(iso);
 }
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

function titleCase(s?: string | null) {
 return (s || "")
 .toLowerCase()
 .split(" ")
 .filter(Boolean)
 .map((w) => w[0]?.toUpperCase() + w.slice(1))
 .join(" ");
}

function safeFileName(name: string) {
 return (name || "file")
 .replaceAll(" ", "-")
 .replace(/[^a-zA-Z0-9.\-_]/g, "")
 .slice(0, 120);
}

function urgencyChip(u?: string | null) {
 const v = String(u || "").toLowerCase();

 if (v.includes("asap") || v.includes("urgent") || v.includes("today")) {
 return { text: "ASAP", cls: "border-red-300 bg-red-50 text-red-700" };
 }
 if (v.includes("this week") || v.includes("this-week")) {
 return { text: "This week", cls: "border-amber-300 bg-amber-50 text-amber-800" };
 }
 if (v.includes("next week") || v.includes("next-week")) {
 return { text: "Next week", cls: "border-emerald-300 bg-emerald-50 text-emerald-700" };
 }
 if (v.includes("flex")) {
 return { text: "Flexible", cls: "border-emerald-300 bg-emerald-50 text-emerald-700" };
 }
 if (!v) return { text: "Standard", cls: "border-gray-300 bg-gray-50 text-gray-700" };
 return { text: titleCase(v), cls: "border-gray-300 bg-gray-50 text-gray-700" };
}

function Chip({ children, cls }: { children: React.ReactNode; cls: string }) {
 return (
 <span className={`inline-flex items-center rounded-full border px-2 py-[3px] text-[11px] leading-none ${cls}`}>
 {children}
 </span>
 );
}

function isOutboundDirection(d?: string | null) {
 const v = String(d || "").toLowerCase();
 return v === "out" || v === "outbound" || v.includes("out");
}

function directionChip(d?: string | null) {
 return isOutboundDirection(d)
 ? { text: "You", cls: "border-gray-300 bg-gray-50 text-gray-700" }
 : { text: "Customer", cls: "border-blue-200 bg-blue-50 text-blue-700" };
}

function channelChip(c?: string | null) {
 const v = String(c || "").toLowerCase();
 if (v.includes("estimate")) return { text: "Estimate", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
 return { text: "Email", cls: "border-slate-200 bg-slate-50 text-slate-700" };
}

/** Lists files + signed URLs */
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

/* ================== PAGE ================== */

export default function InboxPage() {
 const router = useRouter();
 const sp = useSearchParams();
 const requestIdFromUrl = cleanId(sp.get("requestId"));

 const [uid, setUid] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [loadMsg, setLoadMsg] = useState<string | null>(null);

 const [tab, setTab] = useState<"all" | "unread" | "notReplied">("notReplied");
 const [postcodeFilter, setPostcodeFilter] = useState("");
 const [urgencyFilter, setUrgencyFilter] = useState("");

 const [rows, setRows] = useState<QuoteRequestRow[]>([]);
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

 // Trader notes
 const [traderNotes, setTraderNotes] = useState("");
 const [notesSaving, setNotesSaving] = useState(false);
 const [notesMsg, setNotesMsg] = useState<string | null>(null);

 // attachments
 const [custFiles, setCustFiles] = useState<FileItem[]>([]);
 const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);
 const [custFilesLoading, setCustFilesLoading] = useState(false);
 const [traderFilesLoading, setTraderFilesLoading] = useState(false);
 const [fileMsg, setFileMsg] = useState<string | null>(null);
 const [uploading, setUploading] = useState(false);

 // reply
 const [replyTo, setReplyTo] = useState("");
 const [replySubject, setReplySubject] = useState("Re:");
 const [replyBody, setReplyBody] = useState("");

 const lastMarkedRef = useRef<string | null>(null);

 // site visit
 const [siteVisit, setSiteVisit] = useState<SiteVisitRow | null>(null);
 const [siteVisitLoading, setSiteVisitLoading] = useState(false);

 // site visit modal
 const [siteVisitOpen, setSiteVisitOpen] = useState(false);
 const [siteVisitStartsAt, setSiteVisitStartsAt] = useState("");
 const [siteVisitDuration, setSiteVisitDuration] = useState(60);
 const [siteVisitSending, setSiteVisitSending] = useState(false);
 const [siteVisitMsg, setSiteVisitMsg] = useState<string | null>(null);

 // estimate
 const [estimateBusy, setEstimateBusy] = useState(false);

 // message trail
 const [thread, setThread] = useState<EnquiryMessageRow[]>([]);
 const [threadLoading, setThreadLoading] = useState(false);
 const threadBottomRef = useRef<HTMLDivElement | null>(null);

 function openSiteVisitModal() {
 if (!selectedRow) return;

 setSiteVisitMsg(null);

 const d = new Date();
 d.setDate(d.getDate() + 1);
 d.setHours(9, 0, 0, 0);

 const pad = (n: number) => String(n).padStart(2, "0");
 const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
 d.getMinutes()
 )}`;

 setSiteVisitStartsAt(v);
 setSiteVisitDuration(60);
 setSiteVisitOpen(true);
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

 async function confirmSiteVisit() {
 if (!selectedRow) return;
 if (!siteVisitStartsAt) {
 setSiteVisitMsg("Please pick a date/time.");
 return;
 }

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
 data = JSON.parse(raw);
 } catch {
 throw new Error("API route not found (returned HTML). Check the URL + route folder name.");
 }

 if (!res.ok) throw new Error(data?.error || "Failed to book site visit");

 await loadSiteVisit(selectedRow.id, user.id);

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

 async function loadRequestsForTrader(traderId: string) {
 setLoadMsg(null);

 let q = supabase
 .from("quote_requests")
 .select(
 "id,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,status,read_at,created_at,trader_notes"
 )
 .eq("plumber_id", traderId)
 .order("created_at", { ascending: false });

 if (tab === "unread") q = q.is("read_at", null);
 if (tab === "notReplied") q = q.not("status", "ilike", "%replied%");

 const { data, error } = await q;

 if (error) {
 setLoadMsg(`Load failed: ${error.message}`);
 setRows([]);
 return;
 }

 setRows((data || []) as QuoteRequestRow[]);
 }

 async function markReadOnce(requestId: string) {
 if (!uid) return;
 if (lastMarkedRef.current === requestId) return;
 lastMarkedRef.current = requestId;

 setRows((prev) => prev.map((r) => (r.id === requestId ? { ...r, read_at: r.read_at ?? new Date().toISOString() } : r)));

 const { error } = await supabase
 .from("quote_requests")
 .update({ read_at: new Date().toISOString() })
 .eq("id", requestId)
 .eq("plumber_id", uid);

 if (error) console.warn("markRead error:", error.message);
 }

 async function loadAttachments(requestId: string) {
 setFileMsg(null);

 setCustFilesLoading(true);
 setCustFiles([]);
 try {
 const c = await listFilesWithSignedUrls(customerFolder(requestId));
 setCustFiles(c);
 } finally {
 setCustFilesLoading(false);
 }

 setTraderFilesLoading(true);
 setTraderFiles([]);
 try {
 const t = await listFilesWithSignedUrls(traderFolder(requestId));
 setTraderFiles(t);
 } finally {
 setTraderFilesLoading(false);
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

 if (error) {
 setNotesMsg(error.message);
 } else {
 setNotesMsg("Notes saved ✓");
 setRows((prev) => prev.map((r) => (r.id === selectedRow.id ? { ...r, trader_notes: traderNotes } : r)));
 setTimeout(() => setNotesMsg(null), 1200);
 }

 setNotesSaving(false);
 }

 async function deleteEnquiry() {
 if (!selectedRow || !uid) return;

 const ok = confirm("Delete this enquiry? This cannot be undone.");
 if (!ok) return;

 setLoadMsg(null);

 try {
 const { error } = await supabase
  .from("quote_requests")
  .update({ status: "replied" })
  .eq("id", selectedRow.id)
  .eq("plumber_id", uid);

 setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
 setSelectedId(null);
 setSiteVisit(null);
 setThread([]);
 router.replace("/dashboard/inbox");

 setLoadMsg("Enquiry deleted ✓");
 setTimeout(() => setLoadMsg(null), 1500);
 } catch (e: any) {
 setLoadMsg(e?.message || "Delete failed");
 }
 }

 async function goToCreateEstimate() {
 if (!selectedRow || !uid) return;
 setEstimateBusy(true);
 try {
 router.push(`/dashboard/estimates?requestId=${encodeURIComponent(selectedRow.id)}`);
 } finally {
 setEstimateBusy(false);
 }
 }

 async function loadThread(requestId: string, plumberId: string) {
 setThreadLoading(true);
 try {
 const { data, error } = await supabase
 .from("enquiry_messages")
 .select("id,request_id,plumber_id,direction,channel,subject,body_text,from_email,to_email,resend_id,created_at")
 .eq("request_id", requestId)
 .eq("plumber_id", plumberId)
 .order("created_at", { ascending: true });

 if (error) throw error;
 setThread((data || []) as EnquiryMessageRow[]);
 } catch (e: any) {
 setThread([]);
 console.warn("loadThread error:", e?.message || e);
 } finally {
 setThreadLoading(false);
 setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
 }
 }

 async function logOutboundMessage(opts: {
 requestId: string;
 plumberId: string;
 to: string;
 subject: string;
 bodyText: string;
 channel?: string;
 resendId?: string | null;
 }) {
 try {
await supabase.from("enquiry_messages").insert({
  request_id: opts.requestId,
  plumber_id: opts.plumberId,
  direction: "out",             
  channel: opts.channel || "email",
  subject: opts.subject || null,
  body_text: opts.bodyText || null,
  from_email: null,
  to_email: opts.to || null,
  resend_id: opts.resendId || null,
});
 } catch (e) {
 console.warn("logOutboundMessage failed:", e);
 }
 }

 async function sendReply() {
 if (!selectedRow || !uid) return;

 setLoadMsg(null);
 const to = (replyTo || "").trim();
 if (!to) return setLoadMsg("Missing customer email.");

 const subject = (replySubject || "").trim() || "Re:";
 const text = (replyBody || "").trim();
 if (!text) return setLoadMsg("Message is empty.");

 try {
 const res = await fetch("/api/enquiries/send-email", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 requestId: selectedRow.id,
 to,
 subject,
 text,
 }),
 });

 const result = await res.json().catch(() => ({} as any));
 if (!res.ok) throw new Error(result?.error || "Send failed");


 await loadThread(selectedRow.id, uid);
 await loadRequestsForTrader(uid);

 setReplyBody("");
 setLoadMsg("Reply sent ✓");
 setTimeout(() => setLoadMsg(null), 1500);
 } catch (e: any) {
 setLoadMsg(e?.message || "Send failed");
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
 setLoadMsg("Please log in.");
 return;
 }

 await loadRequestsForTrader(userId);

 const ch = supabase
 .channel("ff_inbox_quote_requests")
 .on("postgres_changes", { event: "*", schema: "public", table: "quote_requests", filter: `plumber_id=eq.${userId}` }, () => {
 loadRequestsForTrader(userId);
 })
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
 if (!uid) return;
 loadRequestsForTrader(uid);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [tab]);

 useEffect(() => {
 if (!requestIdFromUrl) return;
 setSelectedId(requestIdFromUrl);
 }, [requestIdFromUrl]);

 useEffect(() => {
 if (!selectedRow || !uid) return;

 setTraderNotes(selectedRow.trader_notes || "");
 setNotesMsg(null);

 markReadOnce(selectedRow.id);
 loadAttachments(selectedRow.id);

 setReplyTo((selectedRow.customer_email || "").trim());
 setReplySubject(`Re: ${selectedRow.job_type ? titleCase(selectedRow.job_type) : "Enquiry"}`);
 setReplyBody("");

 loadSiteVisit(selectedRow.id, uid);
 loadThread(selectedRow.id, uid);

 const msgCh = supabase
 .channel(`ff_enquiry_messages_${selectedRow.id}`)
 .on("postgres_changes", { event: "*", schema: "public", table: "enquiry_messages", filter: `request_id=eq.${selectedRow.id}` }, () => {
 loadThread(selectedRow.id, uid);
 })
 .subscribe();

 return () => {
 supabase.removeChannel(msgCh);
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [selectedRow?.id, uid]);

 const visibleRows = useMemo(() => {
 let list = [...rows];

 if (postcodeFilter.trim()) {
 const needle = postcodeFilter.trim().toLowerCase();
 list = list.filter((r) => String(r.postcode || "").toLowerCase().includes(needle));
 }

 if (urgencyFilter.trim()) {
 const needle = urgencyFilter.trim().toLowerCase();
 list = list.filter((r) => String(r.urgency || "").toLowerCase().includes(needle));
 }

 return list;
 }, [rows, postcodeFilter, urgencyFilter]);

 const counts = useMemo(() => {
 const all = rows.length;
 const unread = rows.filter((r) => !r.read_at).length;
 const notReplied = rows.filter((r) => !String(r.status || "").toLowerCase().includes("replied")).length;
 return { all, unread, notReplied };
 }, [rows]);

 if (loading) return <div className="text-sm text-gray-500">Loading inbox…</div>;

 const siteVisitLabel = siteVisitLoading
 ? "Site visit: loading…"
 : siteVisit
 ? `Site visit: booked (${niceDate(siteVisit.starts_at)})`
 : "Site visit: not booked";

 return (
 <div className="mx-auto max-w-[1100px]">
 {/* Header */}
 <div className="mb-3">
 <h1 className="text-xl font-semibold">
  {tab === "notReplied" ? "New enquiries" : "Enquiries"}
</h1>
 <div className="text-xs text-gray-500">Urgency first. Quick scan. Message trail + reply + site visits + attachments.</div>
 </div>

 {loadMsg && (
 <div className="mb-3 border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap">
 {loadMsg}
 </div>
 )}

 {/* Controls */}
 <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <button
 onClick={() => setTab("all")}
 className={`rounded-full border px-3 py-1 text-xs ${tab === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"}`}
 >
 All {counts.all}
 </button>
 <button
 onClick={() => setTab("unread")}
 className={`rounded-full border px-3 py-1 text-xs ${tab === "unread" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"}`}
 >
 Unread {counts.unread}
 </button>
 <button
 onClick={() => setTab("notReplied")}
 className={`rounded-full border px-3 py-1 text-xs ${tab === "notReplied" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"}`}
 >
 Not replied {counts.notReplied}
 </button>
 </div>

 <div className="flex gap-2">
 <input
 value={postcodeFilter}
 onChange={(e) => setPostcodeFilter(e.target.value)}
 className="h-9 w-[220px] rounded-md border px-3 text-sm"
 placeholder="Postcode or area"
 />
 <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} className="h-9 w-[170px] rounded-md border px-3 text-sm">
 <option value="">All urgency</option>
 <option value="asap">ASAP</option>
 <option value="urgent">Urgent</option>
 <option value="this week">This week</option>
 <option value="next week">Next week</option>
 <option value="flex">Flexible</option>
 </select>
 </div>
 </div>

 {/* Layout */}
 <div className="grid grid-cols-12 gap-3">
 {/* LEFT */}
 <div className="col-span-12 md:col-span-4 border bg-white">
 <div className="border-b px-3 py-2 text-xs font-semibold">All enquiries</div>

 {visibleRows.length === 0 ? (
 <div className="px-3 py-4 text-sm text-gray-600">No enquiries found.</div>
 ) : (
 <div>
 {visibleRows.map((r) => {
 const active = r.id === (selectedRow?.id || "");
 const urg = urgencyChip(r.urgency);

 return (
 <button
 key={r.id}
 onClick={() => {
 setSelectedId(r.id);
 router.replace(`/dashboard/inbox?requestId=${encodeURIComponent(r.id)}`);
 }}
 className={`w-full border-b px-3 py-3 text-left hover:bg-gray-50 ${active ? "bg-gray-100" : ""}`}
 >
 <div className="flex items-center justify-between">
 <div className="text-sm font-semibold uppercase tracking-wide truncate">{(r.customer_name || "Customer").toString()}</div>
 <div className="text-xs text-gray-500">{niceDateOnly(r.created_at)}</div>
 </div>

 <div className="mt-1 text-xs text-gray-700">
 {(r.postcode || "—").toString()} • {titleCase(r.job_type) || "Job"}
 </div>

 <div className="mt-2 flex flex-wrap gap-2">
 <Chip cls={urg.cls}>{urg.text}</Chip>
 <Chip cls="border-emerald-200 bg-emerald-50 text-emerald-700">{r.read_at ? "Read" : "Unread"}</Chip>
 <Chip cls="border-amber-200 bg-amber-50 text-amber-800">{String(r.status || "").toLowerCase().includes("replied") ? "Replied" : "Not replied"}</Chip>
 </div>
 </button>
 );
 })}
 </div>
 )}
 </div>

 {/* RIGHT */}
 <div className="col-span-12 md:col-span-8 border bg-white p-4">
 {!selectedRow ? (
 <div className="text-sm text-gray-600">Select an enquiry to view it.</div>
 ) : (
 <div className="space-y-4">
 {/* TOP HEADER BAR */}
 <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="text-lg font-semibold">{titleCase(selectedRow.job_type) || "Enquiry"}</div>
 <div className="text-sm text-gray-700 truncate">
 {selectedRow.customer_name || "—"} • {selectedRow.customer_email || "—"} • {selectedRow.postcode || "—"}
 </div>

 <div className="mt-2 flex flex-wrap gap-2">
 <Chip cls={urgencyChip(selectedRow.urgency).cls}>Urgency: {urgencyChip(selectedRow.urgency).text}</Chip>

 {siteVisitLoading ? (
 <Chip cls="border-gray-300 bg-gray-50 text-gray-700">Site visit: loading…</Chip>
 ) : siteVisit ? (
 <Chip cls="border-emerald-200 bg-emerald-50 text-emerald-700">Site visit: booked ({niceDate(siteVisit.starts_at)})</Chip>
 ) : (
 <Chip cls="border-gray-300 bg-gray-50 text-gray-700">Site visit: not booked</Chip>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 <button
 type="button"
 onClick={goToCreateEstimate}
 disabled={estimateBusy}
 className="h-9 rounded-md border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-60"
 >
 {estimateBusy ? "Opening…" : "Create estimate"}
 </button>

 <button
 type="button"
 onClick={deleteEnquiry}
 className="h-9 rounded-md border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-gray-200"
 >
 Delete enquiry
 </button>
 </div>
 </div>
 </div>

 {/* Job details */}
 <div>
 <div className="text-sm font-semibold mb-2">Job details</div>
 <div className="rounded-xl border px-4 py-4 text-sm">
 <div className="whitespace-pre-wrap">{selectedRow.details || "—"}</div>
 <div className="mt-3 text-sm text-gray-700">
 <span className="font-semibold">Address:</span> {selectedRow.address || "—"}
 </div>
 <div className="mt-2 text-[11px] text-gray-400">ID: {selectedRow.id}</div>
 </div>
 </div>

 {/* Message trail */}
 <div className="rounded-xl border p-4">
 <div className="flex items-start justify-between gap-3">
 <div>
 <div className="text-sm font-semibold">Message trail</div>
 <div className="text-xs text-gray-500">Full conversation for this enquiry (customer + you).</div>
 </div>

 <button
 type="button"
 onClick={() => uid && selectedRow?.id && loadThread(selectedRow.id, uid)}
 className="h-9 rounded-md border px-3 text-sm hover:bg-gray-50 disabled:opacity-60"
 disabled={!uid || !selectedRow?.id || threadLoading}
 >
 {threadLoading ? "Refreshing…" : "Refresh"}
 </button>
 </div>

 <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border bg-white">
 {threadLoading ? (
 <div className="p-3 text-sm text-gray-600">Loading messages…</div>
 ) : thread.length === 0 ? (
 <div className="p-3 text-sm text-gray-600">No messages yet. Send a reply below and it will appear here.</div>
 ) : (
 <div className="p-3 space-y-3">
 {thread.map((m) => {
 const dir = directionChip(m.direction);
 const ch = channelChip(m.channel);
 const outbound = isOutboundDirection(m.direction);
 const body = (m.body_text ?? "").trim();

 return (
 <div key={m.id} className={`rounded-xl border px-3 py-2 ${outbound ? "bg-gray-50" : "bg-white"}`}>
 <div className="flex items-center justify-between gap-2">
 <div className="flex flex-wrap items-center gap-2">
 <Chip cls={dir.cls}>{dir.text}</Chip>
 <Chip cls={ch.cls}>{ch.text}</Chip>
 {m.subject ? <span className="text-xs font-semibold text-gray-800 truncate">{m.subject}</span> : null}
 </div>
 <div className="text-[11px] text-gray-500">{niceDate(m.created_at)}</div>
 </div>

 {(m.from_email || m.to_email) && (
 <div className="mt-1 text-[11px] text-gray-500">
 {m.from_email ? <span>From: {m.from_email}</span> : null}
 {m.from_email && m.to_email ? <span> • </span> : null}
 {m.to_email ? <span>To: {m.to_email}</span> : null}
 </div>
 )}

 <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{body || "—"}</div>
 </div>
 );
 })}
 <div ref={threadBottomRef} />
 </div>
 )}
 </div>

 <div className="mt-2 text-[11px] text-gray-400">
 Tip: your replies appear instantly. Customer replies will appear once you store inbound emails into <span className="font-semibold">enquiry_messages</span>.
 </div>
 </div>

 {/* Attachments */}
 <div>
 <div className="flex items-center justify-between">
 <div>
 <div className="text-sm font-semibold">Attachments</div>
 <div className="text-xs text-gray-500">Bucket: {BUCKET}</div>
 </div>

 <label className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer">
 {uploading ? "Uploading…" : "Upload"}
 <input type="file" multiple className="hidden" onChange={onUploadTraderFiles} disabled={uploading} />
 </label>
 </div>

 {fileMsg && <div className="mt-2 border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">{fileMsg}</div>}

 <div className="mt-3 text-xs font-semibold text-gray-600">Customer attachments</div>
 {custFilesLoading ? (
 <p className="text-sm text-slate-600">Loading…</p>
 ) : custFiles.length === 0 ? (
 <p className="text-sm text-slate-600">No attachments found.</p>
 ) : (
 <div className="mt-2 space-y-2">
 {custFiles.map((f) => (
 <div key={f.path} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
 <div className="min-w-0">
 <p className="truncate text-sm text-slate-900">{f.name}</p>
 <p className="truncate text-xs text-slate-500">{f.path}</p>
 </div>
 <button
 type="button"
 onClick={() => f.url && window.open(f.url, "_blank", "noopener,noreferrer")}
 disabled={!f.url}
 className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
 >
 View
 </button>
 </div>
 ))}
 </div>
 )}

 <div className="mt-4 text-xs font-semibold text-gray-600">Your attachments</div>
 {traderFilesLoading ? (
 <p className="text-sm text-slate-600">Loading…</p>
 ) : traderFiles.length === 0 ? (
 <p className="text-sm text-slate-600">No attachments added yet.</p>
 ) : (
 <div className="mt-2 space-y-2">
 {traderFiles.map((f) => (
 <div key={f.path} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
 <div className="min-w-0">
 <p className="truncate text-sm text-slate-900">{f.name}</p>
 <p className="truncate text-xs text-slate-500">{f.path}</p>
 </div>

 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => f.url && window.open(f.url, "_blank", "noopener,noreferrer")}
 disabled={!f.url}
 className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
 >
 View
 </button>

 <button
 type="button"
 onClick={() => deleteTraderFile(f.path)}
 disabled={uploading}
 className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
 >
 Delete
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Site visit */}
 <div className="rounded-xl border px-4 py-3 flex items-center justify-between">
 <div>
 <div className="text-sm font-semibold">Site visit</div>
 <div className="text-xs text-gray-500">{siteVisitLabel}</div>
 </div>
 <button type="button" onClick={openSiteVisitModal} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50">
 {siteVisit ? "Rebook site visit" : "Book site visit"}
 </button>
 </div>

 {/* Trader notes */}
 <div className="rounded-xl border p-4">
 <div className="flex items-center justify-between">
 <div className="text-sm font-semibold">Trader notes</div>
 <button
 type="button"
 onClick={saveTraderNotes}
 disabled={notesSaving}
 className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
 >
 {notesSaving ? "Saving…" : "Save"}
 </button>
 </div>

 <textarea
 value={traderNotes}
 onChange={(e) => setTraderNotes(e.target.value)}
 placeholder="Notes only you can see… (materials, access, pricing, follow-up etc.)"
 className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
 rows={5}
 />

 {notesMsg ? <div className="mt-2 text-xs text-gray-600">{notesMsg}</div> : null}
 </div>

 {/* Reply */}
 <div className="rounded-xl border p-4">
 <div className="text-sm font-semibold mb-3">Reply to customer</div>

 <div className="grid gap-3">
 <div>
 <div className="text-xs font-medium text-gray-600 mb-1">To</div>
 <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
 </div>

 <div>
 <div className="text-xs font-medium text-gray-600 mb-1">Subject</div>
 <input
 value={replySubject}
 onChange={(e) => setReplySubject(e.target.value)}
 className="w-full rounded-md border px-3 py-2 text-sm"
 />
 </div>

 <div>
 <div className="text-xs font-medium text-gray-600 mb-1">Message</div>
 <textarea
 value={replyBody}
 onChange={(e) => setReplyBody(e.target.value)}
 className="w-full rounded-md border px-3 py-2 text-sm"
 rows={6}
 placeholder="Type your reply…"
 />
 </div>

 <div className="flex gap-2">
 <button
 onClick={sendReply}
 className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-60"
 disabled={!replyTo.trim() || !replyBody.trim()}
 >
 Send reply
 </button>
 <button onClick={() => setReplyBody("")} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50">
 Clear
 </button>
 </div>
 </div>
 </div>

 {/* Site visit modal */}
 {siteVisitOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3">
 <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
 <div className="flex items-start justify-between gap-3">
 <div>
 <div className="text-sm font-semibold">{siteVisit ? "Rebook site visit" : "Book site visit"}</div>
 <div className="text-xs text-gray-500">This will email the customer a calendar invite.</div>
 </div>

 <button type="button" onClick={() => setSiteVisitOpen(false)} className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50">
 ✕
 </button>
 </div>

 <div className="mt-3 grid gap-3">
 <div>
 <div className="text-xs font-medium text-gray-600 mb-1">Date & time</div>
 <input
 type="datetime-local"
 value={siteVisitStartsAt}
 onChange={(e) => setSiteVisitStartsAt(e.target.value)}
 className="h-10 w-full rounded-md border px-3 text-sm"
 />
 </div>

 <div>
 <div className="text-xs font-medium text-gray-600 mb-1">Duration</div>
 <select
 value={siteVisitDuration}
 onChange={(e) => setSiteVisitDuration(Number(e.target.value))}
 className="h-10 w-full rounded-md border px-3 text-sm"
 >
 <option value={30}>30 mins</option>
 <option value={45}>45 mins</option>
 <option value={60}>60 mins</option>
 <option value={90}>90 mins</option>
 </select>
 </div>

 {siteVisitMsg && (
 <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">{siteVisitMsg}</div>
 )}

 <div className="flex justify-end gap-2">
 <button
 type="button"
 onClick={() => setSiteVisitOpen(false)}
 className="h-10 rounded-md border px-4 text-sm hover:bg-gray-50"
 disabled={siteVisitSending}
 >
 Cancel
 </button>

 <button
 type="button"
 onClick={confirmSiteVisit}
 className="h-10 rounded-md bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-60"
 disabled={siteVisitSending}
 >
 {siteVisitSending ? "Booking…" : "Confirm + email"}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 <div className="text-[11px] text-gray-400">
 Tip: your replies appear instantly in the Message trail and the sidebar updates to “Replied”.
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}