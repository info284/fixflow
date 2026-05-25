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
        padding: 20,
        background: "#eef4f8",
       fontFamily:
  "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
          
      }}
    >
      <div
        style={{
          width: "min(540px, 100%)",
          borderRadius: 32,
          background: "#FFFFFF",
          border: "1px solid #E6ECF5",
          overflow: "hidden",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            background: "#1F355C",
            padding: "38px 30px",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Payment confirmed
          </div>

          <h1
            style={{
              color: "#FFFFFF",
              margin: 0,
              fontSize: 38,
              lineHeight: 1.08,
              fontWeight: 950,
              letterSpacing: "-0.035em",
            }}
          >
            Payment received
          </h1>
        </div>

        <div style={{ padding: 30 }}>
          <div
            style={{
              width: 78,
              height: 78,
              borderRadius: 24,
              background: "#F4F8FE",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 22px",
              color: "#1F355C",
              fontSize: 38,
              fontWeight: 950,
              border: "1px solid #E6ECF5",
            }}
          >
            ✓
          </div>

          <p
            style={{
              color: "#5F708A",
              lineHeight: 1.8,
              fontSize: 16,
              margin: "0 auto 28px",
              maxWidth: 410,
            }}
          >
            Thank you. Your invoice payment has been completed securely. A
            receipt has been emailed to you.
          </p>

          {invoiceId ? (
            <div
              style={{
                marginBottom: 28,
                textAlign: "left",
                border: "1px solid #E6ECF5",
                borderRadius: 22,
                overflow: "hidden",
                background: "#F8FBFF",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid #E6ECF5",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#5F708A",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Payment reference
                </div>
              </div>

              <div
                style={{
                  padding: 22,
                  fontSize: 26,
                  fontWeight: 950,
                  color: "#1F355C",
                  letterSpacing: "-0.035em",
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
              padding: "0 34px",
              borderRadius: 999,
              border: "none",
              background: "#1F355C",
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 12px 28px rgba(31, 53, 92, 0.18)",
            }}
          >
            Done
          </button>

          <div
            style={{
              marginTop: 20,
              color: "#5F708A",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            Powered by FixFlow. Card payments processed securely by Stripe.
          </div>
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