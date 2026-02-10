"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type RequestRow = {
  id: string;
  name: string | null;
  postcode: string | null;
  status: string | null;
  booked_start?: string | null;
  calendar_event_id?: string | null;
};

export default function NewInvoicePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const presetRequestId = sp.get("requestId") || "";

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [requestId, setRequestId] = useState(presetRequestId);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("GBP");
  const [status, setStatus] = useState<"draft" | "sent" | "paid" | "void">("draft");
  const [dueDate, setDueDate] = useState(""); // YYYY-MM-DD
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setErr("You must be logged in.");
        setLoading(false);
        return;
      }

      // Only show booked jobs (or anything with calendar_event_id)
      const { data, error } = await supabase
        .from("requests")
        .select("id, name, postcode, status, booked_start, calendar_event_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErr(error.message);
        setRequests([]);
      } else {
        const all = (data || []) as RequestRow[];
        setRequests(all.filter((r) => r.status === "booked" || r.calendar_event_id));
      }

      setLoading(false);
    };

    load();
  }, []);

  const requestLabel = (r: RequestRow) =>
    `${r.name || "Customer"}${r.postcode ? ` • ${r.postcode}` : ""}`;

  const selected = useMemo(
    () => requests.find((r) => r.id === requestId) || null,
    [requests, requestId]
  );

  const createInvoice = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    const cleanAmount = Number(amount);
    if (!requestId) {
      setErr("Choose a job to invoice.");
      return;
    }
    if (!Number.isFinite(cleanAmount) || cleanAmount < 0) {
      setErr("Enter a valid amount.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErr("Not logged in.");
      setSaving(false);
      return;
    }

    const due_at = dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null;

    const { error } = await supabase.from("invoices").insert({
      user_id: user.id,
      request_id: requestId,
      invoice_number: invoiceNumber.trim() || null,
      amount: cleanAmount,
      currency,
      status,
      due_at,
      notes: notes.trim() || null,
    });

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setMsg("Invoice created ✅");
    setSaving(false);
    router.replace("/dashboard/invoices");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">New invoice</h1>
          <p className="text-sm text-gray-500">
            Create an invoice for a booked job.
          </p>
        </div>
        <Link href="/dashboard/invoices" className="text-sm underline text-gray-700">
          Back
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && (
        <form onSubmit={createInvoice} className="rounded-2xl bg-white shadow-md p-6 space-y-4">
          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-green-700">{msg}</p>}

          <div>
            <label className="block text-sm font-medium mb-1">Job</label>
            <select
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select a booked job…</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {requestLabel(r)}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: {requestLabel(selected)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Invoice # (optional)</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="INV-1001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Due date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Payment terms, bank details, etc."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create invoice"}
          </button>
        </form>
      )}
    </div>
  );
}
