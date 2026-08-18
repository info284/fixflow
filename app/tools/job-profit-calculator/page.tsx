"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import HomeNav from "@/app/components/home/HomeNav";
import HomeFooter from "@/app/components/home/HomeFooter";
import "../../home.css";

export default function JobProfitCalculatorPage() {
  const [jobValue, setJobValue] = useState(2500);
  const [materials, setMaterials] = useState(800);
  const [labour, setLabour] = useState(600);
  const [otherCosts, setOtherCosts] = useState(100);

  const [vatRegistered, setVatRegistered] = useState(false);
  const [figuresIncludeVat, setFiguresIncludeVat] = useState(true);

  const results = useMemo(() => {
    const removeVat = (value: number) => {
      if (!vatRegistered || !figuresIncludeVat) return value;
      return value / 1.2;
    };

    const netJobValue = removeVat(jobValue);
    const netMaterials = removeVat(materials);
    const netOtherCosts = removeVat(otherCosts);

    // Labour is left unchanged because wages / your own labour
    // do not automatically carry VAT.
    const adjustedLabour = labour;

    const totalCosts =
      netMaterials + adjustedLabour + netOtherCosts;

    const profit = netJobValue - totalCosts;

    const margin =
      netJobValue > 0 ? (profit / netJobValue) * 100 : 0;

    const vatRemovedFromSale =
      vatRegistered && figuresIncludeVat
        ? jobValue - netJobValue
        : 0;

    return {
      netJobValue,
      totalCosts,
      profit,
      margin,
      vatRemovedFromSale,
    };
  }, [
    jobValue,
    materials,
    labour,
    otherCosts,
    vatRegistered,
    figuresIncludeVat,
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
            How much did you actually make on that job?
          </h1>

          <p>
            Enter what you charged and what the job cost you to see
            your estimated profit and profit margin — with optional
            standard-rate VAT adjustment.
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

              <h2>Break down the job.</h2>

              <div className="calculatorFields">
                <div className="calculatorField">
                  <span>Are you VAT registered?</span>

                  <div className="calculatorToggleGroup">
                    <button
                      type="button"
                      className={
                        !vatRegistered
                          ? "calculatorToggleActive"
                          : ""
                      }
                      onClick={() => setVatRegistered(false)}
                    >
                      No
                    </button>

                    <button
                      type="button"
                      className={
                        vatRegistered
                          ? "calculatorToggleActive"
                          : ""
                      }
                      onClick={() => setVatRegistered(true)}
                    >
                      Yes
                    </button>
                  </div>

                  <small>
                    We&apos;ll use the standard 20% VAT rate for this
                    estimate.
                  </small>
                </div>

                {vatRegistered && (
                  <div className="calculatorField">
                    <span>
                      Do the amounts you&apos;re entering include VAT?
                    </span>

                    <div className="calculatorToggleGroup">
                      <button
                        type="button"
                        className={
                          !figuresIncludeVat
                            ? "calculatorToggleActive"
                            : ""
                        }
                        onClick={() =>
                          setFiguresIncludeVat(false)
                        }
                      >
                        No
                      </button>

                      <button
                        type="button"
                        className={
                          figuresIncludeVat
                            ? "calculatorToggleActive"
                            : ""
                        }
                        onClick={() =>
                          setFiguresIncludeVat(true)
                        }
                      >
                        Yes
                      </button>
                    </div>

                    <small>
                      Choose Yes if the customer price and VAT-bearing
                      job costs are entered gross.
                    </small>
                  </div>
                )}

                <label className="calculatorField">
                  <span>What you charged</span>

                  <div className="calculatorMoneyInput">
                    <span>£</span>

                    <input
                      type="number"
                      value={jobValue}
                      min="0"
                      onChange={(e) =>
                        setJobValue(Number(e.target.value))
                      }
                    />
                  </div>

                  <small>
                    The total amount you charged the customer.
                  </small>
                </label>

                <label className="calculatorField">
                  <span>Materials</span>

                  <div className="calculatorMoneyInput">
                    <span>£</span>

                    <input
                      type="number"
                      value={materials}
                      min="0"
                      onChange={(e) =>
                        setMaterials(Number(e.target.value))
                      }
                    />
                  </div>

                  <small>
                    Enter the cost of materials used on the job.
                  </small>
                </label>

                <label className="calculatorField">
                  <span>Labour</span>

                  <div className="calculatorMoneyInput">
                    <span>£</span>

                    <input
                      type="number"
                      value={labour}
                      min="0"
                      onChange={(e) =>
                        setLabour(Number(e.target.value))
                      }
                    />
                  </div>

                  <small>
                    Include your own labour cost as well as anyone
                    working with you.
                  </small>
                </label>

                <label className="calculatorField">
                  <span>Other costs</span>

                  <div className="calculatorMoneyInput">
                    <span>£</span>

                    <input
                      type="number"
                      value={otherCosts}
                      min="0"
                      onChange={(e) =>
                        setOtherCosts(Number(e.target.value))
                      }
                    />
                  </div>

                  <small>
                    Parking, waste, subcontractors or other
                    job-specific costs.
                  </small>
                </label>
              </div>
            </div>

            <div className="calculatorResultCard">
              <span className="calculatorResultEyebrow">
                YOUR ESTIMATED JOB PROFIT
              </span>

              <div className="calculatorBigResult">
                {money(results.profit)}
              </div>

              <p className="calculatorResultLead">
                Estimated profit after the costs you&apos;ve entered
                {vatRegistered && figuresIncludeVat
                  ? " and standard-rate VAT adjustment."
                  : "."}
              </p>

              <div className="calculatorResultStats">
                <div>
                  <span>Revenue used</span>
                  <strong>{money(results.netJobValue)}</strong>
                </div>

                <div>
                  <span>Total job costs</span>
                  <strong>{money(results.totalCosts)}</strong>
                </div>

                <div>
                  <span>Profit margin</span>
                  <strong>{results.margin.toFixed(1)}%</strong>
                </div>

                {vatRegistered && figuresIncludeVat && (
                  <div>
                    <span>VAT removed from sale</span>
                    <strong>
                      {money(results.vatRemovedFromSale)}
                    </strong>
                  </div>
                )}
              </div>

              <div className="calculatorResultMessage">
                <strong>
                  Winning the job is only half of it.
                </strong>

                <p>
                  Knowing your numbers helps you price better,
                  protect your margin and build a stronger trade
                  business.
                </p>
              </div>

              <Link
                href="/signup"
                className="comparePrimaryButton calculatorCTA"
              >
                Run your business with FixFlow
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
          <span className="homeEyebrow">HOW IT WORKS</span>

          <h2>Revenue isn&apos;t profit.</h2>

          <p>
            The calculator takes the revenue from the job and
            subtracts the materials, labour and other costs you enter.
          </p>

          <p>
            If you tell us that you&apos;re VAT registered and that
            your figures include VAT, it removes standard-rate VAT
            from the customer charge and VAT-bearing costs before
            calculating estimated profit.
          </p>

          <p>
            Labour is not automatically reduced for VAT because wages
            and your own labour do not simply include recoverable VAT
            in the same way as a standard-rated supplier invoice.
          </p>

          <p>
            This calculator is an estimate, not accounting, tax or
            financial advice. It assumes standard 20% VAT and does not
            account for reduced or zero-rated work, exempt supplies,
            partial exemption, the VAT Flat Rate Scheme or costs where
            VAT cannot be reclaimed.
          </p>
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}