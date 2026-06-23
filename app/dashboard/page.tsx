"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getEnquiryCounts } from "@/lib/enquiryCounts";
import { getJobCounts } from "@/lib/jobCounts";

type ProfileLite = {
  id: string;
  display_name: string | null;
  business_name?: string | null;
  slug?: string | null;
  logo_url: string | null;
};

type RecentActivity = {
  id: string;
  label: string;
  detail: string;
  href: string;
  created_at: string;
};

type QuoteRequestLite = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  job_type: string | null;
  stage: string | null;
  status: string | null;
  job_booked_at: string | null;
  read_at: string | null;
  snoozed_until: string | null;
  created_at: string;
};

type CertificateReminder = {
  id: string;
  name: string;
  certificate_number: string | null;
  expiry_date: string | null;
};

type Stats = {
  enquiriesUnread: number;
  enquiriesOpen: number;
  needsAction: number;
  followUp: number;
  wonJobs: number;
  invoices: number;
};
function getCertificateWarning(expiryDate?: string | null) {
  if (!expiryDate) return null;

  const expiry = new Date(expiryDate);
  const today = new Date();

  const diffDays = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`;
  }

  if (diffDays <= 14) return `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  if (diffDays <= 30) return "Expires within 1 month";
  if (diffDays <= 60) return "Expires within 2 months";

  return null;
}
export default function DashboardPage() {
  const [profile, setProfile] = useState<ProfileLite | null>(null);
const [stats, setStats] = useState<Stats>({
  enquiriesUnread: 0,
  enquiriesOpen: 0,
  needsAction: 0,
  followUp: 0,
  wonJobs: 0,
  invoices: 0,
});
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [revenueThisMonth, setRevenueThisMonth] = useState("£0");
  const [certificateReminders, setCertificateReminders] = useState<CertificateReminder[]>([]);
const [showPwaBanner, setShowPwaBanner] = useState(false);
const hasNeedsAction = stats.needsAction > 0;

const hasFollowUp = stats.followUp > 0;

const primaryAction = hasNeedsAction
  ? "needs_action"
  : hasFollowUp
  ? "follow_up"
  : "jobs";

const headerMessage = loading
  ? "Checking your business…"
  : primaryAction === "needs_action"
  ? stats.needsAction === 1
    ? "1 enquiry needs your attention"
    : `${stats.needsAction} enquiries need your attention`
  : primaryAction === "follow_up"
  ? stats.followUp === 1
    ? "1 enquiry needs a follow-up"
    : `${stats.followUp} enquiries need a follow-up`
  : stats.wonJobs > 0
  ? stats.wonJobs === 1
    ? "You’ve got 1 job in progress"
    : `You’ve got ${stats.wonJobs} jobs in progress`
  : "Quiet day — everything is under control";

const focusChipLabel = loading
  ? "…"
  : primaryAction === "needs_action"
  ? `${stats.needsAction} need action`
  : primaryAction === "follow_up"
  ? `${stats.followUp} follow up`
  : stats.wonJobs > 0
  ? `${stats.wonJobs} to progress`
  : "All clear";

const heroToneClass = loading
  ? ""
  : primaryAction === "needs_action"
  ? "ffdash-heroUrgent"
  : primaryAction === "follow_up"
  ? "ffdash-heroWarm"
  : stats.wonJobs > 0
  ? "ffdash-heroProgress"
  : "ffdash-heroClear";

  const toast = (msg: string) => {
    const el = document.getElementById("ffdash-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("ffdash-toastShow");
    window.setTimeout(() => el.classList.remove("ffdash-toastShow"), 1400);
  };

  useEffect(() => {
    let mounted = true;

    const dismissed = localStorage.getItem("ff-pwa-banner-dismissed");

if (!dismissed) {
  setShowPwaBanner(true);
}

    const isMissing = (msg?: string) => {
      const m = (msg || "").toLowerCase();
      return (
        m.includes("does not exist") ||
        m.includes("relation") ||
        m.includes("schema cache")
      );
    };

    const safeCount = async (fn: () => Promise<number>) => {
      try {
        return await fn();
      } catch {
        return 0;
      }
    };

    const safeLoad = async <T,>(fn: () => Promise<T>, fallback: T) => {
      try {
        return await fn();
      } catch {
        return fallback;
      }
    };

    const load = async () => {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) setLoading(false);
          return;
        }

        const { data: p } = await supabase
          .from("profiles")
          .select("id, display_name, business_name, slug, logo_url")
          .eq("id", user.id)
          .maybeSingle();

        const allRequests = await safeLoad<QuoteRequestLite[]>(async () => {
          const { data, error } = await supabase
            .from("quote_requests")
.select("id, customer_name, customer_email, job_type, stage, status, job_booked_at, read_at, snoozed_until, created_at")
.eq("plumber_id", user.id);

          if (error) {
            if (isMissing(error.message)) return [];
            throw error;
          }

          return (data || []) as QuoteRequestLite[];
        }, []);

const quoteRows = await safeLoad(async () => {
  const requestIds = allRequests.map((r) => r.id);
  if (!requestIds.length) return [];

  const { data } = await supabase
    .from("quotes")
    .select("request_id, status")
    .eq("plumber_id", user.id)
    .in("request_id", requestIds);

  return data ?? [];
}, []);

const quoteMap = Object.fromEntries(
  quoteRows.map((row: any) => [
    row.request_id,
    {
      request_id: row.request_id || null,
      status: row.status || null,
    },
  ])
);

const requestMap = Object.fromEntries(
  allRequests.map((r) => [
    r.id,
    {
      customerName:
        r.customer_name?.trim() ||
        r.customer_email?.trim() ||
        "Customer",
      jobType: r.job_type?.trim() || "job",
    },
  ])
);

const { jobs } = getJobCounts({
  requests: allRequests,
  quoteMap,
});

const estimateRows = await safeLoad(async () => {
  const { data } = await supabase
    .from("estimates")
    .select("request_id, status, created_at")
    .eq("plumber_id", user.id);

  return data ?? [];
}, []);

const visitRows = await safeLoad(async () => {
  const { data } = await supabase
    .from("site_visits")
    .select("request_id, starts_at")
    .eq("plumber_id", user.id);

  return data ?? [];
}, []);

const messageRows = await safeLoad(async () => {
  const requestIds = allRequests.map((r) => r.id);
  if (!requestIds.length) return [];

  const { data } = await supabase
    .from("enquiry_messages")
    .select("request_id, direction, created_at")
    .eq("plumber_id", user.id)
    .in("request_id", requestIds)
    .order("created_at", { ascending: true });

  return data ?? [];
}, []);

const estimateMap = Object.fromEntries(
  estimateRows.map((row: any) => [
    row.request_id,
    {
      status: row.status || null,
      created_at: row.created_at || null,
    },
  ])
);

const visitMap = Object.fromEntries(
  visitRows.map((row: any) => [
    row.request_id,
    {
      starts_at: row.starts_at,
    },
  ])
);

const threadMap = messageRows.reduce(
  (acc: Record<string, { direction: string | null; created_at: string }[]>, row: any) => {
    if (!row.request_id) return acc;
    if (!acc[row.request_id]) acc[row.request_id] = [];
    acc[row.request_id].push({
      direction: row.direction || null,
      created_at: row.created_at,
    });
    return acc;
  },
  {}
);

const {
  enquiriesOpen,
  enquiriesUnread,
  needsAction,
  followUp,
} = getEnquiryCounts({
  rows: allRequests,
  estimateMap,
  visitMap,
  threadMap,
});


const certRows = await safeLoad<CertificateReminder[]>(async () => {
  const { data, error } = await supabase
    .from("trader_certificates")
    .select("id, name, certificate_number, expiry_date")
    .eq("trader_id", user.id)
    .not("expiry_date", "is", null)
    .order("expiry_date", { ascending: true });

  if (error) {
    if (isMissing(error.message)) return [];
    throw error;
  }

  return (data || []) as CertificateReminder[];
}, []);

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

const invoiceRows = await safeLoad(async () => {
  const { data } = await supabase
    .from("invoices")
   .select("id, invoice_number, status, created_at, request_id, amount")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return data ?? [];
}, []);

const twoWeeksAgo = new Date();
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

const activity: RecentActivity[] = [
  ...allRequests.map((r) => ({
    id: `enquiry-${r.id}`,
    label: `New enquiry from ${requestMap[r.id]?.customerName || "Customer"}`,
    detail: `${requestMap[r.id]?.jobType || "Job"} enquiry received`,
    href: `/dashboard/enquiries?id=${r.id}`,
    created_at: r.created_at,
  })),

  ...messageRows.map((m: any) => {
    const customer = requestMap[m.request_id]?.customerName || "Customer";
    const jobType = requestMap[m.request_id]?.jobType || "job";

    return {
      id: `message-${m.request_id}-${m.created_at}`,
      label:
        m.direction === "outbound"
          ? `Message sent to ${customer}`
          : `${customer} replied`,
      detail:
        m.direction === "outbound"
          ? `Reply sent about ${jobType}`
          : `New customer message about ${jobType}`,
      href: `/dashboard/enquiries?id=${m.request_id}`,
      created_at: m.created_at,
    };
  }),

  ...estimateRows.map((e: any) => {
    const customer = requestMap[e.request_id]?.customerName || "Customer";
    const jobType = requestMap[e.request_id]?.jobType || "job";

    return {
      id: `estimate-${e.request_id}-${e.created_at}`,
      label: `Estimate created for ${customer}`,
      detail: `${jobType} estimate${e.status ? ` • ${e.status}` : ""}`,
      href: `/dashboard/enquiries?id=${e.request_id}`,
      created_at: e.created_at,
    };
  }),

  ...visitRows.map((v: any) => {
    const customer = requestMap[v.request_id]?.customerName || "Customer";
    const jobType = requestMap[v.request_id]?.jobType || "job";

    return {
      id: `visit-${v.request_id}-${v.starts_at}`,
      label: `Site visit booked with ${customer}`,
      detail: `${jobType} • ${new Date(v.starts_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      href: `/dashboard/enquiries?id=${v.request_id}`,
      created_at: v.starts_at,
    };
  }),

  ...invoiceRows.map((inv: any) => {
    const customer = requestMap[inv.request_id]?.customerName || "Customer";

    return {
      id: `invoice-${inv.id}`,
      label: `Invoice created for ${customer}`,
      detail: inv.invoice_number
        ? `${inv.invoice_number}`
        : "Invoice created",
      href: "/dashboard/invoices",
      created_at: inv.created_at,
    };
  }),
]
 .filter(
  (item) =>
    item.created_at &&
    new Date(item.created_at) >= twoWeeksAgo
)
  .sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  .slice(0, 8);

  const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const monthInvoiceRows = await safeLoad(async () => {
  const { data } = await supabase
    .from("invoices")
    .select("amount, created_at")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth.toISOString());

  return data ?? [];
}, []);

const monthTotal = monthInvoiceRows.reduce(
  (sum: number, inv: any) => sum + Number(inv.amount || 0),
  0
);

const monthTotalText = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
}).format(monthTotal);

        if (!mounted) return;

        setProfile((p as ProfileLite) || null);
        setCertificateReminders(
  certRows.filter((c) => getCertificateWarning(c.expiry_date))
);
setRecentActivity(activity);

setRevenueThisMonth(monthTotalText);

setStats({
  enquiriesUnread,
  enquiriesOpen,
  needsAction,
  followUp,
  wonJobs: jobs,
  invoices,
});
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();



    const ch1 = supabase
      .channel("ff_dashboard_quote_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quote_requests" },
        load
      )
      .subscribe();

    const ch2 = supabase
      .channel("ff_dashboard_invoices")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        load
      )
      .subscribe();

      const ch3 = supabase
  .channel("ff_dashboard_estimates")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "estimates" },
    load
  )
  .subscribe();

const ch4 = supabase
  .channel("ff_dashboard_site_visits")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "site_visits" },
    load
  )
  .subscribe();

const ch5 = supabase
  .channel("ff_dashboard_enquiry_messages")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "enquiry_messages" },
    load
  )
  .subscribe();

  const ch6 = supabase
  .channel("ff_dashboard_quotes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "quotes" },
    load
  )
  .subscribe();


return () => {
  mounted = false;
  supabase.removeChannel(ch1);
  supabase.removeChannel(ch2);
  supabase.removeChannel(ch3);
  supabase.removeChannel(ch4);
  supabase.removeChannel(ch5);
  supabase.removeChannel(ch6);
};
  }, []);

  const traderSlug = useMemo(() => {
    return profile?.slug?.trim() || "your-link";
  }, [profile]);

const traderLink = useMemo(() => {
  return `https://thefixflowapp.com/p/${traderSlug}/quote`;
}, [traderSlug]);

  const traderName = useMemo(() => {
    return (
      profile?.business_name?.trim() ||
      profile?.display_name?.trim() ||
      "Your Business"
    );
  }, [profile]);
const dismissPwaBanner = () => {
  localStorage.setItem("ff-pwa-banner-dismissed", "true");
  setShowPwaBanner(false);
};

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(traderLink);
      toast("Link copied");
    } catch {
      toast("Couldn’t copy link");
    }
  };

  const openTraderPage = () =>
    window.open(traderLink, "_blank", "noopener,noreferrer");

  const downloadQR = () => {
    const svg = document.querySelector(
      "#ffdash-qr-wrap svg"
    ) as SVGElement | null;
    if (!svg) return toast("QR not ready");

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
   a.download = `${traderName.replace(/\s+/g, "-").toLowerCase()}-quote-qr.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    toast("QR downloaded");
  };


const lastActivity =
  recentActivity[0]?.created_at
    ? new Date(recentActivity[0].created_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No activity yet";
const lastLogin = "—";

  return (
    <div className="ffdash-page">
      <div className="ffdash-wrap">
        <header className={`ffdash-hero ${heroToneClass}`}>
          <div className="ffdash-heroGlow" />
          <div className="ffdash-heroRow">
            <div>
              <h1 className="ffdash-heroTitle">Dashboard</h1>
              <p className="ffdash-heroSub">
  Welcome back, {traderName} — {headerMessage}.
</p>
              <p className="ffdash-heroTip">
  Tip: keep <b>Needs action</b> at <b>0</b> to stay fully in control.
</p>
            </div>
          </div>
        </header>
        {showPwaBanner && (
  <section className="ffdash-card ffdash-cardPad" style={{ marginBottom: "16px" }}>
    <div className="ffdash-sectionTop">
      <div>
        <div className="ffdash-eyebrow">FIXFLOW APP</div>
        <div className="ffdash-cardTitle">
          Add FixFlow to your phone
        </div>
      </div>

      <button
        onClick={dismissPwaBanner}
        className="ffdash-btn"
      >
        Got it
      </button>
    </div>

    <div className="ffdash-muted">
      FixFlow works like an app on iPhone and Android. Add it to your home screen
      for instant access to enquiries, jobs, invoices and customer messages.
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: "12px",
        marginTop: "14px",
      }}
    >
      <div className="ffdash-linkBox">
        <strong>iPhone</strong>
        <br />
        Safari → Share → Add to Home Screen
      </div>

      <div className="ffdash-linkBox">
        <strong>Android</strong>
        <br />
        Chrome → Menu → Install App
      </div>
    </div>
  </section>
)}
{!loading &&
  stats.enquiriesOpen === 0 &&
  stats.wonJobs === 0 &&
  stats.invoices === 0 && (

<section className="ffdash-card ffdash-cardPad ffdash-setupCard">

  {/* HEADER */}
  <div className="ffdash-setupHeader">
    <div>
      <div className="ffdash-eyebrow">GET STARTED</div>
      <div className="ffdash-setupTitle">3 steps to your first job</div>
      <div className="ffdash-muted">Takes about 2 minutes.</div>
    </div>
    <div className="ffdash-setupProgress">
      <div className="ffdash-setupProgressBar">
        <div
          className="ffdash-setupProgressFill"
          style={{
            width: `${
              [
                true, // link is always step 1, never ticked
                !!profile?.business_name,
                stats.enquiriesOpen > 0,
              ].filter(Boolean).length === 1
                ? 33
                : [
                    !!profile?.business_name,
                    stats.enquiriesOpen > 0,
                  ].filter(Boolean).length === 2
                ? 100
                : [
                    !!profile?.business_name,
                    stats.enquiriesOpen > 0,
                  ].filter(Boolean).length === 1
                ? 66
                : 0
            }%`,
          }}
        />
      </div>
      <div className="ffdash-setupProgressLabel">
        {[!!profile?.business_name, stats.enquiriesOpen > 0].filter(Boolean).length} of 2 done
      </div>
    </div>
  </div>

  {/* STEP 1 — COPY LINK (always first, always prominent) */}
  <div className="ffdash-setupHero">
<div className="ffdash-setupHeroLeft">
  <div className="ffdash-setupStepNum">1</div>
 <div className="ffdash-setupHeroContent">

        <div className="ffdash-setupStepTitle">Copy your enquiry link</div>
        <div className="ffdash-setupStepSub">
          Share this link on WhatsApp, Facebook, Google or your website.
        </div>
<div className="ffdash-setupLinkPreview" title={traderLink}>
  <span>{traderLink}</span>
</div>
      </div>
    </div>
    <button
      type="button"
      className="ffdash-setupHeroBtn"
      onClick={copyLink}
    >
      Copy link
    </button>
  </div>

  {/* STEPS 2 + 3 */}
  <div className="ffdash-setupSteps">

    {/* STEP 2 — PROFILE */}
    <a href="/dashboard/profile" className="ffdash-setupStep">
      <div className={`ffdash-setupTick ${profile?.business_name ? "ffdash-setupTickDone" : ""}`}>
        {profile?.business_name ? "✓" : "2"}
      </div>
      <div className="ffdash-setupStepBody">
        <div className="ffdash-setupStepTitle">
          {profile?.business_name ? "Profile set up ✓" : "Set up your profile"}
        </div>
        <div className="ffdash-setupStepSub">
          {profile?.business_name
            ? "Business name and details saved."
            : "Add your business name, trade type and contact details."}
        </div>
      </div>
      {!profile?.business_name && (
        <div className="ffdash-setupStepArrow">→</div>
      )}
    </a>

    {/* STEP 3 — FIRST ENQUIRY */}
    <a href="/dashboard/enquiries" className="ffdash-setupStep">
      <div className={`ffdash-setupTick ${stats.enquiriesOpen > 0 ? "ffdash-setupTickDone" : ""}`}>
        {stats.enquiriesOpen > 0 ? "✓" : "3"}
      </div>
      <div className="ffdash-setupStepBody">
        <div className="ffdash-setupStepTitle">
          {stats.enquiriesOpen > 0 ? "First enquiry in ✓" : "Get your first enquiry"}
        </div>
        <div className="ffdash-setupStepSub">
          {stats.enquiriesOpen > 0
            ? "You're live. Keep the momentum going."
            : "Share your link or add a manual enquiry to get started."}
        </div>
      </div>
      {stats.enquiriesOpen === 0 && (
        <div className="ffdash-setupStepArrow">→</div>
      )}
    </a>

  </div>

</section>
)}

        <section className="ffdash-card ffdash-cardPad ffdash-aiPanel">
          <div className="ffdash-sectionTop">
            <div>
              <div className="ffdash-eyebrow">TODAY’S FOCUS</div>
              <div className="ffdash-muted">
                FixFlow highlights what needs your attention right now.
              </div>
            </div>
            <span className="ffdash-chip">{focusChipLabel}</span>
          </div>

         <div
  className={`ffdash-aiGrid ${
    !loading &&
    stats.enquiriesOpen === 0 &&
    stats.wonJobs === 0 &&
    stats.invoices === 0
      ? "ffdash-aiGridMuted"
      : ""
  }`}
>
            <Link
              href="/dashboard/enquiries"
  className={`ffdash-aiCard ${
  primaryAction === "needs_action" ? "ffdash-aiCardPrimary" : ""
} ${hasNeedsAction ? "ffdash-aiCardUrgent" : ""}`}
            >
              <div className="ffdash-aiLine" />
              <div className="ffdash-aiCardInner">
                <div className="ffdash-aiIconWrap">
                  <div className="ffdash-aiIcon">!</div>
                </div>

                <div className="ffdash-aiContent">
                  <div className="ffdash-aiTitle">
  {hasNeedsAction ? "Enquiries need attention" : "All caught up"}
</div>
<div className="ffdash-aiText">
  {hasNeedsAction
  ? `${stats.needsAction} enquir${
      stats.needsAction === 1 ? "y needs" : "ies need"
    } attention right now.`
  : "No enquiries need attention."}
</div>
<div className="ffdash-aiAction">
  {hasNeedsAction ? "Open enquiries" : "View enquiries"}
</div>
                </div>
              </div>
            </Link>

<Link
  href="/dashboard/enquiries?tab=followUp"
  className={`ffdash-aiCard ${
    primaryAction === "follow_up" ? "ffdash-aiCardPrimary" : ""
  }`}
>
  <div className="ffdash-aiLine" />
  <div className="ffdash-aiCardInner">
    <div className="ffdash-aiIconWrap ffdash-aiIconBlue">
      <div className="ffdash-aiIcon">↺</div>
    </div>

    <div className="ffdash-aiContent">
      <div className="ffdash-aiTitle">
        {stats.followUp > 0
          ? "Follow-ups due"
          : "No follow-ups due"}
      </div>
      <div className="ffdash-aiText">
        {loading
          ? "Checking pipeline…"
          : stats.followUp > 0
          ? `${stats.followUp} enquir${
              stats.followUp === 1 ? "y needs" : "ies need"
            } a follow-up.`
          : "No enquiries need a follow-up right now."}
      </div>
      <div className="ffdash-aiAction">
        {stats.followUp > 0 ? "Open follow-ups" : "Review enquiries"}
      </div>
    </div>
  </div>
</Link>

           <Link
  href="/dashboard/bookings"
  className={`ffdash-aiCard ${
    primaryAction === "jobs" ? "ffdash-aiCardPrimary" : ""
  }`}
>
  <div className="ffdash-aiLine" />
  <div className="ffdash-aiCardInner">
    <div className="ffdash-aiIconWrap ffdash-aiIconGreen">
      <div className="ffdash-aiIcon">£</div>
    </div>

<div className="ffdash-aiContent">
  <div className="ffdash-aiTitle">
    {stats.wonJobs > 0 ? "Won jobs need progress" : "No won jobs yet"}
  </div>
  <div className="ffdash-aiText">
    {loading
      ? "Checking jobs…"
      : stats.wonJobs > 0
      ? `${stats.wonJobs} won job${stats.wonJobs === 1 ? " is" : "s are"} ready for the next step.`
      : "As jobs are won, they’ll show here for follow-up."}
  </div>
  <div className="ffdash-aiAction">
    {stats.wonJobs > 0 ? "Open jobs" : "View bookings"}
  </div>
</div>
  </div>
</Link>
          </div>
        </section>

{certificateReminders.length > 0 && (
  <section className="ffdash-card ffdash-cardPad ffdash-certPanel">
    <div className="ffdash-sectionTop">
      <div>
        <div className="ffdash-eyebrow">CERTIFICATE REMINDERS</div>
        <div className="ffdash-muted">
          Keep trust badges valid on estimates and invoices.
        </div>
      </div>

      <span className="ffdash-chip">
        {certificateReminders.length} warning
        {certificateReminders.length === 1 ? "" : "s"}
      </span>
    </div>

    <div className="ffdash-certList">
      {certificateReminders.map((c) => (
        <Link
          key={c.id}
          href="/dashboard/profile"
          className="ffdash-certReminder"
        >
          <div>
            <strong>{c.name}</strong>
            <div className="ffdash-mutedSmall">
              {c.certificate_number ? `No. ${c.certificate_number} • ` : ""}
              {c.expiry_date}
            </div>
          </div>

          <span>{getCertificateWarning(c.expiry_date)}</span>
        </Link>
      ))}
    </div>
  </section>
)}

        <section className="ffdash-card ffdash-cardPad">
          <div className="ffdash-sectionTop">
            <div>
              <div className="ffdash-eyebrow">TRADER LINK + QR</div>
              <div className="ffdash-muted">
                Put this on Google, your website, vans and cards.
              </div>
            </div>
          <span className="ffdash-chip">Quote form</span>
          </div>

          <div className="ffdash-linkRow">
            <div className="ffdash-linkBox" title={traderLink}>
              {traderLink}
            </div>

            <div className="ffdash-qrFrame">
              <div
                id="ffdash-qr-wrap"
                className="ffdash-qrSvgWrap"
                aria-label="QR code"
              >
                <QRCodeSVG value={traderLink} size={96} />
              </div>
              <div className="ffdash-qrLabel">Scan</div>
            </div>
          </div>

          <div className="ffdash-actions">
            <button className="ffdash-btn ffdash-btnSoft" onClick={copyLink}>
              Copy link
            </button>
            <button className="ffdash-btn" onClick={openTraderPage}>
              Open quote form
            </button>
            <button className="ffdash-btn" onClick={downloadQR}>
              Download QR
            </button>
          </div>
        </section>

        <section className="ffdash-statGrid">
          <Link
  href="/dashboard/enquiries"
  className={`ffdash-statCard ${
    hasNeedsAction ? "ffdash-statCardAlert" : ""
  }`}
>
            <div className="ffdash-statLine" />
            <div className="ffdash-statInner">
              <div className="ffdash-statTop">
                <div className="ffdash-statTitle">Needs action</div>
 <span
  className={`ffdash-pill ${
    hasNeedsAction ? "ffdash-pillAlert" : "ffdash-pillNeutral"
  }`}
>
  Attention
</span>
              </div>

              <div
                className={`ffdash-statNumber ${
  hasNeedsAction ? "ffdash-statNumberAlert" : ""
}`}
              >
                {loading ? "…" : stats.needsAction}
              </div>

              <div className="ffdash-statSub">
                Open enquiries: {loading ? "…" : stats.enquiriesOpen} •{" "}
                {hasNeedsAction ? "Needs action" : "All caught up"}
              </div>
            </div>
          </Link>

          <Link href="/dashboard/enquiries" className="ffdash-statCard">
            <div className="ffdash-statLine" />
            <div className="ffdash-statInner">
              <div className="ffdash-statTop">
                <div className="ffdash-statTitle">Open enquiries</div>
                <span className="ffdash-pill">Pipeline</span>
              </div>

              <div className="ffdash-statNumber">
                {loading ? "…" : stats.enquiriesOpen}
              </div>

              <div className="ffdash-statSub">
                Active enquiries not won or lost
              </div>
            </div>
          </Link>

          <Link href="/dashboard/bookings" className="ffdash-statCard">
            <div className="ffdash-statLine" />
            <div className="ffdash-statInner">
              <div className="ffdash-statTop">
                <div className="ffdash-statTitle">Jobs</div>
                <span className="ffdash-pill">Live</span>
              </div>

<div className="ffdash-statNumber">
  {loading ? "…" : stats.wonJobs}
</div>

              <div className="ffdash-statSub">
                Booked or moved into jobs
              </div>
            </div>
          </Link>

          <Link href="/dashboard/invoices" className="ffdash-statCard">
            <div className="ffdash-statLine" />
            <div className="ffdash-statInner">
              <div className="ffdash-statTop">
                <div className="ffdash-statTitle">Invoices</div>
                <span className="ffdash-pill ffdash-pillNeutral">Total</span>
              </div>

              <div className="ffdash-statNumber">
                {loading ? "…" : stats.invoices}
              </div>

              <div className="ffdash-statSub">Total created</div>
            </div>
          </Link>
        </section>

        <section className="ffdash-lowerGrid">
          <div className="ffdash-card ffdash-cardPad">
            <div className="ffdash-cardTitleRow">
              <h3 className="ffdash-cardTitle">Recent activity</h3>
              <span className="ffdash-mutedSmall">Latest</span>
            </div>

         {recentActivity.length > 0 ? (
  <div className="ffdash-activityList">
    {recentActivity.map((item) => (
      <Link key={item.id} href={item.href} className="ffdash-activityItem">
        <div className="ffdash-emptyDot" />
        <div>
          <div className="ffdash-emptyTitle">{item.label}</div>
          <div className="ffdash-mutedSmall">
            {item.detail} •{" "}
            {new Date(item.created_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </Link>
    ))}
  </div>
) : (
  <div className="ffdash-emptyState">
    <div className="ffdash-emptyDot" />
    <div>
      <div className="ffdash-emptyTitle">No recent activity yet</div>
      <div className="ffdash-mutedSmall">
        When you send estimates, move jobs or create invoices, they’ll show here.
      </div>
    </div>
  </div>
)}

            <div className="ffdash-metaStrip">
              <div>
                <div className="ffdash-metaLabel">Last activity</div>
                <div className="ffdash-metaValue">{lastActivity}</div>
              </div>
              <div>
                <div className="ffdash-metaLabel">Last login</div>
                <div className="ffdash-metaValue">{lastLogin}</div>
              </div>
            </div>
          </div>

          <div className="ffdash-card ffdash-cardPad">
            <div className="ffdash-cardTitleRow">
              <h3 className="ffdash-cardTitle">This month</h3>
              <span className="ffdash-chip">Invoices</span>
            </div>

            <div className="ffdash-revenue">{revenueThisMonth}</div>
            <div className="ffdash-mutedSmall">
              Based on invoices created this month
            </div>
          </div>
        </section>

        <div id="ffdash-toast" className="ffdash-toast" />
      </div>

      <style jsx>{`

      .ffdash-aiGridMuted {
  opacity: 0.55;
}

.ffdash-setupCard {
  margin-bottom: 14px;
  background:
    linear-gradient(
      180deg,
      rgba(248, 251, 255, 0.92),
      rgba(255,255,255,1)
    );
  border: 1px solid #e7edf5;
}

.ffdash-setupTitle {
  margin: 8px 0 12px;
  font-size: 24px;
  font-weight: 950;
  color: #1f355c;
  letter-spacing: 0.015em;
  line-height: 1.1;
}

.ffdash-setupGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.ffdash-setupItem {
  text-decoration: none;
  color: inherit;
  text-align: left;
  border-radius: 14px;
  padding: 13px 14px;
  border: 1px solid #e6ecf5;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  transition: all 0.15s ease;
  cursor: pointer;
}

.ffdash-setupItem:hover {
  transform: translateY(-1px);
  border-color: #cfd9e8;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.ffdash-setupItem strong {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 900;
  color: #1f355c;
}

.ffdash-setupItem span {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.45;
  color: #6b7a90;
}

@media (max-width: 640px) {
  .ffdash-setupGrid {
    grid-template-columns: 1fr;
  }
}
        .ffdash-page {
          min-height: 100vh;
          background: #f6f8fc;
          padding: 24px;
        }

        .ffdash-wrap {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
        }

        .ffdash-hero {
          position: relative;
          border: 1px solid #d6deea;
          border-radius: 24px;
          padding: 24px;
          background: linear-gradient(
            135deg,
            rgba(223, 234, 250, 0.8),
            rgba(245, 249, 255, 0.94) 45%,
            rgba(255, 255, 255, 0.98) 100%
          );
          overflow: hidden;
          margin-bottom: 16px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.88),
            0 12px 28px rgba(15, 23, 42, 0.045);
        }

        .ffdash-heroGlow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(
              circle at 14% 22%,
              rgba(143, 169, 214, 0.2),
              transparent 48%
            ),
            radial-gradient(
              circle at 86% 18%,
              rgba(196, 212, 233, 0.18),
              transparent 42%
            );
          pointer-events: none;
        }

.ffdash-heroUrgent .ffdash-heroGlow {
  background:
    radial-gradient(
      circle at 14% 22%,
      rgba(201, 123, 123, 0.14),
      transparent 48%
    ),
    radial-gradient(
      circle at 86% 18%,
      rgba(227, 195, 195, 0.14),
      transparent 42%
    );
}

.ffdash-heroWarm .ffdash-heroGlow {
  background:
    radial-gradient(
      circle at 14% 22%,
      rgba(222, 168, 102, 0.14),
      transparent 48%
    ),
    radial-gradient(
      circle at 86% 18%,
      rgba(241, 213, 168, 0.14),
      transparent 42%
    );
}

.ffdash-heroProgress .ffdash-heroGlow {
  background:
    radial-gradient(
      circle at 14% 22%,
      rgba(111, 167, 138, 0.12),
      transparent 48%
    ),
    radial-gradient(
      circle at 86% 18%,
      rgba(191, 224, 207, 0.14),
      transparent 42%
    );
}

.ffdash-heroClear .ffdash-heroGlow {
  background:
    radial-gradient(
      circle at 14% 22%,
      rgba(143, 169, 214, 0.2),
      transparent 48%
    ),
    radial-gradient(
      circle at 86% 18%,
      rgba(196, 212, 233, 0.18),
      transparent 42%
    );
}
    .ffdash-heroUrgent .ffdash-heroTitle,
.ffdash-heroWarm .ffdash-heroTitle,
.ffdash-heroProgress .ffdash-heroTitle,
.ffdash-heroClear .ffdash-heroTitle {
  color: #1f355c;
}

        .ffdash-heroRow {
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .ffdash-heroTitle {
          margin: 0;
          font-size: 28px;
          font-weight: 950;
          color: #1f355c;
          letter-spacing: -0.02em;
        }

        .ffdash-heroSub {
          margin: 8px 0 0;
          font-size: 14px;
          color: #4f5f77;
        }

        .ffdash-heroTip {
          margin: 10px 0 0;
          font-size: 14px;
          color: #5b6b82;
        }

.ffdash-heroUrgent {
  background: linear-gradient(
    135deg,
    rgba(255, 240, 240, 0.9),
    rgba(255, 247, 247, 0.96) 45%,
    rgba(255, 255, 255, 0.98) 100%
  );
  border-color: #ead1d1;
}

.ffdash-heroWarm {
  background: linear-gradient(
    135deg,
    rgba(255, 247, 237, 0.9),
    rgba(255, 251, 245, 0.96) 45%,
    rgba(255, 255, 255, 0.98) 100%
  );
  border-color: #eadfce;
}

.ffdash-heroProgress {
  background: linear-gradient(
    135deg,
    rgba(238, 247, 243, 0.9),
    rgba(246, 252, 249, 0.96) 45%,
    rgba(255, 255, 255, 0.98) 100%
  );
  border-color: #d8e7df;
}

.ffdash-heroClear {
  background: linear-gradient(
    135deg,
    rgba(223, 234, 250, 0.8),
    rgba(245, 249, 255, 0.94) 45%,
    rgba(255, 255, 255, 0.98) 100%
  );
  border-color: #d6deea;
}

        .ffdash-card {
          border: 1px solid #dbe4ef;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.98);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 0;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            0 10px 24px rgba(15, 23, 42, 0.04),
            0 2px 8px rgba(15, 23, 42, 0.025);
        }


.ffdash-aiCardPrimary {
  transform: translateY(-3px);
  border-color: #bfcfe4;

  box-shadow:
    0 0 0 1px rgba(191, 207, 228, 1),
    0 18px 36px rgba(15, 23, 42, 0.12),
    0 6px 16px rgba(15, 23, 42, 0.08);
}
    .ffdash-aiCardPrimary .ffdash-aiLine {
  background: linear-gradient(
    90deg,
    #245bff 0%,
    rgba(36, 91, 255, 0.7) 55%,
    rgba(31, 53, 92, 0.2) 100%
  );
}
  .ffdash-aiCardPrimary .ffdash-aiIconWrap {
  transform: scale(1.05);
  box-shadow:
    0 6px 14px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

    .ffdash-aiCard:not(.ffdash-aiCardUrgent) .ffdash-aiIconWrap {
  background: #f8fafc;
  border-color: #e6ecf5;
  color: #5c6b84;
}
        .ffdash-cardPad {
          padding: 16px;
        }

        .ffdash-aiPanel {
          margin-bottom: 16px;
        }

        .ffdash-aiGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 10px;
        }

        .ffdash-aiCard {
          display: block;
          text-decoration: none;
          color: inherit;
          border-radius: 18px;
          overflow: hidden;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border: 1px solid #dbe4ef;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.9) inset,
            0 8px 18px rgba(15, 23, 42, 0.04),
            0 2px 8px rgba(15, 23, 42, 0.025);
          transition:
            transform 0.16s ease,
            box-shadow 0.16s ease,
            border-color 0.16s ease;
        }

        .ffdash-aiCard:hover {
          transform: translateY(-2px);
          border-color: #cdd8e6;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.92) inset,
            0 12px 22px rgba(15, 23, 42, 0.06),
            0 4px 10px rgba(15, 23, 42, 0.03);
        }

        .ffdash-aiCardUrgent {
          background: linear-gradient(180deg, #ffffff 0%, #fff8f8 100%);
          border-color: #e8cccc;
        }

        .ffdash-aiLine {
          height: 3px;
          margin: 14px 16px 0;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #8fa9d6 0%,
            rgba(143, 169, 214, 0.46) 55%,
            rgba(31, 53, 92, 0.1) 100%
          );
        }

        .ffdash-aiCardUrgent .ffdash-aiLine {
          background: linear-gradient(
            90deg,
            #c97b7b 0%,
            rgba(201, 123, 123, 0.4) 55%,
            rgba(201, 123, 123, 0.12) 100%
          );
        }

        .ffdash-aiCardInner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
        }

        .ffdash-aiCard:hover .ffdash-aiAction {
          color: #0b2a55;
        }

        .ffdash-aiIconWrap {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: #fff1f1;
          border: 1px solid #fecaca;
          color: #b42318;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .ffdash-aiIconBlue {
          background: #eef4ff;
          border-color: #dbe7ff;
          color: #1f355c;
        }

        .ffdash-aiIconGreen {
          background: #ecfdf3;
          border-color: #d1fadf;
          color: #067647;
        }

        .ffdash-aiIcon {
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
        }

        .ffdash-aiContent {
          flex: 1;
          min-width: 0;
        }

        .ffdash-aiTitle {
          font-size: 14px;
          font-weight: 900;
          color: #1f355c;
          line-height: 1.25;
          margin-bottom: 2px;
          min-height: 34px;
        }
.ffdash-certPanel {
  margin-bottom: 16px;
  border-color: #fed7aa;
  background: linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
}

.ffdash-certList {
  display: grid;
  gap: 10px;
}

.ffdash-certReminder {
  text-decoration: none;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #fed7aa;
  background: #fff7ed;
  transition: all 0.15s ease;
}

.ffdash-certReminder:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  border-color: #fdba74;
}

.ffdash-certReminder strong {
  color: #0b1320;
  font-weight: 900;
}

.ffdash-certReminder span {
  color: #9a3412;
  font-weight: 900;
  white-space: nowrap;
}
        .ffdash-aiText {
          margin-top: 4px;
          font-size: 13px;
          line-height: 1.45;
          color: #6b7a90;
        }

        .ffdash-aiAction {
          margin-top: 10px;
          font-size: 12px;
          font-weight: 900;
          color: #1f355c;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .ffdash-aiAction::after {
          content: "→";
          font-size: 12px;
        }

        .ffdash-sectionTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 12px;
        }

        .ffdash-eyebrow {
          font-size: 12px;
          letter-spacing: 0.08em;
          color: #5f6f86;
          font-weight: 900;
        }

        .ffdash-muted {
          margin-top: 4px;
          font-size: 14px;
          color: #5f6f86;
        }

        .ffdash-mutedSmall {
          font-size: 13px;
          color: #7a8799;
        }

        .ffdash-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(143, 169, 214, 0.16);
          border: 1px solid rgba(143, 169, 214, 0.24);
          color: #1f355c;
          font-weight: 800;
          white-space: nowrap;
        }

        .ffdash-btn {
          border-radius: 14px;
          padding: 10px 14px;
          font-size: 14px;
          border: 1px solid #d6deea;
          background: rgba(255, 255, 255, 0.98);
          color: #1f355c;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease,
            background 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 800;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.85) inset,
            0 4px 10px rgba(15, 23, 42, 0.03);
        }

        .ffdash-btn:hover {
          transform: translateY(-1px);
          border-color: #c7d4e4;
          background: #ffffff;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.92) inset,
            0 10px 18px rgba(15, 23, 42, 0.055);
        }

        .ffdash-btnSoft {
          background: rgba(220, 232, 250, 0.56);
          border-color: rgba(196, 212, 233, 0.95);
          color: #1f355c;
        }

        .ffdash-linkRow {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .ffdash-linkBox {
          flex: 1;
          background: #f8fbff;
          border: 1px solid #e6ecf5;
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 14px;
          color: #1f355c;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ffdash-qrFrame {
          border: 1px solid #dbe4ef;
          border-radius: 18px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.98);
          min-width: 118px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.88) inset,
            0 8px 16px rgba(15, 23, 42, 0.025);
        }

        .ffdash-qrSvgWrap {
          width: 108px;
          height: 108px;
          border-radius: 14px;
          background: #f8fbff;
          border: 1px solid #e6ecf5;
          display: grid;
          place-items: center;
        }

        .ffdash-qrLabel {
          font-size: 12px;
          color: #5f6f86;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .ffdash-actions {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .ffdash-statGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin: 22px 0 28px;
          align-items: stretch;
        }

        .ffdash-statCard {
          display: block;
          text-decoration: none;
          color: inherit;
          border-radius: 22px;
          overflow: hidden;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border: 1px solid #d4deea;
          box-shadow:
            0 0 0 1px rgba(212, 222, 234, 0.95),
            0 12px 26px rgba(15, 23, 42, 0.08),
            0 3px 10px rgba(15, 23, 42, 0.05);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease;
        }

        .ffdash-statCard:hover {
          transform: translateY(-2px);
          border-color: #c6d2df;
          box-shadow:
            0 0 0 1px rgba(198, 210, 223, 1),
            0 16px 32px rgba(15, 23, 42, 0.1),
            0 5px 14px rgba(15, 23, 42, 0.06);
        }

        .ffdash-statCardAlert {
          background: linear-gradient(180deg, #ffffff 0%, #fff8f8 100%);
          border-color: #e3c3c3;
          box-shadow:
            0 0 0 1px rgba(227, 195, 195, 0.95),
            0 12px 26px rgba(15, 23, 42, 0.08),
            0 3px 10px rgba(15, 23, 42, 0.05);
        }

        .ffdash-statLine {
          height: 3px;
          margin: 14px 18px 0;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #8fa9d6 0%,
            rgba(143, 169, 214, 0.58) 55%,
            rgba(31, 53, 92, 0.14) 100%
          );
        }

        .ffdash-statCardAlert .ffdash-statLine {
          background: linear-gradient(
            90deg,
            #c97b7b 0%,
            rgba(201, 123, 123, 0.36) 55%,
            rgba(201, 123, 123, 0.1) 100%
          );
        }

        .ffdash-statInner {
          min-height: 154px;
          padding: 14px 18px 18px;
        }

        .ffdash-statTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .ffdash-statTitle {
          font-size: 14px;
          line-height: 1.2;
          color: #5c6b84;
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .ffdash-statNumber {
          margin-top: 16px;
          font-size: 42px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #1f355c;
        }

        .ffdash-statNumberAlert {
          color: #b42318;
        }

        .ffdash-statSub {
          margin-top: 12px;
          font-size: 13px;
          line-height: 1.45;
          color: #7a8799;
        }

        .ffdash-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(143, 169, 214, 0.14);
          border: 1px solid rgba(143, 169, 214, 0.24);
          color: #1f355c;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .ffdash-pillNeutral {
          background: #f7f9fc;
          border: 1px solid #e6ecf5;
          color: #7a8799;
        }

        .ffdash-pillAlert {
          background: #fff1f1;
          border: 1px solid #fecaca;
          color: #b42318;
        }

        .ffdash-lowerGrid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          margin-top: 10px;
        }

        .ffdash-cardTitleRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .ffdash-cardTitle {
          margin: 0;
          font-size: 17px;
          font-weight: 900;
          color: #1f355c;
          letter-spacing: -0.01em;
        }

.ffdash-activityList {
  display: grid;
  gap: 10px;
}

.ffdash-activityItem {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: #f8fbff;
  border: 1px solid #e6ecf5;
  text-decoration: none;
  color: inherit;
  transition: all 0.15s ease;
}

.ffdash-activityItem:hover {
  transform: translateY(-1px);
  border-color: #cfd9e8;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

        .ffdash-emptyState {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          border-radius: 14px;
          background: #f8fbff;
          border: 1px solid #e6ecf5;
        }

        .ffdash-emptyDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #1f355c;
          margin-top: 4px;
          box-shadow: 0 0 0 6px rgba(143, 169, 214, 0.16);
        }

        .ffdash-emptyTitle {
          font-size: 14px;
          font-weight: 900;
          color: #1f355c;
        }

        .ffdash-metaStrip {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #e6ecf5;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .ffdash-metaLabel {
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #5f6f86;
          font-weight: 900;
        }

        .ffdash-metaValue {
          margin-top: 6px;
          font-size: 13px;
          color: #1f355c;
          font-weight: 900;
        }

        .ffdash-revenue {
          font-size: 36px;
          font-weight: 950;
          color: #1f355c;
          margin-top: 8px;
          letter-spacing: -0.02em;
        }

        .ffdash-toast {
          position: fixed;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%) translateY(14px);
          background: rgba(15, 23, 42, 0.92);
          color: #fff;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          opacity: 0;
          pointer-events: none;
          transition:
            opacity 0.16s ease,
            transform 0.16s ease;
        }

        .ffdash-toastShow {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        @media (max-width: 980px) {
          .ffdash-linkRow {
            flex-direction: column;
            align-items: stretch;
          }

          .ffdash-aiGrid {
            grid-template-columns: 1fr;
          }

          .ffdash-statGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ffdash-lowerGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .ffdash-statGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (min-width: 640px) {
          .ffdash-cardPad {
            padding: 20px !important;
          }
        }
          .ffdash-setupHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.ffdash-setupHeroBtn {
  width: 100%;
}

.ffdash-setupHeroBtn {
  width: 100%;
}

.ffdash-setupTitle {
  margin: 8px 0 4px;
  font-size: 22px;
  font-weight: 900;
  color: #1f355c;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.ffdash-setupProgress {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 120px;
}

.ffdash-setupProgressBar {
  width: 120px;
  height: 6px;
  border-radius: 999px;
  background: #e6ecf5;
  overflow: hidden;
}

.ffdash-setupProgressFill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #0b2a55, #8fa9b6);
  transition: width 0.4s ease;
}

.ffdash-setupProgressLabel {
  font-size: 12px;
  font-weight: 700;
  color: #8a9ab5;
}

/* HERO STEP â€” Copy link */
.ffdash-setupHero {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 16px;
  padding: 20px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(223,234,250,0.6), rgba(245,249,255,0.9));
  border: 1px solid #d6deea;
  margin-bottom: 12px;
  overflow: hidden;
}




.ffdash-setupHeroLeft {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  width: 100%;
}

.ffdash-setupStepNum {
  width: 32px;
  min-width: 32px;
  max-width: 32px;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #dbe4ef;
  color: #8a9ab5;
  font-size: 13px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ffdash-setupHero .ffdash-setupStepNum {
  background: #f7f9fc;
  border: 2px solid #dbe4ef;
  color: #8a9ab5;
}


.ffdash-setupHero .ffdash-setupStepTitle {
  color: #1f355c;
  font-size: 16px;
  font-weight: 900;
  margin-bottom: 4px;
}

.ffdash-setupHero .ffdash-setupStepSub {
  color: #5f6f86;
  font-size: 13px;
  line-height: 1.5;
}

.ffdash-setupLinkPreview {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #d6deea;
  color: #1f355c;
  font-size: 12px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
  display: block;
}

.ffdash-setupLinkPreview span {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}



.ffdash-setupHeroContent {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.ffdash-setupHeroLeft > .ffdash-setupStepNum {
  width: 32px !important;
  min-width: 32px !important;
  max-width: 32px !important;
  height: 32px !important;
}

.ffdash-setupHeroBtn {
  padding: 12px 22px;
  border-radius: 14px;
  background: #0b2a55;
  box-shadow: 0 8px 24px rgba(11, 42, 85, 0.2);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 8px 24px rgba(26, 79, 255, 0.3);
  transition: background 0.15s, transform 0.15s;
  flex-shrink: 0;
}

.ffdash-setupHeroBtn:hover {
  background: #2d5fff;
  transform: translateY(-1px);
}

/* STEPS 2 + 3 */
.ffdash-setupSteps {
  display: grid;
  gap: 10px;
}

.ffdash-setupStep {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #e6ecf5;
  background: #f8fbff;
  text-decoration: none;
  color: inherit;
  transition: all 0.15s ease;
}

.ffdash-setupStep:hover {
  border-color: #c7d4e4;
  background: #fff;
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.ffdash-setupTick {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #dbe4ef;
  background: #fff;
  color: #8a9ab5;
  font-size: 13px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.ffdash-setupTickDone {
  border-color: #16a34a;
  background: #ecfdf3;
  color: #16a34a;
}

.ffdash-setupStepBody {
  flex: 1;
  min-width: 0;
}

.ffdash-setupStepTitle {
  font-size: 14px;
  font-weight: 800;
  color: #1f355c;
  margin-bottom: 3px;
}

.ffdash-setupStepSub {
  font-size: 13px;
  color: #6b7a90;
  line-height: 1.45;
}

.ffdash-setupStepArrow {
  font-size: 16px;
  color: #8a9ab5;
  flex-shrink: 0;
}


      `}</style>
    </div>
  );
}