"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PayPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params?.invoiceId;

  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  console.log("PAY PAGE LOADED");
  console.log("PAY PAGE INVOICE ID:", invoiceId);

  if (!invoiceId) {
    setError("Missing invoice ID.");
    return;
  }

  const run = async () => {
    try {
      console.log("CALLING CHECKOUT API");

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceId }),
      });

      console.log("CHECKOUT RESPONSE STATUS:", res.status);

      const data = await res.json();

      console.log("CHECKOUT RESPONSE DATA:", data);

      if (!res.ok) {
        setError(data?.error || "Could not start payment.");
        return;
      }

      if (!data?.url) {
        setError("Payment link was not created.");
        return;
      }

      console.log("REDIRECTING TO STRIPE:", data.url);

      window.location.href = data.url;
    } catch (e: any) {
      console.error("PAY PAGE ERROR:", e);

      setError(e?.message || "Something went wrong.");
    }
  };

  run();
}, [invoiceId]);

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
          width: "min(420px, 100%)",
          borderRadius: 24,
          background: "#fff",
          border: "1px solid #e6ecf5",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0b2a55" }}>
          {error ? "Payment could not start" : "Redirecting to secure payment"}
        </div>

        <div style={{ marginTop: 10, fontSize: 14, color: "#64748b" }}>
          {error || "Please wait a moment…"}
        </div>
      </div>
    </div>
  );
}