// app/dashboard/layout.tsx
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

  // ✅ Full-bleed pages (no inner padding, but KEEP the white frame)
  const isFullBleed =
    pathname.startsWith("/dashboard/enquiries") ||
    pathname.startsWith("/dashboard/estimates") ||
    pathname.startsWith("/dashboard/bookings"); // ✅ added

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

        const { data: p } = await supabase
          .from("profiles")
          .select("id, display_name, logo_url")
          .eq("id", user.id)
          .maybeSingle();

        if (mounted) setProfile((p || null) as ProfileLite | null);

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
      supabase.removeChannel(ch4);
    };
  }, [router]);

  const traderName = useMemo(() => profile?.display_name?.trim() || "Your Business", [profile]);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] ff-dashboardText">
      {/* ✅ give the inner dashboard a real height (py-6 = 3rem total) */}
      <div className="mx-auto max-w-7xl px-4 py-6 h-[calc(100vh-3rem)] flex flex-col min-h-0">
  <div className="flex gap-6 flex-1 min-h-0">
          {/* SIDEBAR (DESKTOP) */}
          <aside className="hidden md:block w-72 shrink-0">
            <div className="relative rounded-2xl border border-slate-200/70 bg-white shadow-[0_10px_22px_rgba(15,23,42,0.02),0_10px_22px_rgba(15,23,42,0.06)] overflow-hidden">
              {/* Glow layer */}
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
                  style={{
                    background: "radial-gradient(circle, rgba(31,111,255,0.18), transparent 60%)",
                  }}
                />
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/70 to-transparent" />
              </div>

              <div className="relative p-5">
                {/* Brand row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-blue-50 to-white grid place-items-center">
                        <span className="text-[15px] font-bold text-blue-600">FF</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold text-slate-900 leading-tight">FixFlow</div>
                        <div className="text-[13px] text-slate-600">Trader portal</div>
                      </div>
                    </div>

                    {/* Trader identity */}
                    <div className="mt-5 flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                        {profile?.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.logo_url} alt={traderName} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-base font-semibold text-slate-700">
                            {traderName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold text-slate-900 truncate">{traderName}</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    disabled={busy}
                    className="text-[12px] font-medium rounded-xl border border-slate-200 px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-600 hover:text-slate-900"
                  >
                    Logout
                  </button>
                </div>

                {/* Main nav */}
                <nav className="space-y-2">
                  <NavItem pathname={pathname} href="/dashboard" label="Dashboard" exact />
                  <NavItem pathname={pathname} href="/dashboard/enquiries" label="Enquiries" badge={counts.enquiries} tone="neutral" />
                  <NavItem pathname={pathname} href="/dashboard/estimates" label="Estimates" badge={counts.quotes} />
                  <NavItem pathname={pathname} href="/dashboard/bookings" label="Bookings" badge={counts.bookings} />
                  <NavItem pathname={pathname} href="/dashboard/invoices" label="Invoices" badge={counts.invoices} />
                </nav>

                {/* SETTINGS */}
                <div className="mt-6 pt-5 border-t border-slate-200/70">
                  <div className="px-2 pb-2 text-[12px] tracking-[0.14em] uppercase text-slate-500 font-semibold">
                    Settings
                  </div>

                  <nav className="space-y-2">
                    <NavItem pathname={pathname} href="/dashboard/locations" label="Locations" />
                    <NavItem pathname={pathname} href="/dashboard/services" label="Services" />
                    <NavItem pathname={pathname} href="/dashboard/trades" label="Trades" />
                    <NavItem pathname={pathname} href="/dashboard/profile" label="Profile" />
                  </nav>

                  <div className="mt-6 pt-5 border-t border-slate-200/70">
                    <Link href="/" className="block text-[14px] font-semibold text-slate-600 hover:text-slate-900">
                      ← Back to site
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN */}
          {/* ✅ make main a flex column that can shrink */}
         <main className="flex-1 min-w-0 min-h-0 flex flex-col">
            {/* MOBILE TOP BAR (MATCHES DESKTOP STYLE) */}
            <div className="block md:hidden">
              <div className="relative rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.02),0_10px_22px_rgba(15,23,42,0.06)] overflow-hidden">
                {/* Glow */}
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl"
                    style={{
                      background: "radial-gradient(circle, rgba(31,111,255,0.14), transparent 60%)",
                    }}
                  />
                  <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/70 to-transparent" />
                </div>

                <div className="relative p-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl border border-slate-200/70 bg-white overflow-hidden flex items-center justify-center shrink-0">
                        {profile?.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.logo_url} alt={traderName} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[14px] font-bold text-blue-600">
                            {traderName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-slate-900 leading-tight">FixFlow</div>
                        <div className="text-[12px] text-slate-600 leading-tight">Account</div>
                        <div className="text-[14px] font-semibold text-slate-900 truncate">{traderName}</div>
                      </div>
                    </div>

                    <button
                      onClick={logout}
                      disabled={busy}
                      className="text-[13px] font-semibold rounded-2xl border border-slate-200/70 px-3.5 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700"
                    >
                      Logout
                    </button>
                  </div>

                  {/* One-line scroll tabs */}
                  <div className="mt-4 -mx-3 px-3 relative">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      <div className="flex w-max gap-2">
                        <MobilePill pathname={pathname} href="/dashboard" label="Dashboard" exact />
                        <MobilePill pathname={pathname} href="/dashboard/enquiries" label="Enquiries" badge={counts.enquiries} tone="neutral" />
                        <MobilePill pathname={pathname} href="/dashboard/estimates" label="Estimates" badge={counts.quotes} />
                        <MobilePill pathname={pathname} href="/dashboard/bookings" label="Bookings" badge={counts.bookings} />
                        <MobilePill pathname={pathname} href="/dashboard/invoices" label="Invoices" badge={counts.invoices} />

                        <MobilePill pathname={pathname} href="/dashboard/locations" label="Locations" />
                        <MobilePill pathname={pathname} href="/dashboard/services" label="Services" />
                        <MobilePill pathname={pathname} href="/dashboard/trades" label="Trades" />
                        <MobilePill pathname={pathname} href="/dashboard/profile" label="Profile" />

                        <Link
                          href="/"
                          className={[
                            "whitespace-nowrap rounded-2xl px-4 py-2.5 border transition-all duration-200 font-semibold text-[13px]",
                            "border-slate-200 text-slate-700 bg-white hover:bg-slate-50",
                          ].join(" ")}
                        >
                          ← Back
                        </Link>
                      </div>
                    </div>

                    {/* Fade edge */}
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent" />
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ PAGE CONTENT frame must fill remaining height and allow shrink */}
   <div
  className={[
    "rounded-2xl bg-white border border-slate-200/70",
    "shadow-[0_1px_0_rgba(15,23,42,0.02),0_10px_22px_rgba(15,23,42,0.06)]",
    "min-h-0 flex-1 flex flex-col",
    isFullBleed ? "p-0 overflow-hidden" : "p-4 sm:p-6",
  ].join(" ")}
>
  {isFullBleed ? (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
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

/* ---------------- Helpers ---------------- */

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  if (pathname.startsWith(href + "/")) return true;
  if (pathname.startsWith(href)) return true;
  return false;
}

function badgeClasses(active: boolean) {
  return active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-700";
}

function NavItem({
  pathname,
  href,
  label,
  badge,
  exact,
  tone = "neutral",
}: {
  pathname: string;
  href: string;
  label: string;
  badge?: number;
  exact?: boolean;
  tone?: "neutral" | "danger";
}) {
  const active = isActive(pathname, href, exact);
  const badgeClass = badgeClasses(active);

  return (
    <Link
      href={href}
      className={[
        "group relative flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 transition-all duration-200",
        "text-[15px] font-semibold",
        active
          ? "bg-blue-50/60 text-slate-900 shadow-[0_10px_25px_rgba(31,111,255,0.18)]"
          : "text-slate-700 hover:bg-slate-50 hover:shadow-[0_8px_18px_rgba(31,111,255,0.10)]",
      ].join(" ")}
    >
      {active && (
        <span
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: "radial-gradient(circle at left center, rgba(31,111,255,0.25), transparent 70%)" }}
        />
      )}

      {active && <span className="absolute left-2 top-3 bottom-3 w-[4px] rounded-full bg-blue-600" />}
      {active && <span className="absolute left-3 right-3 bottom-2 h-px bg-slate-200/70" />}
      {active && <span className="absolute left-3 right-3 bottom-2 h-[6px] blur-sm bg-blue-200/20" />}

      <span className={`relative z-10 truncate ${active ? "pl-2" : ""}`}>{label}</span>

      {typeof badge === "number" && (
        <span className={`relative z-10 text-[12px] px-2.5 py-0.5 rounded-full border ${badgeClass}`}>{badge}</span>
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
  tone = "neutral",
}: {
  pathname: string;
  href: string;
  label: string;
  badge?: number;
  exact?: boolean;
  tone?: "neutral" | "danger";
}) {
  const active = isActive(pathname, href, exact);
  const pillBadge = badgeClasses(active);

  return (
    <Link
      href={href}
      className={[
        "relative whitespace-nowrap rounded-2xl border px-4 py-2.5 transition-all duration-200",
        "text-[13px] font-semibold",
        active
          ? "bg-blue-50/60 border-blue-200 text-slate-900 shadow-[0_10px_25px_rgba(31,111,255,0.18)]"
          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-[0_8px_18px_rgba(31,111,255,0.10)]",
      ].join(" ")}
    >
      {active && (
        <span
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: "radial-gradient(circle at left center, rgba(31,111,255,0.22), transparent 70%)" }}
        />
      )}

      <span className="relative z-10 inline-flex items-center gap-2">
        {label}
        {typeof badge === "number" && (
          <span className={["text-[12px] px-2 py-0.5 rounded-full border font-semibold", pillBadge].join(" ")}>
            {badge}
          </span>
        )}
      </span>
    </Link>
  );
}