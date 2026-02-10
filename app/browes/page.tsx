"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Trade = { id: string; name: string; slug: string };

type Trader = {
user_id: string;
slug: string | null;
display_name: string | null;
headline: string | null;
logo_url: string | null;
};

function outwardFromPostcode(input: string) {
const trimmed = (input || "").trim().toUpperCase();
const first = trimmed.split(/\s+/)[0] || "";
return first.replace(/[^A-Z0-9]/g, "");
}

export default function BrowsePage() {
const [trades, setTrades] = useState<Trade[]>([]);
const [tradeSlug, setTradeSlug] = useState("");
const [postcode, setPostcode] = useState("");

const [loading, setLoading] = useState(false);
const [items, setItems] = useState<Trader[]>([]);
const [msg, setMsg] = useState<string | null>(null);

const outward = useMemo(() => outwardFromPostcode(postcode), [postcode]);

useEffect(() => {
const loadTrades = async () => {
const { data, error } = await supabase
.from("trades")
.select("id, name, slug")
.order("name", { ascending: true });

if (error) {
console.error("Trades load error:", error.message);
setTrades([]);
return;
}

const list = (data || []) as Trade[];
setTrades(list);

// default select first trade if none chosen
if (!tradeSlug && list.length > 0) setTradeSlug(list[0].slug);
};

loadTrades();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

async function search() {
setLoading(true);
setMsg(null);
setItems([]);

const cleanTrade = (tradeSlug || "").trim();
const cleanPostcode = (postcode || "").trim();

if (!cleanTrade) {
setMsg("Choose a trade.");
setLoading(false);
return;
}
if (!cleanPostcode) {
setMsg("Enter a postcode (e.g. RH16 1AA).");
setLoading(false);
return;
}

try {
const res = await fetch("/api/marketplace/search", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
tradeSlug: cleanTrade,
postcode: cleanPostcode,
}),
cache: "no-store",
});

const json = await res.json().catch(() => null);

if (!res.ok) {
throw new Error(json?.error || "Search failed");
}

const list = (json?.traders || []) as Trader[];
setItems(list);

if (list.length === 0) {
setMsg(
`No traders found for ${cleanTrade} in ${outward || "that area"}.`
);
}
} catch (e: any) {
setMsg(e?.message || "Search failed");
} finally {
setLoading(false);
}
}

return (
<div className="max-w-5xl mx-auto px-4 py-8">
<div className="mb-6">
<h1 className="text-2xl font-semibold">Find a Trader</h1>
<p className="text-sm text-gray-500">
Choose a trade, enter your postcode, and we’ll show matching
tradespeople who cover that postcode area.
</p>
</div>

<div className="rounded-2xl bg-white shadow-md p-6 mb-6">
<div className="grid gap-3 sm:grid-cols-3">
<div>
<label className="block text-xs font-medium text-gray-600 mb-1">
Trade
</label>
<select
value={tradeSlug}
onChange={(e) => setTradeSlug(e.target.value)}
className="w-full rounded-md border px-3 py-2 text-sm"
disabled={loading}
>
{trades.length === 0 ? (
<option value="">No trades yet</option>
) : (
trades.map((t) => (
<option key={t.id} value={t.slug}>
{t.name}
</option>
))
)}
</select>
</div>

<div className="sm:col-span-2">
<label className="block text-xs font-medium text-gray-600 mb-1">
Your postcode
</label>
<input
value={postcode}
onChange={(e) => setPostcode(e.target.value)}
className="w-full rounded-md border px-3 py-2 text-sm"
placeholder="e.g. RH16 1AA"
disabled={loading}
/>
<p className="mt-1 text-xs text-gray-500">
We use the first part (outward code):{" "}
<span className="font-mono">{outward || "—"}</span>
</p>
</div>
</div>

<div className="mt-4 flex gap-2 flex-wrap">
<button
onClick={search}
disabled={loading || trades.length === 0}
className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
>
{loading ? "Searching…" : "Search"}
</button>

<Link
href="/dashboard/profile"
className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
>
← Back to dashboard
</Link>
</div>

{msg && (
<div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
{msg}
</div>
)}
</div>

<div className="grid gap-3">
{items.map((t) => {
const href = t.slug ? `/pro/${t.slug}` : undefined;

return (
<div
key={t.user_id}
className="rounded-2xl bg-white shadow-md p-5 flex items-start gap-4"
>
<div className="h-12 w-12 rounded-xl border bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
{t.logo_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={t.logo_url}
alt={t.display_name || "Trader"}
className="h-full w-full object-cover"
/>
) : (
<span className="text-sm font-semibold text-gray-700">
{(t.display_name || "T").charAt(0).toUpperCase()}
</span>
)}
</div>

<div className="min-w-0 flex-1">
<div className="flex items-start justify-between gap-3">
<div className="min-w-0">
<div className="text-base font-semibold truncate">
{t.display_name || "Unnamed trader"}
</div>
{t.headline && (
<div className="text-sm text-gray-600 truncate">
{t.headline}
</div>
)}
</div>

{href ? (
<Link
href={href}
className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white"
>
View profile
</Link>
) : (
<span className="text-xs text-gray-500">
Missing profile slug
</span>
)}
</div>

<div className="mt-2 text-xs text-gray-500">
Matching area: <span className="font-mono">{outward}</span>
</div>
</div>
</div>
);
})}
</div>

{items.length === 0 && !msg && (
<p className="text-sm text-gray-500">Run a search to see results.</p>
)}
</div>
);
}

