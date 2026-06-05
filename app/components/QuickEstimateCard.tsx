"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  QuoteRequestRow,
  TraderProfile,
} from "@/app/dashboard/enquiries/EnquiriesClient";

type Props = {
  selectedQuote: QuoteRequestRow;
  trader: TraderProfile | null;
  onScheduleJob?: () => void;
  onCreateInvoice?: () => void;
};

type EstimateStatus = "draft" | "sent" | "accepted";

type ExistingEstimate = {
  id: string;
  labour_amount: number | null;
  materials_amount: number | null;
  other_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  status: EstimateStatus;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number | null;
  accepted_at: string | null;
};

type SmartSuggestion = {
  template: "callout" | "repair" | "labour" | null;
  labour: number;
  materials: number;
  other: number;
  notes: string;
  label: string;
};

function moneyInputValue(value: number | null | undefined) {
  const n = Number(value || 0);
  return n > 0 ? String(n) : "";
}

function toNumber(value: string) {
  return Number(value || 0);
}

function getSmartSuggestion(jobType?: string | null): SmartSuggestion | null {
  const type = String(jobType || "").toLowerCase().trim();

  if (!type) return null;

  if (
    type.includes("tap") ||
    type.includes("toilet handle") ||
    type.includes("washer") ||
    type.includes("small leak")
  ) {
    return {
      template: "repair",
      labour: 95,
      materials: 25,
      other: 0,
      notes: "Guide price based on the job description provided.",
      label: "Small plumbing repair",
    };
  }

  if (
    type.includes("callout") ||
    type.includes("inspection") ||
    type.includes("quote visit") ||
    type.includes("diagnostic")
  ) {
    return {
      template: "callout",
      labour: 90,
      materials: 0,
      other: 0,
      notes: "Includes callout and inspection.",
      label: "Callout / inspection",
    };
  }

  if (
    type.includes("install") ||
    type.includes("replacement") ||
    type.includes("fit") ||
    type.includes("labour only")
  ) {
    return {
      template: "labour",
      labour: 110,
      materials: 0,
      other: 0,
      notes: "Guide labour price based on the description provided.",
      label: "Labour-based job",
    };
  }

  return {
    template: "repair",
    labour: 100,
    materials: 20,
    other: 0,
    notes: "Guide price based on the description provided.",
    label: "Guide price",
  };
}

export default function QuickEstimateCard({
  selectedQuote,
  trader,
  onScheduleJob,
  onCreateInvoice,
}: Props) {
  const [labour, setLabour] = useState("");
  const [materials, setMaterials] = useState("");
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");

  const [estimateId, setEstimateId] = useState<string | null>(null);
  const [estimateStatus, setEstimateStatus] = useState<EstimateStatus | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [averagePrice, setAveragePrice] = useState<number | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [firstViewedAt, setFirstViewedAt] = useState<string | null>(null);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  const [draftSaved, setDraftSaved] = useState(false);
  const [quickPriceSent, setQuickPriceSent] = useState(false);

  const isAccepted = estimateStatus === "accepted";

  const labourValue = toNumber(labour);
  const materialsValue = toNumber(materials);
  const otherValue = toNumber(other);

  const total = useMemo(() => {
    return labourValue + materialsValue + otherValue;
  }, [labourValue, materialsValue, otherValue]);

  const LABOUR_COST_RATIO = 0.4;
  const OVERHEAD_RATIO = 0.1;

  const labourCost = labourValue * LABOUR_COST_RATIO;
  const baseCost = materialsValue + labourCost;
  const overhead = baseCost * OVERHEAD_RATIO;
  const cost = baseCost + overhead;
  const profit = total - cost;
  const margin = total > 0 ? Math.round((profit / total) * 100) : 0;

  const urgency = String(selectedQuote?.urgency || "").toLowerCase();

  const urgencyClass =
    urgency.includes("asap") ||
    urgency.includes("urgent") ||
    urgency.includes("today")
      ? "ff-leftGlowASAP"
      : urgency.includes("this week") || urgency.includes("this-week")
      ? "ff-leftGlowWeek"
      : urgency.includes("next week") || urgency.includes("next-week")
      ? "ff-leftGlowNext"
      : "ff-leftGlowFlexible";

  const smartSuggestion = useMemo(() => {
    return getSmartSuggestion(selectedQuote?.job_type);
  }, [selectedQuote?.job_type]);

  function applyTemplate(type: "callout" | "repair" | "labour") {
    if (type === "callout") {
      setLabour("90");
      setMaterials("");
      setOther("");
      setNotes("Includes initial callout and inspection.");
      return;
    }

    if (type === "repair") {
      setLabour("120");
      setMaterials("30");
      setOther("");
      setNotes("Guide repair price based on the description provided.");
      return;
    }

    setLabour("100");
    setMaterials("");
    setOther("");
    setNotes("Labour-only guide price.");
  }

  function applySmartSuggestion() {
    if (!smartSuggestion) return;

    setLabour(moneyInputValue(smartSuggestion.labour));
    setMaterials(moneyInputValue(smartSuggestion.materials));
    setOther(moneyInputValue(smartSuggestion.other));
    setNotes((prev) => prev || smartSuggestion.notes);
  }

  useEffect(() => {
    async function loadExistingEstimate() {
      if (!selectedQuote?.id) return;

      setMsg(null);
      setEstimateId(null);
      setEstimateStatus(null);
      setLabour("");
      setMaterials("");
      setOther("");
      setNotes("");
      setViewCount(0);
      setFirstViewedAt(null);
      setLastViewedAt(null);
      setAcceptedAt(null);
      setAveragePrice(null);

      const { data, error } = await supabase
        .from("quick_estimates")
        .select(
          "id, labour_amount, materials_amount, other_amount, total_amount, notes, status, first_viewed_at, last_viewed_at, view_count, accepted_at"
        )
        .eq("request_id", selectedQuote.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("load quick estimate failed:", error.message);
        return;
      }

      const { data: historyData, error: historyError } = await supabase
        .from("quick_estimates")
        .select("total_amount")
        .limit(10);

      if (!historyError && historyData?.length) {
        const avg =
          historyData.reduce(
            (sum, r) => sum + Number(r.total_amount || 0),
            0
          ) / historyData.length;

        setAveragePrice(Math.round(avg));
      }

      const existing = data as ExistingEstimate | null;

      if (!existing) {
        const suggestion = getSmartSuggestion(selectedQuote?.job_type);

        if (suggestion) {
          setLabour(moneyInputValue(suggestion.labour));
          setMaterials(moneyInputValue(suggestion.materials));
          setOther(moneyInputValue(suggestion.other));
          setNotes(suggestion.notes);
        }

        return;
      }

      setEstimateId(existing.id);
      setEstimateStatus(existing.status);
      setLabour(moneyInputValue(existing.labour_amount));
      setMaterials(moneyInputValue(existing.materials_amount));
      setOther(moneyInputValue(existing.other_amount));
      setNotes(existing.notes || "");
      setViewCount(Number(existing.view_count || 0));
      setFirstViewedAt(existing.first_viewed_at || null);
      setLastViewedAt(existing.last_viewed_at || null);
      setAcceptedAt(existing.accepted_at || null);
    }

    loadExistingEstimate();
  }, [selectedQuote?.id, selectedQuote?.job_type]);

  async function saveEstimate(nextStatus: EstimateStatus) {
    if (!selectedQuote?.id) return;

    setSaving(true);
    setMsg(null);

    if (nextStatus === "draft") setDraftSaved(false);
    if (nextStatus === "sent") setQuickPriceSent(false);

    let savedEstimateId = estimateId;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("You must be logged in.");

      const payload = {
        request_id: selectedQuote.id,
        plumber_id: user.id,
        estimate_type: "rough",
        labour_amount: labourValue,
        materials_amount: materialsValue,
        other_amount: otherValue,
        total_amount: total,
        notes,
        status: nextStatus,
      };

      if (estimateId) {
        const { error } = await supabase
          .from("quick_estimates")
          .update(payload)
          .eq("id", estimateId)
          .eq("plumber_id", user.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("quick_estimates")
          .insert(payload)
          .select("id, status")
          .single();

        if (error) throw error;

        savedEstimateId = data.id;
        setEstimateId(data.id);
        setEstimateStatus(data.status as EstimateStatus);
      }

      if (nextStatus === "sent") {
        const to = String(selectedQuote.customer_email || "").trim();
        if (!to) throw new Error("Customer email is missing.");
        if (!savedEstimateId) throw new Error("Estimate ID missing.");

        const traderName =
          trader?.business_name || trader?.display_name || "Your business";

        const res = await fetch("/api/enquiries/send-estimate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            estimateId: savedEstimateId,
            requestId: selectedQuote.id,
            plumberId: user.id,
            to,
            customerName: selectedQuote.customer_name || "there",
            traderName,
            traderLogoUrl: trader?.logo_url || null,
            jobNumber: selectedQuote.job_number || "Estimate",
            jobType: selectedQuote.job_type || "Job",
            labourAmount: labourValue,
            materialsAmount: materialsValue,
            otherAmount: otherValue,
            totalAmount: total,
            notes,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Estimate email failed.");
        }
      }

      setEstimateStatus(nextStatus);

      if (nextStatus === "accepted") {
        setAcceptedAt(new Date().toISOString());
      }

      if (nextStatus === "draft") {
        setDraftSaved(true);
        window.setTimeout(() => setDraftSaved(false), 2000);
      }

      if (nextStatus === "sent") {
        setQuickPriceSent(true);
        window.setTimeout(() => setQuickPriceSent(false), 2000);
      }

      setMsg(
        nextStatus === "draft"
          ? "Guide price saved"
          : nextStatus === "accepted"
          ? "Guide price accepted"
          : "Guide price sent"
      );
    } catch (e: any) {
      setMsg(e?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function niceActivityDate(iso?: string | null) {
    if (!iso) return "—";

    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className={`ff-card ff-estimateCard ${urgencyClass}`}>
      {isAccepted ? (
        <div className="ff-acceptedCard">
          <div className="ff-acceptedHeader">Quick price accepted</div>
          <div className="ff-acceptedSub">
            The customer has approved this guide price.
          </div>

          <div className="ff-estimateActivity">
            <div className="ff-estimateActivityRow">
              <span>Views</span>
              <strong>{viewCount}</strong>
            </div>

            <div className="ff-estimateActivityRow">
              <span>First viewed</span>
              <strong>
                {firstViewedAt ? niceActivityDate(firstViewedAt) : "Not viewed yet"}
              </strong>
            </div>

            <div className="ff-estimateActivityRow">
              <span>Last viewed</span>
              <strong>
                {lastViewedAt ? niceActivityDate(lastViewedAt) : "Not viewed yet"}
              </strong>
            </div>

            <div className="ff-estimateActivityRow">
              <span>Accepted</span>
              <strong>{acceptedAt ? niceActivityDate(acceptedAt) : "—"}</strong>
            </div>
          </div>

          <div className="ff-acceptedTotal">£{total.toFixed(2)}</div>

          <div className="ff-acceptedActions">
            <button
              type="button"
              className="ff-btn ff-btnPrimary ff-btnSm"
              onClick={onScheduleJob}
            >
              Schedule job
            </button>

            <button
              type="button"
              className="ff-btn ff-btnGhost ff-btnSm"
              onClick={onCreateInvoice}
            >
              Create invoice
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ff-estimateHead">Quick price</div>

          <div className="ff-estimateSub">
            A fast guide price for simple jobs you can price without a site visit.
          </div>

          <div className="ff-estimateContext">
            {estimateStatus
              ? "Editing existing quick price"
              : "Best for rough pricing, small jobs, or work that does not need a visit"}
          </div>

          <div className="ff-estimateMetaClean">
            <div className="ff-estimateJob">
              {selectedQuote?.job_number || "New enquiry"}
            </div>

            <div className="ff-estimateMetaLine">
              {selectedQuote?.job_type || "—"}
              {selectedQuote?.customer_name
                ? ` • ${selectedQuote.customer_name}`
                : ""}
            </div>
          </div>

          {smartSuggestion ? (
            <div className="ff-estimateSuggestion">
              <div className="ff-estimateSuggestionTop">
                <span className="ff-estimateSuggestionLabel">
                  Suggested guide price · {smartSuggestion.label}
                </span>
              </div>

              <div className="ff-estimateSuggestionMain">
                <div className="ff-estimateSuggestionPrice">
                  £
                  {(
                    smartSuggestion.labour +
                    smartSuggestion.materials +
                    smartSuggestion.other
                  ).toFixed(2)}
                </div>

                <button
                  type="button"
                  className="ff-btn ff-btnPrimary ff-btnSm ff-usePriceBtn"
                  onClick={applySmartSuggestion}
                >
                  Use guide price
                </button>
              </div>
            </div>
          ) : null}

          {averagePrice ? (
            <div className="ff-estimateHistory">
              <span>Your average for similar jobs</span>
              <strong>£{averagePrice}</strong>
            </div>
          ) : null}

          {estimateStatus ? (
            <div className="ff-estimateStatusRow">
              <span
                className={`ff-estimateStatus ff-estimateStatus--${estimateStatus}`}
              >
                {estimateStatus === "draft"
                  ? "Draft"
                  : estimateStatus === "sent"
                  ? "Sent"
                  : "Accepted"}
              </span>
            </div>
          ) : null}

          {msg ? <div className="ff-estimateMsg">{msg}</div> : null}

          <div className="ff-estimateActivity">
            <div className="ff-estimateActivityRow">
              <span>Views</span>
              <strong>{viewCount}</strong>
            </div>

            <div className="ff-estimateActivityRow">
              <span>First viewed</span>
              <strong>
                {firstViewedAt ? niceActivityDate(firstViewedAt) : "Not viewed yet"}
              </strong>
            </div>

            <div className="ff-estimateActivityRow">
              <span>Last viewed</span>
              <strong>
                {lastViewedAt ? niceActivityDate(lastViewedAt) : "Not viewed yet"}
              </strong>
            </div>
          </div>

          <div className="ff-estimateTemplates">
            <button type="button" onClick={() => applyTemplate("callout")}>
              Callout
            </button>

            <button type="button" onClick={() => applyTemplate("repair")}>
              Small repair
            </button>

            <button type="button" onClick={() => applyTemplate("labour")}>
              Labour only
            </button>
          </div>

          <div className="ff-estimateGrid">
            <div>
              <label>Labour</label>
              <input
                type="number"
                min="0"
                value={labour}
                onChange={(e) => setLabour(e.target.value)}
              />
            </div>

            <div>
              <label>Materials</label>
              <input
                type="number"
                min="0"
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
              />
            </div>

            <div>
              <label>Other</label>
              <input
                type="number"
                min="0"
                value={other}
                onChange={(e) => setOther(e.target.value)}
              />
            </div>
          </div>

          <div className="ff-estimateTotal">
            Guide total: £{total.toFixed(2)}
          </div>

          {total > 0 ? (
            <div className="ff-profitPreview">
              <div className="ff-profitMain">Profit: £{Math.round(profit)}</div>

              <div className="ff-profitSub">Margin: {margin}%</div>

              <div className="ff-profitHint">
                {margin > 60 && "🔥 Strong profit job"}
                {margin > 40 && margin <= 60 && "👍 Healthy margin"}
                {margin <= 40 && "⚠️ Low margin — consider increasing price"}
              </div>
            </div>
          ) : null}

          <textarea
            className="ff-estimateNotes"
            placeholder="Add a short note about what this price includes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="ff-estimateActions">
            <button
              type="button"
              className={`ff-btn ff-btnSm ${
                draftSaved ? "ff-btnSuccess" : "ff-btnGhost"
              }`}
              onClick={() => saveEstimate("draft")}
              disabled={saving || total <= 0}
            >
              {saving ? "Saving..." : draftSaved ? "Saved ✓" : "Save draft"}
            </button>

            <button
              type="button"
              className={`ff-btn ff-btnSm ${
                quickPriceSent ? "ff-btnSuccess" : "ff-btnPrimary"
              }`}
              onClick={() => saveEstimate("sent")}
              disabled={saving || total <= 0}
            >
              {saving ? "Sending..." : quickPriceSent ? "Sent ✓" : "Send quick price"}
            </button>
          </div>

          <div className="ff-estimateDivider" />

          <button
            type="button"
            className="ff-btn ff-btnGhost ff-btnSm ff-btnFull"
onClick={() => {
  const params = new URLSearchParams();

  params.set("requestId", selectedQuote.id);

  if (estimateId) {
    params.set("quickEstimateId", estimateId);
  }

  window.location.href = `/dashboard/estimates?${params.toString()}`;
}}
          >
            Create detailed estimate →
          </button>
        </>
      )}
    </div>
  );
}