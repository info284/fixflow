"use client";

import { useEffect } from "react";

export default function PayPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  const invoiceId = params.invoiceId;

  useEffect(() => {
    if (!invoiceId) return;

    const goToStripe = async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invoiceId }),
        });

        const data = await res.json();

        if (data?.url) {
          window.location.href = data.url;
        } else {
          console.error("No Stripe URL returned");
        }
      } catch (err) {
        console.error("Stripe redirect failed", err);
      }
    };

    goToStripe();
  }, [invoiceId]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>
          Redirecting to secure payment…
        </div>
        <div style={{ marginTop: 10, fontSize: 14, opacity: 0.6 }}>
          Please wait a moment
        </div>
      </div>
    </div>
  );
}