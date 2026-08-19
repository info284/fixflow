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
      <h2>
        Stop losing jobs.
        <br />
        Keep more of the work you already have.
      </h2>

      <p>
        Start with a 30-day free trial. Then just £29/month.
        No contracts. No complicated tiers. Everything included.
      </p>
    </div>

    <div className="homePricingCard">
      <div className="homePricingBadge">
        30-day free trial
      </div>

      <div className="homePricingPrice">
        <sup>£</sup>29
      </div>

      <div className="homePricingPeriod">
        Per month after your free trial
      </div>

      <p className="homePricingDesc">
        One forgotten quote can cost more than FixFlow for an entire year.
        Keep enquiries organised, follow up faster and look professional from first message to final invoice.
      </p>

      <hr className="homePricingDivider" />

      <ul className="homePricingFeatures">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <a
        className="homePrimaryBtn homePricingCta"
        href="/signup"
      >
        Start your free trial
      </a>

      <div className="homePricingNote">
        No contracts • Cancel anytime • All features included
      </div>
    </div>
  </div>
</section>
  );
}
