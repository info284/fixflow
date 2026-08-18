// app/compare/page.tsx

import Link from "next/link";
import HomeNav from "@/app/components/home/HomeNav";
import HomeFooter from "@/app/components/home/HomeFooter";
import "../home.css";

export const metadata = {
title: "Compare FixFlow | Trade Management Software",
description:
"Compare FixFlow with Tradify, Powered Now and Jobber to find the right trade management software for your business.",
};

export default function ComparePage() {
return (
<main className="homePage">
<HomeNav />

<section className="compareHero">
<div className="compareInner">
<div className="compareEyebrow">Compare FixFlow</div>

<h1>Find the right trade software for the way you work.</h1>

<p>
Tradify, Powered Now and Jobber are all established job management
platforms. FixFlow takes a more focused approach — helping trade
businesses win work, manage customers and move jobs through to
completion without unnecessary complexity.
</p>

<Link href="/signup" className="comparePrimaryButton">
Start free for 30 days
</Link>
</div>
</section>

<section className="compareChoices">
<div className="compareInner">
<div className="compareSectionHeading">
<span>Choose a comparison</span>
<h2>See how FixFlow stacks up.</h2>
</div>

<div className="compareGrid">
<Link href="/compare/tradify" className="compareChoiceCard">
<div>
<span className="compareChoiceLabel">FixFlow vs</span>
<h3>Tradify</h3>
<p>
Compare FixFlow with one of the best-known job management
platforms for trades.
</p>
</div>

<strong>Compare →</strong>
</Link>

<Link href="/compare/powered-now" className="compareChoiceCard">
<div>
<span className="compareChoiceLabel">FixFlow vs</span>
<h3>Powered Now</h3>
<p>
See how FixFlow compares with a UK-focused platform covering
job management, paperwork and accounting tools.
</p>
</div>

<strong>Compare →</strong>
</Link>

<Link href="/compare/jobber" className="compareChoiceCard">
<div>
<span className="compareChoiceLabel">FixFlow vs</span>
<h3>Jobber</h3>
<p>
Compare FixFlow with a broader field-service platform built
for service businesses and teams.
</p>
</div>

<strong>Compare →</strong>
</Link>
</div>
</div>
</section>

<section className="comparePositioning">
<div className="compareInner comparePositioningInner">
<div>
<span className="compareEyebrow">A different approach</span>

<h2>We're not trying to have the most features.</h2>
</div>

<div className="comparePositioningCopy">
<p>
We&apos;re trying to make the features trade businesses actually
use work better together.
</p>

<p>
FixFlow is designed around the whole customer journey — from the
first enquiry, through quoting and follow-up, to the job, invoice
and payment.
</p>
</div>
</div>
</section>

<section className="compareFlow">
<div className="compareInner">
<div className="compareFlowHeading">
<span>How FixFlow thinks</span>
<h2>Win it. Manage it. Finish it.</h2>
</div>

<div className="compareFlowSteps">
<div className="compareFlowStep">
<span>01</span>
<h3>Win it</h3>
<p>
Capture enquiries, keep customer details together, send
estimates and follow up consistently.
</p>
</div>

<div className="compareFlowStep">
<span>02</span>
<h3>Manage it</h3>
<p>
Keep messages, site visits, files, notes and job information in
one place.
</p>
</div>

<div className="compareFlowStep">
<span>03</span>
<h3>Finish it</h3>
<p>
Move work through to completion, invoice professionally and get
paid.
</p>
</div>
</div>
</div>
</section>

<section className="compareDisclaimer">
<div className="compareInner">
<p>
Comparisons are based on publicly available information from each
provider. Features, pricing and plan availability can change. We
recommend checking each provider&apos;s website before making a
purchasing decision.
</p>
</div>
</section>

<HomeFooter />
</main>
);
}