"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const FF = {
  pageBg: "#F6F8FC",
  card: "#FFFFFF",
  border: "rgba(226,232,240,0.9)",
  navy: "#0E1B36",
  navySoft: "#1F355C",
  text: "#0B1320",
  muted: "#5C6B84",
  blue: "#1F6FFF",
};

type PaymentsForm = {
  bank_account_name: string;
  bank_name: string;
  bank_sort_code: string;
  bank_account_number: string;
  payment_terms: string;
};

function tidySortCode(v: string) {
  const digits = (v || "").replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

export default function PaymentsSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [form, setForm] = useState<PaymentsForm>({
    bank_account_name: "",
    bank_name: "",
    bank_sort_code: "",
    bank_account_number: "",
    payment_terms: "Payment due within 14 days.",
  });

  const canSave = useMemo(() => {
    // allow saving partials, but basic validation if they enter numbers
    const sc = form.bank_sort_code.replace(/\D/g, "");
    const an = form.bank_account_number.replace(/\D/g, "");
    if (sc && sc.length !== 6) return false;
    if (an && an.length < 6) return false;
    return true;
  }, [form]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("bank_account_name,bank_name,bank_sort_code,bank_account_number,payment_terms")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setForm({
        bank_account_name: data?.bank_account_name || "",
        bank_name: data?.bank_name || "",
        bank_sort_code: data?.bank_sort_code || "",
        bank_account_number: data?.bank_account_number || "",
        payment_terms: data?.payment_terms || "Payment due within 14 days.",
      });

      setLoading(false);
    })();
  }, [router]);

  async function onSave() {
    setOk(null);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) {
      setError("Not logged in.");
      return;
    }

    setSaving(true);

    const payload = {
      bank_account_name: form.bank_account_name.trim() || null,
      bank_name: form.bank_name.trim() || null,
      bank_sort_code: form.bank_sort_code.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null,
      payment_terms: form.payment_terms.trim() || null,
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", uid);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setOk("Saved.");
    setTimeout(() => setOk(null), 1500);
  }

  return (
    <div className="ff-page">
      <div className="ff-wrap">
        <div className="ff-head">
          <div>
            <div className="ff-title">Payments</div>
            <div className="ff-sub">Save bank details once — they’ll appear on estimates automatically.</div>
          </div>
          <button className="ff-btn" onClick={onSave} disabled={saving || loading || !canSave}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {error ? <div className="ff-alert ff-alertErr">{error}</div> : null}
        {ok ? <div className="ff-alert ff-alertOk">{ok}</div> : null}

        <div className="ff-card">
          <div className="ff-grid">
            <label className="ff-field">
              <span>Account name</span>
              <input
                value={form.bank_account_name}
                onChange={(e) => setForm((s) => ({ ...s, bank_account_name: e.target.value }))}
                placeholder="e.g. KV Plumbing & Heating LTD"
              />
            </label>

            <label className="ff-field">
              <span>Bank name</span>
              <input
                value={form.bank_name}
                onChange={(e) => setForm((s) => ({ ...s, bank_name: e.target.value }))}
                placeholder="e.g. NatWest"
              />
            </label>

            <label className="ff-field">
              <span>Sort code</span>
              <input
                value={form.bank_sort_code}
                onChange={(e) => setForm((s) => ({ ...s, bank_sort_code: tidySortCode(e.target.value) }))}
                placeholder="00-00-00"
                inputMode="numeric"
              />
              <small>6 digits</small>
            </label>

            <label className="ff-field">
              <span>Account number</span>
              <input
                value={form.bank_account_number}
                onChange={(e) =>
                  setForm((s) => ({ ...s, bank_account_number: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                }
                placeholder="12345678"
                inputMode="numeric"
              />
              <small>Numbers only</small>
            </label>

            <label className="ff-field ff-span2">
              <span>Payment terms</span>
              <textarea
                value={form.payment_terms}
                onChange={(e) => setForm((s) => ({ ...s, payment_terms: e.target.value }))}
                rows={3}
                placeholder="e.g. Payment due within 14 days."
              />
            </label>
          </div>

          <div className="ff-note">
            Tip: If you don’t want bank details on the estimate, just leave these fields blank.
          </div>
        </div>
      </div>

      <style jsx>{`
        .ff-page {
          min-height: 100vh;
          background: ${FF.pageBg};
          padding: 24px;
        }
        .ff-wrap {
          max-width: 980px;
          margin: 0 auto;
        }
        .ff-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .ff-title {
          font-size: 26px;
          font-weight: 900;
          color: ${FF.navy};
          letter-spacing: -0.02em;
        }
        .ff-sub {
          color: ${FF.muted};
          font-size: 13px;
          margin-top: 4px;
        }
        .ff-btn {
          background: ${FF.navy};
          color: #fff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
        }
        .ff-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .ff-alert {
          border-radius: 12px;
          padding: 10px 12px;
          margin-bottom: 12px;
          font-size: 13px;
        }
        .ff-alertErr {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #9f1239;
        }
        .ff-alertOk {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #065f46;
        }
        .ff-card {
          background: ${FF.card};
          border: 1px solid ${FF.border};
          border-radius: 16px;
          padding: 16px;
        }
        .ff-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .ff-span2 {
          grid-column: span 2;
        }
        .ff-field span {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: ${FF.navySoft};
          margin-bottom: 6px;
        }
        input,
        textarea {
          width: 100%;
          border: 1px solid ${FF.border};
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          color: ${FF.text};
          background: #fff;
        }
        input:focus,
        textarea:focus {
          border-color: rgba(31, 111, 255, 0.35);
          box-shadow: 0 0 0 4px rgba(31, 111, 255, 0.12);
        }
        .ff-field small {
          display: block;
          margin-top: 6px;
          font-size: 11px;
          color: ${FF.muted};
        }
        .ff-note {
          margin-top: 12px;
          font-size: 12px;
          color: ${FF.muted};
        }
        @media (max-width: 780px) {
          .ff-grid {
            grid-template-columns: 1fr;
          }
          .ff-span2 {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}