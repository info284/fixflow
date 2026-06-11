// app/components/home/HomePricing.tsx

const features = [
  "Enquiry inbox",
  "Customer messaging",
  "Estimates",
  "Job tracking",
  "Invoices & payments",
  "Verified reviews",
];

export default function HomePricing() {
  return (
    <section className="homeSection homeSectionAlt" id="pricing">
      <div className="homeContainer">
        <div className="homeSectionHeader">
          <span className="homeEyebrow">Pricing</span>
          <h2>Less than one<br />lost job a month.</h2>
          <p>Free during early access. After launch, £29/month — simple, no tiers, everything included.</p>
        </div>

        <div className="homePricingCard">
          <div className="homePricingBadge">Early access — free now</div>
          <div className="homePricingPrice"><sup>£</sup>0</div>
          <div className="homePricingPeriod">Free while FixFlow is in early access</div>
          <p className="homePricingDesc">After launch, plans start from £29/month. Everything included, no hidden tiers.</p>
          <hr className="homePricingDivider" />
          <ul className="homePricingFeatures">
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
<a className="homePrimaryBtn homePricingCta" href="/signup">
  Start free — no card needed
</a>
        </div>
      </div>
    </section>
  );
}
