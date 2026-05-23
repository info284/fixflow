"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ReceiptInner() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");

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
        <div style={{ fontSize: 42 }}>✅</div>

        <h1 style={{ color: "#0b2a55", marginBottom: 8 }}>
          Payment received
        </h1>

        <p style={{ color: "#64748b", lineHeight: 1.5 }}>
          Thanks, your invoice payment has been completed successfully.
          A receipt will be sent by email once the payment has been confirmed.
        </p>

        {invoiceId ? (
          <div
            style={{
              marginTop: 20,
              textAlign: "left",
              border: "1px solid #e6ecf5",
              borderRadius: 18,
              padding: 16,
              background: "#f8fbff",
              color: "#0b1320",
            }}
          >
            <p>
              <strong>Reference:</strong> {invoiceId.slice(0, 8)}
            </p>
          </div>
        ) : null}

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