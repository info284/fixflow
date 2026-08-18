import Link from "next/link";

export default function HomeTools() {
  return (
    <section className="homeTools">
      <div className="homeContainer">
        <div className="homeSectionHeader">
          <span className="homeEyebrow">Free tools for the trades</span>

          <h2>Know your numbers. Run a stronger business.</h2>

          <p>
            Free calculators to help you understand what to charge, what you
            actually make and where money could be slipping through the cracks.
          </p>
        </div>

        <div className="homeToolsGrid">
          <Link
            href="/tools/lost-work-calculator"
            className="homeToolsCard"
          >
            <span>01</span>
            <h3>Lost Work Calculator</h3>
            <p>
              See how much missed enquiries, forgotten quotes and poor
              follow-up could be costing you.
            </p>
            <strong>Calculate lost work →</strong>
          </Link>

          <Link
            href="/tools/job-profit-calculator"
            className="homeToolsCard"
          >
            <span>02</span>
            <h3>Job Profit Calculator</h3>
            <p>
              Work out what you actually made after materials, labour and
              other job costs.
            </p>
            <strong>Calculate job profit →</strong>
          </Link>

          <Link
            href="/tools/day-rate-calculator"
            className="homeToolsCard"
          >
            <span>03</span>
            <h3>Day Rate Calculator</h3>
            <p>
              Work out the day rate you need to cover your income target,
              overheads and non-billable time.
            </p>
            <strong>Calculate your day rate →</strong>
          </Link>
        </div>

        <div className="homeToolsMore">
          <Link href="/tools">
            View all free tools →
          </Link>
        </div>
      </div>
    </section>
  );
}