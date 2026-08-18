// app/tools/page.tsx

import Link from "next/link";
import HomeNav from "@/app/components/home/HomeNav";
import HomeFooter from "@/app/components/home/HomeFooter";
import "../home.css";

export const metadata = {
  title: "Free Trade Business Calculators | FixFlow",
  description:
    "Free calculators for UK trade businesses. Work out your day rate, job profit and how much missed work could be costing your business.",
};

export default function ToolsPage() {
  return (
    <main className="homePage">
      <HomeNav />

      <section className="toolsHero">
        <div className="homeContainer toolsHeroInner">
          <span className="homeEyebrow">Free tools for the trades</span>

          <h1>
            Run the numbers.
            <br />
            Run a better business.
          </h1>

          <p>
            Simple calculators to help you price work properly, understand your
            profit and see where money could be slipping through the cracks.
          </p>
        </div>
      </section>

      <section className="toolsSection">
        <div className="homeContainer">
          <div className="toolsGrid">

            <Link
              href="/tools/day-rate-calculator"
              className="toolsCard"
            >
              <div>
                <span className="toolsCardNumber">01</span>

                <h2>Day Rate Calculator</h2>

                <p>
                  Work out what you actually need to charge per day based on
                  your income target, overheads and working days.
                </p>
              </div>

              <strong>Calculate your day rate →</strong>
            </Link>

            <Link
              href="/tools/job-profit-calculator"
              className="toolsCard"
            >
              <div>
                <span className="toolsCardNumber">02</span>

                <h2>Job Profit Calculator</h2>

                <p>
                  See what a job is really making after labour, materials and
                  other costs — not just what is left in the bank.
                </p>
              </div>

              <strong>Calculate job profit →</strong>
            </Link>

            <Link
              href="/tools/lost-work-calculator"
              className="toolsCard toolsCardFeatured"
            >
              <div>
                <span className="toolsCardNumber">03</span>

                <h2>Lost Work Calculator</h2>

                <p>
                  See how much missed enquiries, forgotten quotes and poor
                  follow-up could be costing your trade business every year.
                </p>
              </div>

              <strong>See what you could be losing →</strong>
            </Link>

          </div>
        </div>
      </section>

      <section className="toolsCTA">
        <div className="homeContainer toolsCTAInner">
          <span className="homeDarkEyebrow">Built for the trades</span>

          <h2>
            Knowing the numbers is one thing.
            <br />
            Staying on top of the work is another.
          </h2>

          <p>
            FixFlow helps keep your enquiries, quotes, customers and jobs
            moving so opportunities do not disappear into WhatsApp, emails,
            notes and your memory.
          </p>

          <Link href="/signup" className="homePrimaryBtn">
            Start free for 30 days
          </Link>
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}