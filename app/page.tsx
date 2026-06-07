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
  Designed from real trade experience and built for busy trades.
</div>
  </div>

<div className="homeScreenshotWrap">
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
</div>
      </section>
<section className="homeProductStory">
  <div className="homeSectionHeader">
    <span>See the product</span>
    <h2>Everything a trade business needs to turn enquiries into jobs.</h2>
    <p>
      FixFlow keeps the full customer journey together — from the first
      message to the final invoice.
    </p>
  </div>

  <div className="homeProductFeature">
    <div>
      <span>Customer messages</span>
      <h3>Reply faster without digging through texts and emails.</h3>
      <p>
        Keep every customer conversation attached to the job, so you know who
        replied, what was said and what needs doing next.
      </p>
    </div>

    <div className="homeProductShot">
      <Image
        src="/screenshots/messages.png"
        alt="FixFlow customer messages"
        width={1400}
        height={900}
      />
    </div>
  </div>
  <div className="homeProductFeature homeProductFeatureReverse">
    <div className="homeProductShot">
      <Image
        src="/screenshots/jobs.png"
        alt="FixFlow jobs dashboard"
        width={1400}
        height={900}
      />
    </div>

    <div>
      <span>Jobs</span>
      <h3>Know exactly what needs doing next.</h3>
      <p>
        Track booked jobs, work in progress, completed work and outstanding
        actions without relying on memory or paper notes.
      </p>
    </div>
  </div>

  <div className="homeProductFeature">
    <div>
      <span>Invoices</span>

      <h3>Create invoices and get paid faster.</h3>

      <p>
        Generate professional invoices, track payment status and keep every
        invoice connected to the job it came from.
      </p>
    </div>

    <div className="homeProductShot">
      <Image
        src="/screenshots/invoices.png"
        alt="FixFlow invoices"
        width={1400}
        height={900}
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
<section className="homePricing">
  <div className="homeSectionHeader">
    <span>Pricing</span>

    <h2>Simple pricing.</h2>

    <p>
      Join FixFlow during early access and help shape the platform.
    </p>
  </div>

  <div className="homePriceCard">
    <div className="homePriceBadge">Early access</div>

    <h3>Free</h3>

    <p>
      Use FixFlow free while we continue building new features and improving
      the platform.
    </p>

    <ul>
      <li>✓ Enquiries</li>
      <li>✓ Customer messaging</li>
      <li>✓ Estimates</li>
      <li>✓ Jobs</li>
      <li>✓ Invoices</li>
      <li>✓ Reviews</li>
    </ul>

    <Link className="homePrimaryBtn" href="/signup">
      Start free
    </Link>
  </div>
</section>
<section className="homeFAQ">
  <div className="homeSectionHeader">
    <span>FAQ</span>
    <h2>Questions before you start?</h2>
  </div>

  <div className="homeFAQList">
    <div>
      <h3>Is FixFlow free?</h3>
      <p>Yes. FixFlow is free during early access.</p>
    </div>

    <div>
      <h3>Do customers need an app?</h3>
      <p>No. Customers simply use your enquiry link.</p>
    </div>

    <div>
      <h3>Does FixFlow work on mobile?</h3>
      <p>Yes. FixFlow works on phones, tablets and desktop.</p>
    </div>

    <div>
      <h3>Can I send invoices?</h3>
      <p>Yes. You can create and send invoices directly from FixFlow.</p>
    </div>
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