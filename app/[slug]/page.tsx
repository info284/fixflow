import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("slug", slug)
    .maybeSingle();

  const businessName =
    profile?.display_name || "Local trader";

  return {
    title: `${businessName} | Local trader profile | FixFlow`,
    description:
      `View services, coverage areas and customer reviews for ${businessName} on FixFlow.`,
  };
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

function supabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function money(n: number | null) {
  if (n === null || typeof n === "undefined") return "Guide price on request";
  return `£${Number(n).toFixed(2)}`;
}

function guidePrice(from: number | null, to: number | null) {
  if (from === null && to === null) return "Guide price on request";
  if (from !== null && to !== null) return `${money(from)} – ${money(to)}`;
  if (from !== null) return `From ${money(from)}`;
  return `Up to ${money(to)}`;
}

export default async function PublicTraderPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = supabasePublic();

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id,
      slug,
      display_name,
      headline,
      logo_url,
      profile_photo_url,
      business_phone,
      notify_email,
      business_description,
      years_in_business,
      insurance_cover,
      after_job_guarantee
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (!profile) notFound();

  const traderId = profile.id;

  const [{ data: services }, { data: locations }, { data: certificates }, { data: reviews }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name, price_from, price_to")
        .eq("user_id", traderId)
        .order("created_at", { ascending: false }),

      supabase
        .from("trade_locations")
        .select("id, postcode_prefix, label")
        .eq("user_id", traderId)
        .order("postcode_prefix", { ascending: true }),

      supabase
        .from("trader_certificates")
        .select("id, name, certificate_number, expiry_date")
        .eq("trader_id", traderId)
        .order("expiry_date", { ascending: true }),

supabase
  .from("reviews")
  .select("id, rating, comment, reviewer_name, customer_name, created_at, verified")
  .eq("tradesperson_id", traderId)
  .eq("status", "published")
  .order("created_at", { ascending: false }),
    ]);

  const reviewCount = reviews?.length || 0;
  const reviewAverage =
    reviewCount > 0
      ? reviews!.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewCount
      : 0;

  const quoteLink = `/p/${profile.slug}/quote`;

  return (
    <main className="pubPage">
<section className="pubHero">
  <div className="pubHeroBrand">
    {profile.logo_url ? (
      <img
        src={profile.logo_url}
        alt={`${profile.display_name || "Business"} logo`}
        className="pubBrandLogo"
      />
    ) : (
      <div className="pubBrandFallback">FixFlow</div>
    )}

    <div className="pubBadge">Public profile preview</div>
  </div>

        <div className="pubTop">
          <div className="pubAvatar">
            {profile.profile_photo_url || profile.logo_url ? (
              <img
                src={profile.profile_photo_url || profile.logo_url}
                alt={profile.display_name || "Trader"}
              />
            ) : (
              <span>{(profile.display_name || "F").charAt(0)}</span>
            )}
          </div>
          </div>

<div className="pubInfo">
  <h1>{profile.display_name || "Local trader"}</h1>
  <p>{profile.headline || "Trusted local trade business powered by FixFlow."}</p>

  <div className="pubTrustRow">
    <div className="pubTrustBadge pubTrustBadgeGreen">
      ✓ Verified business
    </div>

    <div className="pubTrustBadge">
      ⚡ Fast response
    </div>

    <div className="pubTrustBadge pubTrustBadgeBlue">
      💳 Card payments accepted
    </div>
  </div>

  <div className="pubResponseCard">
    <div className="pubResponseLeft">
      <div className="pubResponseLabel">Response performance</div>

      <div className="pubResponseTitle">
        Usually responds quickly to new enquiries
      </div>

      <div className="pubResponseText">
        Customers can request quotes directly through FixFlow.
      </div>
    </div>

    <div className="pubResponseScore">98%</div>
  </div>

  <div className="pubMiniHighlights">
    {profile.years_in_business ? (
      <div className="pubMiniHighlight">
        <strong>{profile.years_in_business}+</strong>
        <span>Years experience</span>
      </div>
    ) : null}

    <div className="pubMiniHighlight">
      <strong>{services?.length || 0}</strong>
      <span>Services offered</span>
    </div>

    <div className="pubMiniHighlight">
      <strong>{locations?.length || 0}</strong>
      <span>Areas covered</span>
    </div>

    <div className="pubMiniHighlight">
      <strong>{reviewCount}</strong>
      <span>Customer reviews</span>
    </div>
  </div>

  <div className="pubStats">
    <span>⭐ {reviewAverage ? reviewAverage.toFixed(1) : "New"}</span>
    <span>{reviewCount} review{reviewCount === 1 ? "" : "s"}</span>
    <span>{locations?.length || 0} areas</span>
  </div>
</div>

        <div className="pubActions">
          <Link href={quoteLink} className="pubBtnPrimary">
            Request a quote
          </Link>

          {profile.business_phone ? (
            <a href={`tel:${profile.business_phone}`} className="pubBtn">
              Call
            </a>
          ) : null}
        </div>

        <div className="pubSoon">
          Online booking and customer portal are coming soon. You can request a quote today.
        </div>
      </section>

      {profile.business_description ? (
        <section className="pubCard">
          <h2>About</h2>
          <p>{profile.business_description}</p>
        </section>
      ) : null}

      <section className="pubGrid">
        <div className="pubCard">
          <h2>Services</h2>

          {services && services.length > 0 ? (
            <div className="pubList">
              {services.slice(0, 8).map((s) => (
                <div key={s.id} className="pubItem">
                  <strong>{s.name}</strong>
                  <span>{guidePrice(s.price_from, s.price_to)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>Services coming soon.</p>
          )}
        </div>

        <div className="pubCard">
          <h2>Coverage areas</h2>

          {locations && locations.length > 0 ? (
            <div className="pubChips">
              {locations.map((l) => (
                <span key={l.id}>
                  {l.postcode_prefix} {l.label ? `· ${l.label}` : ""}
                </span>
              ))}
            </div>
          ) : (
            <p>Coverage areas coming soon.</p>
          )}
        </div>
      </section>
<section className="pubCard">
  <h2>Recent work</h2>

  <div className="pubGalleryEmpty">
    <div className="pubGalleryIcon">📸</div>
    <strong>Before & after photos coming soon</strong>
    <p>Completed job photos will appear here once this trader starts adding work examples.</p>
  </div>
</section>
      <section className="pubCard">
        <h2>Customer reviews</h2>

        {reviews && reviews.length > 0 ? (
          <div className="pubReviews">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="pubReview">
                <div className="pubReviewTop">
                  <strong>{r.reviewer_name || r.customer_name || "Customer"}</strong>
                  <span>{r.verified ? "Verified" : "Review"}</span>
                </div>

                <div className="pubStars">
                  {"★".repeat(Number(r.rating || 0))}
                  {"☆".repeat(5 - Number(r.rating || 0))}
                </div>

                {r.comment ? <p>“{r.comment}”</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p>Customer reviews will appear here once published through completed FixFlow jobs.</p>
        )}
      </section>

      <section className="pubCard">
        <h2>Trust</h2>

        <div className="pubChips">
          {profile.years_in_business ? (
            <span>{profile.years_in_business} years in business</span>
          ) : null}

          {profile.insurance_cover ? <span>{profile.insurance_cover}</span> : null}

          {profile.after_job_guarantee ? (
            <span>{profile.after_job_guarantee}</span>
          ) : null}

          {certificates?.map((c) => (
            <span key={c.id}>{c.name}</span>
          ))}
        </div>
      </section>

      <footer className="pubFooter">
        Verified profile powered by <strong>FixFlow</strong>
      </footer>

      <div className="pubStickyBar">
  <Link href={quoteLink} className="pubStickyPrimary">
    Request quote
  </Link>

  {profile.business_phone ? (
    <a
      href={`tel:${profile.business_phone}`}
      className="pubStickyCall"
    >
      Call
    </a>
  ) : null}
</div>

      <style>{`

.pubInfo{
  flex:1;
  min-width:0;
}

.pubMiniHighlights{
  margin-top:16px;
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:12px;
}

.pubMiniHighlight{
  padding:16px;
  border-radius:20px;
  border:1px solid #e6ecf5;
  background:#fff;
}

.pubMiniHighlight strong{
  display:block;
  font-size:24px;
  font-weight:950;
  color:#102a56;
  letter-spacing:-0.04em;
}

.pubMiniHighlight span{
  margin-top:4px;
  display:block;
  font-size:12px;
  color:#5c6b84;
  font-weight:800;
}

@media(max-width:760px){
  .pubMiniHighlights{
    grid-template-columns:repeat(2, minmax(0, 1fr));
    justify-content:center;
  }

  .pubMiniHighlight{
    width:100%;
    max-width:190px;
    margin:0 auto;
    text-align:left;
  }

  .pubStats{
    justify-content:center;
  }

  .pubActions{
    justify-content:center;
  }

  .pubTop{
    flex-direction:column;
    align-items:center;
    text-align:center;
  }
}

      .pubResponseCard{
  margin-top:16px;
  padding:18px;
  border-radius:22px;
  background:linear-gradient(180deg,#ffffff,#f8fbff);
  border:1px solid #e6ecf5;
  display:flex;
  justify-content:space-between;
  gap:16px;
  align-items:center;
}

.pubResponseLabel{
  font-size:11px;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:#5c6b84;
}

.pubResponseTitle{
  margin-top:6px;
  font-size:18px;
  font-weight:950;
  color:#102a56;
  letter-spacing:-0.03em;
}

.pubResponseText{
  margin-top:6px;
  font-size:13px;
  line-height:1.5;
  color:#5c6b84;
}

.pubResponseScore{
  width:74px;
  height:74px;
  border-radius:999px;
  background:#1f355c;
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:20px;
  font-weight:950;
  flex-shrink:0;
}

@media(max-width:760px){
  .pubResponseCard{
    align-items:flex-start;
  }

  .pubResponseScore{
    width:62px;
    height:62px;
    font-size:17px;
  }
}

      .pubGalleryEmpty{
  padding:24px;
  border-radius:22px;
  border:1px dashed #cfd9e8;
  background:#f8fbff;
  text-align:center;
}

.pubGalleryIcon{
  font-size:30px;
  margin-bottom:10px;
}

.pubGalleryEmpty strong{
  display:block;
  color:#102a56;
  font-size:16px;
  font-weight:950;
}

.pubGalleryEmpty p{
  max-width:460px;
  margin:8px auto 0;
}

.pubTrustRow{
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  gap:10px;
  margin-top:20px;
}

.pubTrustBadge{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:8px 12px;
  border-radius:999px;
  background:#f8fbff;
  border:1px solid #e6ecf5;
  color:#1f355c;
  font-size:12px;
  font-weight:900;
}

.pubTrustBadgeGreen{
  background:#ecfdf3;
  border-color:#bfe9cf;
  color:#116b3a;
}

.pubTrustBadgeBlue{
  background:#eef4ff;
  border-color:#cfe0ff;
  color:#245bff;
}

      .pubStickyBar{
  position:fixed;
  left:14px;
  right:14px;
  bottom:14px;
  z-index:100;
  display:none;
  gap:10px;
  padding:10px;
  border-radius:22px;
  background:rgba(255,255,255,0.92);
  backdrop-filter:blur(14px);
  border:1px solid #e6ecf5;
  box-shadow:0 14px 40px rgba(15,23,42,0.14);
}

.pubStickyPrimary,
.pubStickyCall{
  flex:1;
  height:54px;
  border-radius:16px;
  display:flex;
  align-items:center;
  justify-content:center;
  text-decoration:none;
  font-weight:900;
}

.pubStickyPrimary{
  background:#1f355c;
  color:#fff;
}

.pubStickyCall{
  background:#fff;
  color:#1f355c;
  border:1px solid #dbe4f0;
}

@media(max-width:760px){
  .pubStickyBar{
    display:flex;
  }

  .pubPage{
    padding-bottom:110px;
  }
}

.pubHeroBrand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.pubBrandLogo {
  max-width: 150px;
  max-height: 54px;
  object-fit: contain;
}

.pubBrandFallback {
  font-size: 13px;
  font-weight: 950;
  color: #1f355c;
  letter-spacing: -0.02em;
}

.pubHeroBrand .pubBadge {
  margin-bottom: 0;
}

        .pubPage {
          min-height: 100vh;
          background: #f5f8fc;
          padding: 28px;
          color: #0b1320;
        }

        .pubHero,
        .pubCard {
          max-width: 980px;
          margin: 0 auto 18px;
          background: white;
          border: 1px solid #e6ecf5;
          border-radius: 28px;
          padding: 26px;
          box-shadow: 0 18px 45px rgba(31, 53, 92, 0.06);
        }

        .pubHero {
          background: linear-gradient(180deg, #ffffff, #f8fbff);
        }

        .pubBadge {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #eef4ff;
          color: #1f355c;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .pubTop {
          display: flex;
          gap: 18px;
          align-items: center;
        }

        .pubAvatar {
          width: 86px;
          height: 86px;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid #e6ecf5;
          background: #f8fbff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .pubAvatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pubAvatar span {
          font-size: 34px;
          font-weight: 950;
          color: #1f355c;
        }

        h1 {
          font-size: clamp(34px, 5vw, 58px);
          line-height: 0.95;
          letter-spacing: -0.06em;
          margin: 0;
          color: #0b2a55;
        }

        h2 {
          margin: 0 0 14px;
          color: #0b2a55;
          letter-spacing: -0.03em;
        }

        p {
          color: #5c6b84;
          line-height: 1.6;
          margin: 8px 0 0;
        }

        .pubStats,
        .pubActions,
        .pubChips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .pubStats span,
        .pubChips span {
          padding: 8px 11px;
          border-radius: 999px;
          background: #f8fbff;
          border: 1px solid #e6ecf5;
          color: #1f355c;
          font-size: 13px;
          font-weight: 800;
        }

        .pubBtnPrimary,
        .pubBtn {
          text-decoration: none;
          border-radius: 999px;
          padding: 13px 18px;
          font-weight: 900;
        }

        .pubBtnPrimary {
          background: #1f355c;
          color: white;
        }

        .pubBtn {
          background: white;
          border: 1px solid #e6ecf5;
          color: #1f355c;
        }

        .pubSoon {
          margin-top: 18px;
          padding: 14px;
          border-radius: 18px;
          background: #fff7ed;
          border: 1px solid #ffd6a8;
          color: #9a4d00;
          font-size: 13px;
          font-weight: 850;
        }

        .pubGrid {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .pubGrid .pubCard {
          margin: 0 0 18px;
        }

        .pubList,
        .pubReviews {
          display: grid;
          gap: 12px;
        }

        .pubItem,
        .pubReview {
          padding: 14px;
          border-radius: 18px;
          border: 1px solid #e6ecf5;
          background: #fbfdff;
        }

        .pubItem {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .pubItem strong,
        .pubReview strong {
          color: #102a56;
        }

        .pubItem span {
          color: #5c6b84;
          font-weight: 800;
        }

        .pubReviewTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .pubReviewTop span {
          font-size: 11px;
          font-weight: 900;
          color: #116b3a;
          background: #ecfdf3;
          padding: 5px 9px;
          border-radius: 999px;
        }

        .pubStars {
          margin-top: 8px;
          color: #f5b301;
          letter-spacing: 1px;
        }

        .pubFooter {
          text-align: center;
          color: #5c6b84;
          font-size: 13px;
          padding: 24px;
        }

        @media (max-width: 760px) {
          .pubPage {
            padding: 14px;
          }

          .pubTop {
            align-items: flex-start;
          }

          .pubGrid {
            grid-template-columns: 1fr;
          }

          .pubItem {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}