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

export default function PayInvoiceClient({ invoice }: { invoice: Invoice }) {
  const [loading, setLoading] = useState(false);
  const amount = Number(invoice.amount || 0);

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

      const json = await res.json();

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
    return <div>This invoice has already been paid. Thank you.</div>;
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%", border: "1px solid #e5e7eb", borderRadius: 20, padding: 24 }}>
        <h1>Pay invoice</h1>

        <p>
          Invoice: <strong>{invoice.invoice_number || invoice.id.slice(0, 8)}</strong>
        </p>

        <p>
          Amount due: <strong>£{amount.toFixed(2)}</strong>
        </p>

        <button
          type="button"
          onClick={startPayment}
          disabled={loading || amount <= 0}
          style={{
            width: "100%",
            height: 46,
            borderRadius: 999,
            border: "none",
            background: "#245BFF",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {loading ? "Starting secure payment…" : "Pay securely by card"}
        </button>
      </div>
    </main>
  );
}