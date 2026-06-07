// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import "./home.css";

export default function HomePage() {
  return (
    <main className="homePage">
      <section className="homeHero">
        <div className="homeNav">
          <div className="homeLogo">FixFlow</div>

          <div className="homeNavActions">
            <Link href="/login">Log in</Link>
            <Link className="homeNavBtn" href="/signup">
              Start free
            </Link>
          </div>
        </div>

<div className="homeHeroGrid">
  <div>
    <div className="homeBadge">Built for busy trades</div>

<h1>Trades deserve better.</h1>

<p>
  Stop losing jobs because enquiries, messages, quotes and follow-ups
  are scattered everywhere. FixFlow keeps the whole job journey in one
  organised dashboard.
</p>

    <div className="homeHeroActions">
      <Link className="homePrimaryBtn" href="/signup">
        Start free
      </Link>


    </div>

<div className="homeTrust">
  Built to help busy trades reply faster, follow up properly and win more work.
</div>
  </div>

<div className="homeScreenshotLabel">
  Real FixFlow dashboard
</div>

<div className="homeScreenshot">
  <Image
      src="/screenshots/enquiries-hero.png"
      alt="FixFlow enquiries dashboard"
      width={1400}
      height={900}
      priority
    />
  </div>
</div>
      </section>

      <section className="homeSection">
        <div className="homeSectionHeader">
          <span>Why FixFlow?</span>

          <h2>
            Customers are ready to buy. Most trades just reply too late.
          </h2>

          <p>
            Enquiries get buried in texts, emails and missed calls. Customers
            move on. Jobs are lost. FixFlow keeps everything organised so you can
            respond quickly and win more work.
          </p>
        </div>

        <div className="homeCards">
          <div className="homeCard">
            <h3>📱 Enquiries buried in texts</h3>
            <p>
              Customer messages arrive from everywhere and important jobs get
              missed.
            </p>
          </div>

          <div className="homeCard">
            <h3>📧 Quotes lost in emails</h3>
            <p>
              Estimates disappear into inboxes and nobody knows what needs
              following up.
            </p>
          </div>

          <div className="homeCard">
            <h3>📋 Jobs tracked on scraps of paper</h3>
            <p>
              Notes, reminders and customer details end up scattered across
              multiple places.
            </p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="homeSection">
        <div className="homeSectionHeader">
          <span>How it works</span>
          <h2>From enquiry to invoice.</h2>
          <p>
            FixFlow gives every job a simple path, so you always know what came
            in, what needs a reply and what needs doing next.
          </p>
        </div>

        <div className="homeCards">
          <div className="homeCard">
            <h3>1. Customer sends enquiry</h3>
            <p>
              They send job details, photos, contact information and postcode
              through your own FixFlow link.
            </p>
          </div>

          <div className="homeCard">
            <h3>2. FixFlow keeps it organised</h3>
            <p>
              Messages, missing info, estimates, visits and follow-ups stay in
              one place.
            </p>
          </div>

          <div className="homeCard">
            <h3>3. You win the job</h3>
            <p>
              Book the work, send the invoice, track payment and ask for a
              review.
            </p>
          </div>
        </div>
      </section>

      <section className="homeFeatureBand">
        <div>
          <span>Everything in one flow</span>
          <h2>From first message to paid invoice.</h2>
        </div>

        <div className="homeFeatureList">
          <div>Enquiry inbox</div>
          <div>Customer messaging</div>
          <div>Quick estimates</div>
          <div>Detailed estimates</div>
          <div>Site visits</div>
          <div>Job tracking</div>
          <div>Invoices</div>
          <div>Reviews</div>
        </div>
      </section>

      <section className="homeSection">
        <div className="homeSectionHeader">
          <span>Built from real trade experience</span>

          <h2>FixFlow was built to solve a problem trades see every day.</h2>

          <p>
            Customers struggle to get replies. Trades lose track of enquiries.
            Good jobs slip through the cracks because everything is spread
            across calls, texts, emails and paperwork.
          </p>

          <p>
            FixFlow brings the full customer journey into one calm, organised
            system — from first enquiry to paid invoice.
          </p>
        </div>
      </section>

      <section className="homeCTA">
        <h2>Win more jobs. Spend less time chasing paperwork.</h2>

        <p>
          Start with your own enquiry link and a dashboard built to help you win
          more work.
        </p>

        <Link className="homePrimaryBtn" href="/signup">
          Start using FixFlow
        </Link>
      </section>
    </main>
  );
}