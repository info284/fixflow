"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ReceiptInner() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(180deg, #EEF4FF 0%, #F8FBFF 45%, #FFFFFF 100%)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "min(540px, 100%)",
          borderRadius: 30,
          background: "#FFFFFF",
          border: "1px solid #E6ECF5",
          padding: 36,
          textAlign: "center",
          boxShadow: "0 30px 80px rgba(11, 42, 85, 0.12)",
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: 28,
            background: "linear-gradient(135deg, #245BFF 0%, #0B2A55 100%)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 26px",
            color: "#FFFFFF",
            fontSize: 42,
            fontWeight: 900,
            boxShadow: "0 22px 50px rgba(36, 91, 255, 0.35)",
          }}
        >
          ✓
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "#245BFF",
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Payment successful
        </div>

        <h1
          style={{
            color: "#0B1320",
            margin: "0 0 14px",
            fontSize: 38,
            lineHeight: 1.1,
            fontWeight: 950,
            letterSpacing: "-0.04em",
          }}
        >
          Payment received
        </h1>

        <p
          style={{
            color: "#5C6B84",
            lineHeight: 1.8,
            fontSize: 16,
            margin: "0 auto 28px",
            maxWidth: 420,
          }}
        >
          Thank you. Your invoice payment has been completed successfully.
          A confirmation receipt has been emailed to you.
        </p>

        {invoiceId ? (
          <div
            style={{
              marginTop: 10,
              marginBottom: 28,
              textAlign: "left",
              border: "1px solid #E6ECF5",
              borderRadius: 22,
              overflow: "hidden",
              background: "#FFFFFF",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #E6ECF5",
                background: "#F8FBFF",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#5C6B84",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Payment reference
              </div>
            </div>

            <div
              style={{
                padding: 22,
                fontSize: 28,
                fontWeight: 950,
                color: "#0B1320",
                letterSpacing: "-0.04em",
              }}
            >
              {invoiceId.slice(0, 8).toUpperCase()}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => (window.location.href = "/")}
          style={{
            height: 54,
            padding: "0 32px",
            borderRadius: 999,
            border: "none",
            background:
              "linear-gradient(135deg, #245BFF 0%, #0B2A55 100%)",
            color: "#FFFFFF",
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 18px 40px rgba(36, 91, 255, 0.35)",
          }}
        >
          Done
        </button>

        <div
          style={{
            marginTop: 18,
            color: "#94A3B8",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Powered securely by FixFlow & Stripe
        </div>
      </div>
    </main>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={null}>
      <ReceiptInner />
    </Suspense>
  );
}