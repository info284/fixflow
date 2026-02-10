"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
 created_at: string | null;
};

type FileItem = {
 name: string;
 fullPath: string;
 url: string | null;
};

const BUCKET = "quote-files";

// Customer uploads live here:
const customerFolder = (requestId: string) => `request/${requestId}/customer`;

// Trader uploads live here (match your inbox upload/delete API routes):
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;

function titleCase(s?: string | null) {
 return (s || "")
 .toLowerCase()
 .split(" ")
 .filter(Boolean)
 .map((w) => w[0]?.toUpperCase() + w.slice(1))
 .join(" ");
}

/**
 * Urgency colours:
 * - ASAP/Urgent => red
 * - This week => amber
 * - Next week + Flexible => green
 */
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

function safeFileName(name: string) {
 return (name || "file")
 .replaceAll(" ", "-")
 .replace(/[^a-zA-Z0-9.\-_]/g, "")
 .slice(0, 120);
}

/**
 * Lists files in a folder and generates SIGNED URLs (works even if bucket isn't public)
 */
async function listFilesWithSignedUrls(folder: string): Promise<FileItem[]> {
 const bucket = supabase.storage.from(BUCKET);

 const { data, error } = await bucket.list(folder, { limit: 100 });
 if (error || !data) return [];

 const files = data.filter((f) => f.name && f.name !== ".emptyFolderPlaceholder");

 const out: FileItem[] = [];
 for (const f of files) {
 const fullPath = `${folder}/${f.name}`;
 const { data: signed, error: signErr } = await bucket.createSignedUrl(fullPath, 60 * 10);
 out.push({
 name: f.name,
 fullPath,
 url: signErr ? null : signed?.signedUrl ?? null,
 });
 }

 return out;
}

export default function NewEstimatePage() {
 const router = useRouter();
 const sp = useSearchParams();

 // Accept either enquiryId or requestId (your inbox sends requestId)
 const requestId = sp.get("enquiryId") || sp.get("requestId") || "";

 const [loading, setLoading] = useState(true);
 const [err, setErr] = useState<string | null>(null);
 const [msg, setMsg] = useState<string | null>(null);

 const [row, setRow] = useState<QuoteRequestRow | null>(null);

 const [custFilesLoading, setCustFilesLoading] = useState(false);
 const [custFiles, setCustFiles] = useState<FileItem[]>([]);

 const [traderFilesLoading, setTraderFilesLoading] = useState(false);
 const [traderFiles, setTraderFiles] = useState<FileItem[]>([]);

 const [picked, setPicked] = useState<FileList | null>(null);
 const [uploading, setUploading] = useState(false);
 const [fileMsg, setFileMsg] = useState<string | null>(null);

 // Estimate form (simple starter like your screenshot)
 const [customerEmail, setCustomerEmail] = useState("");
 const [vatRate, setVatRate] = useState<number>(20);
 const [subtotal, setSubtotal] = useState<string>("");
 const [note, setNote] = useState("");
 const [jobDetails, setJobDetails] = useState("");

 const numericSubtotal = useMemo(() => {
 const n = Number(String(subtotal || "").replace(/[^0-9.]/g, ""));
 return Number.isFinite(n) ? n : 0;
 }, [subtotal]);

 const vatAmount = useMemo(() => (numericSubtotal * (Number(vatRate) || 0)) / 100, [numericSubtotal, vatRate]);
 const total = useMemo(() => numericSubtotal + vatAmount, [numericSubtotal, vatAmount]);

 const title = useMemo(() => titleCase(row?.job_type) || "Estimate", [row]);
 const urg = useMemo(() => urgencyChip(row?.urgency), [row]);

 // Load enquiry + attachments (FROM quote_requests)
 useEffect(() => {
 let cancelled = false;

 async function run() {
 setLoading(true);
 setErr(null);
 setMsg(null);
 setRow(null);
 setCustFiles([]);
 setTraderFiles([]);
 setFileMsg(null);

 if (!requestId) {
 setErr("Missing requestId in the URL.");
 setLoading(false);
 return;
 }

 const { data: auth } = await supabase.auth.getUser();
 const user = auth?.user;

 if (!user) {
 setErr("Not signed in.");
 setLoading(false);
 return;
 }

 const { data, error } = await supabase
 .from("quote_requests")
 .select(
 "id,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,created_at"
 )
 .eq("id", requestId)
 .eq("plumber_id", user.id)
 .maybeSingle();

 if (error) {
 if (!cancelled) setErr(error.message);
 setLoading(false);
 return;
 }

 if (!data) {
 if (!cancelled) setErr("Enquiry not found (or you don’t have access).");
 setLoading(false);
 return;
 }

 if (cancelled) return;

 const r = data as QuoteRequestRow;
 setRow(r);

 // Prefill form
 setCustomerEmail((r.customer_email || "").trim());
 setJobDetails(r.details || "");

 // Load customer files
 setCustFilesLoading(true);
 const c = await listFilesWithSignedUrls(customerFolder(requestId));
 if (!cancelled) setCustFiles(c);
 setCustFilesLoading(false);

 // Load trader files
 setTraderFilesLoading(true);
 const t = await listFilesWithSignedUrls(traderFolder(requestId));
 if (!cancelled) setTraderFiles(t);
 setTraderFilesLoading(false);

 setLoading(false);
 }

 run();
 return () => {
 cancelled = true;
 };
 }, [requestId]);

 async function onUploadTraderFiles() {
 setFileMsg(null);
 setMsg(null);
 setErr(null);

 if (!picked || picked.length === 0) {
 setFileMsg("Choose file(s) first.");
 return;
 }
 if (!row?.id) {
 setFileMsg("Enquiry not loaded.");
 return;
 }

 setUploading(true);

 try {
 const fd = new FormData();
 fd.append("requestId", row.id);
 fd.append("kind", "trader");
 Array.from(picked).forEach((f) => fd.append("files", f, safeFileName(f.name)));

 // Your existing API route
 const res = await fetch("/api/quote-requests/upload", {
 method: "POST",
 body: fd,
 });

 const json = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(json?.error || "Upload failed");

 setFileMsg("Uploaded ");
 setPicked(null);

 // refresh list
 setTraderFilesLoading(true);
 const t = await listFilesWithSignedUrls(traderFolder(row.id));
 setTraderFiles(t);
 setTraderFilesLoading(false);
 } catch (e: any) {
 setFileMsg(e?.message || "Upload failed");
 } finally {
 setUploading(false);
 }
 }

 // Optional: delete trader file via your API route
 async function deleteTraderFile(filePath: string) {
 if (!row?.id) return;
 const ok = confirm("Delete this attachment?");
 if (!ok) return;

 setUploading(true);
 setFileMsg(null);

 try {
 const fd = new FormData();
 fd.append("requestId", row.id);
 fd.append("kind", "trader");
 fd.append("path", filePath);

 const res = await fetch("/api/quote-requests/delete", {
 method: "POST",
 body: fd,
 });

 const json = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(json?.error || "Delete failed");

 setFileMsg("Deleted ");

 setTraderFilesLoading(true);
 const t = await listFilesWithSignedUrls(traderFolder(row.id));
 setTraderFiles(t);
 setTraderFilesLoading(false);
 } catch (e: any) {
 setFileMsg(e?.message || "Delete failed");
 } finally {
 setUploading(false);
 }
 }

 // Placeholder: wire this to your Resend route later if you want
 async function sendEstimateEmail() {
 setMsg(null);
 setErr(null);

 if (!row?.id) return setErr("Enquiry not loaded.");
 if (!customerEmail.trim()) return setErr("Customer email is missing.");
 if (numericSubtotal <= 0) return setErr("Subtotal must be greater than 0.");

 // You can hook this into /api/estimates/send-email later.
 setMsg("Estimate ready (email send not wired on this page yet)");
 }

 if (loading) {
 return <div className="text-sm text-gray-500">Loading estimate…</div>;
 }

 return (
 <div className="min-h-screen bg-slate-50">
 <div className="mx-auto max-w-[980px] px-4 py-8">
 {/* Top bar like your “other image” */}
 <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <h1 className="text-2xl font-semibold text-slate-900">Estimate</h1>
 <p className="mt-1 text-sm text-slate-600 truncate">
 {row?.customer_name || "Customer"}
 {row?.customer_email ? <span> · {row.customer_email}</span> : null}
 </p>

 <div className="mt-3 flex flex-wrap gap-2">
 <Chip cls={urg.cls}>Urgency: {urg.text}</Chip>
 <Chip cls="border-gray-300 bg-gray-50 text-gray-700">Site visit: not booked</Chip>
 </div>
 </div>

 <button
 type="button"
 onClick={() => router.push("/dashboard/estimates")}
 className="h-9 rounded-md border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-gray-200"
 >
 Back to estimates
 </button>
 </div>

 {(err || msg || fileMsg) && (
 <div className="mt-4 space-y-2">
 {err ? (
 <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
 ) : null}
 {fileMsg ? (
 <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
 {fileMsg}
 </div>
 ) : null}
 {msg ? (
 <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
 {msg}
 </div>
 ) : null}
 </div>
 )}
 </div>

 {/* Two-column layout like your screenshot */}
 <div className="mt-6 grid grid-cols-12 gap-4">
 {/* LEFT: enquiry details + attachments */}
 <div className="col-span-12 md:col-span-6 space-y-4">
 {/* Customer message */}
 <div className="rounded-xl border border-slate-200 bg-white p-4">
 <div className="text-sm font-semibold text-slate-900">Customer message</div>
 <div className="mt-2 text-sm text-slate-700">
 <div>
 <span className="font-medium">Postcode:</span> {row?.postcode || "—"}
 </div>
 <div>
 <span className="font-medium">Trade:</span> {titleCase(row?.job_type) || "—"}
 </div>
 <div className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3">
 {row?.details || "—"}
 </div>
 </div>
 </div>

 {/* Your attachments */}
 <div className="rounded-xl border border-slate-200 bg-white p-4">
 <div className="flex items-start justify-between gap-3">
 <div>
 <div className="text-sm font-semibold text-slate-900">Your attachments</div>
 <div className="text-xs text-slate-500">
 Upload anything you want to send with the estimate (photos, PDFs, parts list, etc.)
 </div>
 </div>

 <label className="cursor-pointer rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200">
 Choose files
 <input
 type="file"
 multiple
 className="hidden"
 onChange={(e) => setPicked(e.target.files)}
 disabled={uploading}
 />
 </label>
 </div>

 <div className="mt-3 flex items-center gap-2">
 <button
 type="button"
 onClick={onUploadTraderFiles}
 disabled={uploading || !picked || picked.length === 0}
 className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
 >
 {uploading ? "Uploading…" : "Upload"}
 </button>

 <div className="text-xs text-slate-600">
 {picked?.length ? `${picked.length} file(s) selected` : "No files selected"}
 </div>
 </div>

 {/* Trader files list */}
 <div className="mt-3">
 {traderFilesLoading ? (
 <p className="text-sm text-slate-600">Loading…</p>
 ) : traderFiles.length === 0 ? (
 <p className="text-sm text-slate-600">No attachments added yet.</p>
 ) : (
 <div className="space-y-2">
 {traderFiles.map((f) => (
 <div
 key={f.fullPath}
 className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
 >
 <div className="min-w-0">
 <p className="truncate text-sm text-slate-900">{f.name}</p>
 </div>

 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => f.url && window.open(f.url, "_blank", "noopener,noreferrer")}
 disabled={!f.url}
 className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
 >
 View
 </button>

 <button
 type="button"
 onClick={() => deleteTraderFile(f.fullPath)}
 disabled={uploading}
 className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
 >
 Delete
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Customer attachments (shown below like your screenshot flow) */}
 <div className="mt-4 text-sm font-semibold text-slate-900">Customer attachments</div>
 {custFilesLoading ? (
 <p className="mt-2 text-sm text-slate-600">Loading…</p>
 ) : custFiles.length === 0 ? (
 <p className="mt-2 text-sm text-slate-600">No attachments found.</p>
 ) : (
 <div className="mt-2 space-y-2">
 {custFiles.map((f) => (
 <div
 key={f.fullPath}
 className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
 >
 <div className="min-w-0">
 <p className="truncate text-sm text-slate-900">{f.name}</p>
 </div>
 <button
 type="button"
 onClick={() => f.url && window.open(f.url, "_blank", "noopener,noreferrer")}
 disabled={!f.url}
 className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
 >
 View
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {/* RIGHT: estimate form + summary */}
 <div className="col-span-12 md:col-span-6">
 <div className="rounded-xl border border-slate-200 bg-white p-4">
 <div className="text-sm font-semibold text-slate-900">Create your estimate</div>

 <div className="mt-4 grid grid-cols-12 gap-3">
 <div className="col-span-12 md:col-span-7">
 <div className="text-xs font-medium text-gray-600 mb-1">Customer email</div>
 <input
 value={customerEmail}
 onChange={(e) => setCustomerEmail(e.target.value)}
 className="h-10 w-full rounded-md border px-3 text-sm"
 placeholder="customer@email.com"
 />
 </div>

 <div className="col-span-12 md:col-span-5">
 <div className="text-xs font-medium text-gray-600 mb-1">VAT rate (%)</div>
 <input
 value={String(vatRate)}
 onChange={(e) => setVatRate(Number(e.target.value || 0))}
 className="h-10 w-full rounded-md border px-3 text-sm"
 inputMode="decimal"
 placeholder="20"
 />
 <div className="mt-1 text-[11px] text-gray-400">Use 0 if you’re not VAT registered.</div>
 </div>

 <div className="col-span-12 md:col-span-7">
 <div className="text-xs font-medium text-gray-600 mb-1">Subtotal (before VAT)</div>
 <input
 value={subtotal}
 onChange={(e) => setSubtotal(e.target.value)}
 className="h-10 w-full rounded-md border px-3 text-sm"
 placeholder="e.g. 180"
 inputMode="decimal"
 />
 </div>

 <div className="col-span-12 md:col-span-5">
 <div className="text-xs font-medium text-gray-600 mb-1">Estimate summary</div>
 <div className="rounded-md border bg-slate-50 p-3 text-sm">
 <div className="flex justify-between">
 <span className="text-slate-700">Subtotal</span>
 <span className="font-medium">£{numericSubtotal.toFixed(2)}</span>
 </div>
 <div className="flex justify-between mt-1">
 <span className="text-slate-700">VAT ({Number(vatRate) || 0}%)</span>
 <span className="font-medium">£{vatAmount.toFixed(2)}</span>
 </div>
 <div className="flex justify-between mt-2 border-t pt-2">
 <span className="text-slate-900 font-semibold">Total</span>
 <span className="text-slate-900 font-semibold">£{total.toFixed(2)}</span>
 </div>
 </div>
 </div>

 <div className="col-span-12">
 <div className="text-xs font-medium text-gray-600 mb-1">Note (optional)</div>
 <input
 value={note}
 onChange={(e) => setNote(e.target.value)}
 className="h-10 w-full rounded-md border px-3 text-sm"
 placeholder="e.g. Includes parts + labour"
 />
 </div>

 <div className="col-span-12">
 <div className="text-xs font-medium text-gray-600 mb-1">Job details (what you'll do)</div>
 <textarea
 value={jobDetails}
 onChange={(e) => setJobDetails(e.target.value)}
 className="w-full rounded-md border px-3 py-2 text-sm"
 rows={7}
 placeholder={`Example:
• Diagnose leak under sink
• Replace trap + seals
• Test for leaks + clean up`}
 />
 </div>

 <div className="col-span-12 flex items-center gap-2 pt-2">
 <button
 type="button"
 onClick={sendEstimateEmail}
 className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-60"
 disabled={!customerEmail.trim()}
 >
 Send estimate email
 </button>

 <button
 type="button"
 onClick={() => {
 setSubtotal("");
 setVatRate(20);
 setNote("");
 setJobDetails(row?.details || "");
 setMsg(null);
 setErr(null);
 }}
 className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
 >
 Clear
 </button>
 </div>

 <div className="col-span-12">
 <p className="text-[11px] text-gray-400">
 Email includes your business name/logo + your attachments above (when wired to your email route).
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* little debug footer (optional) */}
 {row?.id ? (
 <p className="mt-6 text-xs text-slate-400">
 requestId: {row.id} · storage: {BUCKET} · trader folder: {traderFolder(row.id)}
 </p>
 ) : null}
 </div>
 </div>
 );
}