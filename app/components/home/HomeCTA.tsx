// app/components/home/HomeCTA.tsx

export default function HomeCTA() {
  return (
    <section className="homeCTA">
      <div className="homeCTAInner">
        <h2>Stop giving customers a reason to go elsewhere.</h2>

        <p>
          FixFlow keeps every enquiry, job and invoice organised — so busy
          trades look professional and win more of the work they&apos;ve already
          earned.
        </p>

        <div className="homeCTAActions">
          <a className="homePrimaryBtn" href="/signup">
            Start free today
          </a>

          <a className="homeGhostBtn" href="#why">
            See how it works
          </a>
        </div>

<div className="homeCTANote">
  60-day free trial · Less than the cost of one lost job · Cancel anytime
</div>
      </div>
    </section>
  );
}