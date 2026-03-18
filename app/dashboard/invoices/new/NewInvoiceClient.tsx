"use client";

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

/* ================================
   CONSTS
================================ */

const FF = {
  pageBg: "#F6F8FC",
  card: "#FFFFFF",
  border: "#E6ECF5",
  text: "#0B1320",
  muted: "#5C6B84",
  navySoft: "#1F355C",
  blue: "#245BFF",
  blueSoft: "#EAF1FF",
  blueSoft2: "#F4F7FF",
  redSoft: "#FFF1F1",
  amberSoft: "#FFF7ED",
  greenSoft: "#ECFDF3",
  blueLine:
    "linear-gradient(90deg, rgba(36,91,255,1) 0%, rgba(31,111,255,0.35) 55%, rgba(11,42,85,0.15) 100%)",
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

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
const [vatRate, setVatRate] = useState<"0" | "20">("20");
const [detailVatRegistered, setDetailVatRegistered] = useState(true);
const [detailVatRate, setDetailVatRate] = useState<"0" | "20">("20");
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
    if (requestIdFromUrl) setRequestId(requestIdFromUrl);
  }, [requestIdFromUrl]);

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
  setDetailVatRate(vr > 0 ? (String(vr) as "0" | "20") : "0");
  setDetailDueAt(
    selectedInvoice.due_at
      ? new Date(selectedInvoice.due_at).toISOString().slice(0, 10)
      : ""
  );
  setTab("details");
}, [selectedInvoice?.id]);

  async function loadAll() {
    setLoading(true);
    setToast(null);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      setToast("You must be logged in to view invoices.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: reqs, error: reqErr } = await supabase
  .from("quote_requests")
  .select(
    "id, job_number, plumber_id, customer_name, customer_email, customer_phone, postcode, address, job_type, urgency, details, created_at"
  )
      .eq("plumber_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (reqErr) {
      setRequests([]);
      setToast(`Requests load error: ${reqErr.message}`);
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
      setToast(`Invoices load error: ${invErr.message}`);
    } else {
      const list = (invs || []) as InvoiceRow[];
      setInvoices(list);

   if (invoiceIdFromUrl) {
  setSelectedInvoiceId(invoiceIdFromUrl);
}
    }

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

    if (!userId) return setToast("Not logged in.");
    if (!requestId) return setToast("Pick a request first.");
    if (!toEmail.trim()) return setToast("Customer email is required.");
    if (!isValidEmail(toEmail)) return setToast("Customer email looks invalid.");

const subtotalNum = Number(String(amount).replace(/,/g, "").trim());
if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
  return setToast("Amount must be a number.");
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
      setToast(`Create invoice error: ${error.message}`);
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

setToast("Invoice created ✓");
setBusy(false);
  }

async function saveInvoice() {
  if (!userId || !selectedInvoice) return;

  if (!detailToEmail.trim()) return setToast("Customer email is required.");
  if (!isValidEmail(detailToEmail)) {
    return setToast("Customer email looks invalid.");
  }

  const subtotalNum = Number(detailSubtotal || 0) || 0;
  if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
    return setToast("Subtotal must be a number.");
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
    setToast(`Save failed: ${error.message}`);
    setBusy(false);
    return;
  }

  if (data) {
    setInvoices((prev) =>
      prev.map((i) => (i.id === selectedInvoice.id ? (data as InvoiceRow) : i))
    );
  }

  setToast("Saved ✓");
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
      setToast(`Update error: ${error.message}`);
      setBusy(false);
      return;
    }

    if (data) {
      const next = data as InvoiceRow;
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? next : i)));
      if (selectedInvoice?.id === invoiceId) {
        setDetailStatus(next.status || "draft");
      }
    }

    setToast("Updated ✓");
    setBusy(false);
  }
    async function deleteInvoice(id: string) {
    if (!userId) return;

    const ok = confirm("Delete this invoice?");
    if (!ok) return;

    setBusy(true);
    setToast(null);

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setToast(`Delete error: ${error.message}`);
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

    setToast("Deleted ✓");
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
    setToast(e?.message || "PDF download failed");
  } finally {
    setBusy(false);
  }
}

  async function sendInvoice(inv: InvoiceRow) {
    setToast(null);

    const to = (inv.to_email || "").trim();
    if (!to) return setToast("This invoice has no customer email.");
    if (!isValidEmail(to)) return setToast("This invoice email looks invalid.");

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
      setToast("Invoice sent ✓");
    } catch (e: any) {
      setToast(e?.message || "Send failed");
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

        {toast ? <div className="ff-toast">{toast}</div> : null}
      </div>

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
                        onChange={(e) => setVatRate(e.target.value as "0" | "20")}
                        disabled={busy || loading}
                        style={{ maxWidth: 120 }}
                      >
                        <option value="20">20%</option>
                        <option value="0">0%</option>
                      </select>
                    ) : (
                      <div className="ff-detailSub">No VAT applied</div>
                    )}
                  </div>
                </div>

                {(() => {
                  const s = Number(amount || 0) || 0;
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
                          {inv.invoice_number || `INV-${inv.id.slice(0, 6).toUpperCase()}`}
                        </div>

                        <div className="ff-leftDate">{niceDateOnly(inv.created_at)}</div>
                      </div>

                      <div className="ff-leftMeta">
                        {(req?.postcode || "—").toUpperCase()} • {req?.job_type || "Invoice"}
                      </div>

                      <div className="ff-jobQuickRow">
                        <div className="ff-jobBudget">{money(inv.amount, inv.currency)}</div>
                        <div className="ff-jobPhotos">{req?.job_number || "No job number"}</div>
                      </div>

                      <div className="ff-leftChips">
                        <span className={st.cls}>{st.text}</span>
                      </div>

                      <div className="ff-leftVisit">
                        <span>To</span>
                        <span className="ff-leftVisitMuted">{inv.to_email || "No email"}</span>
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
                <button
                  className="ff-backMobile"
                  type="button"
                  onClick={backToListMobile}
                >
                  ← Back to invoices
                </button>

                <div className="ff-enquiryHeader">
                  <div className="ff-enquiryHeaderLeft">
                    <div className="ff-enquiryTitle">
                      {selectedInvoice.invoice_number || `INV-${selectedInvoice.id.slice(0, 6).toUpperCase()}`}
                    </div>

                    <div className="ff-enquiryMeta">
                      Job: {linkedRequest?.job_number || linkedRequest?.customer_name || "—"}
                    </div>

                    <div className="ff-enquirySubMeta">
                      {linkedRequest?.postcode || "—"} • {linkedRequest?.job_type || "Invoice"}
                    </div>
                  </div>

                  <div className="ff-headerBtnRow">
                    <button
                      className="ff-btnGhost"
                      type="button"
                      onClick={saveInvoice}
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>

                    <button
                      className="ff-btnGhost"
                      type="button"
                      onClick={() => {
                        if (!selectedInvoice) return;
                        downloadInvoicePdf(selectedInvoice);
                      }}
                      disabled={!selectedInvoice}
                    >
                      Download PDF
                    </button>

                    <button
                      className="ff-btnPrimary"
                      type="button"
                      onClick={() => {
                        if (!selectedInvoice) return;
                        sendInvoice(selectedInvoice);
                      }}
                      disabled={busy || !selectedInvoice}
                    >
                      Send
                    </button>

                    <button
  className="ff-btnSuccess"
  type="button"
  onClick={() => {
    if (!selectedInvoice) return;
    markStatus(selectedInvoice.id, "paid");
  }}
  disabled={busy || !selectedInvoice}
>
  Mark as paid
</button>

                    <button
                      className="ff-btnDanger ff-btnDangerSm"
                      type="button"
                      onClick={() => {
                        if (!selectedInvoice) return;
                        deleteInvoice(selectedInvoice.id);
                      }}
                      disabled={busy || !selectedInvoice}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="ff-rightTabs">
                  <button
                    className={`ff-tabPill ${tab === "details" ? "isActive" : ""}`}
                    onClick={() => setTab("details")}
                    type="button"
                  >
                    Details
                  </button>

                  <button
                    className={`ff-tabPill ${tab === "status" ? "isActive" : ""}`}
                    onClick={() => setTab("status")}
                    type="button"
                  >
                    Status
                  </button>

                  <button
                    className={`ff-tabPill ${tab === "notes" ? "isActive" : ""}`}
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
                                onChange={(e) => setDetailVatRate(e.target.value as "0" | "20")}
                                style={{ maxWidth: 140 }}
                              >
                                <option value="20">20%</option>
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
                          className="ff-textarea"
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

);

  
<style jsx>{`

  .ff-page {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: transparent;
    padding: 0;
  }

  .ff-wrap {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 0;
  }

  .ff-top {
    flex: 0 0 auto;
    overflow: hidden;
    border: 1px solid ${FF.border};
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
  }

  .ff-hero {
    position: relative;
    overflow: hidden;
    padding: 18px 16px 14px;
    background: linear-gradient(
      135deg,
      rgba(36, 91, 255, 0.1),
      rgba(255, 255, 255, 0.96)
    );
  }

  .ff-heroGlow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 16% 20%, rgba(36, 91, 255, 0.14), transparent 55%),
      radial-gradient(circle at 86% 24%, rgba(11, 42, 85, 0.07), transparent 60%);
  }

  .ff-heroRow {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .ff-heroLeft {
    display: grid;
    gap: 8px;
  }

  .ff-heroTitle {
    font-size: 28px;
    line-height: 1.05;
    letter-spacing: -0.02em;
    font-weight: 950;
    color: ${FF.navySoft};
  }

  .ff-heroRule {
    width: 220px;
    height: 3px;
    border-radius: 999px;
    opacity: 0.95;
    background: ${FF.blueLine};
  }

  .ff-sub {
    margin-top: 2px;
    font-size: 12px;
    font-weight: 600;
    color: ${FF.muted};
  }

  .ff-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .ff-btnGhost,
  .ff-btnPrimary,
  .ff-btnDanger,
  .ff-tabPill {
    transition: all 0.15s ease;
  }

  .ff-btnGhost:hover,
  .ff-btnPrimary:hover,
  .ff-btnDanger:hover,
  .ff-tabPill:hover {
    transform: translateY(-1px);
  }

  .ff-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
    border-top: 1px solid ${FF.border};
    background: linear-gradient(
      180deg,
      rgba(36, 91, 255, 0.06),
      rgba(255, 255, 255, 0)
    );
  }

  .ff-filterRow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ff-input {
    height: 38px;
    padding: 0 12px;
    border: 1px solid ${FF.border};
    border-radius: 14px;
    background: #fff;
    outline: none;
    font-size: 13px;
    color: ${FF.text};
    min-width: 0;
    width: 260px;
    max-width: 260px;
    box-sizing: border-box;
  }

  .ff-pillSmall {
    height: 32px;
    padding: 0 12px;
    border: 1px solid ${FF.border};
    border-radius: 999px;
    background: #fff;
    color: ${FF.muted};
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
  }

  .ff-pillNeutralActive {
    border-color: rgba(36, 91, 255, 0.35);
    background: rgba(36, 91, 255, 0.12);
    color: ${FF.navySoft};
  }

  .ff-toast {
    margin: 0;
    flex: 0 0 auto;
    border: 1px solid ${FF.border};
    border-radius: 14px;
    background: #fff;
    padding: 10px 12px;
    font-size: 13px;
    color: ${FF.text};
  }

  .ff-grid {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    gap: 14px;
    grid-template-columns: 360px minmax(0, 1fr);
  }

  .ff-grid > * {
    min-height: 0;
    min-width: 0;
  }

  .ff-card {
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid ${FF.border};
    border-radius: 18px;
    background: #fff;
    box-shadow:
      0 1px 0 rgba(15, 23, 42, 0.03),
      0 14px 30px rgba(15, 23, 42, 0.08);
  }

  .ff-leftPane {
    min-height: 0;
  }

  .ff-leftHeadRow {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px;
    border-bottom: 1px solid ${FF.border};
  }

  .ff-leftTitle {
    font-weight: 900;
    color: ${FF.navySoft};
  }

  .ff-leftCount {
    padding: 4px 10px;
    border: 1px solid ${FF.border};
    border-radius: 999px;
    background: #f7f9fc;
    color: ${FF.muted};
    font-size: 12px;
    font-weight: 900;
  }

  .ff-leftList {
    flex: 1 1 auto;
    min-height: 0;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .ff-createCard {
    border: 1px solid rgba(36, 91, 255, 0.18);
    border-radius: 18px;
    background: linear-gradient(
      180deg,
      rgba(36, 91, 255, 0.08) 0%,
      rgba(36, 91, 255, 0.04) 40%,
      #ffffff
    );
    box-shadow:
      0 1px 0 rgba(36, 91, 255, 0.06),
      0 12px 28px rgba(15, 23, 42, 0.06);
    padding: 16px;
  }

  .ff-btnSuccess {
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(
    135deg,
    #15803d,
    #15803d
  );
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  box-shadow:
    0 6px 16px rgba(34, 197, 94, 0.25),
    0 2px 6px rgba(0, 0, 0, 0.05);
}

.ff-btnSuccess:hover {
  transform: translateY(-1px);
  box-shadow:
    0 10px 22px rgba(34, 197, 94, 0.35),
    0 4px 10px rgba(0, 0, 0, 0.08);
}

.ff-btnSuccess:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
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

  .ff-field {
    min-width: 0;
  }

  .ff-fieldFull {
    grid-column: 1 / -1;
  }

  .ff-fieldFull .ff-btnPrimary {
    width: 100%;
    margin-top: 2px;
  }

  .ff-label {
    color: ${FF.muted};
    opacity: 0.9;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 5px;
    display: block;
  }

  .ff-leftItem {
    width: 100%;
    text-align: left;
    border-radius: 22px;
    padding: 0;
    overflow: visible;
    border: 1px solid #e6ecf5;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.18s ease;
    display: block;
    min-height: 175px;
    position: relative;
    box-shadow:
      0 1px 0 rgba(15, 23, 42, 0.03),
      0 10px 22px rgba(15, 23, 42, 0.06);
  }

  .ff-leftItem:focus {
    outline: none;
  }

  .ff-leftItem:focus-visible {
    outline: 2px solid rgba(36, 91, 255, 0.22);
    outline-offset: 2px;
  }

  .ff-leftItem:hover {
    transform: translateY(-3px);
    border-color: rgba(36, 91, 255, 0.25);
    background: linear-gradient(
      90deg,
      rgba(36, 91, 255, 0.08) 0%,
      rgba(36, 91, 255, 0.03) 40%,
      #ffffff 85%
    );
    box-shadow:
      0 6px 18px rgba(15, 23, 42, 0.08),
      0 20px 42px rgba(15, 23, 42, 0.12);
  }

  .ff-leftItem[data-active="1"] {
    background: linear-gradient(
      90deg,
      rgba(36, 91, 255, 0.18) 0%,
      rgba(36, 91, 255, 0.06) 45%,
      #ffffff 100%
    );
    box-shadow:
      0 0 0 2px rgba(36, 91, 255, 0.18),
      0 18px 40px rgba(15, 23, 42, 0.12);
  }

  .ff-leftItem[data-active="1"]::before {
    content: "";
    position: absolute;
    left: 12px;
    top: 20px;
    bottom: 20px;
    width: 3px;
    border-radius: 999px;
    background: linear-gradient(
      180deg,
      #1d4ed8 0%,
      #2563eb 35%,
      #60a5fa 72%,
      rgba(96, 165, 250, 0.18) 100%
    );
    box-shadow: 0 0 8px rgba(37, 99, 235, 0.22);
    z-index: 3;
    pointer-events: none;
  }

  .ff-leftItemInner {
    position: relative;
    z-index: 2;
    padding: 18px 18px 16px 30px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ff-leftItemTop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .ff-jobNumber {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: #1f355c;
    font-size: 20px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: -0.03em;
  }

  .ff-leftDate {
    white-space: nowrap;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1;
    font-weight: 700;
  }

  .ff-leftMeta {
    margin-top: 0;
    color: #8a94a6;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 700;
  }

  .ff-jobQuickRow {
    display: flex;
    align-items: center;
    gap: 10px 14px;
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .ff-jobBudget {
    color: #102a56;
    font-size: 13px;
    line-height: 1.15;
    font-weight: 900;
    letter-spacing: -0.01em;
  }

  .ff-jobPhotos {
    color: #9aa4b2;
    font-size: 13px;
    line-height: 1.15;
    font-weight: 700;
  }

  .ff-leftChips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 2px;
  }

  .ff-leftVisit {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
    color: #102a56;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 900;
  }

  .ff-leftVisitMuted {
    color: #9aa4b2;
    font-weight: 700;
  }

  /* Draft = amber like bookings */
  .ff-leftGlowDraft {
    border-color: rgba(245, 158, 11, 0.34);
    box-shadow:
      0 0 0 3px rgba(245, 158, 11, 0.2),
      0 14px 30px rgba(15, 23, 42, 0.1) !important;
  }

  .ff-leftGlowDraft:hover {
    border-color: rgba(245, 158, 11, 0.46);
    box-shadow:
      0 0 0 3px rgba(245, 158, 11, 0.24),
      0 20px 42px rgba(15, 23, 42, 0.12) !important;
  }

  .ff-leftGlowDraft[data-active="1"] {
    border-color: rgba(245, 158, 11, 0.52);
  }

  /* Sent = blue like bookings */
  .ff-leftGlowSent {
    border-color: rgba(59, 130, 246, 0.3);
    box-shadow:
      0 0 0 3px rgba(59, 130, 246, 0.14),
      0 14px 30px rgba(15, 23, 42, 0.1) !important;
  }

  .ff-leftGlowSent:hover {
    border-color: rgba(59, 130, 246, 0.42);
    box-shadow:
      0 0 0 3px rgba(59, 130, 246, 0.18),
      0 20px 42px rgba(15, 23, 42, 0.12) !important;
  }

  .ff-leftGlowSent[data-active="1"] {
    border-color: rgba(59, 130, 246, 0.5);
  }

  /* Paid = green like bookings */
  .ff-leftGlowPaid {
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow:
      0 0 0 3px rgba(34, 197, 94, 0.18),
      0 12px 28px rgba(15, 23, 42, 0.08) !important;
  }

  .ff-leftGlowPaid:hover {
    border-color: rgba(34, 197, 94, 0.42);
    box-shadow:
      0 0 0 3px rgba(34, 197, 94, 0.22),
      0 18px 36px rgba(15, 23, 42, 0.1) !important;
  }

  .ff-leftGlowPaid[data-active="1"] {
    border-color: rgba(34, 197, 94, 0.5);
  }

  /* Void = red like bookings */
  .ff-leftGlowVoid {
    border-color: rgba(239, 68, 68, 0.34);
    box-shadow:
      0 0 0 3px rgba(239, 68, 68, 0.22),
      0 14px 30px rgba(15, 23, 42, 0.1) !important;
  }

  .ff-leftGlowVoid:hover {
    border-color: rgba(239, 68, 68, 0.46);
    box-shadow:
      0 0 0 3px rgba(239, 68, 68, 0.26),
      0 20px 42px rgba(15, 23, 42, 0.12) !important;
  }

  .ff-leftGlowVoid[data-active="1"] {
    border-color: rgba(239, 68, 68, 0.52);
  }

  .ff-rightPane {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .ff-rightBody {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 24px 28px 28px;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
  }

  .ff-enquiryHeader {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 16px 18px;
    border: 1px solid rgba(36, 91, 255, 0.3);
    border-radius: 18px;
    background: linear-gradient(
      90deg,
      rgba(36, 91, 255, 0.16) 0%,
      rgba(36, 91, 255, 0.08) 35%,
      rgba(36, 91, 255, 0.03) 60%,
      #ffffff 100%
    );
  }

  .ff-enquiryHeaderLeft {
    min-width: 0;
  }

  .ff-enquiryTitle {
    margin-bottom: 6px;
    color: ${FF.navySoft};
    font-size: 16px;
    font-weight: 950;
  }

  .ff-enquiryMeta {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${FF.muted};
    font-size: 13px;
    font-weight: 750;
  }

  .ff-enquirySubMeta {
    margin-top: 4px;
    color: ${FF.muted};
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    transition: all 0.15s ease;
  }

  .ff-backMobile:hover {
    background: rgba(31, 53, 92, 0.12);
  }

  .ff-btnGhost {
    height: 38px;
    padding: 0 14px;
    border: 1px solid ${FF.border};
    border-radius: 999px;
    background: #fff;
    color: ${FF.navySoft};
    font-weight: 800;
    font-size: 12px;
    cursor: pointer;
  }

  .ff-btnPrimary {
    height: 38px;
    padding: 0 14px;
    border: none;
    border-radius: 999px;
    background: ${FF.navySoft};
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .ff-btnDanger {
    height: 38px;
    padding: 0 14px;
    border: 1px solid #fecaca;
    border-radius: 999px;
    background: #fff;
    color: #dc2626;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
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

  .ff-rightInner {
    width: 100%;
    min-width: 0;
  }

  .ff-emptyWrap {
    min-height: 260px;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ff-empty {
    width: 100%;
    max-width: 520px;
    padding: 24px;
    border: 1px dashed rgba(36, 91, 255, 0.28);
    border-radius: 18px;
    background: ${FF.blueSoft2};
    text-align: center;
    box-shadow: none;
  }

  .ff-emptyTitle {
    font-weight: 900;
    color: ${FF.navySoft};
    font-size: 16px;
  }

  .ff-emptySub {
    margin-top: 6px;
    font-size: 13px;
    color: ${FF.muted};
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
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
    background: linear-gradient(
      180deg,
      rgba(36, 91, 255, 0.08) 0%,
      rgba(36, 91, 255, 0.04) 40%,
      #ffffff
    );
    box-shadow:
      0 1px 0 rgba(36, 91, 255, 0.06),
      0 12px 28px rgba(15, 23, 42, 0.06);
    transition: all 160ms ease;
  }

  .ff-detailCard:hover {
    transform: translateY(-1px);
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

  .ff-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .ff-chipGray {
    background: #f7f9fc;
    border-color: ${FF.border};
    color: ${FF.muted};
  }

  .ff-chipBlue {
    background: ${FF.blueSoft};
    border-color: rgba(36, 91, 255, 0.32);
    color: ${FF.navySoft};
  }

  .ff-chipGreen {
    background: ${FF.greenSoft};
    border-color: #bfe9cf;
    color: #116b3a;
  }

  .ff-chipRed {
    background: ${FF.redSoft};
    border-color: #ffc0c0;
    color: #8a1f1f;
  }

  .ff-chipAmber {
    background: ${FF.amberSoft};
    border-color: #ffd7a3;
    color: #8a4b00;
  }

  @media (max-width: 980px) {
    .ff-page[data-mobile-detail="1"] .ff-leftPane {
      display: none;
    }

    .ff-page[data-mobile-detail="0"] .ff-rightPane {
      display: none;
    }

    .ff-grid {
      grid-template-columns: 1fr;
    }

    .ff-rightBody {
      padding: 16px;
    }

    .ff-wrap {
      gap: 10px;
    }

    .ff-backMobile {
      display: inline-block;
    }

    .ff-leftPane .ff-leftItem[data-active="1"] {
      background: #fff;
      border-color: #e6ecf5;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
    }

    .ff-leftPane .ff-leftItem[data-active="1"]::before {
      content: none;
    }
  }
`}</style>
</div>
);
}