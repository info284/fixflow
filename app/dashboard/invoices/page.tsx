"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

type RequestRow = {
id: string;
user_id: string;
name: string | null;
email: string | null;
phone: string | null;
postcode: string | null;
service_id: string | null;
created_at?: string;
};

type InvoiceRow = {
id: string;
user_id: string;
request_id: string;
invoice_number: string | null;
amount: number;
currency: string;
status: string;
issued_at: string | null;
due_at: string | null;
notes: string | null;
created_at: string;
updated_at: string;
to_email: string | null;
};

function isValidEmail(email: string) {
// simple + reliable enough for UI validation
return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function money(amount: number, currency: string) {
if (currency === "GBP") return `£${Number(amount || 0).toFixed(2)}`;
return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

export default function InvoicesPage() {
const [userId, setUserId] = useState<string | null>(null);

const [requests, setRequests] = useState<RequestRow[]>([]);
const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

const [loading, setLoading] = useState(true);
const [busy, setBusy] = useState(false);
const [msg, setMsg] = useState<string | null>(null);

// create form
const [requestId, setRequestId] = useState("");
const [toEmail, setToEmail] = useState("");
const [amount, setAmount] = useState<string>("0");
const [status, setStatus] = useState<string>("draft");
const [notes, setNotes] = useState<string>("");

// list filter
const [q, setQ] = useState("");

const selectedRequest = useMemo(() => {
return requests.find((r) => r.id === requestId) || null;
}, [requests, requestId]);

useEffect(() => {
// auto-fill toEmail when request changes
if (!selectedRequest) return;
const email = (selectedRequest.email || "").trim();
setToEmail(email);
}, [selectedRequest]);

async function loadAll() {
setLoading(true);
setMsg(null);

const {
data: { user },
error: userErr,
} = await supabase.auth.getUser();

if (userErr || !user) {
setMsg("You must be logged in to view invoices.");
setLoading(false);
return;
}

setUserId(user.id);

// Load recent requests (to pick from)
const { data: reqs, error: reqErr } = await supabase
.from("requests")
.select("id, user_id, name, email, phone, postcode, service_id, created_at")
.eq("user_id", user.id)
.order("created_at", { ascending: false })
.limit(200);

if (reqErr) {
console.error(reqErr);
setMsg(`Requests load error: ${reqErr.message}`);
setRequests([]);
} else {
setRequests((reqs || []) as RequestRow[]);
}

// Load invoices
const { data: invs, error: invErr } = await supabase
.from("invoices")
.select(
"id, user_id, request_id, invoice_number, amount, currency, status, issued_at, due_at, notes, created_at, updated_at, to_email"
)
.eq("user_id", user.id)
.order("created_at", { ascending: false })
.limit(300);

if (invErr) {
console.error(invErr);
setMsg(`Invoices load error: ${invErr.message}`);
setInvoices([]);
} else {
setInvoices((invs || []) as InvoiceRow[]);
}

setLoading(false);
}

useEffect(() => {
loadAll();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const filteredInvoices = useMemo(() => {
const term = q.trim().toLowerCase();
if (!term) return invoices;

return invoices.filter((i) => {
const hay = [
i.id,
i.request_id,
i.invoice_number || "",
i.status || "",
i.to_email || "",
String(i.amount ?? ""),
i.currency || "",
]
.join(" ")
.toLowerCase();

return hay.includes(term);
});
}, [invoices, q]);

async function createInvoice(e: FormEvent) {
e.preventDefault();
setMsg(null);

if (!userId) return setMsg("Not logged in.");
if (!requestId) return setMsg("Pick a request first.");
if (!toEmail.trim()) return setMsg("Customer email is required.");
if (!isValidEmail(toEmail)) return setMsg("Customer email looks invalid.");

const n = Number(String(amount).replace(/,/g, "").trim());
if (!Number.isFinite(n) || n < 0) return setMsg("Amount must be a number.");

setBusy(true);

const payload = {
user_id: userId,
request_id: requestId,
to_email: toEmail.trim().toLowerCase(), // ✅ ALWAYS write to_email
amount: n,
currency: "GBP",
status: status || "draft",
notes: notes.trim() || null,
};

const { data, error } = await supabase
.from("invoices")
.insert(payload)
.select(
"id, user_id, request_id, invoice_number, amount, currency, status, issued_at, due_at, notes, created_at, updated_at, to_email"
)
.maybeSingle();

if (error) {
console.error(error);
setMsg(`Create invoice error: ${error.message}`);
setBusy(false);
return;
}

if (data) setInvoices((prev) => [data as InvoiceRow, ...prev]);

// reset
setRequestId("");
setToEmail("");
setAmount("0");
setStatus("draft");
setNotes("");

setMsg("Invoice created ✅");
setBusy(false);
}

async function markStatus(invoiceId: string, nextStatus: string) {
if (!userId) return;
setMsg(null);
setBusy(true);

const { data, error } = await supabase
.from("invoices")
.update({ status: nextStatus })
.eq("id", invoiceId)
.eq("user_id", userId)
.select(
"id, user_id, request_id, invoice_number, amount, currency, status, issued_at, due_at, notes, created_at, updated_at, to_email"
)
.maybeSingle();

if (error) {
setMsg(`Update error: ${error.message}`);
setBusy(false);
return;
}

if (data) {
setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? (data as InvoiceRow) : i)));
}

setBusy(false);
}

async function sendInvoice(inv: InvoiceRow) {
setMsg(null);

const to = (inv.to_email || "").trim();
if (!to) return setMsg("This invoice has no customer email (to_email is empty).");
if (!isValidEmail(to)) return setMsg("This invoice email looks invalid.");

setBusy(true);

try {
const subject = inv.invoice_number
? `Invoice ${inv.invoice_number}`
: `Invoice ${inv.id.slice(0, 8)}`;

const text =
`Hi,\n\nPlease find your invoice attached / details below.\n\n` +
`Amount: ${money(inv.amount, inv.currency)}\n` +
`Status: ${inv.status}\n` +
(inv.notes ? `\nNotes:\n${inv.notes}\n` : "\n") +
`\nThanks,\nFixFlow`;

const res = await fetch("/api/invoices/send", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ to, subject, text }),
});

const json = await res.json().catch(() => null);
if (!res.ok || !json?.ok) {
throw new Error(json?.error || "Send failed");
}

// mark sent (best-effort)
await markStatus(inv.id, "sent");
setMsg("Invoice sent ✅");
} catch (e: any) {
setMsg(e?.message || "Send failed");
}

setBusy(false);
}

async function deleteInvoice(id: string) {
if (!userId) return;
setMsg(null);

const ok = confirm("Delete this invoice?");
if (!ok) return;

setBusy(true);

const { error } = await supabase.from("invoices").delete().eq("id", id).eq("user_id", userId);

if (error) {
setMsg(`Delete error: ${error.message}`);
setBusy(false);
return;
}

setInvoices((prev) => prev.filter((i) => i.id !== id));
setMsg("Deleted ✅");
setBusy(false);
}

return (
<div className="max-w-6xl mx-auto px-4 py-8">
<div className="mb-6">
<h1 className="text-2xl font-semibold">Invoices</h1>
<p className="text-sm text-gray-500">
Create an invoice from a request. We always store the customer email in <code>to_email</code>.
</p>
</div>

{msg && (
<div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
{msg}
</div>
)}

<div className="rounded-2xl bg-white shadow p-6 mb-8">
<h2 className="text-sm font-semibold mb-3">Create invoice</h2>

<form onSubmit={createInvoice} className="grid gap-3">
<div className="grid gap-3 md:grid-cols-3">
<div className="md:col-span-1">
<label className="block text-xs font-medium text-gray-600 mb-1">Request</label>
<select
className="w-full rounded-md border px-3 py-2 text-sm"
value={requestId}
onChange={(e) => setRequestId(e.target.value)}
disabled={busy || loading}
>
<option value="">Choose…</option>
{requests.map((r) => (
<option key={r.id} value={r.id}>
{(r.name || "Customer") + " — " + (r.postcode || "No postcode") + " — " + (r.email || "No email")}
</option>
))}
</select>
<p className="mt-1 text-xs text-gray-500">
Pick the customer request; we’ll auto-fill the email.
</p>
</div>

<div className="md:col-span-2">
<label className="block text-xs font-medium text-gray-600 mb-1">To (customer email)</label>
<input
className="w-full rounded-md border px-3 py-2 text-sm"
value={toEmail}
onChange={(e) => setToEmail(e.target.value)}
placeholder="customer@example.com"
disabled={busy || loading}
/>
{!!toEmail && !isValidEmail(toEmail) && (
<p className="mt-1 text-xs text-amber-700">That email doesn’t look valid.</p>
)}
</div>
</div>

<div className="grid gap-3 md:grid-cols-3">
<div>
<label className="block text-xs font-medium text-gray-600 mb-1">Amount (GBP)</label>
<input
className="w-full rounded-md border px-3 py-2 text-sm"
value={amount}
onChange={(e) => setAmount(e.target.value)}
inputMode="decimal"
placeholder="0"
disabled={busy || loading}
/>
</div>

<div>
<label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
<select
className="w-full rounded-md border px-3 py-2 text-sm"
value={status}
onChange={(e) => setStatus(e.target.value)}
disabled={busy || loading}
>
<option value="draft">draft</option>
<option value="sent">sent</option>
<option value="paid">paid</option>
<option value="void">void</option>
</select>
</div>

<div className="flex items-end">
<button
type="submit"
disabled={busy || loading || !requestId || !toEmail || !isValidEmail(toEmail)}
className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
>
{busy ? "Creating…" : "Create invoice"}
</button>
</div>
</div>

<div>
<label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
<textarea
className="w-full rounded-md border px-3 py-2 text-sm"
value={notes}
onChange={(e) => setNotes(e.target.value)}
rows={3}
placeholder="Optional notes to include when sending…"
disabled={busy || loading}
/>
</div>
</form>
</div>

<div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
<div className="text-sm text-gray-600">
{loading ? "Loading…" : `${filteredInvoices.length} invoice(s)`}
</div>
<div className="flex items-center gap-2">
<input
className="rounded-md border px-3 py-2 text-sm w-72"
placeholder="Search email, status, id…"
value={q}
onChange={(e) => setQ(e.target.value)}
disabled={loading}
/>
<button
className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
onClick={loadAll}
disabled={busy}
type="button"
>
Refresh
</button>
</div>
</div>

<div className="rounded-2xl bg-white shadow overflow-hidden">
{loading ? (
<div className="p-6 text-sm text-gray-500">Loading invoices…</div>
) : filteredInvoices.length === 0 ? (
<div className="p-6 text-sm text-gray-600">No invoices yet.</div>
) : (
<div className="overflow-x-auto">
<table className="min-w-full text-sm">
<thead className="bg-gray-50">
<tr>
<th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
<th className="px-4 py-3 text-left font-medium text-gray-600">To</th>
<th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
<th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
<th className="px-4 py-3 text-left font-medium text-gray-600">Request</th>
<th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
</tr>
</thead>
<tbody>
{filteredInvoices.map((inv) => (
<tr key={inv.id} className="border-t hover:bg-gray-50">
<td className="px-4 py-3 whitespace-nowrap">
{new Date(inv.created_at).toLocaleString()}
</td>
<td className="px-4 py-3">{inv.to_email || <span className="text-amber-700">— missing</span>}</td>
<td className="px-4 py-3">{money(inv.amount, inv.currency)}</td>
<td className="px-4 py-3">
<span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
{inv.status}
</span>
</td>
<td className="px-4 py-3 font-mono text-xs">{inv.request_id.slice(0, 8)}…</td>
<td className="px-4 py-3 text-right whitespace-nowrap">
<div className="inline-flex gap-2">
<button
type="button"
className="text-xs rounded-md border px-3 py-1 hover:bg-gray-100"
onClick={() => sendInvoice(inv)}
disabled={busy}
>
Send
</button>
<button
type="button"
className="text-xs rounded-md border px-3 py-1 hover:bg-gray-100"
onClick={() => markStatus(inv.id, "paid")}
disabled={busy}
>
Mark paid
</button>
<button
type="button"
className="text-xs rounded-md border px-3 py-1 hover:bg-gray-100"
onClick={() => deleteInvoice(inv.id)}
disabled={busy}
>
Delete
</button>
</div>
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>

<p className="mt-4 text-xs text-gray-500">
If you have older invoices with <code>to_email</code> = NULL, run this once in Supabase:
<br />
<code className="block mt-1">
update public.invoices i set to_email = r.email from public.requests r where i.to_email is null and i.request_id = r.id;
</code>
</p>
</div>
);
}