"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Trade = {
  id: string;
  name: string;
  slug: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TradesPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [trades, setTrades] = useState<Trade[]>([]);

  // form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  // edit
  const [editingId, setEditingId] = useState<string | null>(null);

  // search
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // We allow viewing trades even if not logged in, BUT this is a dashboard page.
      // If you want to lock it down, add your auth redirect middleware.
      if (!user) {
        setMsg("You must be logged in to manage trades.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("trades")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (error) {
        console.error("Load trades error:", error.message);
        setMsg(`Error loading trades: ${error.message}`);
        setTrades([]);
      } else {
        setTrades((data || []) as Trade[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  // auto-generate slug while typing name (unless user has typed slug manually in edit)
  useEffect(() => {
    if (editingId) return;
    if (!name.trim()) {
      setSlug("");
      return;
    }
    setSlug(slugify(name));
  }, [name, editingId]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSlug("");
  };

  const beginEdit = (t: Trade) => {
    setEditingId(t.id);
    setName(t.name);
    setSlug(t.slug);
    setMsg(null);
  };

  const cancelEdit = () => {
    resetForm();
    setMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const cleanName = name.trim();
    const cleanSlug = slugify(slug || name);

    if (!cleanName) {
      setMsg("Please enter a trade name.");
      return;
    }
    if (!cleanSlug) {
      setMsg("Please enter a valid slug.");
      return;
    }

    setBusy(true);

    if (editingId) {
      const { error } = await supabase
        .from("trades")
        .update({ name: cleanName, slug: cleanSlug })
        .eq("id", editingId);

      if (error) {
        console.error("Update trade error:", error.message);
        setMsg(`Could not update trade: ${error.message}`);
        setBusy(false);
        return;
      }

      setTrades((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, name: cleanName, slug: cleanSlug } : t))
      );

      setMsg("Trade updated ✅");
      resetForm();
      setBusy(false);
      return;
    }

    const { data, error } = await supabase
      .from("trades")
      .insert({ name: cleanName, slug: cleanSlug })
      .select("id, name, slug")
      .maybeSingle();

    if (error) {
      console.error("Insert trade error:", error.message);
      setMsg(`Could not add trade: ${error.message}`);
      setBusy(false);
      return;
    }

    if (data) setTrades((prev) => [data as Trade, ...prev]);

    setMsg("Trade added ✅");
    resetForm();
    setBusy(false);
  };

  const handleDelete = async (id: string) => {
    setMsg(null);
    const ok = confirm(
      "Delete this trade?\n\nThis won’t delete services, but any services linked to it will show as “Unknown trade” until you set them again."
    );
    if (!ok) return;

    setBusy(true);

    const { error } = await supabase.from("trades").delete().eq("id", id);

    if (error) {
      console.error("Delete trade error:", error.message);
      setMsg(`Could not delete trade: ${error.message}`);
      setBusy(false);
      return;
    }

    setTrades((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) resetForm();

    setMsg("Deleted ✅");
    setBusy(false);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return trades;
    return trades.filter((t) => {
      const n = (t.name || "").toLowerCase();
      const s = (t.slug || "").toLowerCase();
      return n.includes(term) || s.includes(term);
    });
  }, [trades, search]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trades</h1>
          <p className="text-sm text-gray-500">
            Manage the trades customers can select on your public quote page.
          </p>
        </div>

        <Link
          href="/dashboard/services"
          className="text-sm rounded-md border px-3 py-2 hover:bg-gray-50 w-fit"
        >
          Go to Services →
        </Link>
      </div>

      {msg && (
        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {msg}
        </div>
      )}

      {/* Add / Edit */}
      <div className="rounded-2xl bg-white shadow-md p-6 mb-6">
        <h2 className="text-sm font-semibold mb-3">
          {editingId ? "Edit trade" : "Add a trade"}
        </h2>

        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Trade name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Plumbing & Heating"
              disabled={busy}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Slug (used internally)
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="plumbing-heating"
              disabled={busy}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Letters/numbers/hyphens only. We’ll auto-format from the name.
            </p>
          </div>

          <div className="sm:col-span-6 flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : editingId ? "Save changes" : "Add trade"}
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

      {/* Search */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500">
          Tip: Add trades here, then add services under each trade in{" "}
          <Link href="/dashboard/services" className="underline">
            Services
          </Link>
          .
        </div>

        <div className="w-full max-w-xs">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-xs"
            placeholder="Search trade…"
          />
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl bg-white shadow-md overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">
            No trades yet. Add one above.
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
                    Slug
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{t.slug}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => beginEdit(t)}
                        className="text-xs rounded-md border px-3 py-1 hover:bg-gray-100 mr-2"
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
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
    </div>
  );
}
