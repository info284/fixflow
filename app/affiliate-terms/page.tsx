// app/affiliate-terms/page.tsx

import Link from "next/link";
import "../legal.css";

export const metadata = {
  title: "Affiliate Terms | FixFlow",
  description:
    "The terms that apply to affiliates and referral partners taking part in the FixFlow referral program.",
};

export default function AffiliateTermsPage() {
  return (
    <div className="legalPage">
      <nav className="legalNav">
        <div className="legalNavInner">
          <Link href="/" className="legalNavLogo">
            Fix<span>Flow</span>
          </Link>

          <Link href="/signup" className="legalNavCta">
            Start free
          </Link>
        </div>
      </nav>

      <main className="legalMain">
        <div className="legalContainer">
          <div className="legalHero">
            <div className="legalEyebrow">Legal</div>
            <h1>Affiliate Terms</h1>
            <p>Last updated: July 2026</p>
          </div>

          <div className="legalBody">
            <section className="legalSection">
              <h2>1. About these terms</h2>

              <p>
                These Affiliate Terms govern your participation in the FixFlow
                referral and affiliate program (the &quot;Program&quot;). They
                apply in addition to, and should be read alongside, our{" "}
                <Link href="/terms">Terms of Service</Link>. Where these
                Affiliate Terms conflict with the Terms of Service on a matter
                specific to the Program, these Affiliate Terms apply.
              </p>

              <p>
                By requesting a referral link or discount code, sharing it
                with a prospective customer, or accepting a payout under the
                Program, you confirm that you have read, understood and agree
                to be bound by these Affiliate Terms.
              </p>

              <p>
                The Program is operated by FixFlow Software Ltd
                (&quot;FixFlow&quot;, &quot;we&quot;, &quot;us&quot; or
                &quot;our&quot;).
              </p>
            </section>

            <section className="legalSection">
              <h2>2. Eligibility</h2>

              <p>To take part in the Program, you must:</p>

              <ul>
                <li>Be at least 18 years old</li>
                <li>
                  Have a genuine connection to the trades industry, FixFlow&apos;s
                  customer base, or a relevant audience (for example, a
                  merchant, showroom, publication, or existing FixFlow user)
                </li>
                <li>
                  Provide accurate details for tracking referrals and paying
                  out any amounts owed
                </li>
                <li>
                  Comply with these Affiliate Terms and our Terms of Service
                </li>
              </ul>

              <p>
                We may approve, decline or remove any person or business from
                the Program at our discretion, including where we reasonably
                believe participation is not in keeping with the intent of the
                Program.
              </p>
            </section>

            <section className="legalSection">
              <h2>3. Your referral link or code</h2>

              <p>
                On approval, we will provide you with a unique referral link
                or discount code (a &quot;Referral Code&quot;). You may share
                your Referral Code with prospective FixFlow customers through
                appropriate channels, such as direct conversations,
                newsletters, social media, or your own website.
              </p>

              <p>You must not:</p>

              <ul>
                <li>
                  Use paid search advertising on FixFlow&apos;s brand terms or
                  close variations of them
                </li>
                <li>
                  Use spam, unsolicited bulk messaging, or misleading
                  advertising to promote your Referral Code
                </li>
                <li>
                  Apply your own Referral Code to your own account or
                  otherwise refer yourself
                </li>
                <li>
                  Make false, misleading, or unauthorised claims about FixFlow,
                  its pricing, or its features when promoting your Referral
                  Code
                </li>
                <li>
                  Impersonate FixFlow or suggest you are an employee or
                  official representative of FixFlow unless this is the case
                </li>
              </ul>
            </section>

            <section className="legalSection">
              <h2>4. Tracking and attribution</h2>

              <p>
                Referrals are tracked using your Referral Code, including any{" "}
                <code>?ref=</code> link parameter and associated Stripe promo
                code, at the time a prospective customer signs up or begins a
                subscription.
              </p>

              <p>
                A referral will only be attributed to you where our tracking
                systems record your Referral Code as having been used at
                sign-up. We are not responsible for a referral that is not
                tracked correctly due to browser settings, ad blockers, link
                sharing outside the Referral Code, or similar technical
                limitations.
              </p>

              <p>
                Where our tracking data conflicts with any other record, our
                tracking data will be treated as accurate for the purposes of
                calculating payouts, unless we agree otherwise.
              </p>
            </section>

            <section className="legalSection">
              <h2>5. Payouts</h2>

              <p>
                Where a referral results in a new customer taking out a paid
                FixFlow subscription, you may be eligible for a payout at the
                rate and structure described to you when you joined the
                Program, or as subsequently communicated to you.
              </p>

              <p>
                Payouts are only earned once the referred customer has
                remained an active, paying subscriber for the qualifying
                period stated to you at the time of the referral (currently 30
                days). No payout is earned or payable before this qualifying
                period has been met.
              </p>

              <p>
                We will pay eligible amounts using the payment method and
                schedule communicated to you when you joined the Program. You
                are responsible for providing accurate payment details and for
                any tax obligations arising from amounts you receive under the
                Program.
              </p>
            </section>

            <section className="legalSection">
              <h2>6. Withholding, adjustment and clawback</h2>

              <p>We may withhold, adjust, reverse or reclaim a payout where:</p>

              <ul>
                <li>
                  The referred customer cancels, refunds, or does not remain
                  subscribed for the required qualifying period
                </li>
                <li>
                  The referral was generated through self-referral, fraud,
                  fake accounts, or a breach of these Affiliate Terms
                </li>
                <li>
                  The referral does not meet the eligibility or attribution
                  requirements set out in these terms
                </li>
                <li>
                  A payout was made in error, including as a result of a
                  technical or administrative mistake
                </li>
              </ul>

              <p>
                Where an amount has already been paid and is later found not
                to be owed under this section, we may deduct it from a future
                payout or request repayment directly.
              </p>
            </section>

            <section className="legalSection">
              <h2>7. Changes, suspension and termination</h2>

              <p>
                We may change the structure, rates, qualifying period or
                availability of the Program at any time. Changes will apply to
                referrals made after the change takes effect, unless we say
                otherwise.
              </p>

              <p>
                We may suspend or end your participation in the Program at any
                time, including where we reasonably suspect fraud,
                self-referral, misuse of your Referral Code, or a breach of
                these Affiliate Terms or our Terms of Service. Where
                practical, we will tell you why.
              </p>

              <p>
                We may discontinue the Program entirely. Any payout properly
                earned before discontinuation, and for which the qualifying
                period has been met, will still be paid.
              </p>

              <p>
                You may stop taking part in the Program at any time by
                contacting us. This does not entitle you to a payout for
                referrals that have not yet met the qualifying period at the
                point you stop.
              </p>
            </section>

            <section className="legalSection">
              <h2>8. No employment or partnership</h2>

              <p>
                Taking part in the Program does not make you an employee,
                agent, partner, or joint venturer of FixFlow. You act
                independently and are responsible for how you promote your
                Referral Code, subject to these Affiliate Terms.
              </p>
            </section>

            <section className="legalSection">
              <h2>9. Liability</h2>

              <p>
                To the fullest extent permitted by law, our total liability to
                you arising out of or relating to the Program will not exceed
                the total payouts properly earned and owed to you under these
                terms in the 12 months before the event giving rise to the
                claim.
              </p>

              <p>
                Nothing in these terms excludes or limits liability where doing
                so would be unlawful, including liability for death or
                personal injury caused by negligence, or for fraud.
              </p>
            </section>

            <section className="legalSection">
              <h2>10. Changes to these terms</h2>

              <p>
                We may update these Affiliate Terms from time to time. Where a
                change materially affects payout rates or qualifying
                conditions, we will provide reasonable notice before it applies
                to new referrals.
              </p>
            </section>

            <section className="legalSection">
              <h2>11. Governing law</h2>

              <p>
                These Affiliate Terms are governed by the laws of England and
                Wales, and any dispute is subject to the exclusive
                jurisdiction of the courts of England and Wales.
              </p>
            </section>

<section className="legalSection">
  <h2>12. Contact us</h2>

  <p>
    Questions about the Program or these Affiliate Terms can be
    sent to:
  </p>

  <p>
    <strong>Email:</strong>{" "}
    <a href="mailto:hello@thefixflowapp.com">
      hello@thefixflowapp.com
    </a>
    <br />
    <strong>Company:</strong> FixFlow Software Ltd
    <br />
    <strong>Company number:</strong> 17288791
    <br />
    <strong>Registered office:</strong> 71–75 Shelton Street, Covent
    Garden, London, WC2H 9JQ
  </p>
</section>
          </div>
        </div>
      </main>

      <footer className="legalFooter">
        <div className="legalFooterInner">
          <div className="legalFooterLogo">FixFlow</div>

          <div className="legalFooterLinks">
            <Link href="/">Home</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/affiliate-terms">Affiliate Terms</Link>
          </div>

<div className="legalFooterCopy">
  © 2026 FixFlow Software Ltd · Company number 17288791 · Registered
  office: 71–75 Shelton Street, Covent Garden, London, WC2H 9JQ
</div>
        </div>
      </footer>
    </div>
  );
}
