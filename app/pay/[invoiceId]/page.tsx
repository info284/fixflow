"use client";

import { useEffect } from "react";

export default function PayPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  useEffect(() => {
    const run = async () => {
      const p = await params;

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceId: p.invoiceId,
        }),
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned", data);
      }
    };

    run();
  }, [params]);

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
          Redirecting to secure payment...
        </div>
        <div style={{ marginTop: 10, fontSize: 14, opacity: 0.6 }}>
          Please wait a moment
        </div>
      </div>
    </div>
  );
}