// app/components/home/HomeHero.tsx
import Link from "next/link";
import Image from "next/image";

export default function HomeHero() {
  return (
    <section className="homeHero">
      <div className="homeHeroInner">
        <div className="homeHeroBadge">
          <div className="homeHeroBadgeDot" />
          Built for UK tradespeople
        </div>

        <h1 className="homeHeroHeadline">
          Stop losing jobs<br />you&apos;ve <em>already won.</em>
        </h1>

        <p className="homeHeroSub">
          Forgotten quotes, missed follow-ups, buried messages. FixFlow keeps every
          enquiry, job and invoice in one place — from first contact to final payment.
        </p>

        <div className="homeHeroActions">
          <Link className="homePrimaryBtn" href="/signup">Start free — no card needed</Link>
          <Link className="homeGhostBtn" href="#why">See how it works</Link>
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
