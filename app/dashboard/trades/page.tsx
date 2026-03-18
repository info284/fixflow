"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Trade = {
  id: string;
  name: string;
  slug: string;
  services_count?: number;
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

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

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
        prev.map((t) =>
          t.id === editingId ? { ...t, name: cleanName, slug: cleanSlug } : t
        )
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

    if (data) {
      setTrades((prev) =>
        [...prev, data as Trade].sort((a, b) => a.name.localeCompare(b.name))
      );
    }

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
    <div className="ff-page">
      <div className="ff-wrap">
        <div className="ff-hero">
          <div className="ff-heroGlow" />

          <div className="ff-heroRow">
            <div>
              <h1 className="ff-heroTitle">Trades</h1>
              <p className="ff-heroSub">
                Manage the trades customers can select on your public quote
                page.
              </p>
              <p className="ff-heroTip">
                Add your trades here, then link services to them in Services.
              </p>
            </div>

            <div className="ff-heroActions">
              <Link href="/dashboard/services" className="ff-btn">
                Go to Services
              </Link>

              <button
                className="ff-btn ff-btnPrimary"
                type="submit"
                form="tradeForm"
                disabled={busy || loading}
              >
                {busy ? "Saving…" : editingId ? "Save trade" : "Add trade"}
              </button>
            </div>
          </div>
        </div>

        {msg ? <div className="ff-msg">{msg}</div> : null}

        <div className="ff-stack">
          <form id="tradeForm" onSubmit={handleSubmit} className="ff-card">
            <div className="ff-cardHead">
              <div>
                <div className="ff-cardTitle">
                  {editingId ? "EDIT TRADE" : "ADD TRADE"}
                </div>
                <div className="ff-cardSub">
                  Create and manage the trade categories used across FixFlow.
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              <div className="ff-two">
                <div className="ff-field">
                  <label className="ff-label">Trade name</label>
                  <input
                    className="ff-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Plumbing & Heating"
                    disabled={busy}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Slug</label>
                  <input
                    className="ff-input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="plumbing-heating"
                    disabled={busy}
                  />
                  <div className="ff-help">
                    Letters, numbers and hyphens only. It auto-fills from the
                    trade name.
                  </div>
                </div>
              </div>

              <div className="ff-footerRow">
                <button
                  className="ff-btn ff-btnPrimary"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Saving…" : editingId ? "Save changes" : "Add trade"}
                </button>

                {editingId ? (
                  <button
                    className="ff-btn"
                    type="button"
                    onClick={cancelEdit}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <div className="ff-miniStats">
            <div className="ff-miniStat">
              <span className="ff-miniStatLabel">All trades</span>
              <span className="ff-miniStatValue">{trades.length}</span>
            </div>

            <div className="ff-miniStat">
              <span className="ff-miniStatLabel">Showing</span>
              <span className="ff-miniStatValue">{filtered.length}</span>
            </div>

            <div className="ff-miniStat">
              <span className="ff-miniStatLabel">Mode</span>
              <span className="ff-miniStatValue">
                {editingId ? "Editing" : "Ready"}
              </span>
            </div>
          </div>

          <div className="ff-card">
            <div className="ff-cardHead">
              <div>
                <div className="ff-cardTitle">TRADE LIST</div>
                <div className="ff-cardSub">
                  Search, edit and remove trades.
                </div>
              </div>

              <div className="ff-searchWrap">
                <input
                  className="ff-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search trade…"
                />
              </div>
            </div>

            <div className="ff-cardBody">
              <div className="ff-help" style={{ marginBottom: 12 }}>
                Tip: add trades here, then add services under each trade in{" "}
                <Link href="/dashboard/services" className="ff-inlineLink">
                  Services
                </Link>
                .
              </div>

              {loading ? (
                <div className="ff-emptyLite">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="ff-emptyLite">No trades yet. Add one above.</div>
              ) : (
                <div className="ff-tableWrap">
                  <table className="ff-table">
                    <thead>
                      <tr>
                        <th>Trade</th>
                        <th>Slug</th>
                        <th className="ff-thRight">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <div className="ff-tableMain">{t.name}</div>
                          </td>
                          <td>
                            <span className="ff-code">{t.slug}</span>
                          </td>
                          <td className="ff-actionsCell">
                            <Link
                              href={`/dashboard/services?tradeId=${encodeURIComponent(
                                t.id
                              )}`}
                              className="ff-btn"
                            >
                              Services
                            </Link>

                            <button
                              type="button"
                              onClick={() => beginEdit(t)}
                              className="ff-btn"
                              disabled={busy}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(t.id)}
                              className="ff-btn ff-btnDangerLite"
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
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
:global(body){ background:#f6f8fc; }

.ff-page{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  overflow:auto;
  background:transparent;
  padding:0;
}

.ff-wrap{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  gap:14px;
  padding:14px;
  max-width:none;
  margin:0;
}

.ff-hero{
  position:relative;
  border:1px solid rgba(230,234,240,0.7);
  border-radius:18px;
  padding:22px;
  background:linear-gradient(135deg, rgba(31,111,255,0.16), rgba(255,255,255,0.92) 55%);
  overflow:hidden;
  margin-bottom:16px;
  min-height:140px;
}

.ff-heroGlow{
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at 16% 20%, rgba(36,91,255,0.14), transparent 55%),
    radial-gradient(circle at 86% 24%, rgba(11,42,85,0.07), transparent 60%);
  pointer-events:none;
}

.ff-heroRow{
  position:relative;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
}

.ff-heroTitle{
  margin:0;
  font-size:28px;
  font-weight:950;
  color:#1F355C;
  letter-spacing:-0.02em;
}

.ff-heroSub{
  margin:8px 0 0;
  font-size:14px;
  color:#5b6472;
}

.ff-heroTip{
  margin:10px 0 0;
  font-size:14px;
  color:#4b5563;
}

.ff-heroActions{
  flex-shrink:0;
  display:flex;
  gap:10px;
  align-items:center;
}

.ff-msg{
  border:1px solid rgba(226,232,240,0.9);
  background:rgba(255,255,255,0.75);
  backdrop-filter:blur(6px);
  border-radius:14px;
  padding:12px 14px;
  font-size:13px;
}

.ff-stack{
  display:flex;
  flex-direction:column;
  gap:14px;
}

.ff-card{
  background:#fff;
  border:1px solid rgba(226,232,240,0.85);
  border-radius:18px;
  box-shadow:0 16px 40px rgba(15,23,42,0.06);
  overflow:hidden;
}

.ff-cardHead{
  padding:14px 16px;
  border-bottom:1px solid rgba(226,232,240,0.75);
  display:flex;
  justify-content:space-between;
  gap:12px;
  background:linear-gradient(180deg, rgba(246,248,252,0.95), rgba(255,255,255,0.95));
  align-items:flex-start;
}

.ff-cardTitle{
  font-size:12px;
  font-weight:900;
  letter-spacing:0.08em;
  text-transform:uppercase;
}

.ff-cardSub{
  margin-top:4px;
  font-size:13px;
  color:#5b6472;
}

.ff-cardBody{
  padding:16px;
}

.ff-miniStats{
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:10px;
  margin-bottom:14px;
}

.ff-miniStat{
  border:1px solid rgba(226,232,240,0.85);
  background:#f8fbff;
  border-radius:14px;
  padding:12px;
}

.ff-miniStatLabel{
  display:block;
  font-size:11px;
  font-weight:800;
  letter-spacing:0.06em;
  text-transform:uppercase;
  color:#5c6b84;
}

.ff-miniStatValue{
  display:block;
  margin-top:4px;
  font-size:18px;
  font-weight:900;
  color:#1F355C;
}

.ff-label{
  display:block;
  font-size:12px;
  font-weight:900;
  margin-bottom:6px;
}

.ff-input{
  width:100%;
  border-radius:14px;
  border:1px solid rgba(226,232,240,0.95);
  background:#fff;
  padding:11px 12px;
  font-size:14px;
  box-sizing:border-box;
}

.ff-input:focus{
  outline:none;
  border-color:rgba(31,111,255,0.45);
  box-shadow:0 0 0 5px rgba(31,111,255,0.12);
}

.ff-help{
  margin-top:6px;
  font-size:12px;
  color:#5c6b84;
}

.ff-inlineLink{
  color:#1F355C;
  font-weight:700;
  text-decoration:underline;
}

.ff-two{
  display:grid;
  gap:12px;
}

.ff-field{
  min-width:0;
}

.ff-footerRow{
  display:flex;
  gap:10px;
  margin-top:14px;
  flex-wrap:wrap;
}

.ff-searchWrap{
  width:100%;
  max-width:260px;
}

.ff-btn{
  border:1px solid rgba(226,232,240,1);
  background:#fff;
  color:#0b1320;
  border-radius:12px;
  padding:10px 12px;
  font-size:13px;
  font-weight:800;
  cursor:pointer;
  transition:all .15s ease;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}

.ff-btn:hover{
  background:#f3f6fb;
  border-color:#cbd5e1;
  box-shadow:0 8px 18px rgba(15,23,42,0.08);
}

.ff-btnPrimary{
  border:1px solid rgba(15,23,42,0.20);
  background:linear-gradient(180deg,#1F355C,#162A4A);
  color:#fff;
  box-shadow:0 14px 26px rgba(31,53,92,0.16);
}

.ff-btnPrimary:hover{
  background:linear-gradient(180deg,#1F355C,#162A4A);
  box-shadow:0 16px 30px rgba(31,53,92,0.20);
  filter:brightness(1.05);
}

.ff-btnDangerLite{
  color:#b91c1c;
}

.ff-btnDangerLite:hover{
  background:#fff5f5;
  border-color:#fecaca;
}

.ff-tableWrap{
  overflow-x:auto;
  border:1px solid rgba(226,232,240,0.85);
  border-radius:16px;
}

.ff-table{
  width:100%;
  min-width:640px;
  border-collapse:collapse;
}

.ff-table thead th{
  background:#f8fafc;
  color:#5c6b84;
  font-size:12px;
  font-weight:800;
  text-align:left;
  padding:14px 16px;
  border-bottom:1px solid rgba(226,232,240,0.9);
}

.ff-table tbody td{
  padding:14px 16px;
  border-top:1px solid rgba(226,232,240,0.75);
  vertical-align:middle;
}

.ff-table tbody tr:hover{
  background:#fbfdff;
}

.ff-thRight{
  text-align:right !important;
}

.ff-actionsCell{
  text-align:right;
  white-space:nowrap;
}

.ff-actionsCell :global(button){
  margin-left:8px;
}

.ff-tableMain{
  font-weight:800;
  color:#0B1320;
}

.ff-code{
  display:inline-block;
  padding:6px 10px;
  border-radius:999px;
  background:#f6f8fc;
  border:1px solid rgba(226,232,240,0.9);
  font-size:12px;
  font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  color:#1F355C;
}

.ff-emptyLite{
  border:1px dashed rgba(36,91,255,0.18);
  background:#f8fbff;
  border-radius:16px;
  padding:20px;
  font-size:14px;
  color:#5c6b84;
}

@media(min-width:720px){
  .ff-two{
    grid-template-columns:1fr 1fr;
  }
}

@media(max-width:720px){
  .ff-miniStats{
    grid-template-columns:1fr;
  }

  .ff-heroRow,
  .ff-cardHead{
    flex-direction:column;
    align-items:stretch;
  }

  .ff-heroActions{
    width:100%;
  }

  .ff-heroActions > :global(a),
  .ff-heroActions > :global(button){
    width:100%;
  }

  .ff-searchWrap{
    max-width:none;
  }

  .ff-actionsCell{
    white-space:normal;
  }

  .ff-actionsCell :global(button){
    margin-left:0;
    margin-right:8px;
    margin-top:8px;
  }
}
`;