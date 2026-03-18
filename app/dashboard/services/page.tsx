"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Trade = {
  id: string;
  name: string;
  slug: string;
};

type Service = {
  id: string;
  name: string;
  price_from: number | null;
  price_to: number | null;
  trade_id: string | null;
  user_id: string | null;
  created_at?: string;
};

function money(n: number | null) {
  if (n === null || typeof n === "undefined") return "—";
  return `£${Number(n).toFixed(2)}`;
}

function guidePrice(from: number | null, to: number | null) {
  if (from === null && to === null) return "—";
  if (from !== null && to !== null) return `${money(from)} – ${money(to)}`;
  if (from !== null) return `From ${money(from)}`;
  return `Up to ${money(to)}`;
}

export default function ServicesPage() {
  const searchParams = useSearchParams();
  const tradeIdFromUrl = (searchParams.get("tradeId") || "").trim();

  const [userId, setUserId] = useState<string | null>(null);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [tradeId, setTradeId] = useState<string>("");
  const [name, setName] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

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

      const { data: t, error: tErr } = await supabase
        .from("trades")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (tErr) {
        console.error("Trades error:", tErr.message);
      }
      setTrades((t || []) as Trade[]);

      const { data: s, error: sErr } = await supabase
        .from("services")
        .select(
          "id, name, price_from, price_to, trade_id, user_id, created_at"
        )
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

  useEffect(() => {
    if (!tradeIdFromUrl) return;
    setTradeId(tradeIdFromUrl);
    setTradeFilter(tradeIdFromUrl);
  }, [tradeIdFromUrl]);

  const selectedTradeFromUrl = useMemo(() => {
    if (!tradeIdFromUrl) return null;
    return trades.find((t) => t.id === tradeIdFromUrl) || null;
  }, [tradeIdFromUrl, trades]);

  const tradeName = (id: string | null) => {
    if (!id) return "—";
    const t = trades.find((x) => x.id === id);
    return t?.name || "Unknown";
  };

  const resetForm = () => {
    setEditingId(null);
    setTradeId(tradeIdFromUrl || "");
    setName("");
    setPriceFrom("");
    setPriceTo("");
  };

  const beginEdit = (svc: Service) => {
    setEditingId(svc.id);
    setTradeId(svc.trade_id || "");
    setName(svc.name || "");
    setPriceFrom(
      svc.price_from === null || typeof svc.price_from === "undefined"
        ? ""
        : String(svc.price_from)
    );
    setPriceTo(
      svc.price_to === null || typeof svc.price_to === "undefined"
        ? ""
        : String(svc.price_to)
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

    let cleanPriceFrom: number | null = null;
    let cleanPriceTo: number | null = null;

    if (priceFrom.trim()) {
      const n = Number(priceFrom);
      if (!Number.isFinite(n) || n < 0) {
        setMsg("Guide price from must be a valid number.");
        return;
      }
      cleanPriceFrom = n;
    }

    if (priceTo.trim()) {
      const n = Number(priceTo);
      if (!Number.isFinite(n) || n < 0) {
        setMsg("Guide price to must be a valid number.");
        return;
      }
      cleanPriceTo = n;
    }

    if (
      cleanPriceFrom !== null &&
      cleanPriceTo !== null &&
      cleanPriceTo < cleanPriceFrom
    ) {
      setMsg("Guide price to cannot be lower than guide price from.");
      return;
    }

    setBusy(true);

    if (editingId) {
      const { error } = await supabase
        .from("services")
        .update({
          trade_id: tradeId,
          name: cleanName,
          price_from: cleanPriceFrom,
          price_to: cleanPriceTo,
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
            ? {
                ...s,
                trade_id: tradeId,
                name: cleanName,
                price_from: cleanPriceFrom,
                price_to: cleanPriceTo,
              }
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
        price_from: cleanPriceFrom,
        price_to: cleanPriceTo,
      })
      .select(
        "id, name, price_from, price_to, trade_id, user_id, created_at"
      )
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
      if (tradeFilter !== "all" && (s.trade_id || "") !== tradeFilter) {
        return false;
      }

      if (!term) return true;

      const t = tradeName(s.trade_id).toLowerCase();
      const n = (s.name || "").toLowerCase();
      return n.includes(term) || t.includes(term);
    });
  }, [services, tradeFilter, search, trades]);

  return (
    <div className="ff-page">
      <div className="ff-wrap">
        <div className="ff-hero">
          <div className="ff-heroGlow" />

          <div className="ff-heroRow">
            <div>
              <h1 className="ff-heroTitle">Services</h1>
              <p className="ff-heroSub">
                Add services for each trade. Customers pick a trade first, then
                a service.
              </p>
              <p className="ff-heroTip">
                {selectedTradeFromUrl
                  ? `Adding services under ${selectedTradeFromUrl.name}.`
                  : "Tip: guide prices help customers understand the likely job cost without making it a fixed quote."}
              </p>
            </div>

            <div className="ff-heroActions">
              <Link href="/dashboard/trades" className="ff-btn">
                Go to Trades
              </Link>

              <button
                className="ff-btn ff-btnPrimary"
                type="submit"
                form="serviceForm"
                disabled={busy || loading}
              >
                {busy ? "Saving…" : editingId ? "Save service" : "Add service"}
              </button>
            </div>
          </div>
        </div>

        {msg ? <div className="ff-msg">{msg}</div> : null}

        <div className="ff-stack">
          <form id="serviceForm" onSubmit={handleSubmit} className="ff-card">
            <div className="ff-cardHead">
              <div>
                <div className="ff-cardTitle">
                  {editingId ? "EDIT SERVICE" : "ADD SERVICE"}
                </div>
                <div className="ff-cardSub">
                  Create services under each trade for customers to choose from.
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              <div className="ff-four">
                <div className="ff-field">
                  <label className="ff-label">Trade</label>
                  <select
                    value={tradeId}
                    onChange={(e) => setTradeId(e.target.value)}
                    className="ff-input"
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

                <div className="ff-field ff-fieldWide">
                  <label className="ff-label">Service name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="ff-input"
                    placeholder="e.g. Boiler service"
                    disabled={busy}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Guide price from</label>
                  <input
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    className="ff-input"
                    placeholder="e.g. 3000"
                    inputMode="decimal"
                    disabled={busy}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Guide price to</label>
                  <input
                    value={priceTo}
                    onChange={(e) => setPriceTo(e.target.value)}
                    className="ff-input"
                    placeholder="e.g. 5000"
                    inputMode="decimal"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="ff-footerRow">
                <button
                  className="ff-btn ff-btnPrimary"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Saving…" : editingId ? "Save changes" : "Add service"}
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
              <span className="ff-miniStatLabel">All services</span>
              <span className="ff-miniStatValue">{services.length}</span>
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
                <div className="ff-cardTitle">SERVICE LIST</div>
                <div className="ff-cardSub">
                  Search, filter, edit and remove services.
                </div>
              </div>

              <div className="ff-headControls">
                <div className="ff-filterWrap">
                  <select
                    value={tradeFilter}
                    onChange={(e) => setTradeFilter(e.target.value)}
                    className="ff-input"
                  >
                    <option value="all">All trades</option>
                    {trades.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ff-searchWrap">
                  <input
                    className="ff-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search service or trade…"
                  />
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              <div className="ff-help" style={{ marginBottom: 12 }}>
                Tip: if a trade has no services, customers won’t have anything
                to choose after selecting that trade.
              </div>

              {loading ? (
                <div className="ff-emptyLite">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="ff-emptyLite">
                  No services yet. Add one above.
                </div>
              ) : (
                <div className="ff-tableWrap">
                  <table className="ff-table">
                    <thead>
                      <tr>
                        <th>Trade</th>
                        <th>Service</th>
                        <th>Guide price</th>
                        <th className="ff-thRight">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <span className="ff-code">{tradeName(s.trade_id)}</span>
                          </td>
                          <td>
                            <div className="ff-tableMain">{s.name}</div>
                          </td>
                          <td>{guidePrice(s.price_from, s.price_to)}</td>
                          <td className="ff-actionsCell">
                            <button
                              type="button"
                              onClick={() => beginEdit(s)}
                              className="ff-btn"
                              disabled={busy}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(s.id)}
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
  padding:26px 28px 36px 28px;
  background:linear-gradient(135deg, rgba(31,111,255,0.16), rgba(255,255,255,0.92) 55%);
  overflow:hidden;
  margin-bottom:20px;
  min-height:150px;
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
  gap:8px;
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

.ff-four{
  display:grid;
  gap:12px;
}

.ff-field{
  min-width:0;
}

.ff-fieldWide{
  min-width:0;
}

.ff-footerRow{
  display:flex;
  gap:10px;
  margin-top:14px;
  flex-wrap:wrap;
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

.ff-headControls{
  display:flex;
  gap:10px;
  align-items:flex-start;
}

.ff-filterWrap{
  width:180px;
}

.ff-searchWrap{
  width:260px;
}

.ff-miniStats{
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:10px;
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

.ff-tableWrap{
  overflow-x:auto;
  border:1px solid rgba(226,232,240,0.85);
  border-radius:16px;
}

.ff-table{
  width:100%;
  min-width:760px;
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

@media(min-width:980px){
  .ff-four{
    grid-template-columns:1fr 1.4fr 1fr 1fr;
  }
}

@media(max-width:720px){
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

  .ff-headControls{
    flex-direction:column;
    width:100%;
  }

  .ff-filterWrap,
  .ff-searchWrap{
    width:100%;
  }

  .ff-miniStats{
    grid-template-columns:1fr;
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