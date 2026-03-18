"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type LocationRow = {
  id: string;
  user_id: string;
  postcode_prefix: string | null;
  label: string | null;
  created_at?: string;
};

function outwardFrom(input: string) {
  const t = (input || "").trim().toUpperCase();
  const outward = t.split(/\s+/)[0] || "";
  return outward.replace(/[^A-Z0-9]/g, "");
}

function looksLikeOutward(p: string) {
  return /^[A-Z0-9]{2,4}$/.test(p);
}

async function lookupLabel(outward: string): Promise<string | null> {
  const p = outwardFrom(outward);
  if (!p || !looksLikeOutward(p)) return null;

  try {
    const res = await fetch(
      `https://api.postcodes.io/outcodes/${encodeURIComponent(p)}`
    );
    const json = await res.json();

    if (!res.ok || !json?.result) return null;

    const district = (json.result.admin_district || "").toString().trim();

    let county = "";
    const c = json.result.admin_county;
    if (Array.isArray(c)) county = (c[0] ? String(c[0]).trim() : "") || "";
    else if (typeof c === "string") county = c.trim();

    const label = [district, county].filter(Boolean).join(" — ").trim();
    return label || null;
  } catch {
    return null;
  }
}

export default function LocationsPage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const outward = useMemo(() => outwardFrom(input), [input]);

  const [label, setLabel] = useState("");
  const [lookupState, setLookupState] = useState<
    "idle" | "looking" | "found" | "notfound"
  >("idle");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLookedUp = useRef<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg(null);

      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;

      if (error || !user) {
        setMsg("You must be logged in to manage locations.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: rows, error: rowsErr } = await supabase
        .from("trade_locations")
        .select("id, user_id, postcode_prefix, label, created_at")
        .eq("user_id", user.id)
        .order("postcode_prefix", { ascending: true });

      if (rowsErr) {
        setMsg(`Locations load error: ${rowsErr.message}`);
        setLocations([]);
      } else {
        setLocations((rows || []) as LocationRow[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    const p = outward;

    if (!p) {
      setLabel("");
      setLookupState("idle");
      lastLookedUp.current = "";
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      return;
    }

    if (!looksLikeOutward(p)) {
      setLabel("");
      setLookupState("idle");
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      if (lastLookedUp.current === p) return;
      lastLookedUp.current = p;

      setLookupState("looking");
      const found = await lookupLabel(p);

      if (found) {
        setLabel(found);
        setLookupState("found");
      } else {
        setLabel("");
        setLookupState("notfound");
      }
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [outward]);

  const resetForm = () => {
    setInput("");
    setLabel("");
    setLookupState("idle");
    lastLookedUp.current = "";
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!userId) {
      setMsg("You must be logged in.");
      return;
    }

    const p = outwardFrom(input);

    if (!p) {
      setMsg("Type a postcode prefix (e.g. RH16) or a postcode (e.g. RH16 1AA).");
      return;
    }

    if (!looksLikeOutward(p)) {
      setMsg(
        "That prefix looks invalid. Use only the first part (e.g. RH16, BN1, SW1A)."
      );
      return;
    }

    let finalLabel = (label || "").trim();
    if (!finalLabel) {
      setBusy(true);
      const found = await lookupLabel(p);
      setBusy(false);
      if (found) finalLabel = found;
    }

    if (!finalLabel) {
      setMsg("Couldn’t find a town/county label for that prefix. Try another.");
      return;
    }

    const already = locations.some(
      (r) => outwardFrom(r.postcode_prefix || "") === p
    );
    if (already) {
      setMsg("That postcode prefix is already added.");
      return;
    }

    setBusy(true);

    const { data: inserted, error } = await supabase
      .from("trade_locations")
      .insert({
        user_id: userId,
        postcode_prefix: p,
        label: finalLabel,
      })
      .select("id, user_id, postcode_prefix, label, created_at")
      .maybeSingle();

    if (error) {
      setMsg(`Add location error: ${error.message}`);
      setBusy(false);
      return;
    }

    if (inserted) {
      const next = [...locations, inserted as LocationRow].sort((a, b) =>
        String(a.postcode_prefix || "").localeCompare(
          String(b.postcode_prefix || "")
        )
      );
      setLocations(next);
    }

    resetForm();
    setMsg("Location added ✅");
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!userId) return;
    setMsg(null);

    const ok = confirm("Delete this postcode prefix?");
    if (!ok) return;

    setBusy(true);

    const { error } = await supabase
      .from("trade_locations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setMsg(`Delete error: ${error.message}`);
      setBusy(false);
      return;
    }

    setLocations((prev) => prev.filter((r) => r.id !== id));
    setMsg("Deleted ✅");
    setBusy(false);
  };

  return (
    <div className="ff-page">
      <div className="ff-wrap">
        <div className="ff-hero">
          <div className="ff-heroGlow" />

          <div className="ff-heroRow">
            <div className="ff-heroText">
              <h1 className="ff-heroTitle">Locations</h1>
              <p className="ff-heroSub">
                Add postcode prefixes for the areas you cover.
              </p>
              <p className="ff-heroTip">
                Tip: enter the first part only and FixFlow will auto-fill the
                area label for you.
              </p>
            </div>

            <div className="ff-heroActions">
              <Link href="/dashboard/profile" className="ff-btn">
                Go to Profile
              </Link>

              <button
                className="ff-btn ff-btnPrimary"
                type="submit"
                form="locationForm"
                disabled={busy || loading || !outward || !label}
              >
                {busy ? "Saving…" : "Add location"}
              </button>
            </div>
          </div>
        </div>

        {msg ? <div className="ff-msg">{msg}</div> : null}

        <div className="ff-stack">
          <form id="locationForm" onSubmit={add} className="ff-card">
            <div className="ff-cardHead">
              <div>
                <div className="ff-cardTitle">ADD LOCATION</div>
                <div className="ff-cardSub">
                  Add postcode prefixes and let FixFlow look up the matching
                  area.
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              <div className="ff-two">
                <div className="ff-field">
                  <label className="ff-label">Postcode prefix</label>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="ff-input"
                    placeholder="RH16 or RH16 1AA"
                    disabled={busy}
                  />
                  <div className="ff-help">
                    We only store the outward code, e.g.{" "}
                    <span className="ff-code">RH16</span>
                  </div>
                </div>

                <div className="ff-field">
                  <label className="ff-label">Label</label>
                  <input
                    value={label}
                    readOnly
                    className="ff-input ff-inputReadOnly"
                    placeholder="Auto-filled…"
                  />
                  <div className="ff-help">
                    {lookupState === "looking" ? "Looking up…" : null}
                    {lookupState === "found" && label ? "Found ✅" : null}
                    {lookupState === "notfound" && outward
                      ? `Couldn’t find a label for ${outward}`
                      : null}
                    {lookupState === "idle" && !label
                      ? "The area label will appear automatically."
                      : null}
                  </div>
                </div>
              </div>

              <div className="ff-footerRow">
                <button
                  type="submit"
                  disabled={busy || !outward || !label}
                  className="ff-btn ff-btnPrimary"
                >
                  {busy ? "Saving…" : "Add location"}
                </button>
              </div>
            </div>
          </form>

          <div className="ff-miniStats">
            <div className="ff-miniStat">
              <span className="ff-miniStatLabel">All locations</span>
              <span className="ff-miniStatValue">{locations.length}</span>
            </div>

            <div className="ff-miniStat">
              <span className="ff-miniStatLabel">Lookup</span>
              <span className="ff-miniStatValue">
                {lookupState === "found"
                  ? "Ready"
                  : lookupState === "looking"
                  ? "Looking"
                  : "Idle"}
              </span>
            </div>

            <div className="ff-miniStat">
              <span className="ff-miniStatLabel">Mode</span>
              <span className="ff-miniStatValue">{busy ? "Saving" : "Ready"}</span>
            </div>
          </div>

          <div className="ff-card">
            <div className="ff-cardHead">
              <div>
                <div className="ff-cardTitle">LOCATION LIST</div>
                <div className="ff-cardSub">
                  View and remove the postcode prefixes you cover.
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              {loading ? (
                <div className="ff-emptyLite">Loading…</div>
              ) : locations.length === 0 ? (
                <div className="ff-emptyLite">No locations yet.</div>
              ) : (
                <div className="ff-tableWrap">
                  <table className="ff-table">
                    <thead>
                      <tr>
                        <th>Postcode prefix</th>
                        <th>Label</th>
                        <th className="ff-thRight">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span className="ff-code">{r.postcode_prefix || "—"}</span>
                          </td>
                          <td>
                            <div className="ff-tableMain">{r.label || "—"}</div>
                          </td>
                          <td className="ff-actionsCell">
                            <button
                              type="button"
                              onClick={() => remove(r.id)}
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
  padding:28px 28px 44px 28px;
  background:linear-gradient(135deg, rgba(31,111,255,0.16), rgba(255,255,255,0.92) 55%);
  overflow:hidden;
  margin-bottom:24px;
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
  gap:18px;
}

.ff-heroText{
  display:flex;
  flex-direction:column;
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
  margin:0;
  font-size:14px;
  color:#5b6472;
}

.ff-heroTip{
  margin:0 0 10px;
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

.ff-inputReadOnly{
  background:#f8fafc;
}

.ff-help{
  margin-top:6px;
  font-size:12px;
  color:#5c6b84;
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