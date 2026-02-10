"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Attachment = {
name: string;
path: string;
url: string;
isImage: boolean;
};

function formatDate(dt?: string | null) {
if (!dt) return "—";
try {
return new Date(dt).toLocaleString();
} catch {
return dt;
}
}

function looksLikeImage(name: string) {
const ext = (name.split(".").pop() || "").toLowerCase();
return ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
}

export default function EnquiriesPage() {
const router = useRouter();
const sp = useSearchParams();
const requestIdFromUrl = sp.get("requestId");

const [uid, setUid] = useState<string | null>(null);

const [rows, setRows] = useState<any[]>([]);
const [loading, setLoading] = useState(true);

const [openId, setOpenId] = useState<string | null>(requestIdFromUrl);
const openRow = useMemo(() => rows.find((r) => r.id === openId) || null, [rows, openId]);

const [q, setQ] = useState("");
const [busy, setBusy] = useState(false);

const [attachments, setAttachments] = useState<Attachment[]>([]);
const [attLoading, setAttLoading] = useState(false);

const filtered = useMemo(() => {
const s = q.trim().toLowerCase();
if (!s) return rows;

return rows.filter((r) => {
const hay = [
r?.name,
r?.email,
r?.phone,
r?.postcode,
r?.trade,
r?.service,
r?.details,
r?.message,
]
.filter(Boolean)
.join(" ")
.toLowerCase();

return hay.includes(s);
});
}, [rows, q]);

async function load() {
setLoading(true);

const { data: auth } = await supabase.auth.getUser();
const user = auth?.user;
if (!user) {
setUid(null);
setRows([]);
setLoading(false);
return;
}
setUid(user.id);

// ✅ IMPORTANT: select('*') avoids “column does not exist” errors
const { data, error } = await supabase
.from("requests")
.select("*")
.eq("user_id", user.id)
.order("created_at", { ascending: false });

if (error) {
console.error(error);
setRows([]);
setLoading(false);
return;
}

const list = (data || []) as any[];
setRows(list);

// Keep the currently selected enquiry valid
const firstId = list[0]?.id ?? null;

const targetId = requestIdFromUrl && list.some((r) => r.id === requestIdFromUrl)
? requestIdFromUrl
: openId && list.some((r) => r.id === openId)
? openId
: firstId;

setOpenId(targetId);

if (targetId) {
router.replace(`/dashboard/requests?requestId=${targetId}`);
await loadAttachments(targetId);
} else {
setAttachments([]);
}

setLoading(false);
}

async function loadAttachments(requestId: string) {
setAttLoading(true);
setAttachments([]);

try {
const folder = `request/${requestId}`;

// This requires Storage permission to list() (we’ll fix policies below)
const { data: files, error: listErr } = await supabase.storage
.from("quote-files")
.list(folder, { limit: 50, sortBy: { column: "name", order: "desc" } });

if (listErr) throw listErr;

const safeFiles = (files || []).filter((f) => f?.name && !f.name.endsWith("/"));

const built: Attachment[] = [];

for (const f of safeFiles) {
const fullPath = `${folder}/${f.name}`;

// Prefer signed URLs (works for private bucket)
const { data: signed } = await supabase.storage
.from("quote-files")
.createSignedUrl(fullPath, 60 * 60); // 1 hour

let url = signed?.signedUrl || "";

// Fallback if bucket is public
if (!url) {
const pub = supabase.storage.from("quote-files").getPublicUrl(fullPath);
url = pub?.data?.publicUrl || "";
}

if (!url) continue;

built.push({
name: f.name,
path: fullPath,
url,
isImage: looksLikeImage(f.name),
});
}

setAttachments(built);
} catch (e: any) {
console.error("Attachment load error:", e?.message || e);
setAttachments([]);
}

setAttLoading(false);
}

function selectEnquiry(id: string) {
setOpenId(id);
router.replace(`/dashboard/requests?requestId=${id}`);
loadAttachments(id);
}

async function deleteEnquiry(id: string) {
if (!uid) return;
const ok = confirm("Delete this enquiry? This cannot be undone.");
if (!ok) return;

setBusy(true);

const { error } = await supabase
.from("requests")
.delete()
.eq("id", id)
.eq("user_id", uid);

if (error) {
alert(error.message);
setBusy(false);
return;
}

// Refresh list
await load();
setBusy(false);
}

function createQuoteFromEnquiry(r: any) {
// If you already have a quote-create route, swap this destination.
// This matches your “p/slug/quote -> requests” setup.
router.push(`/dashboard/quotes?fromRequestId=${r.id}`);
}

useEffect(() => {
load();

const ch = supabase
.channel("ff_requests_live")
.on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => load())
.subscribe();

return () => {
supabase.removeChannel(ch);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

if (loading) {
return (
<div className="p-6">
<div className="text-lg font-semibold">Enquiries</div>
<div className="mt-2 text-sm text-gray-600">Loading…</div>
</div>
);
}

if (!uid) {
return (
<div className="p-6">
<div className="text-lg font-semibold">Enquiries</div>
<div className="mt-2 text-sm text-gray-600">
Please sign in first.
</div>
</div>
);
}

return (
<div className="p-4 sm:p-6">
<div className="flex items-start justify-between gap-4">
<div>
<h1 className="text-xl font-semibold">Enquiries</h1>
<p className="text-sm text-gray-600">
New customer enquiries waiting for your response.
</p>
</div>

<button
onClick={load}
className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
disabled={busy}
>
Refresh
</button>
</div>

<div className="mt-4 grid gap-4 lg:grid-cols-[380px_1fr]">
{/* LEFT LIST */}
<div className="rounded-xl border bg-white overflow-hidden">
<div className="p-3 border-b">
<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="Search customer, postcode, trade…"
className="w-full rounded-lg border px-3 py-2 text-sm"
/>
</div>

<div className="max-h-[70vh] overflow-auto">
{filtered.length === 0 ? (
<div className="p-4 text-sm text-gray-600">No enquiries yet.</div>
) : (
<div className="divide-y">
{filtered.map((r) => {
const active = r.id === openId;
const title = (r?.name || r?.customer_name || r?.full_name || "New enquiry").toString();
const sub = [r?.postcode, r?.trade || r?.service].filter(Boolean).join(" • ");
return (
<button
key={r.id}
onClick={() => selectEnquiry(r.id)}
className={`w-full text-left p-4 hover:bg-gray-50 ${
active ? "bg-gray-900 text-white hover:bg-gray-900" : ""
}`}
>
<div className="font-medium truncate">{title}</div>
<div className={`text-xs mt-1 truncate ${active ? "text-gray-200" : "text-gray-500"}`}>
{sub || "—"}
</div>
<div className={`text-xs mt-1 ${active ? "text-gray-200" : "text-gray-400"}`}>
{formatDate(r?.created_at)}
</div>
</button>
);
})}
</div>
)}
</div>
</div>

{/* RIGHT DETAILS */}
<div className="rounded-xl border bg-white p-4 sm:p-6">
{!openRow ? (
<div className="text-sm text-gray-600">Select an enquiry to view details.</div>
) : (
<>
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
<div className="min-w-0">
<div className="text-lg font-semibold truncate">
{(openRow?.name || openRow?.customer_name || openRow?.full_name || "Customer").toString()}
</div>

<div className="mt-1 text-sm text-gray-600">
{[openRow?.email, openRow?.phone].filter(Boolean).join(" • ") || "—"}
</div>

<div className="mt-1 text-xs text-gray-500">
{formatDate(openRow?.created_at)}
{openRow?.postcode ? ` • ${openRow.postcode}` : ""}
</div>
</div>

<div className="flex gap-2 shrink-0">
<button
onClick={() => createQuoteFromEnquiry(openRow)}
className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
>
Create quote
</button>

<button
onClick={() => deleteEnquiry(openRow.id)}
disabled={busy}
className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
>
Delete
</button>
</div>
</div>

<div className="mt-4 grid gap-3 sm:grid-cols-2">
<InfoCard label="Postcode" value={openRow?.postcode} />
<InfoCard label="Trade / Service" value={openRow?.trade || openRow?.service} />
</div>

<div className="mt-4 rounded-xl border p-4 bg-gray-50">
<div className="text-xs font-semibold text-gray-600 mb-2">Customer message</div>
<div className="text-sm whitespace-pre-wrap text-gray-800">
{openRow?.details || openRow?.message || "—"}
</div>
</div>

<div className="mt-4 rounded-xl border p-4">
<div className="flex items-center justify-between gap-3">
<div className="text-xs font-semibold text-gray-600">
Attachments
</div>
<div className="text-xs text-gray-500">
{attLoading ? "Loading…" : `${attachments.length} file(s)`}
</div>
</div>

<div className="mt-3">
{attLoading ? (
<div className="text-sm text-gray-500">Loading attachments…</div>
) : attachments.length === 0 ? (
<div className="text-sm text-gray-600">No photos/files attached.</div>
) : (
<div className="grid gap-3 sm:grid-cols-3">
{attachments.map((a) => (
<a
key={a.path}
href={a.url}
target="_blank"
rel="noreferrer"
className="rounded-lg border overflow-hidden hover:shadow-sm"
title="Open attachment"
>
{a.isImage ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={a.url}
alt={a.name}
className="h-32 w-full object-cover"
/>
) : (
<div className="h-32 flex items-center justify-center text-xs text-gray-600 bg-gray-50 px-2 text-center">
{a.name}
</div>
)}

<div className="px-2 py-2 text-xs text-gray-700 truncate">
{a.name}
</div>
</a>
))}
</div>
)}
</div>

<div className="mt-3 text-xs text-gray-500">
Tip: Clicking a photo opens it full size.
</div>
</div>
</>
)}
</div>
</div>
</div>
);
}

function InfoCard({ label, value }: { label: string; value?: any }) {
return (
<div className="rounded-xl border p-4">
<div className="text-xs font-semibold text-gray-600">{label}</div>
<div className="mt-1 text-sm text-gray-900">{value ? String(value) : "—"}</div>
</div>
);
}
