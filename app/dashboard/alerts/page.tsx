"use client";

import "@/app/dashboard/shared-flow.css";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AlertTone = "red" | "amber" | "blue" | "green";

type AlertItem = {
  id: string;
  title: string;
  text: string;
  tone: AlertTone;
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

function money(value?: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
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

    const nowIso = new Date().toISOString();

    const [
      unreadReqs,
      followUpsDue,
      unviewedEstimates,
      overdueInvoices,
      upcomingVisits,
    ] = await Promise.all([
      supabase
        .from("quote_requests")
        .select("id, job_number, customer_name, job_type, created_at")
        .eq("plumber_id", user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("quote_requests")
        .select("id, job_number, customer_name, job_type, ai_next_action_due_at")
        .eq("plumber_id", user.id)
        .lte("ai_next_action_due_at", nowIso)
        .neq("stage", "won")
        .neq("stage", "lost")
        .order("ai_next_action_due_at", { ascending: true })
        .limit(20),

      supabase
        .from("estimates")
        .select("id, request_id, customer_name, job_type, total, status, created_at, view_count")
        .eq("plumber_id", user.id)
        .eq("status", "sent")
        .or("view_count.is.null,view_count.eq.0")
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("invoices")
        .select("id, request_id, invoice_number, amount, due_at, status")
        .eq("user_id", user.id)
        .lt("due_at", nowIso)
        .neq("status", "paid")
        .neq("status", "void")
        .order("due_at", { ascending: true })
        .limit(20),

      supabase
        .from("site_visits")
        .select("id, request_id, visit_at, customer_name, job_type")
        .eq("plumber_id", user.id)
        .gte("visit_at", nowIso)
        .order("visit_at", { ascending: true })
        .limit(10),
    ]);

    const next: AlertItem[] = [];

    (unreadReqs.data || []).forEach((r: any) => {
      next.push({
        id: `unread-${r.id}`,
        title: "Unread enquiry",
        text: `${r.job_number || "No job number"} • ${r.customer_name || "Customer"} • ${r.job_type || "New enquiry"}`,
        tone: "red",
        href: `/dashboard/enquiries?requestId=${r.id}&tab=messages`,
        date: r.created_at,
      });
    });

    (followUpsDue.data || []).forEach((r: any) => {
      next.push({
        id: `followup-${r.id}`,
        title: "Follow-up due",
        text: `${r.job_number || "No job number"} • ${r.customer_name || "Customer"} • ${r.job_type || "Enquiry"}`,
        tone: "amber",
        href: `/dashboard/enquiries?requestId=${r.id}&tab=messages`,
        date: r.ai_next_action_due_at,
      });
    });

    (unviewedEstimates.data || []).forEach((e: any) => {
      next.push({
        id: `estimate-${e.id}`,
        title: "Estimate not viewed",
        text: `${e.customer_name || "Customer"} • ${e.job_type || "Estimate"} • ${money(e.total)}`,
        tone: "blue",
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
        href: `/dashboard/enquiries?requestId=${v.request_id}&tab=visit`,
        date: v.visit_at,
      });
    });

    next.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    setAlerts(next);
    setLoading(false);
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  const counts = useMemo(() => {
    return {
      all: alerts.length,
      urgent: alerts.filter((a) => a.tone === "red").length,
      follow: alerts.filter((a) => a.tone === "amber").length,
      good: alerts.filter((a) => a.tone === "green").length,
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
                  Stay ahead of missed replies, overdue invoices and follow-ups.
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
            <div className="ff-statLabel">Urgent</div>
            <div className="ff-statValue">{counts.urgent}</div>
          </div>

          <div className="ff-statCard">
            <div className="ff-statLabel">Follow-ups</div>
            <div className="ff-statValue">{counts.follow}</div>
          </div>

          <div className="ff-statCard">
            <div className="ff-statLabel">Upcoming</div>
            <div className="ff-statValue">{counts.good}</div>
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
                  <div>
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
          border-radius: 20px;
          padding: 16px;
          border: 1px solid rgba(230, 236, 245, 0.95);
          background: #fff;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          cursor: pointer;
        }

        .ff-alertTitle {
          font-size: 15px;
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