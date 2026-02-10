"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

type LocationRow = {
id: string;
user_id: string;
postcode_prefix: string | null;
label: string | null;
created_at?: string;
};

function outwardFrom(input: string) {
const t = (input || "").trim().toUpperCase();
const outward = t.split(/\s+/)[0] || "";
return outward.replace(/[^A-Z0-9]/g, "");
}

function looksLikeOutward(p: string) {
// Rough guard: RH16, BN1, SW1A, M1, etc.
return /^[A-Z0-9]{2,4}$/.test(p);
}

async function lookupLabel(outward: string): Promise<string | null> {
const p = outwardFrom(outward);
if (!p || !looksLikeOutward(p)) return null;

try {
const res = await fetch(
`https://api.postcodes.io/outcodes/${encodeURIComponent(p)}`
);
const json = await res.json();

if (!res.ok || !json?.result) return null;

const district = (json.result.admin_district || "").toString().trim();

let county = "";
const c = json.result.admin_county;
if (Array.isArray(c)) county = (c[0] ? String(c[0]).trim() : "") || "";
else if (typeof c === "string") county = c.trim();

const label = [district, county].filter(Boolean).join(" — ").trim();
return label || null;
} catch {
return null;
}
}

export default function LocationsPage() {
const [userId, setUserId] = useState<string | null>(null);

const [locations, setLocations] = useState<LocationRow[]>([]);
const [loading, setLoading] = useState(true);
const [busy, setBusy] = useState(false);
const [msg, setMsg] = useState<string | null>(null);

// form
const [input, setInput] = useState("");
const outward = useMemo(() => outwardFrom(input), [input]);

const [label, setLabel] = useState("");
const [lookupState, setLookupState] = useState<
"idle" | "looking" | "found" | "notfound"
>("idle");

const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const lastLookedUp = useRef<string>("");

// load user + rows
useEffect(() => {
const load = async () => {
setLoading(true);
setMsg(null);

const { data, error } = await supabase.auth.getUser();
const user = data?.user;

if (error || !user) {
setMsg("You must be logged in to manage locations.");
setLoading(false);
return;
}

setUserId(user.id);

const { data: rows, error: rowsErr } = await supabase
.from("trade_locations")
.select("id, user_id, postcode_prefix, label, created_at")
.eq("user_id", user.id)
.order("postcode_prefix", { ascending: true });

if (rowsErr) {
setMsg(`Locations load error: ${rowsErr.message}`);
setLocations([]);
} else {
setLocations((rows || []) as LocationRow[]);
}

setLoading(false);
};

load();
}, []);

// auto label while typing (no lookup button)
useEffect(() => {
const p = outward;

if (!p) {
setLabel("");
setLookupState("idle");
lastLookedUp.current = "";
if (debounceTimer.current) clearTimeout(debounceTimer.current);
return;
}

if (!looksLikeOutward(p)) {
setLabel("");
setLookupState("idle");
if (debounceTimer.current) clearTimeout(debounceTimer.current);
return;
}

if (debounceTimer.current) clearTimeout(debounceTimer.current);

debounceTimer.current = setTimeout(async () => {
if (lastLookedUp.current === p) return;
lastLookedUp.current = p;

setLookupState("looking");
const found = await lookupLabel(p);

if (found) {
setLabel(found);
setLookupState("found");
} else {
setLabel("");
setLookupState("notfound");
}
}, 500);

return () => {
if (debounceTimer.current) clearTimeout(debounceTimer.current);
};
}, [outward]);

const add = async (e: FormEvent) => {
e.preventDefault();
setMsg(null);

if (!userId) {
setMsg("You must be logged in.");
return;
}

const p = outwardFrom(input);

if (!p) {
setMsg("Type a postcode prefix (e.g. RH16) or a postcode (e.g. RH16 1AA).");
return;
}
if (!looksLikeOutward(p)) {
setMsg("That prefix looks invalid. Use only the first part (e.g. RH16, BN1, SW1A).");
return;
}

// Ensure label exists (in case debounce hasn't finished)
let finalLabel = (label || "").trim();
if (!finalLabel) {
setBusy(true);
const found = await lookupLabel(p);
setBusy(false);
if (found) finalLabel = found;
}

if (!finalLabel) {
setMsg("Couldn’t find a town/county label for that prefix. Try another.");
return;
}

const already = locations.some(
(r) => outwardFrom(r.postcode_prefix || "") === p
);
if (already) {
setMsg("That postcode prefix is already added.");
return;
}

setBusy(true);

const { data: inserted, error } = await supabase
.from("trade_locations")
.insert({
user_id: userId,
postcode_prefix: p,
label: finalLabel,
})
.select("id, user_id, postcode_prefix, label, created_at")
.maybeSingle();

if (error) {
setMsg(`Add location error: ${error.message}`);
setBusy(false);
return;
}

if (inserted) {
const next = [...locations, inserted as LocationRow].sort((a, b) =>
String(a.postcode_prefix || "").localeCompare(String(b.postcode_prefix || ""))
);
setLocations(next);
}

setInput("");
setLabel("");
setLookupState("idle");
lastLookedUp.current = "";

setMsg("Location added ✅");
setBusy(false);
};

const remove = async (id: string) => {
if (!userId) return;
setMsg(null);

const ok = confirm("Delete this postcode prefix?");
if (!ok) return;

setBusy(true);

const { error } = await supabase
.from("trade_locations")
.delete()
.eq("id", id)
.eq("user_id", userId);

if (error) {
setMsg(`Delete error: ${error.message}`);
setBusy(false);
return;
}

setLocations((prev) => prev.filter((r) => r.id !== id));
setMsg("Deleted ✅");
setBusy(false);
};

return (
<div className="max-w-5xl mx-auto px-4 py-8">
<div className="mb-6">
<h1 className="text-2xl font-semibold">Locations</h1>
<p className="text-sm text-gray-500">
Enter a postcode prefix (first part only). We’ll auto-fill the label.
</p>
</div>

{msg && (
<div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
{msg}
</div>
)}

<div className="rounded-2xl bg-white shadow-md p-6 mb-6">
<h2 className="text-sm font-semibold mb-3">Add postcode prefix</h2>

<form onSubmit={add} className="grid gap-3 sm:grid-cols-3">
<div className="sm:col-span-1">
<label className="block text-xs font-medium text-gray-600 mb-1">
Postcode prefix
</label>
<input
value={input}
onChange={(e) => setInput(e.target.value)}
className="w-full rounded-md border px-3 py-2 text-sm"
placeholder="RH16 or RH16 1AA"
disabled={busy}
/>
<div className="mt-1 text-xs text-gray-500">
We store the prefix only: <span className="font-mono">RH16</span>
</div>
</div>

<div className="sm:col-span-2">
<label className="block text-xs font-medium text-gray-600 mb-1">
Label
</label>
<input
value={label}
readOnly
className="w-full rounded-md border px-3 py-2 text-sm bg-gray-50"
placeholder="Auto-filled…"
/>
<div className="mt-1 text-xs">
{lookupState === "looking" && (
<span className="text-gray-500">Looking up…</span>
)}
{lookupState === "found" && label && (
<span className="text-green-700">Found ✅</span>
)}
{lookupState === "notfound" && outward && (
<span className="text-amber-700">
Couldn’t find a label for <span className="font-mono">{outward}</span>
</span>
)}
</div>
</div>

<div className="sm:col-span-3">
<button
type="submit"
disabled={busy || !outward || !label}
className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
>
{busy ? "Saving…" : "Add"}
</button>
</div>
</form>
</div>

<div className="rounded-2xl bg-white shadow-md overflow-hidden">
{loading ? (
<div className="p-6 text-sm text-gray-500">Loading…</div>
) : locations.length === 0 ? (
<div className="p-6 text-sm text-gray-600">No locations yet.</div>
) : (
<div className="overflow-x-auto">
<table className="min-w-full text-sm">
<thead className="bg-gray-50">
<tr>
<th className="px-4 py-3 text-left font-medium text-gray-600">
Postcode prefix
</th>
<th className="px-4 py-3 text-left font-medium text-gray-600">
Label
</th>
<th className="px-4 py-3" />
</tr>
</thead>
<tbody>
{locations.map((r) => (
<tr key={r.id} className="border-t hover:bg-gray-50">
<td className="px-4 py-3 font-mono">{r.postcode_prefix}</td>
<td className="px-4 py-3">{r.label || "—"}</td>
<td className="px-4 py-3 text-right">
<button
type="button"
onClick={() => remove(r.id)}
className="text-xs rounded-md border px-3 py-1 hover:bg-gray-100"
disabled={busy}
>
Delete
</button>
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
</div>
);
}







