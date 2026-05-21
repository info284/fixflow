"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function ReceiptInner() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    async function run() {
      if (!invoiceId) {
        setError("Missing invoice reference.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/stripe/payment-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Could not confirm payment.");
        setLoading(false);
        return;
      }

      setInvoice(data.invoice);
      setLoading(false);
    }

    run();
  }, [invoiceId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f6f8fc",
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 26,
          background: "#fff",
          border: "1px solid #e6ecf5",
          padding: 28,
          textAlign: "center",
          boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
        }}
      >
        {loading ? (
          <>
            <h1 style={{ color: "#0b2a55" }}>Confirming payment…</h1>
            <p style={{ color: "#64748b" }}>Please wait a moment.</p>
          </>
        ) : error ? (
          <>
            <div style={{ fontSize: 34 }}>⚠️</div>
            <h1 style={{ color: "#0b2a55" }}>Payment received</h1>
            <p style={{ color: "#64748b" }}>{error}</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 42 }}>✅</div>

            <h1 style={{ color: "#0b2a55", marginBottom: 8 }}>
              Payment received
            </h1>

            <p style={{ color: "#64748b", lineHeight: 1.5 }}>
              Thanks, your invoice payment has been completed successfully.
              A receipt has been sent by email.
            </p>

            <div
              style={{
                marginTop: 20,
                textAlign: "left",
                border: "1px solid #e6ecf5",
                borderRadius: 18,
                padding: 16,
                background: "#f8fbff",
              }}
            >
              <p><strong>Invoice:</strong> {invoice?.invoice_number || invoice?.id}</p>
              <p><strong>Amount paid:</strong> {money(invoice?.amount)}</p>
              <p><strong>Job:</strong> {invoice?.job_type || "Work completed"}</p>
              <p><strong>Reference:</strong> {invoice?.job_number || "—"}</p>
            </div>

            <button
              type="button"
              onClick={() => (window.location.href = "/")}
              style={{
                marginTop: 20,
                height: 44,
                padding: "0 22px",
                borderRadius: 999,
                border: "none",
                background: "#0b2a55",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={null}>
      <ReceiptInner />
    </Suspense>
  );
}