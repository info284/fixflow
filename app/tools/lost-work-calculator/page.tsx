"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import HomeNav from "@/app/components/home/HomeNav";
import HomeFooter from "@/app/components/home/HomeFooter";
import "../../home.css";

export default function LostWorkCalculatorPage() {
  const [enquiriesPerMonth, setEnquiriesPerMonth] = useState(20);
  const [averageJobValue, setAverageJobValue] = useState(850);
  const [missedPercentage, setMissedPercentage] = useState(20);

  const results = useMemo(() => {
    const monthlyEnquiryValue = enquiriesPerMonth * averageJobValue;

    const monthlyLostValue =
      monthlyEnquiryValue * (missedPercentage / 100);

    const yearlyLostValue = monthlyLostValue * 12;

    return {
      monthlyEnquiryValue,
      monthlyLostValue,
      yearlyLostValue,
    };
  }, [enquiriesPerMonth, averageJobValue, missedPercentage]);

  const money = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <main className="homePage">
      <HomeNav />

      <section className="calculatorHero">
        <div className="homeContainer calculatorHeroInner">
          <span className="homeEyebrow">Free trade calculator</span>

          <h1>
            How much work could
            <br />
            you be losing?
          </h1>

          <p>
            Missed enquiries, forgotten quotes and poor follow-up can quietly
            cost a trade business thousands. Put in your numbers and see what
            that could look like over a year.
          </p>
        </div>
      </section>

      <section className="calculatorSection">
        <div className="homeContainer calculatorLayout">
          <div className="calculatorCard">
            <span className="calculatorEyebrow">Your numbers</span>

            <h2>Tell us how work comes into your business.</h2>

            <div className="calculatorFields">
              <label className="calculatorField">
                <span>Enquiries per month</span>

                <input
                  type="number"
                  min="0"
                  value={enquiriesPerMonth}
                  onChange={(e) =>
                    setEnquiriesPerMonth(Number(e.target.value))
                  }
                />

                <small>
                  Roughly how many new enquiries do you receive each month?
                </small>
              </label>

              <label className="calculatorField">
                <span>Average job value</span>

                <div className="calculatorMoneyInput">
                  <span>£</span>

                  <input
                    type="number"
                    min="0"
                    value={averageJobValue}
                    onChange={(e) =>
                      setAverageJobValue(Number(e.target.value))
                    }
                  />
                </div>

                <small>
                  Use the average value of a typical job you quote for.
                </small>
              </label>

              <label className="calculatorField">
                <span>Work you think slips through the cracks</span>

                <div className="calculatorPercentInput">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={missedPercentage}
                    onChange={(e) =>
                      setMissedPercentage(
                        Math.min(100, Math.max(0, Number(e.target.value)))
                      )
                    }
                  />

                  <span>%</span>
                </div>

                <small>
                  Think missed calls, forgotten quotes, slow replies and jobs
                  that never got followed up.
                </small>
              </label>
            </div>
          </div>

          <div className="calculatorResultCard">
            <span className="calculatorResultEyebrow">
              Your potential lost work
            </span>

            <div className="calculatorBigResult">
              {money(results.yearlyLostValue)}
            </div>

            <p className="calculatorResultLead">
              That&apos;s the estimated value of work that could be slipping
              through the cracks every year.
            </p>

            <div className="calculatorResultStats">
              <div>
                <span>Monthly enquiry value</span>
                <strong>{money(results.monthlyEnquiryValue)}</strong>
              </div>

              <div>
                <span>Potentially lost each month</span>
                <strong>{money(results.monthlyLostValue)}</strong>
              </div>
            </div>

            <div className="calculatorResultMessage">
              <strong>Most trade businesses don&apos;t need more leads.</strong>

              <p>
                They need a better way to stay on top of the enquiries and
                opportunities already coming in.
              </p>
            </div>

            <Link href="/signup" className="homePrimaryBtn calculatorCTA">
              Stop losing work with FixFlow
            </Link>

            <p className="calculatorTrialNote">
              Start free for 30 days · Then £29/month
            </p>
          </div>
        </div>
      </section>

      <section className="calculatorExplanation">
        <div className="homeContainer">
          <div className="calculatorExplanationInner">
            <span className="homeEyebrow">How it works</span>

            <h2>This is an estimate, not a promise.</h2>

            <p>
              The calculator multiplies your monthly enquiries by your average
              job value, then applies the percentage of work you believe may be
              lost through missed enquiries, forgotten quotes or poor
              follow-up.
            </p>

            <p>
              Every trade business is different, so use the result as a way to
              understand the potential size of the problem rather than an exact
              prediction of lost revenue.
            </p>
          </div>
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}