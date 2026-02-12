"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type CoverageStatus = "idle" | "checking" | "yes" | "no";

export default function MarketplaceClient() {
  const searchParams = useSearchParams();

  // Expect the link to look like: /marketplace?tradeId=UUID
  const tradeId = useMemo(() => searchParams.get("tradeId") || "", [searchParams]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState("");

  const [coverageStatus, setCoverageStatus] = useState<CoverageStatus>("idle");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [submitError, setSubmitError] = useState<string>("");

  const canContinue = coverageStatus === "yes";

  return (
    <div style={{ padding: 24 }}>
      <h1>Marketplace</h1>
      <p style={{ color: "#64748B" }}>tradeId: {tradeId || "—"}</p>

      {/* your existing UI continues here exactly as you had it */}
      {/* keep all your form, buttons, fetch calls, etc */}
    </div>
  );
}