"use client";

import "@/app/dashboard/shared-flow.css";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ================================
   TYPES
================================ */

type RequestRow = {
  id: string;
  job_number: string | null;
  plumber_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  postcode: string | null;
  address: string | null;
  job_type: string | null;
  urgency: string | null;
  details: string | null;
  created_at?: string | null;
  status: string | null;
stage: string | null;
};

type InvoiceRow = {
  id: string;
  user_id: string;
  request_id: string;
  invoice_number: string | null;
  amount: number;
  currency: string;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  to_email: string | null;
  vat_rate: number | null;
  subtotal: number | null;
};

type RightTab = "details" | "status" | "notes";
type EstimateRow = {
  id: string;
  request_id: string;
  plumber_id: string;
  status: string | null;
  total: number | null;
  subtotal: number | null;
  vat: number | null;
  labour: number | null;
  materials: number | null;
  callout: number | null;
  parts: number | null;
  other: number | null;
  customer_message: string | null;
};

/* ================================
   CONSTS
================================ */

const FF = {
  pageBg: "#F6F8FC",
  card: "#FFFFFF",
  border: "#E6ECF5",
  text: "#0B1320",
  muted: "#64748B",
  navySoft: "#0B2A55",
  blue: "#245BFF",
  blueSoft: "#EEF4FF",
  blueSoft2: "#F8FBFF",
  redSoft: "#FEF2F2",
  amberSoft: "#FFF7ED",
  greenSoft: "#ECFDF3",
  blueLine:
    "linear-gradient(90deg, #0B2A55 0%, #245BFF 55%, rgba(36,91,255,0.15) 100%)",
};

/* ================================
   HELPERS
================================ */


function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function money(amount: number | null | undefined, currency = "GBP") {
  const n = Number(amount || 0);
  if (currency === "GBP") return `£${n.toFixed(2)}`;
  return `${currency} ${n.toFixed(2)}`;
}

function niceDateOnly(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString([], {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function niceDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      year: "2-digit",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function shortRequestId(id?: string | null) {
  if (!id) return "—";
  return `${id.slice(0, 8)}…`;
}

function statusChip(status?: string | null) {
  const v = String(status || "").toLowerCase();

  if (v.includes("paid")) {
    return { text: "Paid", cls: "ff-chip ff-chipGreen" };
  }
  if (v.includes("sent")) {
    return { text: "Sent", cls: "ff-chip ff-chipBlue" };
  }
  if (v.includes("void")) {
    return { text: "Void", cls: "ff-chip ff-chipRed" };
  }
  if (v.includes("overdue")) {
    return { text: "Overdue", cls: "ff-chip ff-chipAmber" };
  }

  return { text: "Draft", cls: "ff-chip ff-chipGray" };
}

function invoiceGlow(status?: string | null) {
  const v = String(status || "").toLowerCase();

  if (v.includes("paid")) return "ff-leftGlowPaid";
  if (v.includes("sent")) return "ff-leftGlowSent";
  if (v.includes("void")) return "ff-leftGlowVoid";
  return "ff-leftGlowDraft";
}

function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ff-empty">
      <div className="ff-emptyTitle">{title}</div>
      {sub ? <div className="ff-emptySub">{sub}</div> : null}
    </div>
  );
}

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestIdFromUrl = (searchParams.get("requestId") || "").trim();
  const invoiceIdFromUrl = (searchParams.get("invoiceId") || "").trim();

  const [userId, setUserId] = useState<string | null>(null);

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [estimateMap, setEstimateMap] = useState<Record<string, EstimateRow | null>>({});
const [extras, setExtras] = useState("0");
const [detailExtras, setDetailExtras] = useState("0");

const [loading, setLoading] = useState(true);
const [busy, setBusy] = useState(false);

const toastTimerRef = React.useRef<number | null>(null);

const [toast, setToast] = useState<{
  text: string;
  type?: "success" | "error";
} | null>(null);

const [confirmModal, setConfirmModal] = useState<{
  title: string;
  message: string;
  confirmText: string;
  tone?: "danger" | "normal";
  onConfirm: () => void;
} | null>(null);

const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [tab, setTab] = useState<RightTab>("details");

  const [statusFilter, setStatusFilter] = useState<
    "" | "draft" | "sent" | "paid" | "void"
  >("");
  const [postcodeFilter, setPostcodeFilter] = useState("");

  // create form
  const [requestId, setRequestId] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [amount, setAmount] = useState<string>("0");
  const [status, setStatus] = useState<string>("draft");
  const [notes, setNotes] = useState("");
  const [vatRegistered, setVatRegistered] = useState(true);
type VatRate = "0" | "5" | "20";

const [vatRate, setVatRate] = useState<VatRate>("20");
const [detailVatRate, setDetailVatRate] = useState<VatRate>("20");
const [detailVatRegistered, setDetailVatRegistered] = useState(true);
const [detailSubtotal, setDetailSubtotal] = useState("0");
  // right detail form
  const [detailToEmail, setDetailToEmail] = useState("");
  const [detailAmount, setDetailAmount] = useState("0");
  const [detailStatus, setDetailStatus] = useState("draft");
  const [detailNotes, setDetailNotes] = useState("");
  const [detailInvoiceNumber, setDetailInvoiceNumber] = useState("");
  const [detailDueAt, setDetailDueAt] = useState("");
const [dueAt, setDueAt] = useState("");
  const selectedRequest = useMemo(() => {
    return requests.find((r) => r.id === requestId) || null;
  }, [requests, requestId]);

  const selectedInvoice = useMemo(() => {
    return invoices.find((i) => i.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  const linkedRequest = useMemo(() => {
    if (!selectedInvoice) return null;
    return requests.find((r) => r.id === selectedInvoice.request_id) || null;
  }, [requests, selectedInvoice]);

  const requestMap = useMemo(() => {
    const map: Record<string, RequestRow> = {};
    for (const r of requests) map[r.id] = r;
    return map;
  }, [requests]);

  useEffect(() => {
    if (!selectedRequest) return;
    const email = (selectedRequest.customer_email || "").trim();
    setToEmail(email);
  }, [selectedRequest]);

 useEffect(() => {
  if (!selectedRequest) return;

  const estimate = estimateMap[selectedRequest.id];
  if (!estimate) return;

  const estimateBase =
    Number(estimate.subtotal || 0) ||
    Number(estimate.total || 0) ||
    0;

  setAmount(estimateBase.toFixed(2));
  setExtras("0");
  setNotes(
    estimate.customer_message ||
      `Invoice based on accepted estimate for ${selectedRequest.job_type || "job"}.`
  );
}, [selectedRequest?.id, estimateMap]);

useEffect(() => {
  if (!requestIdFromUrl) return;
  if (!requests.length) return;

  const foundRequest = requests.find((r) => r.id === requestIdFromUrl);
  if (!foundRequest) return;

  const estimate = estimateMap[foundRequest.id];

  const estimateBase =
    Number(estimate?.subtotal || 0) ||
    Number(estimate?.total || 0) ||
    0;

  setRequestId(foundRequest.id);
  setToEmail((foundRequest.customer_email || "").trim().toLowerCase());
  setAmount(estimateBase > 0 ? estimateBase.toFixed(2) : "0");
  setExtras("0");
  setStatus("draft");
  setDueAt("");

  setNotes(
    `Invoice for ${foundRequest.job_type || "job"}${
      foundRequest.job_number
        ? ` — ${foundRequest.job_number}`
        : ""
    }.${
      foundRequest.details
        ? `\n\nWork details:\n${foundRequest.details}`
        : ""
    }`
  );
}, [requestIdFromUrl, requests, estimateMap]);

useEffect(() => {
  if (!selectedInvoice) return;

  const vr = Number(selectedInvoice.vat_rate ?? 20);

  setDetailToEmail((selectedInvoice.to_email || "").trim());
  setDetailAmount(String(selectedInvoice.amount ?? 0));
  setDetailStatus(selectedInvoice.status || "draft");
  setDetailNotes(selectedInvoice.notes || "");
  setDetailInvoiceNumber((selectedInvoice.invoice_number || "").trim());
  setDetailSubtotal(
    selectedInvoice.subtotal != null
      ? String(selectedInvoice.subtotal)
      : String(selectedInvoice.amount ?? 0)
  );
  setDetailVatRegistered(vr > 0);
 setDetailVatRate(
vr === 5 || vr === 20 ? (String(vr) as VatRate) : "0"
);
  setDetailDueAt(
    selectedInvoice.due_at
      ? new Date(selectedInvoice.due_at).toISOString().slice(0, 10)
      : ""
  );
  setTab("details");
}, [selectedInvoice?.id]);

function pushToast(text: string, type: "success" | "error" = "success") {
  setToast({ text, type });

  if (toastTimerRef.current) {
    window.clearTimeout(toastTimerRef.current);
  }

  toastTimerRef.current = window.setTimeout(() => {
    setToast(null);
    toastTimerRef.current = null;
  }, 2400);
}

  async function loadAll() {
    setLoading(true);
    setToast(null);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
  pushToast("You must be logged in to view invoices.", "error");
  setLoading(false);
  return;
}

    setUserId(user.id);

    const { data: reqs, error: reqErr } = await supabase
  .from("quote_requests")
.select(
  "id, job_number, plumber_id, customer_name, customer_email, customer_phone, postcode, address, job_type, urgency, details, created_at, stage, status"
)
      .eq("plumber_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (reqErr) {
      setRequests([]);
      pushToast(`Requests load error: ${reqErr.message}`, "error");
    } else {
      setRequests((reqs || []) as RequestRow[]);
    }

    const { data: invs, error: invErr } = await supabase
      .from("invoices")
      .select(
        "id, user_id, request_id, invoice_number, amount, currency, status, issued_at, due_at, notes, created_at, updated_at, to_email, vat_rate, subtotal"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(300);

    if (invErr) {
      setInvoices([]);
      pushToast(`Invoices load error: ${invErr.message}`, "error");
    } else {
      const list = (invs || []) as InvoiceRow[];
      setInvoices(list);

   if (invoiceIdFromUrl) {
  setSelectedInvoiceId(invoiceIdFromUrl);
}
    }

const map: Record<string, EstimateRow | null> = {};

const { data: ests } = await supabase
  .from("estimates")
  .select("id, request_id, plumber_id, status, total, subtotal, vat, labour, materials, callout, parts, other, customer_message")
  .eq("plumber_id", user.id)
  .order("created_at", { ascending: false });

for (const est of (ests || []) as EstimateRow[]) {
  if (!est.request_id) continue;
  if (!map[est.request_id]) map[est.request_id] = est;
}

const { data: quotes } = await supabase
  .from("quotes")
  .select("id, request_id, plumber_id, status, subtotal, note, created_at")
  .eq("plumber_id", user.id)
  .order("created_at", { ascending: false });

for (const quote of quotes || []) {
  if (!quote.request_id) continue;
  if (map[quote.request_id]) continue;

  map[quote.request_id] = {
    id: quote.id,
    request_id: quote.request_id,
    plumber_id: quote.plumber_id,
    status: quote.status || null,
    total: Number(quote.subtotal || 0),
    subtotal: Number(quote.subtotal || 0),
    vat: null,
    labour: null,
    materials: null,
    callout: null,
    parts: null,
    other: null,
    customer_message: quote.note || null,
  };
}

setEstimateMap(map);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
   const visibleInvoices = useMemo(() => {
  let list = [...invoices];

    if (statusFilter) {
      list = list.filter(
        (i) => String(i.status || "").toLowerCase() === statusFilter
      );
    }

    if (postcodeFilter.trim()) {
      const needle = postcodeFilter.trim().toLowerCase();
      list = list.filter((i) =>
        String(requestMap[i.request_id]?.postcode || "")
          .toLowerCase()
          .includes(needle)
      );
    }

    return list;
  }, [invoices, statusFilter, postcodeFilter, requestMap]);

  const counts = useMemo(() => {
    const all = invoices.length;
    const draft = invoices.filter(
      (i) => String(i.status || "").toLowerCase() === "draft"
    ).length;
    const sent = invoices.filter(
      (i) => String(i.status || "").toLowerCase() === "sent"
    ).length;
    const paid = invoices.filter(
      (i) => String(i.status || "").toLowerCase() === "paid"
    ).length;
    const voidCount = invoices.filter(
      (i) => String(i.status || "").toLowerCase() === "void"
    ).length;

    return { all, draft, sent, paid, void: voidCount };
  }, [invoices]);

  async function createInvoice(e: FormEvent) {
    e.preventDefault();
    setToast(null);

    if (!userId) return pushToast("Not logged in.", "error");
if (!requestId) return pushToast("Pick a request first.", "error");
if (!toEmail.trim()) return pushToast("Customer email is required.", "error");
if (!isValidEmail(toEmail)) return pushToast("Customer email looks invalid.", "error");

const baseNum = Number(String(amount).replace(/,/g, "").trim());
const extrasNum = Number(String(extras).replace(/,/g, "").trim() || 0);
const subtotalNum = baseNum + extrasNum;
if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
  return pushToast("Amount must be a number.", "error");
}

setBusy(true);

const vatRateNum = vatRegistered ? Number(vatRate) : 0;
const vatAmount = subtotalNum * (vatRateNum / 100);
const totalNum = subtotalNum + vatAmount;

const payload = {
  user_id: userId,
  request_id: requestId,
  to_email: toEmail.trim().toLowerCase(),
  subtotal: subtotalNum,
  vat_rate: vatRateNum,
  amount: totalNum,
  currency: "GBP",
  due_at: dueAt || null,
  status: status || "draft",
  notes: notes.trim() || null,
};

const { data, error } = await supabase
  .from("invoices")
  .insert(payload)
  .select(
    "id, user_id, request_id, invoice_number, amount, currency, status, issued_at, due_at, notes, created_at, updated_at, to_email, vat_rate, subtotal"
  )
  .single();
    if (error) {
      pushToast(`Create invoice error: ${error.message}`, "error");
      setBusy(false);
      return;
    }

    if (data) {
      const newInv = data as InvoiceRow;
      setInvoices((prev) => [newInv, ...prev]);
      setSelectedInvoiceId(newInv.id);
      router.replace(
        `/dashboard/invoices?invoiceId=${encodeURIComponent(newInv.id)}`
      );
    }
setRequestId("");
setToEmail("");
setDueAt("");
setAmount("0");
setStatus("draft");
setNotes("");
setVatRegistered(true);
setVatRate("20");

pushToast("Invoice created ✓", "success");
setBusy(false);
  }

async function saveInvoice() {
  if (!userId || !selectedInvoice) return;

  if (!detailToEmail.trim()) return pushToast("Customer email is required.", "error");
  if (!isValidEmail(detailToEmail)) {
    return pushToast("Customer email looks invalid.", "error");
  }

  const subtotalNum = Number(detailSubtotal || 0) || 0;
  if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
    return pushToast("Subtotal must be a number.", "error");
  }

  const vatRateNum = detailVatRegistered ? Number(detailVatRate) : 0;
  const vatAmount = subtotalNum * (vatRateNum / 100);
  const totalNum = subtotalNum + vatAmount;

  setBusy(true);
  setToast(null);

  const { data, error } = await supabase
    .from("invoices")
  .update({
  to_email: detailToEmail.trim().toLowerCase(),
  invoice_number: detailInvoiceNumber.trim() || null,
  subtotal: subtotalNum,
  vat_rate: vatRateNum,
  amount: totalNum,
  due_at: detailDueAt || null,
  status: detailStatus,
  notes: detailNotes.trim() || null,
})
    .eq("id", selectedInvoice.id)
    .eq("user_id", userId)
    .select(
      "id, user_id, request_id, invoice_number, amount, currency, status, issued_at, due_at, notes, created_at, updated_at, to_email, vat_rate, subtotal"
    )
    .maybeSingle();

  if (error) {
    pushToast(`Save failed: ${error.message}`, "error");
    setBusy(false);
    return;
  }

  if (data) {
    setInvoices((prev) =>
      prev.map((i) => (i.id === selectedInvoice.id ? (data as InvoiceRow) : i))
    );
  }

  pushToast("Saved ✓", "success");
  setBusy(false);
}

  async function markStatus(invoiceId: string, nextStatus: string) {
    if (!userId) return;
    setToast(null);
    setBusy(true);

    const { data, error } = await supabase
      .from("invoices")
      .update({ status: nextStatus })
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .select(
        "id, user_id, request_id, invoice_number, amount, currency, status, issued_at, due_at, notes, created_at, updated_at, to_email, vat_rate, subtotal"
      )
      .maybeSingle();

    if (error) {
      pushToast(`Update error: ${error.message}`, "error");
      setBusy(false);
      return;
    }

if (data) {
  const next = data as InvoiceRow;
  setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? next : i)));

  if (nextStatus === "paid" && next.request_id) {
    await supabase
      .from("quote_requests")
      .update({ stage: "paid", status: "paid" })
      .eq("id", next.request_id)
      .eq("plumber_id", userId);
  }

  if (selectedInvoice?.id === invoiceId) {
    setDetailStatus(next.status || "draft");
  }
}

    pushToast("Updated ✓", "success");
    setBusy(false);
  }
async function deleteInvoice(id: string) {
  setConfirmModal({
    title: "Delete invoice?",
    message: "This invoice will be permanently removed from FixFlow.",
    confirmText: "Delete invoice",
    tone: "danger",
    onConfirm: () => runDeleteInvoice(id),
  });
}



async function runDeleteInvoice(id: string) {
  if (!userId) return;

  setBusy(true);
  setToast(null);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    pushToast(`Delete error: ${error.message}`, "error");
    setBusy(false);
    return;
  }

  const remaining = invoices.filter((i) => i.id !== id);
  setInvoices(remaining);

  if (selectedInvoiceId === id) {
    const nextId = remaining[0]?.id || null;
    setSelectedInvoiceId(nextId);

    if (nextId) {
      router.replace(
        `/dashboard/invoices?invoiceId=${encodeURIComponent(nextId)}`
      );
    } else {
      router.replace("/dashboard/invoices");
    }
  }

  pushToast("Deleted ✓", "success");
  setBusy(false);
}

  async function downloadInvoicePdf(inv: InvoiceRow) {
  if (!inv?.id) return;

  try {
    setBusy(true);
    setToast(null);

    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes.session?.access_token;

    if (!token) {
      throw new Error("You're not logged in. Please log in again.");
    }

    const res = await fetch(
      `/api/invoices/pdf?invoiceId=${encodeURIComponent(inv.id)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error || "PDF download failed");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${
      inv.invoice_number || `invoice-${inv.id.slice(0, 8)}`
    }.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (e: any) {
   pushToast(e?.message || "PDF download failed", "error");
  } finally {
    setBusy(false);
  }
}



  async function sendInvoice(inv: InvoiceRow) {
    setToast(null);

    const to = (inv.to_email || "").trim();
    if (!to) return pushToast("This invoice has no customer email.", "error");
if (!isValidEmail(to)) return pushToast("This invoice email looks invalid.", "error");

    setBusy(true);

    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;

      if (!token) {
        throw new Error("You're not logged in. Please log in again.");
      }

      const res = await fetch("/api/invoices/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoiceId: inv.id,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Send failed");
      }

      await markStatus(inv.id, "sent");
     pushToast("Invoice sent ✓", "success");
    } catch (e: any) {
     pushToast(e?.message || "Send failed", "error"); 
    } finally {
      setBusy(false);
    }
  }

  function openInvoice(id: string) {
    setSelectedInvoiceId(id);
    setTab("details");
    router.replace(`/dashboard/invoices?invoiceId=${encodeURIComponent(id)}`);
  }

  function backToListMobile() {
    setSelectedInvoiceId(null);
    setTab("details");
    router.replace("/dashboard/invoices");
  }

  if (loading) {
    return (
      <div style={{ padding: 14, fontSize: 13, color: FF.muted }}>
        Loading invoices…
      </div>
    );
  }

  const mobileDetail = selectedInvoice ? "1" : "0";

return (
  <React.Fragment>
    <div className="ff-page" data-mobile-detail={mobileDetail}>
      <div className="ff-wrap">
      <div className="ff-top">
        <div className="ff-hero">
          <div className="ff-heroGlow" />

          <div className="ff-heroRow">
            <div className="ff-heroLeft">
              <div className="ff-heroTitle">Invoices</div>
              <div className="ff-heroRule" />
              <div className="ff-sub">Create, send and track invoices.</div>
            </div>

            <div className="ff-actions">
              <button className="ff-btnGhost" type="button" onClick={loadAll}>
                Refresh
              </button>
            </div>
          </div>
        </div>
        </div>

        <div className="ff-controls">
          <div className="ff-filterRow">
            <button
              className={`ff-pillSmall ${!statusFilter ? "ff-pillNeutralActive" : ""}`}
              type="button"
              onClick={() => setStatusFilter("")}
            >
              All {counts.all}
            </button>

            <button
              className={`ff-pillSmall ${statusFilter === "draft" ? "ff-pillNeutralActive" : ""}`}
              type="button"
              onClick={() => setStatusFilter("draft")}
            >
              Draft {counts.draft}
            </button>

            <button
              className={`ff-pillSmall ${statusFilter === "sent" ? "ff-pillNeutralActive" : ""}`}
              type="button"
              onClick={() => setStatusFilter("sent")}
            >
              Sent {counts.sent}
            </button>

            <button
              className={`ff-pillSmall ${statusFilter === "paid" ? "ff-pillNeutralActive" : ""}`}
              type="button"
              onClick={() => setStatusFilter("paid")}
            >
              Paid {counts.paid}
            </button>

            <button
              className={`ff-pillSmall ${statusFilter === "void" ? "ff-pillNeutralActive" : ""}`}
              type="button"
              onClick={() => setStatusFilter("void")}
            >
              Void {counts.void}
            </button>
          </div>

          <div className="ff-filterRow">
            <input
              className="ff-input"
              placeholder="Postcode / area"
              value={postcodeFilter}
              onChange={(e) => setPostcodeFilter(e.target.value)}
            />
          </div>
        </div>

     {toast ? (
  <div className={`ff-toast ${toast.type === "error" ? "ff-toastError" : "ff-toastSuccess"}`}>
    {toast.text}
  </div>
) : null}

      <div className="ff-grid">
        <div className="ff-card ff-leftPane">
          <div className="ff-leftHeadRow">
            <div className="ff-leftTitle">All invoices</div>
<div className="ff-leftCount">{visibleInvoices.length}</div>
          </div>

          <div className="ff-leftList">
            <div className="ff-createCard">
              <div className="ff-createTitle">+ New invoice</div>

              <form onSubmit={createInvoice} className="ff-createGrid">
                <div className="ff-field">
                  <label className="ff-label">Request</label>
                  <select
                    className="ff-inputWide"
                    value={requestId}
                    onChange={(e) => setRequestId(e.target.value)}
                    disabled={busy || loading}
                  >
                    <option value="">Choose…</option>
                    {requests.map((r) => (
                      <option key={r.id} value={r.id}>
                        {(r.customer_name || "Customer") +
                          " — " +
                          (r.postcode || "No postcode") +
                          " — " +
                          (r.customer_email || "No email")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ff-field">
                  <label className="ff-label">To</label>
                  <input
                    className="ff-inputWide"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="customer@example.com"
                    disabled={busy || loading}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Due date</label>
                  <input
                    type="date"
                    className="ff-inputWide"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    disabled={busy || loading}
                  />
                </div>

             <div className="ff-field">
  <label className="ff-label">Amount</label>
  <input
    className="ff-inputWide"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
    inputMode="decimal"
    placeholder="0"
    disabled={busy || loading}
  />
</div>

<div className="ff-field">
  <label className="ff-label">Extras added on job</label>

  <input
    className="ff-inputWide"
    value={extras}
    onChange={(e) =>
      setExtras(e.target.value.replace(/[^\d.]/g, ""))
    }
    inputMode="decimal"
    placeholder="0.00"
    disabled={busy || loading}
  />
</div>

                <div className="ff-field">
                  <label className="ff-label">VAT</label>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className={`ff-pillSmall ${vatRegistered ? "ff-pillNeutralActive" : ""}`}
                      onClick={() => setVatRegistered(true)}
                      disabled={busy || loading}
                    >
                      VAT on
                    </button>

                    <button
                      type="button"
                      className={`ff-pillSmall ${!vatRegistered ? "ff-pillNeutralActive" : ""}`}
                      onClick={() => {
                        setVatRegistered(false);
                        setVatRate("0");
                      }}
                      disabled={busy || loading}
                    >
                      VAT off
                    </button>

                    {vatRegistered ? (
                      <select
                        className="ff-inputWide"
                        value={vatRate}
                        onChange={(e) => setVatRate(e.target.value as VatRate)}
                        disabled={busy || loading}
                        style={{ maxWidth: 120 }}
                      >
                      <option value="20">20%</option>
<option value="5">5%</option>
<option value="0">0%</option>
                      </select>
                    ) : (
                      <div className="ff-detailSub">No VAT applied</div>
                    )}
                  </div>
                </div>

                {(() => {
                 const base = Number(amount || 0) || 0;
const extra = Number(extras || 0) || 0;

const s = base + extra;

const vr = vatRegistered ? Number(vatRate) : 0;
const vatAmount = s * (vr / 100);
const total = s + vatAmount;

                  return (
                    <div className="ff-field ff-fieldFull">
                      <div className="ff-detailCard" style={{ marginTop: 4 }}>
                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Subtotal</div>
                          <div className="ff-detailValue">£{s.toFixed(2)}</div>
                        </div>

                        {vatRegistered && vr > 0 ? (
                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">VAT ({vr}%)</div>
                            <div className="ff-detailValue">£{vatAmount.toFixed(2)}</div>
                          </div>
                        ) : null}

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Total</div>
                          <div
                            className="ff-detailValue"
                            style={{
                              fontSize: 18,
                              fontWeight: 950,
                              color: "#1F355C",
                            }}
                          >
                            £{total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="ff-field">
                  <label className="ff-label">Status</label>
                  <select
                    className="ff-inputWide"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={busy || loading}
                  >
                    <option value="draft">draft</option>
                    <option value="sent">sent</option>
                    <option value="paid">paid</option>
                    <option value="void">void</option>
                  </select>
                </div>

                <div className="ff-field ff-fieldFull">
                  <label className="ff-label">Notes</label>
                  <textarea
                    className="ff-textarea ff-textareaSm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional notes to include when sending…"
                    disabled={busy || loading}
                  />
                </div>

                <div className="ff-field ff-fieldFull">
                  <button
                    type="submit"
                    className="ff-btnPrimary ff-btnFull"
                    disabled={busy || loading}
                  >
                    {busy ? "Creating…" : "Create invoice"}
                  </button>
                </div>
              </form>
            </div>

            {visibleInvoices.length ? (
              visibleInvoices.map((inv) => {
                const active = selectedInvoiceId === inv.id;
                const req = requestMap[inv.request_id];
                const st = statusChip(inv.status);
                const glowCls = invoiceGlow(inv.status);

                return (
                  <button
                    key={inv.id}
                    className={`ff-leftItem ${glowCls}`}
                    data-active={active ? "1" : "0"}
                    type="button"
                    onClick={() => openInvoice(inv.id)}
                  >
                    <div className="ff-leftItemInner">
                      <div className="ff-leftItemTop">
                        <div className="ff-jobNumber">
                          {inv.invoice_number || "Generating..."}
                        </div>

                        <div className="ff-leftDate">{niceDateOnly(inv.created_at)}</div>
                      </div>

<div className="ff-leftJobTitle">
  {req?.job_type || "Invoice"}
</div>

<div className="ff-leftCustomer">
  {req?.customer_name || "Customer"}
</div>

<div className="ff-leftAddress">
  {req?.address || req?.postcode || "No address"}
</div>

<div className="ff-jobQuickRow">
  <div className="ff-jobBudget">{money(inv.amount, inv.currency)}</div>
  <div className="ff-jobPhotos">{niceDate(inv.created_at)}</div>
</div>

<div className="ff-leftStatusRow">
  <span className={st.cls}>{st.text}</span>
  <span className="ff-chip ff-chipBlue">
    {req?.job_number || "No job number"}
  </span>
</div>

<div className="ff-leftReplyAlert">
  To {inv.to_email || "No email"}
</div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="ff-emptyWrap">
                <EmptyState
                  title="No invoices yet"
                  sub="Create one from the form above."
                />
              </div>
            )}
          </div>
        </div>

        <div className="ff-card ff-rightPane">
          <div className="ff-rightBody">
            {!selectedInvoice ? (
              <div className="ff-emptyWrap">
                <div className="ff-empty">
                  <div className="ff-emptyTitle">Select an invoice</div>
                  <div className="ff-emptySub">
                    Pick one from the list to view details.
                  </div>
                </div>
              </div>
            ) : (
              <>


<div className="ff-rightTop">
  <div className="ff-rightTopLeft">
    <button
      className="ff-backBtn ff-backBtnMobile"
      type="button"
      onClick={backToListMobile}
    >
      ← Back to invoices
    </button>

    <div>
      <div className="ff-rightJobNo">
        {selectedInvoice.invoice_number || "Generating..."}
      </div>

      <h1 className="ff-rightTitle">
        {linkedRequest?.job_type || "Invoice"}
      </h1>

      <div className="ff-rightSub">
        {linkedRequest?.customer_name || "Customer"} •{" "}
        {(linkedRequest?.postcode || "—").toUpperCase()}
      </div>
    </div>
  </div>

  <div className="ff-rightTopActions">
    <button
      className="ff-btn ff-btnGhost"
      type="button"
      onClick={saveInvoice}
      disabled={busy}
    >
      {busy ? "Saving…" : "Save"}
    </button>

    <button
      className="ff-btn ff-btnGhost"
      type="button"
      onClick={() => {
        if (!selectedInvoice) return;
        downloadInvoicePdf(selectedInvoice);
      }}
    >
      Download PDF
    </button>

    <button
      className="ff-btn ff-btnPrimary"
      type="button"
      onClick={() => {
        if (!selectedInvoice) return;
        sendInvoice(selectedInvoice);
      }}
      disabled={busy}
    >
      Send
    </button>



    <button
      className="ff-btn ff-btnSuccess"
      type="button"
      onClick={() => {
        if (!selectedInvoice) return;
        markStatus(selectedInvoice.id, "paid");
      }}
      disabled={busy}
    >
      Mark as paid
    </button>

    <button
      className="ff-btn ff-btnDanger"
      type="button"
      onClick={() => {
        if (!selectedInvoice) return;
        deleteInvoice(selectedInvoice.id);
      }}
      disabled={busy}
    >
      Delete
    </button>
  </div>
</div>

<div className="ff-tabs">
  <button
    className={`ff-tabBtn ${tab === "details" ? "isActive" : ""}`}
    onClick={() => setTab("details")}
    type="button"
  >
    Details
  </button>

  <button
    className={`ff-tabBtn ${tab === "status" ? "isActive" : ""}`}
    onClick={() => setTab("status")}
    type="button"
  >
    Status
  </button>

  <button
    className={`ff-tabBtn ${tab === "notes" ? "isActive" : ""}`}
    onClick={() => setTab("notes")}
    type="button"
  >
    Notes
  </button>
</div>

                <div className="ff-rightInner">
                  {tab === "details" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-detailCard">
                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Customer</div>
                          <div>
                            <div className="ff-detailValue">
                              {linkedRequest?.customer_name || "Customer"}
                            </div>
                            <div className="ff-detailSub">
                              {linkedRequest?.customer_email || "—"}
                              {linkedRequest?.customer_phone
                                ? `\n${linkedRequest.customer_phone}`
                                : ""}
                            </div>
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Address</div>
                          <div className="ff-detailValue">
                            {linkedRequest?.address || linkedRequest?.postcode || "—"}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Invoice no.</div>
                          <input
                            className="ff-inputWide"
                            value={detailInvoiceNumber}
                            onChange={(e) => setDetailInvoiceNumber(e.target.value)}
                            placeholder={`INV-${selectedInvoice.id.slice(0, 6).toUpperCase()}`}
                          />
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Customer email</div>
                          <input
                            className="ff-inputWide"
                            value={detailToEmail}
                            onChange={(e) => setDetailToEmail(e.target.value)}
                            placeholder="customer@email.com"
                          />
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Due date</div>
                          <input
                            type="date"
                            className="ff-inputWide"
                            value={detailDueAt}
                            onChange={(e) => setDetailDueAt(e.target.value)}
                          />
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Subtotal</div>
                          <div style={{ position: "relative", maxWidth: 220 }}>
                            <span className="ff-pound">£</span>
                            <input
                              className="ff-inputWide"
                              inputMode="decimal"
                              value={detailSubtotal}
                              onChange={(e) =>
                                setDetailSubtotal(e.target.value.replace(/[^\d.]/g, ""))
                              }
                              onBlur={() => {
                                if (!detailSubtotal) {
                                  setDetailSubtotal("0.00");
                                  return;
                                }
                                const n = Number(detailSubtotal);
                                setDetailSubtotal(Number.isFinite(n) ? n.toFixed(2) : "0.00");
                              }}
                              placeholder="0.00"
                              style={{ paddingLeft: 28 }}
                            />
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">VAT registered?</div>
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className={`ff-pillSmall ${detailVatRegistered ? "ff-pillNeutralActive" : ""}`}
                              onClick={() => setDetailVatRegistered(true)}
                            >
                              Yes
                            </button>

                            <button
                              type="button"
                              className={`ff-pillSmall ${!detailVatRegistered ? "ff-pillNeutralActive" : ""}`}
                              onClick={() => {
                                setDetailVatRegistered(false);
                                setDetailVatRate("0");
                              }}
                            >
                              No
                            </button>

                            {detailVatRegistered ? (
                              <select
                                className="ff-inputWide"
                                value={detailVatRate}
                                onChange={(e) => setDetailVatRate(e.target.value as VatRate)}
                                style={{ maxWidth: 140 }}
                              >
                               <option value="20">20%</option>
<option value="5">5%</option>
<option value="0">0%</option>
                              </select>
                            ) : (
                              <div className="ff-detailSub">VAT will not be added.</div>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const s = Number(detailSubtotal || 0) || 0;
                          const vr = detailVatRegistered ? Number(detailVatRate) : 0;
                          const vatAmount = s * (vr / 100);
                          const total = s + vatAmount;

                          return (
                            <>
                              {detailVatRegistered && vr > 0 ? (
                                <div className="ff-detailRow">
                                  <div className="ff-detailLabel">VAT ({vr}%)</div>
                                  <div className="ff-detailValue">£{vatAmount.toFixed(2)}</div>
                                </div>
                              ) : null}

                              <div className="ff-detailRow">
                                <div className="ff-detailLabel">Total</div>
                                <div
                                  className="ff-detailValue"
                                  style={{
                                    fontSize: 18,
                                    fontWeight: 950,
                                    color: "#1F355C",
                                  }}
                                >
                                  £{total.toFixed(2)}
                                </div>
                              </div>
                            </>
                          );
                        })()}

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Request</div>
                          <div className="ff-detailValue">
                            {shortRequestId(selectedInvoice.request_id)}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Created</div>
                          <div className="ff-detailValue">
                            {niceDate(selectedInvoice.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "status" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-detailCard">
                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Status</div>
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className={`ff-pillSmall ${detailStatus === "draft" ? "ff-pillNeutralActive" : ""}`}
                              onClick={() => setDetailStatus("draft")}
                            >
                              Draft
                            </button>

                            <button
                              type="button"
                              className={`ff-pillSmall ${detailStatus === "sent" ? "ff-pillNeutralActive" : ""}`}
                              onClick={() => setDetailStatus("sent")}
                            >
                              Sent
                            </button>

                            <button
                              type="button"
                              className={`ff-pillSmall ${detailStatus === "paid" ? "ff-pillNeutralActive" : ""}`}
                              onClick={() => setDetailStatus("paid")}
                            >
                              Paid
                            </button>

                            <button
                              type="button"
                              className={`ff-pillSmall ${detailStatus === "void" ? "ff-pillNeutralActive" : ""}`}
                              onClick={() => setDetailStatus("void")}
                            >
                              Void
                            </button>
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Issued</div>
                          <div className="ff-detailValue">
                            {niceDate(selectedInvoice.issued_at)}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Due</div>
                          <div className="ff-detailValue">
                            {niceDate(selectedInvoice.due_at)}
                          </div>
                        </div>

                        <div className="ff-detailRow">
                          <div className="ff-detailLabel">Last updated</div>
                          <div className="ff-detailValue">
                            {niceDate(selectedInvoice.updated_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "notes" ? (
                    <div className="ff-detailGrid">
                      <div className="ff-detailCard">
                      <textarea
  className="ff-textarea ff-invoiceNotesTextarea"
  value={detailNotes}
  onChange={(e) => setDetailNotes(e.target.value)}
  placeholder="Invoice notes…"
/>

                        <div className="ff-noteFoot">
                          <button
                            className="ff-btnGhost"
                            type="button"
                            onClick={() => setDetailNotes("")}
                          >
                            Clear
                          </button>

                          <button
                            className="ff-btnPrimary"
                            type="button"
                            onClick={saveInvoice}
                            disabled={busy}
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  </div>
</div>
{confirmModal ? (
<div className="ff-modalOverlay">
<div className="ff-modalCard">
<div className="ff-modalTitle">{confirmModal.title}</div>
<div className="ff-modalText">{confirmModal.message}</div>

<div className="ff-modalActions">
<button
type="button"
className="ff-btnGhost"
onClick={() => setConfirmModal(null)}
>
Cancel
</button>

<button
type="button"
className={
confirmModal.tone === "danger"
? "ff-btnDanger"
: "ff-btnPrimary"
}
onClick={() => {
const action = confirmModal.onConfirm;
setConfirmModal(null);
action();
}}
>
{confirmModal.confirmText}
</button>
</div>
</div>
</div>
) : null}

<style jsx>{`

.ff-modalOverlay {
position: fixed;
inset: 0;
z-index: 9999;
display: grid;
place-items: center;
padding: 18px;
background: rgba(15, 23, 42, 0.42);
backdrop-filter: blur(8px);
}

.ff-modalCard {
width: min(420px, 100%);
border-radius: 24px;
background: #ffffff;
border: 1px solid rgba(230, 236, 245, 0.95);
box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
padding: 20px;
}

.ff-modalTitle {
color: #0b1320;
font-size: 18px;
font-weight: 950;
margin-bottom: 8px;
}

.ff-modalText {
color: #64748b;
font-size: 14px;
line-height: 1.5;
margin-bottom: 18px;
}

.ff-modalActions {
display: flex;
justify-content: flex-end;
gap: 10px;
}
.ff-leftHeadRow {
  padding: 18px 20px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ff-leftHeadRow .ff-leftTitle {
  margin: 0;
}

.ff-leftCount {
  font-size: 14px;
  font-weight: 900;
  color: #64748b;
}
  .ff-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
    border-top: 1px solid ${FF.border};
  }

  .ff-filterRow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ff-grid {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    gap: 14px;
    grid-template-columns: 390px minmax(0, 1fr);
  }

.ff-leftHeadRow {
  padding: 18px 20px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ff-leftHeadRow .ff-leftTitle {
  margin: 0;
}

.ff-leftCount {
  font-size: 14px;
  font-weight: 900;
  color: #64748b;
}

  .ff-grid > * {
    min-height: 0;
    min-width: 0;
  }

  .ff-toastSuccess {
    border-color: #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .ff-toastError {
    border-color: #fecaca;
    background: #fef2f2;
    color: #b91c1c;
  }

  .ff-createCard {
    border: 1px solid rgba(36, 91, 255, 0.18);
    border-radius: 18px;
    background: #ffffff;
    padding: 16px;
  }

  .ff-createTitle {
    color: ${FF.navySoft};
    font-size: 13px;
    font-weight: 900;
    margin-bottom: 10px;
  }

  .ff-createGrid {
    display: grid;
    gap: 8px;
  }

  .ff-fieldFull {
    grid-column: 1 / -1;
  }

  .ff-fieldFull .ff-btnPrimary {
    width: 100%;
    margin-top: 2px;
  }

  .ff-inputWide {
    height: 38px;
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${FF.border};
    padding: 0 12px;
    font-size: 13px;
    font-weight: 700;
    outline: none;
    color: ${FF.navySoft};
    box-sizing: border-box;
    min-width: 0;
    background: #fff;
  }

  .ff-textarea {
    width: 100%;
    min-height: 96px;
    border-radius: 14px;
    border: 1px solid ${FF.border};
    padding: 12px;
    font-size: 13px;
    outline: none;
    color: ${FF.navySoft};
    box-sizing: border-box;
    min-width: 0;
    background: #fff;
  }

  .ff-textareaSm {
    min-height: 72px;
  }

  .ff-btnSuccess {
    height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    border: none;
    background: #15803d;
    color: #ffffff;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
  }

  .ff-btnSuccess:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ff-btnDangerSm {
    height: 32px;
    padding: 0 12px;
    font-size: 12px;
    border-radius: 999px;
  }

  .ff-btnFull {
    width: 100%;
  }

  .ff-headerBtnRow {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-items: center;
    justify-content: end;
    max-width: 420px;
  }

  .ff-headerBtnRow > button {
    width: 100%;
    min-width: 0;
  }

  .ff-backMobile {
    display: none;
    margin: 18px 0 16px 4px;
    padding: 6px 12px;
    border: 1px solid rgba(31, 53, 92, 0.12);
    border-radius: 999px;
    background: rgba(31, 53, 92, 0.06);
    color: #1f355c;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .ff-rightTabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 8px 0 18px;
  }

  .ff-tabPill {
    height: 34px;
    padding: 0 14px;
    border: 1px solid ${FF.border};
    border-radius: 999px;
    background: #fff;
    color: ${FF.navySoft};
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
  }

  .ff-tabPill.isActive {
    border-color: rgba(36, 91, 255, 0.35);
    background: rgba(36, 91, 255, 0.1);
    color: ${FF.navySoft};
  }

  .ff-detailGrid {
    width: 100%;
    min-width: 0;
    display: grid;
    gap: 12px;
  }

  .ff-detailCard {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    margin-top: 14px;
    padding: 16px;
    border: 1px solid rgba(36, 91, 255, 0.18);
    border-radius: 18px;
    background: #ffffff;
  }

  .ff-detailRow {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 10px 0;
  }

  .ff-detailRow + .ff-detailRow {
    border-top: 1px solid rgba(230, 236, 245, 0.9);
  }

  .ff-detailLabel {
    color: ${FF.muted};
    opacity: 0.9;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .ff-detailValue {
    max-width: 100%;
    min-width: 0;
    color: ${FF.text};
    font-size: 14px;
    line-height: 1.45;
    font-weight: 650;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .ff-detailSub {
    max-width: 100%;
    margin-top: 4px;
    color: ${FF.muted};
    font-size: 13px;
    font-weight: 500;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .ff-pound {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-weight: 900;
    color: ${FF.navySoft};
    pointer-events: none;
  }

  .ff-noteFoot {
    margin-top: 10px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .ff-leftGlowDraft {
    border-color: rgba(245, 158, 11, 0.34);
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.16) !important;
  }

  .ff-leftGlowSent {
    border-color: rgba(59, 130, 246, 0.3);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12) !important;
  }

  .ff-leftGlowPaid {
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14) !important;
  }

  .ff-leftGlowVoid {
    border-color: rgba(239, 68, 68, 0.34);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.16) !important;
  }
.ff-page,
.ff-grid,
.ff-leftPane,
.ff-rightPane,
.ff-createCard,
.ff-detailCard {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.ff-createCard,
.ff-detailCard {
  overflow: hidden;
}

.ff-createGrid {
  width: 100%;
  min-width: 0;
}

.ff-createGrid > * {
  min-width: 0;
  max-width: 100%;
}

.ff-inputWide,
.ff-textarea,
select,
input,
textarea {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
  @media (max-width: 980px) {
    .ff-page[data-mobile-detail="1"] .ff-leftPane {
      display: none;
    }

    .ff-page[data-mobile-detail="0"] .ff-rightPane {
      display: none;
    }
@media (max-width: 980px) {
  .ff-page,
  .ff-grid,
  .ff-rightPane,
  .ff-leftPane {
    overflow-x: hidden;
  }

  .ff-createCard,
  .ff-detailCard {
    width: 100%;
    max-width: 100%;
    padding: 16px;
  }

  .ff-detailRow {
    grid-template-columns: 1fr;
  }
}
    .ff-grid {
      grid-template-columns: 1fr;
    }

    .ff-backMobile {
      display: inline-block;
}
.ff-invoiceNotesTextarea {
  min-height: 240px;
  resize: vertical;
}

@media (max-width: 980px) {
  .ff-invoiceNotesTextarea {
    min-height: 300px;
  }
}
    .ff-headerBtnRow {
      grid-template-columns: 1fr;
      max-width: none;
    }
  }
`}</style>
  </React.Fragment>
);
}
