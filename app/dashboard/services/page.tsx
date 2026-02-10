"use client";

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

type Trade = {
  id: string;
  name: string;
  slug: string;
};

type Service = {
  id: string;
  name: string;
  price: number | null;
  trade_id: string | null;
  user_id: string | null;
  created_at?: string;
};

function money(n: number | null) {
  if (n === null || typeof n === "undefined") return "—";
  return `£${Number(n).toFixed(2)}`;
}

export default function ServicesPage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // form fields
  const [tradeId, setTradeId] = useState<string>("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  // edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  // filters
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setMsg("You must be logged in to manage services.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // load trades (public)
      const { data: t, error: tErr } = await supabase
        .from("trades")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (tErr) {
        console.error("Trades error:", tErr.message);
      }
      setTrades((t || []) as Trade[]);

      // load services (this user)
      const { data: s, error: sErr } = await supabase
        .from("services")
        .select("id, name, price, trade_id, user_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (sErr) {
        console.error("Services error:", sErr.message);
        setMsg(`Error loading services: ${sErr.message}`);
        setServices([]);
      } else {
        setServices((s || []) as Service[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const tradeName = (id: string | null) => {
    if (!id) return "—";
    const t = trades.find((x) => x.id === id);
    return t?.name || "Unknown";
  };

  const resetForm = () => {
    setEditingId(null);
    setTradeId("");
    setName("");
    setPrice("");
  };

  const beginEdit = (svc: Service) => {
    setEditingId(svc.id);
    setTradeId(svc.trade_id || "");
    setName(svc.name || "");
    setPrice(
      svc.price === null || typeof svc.price === "undefined"
        ? ""
        : String(svc.price)
    );
    setMsg(null);
  };

  const cancelEdit = () => {
    resetForm();
    setMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!userId) {
      setMsg("You must be logged in.");
      return;
    }

    const cleanName = name.trim();
    if (!tradeId) {
      setMsg("Please choose a trade.");
      return;
    }
    if (!cleanName) {
      setMsg("Please enter a service name.");
      return;
    }

    let cleanPrice: number | null = null;
    if (price.trim()) {
      const n = Number(price);
      if (!Number.isFinite(n) || n < 0) {
        setMsg("Price must be a valid number (0 or more).");
        return;
      }
      cleanPrice = n;
    }

    setBusy(true);

    if (editingId) {
      const { error } = await supabase
        .from("services")
        .update({
          trade_id: tradeId,
          name: cleanName,
          price: cleanPrice,
        })
        .eq("id", editingId)
        .eq("user_id", userId);

      if (error) {
        console.error("Update service error:", error.message);
        setMsg(`Could not update service: ${error.message}`);
        setBusy(false);
        return;
      }

      setServices((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, trade_id: tradeId, name: cleanName, price: cleanPrice }
            : s
        )
      );

      setMsg("Service updated ✅");
      resetForm();
      setBusy(false);
      return;
    }

    const { data, error } = await supabase
      .from("services")
      .insert({
        user_id: userId,
        trade_id: tradeId,
        name: cleanName,
        price: cleanPrice,
      })
      .select("id, name, price, trade_id, user_id, created_at")
      .maybeSingle();

    if (error) {
      console.error("Insert service error:", error.message);
      setMsg(`Could not add service: ${error.message}`);
      setBusy(false);
      return;
    }

    if (data) {
      setServices((prev) => [data as Service, ...prev]);
    }

    setMsg("Service added ✅");
    resetForm();
    setBusy(false);
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    setMsg(null);

    const ok = confirm("Delete this service?");
    if (!ok) return;

    setBusy(true);

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Delete error:", error.message);
      setMsg(`Could not delete: ${error.message}`);
      setBusy(false);
      return;
    }

    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) resetForm();

    setMsg("Deleted ✅");
    setBusy(false);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return services.filter((s) => {
      if (tradeFilter !== "all") {
        if ((s.trade_id || "") !== tradeFilter) return false;
      }
      if (!term) return true;

      const t = tradeName(s.trade_id).toLowerCase();
      const n = (s.name || "").toLowerCase();
      return n.includes(term) || t.includes(term);
    });
  }, [services, tradeFilter, search, trades]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="text-sm text-gray-500">
          Add services for each trade. Customers will pick a trade first, then a
          service.
        </p>
      </div>

      {msg && (
        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {msg}
        </div>
      )}

      {/* Add / Edit */}
      <div className="rounded-2xl bg-white shadow-md p-6 mb-6">
        <h2 className="text-sm font-semibold mb-3">
          {editingId ? "Edit service" : "Add a service"}
        </h2>

        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Trade
            </label>
            <select
              value={tradeId}
              onChange={(e) => setTradeId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              disabled={busy}
            >
              <option value="">Choose…</option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Service name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Boiler service"
              disabled={busy}
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Price (optional)
            </label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. 120"
              inputMode="decimal"
              disabled={busy}
            />
          </div>

          <div className="sm:col-span-4 flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : editingId ? "Save changes" : "Add service"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={busy}
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">
            Trade filter
          </label>
          <select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            className="rounded-md border px-2 py-1 text-xs"
          >
            <option value="all">All</option>
            {trades.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:max-w-xs w-full">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-xs"
            placeholder="Search service or trade…"
          />
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl bg-white shadow-md overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">
            No services yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Trade
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Service
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Price
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{tradeName(s.trade_id)}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3">{money(s.price)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => beginEdit(s)}
                        className="text-xs rounded-md border px-3 py-1 hover:bg-gray-100 mr-2"
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="text-xs rounded-md border px-3 py-1 hover:bg-gray-100"
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Tip: If a trade shows “No services set”, add at least one service under
        that trade.
      </p>
    </div>
  );
}
