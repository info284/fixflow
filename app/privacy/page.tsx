// app/privacy/page.tsx
import Link from "next/link";
import "../legal.css";


export const metadata = {
  title: "Privacy Policy | FixFlow",
  description: "How FixFlow collects, uses and protects your data. UK GDPR compliant.",
};

export default function PrivacyPage() {
  return (
    <div className="legalPage">
      <nav className="legalNav">
        <div className="legalNavInner">
          <Link href="/" className="legalNavLogo">Fix<span>Flow</span></Link>
          <Link href="/signup" className="legalNavCta">Start free</Link>
        </div>
      </nav>

      <main className="legalMain">
        <div className="legalContainer">

          <div className="legalHero">
            <div className="legalEyebrow">Legal</div>
            <h1>Privacy Policy</h1>
            <p>Last updated: June 2026</p>
          </div>

          <div className="legalBody">

            <section className="legalSection">
              <h2>Who we are</h2>
              <p>FixFlow is a job management platform built for UK tradespeople. It is operated by Anna Dowling, trading as FixFlow ("FixFlow", "we", "us", "our").</p>
              <p>If you have any questions about this policy or how we handle your data, contact us at: <a href="mailto:hello@thefixflowapp.com">hello@thefixflowapp.com</a></p>
            </section>

            <section className="legalSection">
              <h2>What this policy covers</h2>
              <p>This policy explains what personal data we collect, why we collect it, how we use it, and your rights under UK GDPR and the Data Protection Act 2018.</p>
              <p>It covers:</p>
              <ul>
                <li>Tradespeople who sign up and use FixFlow ("traders")</li>
                <li>End customers whose details are entered into FixFlow by traders</li>
                <li>Visitors to thefixflowapp.com</li>
              </ul>
            </section>

            <section className="legalSection">
              <h2>What data we collect</h2>

              <h3>If you sign up as a trader</h3>
              <ul>
                <li>Name and email address</li>
                <li>Business name and contact details</li>
                <li>Job, enquiry, estimate, invoice and customer records you create</li>
                <li>Stripe Connect account ID (used to process payouts — we never see your bank account or card details)</li>
                <li>Usage data (how you interact with the platform)</li>
                <li>Device and browser information</li>
              </ul>

              <h3>If you are a customer of a trader using FixFlow</h3>
              <ul>
                <li>Name, address, postcode and contact details entered by your trader</li>
                <li>Job details, notes and messages related to your job</li>
                <li>Review content if you submit a review</li>
              </ul>

              <h3>If you visit our website</h3>
              <ul>
                <li>IP address and browser information via standard server logs</li>
                <li>Cookie data (see Cookie section below)</li>
              </ul>
            </section>

            <section className="legalSection">
              <h2>Why we collect it and our legal basis</h2>
              <div className="legalTable">
                <div className="legalTableRow legalTableHeader">
                  <div>Purpose</div>
                  <div>Legal basis</div>
                </div>
                <div className="legalTableRow">
                  <div>Creating and managing your account</div>
                  <div>Contract</div>
                </div>
                <div className="legalTableRow">
                  <div>Processing payments and payouts via Stripe</div>
                  <div>Contract</div>
                </div>
                <div className="legalTableRow">
                  <div>Sending invoices, receipts and job communications</div>
                  <div>Contract</div>
                </div>
                <div className="legalTableRow">
                  <div>Improving and maintaining the platform</div>
                  <div>Legitimate interests</div>
                </div>
                <div className="legalTableRow">
                  <div>Sending product updates and news</div>
                  <div>Legitimate interests / Consent</div>
                </div>
                <div className="legalTableRow">
                  <div>Complying with legal obligations</div>
                  <div>Legal obligation</div>
                </div>
              </div>
              <div className="legalCallout">We do not sell your data. We do not use your data for advertising.</div>
            </section>

            <section className="legalSection">
              <h2>How we store your data</h2>
              <p>Your data is stored securely using <strong>Supabase</strong>, hosted in the <strong>European Union</strong>. All data is encrypted in transit (TLS) and at rest.</p>
              <p>Payment processing is handled entirely by <strong>Stripe</strong>. FixFlow never stores card numbers, bank account details or other sensitive payment credentials.</p>
            </section>

            <section className="legalSection">
              <h2>How long we keep your data</h2>
              <div className="legalTable">
                <div className="legalTableRow legalTableHeader">
                  <div>Data type</div>
                  <div>Retention period</div>
                </div>
                <div className="legalTableRow">
                  <div>Account data</div>
                  <div>Until you delete your account, plus 30 days</div>
                </div>
                <div className="legalTableRow">
                  <div>Invoice and financial records</div>
                  <div>7 years (UK legal requirement)</div>
                </div>
                <div className="legalTableRow">
                  <div>Usage logs</div>
                  <div>12 months</div>
                </div>
                <div className="legalTableRow">
                  <div>Deleted account data</div>
                  <div>Permanently deleted within 30 days of request</div>
                </div>
              </div>
            </section>

            <section className="legalSection">
              <h2>Who we share your data with</h2>
              <p>We only share data with third-party services that are essential to running FixFlow:</p>
              <ul>
                <li><strong>Supabase</strong> — database and authentication (EU-hosted)</li>
                <li><strong>Stripe</strong> — payment processing and payouts</li>
                <li><strong>Vercel</strong> — website and application hosting</li>
                <li><strong>Resend</strong> — transactional email delivery</li>
              </ul>
              <p>All third-party providers are contractually required to handle data securely and in compliance with applicable law. We do not share your data with any other third parties, advertisers or data brokers.</p>
            </section>

            <section className="legalSection">
              <h2>Cookies</h2>
              <p>We use a small number of cookies to keep FixFlow working:</p>
              <div className="legalTable">
                <div className="legalTableRow legalTableHeader">
                  <div>Cookie</div>
                  <div>Purpose</div>
                  <div>Type</div>
                </div>
                <div className="legalTableRow">
                  <div>Session cookie</div>
                  <div>Keeps you logged in</div>
                  <div>Essential</div>
                </div>
                <div className="legalTableRow">
                  <div>Auth token</div>
                  <div>Secure authentication</div>
                  <div>Essential</div>
                </div>
              </div>
              <p>We do not use advertising cookies or third-party tracking cookies.</p>
            </section>

            <section className="legalSection">
              <h2>Your rights under UK GDPR</h2>
              <p>You have the right to:</p>
              <ul>
                <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
                <li><strong>Rectification</strong> — ask us to correct inaccurate data</li>
                <li><strong>Erasure</strong> — ask us to delete your data ("right to be forgotten")</li>
                <li><strong>Restriction</strong> — ask us to limit how we use your data</li>
                <li><strong>Portability</strong> — receive your data in a portable format</li>
                <li><strong>Objection</strong> — object to us processing your data on the basis of legitimate interests</li>
              </ul>
              <p>To exercise any of these rights, email us at <a href="mailto:hello@thefixflowapp.com">hello@thefixflowapp.com</a>. We will respond within 30 days.</p>
              <p>If you are unhappy with how we handle your data, you have the right to complain to the <strong>Information Commissioner's Office (ICO)</strong> at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.</p>
            </section>

            <section className="legalSection">
              <h2>Data entered by traders about their customers</h2>
              <p>Traders using FixFlow act as the <strong>data controller</strong> for any personal data they enter about their own customers. FixFlow acts as a <strong>data processor</strong> in this context.</p>
              <p>Traders are responsible for ensuring they have a lawful basis to store their customers' information in FixFlow, and for responding to any data requests from their customers.</p>
            </section>

            <section className="legalSection">
              <h2>Children</h2>
              <p>FixFlow is not intended for use by anyone under the age of 18. We do not knowingly collect data from children.</p>
            </section>

            <section className="legalSection">
              <h2>Changes to this policy</h2>
              <p>We may update this policy from time to time. We will notify active users of any material changes by email. The date at the top of this page shows when it was last updated.</p>
            </section>

            <section className="legalSection">
              <h2>Contact</h2>
              <p>For any privacy-related questions or requests:</p>
              <p><strong>Email:</strong> <a href="mailto:hello@thefixflowapp.com">hello@thefixflowapp.com</a><br />
              <strong>Trading as:</strong> FixFlow</p>
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
          </div>
          <div className="legalFooterCopy">© 2026 FixFlow</div>
        </div>
      </footer>
    </div>
  );
}
