"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function PaySuccessInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const invoiceId = searchParams.get("invoiceId");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "system-ui",
        background: "#f6f8fc",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          borderRadius: 24,
          background: "#fff",
          border: "1px solid #e6ecf5",
          padding: 26,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 34 }}>✅</div>

        <h1 style={{ margin: "12px 0 8px", color: "#0b2a55" }}>
          Payment received
        </h1>

        <p style={{ color: "#64748b", lineHeight: 1.5 }}>
          Thanks, your invoice payment has been completed successfully.
        </p>

        <button
          type="button"
          onClick={() =>
            router.push(invoiceId ? `/pay/${invoiceId}` : "/")
          }
          style={{
            marginTop: 18,
            height: 42,
            padding: "0 18px",
            borderRadius: 999,
            border: "none",
            background: "#0b2a55",
            color: "#fff",
            fontWeight: 800,
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaySuccessInner />
    </Suspense>
  );
}