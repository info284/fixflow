// app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

type Stats = {
  enquiriesNew: number;
  enquiriesTotal: number;
  estimates: number;
  bookings: number;
  invoices: number;
};

export default function DashboardPage() {
  // ✅ Replace these with real values later
  const stats: Stats = {
    enquiriesTotal: 18,
    enquiriesNew: 0,
    estimates: 3,
    bookings: 1,
    invoices: 4,
  };
const hasNewEnquiries = stats.enquiriesNew > 0;
  const revenueThisMonth = "£0";
  const lastActivity = "08/02/2026, 17:28";
  const lastLogin = "12/02/2026, 18:07";

  const traderSlug = "anna-plumbing";
  const traderLink = `https://thefixflowapp.com/${traderSlug}`;


  const toast = (msg: string) => {
    const el = document.getElementById("ff-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("ff-toastShow");
    window.setTimeout(() => el.classList.remove("ff-toastShow"), 1400);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(traderLink);
      toast("Link copied");
    } catch {
      toast("Couldn’t copy link");
    }
  };

  const openTraderPage = () => window.open(traderLink, "_blank", "noopener,noreferrer");

  const downloadQR = () => {
    // qrcode.react renders an <svg> — grab it reliably.
    const svg = document.querySelector("#ff-qr-wrap svg") as SVGElement | null;
    if (!svg) return toast("QR not ready");

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);

    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${traderSlug}-qr.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    toast("QR downloaded");
  };

  return (
    <div className="ff-wrap">
      {/* HERO */}
      <header className="ff-hero">
        <div className="ff-heroGlow" />
        <div className="ff-heroRow">
          <div>
            <h1 className="ff-heroTitle">Dashboard</h1>
            <p className="ff-heroSub">Good evening — quick overview of what needs attention.</p>
            <p className="ff-heroTip">
              Tip: aim to keep <b>New enquiries</b> at <b>0</b> — it means you’re fully in control.
            </p>
          </div>
        </div>
      </header>

      {/* TRADER LINK + QR */}
      <section className="ff-card ff-cardPad">
        <div className="ff-sectionTop">
          <div>
            <div className="ff-eyebrow">TRADER LINK + QR</div>
            <div className="ff-muted">Put this on Google, your website, vans & cards.</div>
          </div>
          <span className="ff-chip">Public profile</span>
        </div>

        <div className="ff-linkRow">
          <div className="ff-linkBox" title={traderLink}>
            {traderLink}
          </div>

          <div className="ff-qrFrame">
            <div id="ff-qr-wrap" className="ff-qrSvgWrap" aria-label="QR code">
              <QRCodeSVG value={traderLink} size={96} />
            </div>
            <div className="ff-qrLabel">Scan</div>
          </div>
        </div>

        <div className="ff-actions">
          <button className="ff-btn ff-btnPrimarySoft" onClick={copyLink}>
            Copy link
          </button>
          <button className="ff-btn" onClick={openTraderPage}>
            Open page
          </button>
          <button className="ff-btn" onClick={downloadQR}>
            Download QR
          </button>
        </div>
      </section>

      {/* STATS (routes match your sidebar) */}
      {/* STATS (boxed + blue bar like your screenshot) */}
<section className="ff-statGrid">
  {/* Enquiries */}
 <a
  href="/dashboard/inbox"
  className={`ff-statCard ${hasNewEnquiries ? "ff-statCardAlert" : ""}`}
>
  <div className="ff-statTop">
    <div className="ff-statTitle">New enquiries</div>

    <span className={`ff-pill ${hasNewEnquiries ? "ff-pillAlert" : "ff-pillNeutral"}`}>
      Today
    </span>
  </div>

  {/* ✅ MAIN NUMBER */}
  <div className={`ff-statNumber ${hasNewEnquiries ? "ff-statNumberAlert" : ""}`}>
    {stats.enquiriesNew}
  </div>

  {/* ✅ Secondary info */}
  <div className="ff-statSub">
    Total open: {stats.enquiriesTotal} • {hasNewEnquiries ? "Needs action" : "All caught up"}
  </div>
</a>

  {/* Estimates */}
  <a href="/dashboard/estimates" className="ff-statCard">
    <div className="ff-statTop">
      <div className="ff-statTitle">Estimates</div>
      <span className="ff-pill">Active</span>
    </div>
    <div className="ff-statNumber">{stats.estimates}</div>
    <div className="ff-statSub">Sent / active estimates</div>
  </a>

  {/* Bookings */}
  <a href="/dashboard/bookings" className="ff-statCard">
    <div className="ff-statTop">
      <div className="ff-statTitle">Bookings</div>
      <span className="ff-pill">Upcoming</span>
    </div>
    <div className="ff-statNumber">{stats.bookings}</div>
    <div className="ff-statSub">Upcoming / scheduled</div>
  </a>

  {/* Invoices */}
  <a href="/dashboard/invoices" className="ff-statCard">
    <div className="ff-statTop">
      <div className="ff-statTitle">Invoices</div>
      <span className="ff-pill ff-pillNeutral">Total</span>
    </div>
    <div className="ff-statNumber">{stats.invoices}</div>
    <div className="ff-statSub">Total created</div>
  </a>
</section>

      {/* LOWER */}
      <section className="ff-lowerGrid">
        <div className="ff-card ff-cardPad">
          <div className="ff-cardTitleRow">
            <h3 className="ff-cardTitle">Recent activity</h3>
            <span className="ff-mutedSmall">Latest</span>
          </div>

          <div className="ff-emptyState">
            <div className="ff-emptyDot" />
            <div>
              <div className="ff-emptyTitle">No recent activity yet</div>
              <div className="ff-mutedSmall">
                When you send estimates, create bookings or invoices, they’ll show here.
              </div>
            </div>
          </div>

          <div className="ff-metaStrip">
            <div>
              <div className="ff-metaLabel">Last activity</div>
              <div className="ff-metaValue2">{lastActivity}</div>
            </div>
            <div>
              <div className="ff-metaLabel">Last login</div>
              <div className="ff-metaValue2">{lastLogin}</div>
            </div>
          </div>
        </div>

        <div className="ff-card ff-cardPad">
          <div className="ff-cardTitleRow">
            <h3 className="ff-cardTitle">This month</h3>
            <span className="ff-chip">Invoices</span>
          </div>

          <div className="ff-revenue">{revenueThisMonth}</div>
          <div className="ff-mutedSmall">Based on invoices created this month</div>
        </div>
      </section>

      {/* toast */}
      <div id="ff-toast" className="ff-toast" />

      <style jsx>{`
        /* Layout inside the dashboard layout card */
        .ff-wrap {
          max-width: 1120px;
          margin: 0 auto;
        }

        /* HERO */
        .ff-hero {
          position: relative;
          border: 1px solid rgba(230, 234, 240, 0.7);
          border-radius: 18px;
          padding: 22px;
          background: linear-gradient(
            135deg,
            rgba(31, 111, 255, 0.16),
            rgba(255, 255, 255, 0.92) 55%
          );
          overflow: hidden;
          margin-bottom: 16px;
        }
        .ff-heroGlow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 16% 20%, rgba(36, 91, 255, 0.14), transparent 55%),
            radial-gradient(circle at 86% 24%, rgba(11, 42, 85, 0.07), transparent 60%);
          pointer-events: none;
        }
          
        .ff-heroRow {
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }
        .ff-heroTitle {
          margin: 0;
          font-size: 28px;
          font-weight: 950;
          color: #1F355C;;
          letter-spacing: -0.02em;
        }
        .ff-heroSub {
          margin: 8px 0 0;
          font-size: 14px;
          color: #5b6472;
        }
        .ff-heroTip {
          margin: 10px 0 0;
          font-size: 14px;
          color: #4b5563;
        }

        /* CARDS */
  .ff-card{
  border: 1px solid #E6ECF5;
  border-radius: 18px;
  background: #FFFFFF;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.03),
    0 14px 30px rgba(15, 23, 42, 0.08);
}

.ff-cardPad {
  padding: 16px !important;
}
        .ff-sectionTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 12px;
        }
        .ff-eyebrow {
          font-size: 12px;
          letter-spacing: 0.08em;
          color: #6b7280;
          font-weight: 900;
        }
        .ff-muted {
          margin-top: 4px;
          font-size: 14px;
          color: #6b7280;
        }
        .ff-mutedSmall {
          font-size: 13px;
          color: #6b7280;
        }
        .ff-chip {
          font-size: 12px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.035);
          border: 1px solid rgba(15, 23, 42, 0.06);
          color: #4b5563;
          font-weight: 800;
          white-space: nowrap;
        }

        /* Buttons */
        .ff-btn {
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          border: 1px solid rgba(230, 234, 240, 0.7);
          background: #fff;
          color: #1F355C;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 800;
        }
        .ff-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(31, 111, 255, 0.22);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
        }
        .ff-btnPrimary {
          background: #1f6fff;
          border-color: #1f6fff;
          color: #fff;
          box-shadow: 0 12px 24px rgba(31, 111, 255, 0.18);
        }
        .ff-btnPrimarySoft {
          background: rgba(31, 111, 255, 0.12);
          border-color: rgba(31, 111, 255, 0.18);
          color: #1f6fff;
        }

        /* Trader link row */
        .ff-linkRow {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        @media (max-width: 980px) {
          .ff-linkRow {
            flex-direction: column;
            align-items: stretch;
          }
        }
        .ff-linkBox {
          flex: 1;
          background: #f7f9fc;
          border: 1px solid rgba(230, 234, 240, 0.7);
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 14px;
          color: #0e1a2b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ff-qrFrame {
          border: 1px solid rgba(230, 234, 240, 0.8);
          border-radius: 16px;
          padding: 10px;
          background: #fff;
          min-width: 118px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .ff-qrSvgWrap {
          width: 108px;
          height: 108px;
          border-radius: 14px;
          background: #f7f9fc;
          border: 1px solid rgba(230, 234, 240, 0.9);
          display: grid;
          place-items: center;
        }
        .ff-qrLabel {
          font-size: 12px;
          color: #6b7280;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .ff-actions {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        /* Stats */
        .ff-statGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin: 16px 0 18px;
        }
        @media (max-width: 980px) {
          .ff-statGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .ff-statGrid {
            grid-template-columns: 1fr;
          }
        }
          @media (min-width: 640px) {
  .ff-cardPad {
    padding: 20px !important;
  }
}
        .ff-statCard {
        position: relative;
          display: block;
          text-decoration: none;
          color: inherit;
          position: relative;
          background: #fff;
          border: 1px solid rgba(230, 234, 240, 0.7);
          border-radius: 16px;
          padding: 16px 16px 14px;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02), 0 6px 14px rgba(15, 23, 42, 0.05);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }



        .ff-statCard::before {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          top: 12px;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(31, 111, 255, 0.65), rgba(31, 111, 255, 0.08));
        }
        .ff-statCard:hover {
          transform: translateY(-2px);
          border-color: rgba(31, 111, 255, 0.22);
          box-shadow: 0 2px 0 rgba(15, 23, 42, 0.02), 0 14px 28px rgba(15, 23, 42, 0.1);
        }
        .ff-statTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 10px;
        }
        .ff-statTitle {
          font-size: 14px;
          color: #667085;
          font-weight: 900;
          letter-spacing: -0.01em;
        }
        .ff-statNumber {
          margin-top: 10px;
          font-size: 38px;
          font-weight: 950;
          color: #1F355C;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .ff-statSub {
          margin-top: 8px;
          font-size: 13px;
          color: #6b7280;
        }

        /* Pills */
        .ff-pill {
          font-size: 12px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(31, 111, 255, 0.1);
          color: #1f6fff;
          border: 1px solid rgba(31, 111, 255, 0.16);
          font-weight: 900;
          white-space: nowrap;
        }
        .ff-pillNeutral {
          background: rgba(15, 23, 42, 0.035);
          border: 1px solid rgba(15, 23, 42, 0.06);
          color: #4b5563;
        }

        /* Alert state for new enquiries */
        .ff-statCardAlert {
          border-color: rgba(255, 59, 48, 0.35);
          box-shadow: 0 12px 28px rgba(255, 59, 48, 0.12);
        }
        .ff-statCardAlert::before {
          background: linear-gradient(90deg, rgba(255, 59, 48, 0.8), rgba(255, 59, 48, 0.2));
        }
        .ff-pillAlert {
          background: rgba(255, 59, 48, 0.12);
          border: 1px solid rgba(255, 59, 48, 0.25);
          color: #b42318;
          font-weight: 900;
        }
        .ff-statNumberAlert {
          color: #b42318;
        }

        /* Lower */
        .ff-lowerGrid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          margin-top: 6px;
        }
        @media (max-width: 980px) {
          .ff-lowerGrid {
            grid-template-columns: 1fr;
          }
        }
        .ff-cardTitleRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .ff-cardTitle {
          margin: 0;
          font-size: 17px;
          font-weight: 900;
          color: #1F355C;
          letter-spacing: -0.01em;
        }
        .ff-emptyState {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          border-radius: 14px;
          background: #f7f9fc;
          border: 1px solid rgba(230, 234, 240, 0.7);
        }
        .ff-emptyDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #1f6fff;
          margin-top: 4px;
          box-shadow: 0 0 0 6px rgba(31, 111, 255, 0.12);
        }
        .ff-emptyTitle {
          font-size: 14px;
          font-weight: 900;
          color: #1F355C;
        }
        .ff-metaStrip {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(230, 234, 240, 0.7);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .ff-metaLabel {
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #6b7280;
          font-weight: 900;
        }
        .ff-metaValue2 {
          margin-top: 6px;
          font-size: 13px;
          color: #1F355C;
          font-weight: 900;
        }
        .ff-revenue {
          font-size: 36px;
          font-weight: 950;
          color: #1f6fff;
          margin-top: 8px;
          letter-spacing: -0.02em;
        }

        /* Toast */
        .ff-toast {
          position: fixed;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%) translateY(14px);
          background: rgba(15, 23, 42, 0.92);
          color: #fff;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .ff-toastShow {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>
    </div>
  );
}