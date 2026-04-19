"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type Estimate = {
  id: string;
  request_id?: string | null;
  total: number | null;
  status: string | null;
  customer_name: string | null;
  job_type: string | null;
  view_count?: number | null;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  accepted_at?: string | null;
};

function niceDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(value?: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

export default function AcceptEstimatePage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEstimate = useCallback(async () => {
    if (!id) return;

    try {
      setError(null);

      const res = await fetch(`/api/estimates/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load estimate");
      }

      const loadedEstimate = json?.estimate as Estimate;
      setEstimate(loadedEstimate);
      setAccepted(
        String(loadedEstimate?.status || "").toLowerCase() === "accepted"
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load estimate");
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEstimate();
  }, [loadEstimate]);

  const trackView = useCallback(async () => {
    if (!id) return;

    try {
      await fetch("/api/estimate/view", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("Failed to track view", err);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let sent = false;

    const handleRealView = () => {
      if (sent) return;
      sent = true;
      trackView();
    };

    window.addEventListener("click", handleRealView, { once: true });
    window.addEventListener("scroll", handleRealView, { once: true });

    const timer = window.setTimeout(handleRealView, 3000);

    return () => {
      window.removeEventListener("click", handleRealView);
      window.removeEventListener("scroll", handleRealView);
      window.clearTimeout(timer);
    };
  }, [id, trackView]);

  async function handleAccept() {
    if (!id || busy) return;

    try {
      setBusy(true);
      setError(null);

      const res = await fetch(`/api/estimates/${id}/accept`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to accept estimate");
      }

      setAccepted(true);
      setEstimate((prev) =>
        prev
          ? {
              ...prev,
              status: "accepted",
              accepted_at: json?.accepted_at || new Date().toISOString(),
            }
          : prev
      );
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="ff-acceptPage">
        <div className="ff-acceptBgGlow ff-acceptBgGlowOne" />
        <div className="ff-acceptBgGlow ff-acceptBgGlowTwo" />

        <div className="ff-acceptShell">
          <div className="ff-acceptTop">
            <div className="ff-acceptBrandWrap">
              <div className="ff-acceptLogo">F</div>
              <div className="ff-acceptBrandText">
                <div className="ff-acceptBrand">FixFlow</div>
                <div className="ff-acceptBrandSub">Customer estimate</div>
              </div>
            </div>
          </div>

          <div className="ff-acceptCard">
            <div className="ff-acceptLoadingWrap">
              <div className="ff-acceptLoadingDot" />
              <div className="ff-acceptTitle">Loading estimate…</div>
              <div className="ff-acceptSub">
                Just getting everything ready for you.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="ff-acceptPage">
        <div className="ff-acceptBgGlow ff-acceptBgGlowOne" />
        <div className="ff-acceptBgGlow ff-acceptBgGlowTwo" />

        <div className="ff-acceptShell">
          <div className="ff-acceptTop">
            <div className="ff-acceptBrandWrap">
              <div className="ff-acceptLogo">F</div>
              <div className="ff-acceptBrandText">
                <div className="ff-acceptBrand">FixFlow</div>
                <div className="ff-acceptBrandSub">Customer estimate</div>
              </div>
            </div>
          </div>

          <div className="ff-acceptCard">
            <div className="ff-acceptHero ff-acceptHeroStack">
              <div className="ff-acceptHeroText">
                <div className="ff-acceptEyebrow">Estimate link</div>
                <h1 className="ff-acceptTitle">Estimate not found</h1>
                <p className="ff-acceptSub">
                  This estimate link may have expired or is no longer available.
                </p>
              </div>

              <div className="ff-acceptStateIcon ff-acceptStateIconMuted">?</div>
            </div>

            {error ? <div className="ff-acceptError">{error}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ff-acceptPage">
      <div className="ff-acceptBgGlow ff-acceptBgGlowOne" />
      <div className="ff-acceptBgGlow ff-acceptBgGlowTwo" />

      <div className="ff-acceptShell">
        <div className="ff-acceptTop">
          <div className="ff-acceptBrandWrap">
            <div className="ff-acceptLogo">F</div>
            <div className="ff-acceptBrandText">
              <div className="ff-acceptBrand">FixFlow</div>
              <div className="ff-acceptBrandSub">Customer estimate</div>
            </div>
          </div>

          <div className="ff-acceptBadge">
            {accepted ? "Accepted" : "Ready to review"}
          </div>
        </div>

        <div className="ff-acceptCard">
          <div className="ff-acceptHero">
            <div className="ff-acceptHeroText">
              <div className="ff-acceptEyebrow">Estimate summary</div>

              <h1 className="ff-acceptTitle">
                {accepted ? "Estimate accepted" : "Review your estimate"}
              </h1>

              <p className="ff-acceptSub">
                {accepted
                  ? "Your acceptance has been sent to the trader successfully."
                  : "Please check the details below, then confirm if you’d like to go ahead."}
              </p>
            </div>

            <div className="ff-acceptPriceCard">
              <div className="ff-acceptPriceLabel">Total estimate</div>
              <div className="ff-acceptPriceValue">{money(estimate.total)}</div>
              <div className="ff-acceptPriceSub">
                {accepted ? "Confirmed" : "Ready to accept"}
              </div>
            </div>
          </div>

          <div className="ff-acceptSummary">
            <div className="ff-acceptRow">
              <span>Customer</span>
              <strong>{estimate.customer_name || "—"}</strong>
            </div>

            <div className="ff-acceptRow">
              <span>Job</span>
              <strong>{estimate.job_type || "—"}</strong>
            </div>

            <div className="ff-acceptRow">
              <span>Status</span>
              <strong>{accepted ? "Accepted" : "Pending review"}</strong>
            </div>

            <div className="ff-acceptRow">
              <span>Views</span>
              <strong>{estimate.view_count || 0}</strong>
            </div>

            <div className="ff-acceptRow">
              <span>Last viewed</span>
              <strong>
                {estimate.last_viewed_at
                  ? niceDateTime(estimate.last_viewed_at)
                  : "Just opened"}
              </strong>
            </div>

            {accepted ? (
              <div className="ff-acceptRow">
                <span>Accepted at</span>
                <strong>{niceDateTime(estimate.accepted_at)}</strong>
              </div>
            ) : null}
          </div>

          {!accepted ? (
            <div className="ff-acceptActionWrap">
              <button
                type="button"
                onClick={handleAccept}
                disabled={busy}
                className="ff-acceptButton"
              >
                {busy ? "Accepting…" : "Accept estimate"}
              </button>

              <div className="ff-acceptHint">
                Secure confirmation • No payment taken at this stage
              </div>
            </div>
          ) : (
            <div className="ff-acceptSuccessBlock">
              <div className="ff-acceptSuccessTop">
                <div className="ff-acceptSuccessIcon">✓</div>

                <div>
                  <div className="ff-acceptSuccessTitle">You’re all set</div>
                  <div className="ff-acceptSuccessText">
                    Your trader has been notified that you want to go ahead.
                  </div>
                </div>
              </div>

              <div className="ff-acceptNextSteps">
                <div className="ff-acceptNextStepsTitle">What happens next</div>

                <div className="ff-acceptNextStepList">
                  <div className="ff-acceptNextStepItem">
                    <span className="ff-acceptStepDot" />
                    <span>The enquiry moves into the trader’s booked work.</span>
                  </div>

                  <div className="ff-acceptNextStepItem">
                    <span className="ff-acceptStepDot" />
                    <span>The trader will contact you shortly to arrange the job.</span>
                  </div>

                  <div className="ff-acceptNextStepItem">
                    <span className="ff-acceptStepDot" />
                    <span>You do not need to do anything else right now.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error ? <div className="ff-acceptError">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}