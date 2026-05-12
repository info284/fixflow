"use client";

import "@/app/dashboard/shared-flow.css";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AppAlert = {
  id: string;
  type: string;
  title: string;
  message: string;
  action_label: string | null;
  action_href: string | null;
  read_at: string | null;
  created_at: string;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const loadAlerts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("app_alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setAlerts((data || []) as AppAlert[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("app_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, read_at: new Date().toISOString() } : a
      )
    );
  };

  const unreadCount = alerts.filter((a) => !a.read_at).length;

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
                  Important reminders and business checks that need your attention.
                </div>

                <div className="ff-alertSummary">
                  <div>
                    <div className="ff-alertSummaryLabel">Needs attention</div>
                    <div className="ff-alertSummaryText">
                      FixFlow watches for things that could cost you jobs or create admin problems.
                    </div>
                  </div>

                  <div className="ff-alertSummaryValue">{unreadCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {msg ? <div className="ff-msg">{msg}</div> : null}

        <div className="ff-stack">
          {loading ? (
            <div className="ff-card">
              <div className="ff-cardBody">
                <div className="ff-help">Loading alerts…</div>
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="ff-card">
              <div className="ff-cardBody">
                <div className="ff-emptyState">
                  <div className="ff-emptyIcon">✅</div>
                  <div className="ff-emptyTitle">No alerts right now</div>
                  <div className="ff-emptyText">
                    Everything looks up to date. FixFlow will let you know when something needs attention.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`ff-card ff-alertCard ${
                  alert.read_at ? "isRead" : "isUnread"
                }`}
              >
                <div className="ff-cardBody">
                  <div className="ff-alertRow">
                    <div className="ff-alertIcon">
                      {alert.type === "certificate_expiry" ? "⚠️" : "🔔"}
                    </div>

                    <div className="ff-alertMain">
                      <div className="ff-alertTop">
                        <div>
                          <div className="ff-alertTitle">{alert.title}</div>
                          <div className="ff-alertDate">
                            {new Date(alert.created_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>

                        {!alert.read_at ? (
                          <span className="ff-alertBadge">New</span>
                        ) : (
                          <span className="ff-alertBadge ff-alertBadgeRead">
                            Read
                          </span>
                        )}
                      </div>

                      <div className="ff-alertText">{alert.message}</div>

                      <div className="ff-alertActions">
                        {alert.action_href && alert.action_label ? (
                          <button
                            type="button"
                            className="ff-btn ff-btnPrimary"
                            onClick={() => {
                              window.location.href = alert.action_href!;
                            }}
                          >
                            {alert.action_label}
                          </button>
                        ) : null}

                        {!alert.read_at ? (
                          <button
                            type="button"
                            className="ff-btn"
                            onClick={() => markRead(alert.id)}
                          >
                            Mark as read
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
.ff-msg{
  border:1px solid #e6ecf5;
  background:#fff;
  border-radius:16px;
  padding:12px 14px;
  font-size:13px;
  color:#1f355c;
  margin-bottom:14px;
}

.ff-stack{
  display:flex;
  flex-direction:column;
  gap:14px;
}

.ff-cardBody{
  padding:20px;
}

.ff-alertSummary{
  margin-top:16px;
  padding:14px;
  border:1px solid #e6ecf5;
  border-radius:16px;
  background:linear-gradient(180deg,#f8fbff,#ffffff);
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:center;
}

.ff-alertSummaryLabel{
  font-size:12px;
  font-weight:900;
  color:#1f355c;
  text-transform:uppercase;
  letter-spacing:.08em;
}

.ff-alertSummaryText{
  margin-top:4px;
  font-size:12px;
  color:#5c6b84;
  line-height:1.4;
}

.ff-alertSummaryValue{
  width:46px;
  height:46px;
  border-radius:16px;
  background:#1f355c;
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:22px;
  font-weight:950;
}

.ff-alertCard{
  border:1px solid #e6ecf5;
  overflow:hidden;
}

.ff-alertCard.isUnread{
  border-color:#ffd6a8;
  background:linear-gradient(180deg,#fff7ed,#ffffff);
}

.ff-alertCard.isRead{
  opacity:.82;
}

.ff-alertRow{
  display:flex;
  gap:14px;
  align-items:flex-start;
}

.ff-alertIcon{
  width:42px;
  height:42px;
  border-radius:16px;
  background:#fff;
  border:1px solid #e6ecf5;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:20px;
  flex-shrink:0;
}

.ff-alertMain{
  flex:1;
  min-width:0;
}

.ff-alertTop{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
}

.ff-alertTitle{
  font-size:15px;
  font-weight:950;
  color:#0b1320;
}

.ff-alertDate{
  margin-top:3px;
  font-size:12px;
  color:#5c6b84;
  font-weight:700;
}

.ff-alertBadge{
  padding:6px 10px;
  border-radius:999px;
  background:#fff7ed;
  border:1px solid #ffd6a8;
  color:#9a4d00;
  font-size:11px;
  font-weight:900;
  white-space:nowrap;
}

.ff-alertBadgeRead{
  background:#f4f6fa;
  border-color:#e6ecf5;
  color:#5c6b84;
}

.ff-alertText{
  margin-top:10px;
  font-size:13px;
  color:#33445f;
  line-height:1.5;
}

.ff-alertActions{
  margin-top:14px;
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.ff-emptyState{
  text-align:center;
  padding:26px 10px;
}

.ff-emptyIcon{
  font-size:34px;
  margin-bottom:10px;
}

.ff-emptyTitle{
  font-size:16px;
  font-weight:950;
  color:#0b1320;
}

.ff-emptyText{
  margin:8px auto 0;
  max-width:420px;
  font-size:13px;
  color:#5c6b84;
  line-height:1.5;
}
`;