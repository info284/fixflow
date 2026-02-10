"use client";

import React, { useEffect, useMemo, useState } from "react";

type Trader = {
 id?: string;
 slug?: string;
 display_name?: string;
 business_name?: string;
 headline?: string;
 logo_url?: string;
 accent?: string;
 notify_email?: string;
};

type AddressLookupResponse = {
 addresses?: string[];
 error?: string;
 debug?: any;
};

type TraderBySlugResponse =
 | Trader
 | { trader: Trader; error?: string }
 | { error: string };

export default function QuoteClient({ slug }: { slug: string }) {
 const [trader, setTrader] = useState<Trader | null>(null);
 const [traderError, setTraderError] = useState<string | null>(null);
 const [loadingTrader, setLoadingTrader] = useState(true);

 // Submit state
 const [submitted, setSubmitted] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [submitError, setSubmitError] = useState<string | null>(null);

 // Customer details
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [phone, setPhone] = useState("");

 // Location / address lookup
 const [postcode, setPostcode] = useState("");
 const [addressList, setAddressList] = useState<string[]>([]);
 const [selectedAddress, setSelectedAddress] = useState("");
 const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
 const [lookupMsg, setLookupMsg] = useState<string>("");

 // Job info
 const [jobType, setJobType] = useState("");
 const [urgency, setUrgency] = useState("");
 const [details, setDetails] = useState("");

 // Attachments (optional)
 const [files, setFiles] = useState<FileList | null>(null);

 // 1) Fetch trader by slug (for logo + name header)
 useEffect(() => {
 if (!slug) return;

 let cancelled = false;

 async function run() {
 setLoadingTrader(true);
 setTraderError(null);

 try {
 const res = await fetch(`/api/trades/by-slug?slug=${encodeURIComponent(slug)}`, {
 cache: "no-store",
 });

 const json: TraderBySlugResponse = await res.json();

 if (!res.ok) {
 const msg = (json as any)?.error || "Something went wrong loading this trader.";
 throw new Error(msg);
 }

 const t: Trader | undefined = (json as any)?.trader ?? (json as any);
 if (!t?.slug) throw new Error("Trader not found.");

 if (!cancelled) setTrader(t);
 } catch (e: any) {
 if (!cancelled) {
 setTrader(null);
 setTraderError(e?.message || "Trader not found.");
 }
 } finally {
 if (!cancelled) setLoadingTrader(false);
 }
 }

 run();
 return () => {
 cancelled = true;
 };
 }, [slug]);

 const canLookup = useMemo(() => postcode.trim().length >= 5, [postcode]);

 const detailsComplete = useMemo(() => Boolean(name.trim() && email.trim()), [name, email]);
 const locationComplete = useMemo(
 () => Boolean(postcode.trim() && selectedAddress.trim()),
 [postcode, selectedAddress]
 );
 const formUnlocked = useMemo(() => Boolean(detailsComplete && locationComplete), [detailsComplete, locationComplete]);

 async function findAddresses() {
 setLookupStatus("loading");
 setLookupMsg("");
 setAddressList([]);
 setSelectedAddress("");

 const pc = postcode.trim().toUpperCase().replace(/\s+/g, " ");
 if (!pc) return;

 try {
 const res = await fetch(`/api/address?postcode=${encodeURIComponent(pc)}`, { cache: "no-store" });
 const json: AddressLookupResponse = await res.json();

 if (!res.ok || json.error) {
 setLookupStatus("error");
 setLookupMsg(json.error || "Address lookup failed");
 return;
 }

 const addresses = Array.isArray(json.addresses) ? json.addresses : [];
 if (!addresses.length) {
 setLookupStatus("error");
 setLookupMsg("No addresses found for that postcode.");
 return;
 }

 setAddressList(addresses);
 setLookupStatus("success");
 setLookupMsg(`${addresses.length} addresses found`);
 } catch (e: any) {
 setLookupStatus("error");
 setLookupMsg(e?.message || "Address lookup failed");
 }
 }

 async function uploadCustomerFiles(requestId: string, fileList: FileList | null) {
 if (!fileList || fileList.length === 0) return;

 const fd = new FormData();
 fd.append("requestId", requestId);
 fd.append("kind", "customer");

 // IMPORTANT: field name must be "files"
 Array.from(fileList).forEach((f) => fd.append("files", f));

 const res = await fetch("/api/quote-requests/upload", {
 method: "POST",
 body: fd,
 });

 const json = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(json?.error || "Upload failed");
 }

 async function submitRequest() {
 if (submitting) return;

 setSubmitting(true);
 setSubmitError(null);
 setSubmitted(false);

 try {
 // 1) Create the request (THIS must match your route)
 const res = await fetch("/api/quote-requests", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 slug,
 name: name.trim(),
 email: email.trim(),
 phone: phone.trim() || null,
 postcode: postcode.trim(),
 address: selectedAddress.trim(),
 job_type: jobType,
 urgency,
 details: details.trim(),
 }),
 });

 const json = await res.json().catch(() => ({}));

 if (!res.ok) {
 throw new Error(json?.error || "Insert failed");
 }

 // Accept either {request:{id}} OR {id}
 const requestId: string | undefined = json?.request?.id || json?.id;
 if (!requestId) {
 throw new Error("Request created but no requestId returned");
 }

 // 2) Upload files (optional) — DO NOT FAIL THE WHOLE REQUEST
 try {
 await uploadCustomerFiles(requestId, files);
 } catch (uploadErr: any) {
 setSubmitError(uploadErr?.message || "Upload failed");
 }

 setSubmitted(true);
 window.scrollTo({ top: 0, behavior: "smooth" });
 } catch (e: any) {
 setSubmitError(e?.message || "Insert failed");
 window.scrollTo({ top: 0, behavior: "smooth" });
 } finally {
 setSubmitting(false);
 }
 }

 const traderName = trader?.display_name || trader?.business_name || trader?.slug || slug;
 const subtitle = trader?.headline || "Request an estimate";

 const submitEnabled = formUnlocked && jobType && urgency && details.trim() && !submitting;

 return (
 <main className="min-h-screen bg-slate-50">
 <div className="mx-auto max-w-3xl px-4 py-10">
 {/* Header (matches your old layout) */}
 <div className="flex items-start gap-5">
  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-200 flex items-center justify-center font-semibold text-slate-700">
    {trader?.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={trader.logo_url} alt="Logo" className="h-full w-full object-contain" />
    ) : (
      (traderName?.[0] || "T").toUpperCase()
    )}
  </div>

  <div className="flex-1 pt-1">
    <h1 className="text-2xl font-semibold text-slate-900">{traderName}</h1>
    <p className="text-slate-600">{subtitle}</p>
  </div>
</div>
 {/* Top helper text */}
 <p className="mt-3 text-sm text-slate-600">
 Your details are sent directly to the trader.
 </p>

 {/* Success / Errors */}
 {submitted && (
 <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-800">
 <p className="font-medium">Request received.</p>
 <p className="text-sm text-slate-600">
 Your details have been sent directly to the trader. They’ll be in touch shortly.
 </p>
 </div>
 )}

 {submitError && (
 <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
 {submitError}
 </div>
 )}

 {/* Trader loading/error */}
 <div className="mt-5">
 {loadingTrader ? (
 <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-600">
 Loading trader…
 </div>
 ) : traderError ? (
 <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
 {traderError}
 </div>
 ) : null}
 </div>

 {/* Your details */}
 <section className="mt-6">
 <h2 className="mb-3 text-lg font-semibold text-slate-900">Your details</h2>

 <div className="rounded-xl border border-slate-200 bg-white p-4">
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
 <input
 className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
 placeholder="Your name"
 value={name}
 onChange={(e) => setName(e.target.value)}
 autoComplete="name"
 />
 </div>

 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
 <input
 className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
 placeholder="you@email.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 autoComplete="email"
 />
 </div>

 <div className="sm:col-span-2">
 <label className="mb-1 block text-sm font-medium text-slate-700">
 Phone <span className="text-slate-400">(optional)</span>
 </label>
 <input
 className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
 placeholder="07..."
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 autoComplete="tel"
 />
 </div>
 </div>
 </div>
 </section>

 {/* Location */}
 <section className="mt-6">
 <h2 className="mb-3 text-lg font-semibold text-slate-900">Location</h2>

 <div className="rounded-xl border border-slate-200 bg-white p-4">
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">Postcode</label>
 <input
 className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-slate-200"
 placeholder="RH17 6TL"
 value={postcode}
 onChange={(e) => setPostcode(e.target.value)}
 />

 {lookupStatus === "error" ? (
 <p className="mt-2 text-sm text-red-600">{lookupMsg || "Address lookup failed"}</p>
 ) : lookupStatus === "success" ? (
 <p className="mt-2 text-sm text-emerald-700">{lookupMsg}</p>
 ) : lookupStatus === "loading" ? (
 <p className="mt-2 text-sm text-slate-600">Finding addresses…</p>
 ) : (
 <p className="mt-2 text-sm text-slate-500">Enter your postcode, then click “Find address”.</p>
 )}
 </div>

 <div className="sm:pt-6">
 <button
 type="button"
 onClick={findAddresses}
 disabled={!canLookup || lookupStatus === "loading"}
 className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
 >
 Find address
 </button>
 </div>
 </div>

 <div className="mt-4">
 <label className="mb-1 block text-sm font-medium text-slate-700">Select address</label>
 <select
 className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
 value={selectedAddress}
 onChange={(e) => setSelectedAddress(e.target.value)}
 disabled={addressList.length === 0}
 >
 <option value="">{addressList.length ? "Select your address…" : "Find addresses first…"}</option>
 {addressList.map((a, i) => (
 <option key={`${a}-${i}`} value={a}>
 {a}
 </option>
 ))}
 </select>

 <p className="mt-2 text-sm text-slate-500">Pick your address to unlock the rest of the form.</p>
 </div>
 </div>
 </section>

 {/* About the job */}
 <section className="mt-6">
 <h2 className="mb-3 text-lg font-semibold text-slate-900">About the job</h2>

 <div className="rounded-xl border border-slate-200 bg-white p-4">
 <div className="grid grid-cols-1 gap-4">
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">Job type</label>
 <select
 className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
 value={jobType}
 onChange={(e) => setJobType(e.target.value)}
 disabled={!formUnlocked}
 >
 <option value="">Select…</option>
 <option value="bathroom">Bathroom</option>
 <option value="kitchen">Kitchen</option>
 <option value="leak">Leak</option>
 <option value="boiler">Boiler</option>
 <option value="drain">Drain / Blockage</option>
 <option value="other">Other</option>
 </select>
 </div>

 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">When do you need it?</label>
 <select
 className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
 value={urgency}
 onChange={(e) => setUrgency(e.target.value)}
 disabled={!formUnlocked}
 >
 <option value="">Select…</option>
 <option value="asap">As soon as possible</option>
 <option value="this-week">This week</option>
 <option value="next-week">Next week</option>
 <option value="flexible">Flexible</option>
 </select>
 </div>

 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">Details</label>
 <textarea
 className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
 placeholder="Describe the job…"
 value={details}
 onChange={(e) => setDetails(e.target.value)}
 disabled={!formUnlocked}
 />
 </div>
 </div>
 </div>
 </section>

 {/* Photos */}
 <section className="mt-6">
 <h2 className="mb-3 text-lg font-semibold text-slate-900">Photos (optional)</h2>

 <div className="rounded-xl border border-slate-200 bg-white p-4">
 <p className="text-sm text-slate-600">Photos help the trader give a more accurate estimate.</p>

 <div className="mt-3">
 <input
 type="file"
 multiple
 onChange={(e) => setFiles(e.target.files)}
 disabled={!formUnlocked}
 className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-slate-800 hover:file:bg-slate-50 disabled:opacity-50"
 />
 {files?.length ? <p className="mt-2 text-sm text-slate-600">{files.length} file(s) selected</p> : null}
 </div>
 </div>
 </section>

 {/* Submit */}
 <div className="mt-8 flex justify-center pb-10">
 <button
 type="button"
 onClick={submitRequest}
 disabled={!submitEnabled}
 className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {submitting ? "Sending…" : "Send request"}
 </button>
 </div>
 </div>
 </main>
 );
}