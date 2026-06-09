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
            <div className="homeBadge">Built from real trade problems</div>

            <h1>
              The biggest threat to a trade business isn’t competition.
              It’s disorganisation.
            </h1>

            <p>
              Trades deserve better. Forgotten quotes, missed follow-ups, lost
              postcodes and buried customer messages cost trades work they
              should have won. FixFlow keeps everything organised so busy trades
              stop giving customers a reason to go elsewhere.
            </p>

            <div className="homeHeroActions">
              <Link className="homePrimaryBtn" href="/signup">
                Start free
              </Link>

              <Link className="homeSecondaryBtn" href="#why">
                See why trades need it
              </Link>
            </div>

            <div className="homeTrust">
              Built after years of watching good trades lose money through
              missed admin, not bad workmanship.
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

      <section id="why" className="homeSection">
        <div className="homeSectionHeader">
          <span>Why FixFlow exists</span>

          <h2>
            You don’t need more leads if you keep losing the ones you already
            have.
          </h2>

          <p>
            Most trades don’t lose jobs because they’re bad at the trade. They
            lose jobs because the business side breaks down. Quotes get
            forgotten. Messages get buried. Customer details go missing.
            Follow-ups never happen.
          </p>
        </div>

        <div className="homeCards">
          <div className="homeCard">
            <h3>Forgotten quotes</h3>
            <p>
              A customer asks for a price, waits too long, then books someone
              else who looks more organised.
            </p>
          </div>

          <div className="homeCard">
            <h3>Lost postcodes and details</h3>
            <p>
              Addresses, bathroom plans, notes and customer information get
              buried across texts, emails, WhatsApp and paper.
            </p>
          </div>

          <div className="homeCard">
            <h3>Poor follow-up</h3>
            <p>
              Customers are ready to buy, but slow replies and missed updates
              make the business look unprofessional.
            </p>
          </div>
        </div>
      </section>

      <section className="homeProductStory">
        <div className="homeSectionHeader">
          <span>The FixFlow system</span>

          <h2>One place for every enquiry, job, message, quote and invoice.</h2>

          <p>
            FixFlow keeps the full customer journey together, so busy trades
            always know what came in, what needs a reply and what needs doing
            next.
          </p>
        </div>

        <div className="homeProductFeature">
          <div>
            <span>Enquiries</span>
            <h3>Never lose another job in your inbox.</h3>
            <p>
              Every enquiry lands in one organised dashboard with the customer
              name, postcode, job details, messages and next action.
            </p>
          </div>

          <div className="homeProductShot">
            <Image
              src="/screenshots/enquiries-hero.png"
              alt="FixFlow enquiries dashboard"
              width={1400}
              height={900}
            />
          </div>
        </div>

        <div className="homeProductFeature homeProductFeatureReverse">
          <div className="homeProductShot">
            <Image
              src="/screenshots/messages.png"
              alt="FixFlow customer messages"
              width={1400}
              height={900}
            />
          </div>

          <div>
            <span>Messages</span>
            <h3>Forgotten what you said to the customer? FixFlow remembers.</h3>
            <p>
              Keep every conversation attached to the job, so you’re not digging
              through texts, emails and WhatsApp trying to work out what
              happened.
            </p>
          </div>
        </div>

        <div className="homeProductFeature">
          <div>
            <span>Jobs</span>
            <h3>Stop jobs falling through the cracks.</h3>
            <p>
              Track booked work, progress, notes, files and next actions without
              relying on memory, paper diaries or scattered messages.
            </p>
          </div>

          <div className="homeProductShot">
            <Image
              src="/screenshots/jobs.png"
              alt="FixFlow jobs dashboard"
              width={1400}
              height={900}
            />
          </div>
        </div>

        <div className="homeProductFeature homeProductFeatureReverse">
          <div className="homeProductShot">
            <Image
              src="/screenshots/invoices.png"
              alt="FixFlow invoices"
              width={1400}
              height={900}
            />
          </div>

          <div>
            <span>Get paid faster</span>
            <h3>From job complete to paid invoice.</h3>
            <p>
              Create invoices, send them instantly and track every payment in
              one place, connected to the original job.
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
          <div>Customer details</div>
          <div>Postcodes</div>
          <div>Estimates</div>
          <div>Site visits</div>
          <div>Job tracking</div>
          <div>Invoices</div>
        </div>
      </section>

      <section className="homeSection">
        <div className="homeSectionHeader">
          <span>Built from the showroom floor</span>

          <h2>I didn’t invent a problem. I watched it happen for years.</h2>

          <p>
            FixFlow was built from real trade-business problems seen every day:
            forgotten quotes, missing postcodes, lost bathroom plans, slow
            updates, missed follow-ups and customers going elsewhere because the
            business looked disorganised.
          </p>

          <p>
            I wasn’t trying to start a software company. I was just listening.
            FixFlow was built to stop trades losing work they’ve already won.
          </p>
        </div>
      </section>

      <section className="homePricing">
        <div className="homeSectionHeader">
          <span>Pricing</span>

          <h2>Change how your trade business runs for £29 a month.</h2>

          <p>
            Early access is free while FixFlow continues improving. Simple,
            affordable software built for real trades.
          </p>
        </div>

        <div className="homePriceCard">
          <div className="homePriceBadge">Early access</div>

          <h3>Free</h3>

          <p>
            Use FixFlow free during early access. After launch, plans will start
            from £29/month.
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
        <h2>Stop looking unprofessional. Start running the business properly.</h2>

        <p>
          FixFlow helps busy trades organise enquiries, follow up faster, win
          more jobs and get paid.
        </p>

        <Link className="homePrimaryBtn" href="/signup">
          Start using FixFlow
        </Link>
      </section>
    </main>
  );
}