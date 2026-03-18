"use client";

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  slug: string | null;
  display_name: string | null;
  headline: string | null;
  notify_email: string | null;
  logo_url: string | null;

  vat_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
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

const digitsOnly = (v: string) => v.replace(/\D/g, "");
const formatSortCode = (v: string) => {
  const d = digitsOnly(v).slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
};

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL || "https://thefixflowapp.com";

  const publicQuoteLink = useMemo(() => {
    const s = (slug || "").trim();
    if (!s) return "";

    const base = SITE_URL.replace(/\/$/, "");
    return `${base}/p/${s}/quote`;
  }, [slug, SITE_URL]);

  const publicProfileUrl = useMemo(() => {
    const s = (slug || "").trim();
    if (!s) return "";

    const base = SITE_URL.replace(/\/$/, "");
    return `${base}/${s}`;
  }, [slug, SITE_URL]);

  // estimate details
  const [vatNumber, setVatNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  // logo upload
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // calendar banner
  const [calStatus, setCalStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const v = new URLSearchParams(window.location.search).get("cal");
      if (v) setCalStatus(v);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setLoading(false);
        setMsg("You must be logged in to view profile settings.");
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, slug, display_name, headline, notify_email, logo_url, vat_number, bank_name, bank_account_name, bank_sort_code, bank_account_number"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setMsg(`Error loading profile: ${error.message}`);
        setLoading(false);
        return;
      }

      const p = (data || null) as ProfileRow | null;
      setProfile(p);

      setSlug(p?.slug || "");
      setDisplayName(p?.display_name || "");
      setHeadline(p?.headline || "");
      setNotifyEmail(p?.notify_email || user.email || "");

      setVatNumber(p?.vat_number || "");
      setBankName(p?.bank_name || "");
      setBankAccountName(p?.bank_account_name || "");
      setBankSortCode(p?.bank_sort_code || "");
      setBankAccountNumber(p?.bank_account_number || "");

      setLoading(false);
    };

    load();
  }, []);

  const copyLink = async () => {
    if (!publicQuoteLink) return;
    try {
      await navigator.clipboard.writeText(publicQuoteLink);
      setMsg("Public link copied ✅");
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg("Could not copy link. Please copy it manually.");
    }
  };

  const openLink = () => {
    if (!publicQuoteLink) return;
    window.open(publicQuoteLink, "_blank", "noopener,noreferrer");
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setMsg(null);

    const cleanSlug = slugify(slug);
    const sortDigits = digitsOnly(bankSortCode).slice(0, 6);
    const accDigits = digitsOnly(bankAccountNumber).slice(0, 8);

    const { error } = await supabase
      .from("profiles")
      .update({
        slug: cleanSlug || null,
        display_name: displayName.trim() || null,
        headline: headline.trim() || null,
        notify_email: notifyEmail.trim() || null,

        vat_number: vatNumber.trim() || null,
        bank_name: bankName.trim() || null,
        bank_account_name: bankAccountName.trim() || null,
        bank_sort_code: sortDigits || null,
        bank_account_number: accDigits || null,
      })
      .eq("id", userId);

    if (error) {
      setMsg(error.message);
      setSaving(false);
      return;
    }

    setSlug(cleanSlug);
    setMsg("Saved ✅");
    setSaving(false);
  };

  const onLogoPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    if (!userId) return;

    const file = e.target.files?.[0] || null;
    if (!file) return;

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setLogoError("Logo too large (max 5MB).");
      return;
    }

    setLogoUploading(true);

    const ext = file.name.split(".").pop() || "png";
    const fileName = `logo-${Date.now()}.${ext}`;
    const path = `logos/${userId}/${fileName}`;

    const { error: upErr } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setLogoError(upErr.message);
      setLogoUploading(false);
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    const url = data.publicUrl;

    const { error: saveErr } = await supabase
      .from("profiles")
      .update({ logo_url: url })
      .eq("id", userId);
    if (saveErr) {
      setLogoError(saveErr.message);
      setLogoUploading(false);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, logo_url: url } : prev));
    setLogoUploading(false);
    setMsg("Logo updated ✅");
    setTimeout(() => setMsg(null), 2000);
  };

  const calBanner = (() => {
    if (!calStatus) return null;
    if (calStatus === "connected")
      return <p className="ff-helpOk">Google Calendar connected ✅</p>;
    if (calStatus === "error")
      return (
        <p className="ff-helpBad">Calendar connection failed. Try again.</p>
      );
    if (calStatus === "badstate" || calStatus === "missing")
      return (
        <p className="ff-helpBad">Calendar connection failed. Try again.</p>
      );
    if (calStatus === "dberror")
      return <p className="ff-helpBad">Calendar save failed. Try again.</p>;
    return <p className="ff-help">Calendar status: {calStatus}</p>;
  })();

  return (
    <div className="ff-page">
      <div className="ff-wrap">
        {/* HERO (Dashboard-style) */}
        <div className="ff-hero">
          <div className="ff-heroGlow" />
          <div className="ff-heroRow">
            <div>
              <h1 className="ff-heroTitle">Profile</h1>
              <p className="ff-heroSub">
                Your trader link, notifications, VAT and bank details for
                estimates.
              </p>
              <p className="ff-heroTip">
                Tip: keep your bank + VAT details up to date so your PDFs look
                pro.
              </p>
            </div>

            <div className="ff-heroActions">
              <button
                className="ff-btn ff-btnPrimary"
                type="submit"
                form="profileForm"
                disabled={saving || loading}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {msg ? <div className="ff-msg">{msg}</div> : null}

        {/* ONE COLUMN STACK (no double frame) */}
        <div className="ff-stack">
          {/* Trader link */}
          <div className="ff-card">
            <div className="ff-cardHead">
              <div>
                <div className="ff-cardTitle">TRADER LINK</div>
                <div className="ff-cardSub">
                  Put this on Google, your website, vans & cards.
                </div>
              </div>

              <button
                type="button"
                className="ff-pillBtn"
                onClick={() => {
                  if (!publicProfileUrl) return;
                  window.open(publicProfileUrl, "_blank", "noopener,noreferrer");
                }}
                disabled={loading || !publicProfileUrl}
                aria-disabled={loading || !publicProfileUrl}
              >
                Public profile
              </button>
            </div>

            <div className="ff-cardBody">
              {loading ? (
                <div className="ff-help">Loading…</div>
              ) : publicQuoteLink ? (
                <>
                  <div className="ff-chip">{publicQuoteLink}</div>
                  <div className="ff-row">
                    <button type="button" className="ff-btn" onClick={copyLink}>
                      Copy link
                    </button>
                    <button type="button" className="ff-btn" onClick={openLink}>
                      Open page
                    </button>
                  </div>
                  <div className="ff-help">
                    This is your quote form link (where customers submit a
                    request).
                  </div>
                </>
              ) : (
                <div className="ff-help">
                  Add a public slug below to generate your link.
                </div>
              )}
            </div>
          </div>

          {/* Calendar */}
          <div className="ff-card">
            <div className="ff-cardHead">
              <div>
                <div className="ff-cardTitle">CALENDAR</div>
                <div className="ff-cardSub">
                  Connect Google Calendar so FixFlow can automatically create bookings when customers accept a job.
                </div>
              </div>

              <button
                type="button"
                className="ff-btn ff-btnDark"
                onClick={() => {
                  setMsg("Opening Google Calendar connect…");
                  window.location.href = "/api/calendar/connect";
                }}
                disabled={loading}
              >
                Connect
              </button>
            </div>

            <div className="ff-cardBody">{calBanner}</div>
          </div>

          {/* Profile settings */}
          <form id="profileForm" onSubmit={handleSave} className="ff-card">
            <div className="ff-cardHead">
              <div>
                <div className="ff-cardTitle">PROFILE SETTINGS</div>
                <div className="ff-cardSub">
                  These details appear on your public page and estimate PDF.
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              {/* Logo */}
              <div className="ff-field">
                <label className="ff-label">Logo</label>

                <div className="ff-logoRow">
                  <div className="ff-logoBox">
                    {profile?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.logo_url}
                        alt="Logo"
                        className="ff-logoImg"
                      />
                    ) : (
                      <span className="ff-logoFallback">
                        {(displayName || slug || "F").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="ff-logoPick">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onLogoPicked}
                      className="ff-file"
                      disabled={logoUploading || loading}
                    />
                    <div className="ff-help">
                      PNG/JPG up to 5MB. Shows on estimates.
                    </div>
                    {logoUploading ? (
                      <div className="ff-help">Uploading…</div>
                    ) : null}
                    {logoError ? (
                      <div className="ff-helpBad">{logoError}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="ff-two">
                <div className="ff-field">
                  <label className="ff-label">Public slug</label>
                  <input
                    className="ff-input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="anna-plumbing"
                    disabled={loading}
                  />
                  <div className="ff-help">
                    Use letters/numbers/hyphens. We auto-format on save.
                  </div>
                </div>

                <div className="ff-field">
                  <label className="ff-label">Business name</label>
                  <input
                    className="ff-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Anna Plumbing"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="ff-field">
                <label className="ff-label">Headline</label>
                <input
                  className="ff-input"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Fast response • Clear pricing • Local service"
                  disabled={loading}
                />
              </div>

              <div className="ff-field">
                <label className="ff-label">Notification email</label>
                <input
                  className="ff-input"
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="you@business.com"
                  disabled={loading}
                />
              </div>

              <div className="ff-divider" />

              <div className="ff-field">
                <label className="ff-label">VAT number</label>
                <input
                  className="ff-input"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="GB123456789"
                  disabled={loading}
                />
                <div className="ff-help">Optional — shown on the estimate PDF.</div>
              </div>

              <div className="ff-divider" />

              <div className="ff-field">
                <div className="ff-sectionTitle">Bank details</div>
                <div className="ff-help">
                  Optional — displayed on your estimate/invoice PDFs.
                </div>

                <div className="ff-field" style={{ marginTop: 10 }}>
                  <label className="ff-label">Bank name</label>
                  <input
                    className="ff-input"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Barclays / Lloyds / etc"
                    disabled={loading}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Account name</label>
                  <input
                    className="ff-input"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    placeholder="Anna Plumbing Ltd"
                    disabled={loading}
                  />
                </div>

                <div className="ff-two">
                  <div className="ff-field">
                    <label className="ff-label">Sort code</label>
                    <input
                      className="ff-input"
                      value={formatSortCode(bankSortCode)}
                      onChange={(e) => setBankSortCode(e.target.value)}
                      placeholder="12-34-56"
                      inputMode="numeric"
                      disabled={loading}
                    />
                  </div>

                  <div className="ff-field">
                    <label className="ff-label">Account number</label>
                    <input
                      className="ff-input"
                      value={digitsOnly(bankAccountNumber).slice(0, 8)}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="12345678"
                      inputMode="numeric"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="ff-help">
                  We store sort code + account number as digits only.
                </div>
              </div>

              {/* ✅ Footer save button (correctly placed + no broken closing tags) */}
              <div className="ff-footerRow">
                <button
                  className="ff-btn ff-btnPrimary"
                  type="submit"
                  disabled={saving || loading}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
:global(body){ background:#f6f8fc; }

/* Page layout */
.ff-page{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  overflow-y:auto;
  overflow-x:hidden;
  -webkit-overflow-scrolling:touch;
  background:transparent;
  padding:0;
}

.ff-wrap{
padding: 14px;
display: flex;
flex-direction: column;
gap: 14px;
}
/* HERO */
.ff-hero{
  position:relative;
  border:1px solid rgba(230,234,240,0.7);
  border-radius:18px;
  padding:22px;
  background:linear-gradient(135deg, rgba(31,111,255,0.16), rgba(255,255,255,0.92) 55%);
  overflow:hidden;
  margin-bottom:16px;
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

.ff-heroSub{ margin:8px 0 0; font-size:14px; color:#5b6472; }
.ff-heroTip{ margin:10px 0 0; font-size:14px; color:#4b5563; }

.ff-heroActions{
  flex-shrink:0;
  display:flex;
  gap:10px;
}

/* Message banner */
.ff-msg{
  border:1px solid rgba(226,232,240,0.9);
  background:rgba(255,255,255,0.75);
  backdrop-filter:blur(6px);
  border-radius:14px;
  padding:12px 14px;
  font-size:13px;
  margin-bottom:12px;
}

.ff-stack{
  display:flex;
  flex-direction:column;
  gap:14px;
  padding-bottom:18px;
}

/* Cards */
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

/* Pills */
.ff-pillBtn{
  border:1px solid rgba(226,232,240,1);
  background:#f6f8fc;
  color:#0b1320;
  border-radius:999px;
  padding:8px 10px;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
  transition:all .15s ease;
}

.ff-pillBtn:hover{
  background:#eef2f7;
  border-color:#cbd5e1;
  box-shadow:0 8px 16px rgba(15,23,42,0.08);
}

/* Link chip */
.ff-chip{
  border:1px solid rgba(226,232,240,0.9);
  background:#f6f8fc;
  border-radius:14px;
  padding:11px 12px;
  font-size:13px;
  word-break:break-all;
}

.ff-row{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:12px;
}

/* Base buttons */
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
}

/* Light button hover */
.ff-btn:hover{
  background:#f3f6fb;
  border-color:#cbd5e1;
  box-shadow:0 8px 18px rgba(15,23,42,0.08);
}

/* Primary FixFlow button */
.ff-btnPrimary{
  border:1px solid rgba(15,23,42,0.20);
  background:linear-gradient(180deg,#1F355C,#162A4A);
  color:#fff;
  box-shadow:0 14px 26px rgba(31,53,92,0.16);
}

/* IMPORTANT: override hover so it stays dark */
.ff-btnPrimary:hover{
  background:linear-gradient(180deg,#1F355C,#162A4A);
  box-shadow:0 16px 30px rgba(31,53,92,0.20);
  filter:brightness(1.05);
}

/* Dark button */
.ff-btnDark{
  border:1px solid rgba(15,23,42,0.15);
  background:#0b1320;
  color:#fff;
  box-shadow:0 12px 22px rgba(11,19,32,0.14);
}

/* IMPORTANT: keep dark on hover */
.ff-btnDark:hover{
  background:#0b1320;
  filter:brightness(1.05);
  box-shadow:0 14px 26px rgba(11,19,32,0.18);
}

/* Inputs */
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
}

.ff-input:focus{
  border-color:rgba(31,111,255,0.45);
  box-shadow:0 0 0 5px rgba(31,111,255,0.12);
}

/* Misc */
.ff-help{ margin-top:6px; font-size:12px; color:#5c6b84; }
.ff-helpOk{ font-size:12px; color:#0f766e; font-weight:700; }
.ff-helpBad{ font-size:12px; color:#b91c1c; font-weight:700; }

.ff-divider{ height:1px; background:rgba(226,232,240,0.9); margin:14px 0; }

.ff-two{
  display:grid;
  gap:12px;
}

@media(min-width:720px){
  .ff-two{ grid-template-columns:1fr 1fr; }
}

.ff-logoRow{
  display:flex;
  gap:12px;
  align-items:center;
}

.ff-logoBox{
  width:52px;
  height:52px;
  border-radius:14px;
  border:1px solid rgba(226,232,240,0.95);
  background:#f6f8fc;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}

.ff-logoImg{
  width:100%;
  height:100%;
  object-fit:cover;
}

.ff-footerRow{
  display:flex;
  gap:10px;
  margin-top:8px;
}
`;