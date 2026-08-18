"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import HomeNav from "@/app/components/home/HomeNav";
import HomeFooter from "@/app/components/home/HomeFooter";
import "../../home.css";

export default function DayRateCalculatorPage() {
  const [targetIncome, setTargetIncome] = useState(50000);
  const [annualOverheads, setAnnualOverheads] = useState(12000);
  const [workingWeeks, setWorkingWeeks] = useState(46);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [billablePercentage, setBillablePercentage] = useState(75);
  const [profitBuffer, setProfitBuffer] = useState(15);

  const results = useMemo(() => {
    const workingDays = workingWeeks * daysPerWeek;
    const billableDays = workingDays * (billablePercentage / 100);

    const baseRevenueNeeded = targetIncome + annualOverheads;
    const revenueNeeded =
      baseRevenueNeeded * (1 + profitBuffer / 100);

    const dayRate =
      billableDays > 0 ? revenueNeeded / billableDays : 0;

    const monthlyTarget = revenueNeeded / 12;

    return {
      workingDays,
      billableDays,
      revenueNeeded,
      dayRate,
      monthlyTarget,
    };
  }, [
    targetIncome,
    annualOverheads,
    workingWeeks,
    daysPerWeek,
    billablePercentage,
    profitBuffer,
  ]);

  const money = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <main>
      <HomeNav />

      <section className="calculatorHero">
        <div className="homeContainer calculatorHeroInner">
          <span className="homeEyebrow">
            FREE TRADE CALCULATOR
          </span>

          <h1>
            What should you actually charge per day?
          </h1>

          <p>
            Work backwards from what you want to earn, your business costs and
            the number of days you can realistically bill to calculate a
            sustainable day rate.
          </p>
        </div>
      </section>

      <section className="calculatorSection">
        <div className="homeContainer">
          <div className="calculatorLayout">
            <div className="calculatorCard">
              <span className="calculatorEyebrow">
                YOUR NUMBERS
              </span>

              <h2>Build your day rate.</h2>

              <div className="calculatorFields">
                <label className="calculatorField">
                  <span>Income you want to earn per year</span>

                  <div className="calculatorMoneyInput">
                    <span>£</span>

                    <input
                      type="number"
                      min="0"
                      value={targetIncome}
                      onChange={(e) =>
                        setTargetIncome(Number(e.target.value))
                      }
                    />
                  </div>

                  <small>
                    The annual income you want the business to generate for you
                    before personal tax.
                  </small>
                </label>

                <label className="calculatorField">
                  <span>Annual business overheads</span>

                  <div className="calculatorMoneyInput">
                    <span>£</span>

                    <input
                      type="number"
                      min="0"
                      value={annualOverheads}
                      onChange={(e) =>
                        setAnnualOverheads(Number(e.target.value))
                      }
                    />
                  </div>

                  <small>
                    Van, fuel, insurance, tools, software, accountant, phone
                    and other running costs.
                  </small>
                </label>

                <label className="calculatorField">
                  <span>Working weeks per year</span>

                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={workingWeeks}
                    onChange={(e) =>
                      setWorkingWeeks(
                        Math.min(
                          52,
                          Math.max(1, Number(e.target.value))
                        )
                      )
                    }
                  />

                  <small>
                    Remember to allow for holidays and time off.
                  </small>
                </label>

                <label className="calculatorField">
                  <span>Days you work per week</span>

                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={daysPerWeek}
                    onChange={(e) =>
                      setDaysPerWeek(
                        Math.min(
                          7,
                          Math.max(1, Number(e.target.value))
                        )
                      )
                    }
                  />
                </label>

                <label className="calculatorField">
                  <span>Billable days</span>

                  <div className="calculatorPercentInput">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={billablePercentage}
                      onChange={(e) =>
                        setBillablePercentage(
                          Math.min(
                            100,
                            Math.max(1, Number(e.target.value))
                          )
                        )
                      }
                    />

                    <span>%</span>
                  </div>

                  <small>
                    Not every working day can be charged to a customer. Allow
                    for quoting, admin, site visits, training and gaps between
                    jobs.
                  </small>
                </label>

                <label className="calculatorField">
                  <span>Profit / safety buffer</span>

                  <div className="calculatorPercentInput">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={profitBuffer}
                      onChange={(e) =>
                        setProfitBuffer(
                          Math.min(
                            100,
                            Math.max(0, Number(e.target.value))
                          )
                        )
                      }
                    />

                    <span>%</span>
                  </div>

                  <small>
                    Add room for growth, unexpected costs and profit rather than
                    pricing only to break even.
                  </small>
                </label>
              </div>
            </div>

            <div className="calculatorResultCard">
              <span className="calculatorResultEyebrow">
                YOUR REQUIRED DAY RATE
              </span>

              <div className="calculatorBigResult">
                {money(results.dayRate)}
              </div>

              <p className="calculatorResultLead">
                That&apos;s the estimated day rate needed to cover the numbers
                you&apos;ve entered.
              </p>

              <div className="calculatorResultStats">
                <div>
                  <span>Annual revenue needed</span>
                  <strong>
                    {money(results.revenueNeeded)}
                  </strong>
                </div>

                <div>
                  <span>Billable days per year</span>
                  <strong>
                    {Math.round(results.billableDays)}
                  </strong>
                </div>

                <div>
                  <span>Monthly revenue target</span>
                  <strong>
                    {money(results.monthlyTarget)}
                  </strong>
                </div>
              </div>

              <div className="calculatorResultMessage">
                <strong>
                  Your day rate has to pay for the days you can&apos;t invoice too.
                </strong>

                <p>
                  Quotes, admin, site visits, holidays and running the business
                  still cost money — even when you&apos;re not charging a customer.
                </p>
              </div>

              <Link
                href="/signup"
                className="comparePrimaryButton calculatorCTA"
              >
                Run a stronger business with FixFlow
              </Link>

              <div className="calculatorTrialNote">
                Start free for 30 days · Then £29/month
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="calculatorExplanation">
        <div className="homeContainer calculatorExplanationInner">
          <span className="homeEyebrow">
            HOW IT WORKS
          </span>

          <h2>Busy doesn&apos;t always mean profitable.</h2>

          <p>
            The calculator starts with the income you want to earn and adds
            your annual business overheads and your chosen profit buffer.
          </p>

          <p>
            It then works out how many days you can realistically bill each
            year and divides the revenue you need by those billable days.
          </p>

          <p>
            This gives you an estimated minimum day rate based on the numbers
            you enter. It does not include personal tax, VAT or every possible
            business cost, so use it as a planning tool rather than financial
            advice.
          </p>
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}