"use client";

import { useState } from "react";

type CoverageStatus = "idle" | "checking" | "yes" | "no";

export default function QuoteForm({ tradeId }: { tradeId: string }) {
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [postcode, setPostcode] = useState("");
 const [phone, setPhone] = useState("");
 const [when, setWhen] = useState("");
 const [details, setDetails] = useState("");

 const [coverageStatus, setCoverageStatus] = useState<CoverageStatus>("idle");

 const [files, setFiles] = useState<File[]>([]);
 const [submitStatus, setSubmitStatus] =
 useState<"idle" | "saving" | "saved" | "error">("idle");
 const [submitError, setSubmitError] = useState("");

 const canContinue = coverageStatus === "yes";

 async function checkCoverage() {
 const pc = postcode.trim();
 if (!pc) {
 setCoverageStatus("idle");
 return;
 }

 setCoverageStatus("checking");
 try {
 const res = await fetch(
 `/api/marketplace/search?tradeId=${encodeURIComponent(tradeId)}&postcode=${encodeURIComponent(pc)}`
 );
 const json = (await res.json()) as { covered?: boolean };
 setCoverageStatus(json.covered ? "yes" : "no");
 } catch {
 setCoverageStatus("no");
 }
 }

 async function submitEnquiry() {
 setSubmitStatus("saving");
 setSubmitError("");

 try {
 // NOTE: This submits form data WITHOUT actually uploading the files yet.
 // It still restores the "Upload attachments" UI (what you asked for).
 // If you want, next we’ll wire storage upload properly.
 const res = await fetch("/api/marketplace", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 tradeId,
 name,
 email,
 postcode,
 phone,
 when,
 details,
 // placeholder: just filenames for now so you can see the data flow
 attachment_names: files.map((f) => f.name),
 }),
 });

 const json = await res.json().catch(() => ({} as any));

 if (!res.ok) {
 setSubmitStatus("error");
 setSubmitError(json?.error || "Something went wrong.");
 return;
 }

 setSubmitStatus("saved");
 } catch {
 setSubmitStatus("error");
 setSubmitError("Network error. Please try again.");
 }
 }

 const submitDisabled =
 !canContinue ||
 !name.trim() ||
 !email.trim() ||
 submitStatus === "saving";

 return (
 <div className="space-y-4">
 {/* NAME */}
 <div className="space-y-1">
 <label className="text-sm font-medium">Name</label>
 <input
 className="w-full rounded-md border px-3 py-2"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Your name"
 />
 </div>

 {/* EMAIL */}
 <div className="space-y-1">
 <label className="text-sm font-medium">Email</label>
 <input
 type="email"
 className="w-full rounded-md border px-3 py-2"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="you@example.com"
 />
 </div>

 {/* POSTCODE + */}
 <div className="space-y-1">
 <label className="text-sm font-medium">Postcode</label>
 <input
 className="w-full rounded-md border px-3 py-2"
 value={postcode}
 onChange={(e) => {
 setPostcode(e.target.value);
 setCoverageStatus("idle");
 }}
 onBlur={checkCoverage}
 placeholder="e.g. RH16 1AA"
 />

 {coverageStatus === "checking" && <p className="text-sm">Checking…</p>}
 {coverageStatus === "yes" && (
 <p className="text-sm"> The trader works in this postcode</p>
 )}
 {coverageStatus === "no" && postcode.trim() && (
 <p className="text-sm"> This trader doesn’t cover this area</p>
 )}
 </div>

 {/* PHONE (locked) */}
 <div className="space-y-1">
 <label className="text-sm font-medium">Phone number</label>
 <input
 className="w-full rounded-md border px-3 py-2"
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 placeholder="07..."
 disabled={!canContinue}
 />
 </div>

 {/* WHEN (locked) */}
 <div className="space-y-1">
 <label className="text-sm font-medium">When do you need the job doing?</label>
 <select
 className="w-full rounded-md border px-3 py-2"
 value={when}
 onChange={(e) => setWhen(e.target.value)}
 disabled={!canContinue}
 >
 <option value="">Select…</option>
 <option value="asap">ASAP</option>
 <option value="this_week">This week</option>
 <option value="next_week">Next week</option>
 <option value="flexible">Flexible</option>
 </select>
 </div>

 {/* DETAILS */}
 <div className="space-y-1">
 <label className="text-sm font-medium">Job details</label>
 <textarea
 className="w-full rounded-md border px-3 py-2"
 value={details}
 onChange={(e) => setDetails(e.target.value)}
 placeholder="Describe the job..."
 rows={4}
 disabled={!canContinue}
 />
 </div>

 {/* UPLOAD ATTACHMENTS */}
 <div className="space-y-1">
 <label className="text-sm font-medium">Upload attachments (optional)</label>
 <input
 type="file"
 multiple
 accept="image/*"
 disabled={!canContinue}
 onChange={(e) => {
 const list = Array.from(e.target.files ?? []);
 setFiles(list);
 }}
 />
 {files.length > 0 && (
 <ul className="text-sm opacity-80 list-disc pl-5">
 {files.map((f) => (
 <li key={f.name}>{f.name}</li>
 ))}
 </ul>
 )}
 </div>

 {/* SUBMIT */}
 <button
 className="w-full rounded-md border px-3 py-2 disabled:opacity-50"
 disabled={submitDisabled}
 onClick={submitEnquiry}
 >
 {submitStatus === "saving" ? "Sending…" : "Continue"}
 </button>

 {submitStatus === "saved" && (
 <p className="text-sm"> Sent! The trader will contact you soon.</p>
 )}
 {submitStatus === "error" && (
 <p className="text-sm"> {submitError || "Something went wrong."}</p>
 )}
 </div>
 );
}