"use client";

import { useEffect, useState } from "react";

export default function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const p = await params;
      setToken(p.token);
    };

    load();
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
          Review page
        </div>
        <div style={{ marginTop: 10, fontSize: 14, opacity: 0.6 }}>
          Token: {token || "Loading..."}
        </div>
      </div>
    </div>
  );
}