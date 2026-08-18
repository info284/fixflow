// app/components/home/HomeHero.tsx
import Image from "next/image";

export default function HomeHero() {
  return (
    <section className="homeHero">
      <div className="homeHeroInner">
        <div className="homeHeroMark">
  <Image
    src="/fixflow-logo.png"
    alt="FixFlow"
width={180}
height={60}
    priority
  />
</div>
<div className="homeHeroBadge">
  Built for the trades
</div>

        <h1 className="homeHeroHeadline">
          Stop losing jobs<br />you&apos;ve <em>already won.</em>
        </h1>

        <p className="homeHeroSub">
          Forgotten quotes, missed follow-ups, buried messages. FixFlow keeps every
          enquiry, job and invoice in one place — from first contact to final payment.
        </p>

        <div className="homeHeroActions">
          <a className="homePrimaryBtn" href="/signup">
          Start your free trial
          </a>

          <a className="homeGhostBtn" href="#why">
            See how it works
          </a>
        </div>

        <div className="homeHeroTrust">
          Built after years watching good trades lose work through missed admin, not bad workmanship.
        </div>

        <div className="homeHeroScreenWrap">
          <div className="homeHeroScreen">
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
  );
}