// app/terms/page.tsx
import Link from "next/link";
import "../legal.css";


export const metadata = {
  title: "Terms of Service | FixFlow",
  description: "FixFlow terms of service. Read before using the platform.",
};

export default function TermsPage() {
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
            <h1>Terms of Service</h1>
            <p>Last updated: June 2026</p>
          </div>

          <div className="legalBody">

            <section className="legalSection">
              <h2>1. Who we are</h2>
              <p>FixFlow is a job management platform for UK tradespeople, operated by Anna Dowling, trading as FixFlow ("FixFlow", "we", "us", "our").</p>
              <p><strong>Contact:</strong> <a href="mailto:hello@thefixflowapp.com">hello@thefixflowapp.com</a></p>
              <p>By creating an account and using FixFlow, you agree to these Terms of Service. Please read them carefully.</p>
            </section>

            <section className="legalSection">
              <h2>2. What FixFlow is</h2>
              <p>FixFlow is a software platform that helps tradespeople manage enquiries, jobs, estimates, invoices, customer communications and payments.</p>
              <p>FixFlow is a tool for business management. We are not a party to any contract between a trader and their customer. We are not responsible for the quality of work, disputes between traders and customers, or payments owed between them.</p>
            </section>

            <section className="legalSection">
              <h2>3. Eligibility</h2>
              <p>To use FixFlow you must:</p>
              <ul>
                <li>Be at least 18 years old</li>
                <li>Be based in the United Kingdom or operating as a UK business</li>
                <li>Use FixFlow only for lawful business purposes</li>
              </ul>
            </section>

            <section className="legalSection">
              <h2>4. Your account</h2>
              <p>You are responsible for keeping your login credentials secure. Do not share your password with anyone.</p>
              <p>You are responsible for all activity that takes place under your account.</p>
              <p>If you suspect unauthorised access to your account, contact us immediately at <a href="mailto:hello@thefixflowapp.com">hello@thefixflowapp.com</a>.</p>
            </section>

            <section className="legalSection">
              <h2>5. Acceptable use</h2>
              <p>You agree not to use FixFlow to:</p>
              <ul>
                <li>Violate any UK law or regulation</li>
                <li>Upload or transmit malicious code or viruses</li>
                <li>Attempt to gain unauthorised access to any part of the platform</li>
                <li>Misrepresent your identity or business</li>
                <li>Harass, abuse or harm any other user</li>
                <li>Use the platform for any purpose other than legitimate business management</li>
              </ul>
              <p>We reserve the right to suspend or terminate accounts that violate these terms.</p>
            </section>

            <section className="legalSection">
              <h2>6. Pricing and payment</h2>
              <h3>Early access</h3>
              <p>FixFlow is currently free during early access. We will give you reasonable notice before any paid plans come into effect.</p>
              <h3>Paid plans</h3>
              <p>When paid plans launch, pricing will start from £29/month. You will be billed via Stripe. You can cancel at any time — cancellation takes effect at the end of your current billing period.</p>
              <h3>Refunds</h3>
              <p>We do not offer refunds for partial billing periods. If you believe you have been charged in error, contact us at <a href="mailto:hello@thefixflowapp.com">hello@thefixflowapp.com</a>.</p>
            </section>

            <section className="legalSection">
              <h2>7. Stripe Connect and payments</h2>
              <p>FixFlow uses Stripe Connect to enable traders to receive payments from their customers directly into their own bank accounts.</p>
              <p>By connecting a Stripe account, you also agree to <a href="https://stripe.com/gb/legal" target="_blank" rel="noopener noreferrer">Stripe's Terms of Service</a>.</p>
              <p>FixFlow is not responsible for any fees charged by Stripe, payment failures, or disputes between traders and their customers relating to payment.</p>
            </section>

            <section className="legalSection">
              <h2>8. Your data and content</h2>
              <p>You retain ownership of all data and content you upload to FixFlow, including customer records, job details and invoices.</p>
              <p>By using FixFlow, you grant us a limited licence to store and process your data solely for the purpose of providing the service to you.</p>
              <p>We will not sell, share or use your data for any purpose outside of operating FixFlow. See our <Link href="/privacy">Privacy Policy</Link> for full details.</p>
            </section>

            <section className="legalSection">
              <h2>9. Data about your customers</h2>
              <p>When you enter your customers' personal data into FixFlow, you are responsible for:</p>
              <ul>
                <li>Having a lawful basis to store that data</li>
                <li>Informing your customers that their data is held in FixFlow</li>
                <li>Responding to any data access or deletion requests from your customers</li>
              </ul>
              <p>FixFlow processes this data on your behalf as a data processor. See our <Link href="/privacy">Privacy Policy</Link> for more detail.</p>
            </section>

            <section className="legalSection">
              <h2>10. Intellectual property</h2>
              <p>FixFlow and all associated software, design, content and trademarks are owned by Anna Dowling trading as FixFlow.</p>
              <p>You may not copy, reproduce, distribute or create derivative works from any part of FixFlow without our written permission.</p>
            </section>

            <section className="legalSection">
              <h2>11. Availability and changes</h2>
              <p>We aim to keep FixFlow available at all times, but we do not guarantee uninterrupted access. We may carry out maintenance, updates or changes to the platform at any time.</p>
              <p>We reserve the right to modify, suspend or discontinue any part of FixFlow with reasonable notice where possible.</p>
            </section>

            <section className="legalSection">
              <h2>12. Limitation of liability</h2>
              <p>To the fullest extent permitted by UK law, FixFlow shall not be liable for:</p>
              <ul>
                <li>Loss of profits, revenue or business</li>
                <li>Loss of data</li>
                <li>Indirect or consequential losses</li>
              </ul>
              <p>Our total liability to you in any circumstances shall not exceed the amount you have paid to us in the 12 months preceding the claim.</p>
              <p>Nothing in these terms limits our liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.</p>
            </section>

            <section className="legalSection">
              <h2>13. Indemnity</h2>
              <p>You agree to indemnify and hold FixFlow harmless from any claims, losses or damages arising from your use of the platform in breach of these terms.</p>
            </section>

            <section className="legalSection">
              <h2>14. Termination</h2>
              <p>You may close your account at any time by contacting us at <a href="mailto:hello@thefixflowapp.com">hello@thefixflowapp.com</a>.</p>
              <p>We may suspend or terminate your account if you breach these terms, or if we have reasonable grounds to believe your use of FixFlow is harmful to other users or to the platform.</p>
              <p>On termination, your data will be deleted in accordance with our Privacy Policy.</p>
            </section>

            <section className="legalSection">
              <h2>15. Governing law</h2>
              <p>These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
            </section>

            <section className="legalSection">
              <h2>16. Changes to these terms</h2>
              <p>We may update these terms from time to time. We will notify you of material changes by email with at least 14 days notice. Continued use of FixFlow after that date constitutes acceptance of the updated terms.</p>
            </section>

            <section className="legalSection">
              <h2>17. Contact</h2>
              <p>For any questions about these terms:</p>
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
