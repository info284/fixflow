// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { getEnquiryCounts } from "@/lib/enquiryCounts";
import { getJobCounts } from "@/lib/jobCounts";

type ProfileLite = {
  id: string;
  display_name: string | null;
  logo_url: string | null;
};

type Counts = {
  enquiries: number;
  jobs: number;
  invoices: number;
  needsAction: number;
  followUp: number;
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

const isFullBleed =
  pathname.startsWith("/dashboard/enquiries") ||
  pathname.startsWith("/dashboard/bookings");

  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState<ProfileLite | null>(null);
const [counts, setCounts] = useState<Counts>({
  enquiries: 0,
  jobs: 0,
  invoices: 0,
  needsAction: 0,
  followUp: 0,
});

  const logout = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  useEffect(() => {
    let mounted = true;

   const safeLoad = async <T,>(fn: () => Promise<T>, fallback: T) => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

    const isMissing = (msg?: string) => {
      const m = (msg || "").toLowerCase();
      return (
        m.includes("does not exist") ||
        m.includes("relation") ||
        m.includes("schema cache")
      );
    };

    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: p } = await supabase
          .from("profiles")
          .select("id, display_name, logo_url")
          .eq("id", user.id)
          .maybeSingle();

        if (mounted) setProfile((p || null) as ProfileLite | null);

const allRequests = await safeLoad(async () => {
  const { data, error } = await supabase
    .from("quote_requests")
   .select("id, stage, status, job_booked_at, read_at, snoozed_until, created_at")
    .eq("plumber_id", user.id);

  if (error) {
    if (isMissing(error.message)) return [];
    throw error;
  }

  return data ?? [];
}, []);

const quoteRows = await safeLoad(async () => {
  const requestIds = allRequests.map((r) => r.id);
  if (!requestIds.length) return [];

  const { data, error } = await supabase
    .from("quotes")
    .select("request_id, status")
    .eq("plumber_id", user.id)
    .in("request_id", requestIds);

  if (error) {
    if (isMissing(error.message)) return [];
    throw error;
  }

  return data ?? [];
}, []);

const estimateRows = await safeLoad(async () => {
  const { data, error } = await supabase
    .from("estimates")
    .select("id, request_id, status, accepted_at, created_at")
    .eq("plumber_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissing(error.message)) return [];
    throw error;
  }

  return data ?? [];
}, []);

const visitRows = await safeLoad(async () => {
  const { data, error } = await supabase
    .from("site_visits")
    .select("request_id, starts_at")
    .eq("plumber_id", user.id)
    .order("starts_at", { ascending: false });

  if (error) {
    if (isMissing(error.message)) return [];
    throw error;
  }

  return data ?? [];
}, []);

const messageRows = await safeLoad(async () => {
  const requestIds = allRequests.map((r) => r.id);
  if (!requestIds.length) return [];

  const { data, error } = await supabase
    .from("enquiry_messages")
    .select("request_id, direction, created_at")
    .eq("plumber_id", user.id)
    .in("request_id", requestIds)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissing(error.message)) return [];
    throw error;
  }

  return data ?? [];
}, []);

const estimateMap = Object.fromEntries(
  estimateRows.reduce((acc: [string, {
    status: string | null;
    accepted_at: string | null;
    created_at: string | null;
  } | null][], row: any) => {
    if (!row.request_id) return acc;
    if (acc.find(([id]) => id === row.request_id)) return acc;

    acc.push([
      row.request_id,
      {
        status: row.status || null,
        accepted_at: row.accepted_at || null,
        created_at: row.created_at || null,
      },
    ]);

    return acc;
  }, [])
);

const visitMap = Object.fromEntries(
  visitRows.reduce((acc: [string, { starts_at: string } | null][], row: any) => {
    if (!row.request_id) return acc;
    if (acc.find(([id]) => id === row.request_id)) return acc;

    acc.push([
      row.request_id,
      {
        starts_at: row.starts_at,
      },
    ]);

    return acc;
  }, [])
);

const threadMap = messageRows.reduce((acc: Record<string, { direction: string | null; created_at: string }[]>, row: any) => {
  if (!row.request_id) return acc;
  if (!acc[row.request_id]) acc[row.request_id] = [];
  acc[row.request_id].push({
    direction: row.direction || null,
    created_at: row.created_at,
  });
  return acc;
}, {});

const quoteMap = Object.fromEntries(
  quoteRows.reduce((acc: [string, { request_id: string | null; status: string | null }][], row: any) => {
    if (!row.request_id) return acc;
    if (acc.find(([id]) => id === row.request_id)) return acc;

    acc.push([
      row.request_id,
      {
        request_id: row.request_id || null,
        status: row.status || null,
      },
    ]);

    return acc;
  }, [])
);

const enquiryCounts = getEnquiryCounts({
  rows: allRequests,
  estimateMap,
  visitMap,
  threadMap,
});

const enquiries = enquiryCounts.needsAction;
const { jobs } = getJobCounts({
  requests: allRequests,
  quoteMap,
});
const needsAction = enquiryCounts.needsAction;
const followUp = enquiryCounts.followUp;

const invoices = await safeLoad(async () => {
  const { count, error } = await supabase
    .from("invoices")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", user.id);

  if (error) {
    if (isMissing(error.message)) return 0;
    throw error;
  }

  return count ?? 0;
}, 0);

if (!mounted) return;
setCounts({ enquiries, jobs, invoices, needsAction, followUp });
      } catch {
        // ignore
      }
    };

    load();

   const ch1 = supabase
  .channel("ff_counts_quote_requests")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "quote_requests" },
    () => load()
  )
  .subscribe();

const ch2 = supabase
  .channel("ff_counts_quotes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "quotes" },
    () => load()
  )
  .subscribe();

const ch3 = supabase
  .channel("ff_counts_invoices")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "invoices" },
    () => load()
  )
  .subscribe();

return () => {
  mounted = false;
  supabase.removeChannel(ch1);
  supabase.removeChannel(ch2);
  supabase.removeChannel(ch3);
};
  }, [router]);

  const traderName = useMemo(
    () => profile?.display_name?.trim() || "Your Business",
    [profile]
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] ff-dashboardText">
      <div className="mx-auto max-w-7xl px-4 sm:px-5 py-6 min-h-[calc(100vh-3rem)] flex flex-col">
        <div className="flex gap-6 flex-1 min-h-0">
          {/* DESKTOP SIDEBAR */}
          <aside className="hidden md:block w-72 shrink-0">
            <div className="relative rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,251,255,0.94))] shadow-[0_24px_60px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03),inset_0_1px_0_rgba(255,255,255,0.82)] overflow-hidden backdrop-blur-[10px]">
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(143,169,214,0.16), transparent 60%)",
                  }}
                />
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/70 to-transparent" />
              </div>

              <div className="relative p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-[18px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(220,232,250,0.40),rgba(255,255,255,0.95))] grid place-items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                        <span className="text-[15px] font-extrabold text-[var(--ff-navy)]">
                          FF
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold text-[var(--text-strong)] leading-tight">
                          FixFlow
                        </div>
                        <div className="text-[13px] text-[var(--text-muted)]">
                          Trader portal
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center gap-3">
                      <div className="h-11 w-11 rounded-[16px] border border-[var(--border)] bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
                        {profile?.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.logo_url}
                            alt={traderName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-base font-semibold text-[var(--ff-navy)]">
                            {traderName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold text-[var(--text-strong)] truncate">
                          {traderName}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    disabled={busy}
                    className="text-[12px] font-semibold rounded-[14px] border border-[var(--border)] px-3 py-2 bg-white hover:bg-[var(--surface-soft)] disabled:opacity-60 text-[var(--text-muted)] hover:text-[var(--ff-navy)] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] transition-all"
                  >
                    Logout
                  </button>
                </div>

                <nav className="mt-6 space-y-2">
                  <NavItem
                    pathname={pathname}
                    href="/dashboard"
                    label="Dashboard"
                    exact
                  />
                  <NavItem
                    pathname={pathname}
                    href="/dashboard/enquiries"
                    label="Enquiries"
                    badge={counts.enquiries}
                  />
<NavItem
  pathname={pathname}
  href="/dashboard/bookings"
  label="Jobs"
  badge={counts.jobs}
/>
                  <NavItem
                    pathname={pathname}
                    href="/dashboard/invoices"
                    label="Invoices"
                    badge={counts.invoices}
                  />
                </nav>

                <div className="mt-6 pt-5 border-t border-[var(--border)]">
                  <div className="px-2 pb-2 text-[12px] tracking-[0.14em] uppercase text-[var(--text-subtle)] font-semibold">
                    Settings
                  </div>

                  <nav className="space-y-2">
                    <NavItem
                      pathname={pathname}
                      href="/dashboard/profile"
                      label="Profile"
                    />
                  </nav>

                  <div className="mt-6 pt-5 border-t border-[var(--border)]">
                    <Link
                      href="/"
                      className="block text-[14px] font-semibold text-[var(--text-muted)] hover:text-[var(--ff-navy)] transition-colors"
                    >
                      ← Back to site
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <main className="flex-1 min-w-0 min-h-0 flex flex-col">
            {/* MOBILE TOP BAR */}
            <div className="block md:hidden">
              <div className="relative rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,251,255,0.94))] shadow-[0_24px_60px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03),inset_0_1px_0_rgba(255,255,255,0.82)] overflow-hidden backdrop-blur-[10px]">
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(143,169,214,0.14), transparent 60%)",
                    }}
                  />
                  <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/70 to-transparent" />
                </div>

                <div className="relative p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-[16px] border border-[var(--border)] bg-white overflow-hidden flex items-center justify-center shrink-0">
                        {profile?.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.logo_url}
                            alt={traderName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[14px] font-bold text-[var(--ff-navy)]">
                            {traderName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-[var(--text-strong)] leading-tight">
                          FixFlow
                        </div>
                        <div className="text-[12px] text-[var(--text-muted)] leading-tight">
                          Account
                        </div>
                        <div className="text-[14px] font-semibold text-[var(--text-strong)] truncate">
                          {traderName}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={logout}
                      disabled={busy}
                      className="text-[13px] font-semibold rounded-[16px] border border-[var(--border)] px-3.5 py-2.5 bg-white hover:bg-[var(--surface-soft)] disabled:opacity-60 text-[var(--text-muted)] hover:text-[var(--ff-navy)]"
                    >
                      Logout
                    </button>
                  </div>

                  <div className="mt-4 -mx-3 px-3 relative">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      <div className="flex w-max gap-2">
                        <MobilePill
                          pathname={pathname}
                          href="/dashboard"
                          label="Dashboard"
                          exact
                        />
                        <MobilePill
                          pathname={pathname}
                          href="/dashboard/enquiries"
                          label="Enquiries"
                          badge={counts.enquiries}
                        />
 <MobilePill
  pathname={pathname}
  href="/dashboard/bookings"
  label="Jobs"
  badge={counts.jobs}
/>
                        <MobilePill
                          pathname={pathname}
                          href="/dashboard/invoices"
                          label="Invoices"
                          badge={counts.invoices}
                        />
                        <MobilePill
                          pathname={pathname}
                          href="/dashboard/profile"
                          label="Profile"
                        />
                      </div>
                    </div>

                    <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent" />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={[
                "rounded-[32px] border border-slate-200",
                "bg-white",
                "shadow-[0_30px_70px_rgba(15,23,42,0.08),0_3px_12px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.8)]",
                "backdrop-blur-[10px]",
                "min-h-0 flex-1 flex flex-col overflow-hidden",
                isFullBleed ? "p-0" : "p-4 sm:p-6",
              ].join(" ")}
            >
              {isFullBleed ? (
                <div className="flex-1 flex flex-col min-h-full">{children}</div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  if (pathname.startsWith(href + "/")) return true;
  if (pathname.startsWith(href)) return true;
  return false;
}

function badgeClasses(active: boolean) {
  return active
    ? "bg-white/65 text-[var(--ff-navy)]"
    : "bg-transparent text-[var(--text-muted)]";
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
  const badgeClass = badgeClasses(active);

  return (
    <Link
      href={href}
      className={[
        "group relative flex items-center justify-between gap-3 rounded-[16px] px-3.5 py-3 transition-all duration-200",
        "text-[15px] font-semibold",
        active
          ? "bg-[linear-gradient(135deg,rgba(220,232,250,0.95),rgba(248,251,255,1))] text-[var(--ff-navy)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ff-navy)]",
      ].join(" ")}
    >
      {/* LEFT ACCENT */}
      {active && (
        <span className="absolute left-2 top-3 bottom-3 w-[4px] rounded-full bg-[rgba(143,169,214,0.9)]" />
      )}

      <span className={`relative z-10 truncate ${active ? "pl-2" : ""}`}>
        {label}
      </span>

      {typeof badge === "number" && (
        <span
          className={[
            "relative z-10 text-[12px] px-2 py-0.5 rounded-full font-semibold",
            badgeClass,
          ].join(" ")}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function MobilePill({
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
  const pillBadge = badgeClasses(active);

  return (
    <Link
      href={href}
      className={[
        "relative whitespace-nowrap rounded-[18px] px-4 py-2.5 transition-all duration-200",
        "text-[13px] font-semibold",
        active
          ? "bg-[linear-gradient(135deg,rgba(220,232,250,0.95),rgba(248,251,255,1))] text-[var(--ff-navy)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
          : "bg-white text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ff-navy)]",
      ].join(" ")}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {label}
        {typeof badge === "number" && (
          <span
            className={[
              "text-[12px] px-2 py-0.5 rounded-full font-semibold",
              pillBadge,
            ].join(" ")}
          >
            {badge}
          </span>
        )}
      </span>
    </Link>
  );
}