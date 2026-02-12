"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ReactNode, useEffect, useMemo, useState } from "react";

type ProfileLite = {
id: string;
display_name: string | null;
logo_url: string | null;
};

type Counts = {
enquiries: number;
quotes: number;
bookings: number;
invoices: number;
};



export default function DashboardLayout({ children }: { children: ReactNode }) {
const pathname = usePathname();
const router = useRouter();
const [busy, setBusy] = useState(false);

const [profile, setProfile] = useState<ProfileLite | null>(null);
const [counts, setCounts] = useState<Counts>({
enquiries: 0,
quotes: 0,
bookings: 0,
invoices: 0,
});

const logout = async () => {
setBusy(true);
await supabase.auth.signOut();
router.replace("/login");
router.refresh();
};

useEffect(() => {
let mounted = true;

const safeCount = async (fn: () => Promise<number>) => {
try {
return await fn();
} catch {
return 0;
}
};

const isMissing = (msg?: string) => {
const m = (msg || "").toLowerCase();
return m.includes("does not exist") || m.includes("relation") || m.includes("schema cache");
};

const load = async () => {
try {
const {
data: { user },
} = await supabase.auth.getUser();

if (!user) return;

// Profile for branding
const { data: p } = await supabase
.from("profiles")
.select("id, display_name, logo_url")
.eq("id", user.id)
.maybeSingle();

if (mounted) setProfile((p || null) as ProfileLite | null);

// ENQUIRIES = quote_requests NOT replied (this matches your “Not replied” tab)
const enquiries = await safeCount(async () => {
  const { count, error } = await supabase
    .from("quote_requests")
    .select("id", { head: true, count: "exact" })
    .eq("plumber_id", user.id)
    .not("status", "ilike", "%replied%");

  if (error) {
    if (isMissing(error.message)) return 0;
    throw error;
  }
  return count ?? 0;
});

// ESTIMATES = quotes table for this trader
const quotes = await safeCount(async () => {
  const { count, error } = await supabase
    .from("quotes")
    .select("id", { head: true, count: "exact" })
    .eq("plumber_id", user.id);

  if (error) {
    if (isMissing(error.message)) return 0;
    throw error;
  }
  return count ?? 0;
});

// BOOKINGS = requests that are booked / have calendar fields (NO bookings table)
const bookings = await safeCount(async () => {
  const { count, error } = await supabase
    .from("requests")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", user.id)
    .or("status.eq.booked,calendar_event_id.not.is.null,calendar_html_link.not.is.null");

  if (error) {
    if (isMissing(error.message)) return 0;
    throw error;
  }
  return count ?? 0;
});

// INVOICES = invoices for this trader
const invoices = await safeCount(async () => {
  const { count, error } = await supabase
    .from("invoices")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", user.id);

  if (error) {
    if (isMissing(error.message)) return 0;
    throw error;
  }
  return count ?? 0;
});

if (!mounted) return;
setCounts({ enquiries, quotes, bookings, invoices });
} catch {
// ignore
}
};

load();
const ch1 = supabase
  .channel("ff_counts_quote_requests")
  .on("postgres_changes", { event: "*", schema: "public", table: "quote_requests" }, () => load())
  .subscribe();

const ch2 = supabase
  .channel("ff_counts_requests")
  .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => load())
  .subscribe();

const ch3 = supabase
  .channel("ff_counts_quotes")
  .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => load())
  .subscribe();

const ch4 = supabase
  .channel("ff_counts_invoices")
  .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => load())
  .subscribe();

return () => {
mounted = false;
supabase.removeChannel(ch1);
supabase.removeChannel(ch2);
supabase.removeChannel(ch3);
};
}, []);

const traderName = useMemo(() => {
return profile?.display_name?.trim() || "Your Business";
}, [profile]);

return (
<div className="min-h-screen bg-gray-100">
<div className="mx-auto max-w-7xl px-4 py-6">
<div className="flex gap-6">
{/* SIDEBAR */}
<aside className="hidden md:block w-64">
<div className="rounded-xl bg-white shadow p-4">
<div className="flex items-start justify-between mb-4">
<div className="min-w-0">
<div className="text-sm font-semibold">FixFlow</div>

<div className="mt-3 flex items-center gap-2">
<div className="h-9 w-9 rounded-lg border bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
{profile?.logo_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={profile.logo_url} alt={traderName} className="h-full w-full object-cover" />
) : (
<span className="text-xs font-semibold text-gray-700">
{traderName.charAt(0).toUpperCase()}
</span>
)}
</div>

<div className="min-w-0">
<div className="text-[11px] text-gray-500">Signed in as</div>
<div className="text-sm font-medium truncate">{traderName}</div>
</div>
</div>
</div>

<button
onClick={logout}
disabled={busy}
className="text-xs rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-60"
>
Logout
</button>
</div>

<nav className="space-y-1 text-sm">
<NavItem pathname={pathname} href="/dashboard" label="Dashboard" exact />

<NavItem pathname={pathname} href="/dashboard/inbox" label="Enquiries" badge={counts.enquiries} />

{/* ✅ FIX: Estimates points to /dashboard/estimates */}
<NavItem pathname={pathname} href="/dashboard/estimates" label="Estimates" badge={counts.quotes} />

<NavItem pathname={pathname} href="/dashboard/bookings" label="Bookings" badge={counts.bookings} />
<NavItem pathname={pathname} href="/dashboard/invoices" label="Invoices" badge={counts.invoices} />

<NavItem pathname={pathname} href="/dashboard/locations" label="Locations" />
<NavItem pathname={pathname} href="/dashboard/services" label="Services" />
<NavItem pathname={pathname} href="/dashboard/trades" label="Trades" />
<NavItem pathname={pathname} href="/dashboard/profile" label="Profile" />
</nav>

<div className="mt-6 border-t pt-4">
<Link href="/" className="block text-xs text-gray-600 hover:underline">
← Back to site
</Link>
</div>
</div>
</aside>

{/* MAIN */}
<main className="flex-1 min-w-0">
{/* MOBILE HEADER */}
{/* MOBILE HEADER */}
<div className="md:hidden mb-4">
  <div className="rounded-xl bg-white shadow p-4">
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-xs font-semibold text-gray-500">FixFlow</div>

        <div className="mt-2 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl border bg-gray-50 overflow-hidden flex items-center justify-center">
            {profile?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.logo_url}
                alt={traderName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-gray-700">
                {traderName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-[11px] text-gray-500">Signed in as</div>
            <div className="text-base font-semibold truncate text-gray-900">
              {traderName}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        disabled={busy}
        className="text-xs rounded-lg border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-60"
      >
        Logout
      </button>
    </div>

    {/* Mobile tabs stay exactly as you already have them */}

{/* Mobile tabs (scrollable) */}
<div className="relative mt-3 -mx-3 px-3">
<div className="flex gap-2 overflow-x-auto pb-2">
<div className="flex w-max gap-2">
<MobileTab pathname={pathname} href="/dashboard" label="Dashboard" exact />
<MobileTab pathname={pathname} href="/dashboard/inbox" label={`Enquiries (${counts.enquiries})`} />

{/* ✅ FIX: Estimates points to /dashboard/estimates */}
<MobileTab pathname={pathname} href="/dashboard/estimates" label={`Estimates (${counts.quotes})`} />

<MobileTab pathname={pathname} href="/dashboard/bookings" label={`Bookings (${counts.bookings})`} />
<MobileTab pathname={pathname} href="/dashboard/invoices" label={`Invoices (${counts.invoices})`} />
<MobileTab pathname={pathname} href="/dashboard/locations" label="Locations" />
<MobileTab pathname={pathname} href="/dashboard/services" label="Services" />
<MobileTab pathname={pathname} href="/dashboard/trades" label="Trades" />
<MobileTab pathname={pathname} href="/dashboard/profile" label="Profile" />
</div>
</div>

{/* fade hint */}
<div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent" />
</div>
</div>
</div>

{/* PAGE CONTENT */}
<div className="rounded-xl bg-white shadow p-4 sm:p-6">{children}</div>
</main>
</div>
</div>
</div>
);
}

/* ---------------- Helpers ---------------- */

function isActive(pathname: string, href: string, exact?: boolean) {
if (exact) return pathname === href;

if (pathname === href) return true;

// nested routes
if (pathname.startsWith(href + "/")) return true;

// IMPORTANT: section match (keeps tabs active even if params etc)
if (pathname.startsWith(href)) return true;

return false;
}

function NavItem({
pathname,
href,
label,
badge,
exact,
}: {
pathname: string;
href: string;
label: string;
badge?: number;
exact?: boolean;
}) {
const active = isActive(pathname, href, exact);

return (
<Link
href={href}
className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
}`}
>
<span className="truncate">{label}</span>

{typeof badge === "number" && (
<span
className={`text-[11px] px-2 py-0.5 rounded-full border ${
active ? "border-gray-700 bg-gray-800 text-white" : "border-gray-200 bg-gray-50 text-gray-700"
}`}
>
{badge}
</span>
)}
</Link>
);
}

function MobileTab({
pathname,
href,
label,
exact,
}: {
pathname: string;
href: string;
label: string;
exact?: boolean;
}) {
const active = isActive(pathname, href, exact);

return (
<Link
href={href}
className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs ${
active ? "bg-gray-900 text-white border-gray-900" : "text-gray-700 border-gray-200 hover:bg-gray-50"
}`}
>
{label}
</Link>
);
}