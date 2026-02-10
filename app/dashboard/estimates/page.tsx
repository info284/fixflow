"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * ESTIMATES PAGE
 * /dashboard/estimates
 *
 * LEFT: all estimates (quotes)
 * RIGHT: selected estimate editor (same page)
 *
 * Coming from inbox:
 * /dashboard/estimates?requestId=<quote_requests.id>
 * -> creates/opens draft quote linked to that request.
 *
 * Selecting a quote:
 * /dashboard/estimates?quoteId=<quotes.id>
 */

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

 status: string | null; // draft/sent
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

const BUCKET = "quote-files";
const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;

function isUuid(v: string) {
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

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
 year: "numeric",
 month: "short",
 day: "2-digit",
 });
 } catch {
 return String(iso);
 }
}

function niceTimeOnly(iso?: string | null) {
 if (!iso) return "";
 try {
 return new Date(iso).toLocaleTimeString([], {
 hour: "2-digit",
 minute: "2-digit",
 });
 } catch {
 return "";
 }
}

function titleCase(s?: string | null) {
 return (s || "")
 .toLowerCase()
 .split(" ")
 .filter(Boolean)
 .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
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

function sentLabel(q: QuoteRow) {
 const isSent = String(q.status || "").toLowerCase().includes("sent");
 if (!isSent) return "Draft";
 const s = q.sent_at ? niceDate(q.sent_at) : "";
 return s ? `Sent ${s}` : "Sent";
}

async function listFilesWithSignedUrls(folder: string): Promise<FileItem[]> {
 const bucket = supabase.storage.from(BUCKET);
 const { data, error } = await bucket.list(folder, { limit: 100 });
 if (error || !data) return [];

 const files = data.filter((f) => f.name && f.name !== ".emptyFolderPlaceholder");

 const out: FileItem[] = [];
 for (const f of files) {
 const p = `${folder}/${f.name}`;
 const { data: signed, error: signErr } = await bucket.createSignedUrl(p, 60 * 10);
 out.push({
 name: f.name,
 path: p,
 url: signErr ? null : signed?.signedUrl ?? null,
 });
 }

 return out;
}

export default function EstimatesPage() {
 const router = useRouter();
 const sp = useSearchParams();

 const requestIdFromUrl = cleanId(sp.get("requestId"));
 const quoteIdFromUrl = cleanId(sp.get("quoteId"));

 const [uid, setUid] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);

 const [msg, setMsg] = useState<string | null>(null);
 const [sentBanner, setSentBanner] = useState<string | null>(null);

 const [postcodeFilter, setPostcodeFilter] = useState("");
 const [urgencyFilter, setUrgencyFilter] = useState("");

 const [quotes, setQuotes] = useState<QuoteRow[]>([]);
 const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
 const selectedQuote = useMemo(() => quotes.find((q) => q.id === selectedQuoteId) || null, [quotes, selectedQuoteId]);

 const [rq, setRq] = useState<QuoteRequestRow | null>(null);

 const [customerEmail, setCustomerEmail] = useState("");
 const [vatRate, setVatRate] = useState<"0" | "20">("20");
 const [subtotal, setSubtotal] = useState("");
 const [note, setNote] = useState("");
 const [jobDetails, setJobDetails] = useState("");

 const [saving, setSaving] = useState(false);
 const [sending, setSending] = useState(false);

 const [emailSubject, setEmailSubject] = useState("Your estimate");
 const [customerNote, setCustomerNote] = useState("");

 const [custFiles, setCustFiles] = useState<FileItem[]>([]);
 const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);
 const [custFilesLoading, setCustFilesLoading] = useState(false);
 const [traderFilesLoading, setTraderFilesLoading] = useState(false);
 const [fileMsg, setFileMsg] = useState<string | null>(null);
 const [uploading, setUploading] = useState(false);

 const [siteVisit, setSiteVisit] = useState<SiteVisitRow | null>(null);
 const [siteVisitLoading, setSiteVisitLoading] = useState(false);

 // NEW: request_id -> urgency map (fixes sidebar updating)
 const [requestUrgencyById, setRequestUrgencyById] = useState<Record<string, string | null>>({});

 const initRef = useRef<string>("");
 const lastAutoCreateRef = useRef<string>("");
 const sentTimerRef = useRef<number | null>(null);

 const effectiveRequestId = useMemo(() => {
 const a = cleanId(selectedQuote?.request_id || "");
 if (a && isUuid(a)) return a;

 const b = cleanId(requestIdFromUrl);
 if (b && isUuid(b)) return b;

 return "";
 }, [selectedQuote?.request_id, requestIdFromUrl]);

 // keep your “prefer enquiry urgency” for TOP BAR
 const displayUrgency = useMemo(() => rq?.urgency ?? selectedQuote?.urgency ?? null, [rq?.urgency, selectedQuote?.urgency]);

 const summary = useMemo(() => {
 const s = numOrNull(subtotal) ?? 0;
 const r = (Number(vatRate) || 0) / 100;
 const vat = s * r;
 const total = s + vat;
 return { s, vat, total };
 }, [subtotal, vatRate]);

 // NEW: load urgencies for all request_ids currently in sidebar
 async function loadRequestUrgencies(traderId: string, requestIds: string[]) {
 const ids = Array.from(new Set(requestIds.map(cleanId).filter((id) => id && isUuid(id))));
 if (!ids.length) {
 setRequestUrgencyById({});
 return;
 }

 const { data, error } = await supabase
 .from("quote_requests")
 .select("id, urgency")
 .eq("plumber_id", traderId)
 .in("id", ids);

 if (error) {
 console.warn("loadRequestUrgencies error:", error.message);
 return;
 }

 const map: Record<string, string | null> = {};
 for (const r of data || []) map[(r as any).id] = (r as any).urgency ?? null;

 setRequestUrgencyById(map);
 }

 async function loadQuotes(traderId: string) {
 setMsg(null);

 const { data, error } = await supabase
 .from("quotes")
 .select(
 "id,plumber_id,request_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,vat_rate,subtotal,note,job_details,status,sent_at,created_at"
 )
 .eq("plumber_id", traderId)
 .order("created_at", { ascending: false });

 if (error) {
 setQuotes([]);
 setMsg(`Load failed: ${error.message}`);
 return;
 }

 const list = (data || []) as QuoteRow[];
 setQuotes(list);

 // populate urgency fallback map so sidebar chips are correct
 await loadRequestUrgencies(traderId, list.map((q) => q.request_id || ""));
 }

 async function loadRequest(traderId: string, rqId: string) {
 const id = cleanId(rqId);
 if (!id || !isUuid(id)) return;

 const { data, error } = await supabase
 .from("quote_requests")
 .select("id,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,created_at")
 .eq("id", id)
 .eq("plumber_id", traderId)
 .maybeSingle();

 if (error) {
 setRq(null);
 setMsg(`Could not load enquiry: ${error.message}`);
 return;
 }
 if (!data) {
 setRq(null);
 setMsg("Enquiry not found (or you don’t have access).");
 return;
 }

 setRq(data as QuoteRequestRow);
 }

 async function loadSiteVisit(requestId: string, plumberId: string) {
 const rid = cleanId(requestId);
 if (!rid || !isUuid(rid)) {
 setSiteVisit(null);
 return;
 }

 setSiteVisitLoading(true);
 try {
 const { data, error } = await supabase
 .from("site_visits")
 .select("id, request_id, plumber_id, starts_at, duration_mins, created_at")
 .eq("request_id", rid)
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

 function fillFormFromQuote(q: QuoteRow) {
 setCustomerEmail((q.customer_email || "").trim());
 setVatRate(String(q.vat_rate ?? 20) === "0" ? "0" : "20");
 setSubtotal(q.subtotal != null ? String(q.subtotal) : "");
 setNote(q.note || "");
 setJobDetails(q.job_details || "");
 setEmailSubject("Your estimate");
 setCustomerNote("");
 }

 async function loadAttachments(rqId: string) {
 const id = cleanId(rqId);
 if (!id || !isUuid(id)) return;

 setFileMsg(null);

 setCustFilesLoading(true);
 setCustFiles([]);
 try {
 setCustFiles(await listFilesWithSignedUrls(customerFolder(id)));
 } finally {
 setCustFilesLoading(false);
 }

 setTraderFilesLoading(true);
 setTraderFiles([]);
 try {
 setTraderFiles(await listFilesWithSignedUrls(traderFolder(id)));
 } finally {
 setTraderFilesLoading(false);
 }
 }

 async function ensureDraftQuoteForRequest(requestId: string, traderId: string) {
 const rid = cleanId(requestId);
 if (!rid || !isUuid(rid)) return;

 const key = `${traderId}:${rid}`;
 if (lastAutoCreateRef.current === key) return;
 lastAutoCreateRef.current = key;

 setMsg(null);

 const existing = await supabase.from("quotes").select("id").eq("plumber_id", traderId).eq("request_id", rid).maybeSingle();

 if (existing.data?.id) {
 setSelectedQuoteId(existing.data.id);
 router.replace(`/dashboard/estimates?quoteId=${encodeURIComponent(existing.data.id)}`);
 return;
 }

 const rqRes = await supabase
 .from("quote_requests")
 .select("id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details")
 .eq("id", rid)
 .eq("plumber_id", traderId)
 .maybeSingle();

 if (!rqRes.data) {
 setMsg("Cannot create estimate: enquiry not found (or you don’t have access).");
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
 vat_rate: 20,
 subtotal: 0,
 note: "",
 job_details: "",
 status: "draft",
 })
 .select("id")
 .single();

 if (created.error) {
 setMsg(`Create estimate failed: ${created.error.message}`);
 return;
 }

 setSelectedQuoteId(created.data.id);
 router.replace(`/dashboard/estimates?quoteId=${encodeURIComponent(created.data.id)}`);
 setMsg("Estimate draft created.");
 setTimeout(() => setMsg(null), 1200);

 await loadQuotes(traderId);
 }

 async function saveQuote() {
 if (!uid || !selectedQuote) return;

 setSaving(true);
 setMsg(null);

 const patch = {
 customer_email: (customerEmail || "").trim() || null,
 vat_rate: Number(vatRate),
 subtotal: numOrNull(subtotal),
 note: note?.trim() ? note.trim() : null,
 job_details: jobDetails?.trim() ? jobDetails.trim() : null,
 };

 const { error } = await supabase.from("quotes").update(patch).eq("id", selectedQuote.id).eq("plumber_id", uid);

 if (error) {
 setMsg(`Save failed: ${error.message}`);
 setSaving(false);
 return;
 }

 setMsg("Saved.");
 setTimeout(() => setMsg(null), 900);
 await loadQuotes(uid);
 setSaving(false);
 }

 async function deleteQuote() {
 if (!uid || !selectedQuote) return;
 const ok = confirm("Delete this estimate? This cannot be undone.");
 if (!ok) return;

 const { error } = await supabase.from("quotes").delete().eq("id", selectedQuote.id).eq("plumber_id", uid);
 if (error) {
 setMsg(`Delete failed: ${error.message}`);
 return;
 }

 setSelectedQuoteId(null);
 setRq(null);
 setCustFiles([]);
 setTraderFiles([]);
 setSiteVisit(null);
 router.replace("/dashboard/estimates");
 setMsg("Deleted.");
 setTimeout(() => setMsg(null), 900);
 await loadQuotes(uid);
 }

 async function onUploadTraderFiles(e: React.ChangeEvent<HTMLInputElement>) {
 const files = e.target.files ? Array.from(e.target.files) : [];
 if (!files.length) return;

 if (!effectiveRequestId) {
 setFileMsg("This estimate isn’t linked to an enquiry (no request_id).");
 return;
 }

 setUploading(true);
 setFileMsg(null);

 try {
 const fd = new FormData();
 fd.append("requestId", effectiveRequestId);
 fd.append("kind", "trader");
 files.forEach((f) => fd.append("files", f, safeFileName(f.name)));

 const res = await fetch("/api/quote-requests/upload", { method: "POST", body: fd });
 const json = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error((json as any)?.error || "Upload failed");

 e.target.value = "";
 setFileMsg("Uploaded.");
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

 const res = await fetch("/api/quote-requests/delete", { method: "POST", body: fd });
 const json = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error((json as any)?.error || "Delete failed");

 setFileMsg("Deleted.");
 await loadAttachments(effectiveRequestId);
 } catch (e: any) {
 setFileMsg(e?.message || "Delete failed");
 } finally {
 setUploading(false);
 }
 }

 async function sendEstimateEmail() {
 if (!uid || !selectedQuote) return;

 setSending(true);
 setMsg(null);

 await saveQuote();

 const { data: sessionRes } = await supabase.auth.getSession();
 const token = sessionRes.session?.access_token;

 if (!token) {
 setMsg("You're not logged in. Please log in again.");
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

 setSentBanner(" Estimate sent");
 if (sentTimerRef.current) window.clearTimeout(sentTimerRef.current);
 sentTimerRef.current = window.setTimeout(() => setSentBanner(null), 4000);

 await loadQuotes(uid);
 } catch (e: any) {
 setMsg(e?.message || "Send failed");
 } finally {
 setSending(false);
 }
 }

 // INIT
 useEffect(() => {
 let mounted = true;

 (async () => {
 setLoading(true);
 setMsg(null);

 const { data: auth } = await supabase.auth.getUser();
 const userId = auth.user?.id ?? null;

 if (!mounted) return;
 setUid(userId);

 if (!userId) {
 setLoading(false);
 setMsg("Please log in.");
 return;
 }

 await loadQuotes(userId);
 setLoading(false);
 })();

 return () => {
 mounted = false;
 if (sentTimerRef.current) window.clearTimeout(sentTimerRef.current);
 };
 }, []);

 // Select quote if quoteId in URL
 useEffect(() => {
 const qid = cleanId(quoteIdFromUrl);
 if (!qid) return;
 setSelectedQuoteId(qid);
 }, [quoteIdFromUrl]);

 // Coming from inbox with requestId => create/open draft
 useEffect(() => {
 if (!uid) return;

 const rid = cleanId(requestIdFromUrl);
 if (!rid || !isUuid(rid)) return;

 const key = `${uid}:${rid}`;
 if (initRef.current === key) return;
 initRef.current = key;

 ensureDraftQuoteForRequest(rid, uid);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [uid, requestIdFromUrl]);

 // When selected quote changes
 useEffect(() => {
 if (!uid) return;
 if (!selectedQuote) return;

 fillFormFromQuote(selectedQuote);

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
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [uid, selectedQuote?.id]);

 // Also refresh site visit when effectiveRequestId changes (safer)
 useEffect(() => {
 if (!uid) return;
 if (!effectiveRequestId) {
 setSiteVisit(null);
 return;
 }
 loadSiteVisit(effectiveRequestId, uid);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [uid, effectiveRequestId]);

 // IMPORTANT: urgency filter + sidebar chip uses fallback urgency
 const visibleQuotes = useMemo(() => {
 let list = [...quotes];

 if (postcodeFilter.trim()) {
 const needle = postcodeFilter.trim().toLowerCase();
 list = list.filter((q) => String(q.postcode || "").toLowerCase().includes(needle));
 }

 if (urgencyFilter.trim()) {
 const needle = urgencyFilter.trim().toLowerCase();
 list = list.filter((q) => {
 const fallbackUrgency = q.urgency ?? requestUrgencyById[cleanId(q.request_id)] ?? "";
 return String(fallbackUrgency).toLowerCase().includes(needle);
 });
 }

 return list;
 }, [quotes, postcodeFilter, urgencyFilter, requestUrgencyById]);

 if (loading) return <div className="text-sm text-gray-500">Loading estimates…</div>;

 const selectedIsSent = !!selectedQuote && String(selectedQuote.status || "").toLowerCase().includes("sent");
 const selectedSentAtLabel = selectedQuote?.sent_at ? niceDate(selectedQuote.sent_at) : "";

 const siteVisitChip = (() => {
 if (siteVisitLoading) return <Chip cls="border-gray-300 bg-gray-50 text-gray-700">Site visit: loading…</Chip>;
 if (!siteVisit) return <Chip cls="border-gray-300 bg-gray-50 text-gray-700">Site visit: not booked</Chip>;
 return (
 <Chip cls="border-emerald-200 bg-emerald-50 text-emerald-700">
 Site visit: {niceDateOnly(siteVisit.starts_at)} • {niceTimeOnly(siteVisit.starts_at)}
 </Chip>
 );
 })();

 return (
 <div className="mx-auto max-w-[1100px]">
 <div className="mb-3">
 <h1 className="text-xl font-semibold">Estimates</h1>
 <div className="text-xs text-gray-500">Your estimates (quotes). Click one to edit or send.</div>
 </div>

 {sentBanner && (
 <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
 {sentBanner}
 </div>
 )}

 {msg && (
 <div className="mb-3 border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap">
 {msg}
 </div>
 )}

 <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
 <div className="flex gap-2">
 <input
 value={postcodeFilter}
 onChange={(e) => setPostcodeFilter(e.target.value)}
 className="h-9 w-[240px] rounded-md border px-3 text-sm"
 placeholder="Postcode or area"
 />
 <select
 value={urgencyFilter}
 onChange={(e) => setUrgencyFilter(e.target.value)}
 className="h-9 w-[170px] rounded-md border px-3 text-sm"
 >
 <option value="">All urgency</option>
 <option value="asap">ASAP</option>
 <option value="urgent">Urgent</option>
 <option value="this week">This week</option>
 <option value="next week">Next week</option>
 <option value="flex">Flexible</option>
 </select>
 </div>

 <button onClick={() => router.push("/dashboard/inbox")} className="h-9 rounded-md border px-3 text-sm hover:bg-gray-50">
 Back to enquiries
 </button>
 </div>

 <div className="grid grid-cols-12 gap-3">
 {/* LEFT */}
 <div className="col-span-4 border bg-white">
 <div className="border-b px-3 py-2 text-xs font-semibold">All estimates</div>

 {visibleQuotes.length === 0 ? (
 <div className="px-3 py-4 text-sm text-gray-600">No estimates yet.</div>
 ) : (
 <div>
 {visibleQuotes.map((q) => {
 const active = q.id === selectedQuoteId;

 // SIDEBAR FIX: fallback urgency from enquiry map
 const sidebarUrgency = q.urgency ?? requestUrgencyById[cleanId(q.request_id)] ?? null;
 const urg = urgencyChip(sidebarUrgency);

 const isSent = String(q.status || "").toLowerCase().includes("sent");

 return (
 <button
 key={q.id}
 onClick={() => {
 setSelectedQuoteId(q.id);
 router.replace(`/dashboard/estimates?quoteId=${encodeURIComponent(q.id)}`);
 }}
 className={`w-full border-b px-3 py-3 text-left hover:bg-gray-50 ${active ? "bg-gray-100" : ""}`}
 >
 <div className="flex items-center justify-between">
 <div className="text-sm font-semibold uppercase tracking-wide truncate">
 {q.customer_name ? titleCase(q.customer_name) : "Estimate"}
 </div>
 <div className="text-xs text-gray-500">{niceDate(q.created_at)}</div>
 </div>

 <div className="mt-1 text-xs text-gray-700">
 {(q.postcode || "—").toString()} • {titleCase(q.job_type) || "Job"} •{" "}
 <span className="font-semibold">{money(q.subtotal)}</span>
 </div>

 <div className="mt-2 flex flex-wrap gap-2">
 <Chip cls={urg.cls}>{urg.text}</Chip>
 <Chip cls={isSent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-300 bg-gray-50 text-gray-700"}>
 {sentLabel(q)}
 </Chip>
 </div>
 </button>
 );
 })}
 </div>
 )}
 </div>

 {/* RIGHT */}
 <div className="col-span-8 border bg-white p-4">
 {!selectedQuote ? (
 <div className="text-sm text-gray-600">Select an estimate to view it.</div>
 ) : (
 <div className="space-y-4">
 {/* TOP BAR */}
 <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="text-lg font-semibold">Estimate</div>
 <div className="text-sm text-gray-700 truncate">
 {selectedQuote.customer_name || "—"} • {selectedQuote.customer_email || "—"} • {selectedQuote.postcode || "—"}
 </div>

 <div className="mt-2 flex flex-wrap gap-2">
 <Chip cls={urgencyChip(displayUrgency).cls}>Urgency: {urgencyChip(displayUrgency).text}</Chip>

 <Chip
 cls={selectedIsSent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-300 bg-gray-50 text-gray-700"}
 >
 {selectedIsSent ? (selectedSentAtLabel ? `Sent ${selectedSentAtLabel}` : "Sent") : "Draft"}
 </Chip>

 {siteVisitChip}
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 <button
 type="button"
 onClick={deleteQuote}
 className="h-9 rounded-md border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-gray-200"
 >
 Delete
 </button>
 </div>
 </div>
 </div>

 {/* Customer message */}
 <div className="rounded-xl border px-4 py-3 text-sm">
 <div className="text-sm font-semibold mb-1">Customer message</div>
 <div className="text-xs text-gray-600">
 Postcode: {rq?.postcode || selectedQuote.postcode || "—"} <br />
 Trade: {titleCase(rq?.job_type || selectedQuote.job_type) || "—"}
 </div>
 <div className="mt-2 whitespace-pre-wrap">{rq?.details || "—"}</div>
 <div className="mt-2 text-[11px] text-gray-400">
 Enquiry ID: {cleanId(selectedQuote.request_id) || "—"} • Quote ID: {selectedQuote.id}
 </div>
 </div>

 {/* Attachments */}
 <div className="rounded-xl border px-4 py-3">
 <div className="flex items-center justify-between gap-3">
 <div>
 <div className="text-sm font-semibold">Attachments</div>
 <div className="text-xs text-gray-500">Uploads are only available when this estimate is linked to an enquiry.</div>
 </div>

 <label className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer">
 {uploading ? "Uploading…" : "Upload files"}
 <input type="file" multiple className="hidden" onChange={onUploadTraderFiles} disabled={uploading || !effectiveRequestId} />
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

 {/* MOVED: Site visit AFTER attachments */}
 <div className="rounded-xl border px-4 py-3 flex items-center justify-between">
 <div>
 <div className="text-sm font-semibold">Site visit</div>
 {siteVisitLoading ? (
 <div className="text-xs text-gray-500 mt-1">Loading…</div>
 ) : siteVisit ? (
 <div className="text-xs text-emerald-700 mt-1">
 Booked for <span className="font-semibold">{niceDateOnly(siteVisit.starts_at)}</span> at{" "}
 <span className="font-semibold">{niceTimeOnly(siteVisit.starts_at)}</span> • {siteVisit.duration_mins} mins
 </div>
 ) : (
 <div className="text-xs text-gray-500 mt-1">Not booked yet.</div>
 )}
 </div>

 <button
 type="button"
 onClick={() => {
 if (uid && effectiveRequestId) loadSiteVisit(effectiveRequestId, uid);
 }}
 className="h-9 rounded-md border px-3 text-sm hover:bg-gray-50"
 disabled={!uid || !effectiveRequestId || siteVisitLoading}
 >
 Refresh
 </button>
 </div>

 {/* Create your estimate */}
 <div className="rounded-xl border px-4 py-4">
 <div className="text-sm font-semibold mb-3">Create your estimate</div>

 <div className="grid grid-cols-12 gap-3">
 <div className="col-span-7">
 <div className="text-xs font-medium text-gray-600 mb-1">Customer email</div>
 <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" />
 </div>

 <div className="col-span-5">
 <div className="text-xs font-medium text-gray-600 mb-1">VAT</div>
 <select value={vatRate} onChange={(e) => setVatRate(e.target.value as "0" | "20")} className="h-10 w-full rounded-md border px-3 text-sm">
 <option value="20">20%</option>
 <option value="0">0%</option>
 </select>
 <div className="mt-1 text-[11px] text-gray-400">Pick 20% (VAT registered) or 0%.</div>
 </div>

 <div className="col-span-7">
 <div className="text-xs font-medium text-gray-600 mb-1">Subtotal (before VAT)</div>
 <input
 value={subtotal}
 onChange={(e) => setSubtotal(e.target.value)}
 className="h-10 w-full rounded-md border px-3 text-sm"
 placeholder="e.g. 180"
 inputMode="decimal"
 />
 </div>

 <div className="col-span-5 rounded-xl border bg-gray-50 p-3">
 <div className="text-xs font-semibold text-gray-700 mb-2">Estimate summary</div>
 <div className="text-xs text-gray-700 flex justify-between">
 <span>Subtotal</span>
 <span>{money(summary.s)}</span>
 </div>
 <div className="text-xs text-gray-700 flex justify-between">
 <span>VAT ({vatRate}%)</span>
 <span>{money(summary.vat)}</span>
 </div>
 <div className="mt-2 text-xs font-semibold text-gray-900 flex justify-between">
 <span>Total</span>
 <span>{money(summary.total)}</span>
 </div>
 </div>

 <div className="col-span-12">
 <div className="text-xs font-medium text-gray-600 mb-1">Subject</div>
 <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" />
 </div>

 <div className="col-span-12">
 <div className="text-xs font-medium text-gray-600 mb-1">Message to customer (optional)</div>
 <textarea
 value={customerNote}
 onChange={(e) => setCustomerNote(e.target.value)}
 className="w-full rounded-md border px-3 py-2 text-sm"
 rows={4}
 placeholder="E.g. Thanks for your enquiry — here’s your estimate."
 />
 </div>

 <div className="col-span-12 flex items-center gap-2">
 <button
 type="button"
 onClick={saveQuote}
 disabled={saving}
 className="h-10 rounded-md border border-gray-300 bg-gray-100 px-4 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-60"
 >
 {saving ? "Saving…" : "Save"}
 </button>

 <button
 type="button"
 onClick={sendEstimateEmail}
 disabled={sending}
 className="h-10 rounded-md border border-gray-300 bg-gray-100 px-4 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-60"
 >
 {sending ? "Sending…" : "Send estimate"}
 </button>

 <button
 type="button"
 onClick={() => {
 setSubtotal("");
 setVatRate("20");
 setNote("");
 setJobDetails("");
 setEmailSubject("Your estimate");
 setCustomerNote("");
 }}
 className="h-10 rounded-md border border-gray-300 bg-gray-100 px-4 text-sm font-medium text-gray-900 hover:bg-gray-200"
 >
 Clear
 </button>
 </div>

 <div className="col-span-12 text-[11px] text-gray-400">Sends from this page with trader branding (business name + logo).</div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}