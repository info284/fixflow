"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CountResult = number | null;

type RevenueResult = {
value: number | null;
currency: "GBP";
};

export type DashboardStats = {
loading: boolean;
error: string | null;

userId: string | null;
lastSignInAt: string | null;

requestsNew: CountResult;
requestsTotal: CountResult;

quotesTotal: CountResult;
bookingsUpcoming: CountResult;

invoicesTotal: CountResult;
inboxTotal: CountResult;

revenueThisMonth: RevenueResult;

lastActivityAt: string | null;
};

function startOfThisMonthISO() {
const d = new Date();
const start = new Date(d.getFullYear(), d.getMonth(), 1);
return start.toISOString();
}

async function safeCount(
table: string,
baseFilter: (q: any) => any
): Promise<CountResult> {
try {
let q = supabase.from(table).select("id", { head: true, count: "exact" });
q = baseFilter(q);
const { count, error } = await q;

if (error) {
// Missing table / missing column / RLS / etc.
console.warn(`[safeCount] ${table} count failed:`, error.message);
return null;
}
return typeof count === "number" ? count : 0;
} catch (e: any) {
console.warn(`[safeCount] ${table} exception:`, e?.message || e);
return null;
}
}

async function safeLatestCreatedAt(
table: string,
baseFilter: (q: any) => any
): Promise<string | null> {
try {
let q = supabase.from(table).select("created_at").order("created_at", { ascending: false }).limit(1);
q = baseFilter(q);
const { data, error } = await q;

if (error) {
console.warn(`[safeLatestCreatedAt] ${table} failed:`, error.message);
return null;
}
const row = (data || [])[0] as any;
return row?.created_at || null;
} catch (e: any) {
console.warn(`[safeLatestCreatedAt] ${table} exception:`, e?.message || e);
return null;
}
}

function sumFirstNumericField(rows: any[], keys: string[]) {
for (const k of keys) {
const anyHas = rows.some((r) => typeof r?.[k] === "number");
if (!anyHas) continue;
const total = rows.reduce((acc, r) => acc + (typeof r?.[k] === "number" ? r[k] : 0), 0);
return total;
}
return null;
}

async function safeRevenueThisMonth(userId: string): Promise<RevenueResult> {
// Tries common columns; if your schema differs it will just return null.
try {
const since = startOfThisMonthISO();

const { data, error } = await supabase
.from("invoices")
.select("created_at, total, amount, amount_total, total_amount, grand_total")
.eq("user_id", userId)
.gte("created_at", since);

if (error) {
console.warn("[safeRevenueThisMonth] invoices query failed:", error.message);
return { value: null, currency: "GBP" };
}

const rows = (data || []) as any[];
const sum = sumFirstNumericField(rows, ["total", "amount_total", "total_amount", "grand_total", "amount"]);
return { value: sum, currency: "GBP" };
} catch (e: any) {
console.warn("[safeRevenueThisMonth] exception:", e?.message || e);
return { value: null, currency: "GBP" };
}
}

export function useDashboardStats(): DashboardStats {
const [state, setState] = useState<DashboardStats>({
loading: true,
error: null,

userId: null,
lastSignInAt: null,

requestsNew: null,
requestsTotal: null,

quotesTotal: null,
bookingsUpcoming: null,

invoicesTotal: null,
inboxTotal: null,

revenueThisMonth: { value: null, currency: "GBP" },

lastActivityAt: null,
});

useEffect(() => {
let cancelled = false;

const run = async () => {
setState((s) => ({ ...s, loading: true, error: null }));

const { data: userData, error: userErr } = await supabase.auth.getUser();
const user = userData?.user;

if (userErr || !user) {
if (!cancelled) {
setState((s) => ({
...s,
loading: false,
error: "Not logged in",
userId: null,
}));
}
return;
}

const userId = user.id;
const lastSignInAt = (user as any)?.last_sign_in_at || null;

// Requests: try count(status="new") first, fallback to total if status column doesn’t exist
let requestsNew: CountResult = null;
requestsNew = await safeCount("requests", (q) =>
q.eq("user_id", userId).eq("status", "new")
);
if (requestsNew === null) {
// status column/table might not exist or RLS; fallback to total
requestsNew = await safeCount("requests", (q) => q.eq("user_id", userId));
}

const requestsTotal = await safeCount("requests", (q) => q.eq("user_id", userId));

// Quotes (if you have a quotes table)
const quotesTotal = await safeCount("quotes", (q) => q.eq("user_id", userId));

// Bookings (if you have a bookings table)
// If you have a status/date column later, we can refine “upcoming”
const bookingsUpcoming = await safeCount("bookings", (q) => q.eq("user_id", userId));

// Invoices
const invoicesTotal = await safeCount("invoices", (q) => q.eq("user_id", userId));

// Inbox (optional) — if your table is called something else, we’ll adjust later
const inboxTotal = await safeCount("inbox", (q) => q.eq("user_id", userId));

const revenueThisMonth = await safeRevenueThisMonth(userId);

// last activity = newest created_at we can find
const [rAt, qAt, bAt, iAt] = await Promise.all([
safeLatestCreatedAt("requests", (q) => q.eq("user_id", userId)),
safeLatestCreatedAt("quotes", (q) => q.eq("user_id", userId)),
safeLatestCreatedAt("bookings", (q) => q.eq("user_id", userId)),
safeLatestCreatedAt("invoices", (q) => q.eq("user_id", userId)),
]);

const candidates = [rAt, qAt, bAt, iAt].filter(Boolean) as string[];
const lastActivityAt =
candidates.length === 0
? null
: candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

if (!cancelled) {
setState({
loading: false,
error: null,

userId,
lastSignInAt,

requestsNew,
requestsTotal,

quotesTotal,
bookingsUpcoming,

invoicesTotal,
inboxTotal,

revenueThisMonth,

lastActivityAt,
});
}
};

run();
return () => {
cancelled = true;
};
}, []);

return state;
}

export function formatGBP(n: number | null) {
if (n === null || typeof n === "undefined") return "—";
return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

export function timeAgo(iso: string | null) {
if (!iso) return "—";
const t = new Date(iso).getTime();
if (Number.isNaN(t)) return "—";
const diff = Date.now() - t;

const mins = Math.floor(diff / 60000);
if (mins < 1) return "just now";
if (mins < 60) return `${mins}m ago`;

const hrs = Math.floor(mins / 60);
if (hrs < 24) return `${hrs}h ago`;

const days = Math.floor(hrs / 24);
return `${days}d ago`;
}