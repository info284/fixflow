"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type MessageRow = {
  id: string;
  direction: string | null;
  body_text: string | null;
  subject: string | null;
  created_at: string;
};

type MessagePageData = {
  requestId: string;
  customerName: string | null;
  traderName: string | null;
  jobType: string | null;
  messages: MessageRow[];
};

function niceDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOutbound(direction?: string | null) {
  const v = String(direction || "").toLowerCase();
  return v === "out" || v === "outbound" || v.includes("out");
}

export default function CustomerMessagePage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [data, setData] = useState<MessagePageData | null>(null);
  const [message, setMessage] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function loadThread() {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/message-thread/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load messages");
      }

      setData(json);
      setCustomerEmail(json?.customerEmail || "");
    } catch (e: any) {
      setError(e?.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThread();
  }, [id]);

  async function sendReply() {
    if (!id) return;
    if (!message.trim()) {
      setError("Please type a message");
      return;
    }

    try {
      setSending(true);
      setError(null);
      setOkMsg(null);

      const res = await fetch("/api/message-thread/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
       body: JSON.stringify({
  requestId: id,
  message: message.trim(),
  customerEmail: customerEmail.trim(),
}),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to send message");
      }

      setMessage("");
      setOkMsg("Message sent");
      await loadThread();
    } catch (e: any) {
      setError(e?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  const title = useMemo(() => {
    if (!data) return "Messages";
    return data.jobType
      ? `${data.traderName || "Trader"} • ${data.jobType}`
      : `${data.traderName || "Trader"} • Messages`;
  }, [data]);

  if (loading) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>Loading…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>{error}</div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={shellStyle}>
        <div style={headStyle}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#1f355c" }}>
            Messages
          </div>
          <div style={{ fontSize: 14, color: "#5c6b84", marginTop: 6 }}>
            {title}
          </div>
        </div>

        <div style={threadStyle}>
          {data?.messages?.length ? (
            data.messages.map((m) => {
              const outbound = isOutbound(m.direction);

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: outbound ? "flex-start" : "flex-end",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "12px 14px",
                      borderRadius: 18,
                      border: "1px solid #e6ecf5",
                      background: outbound ? "#f4f7ff" : "#1f355c",
                      color: outbound ? "#0b1320" : "#ffffff",
                      boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
                    }}
                  >
                    {m.subject ? (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          marginBottom: 6,
                          opacity: 0.9,
                        }}
                      >
                        {m.subject}
                      </div>
                    ) : null}

                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 14,
                        lineHeight: 1.55,
                      }}
                    >
                      {m.body_text || "—"}
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        opacity: 0.75,
                      }}
                    >
                      {outbound ? data?.traderName || "Trader" : data?.customerName || "You"} •{" "}
                      {niceDate(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: "#5c6b84", fontSize: 14 }}>No messages yet.</div>
          )}
        </div>

        <div style={composerWrapStyle}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#5c6b84", marginBottom: 8 }}>
            Reply
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message…"
            style={textareaStyle}
          />

          {error ? (
            <div style={{ marginTop: 10, color: "#b91c1c", fontSize: 13 }}>{error}</div>
          ) : null}

          {okMsg ? (
            <div style={{ marginTop: 10, color: "#116b3a", fontSize: 13 }}>{okMsg}</div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              onClick={sendReply}
              disabled={sending}
              style={buttonStyle}
            >
              {sending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f8fc",
  padding: 16,
};

const shellStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  background: "#ffffff",
  border: "1px solid #e6ecf5",
  borderRadius: 24,
  overflow: "hidden",
  boxShadow: "0 20px 50px rgba(15,23,42,0.08)",
};

const headStyle: React.CSSProperties = {
  padding: 24,
  borderBottom: "1px solid #e6ecf5",
  background:
    "linear-gradient(135deg, rgba(36,91,255,0.10), rgba(255,255,255,0.96))",
};

const threadStyle: React.CSSProperties = {
  padding: 18,
  background: "#fbfcff",
  minHeight: 420,
};

const composerWrapStyle: React.CSSProperties = {
  borderTop: "1px solid #e6ecf5",
  padding: 18,
  background: "#ffffff",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  border: "1px solid #e6ecf5",
  borderRadius: 16,
  padding: 12,
  fontSize: 14,
  lineHeight: 1.5,
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  height: 42,
  padding: "0 18px",
  border: "none",
  borderRadius: 999,
  background: "#1f355c",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  background: "#fff",
  border: "1px solid #e6ecf5",
  borderRadius: 20,
  padding: 24,
};