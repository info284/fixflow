"use client";

import "@/app/dashboard/shared-flow.css";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AlertTone = "red" | "amber" | "blue" | "green";
type AlertPriority = "critical" | "high" | "medium" | "low";

type AlertItem = {
  id: string;
  title: string;
  text: string;
  tone: AlertTone;
  priority: AlertPriority;
  score: number;
  href: string;
  date?: string | null;
};

function niceDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesAgo(value?: string | null) {
  if (!value) return "Unknown time";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function money(value?: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function priorityFromScore(score: number): AlertPriority {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export default function AlertsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  async function loadAlerts() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const in30DaysIso = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      unreadReqs,
      followUpsDue,
      unviewedEstimates,
      overdueInvoices,
      upcomingVisits,
      expiringCerts,
      recentCustomerReplies,
      highValueWaiting,
      coldLeads,
    ] = await Promise.all([
      supabase
        .from("quote_requests")
        .select("id, job_number, customer_name, job_type, created_at, urgency")
        .eq("plumber_id", user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("quote_requests")
        .select("id, job_number, customer_name, job_type, ai_next_action_due_at")
        .eq("plumber_id", user.id)
        .lte("ai_next_action_due_at", nowIso)
        .neq("stage", "won")
        .neq("stage", "lost")
        .order("ai_next_action_due_at", { ascending: true })
        .limit(30),

      supabase
        .from("estimates")
        .select("id, request_id, customer_name, job_type, total, status, created_at, view_count")
        .eq("plumber_id", user.id)
        .eq("status", "sent")
        .or("view_count.is.null,view_count.eq.0")
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("invoices")
        .select("id, request_id, invoice_number, amount, due_at, status")
        .eq("user_id", user.id)
        .lt("due_at", nowIso)
        .neq("status", "paid")
        .neq("status", "void")
        .order("due_at", { ascending: true })
        .limit(30),

      supabase
        .from("site_visits")
        .select("id, request_id, visit_at, customer_name, job_type")
        .eq("plumber_id", user.id)
        .gte("visit_at", nowIso)
        .order("visit_at", { ascending: true })
        .limit(20),

      supabase
        .from("trader_certificates")
        .select("id, name, expiry_date")
        .eq("trader_id", user.id)
        .not("expiry_date", "is", null)
        .lte("expiry_date", in30DaysIso)
        .order("expiry_date", { ascending: true })
        .limit(30),

      supabase
        .from("enquiry_messages")
        .select("id, request_id, body_text, created_at, from_email, direction")
        .eq("plumber_id", user.id)
        .eq("direction", "inbound")
        .gte(
          "created_at",
          new Date(Date.now() - 60 * 60 * 1000).toISOString()
        )
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("quote_requests")
        .select("id, job_number, customer_name, job_type, ai_job_value_band, ai_last_customer_message_at")
        .eq("plumber_id", user.id)
        .eq("ai_job_value_band", "high")
        .neq("stage", "won")
        .neq("stage", "lost")
        .order("ai_last_customer_message_at", { ascending: false })
        .limit(30),

      supabase
        .from("quote_requests")
        .select("id, job_number, customer_name, job_type, ai_thread_status, ai_last_customer_message_at")
        .eq("plumber_id", user.id)
        .eq("ai_thread_status", "cold_after_follow_up")
        .limit(30),
    ]);

    const next: AlertItem[] = [];

    (recentCustomerReplies.data || []).forEach((m: any) => {
      next.push({
        id: `reply-${m.id}`,
        title: `Customer replied ${minutesAgo(m.created_at)}`,
        text: m.body_text?.slice(0, 110) || "New customer reply waiting.",
        tone: "red",
        score: 98,
        priority: "critical",
        href: `/dashboard/enquiries?requestId=${m.request_id}&tab=messages`,
        date: m.created_at,
      });
    });

    (unreadReqs.data || []).forEach((r: any) => {
      const urgent = String(r.urgency || "").toLowerCase().includes("asap");
      const score = urgent ? 95 : 82;

      next.push({
        id: `unread-${r.id}`,
        title: urgent ? "Urgent unread enquiry" : "Unread enquiry",
        text: `${r.job_number || "No job number"} • ${r.customer_name || "Customer"} • ${r.job_type || "New enquiry"}`,
        tone: urgent ? "red" : "amber",
        score,
        priority: priorityFromScore(score),
        href: `/dashboard/enquiries?requestId=${r.id}&tab=messages`,
        date: r.created_at,
      });
    });

    (highValueWaiting.data || []).forEach((r: any) => {
      next.push({
        id: `highvalue-${r.id}`,
        title: "High value lead waiting",
        text: `${r.job_number || "No job number"} • ${r.customer_name || "Customer"} • ${r.job_type || "High value enquiry"}`,
        tone: "red",
        score: 92,
        priority: "critical",
        href: `/dashboard/enquiries?requestId=${r.id}&tab=messages`,
        date: r.ai_last_customer_message_at,
      });
    });

    (followUpsDue.data || []).forEach((r: any) => {
      next.push({
        id: `followup-${r.id}`,
        title: "Follow-up due",
        text: `${r.job_number || "No job number"} • ${r.customer_name || "Customer"} • ${r.job_type || "Enquiry"}`,
        tone: "amber",
        score: 74,
        priority: "high",
        href: `/dashboard/enquiries?requestId=${r.id}&tab=messages`,
        date: r.ai_next_action_due_at,
      });
    });

    (coldLeads.data || []).forEach((r: any) => {
      next.push({
        id: `cold-${r.id}`,
        title: "Customer gone cold",
        text: `${r.job_number || "No job number"} • ${r.customer_name || "Customer"} • Needs a final decision or close-out.`,
        tone: "amber",
        score: 66,
        priority: "medium",
        href: `/dashboard/enquiries?requestId=${r.id}&tab=messages`,
        date: r.ai_last_customer_message_at,
      });
    });

    (unviewedEstimates.data || []).forEach((e: any) => {
      next.push({
        id: `estimate-${e.id}`,
        title: "Estimate not viewed",
        text: `${e.customer_name || "Customer"} • ${e.job_type || "Estimate"} • ${money(e.total)}`,
        tone: "blue",
        score: 58,
        priority: "medium",
        href: `/dashboard/enquiries?requestId=${e.request_id}&tab=estimate`,
        date: e.created_at,
      });
    });

    (overdueInvoices.data || []).forEach((i: any) => {
      next.push({
        id: `invoice-${i.id}`,
        title: "Invoice overdue",
        text: `${i.invoice_number || "Invoice"} • ${money(i.amount)} • Due ${niceDate(i.due_at)}`,
        tone: "red",
        score: 88,
        priority: "high",
        href: `/dashboard/invoices?invoiceId=${i.id}`,
        date: i.due_at,
      });
    });

    (upcomingVisits.data || []).forEach((v: any) => {
      next.push({
        id: `visit-${v.id}`,
        title: "Upcoming site visit",
        text: `${v.customer_name || "Customer"} • ${v.job_type || "Visit"} • ${niceDate(v.visit_at)}`,
        tone: "green",
        score: 42,
        priority: "low",
        href: `/dashboard/enquiries?requestId=${v.request_id}&tab=visit`,
        date: v.visit_at,
      });
    });

    (expiringCerts.data || []).forEach((c: any) => {
      const expiry = c.expiry_date ? new Date(c.expiry_date) : null;
      const isExpired = expiry ? expiry < now : false;
      const score = isExpired ? 100 : 86;

      next.push({
        id: `cert-${c.id}`,
        title: isExpired ? "Certificate expired" : "Certificate expiring soon",
        text: `${c.name || "Certificate"} • ${isExpired ? "Expired" : "Expires"} ${niceDate(c.expiry_date)}`,
        tone: isExpired ? "red" : "amber",
        score,
        priority: priorityFromScore(score),
        href: `/dashboard/profile?tab=certificates`,
        date: c.expiry_date,
      });
    });

    next.sort((a, b) => b.score - a.score);

    setAlerts(next);
    setLoading(false);
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  const counts = useMemo(() => {
    return {
      all: alerts.length,
      critical: alerts.filter((a) => a.priority === "critical").length,
      high: alerts.filter((a) => a.priority === "high").length,
      money: alerts.filter((a) => a.title.toLowerCase().includes("invoice")).length,
    };
  }, [alerts]);

  return (
    <div className="ff-page">
      <div className="ff-wrap">
        <div className="ff-top">
          <div className="ff-hero">
            <div className="ff-heroGlow" />

            <div className="ff-heroRow">
              <div className="ff-heroLeft">
                <div className="ff-heroTitle">Alerts</div>
                <div className="ff-heroRule" />
                <div className="ff-heroSub">
                  AI-prioritised alerts for leads, jobs, invoices and certificates.
                </div>
              </div>

              <div className="ff-actions">
                <button className="ff-btn ff-btnGhost" type="button" onClick={loadAlerts}>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="ff-alertStats">
          <div className="ff-statCard">
            <div className="ff-statLabel">Total alerts</div>
            <div className="ff-statValue">{counts.all}</div>
          </div>

          <div className="ff-statCard">
            <div className="ff-statLabel">Critical</div>
            <div className="ff-statValue">{counts.critical}</div>
          </div>

          <div className="ff-statCard">
            <div className="ff-statLabel">High priority</div>
            <div className="ff-statValue">{counts.high}</div>
          </div>

          <div className="ff-statCard">
            <div className="ff-statLabel">Money alerts</div>
            <div className="ff-statValue">{counts.money}</div>
          </div>
        </div>

        <div className="ff-card">
          <div className="ff-alertList">
            {loading ? (
              <div className="ff-emptyWrap">Loading alerts…</div>
            ) : alerts.length ? (
              alerts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`ff-alertCard ff-alert-${a.tone}`}
                  onClick={() => router.push(a.href)}
                >
                  <div className="ff-alertMain">
                    <div className="ff-alertTop">
                      <span className={`ff-priority ff-priority-${a.priority}`}>
                        {a.priority}
                      </span>

                      <span className="ff-alertScore">
                        AI score {a.score}
                      </span>
                    </div>

                    <div className="ff-alertTitle">{a.title}</div>
                    <div className="ff-alertText">{a.text}</div>
                  </div>

                  <div className="ff-alertDate">{niceDate(a.date)}</div>
                </button>
              ))
            ) : (
              <div className="ff-emptyWrap">
                <div className="ff-empty">
                  <div className="ff-emptyTitle">No alerts right now</div>
                  <div className="ff-emptySub">
                    Nothing is slipping through the cracks.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ff-alertStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .ff-alertList {
          display: grid;
          gap: 12px;
          padding: 16px;
        }

        .ff-alertCard {
          width: 100%;
          text-align: left;
          border-radius: 22px;
          padding: 16px;
          border: 1px solid rgba(230, 236, 245, 0.95);
          background: #fff;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
        }

        .ff-alertMain {
          min-width: 0;
        }

        .ff-alertTop {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .ff-priority,
        .ff-alertScore {
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .ff-alertScore {
          background: #eef4ff;
          color: #1f355c;
        }

        .ff-priority-critical {
          background: #fff1f2;
          color: #9f1239;
        }

        .ff-priority-high {
          background: #fff7ed;
          color: #9a3412;
        }

        .ff-priority-medium {
          background: #eef4ff;
          color: #1e3a8a;
        }

        .ff-priority-low {
          background: #ecfdf3;
          color: #166534;
        }

        .ff-alertTitle {
          font-size: 16px;
          font-weight: 950;
          color: #0b1320;
        }

        .ff-alertText {
          margin-top: 5px;
          font-size: 13px;
          line-height: 1.45;
          color: #64748b;
          font-weight: 650;
        }

        .ff-alertDate {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
          white-space: nowrap;
        }

        .ff-alert-red {
          border-color: rgba(239, 68, 68, 0.26);
          background: linear-gradient(180deg, #fff5f5, #fff);
        }

        .ff-alert-amber {
          border-color: rgba(245, 158, 11, 0.28);
          background: linear-gradient(180deg, #fff7ed, #fff);
        }

        .ff-alert-blue {
          border-color: rgba(59, 130, 246, 0.24);
          background: linear-gradient(180deg, #f8fbff, #fff);
        }

        .ff-alert-green {
          border-color: rgba(34, 197, 94, 0.24);
          background: linear-gradient(180deg, #f0fdf4, #fff);
        }

        @media (max-width: 760px) {
          .ff-alertStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ff-alertCard {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}