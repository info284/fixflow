"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  business_name: string | null;
  slug: string | null;
};

function SmallCard({
  title,
  children,
  span = 1,
}: {
  title: ReactNode;
  children: ReactNode;
  span?: 1 | 2 | 3 | 4;
}) {

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        padding: 16,
        background: "#FFFFFF",
        gridColumn: `span ${span}`,
        minHeight: 92,
      }}
    >
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ value, sub }: { value: string | number; sub?: string }) {
  return (
    <>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#0B1C2D",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
          {sub}
        </div>
      ) : null}
    </>
  );
}

function TopFrontDoorBar({
  profile,
  loading,
}: {
  profile: Profile;
  loading: boolean;
}) {
  const slug = profile.slug;
  const publicLink = slug ? `https://thefixflowapp.com/${slug}` : null;
  const qrUrl = slug ? `/api/qr?slug=${encodeURIComponent(slug)}` : null;

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        padding: 14,
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 320 }}>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          Trader link + QR code
        </div>

        {loading ? (
          <div style={{ marginTop: 6, fontSize: 13, color: "#64748B" }}>
            Loading…
          </div>
        ) : publicLink && qrUrl ? (
          <>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <code
                style={{
                  background: "#F7F9FC",
                  border: "1px solid #E5E7EB",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 12,
                }}
              >
                {publicLink}
              </code>

              <button
                onClick={() => navigator.clipboard.writeText(publicLink)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "#1F6FFF",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Copy
              </button>

              <a
                href={qrUrl}
                download={`${slug}-fixflow-qr.png`}
                style={{ color: "#1F6FFF", fontSize: 13 }}
              >
                Download QR
              </a>
            </div>

            <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
              Put this on Google, website, vans & cards.
            </div>
          </>
        ) : (
          <div style={{ marginTop: 6, fontSize: 13, color: "#991B1B" }}>
            Branded link not set up yet (no slug found).
          </div>
        )}
      </div>

      {qrUrl ? (
        <img
          src={qrUrl}
          alt="FixFlow QR code"
          width={72}
          height={72}
          style={{
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
          }}
        />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            border: "1px dashed #E5E7EB",
            background: "#F7F9FC",
          }}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>({
    business_name: null,
    slug: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ FIXED enquiry logic
  const [newEnquiries, setNewEnquiries] = useState(0); // unread + open
  const [openEnquiries, setOpenEnquiries] = useState(0); // open total (not replied)

  const [estimates, setEstimates] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [invoices, setInvoices] = useState(0);

  useEffect(() => {
    let mounted = true;

    const safeCount = async (queryPromise: any) => {
      const { count, error } = await queryPromise;
      if (error) throw error;
      return typeof count === "number" ? count : 0;
    };

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: auth, error: authErr } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authErr || !user) {
        if (mounted) {
          setError("Not logged in");
          setLoading(false);
          setProfileLoading(false);
        }
        return;
      }

      // Profile (QR bar)
      try {
        const { data: p } = await supabase
          .from("profiles")
          .select("business_name, slug")
          .eq("id", user.id)
          .maybeSingle();

        if (mounted && p) {
          setProfile({
            business_name: (p as any).business_name ?? null,
            slug: (p as any).slug ?? null,
          });
        }
      } catch {
        // ignore profile errors
      } finally {
        if (mounted) setProfileLoading(false);
      }

      // Counts
      try {
        const [openEnq, newOpenEnq, est, book, inv] = await Promise.all([
          // ✅ OPEN enquiries (not replied)
          safeCount(
            supabase
              .from("quote_requests")
              .select("id", { head: true, count: "exact" })
              .eq("plumber_id", user.id)
              .not("status", "ilike", "%replied%")
          ),

          // ✅ NEW enquiries = unread + not replied
          safeCount(
            supabase
              .from("quote_requests")
              .select("id", { head: true, count: "exact" })
              .eq("plumber_id", user.id)
              .is("read_at", null)
              .not("status", "ilike", "%replied%")
          ),

          // Estimates
          safeCount(
            supabase
              .from("quotes")
              .select("id", { head: true, count: "exact" })
              .eq("plumber_id", user.id)
          ),

          // Bookings (your working version)
          safeCount(
            supabase
              .from("requests")
              .select("id", { head: true, count: "exact" })
              .eq("user_id", user.id)
              .or(
                "status.eq.booked,calendar_event_id.not.is.null,calendar_html_link.not.is.null"
              )
          ),

          // Invoices
          safeCount(
            supabase
              .from("invoices")
              .select("id", { head: true, count: "exact" })
              .eq("user_id", user.id)
          ),
        ]);

        if (!mounted) return;

        setOpenEnquiries(openEnq);
        setNewEnquiries(newOpenEnq);
        setEstimates(est);
        setBookings(book);
        setInvoices(inv);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load dashboard stats");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);
    return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#0B1C2D" }}>
          Dashboard
        </div>
        <div style={{ fontSize: 13, color: "#64748B" }}>
          Quick overview of what needs attention.
        </div>

        {error ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#991B1B" }}>
            {error}
          </div>
        ) : null}
      </div>

      <TopFrontDoorBar profile={profile} loading={profileLoading} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <SmallCard
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>New enquiries</span>

              {!loading && newEnquiries > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 18,
                    minWidth: 18,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "#DC2626",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  {newEnquiries}
                </span>
              )}
            </div>
          }
        >
          <Stat
            value={loading ? "—" : newEnquiries}
            sub={
              loading
                ? "Loading…"
                : newEnquiries === 0
                ? `Total open: ${openEnquiries} • All caught up 🎉`
                : `Total open: ${openEnquiries}`
            }
          />
        </SmallCard>

        <SmallCard title="Estimates">
          <Stat value={loading ? "—" : estimates} sub="Sent / active estimates" />
        </SmallCard>

        <SmallCard title="Bookings">
          <Stat value={loading ? "—" : bookings} sub="Upcoming / scheduled" />
        </SmallCard>

        <SmallCard title="Invoices">
          <Stat value={loading ? "—" : invoices} sub="Total created" />
        </SmallCard>

        {/* Bottom row (polished placeholders) */}
        <SmallCard title="Revenue this month" span={2}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0B1C2D" }}>
            —
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
            Based on invoices created this month (best effort).
          </div>
        </SmallCard>

        <SmallCard title="Last activity">
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0B1C2D" }}>
            —
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
            Latest request / estimate / booking / invoice activity.
          </div>
        </SmallCard>

        <SmallCard title="You last logged in">
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0B1C2D" }}>
            —
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
            From Supabase auth.
          </div>
        </SmallCard>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}