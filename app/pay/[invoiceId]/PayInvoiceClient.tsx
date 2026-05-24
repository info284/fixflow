"use client";

import { useState } from "react";

type Invoice = {
  id: string;
  amount: number;
  currency: string | null;
  invoice_number: string | null;
  to_email: string | null;
  status: string | null;
};

function formatMoney(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(amount || 0));
}

export default function PayInvoiceClient({ invoice }: { invoice: Invoice }) {
  const [loading, setLoading] = useState(false);

  const amount = Number(invoice.amount || 0);
  const currency = invoice.currency || "GBP";
  const invoiceRef = invoice.invoice_number || invoice.id.slice(0, 8);

  async function startPayment() {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Could not start payment");
      }

      window.location.href = json.url;
    } catch (e: any) {
      alert(e?.message || "Payment failed to start");
    } finally {
      setLoading(false);
    }
  }

  if (invoice.status === "paid") {
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(180deg, #EEF4FF 0%, #F8FBFF 45%, #FFFFFF 100%)",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            background: "#FFFFFF",
            border: "1px solid #E6ECF5",
            borderRadius: 28,
            padding: 32,
            boxShadow: "0 30px 80px rgba(11, 42, 85, 0.12)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 82,
              height: 82,
              borderRadius: 24,
              background: "linear-gradient(135deg, #245BFF 0%, #0B2A55 100%)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 24px",
              color: "#FFFFFF",
              fontSize: 38,
              fontWeight: 900,
              boxShadow: "0 20px 40px rgba(36, 91, 255, 0.35)",
            }}
          >
            ✓
          </div>

          <h1 style={{ margin: "0 0 10px", color: "#0B1320", fontSize: 28 }}>
            Already paid
          </h1>

          <p style={{ margin: 0, color: "#5C6B84", lineHeight: 1.6 }}>
            This invoice has already been paid. Thank you.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #EEF4FF 0%, #F8FBFF 45%, #FFFFFF 100%)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 32,
          boxShadow: "0 30px 80px rgba(11, 42, 85, 0.12)",
          border: "1px solid #E6ECF5",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "linear-gradient(135deg, #245BFF 0%, #0B2A55 100%)",
            display: "grid",
            placeItems: "center",
            color: "#FFFFFF",
            fontSize: 32,
            marginBottom: 24,
            boxShadow: "0 18px 40px rgba(36, 91, 255, 0.25)",
          }}
        >
          💳
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "#245BFF",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          FixFlow secure payment
        </div>

        <h1
          style={{
            fontSize: 34,
            lineHeight: 1.1,
            fontWeight: 950,
            color: "#0B1320",
            margin: "0 0 16px",
          }}
        >
          Pay your invoice
        </h1>

        <p
          style={{
            color: "#5C6B84",
            fontSize: 15,
            lineHeight: 1.7,
            margin: "0 0 24px",
          }}
        >
          Complete your card payment securely. You’ll receive a receipt by email
          once payment has been confirmed.
        </p>

        <div
          style={{
            border: "1px solid #E6ECF5",
            borderRadius: 22,
            overflow: "hidden",
            marginBottom: 24,
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              padding: 18,
              borderBottom: "1px solid #E6ECF5",
              background: "#F8FBFF",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: "#5C6B84",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Invoice number
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: "#0B1320",
              }}
            >
              {invoiceRef}
            </div>
          </div>

          <div
            style={{
              padding: 22,
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: "#5C6B84",
                  marginBottom: 6,
                  fontWeight: 700,
                }}
              >
                Total due
              </div>

              <div
                style={{
                  fontSize: 36,
                  fontWeight: 950,
                  color: "#0B1320",
                  letterSpacing: "-0.04em",
                }}
              >
                {formatMoney(amount, currency)}
              </div>
            </div>

            <div
              style={{
                background: "#ECFDF3",
                color: "#027A48",
                padding: "10px 14px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              Secure
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={startPayment}
          disabled={loading || amount <= 0}
          style={{
            width: "100%",
            height: 58,
            borderRadius: 999,
            border: "none",
            background:
              loading || amount <= 0
                ? "#94A3B8"
                : "linear-gradient(135deg, #245BFF 0%, #0B2A55 100%)",
            color: "#FFFFFF",
            fontWeight: 950,
            fontSize: 17,
            cursor: loading || amount <= 0 ? "not-allowed" : "pointer",
            boxShadow:
              loading || amount <= 0
                ? "none"
                : "0 18px 40px rgba(36, 91, 255, 0.35)",
          }}
        >
          {loading ? "Starting secure payment…" : "Pay securely by card"}
        </button>

        <div
          style={{
            marginTop: 18,
            fontSize: 13,
            lineHeight: 1.6,
            color: "#5C6B84",
            textAlign: "center",
          }}
        >
          Card payments are securely processed by Stripe.
        </div>
      </div>
    </main>
  );
}