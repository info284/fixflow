// app/compare/methodology/page.tsx

import Link from "next/link";
import HomeNav from "@/app/components/home/HomeNav";
import HomeFooter from "@/app/components/home/HomeFooter";
import "../../home.css";

export const metadata = {
title: "How We Compare Trade Software | FixFlow",
description:
"See how FixFlow researches and verifies comparisons with Tradify, Powered Now and Jobber.",
};

export default function ComparisonMethodologyPage() {
return (
<main className="homePage">
<HomeNav />

<section className="compareHero">
<div className="compareInner">
<div className="compareEyebrow">How we compare</div>

<h1>Fair comparisons. Clear sources.</h1>

<p>
We want our software comparisons to be useful, accurate and easy
to verify. We use publicly available information from each
provider and review the information regularly.
</p>

<Link href="/compare" className="comparePrimaryButton">
View comparisons
</Link>
</div>
</section>

<section className="methodologySection">
<div className="compareInner">
<div className="methodologyContent">
<section className="methodologyBlock">
<span className="compareEyebrow">Our approach</span>

<h2>What we compare</h2>

<p>
Our comparison pages focus on features that are relevant to
running a trade business, including enquiries, quoting,
follow-up, scheduling, job management, invoicing, payments,
pricing and free trial periods.
</p>

<p>
We do not assume that FixFlow is the right choice for every
business. Where another platform provides functionality that
FixFlow does not currently provide, we aim to make that clear.
</p>
</section>

<section className="methodologyBlock">
<h2>What our comparison table means</h2>

<div className="methodologyDefinitions">
<div>
<strong>✓</strong>
<p>
The provider publicly states that it offers this type of
functionality. Availability may depend on the subscription
plan selected.
</p>
</div>

<div>
<strong>Pricing</strong>
<p>
Prices shown are taken from publicly available UK pricing
information at the time the comparison was reviewed.
</p>
</div>

<div>
<strong>Free trial</strong>
<p>
Trial periods are based on the provider&apos;s publicly
advertised offer at the time of review.
</p>
</div>
</div>
</section>

<section className="methodologyBlock">
<span className="compareEyebrow">Tradify</span>

<h2>Sources used</h2>

<p>
Our Tradify comparison uses information published by Tradify
on its UK website, including its pricing and product feature
pages.
</p>

<div className="methodologyLinks">
<a
href="https://www.tradifyhq.com/uk/pricing"
target="_blank"
rel="noreferrer"
>
Tradify UK pricing →
</a>

<a
href="https://www.tradifyhq.com/uk"
target="_blank"
rel="noreferrer"
>
Tradify UK website →
</a>
</div>
</section>

<section className="methodologyBlock">
<span className="compareEyebrow">Powered Now</span>

<h2>Sources used</h2>

<p>
Our Powered Now comparison uses information published by
Powered Now on its website, including its pricing, product
information and trial information.
</p>

<div className="methodologyLinks">
<a
href="https://powerednow.com/pricing/"
target="_blank"
rel="noreferrer"
>
Powered Now pricing →
</a>

<a
href="https://powerednow.com/"
target="_blank"
rel="noreferrer"
>
Powered Now website →
</a>
</div>
</section>

<section className="methodologyBlock">
<span className="compareEyebrow">Jobber</span>

<h2>Sources used</h2>

<p>
Our Jobber comparison uses publicly available information
published by Jobber, including its product, pricing and help
documentation.
</p>

<div className="methodologyLinks">
<a
href="https://www.getjobber.com/"
target="_blank"
rel="noreferrer"
>
Jobber website →
</a>

<a
href="https://www.getjobber.com/pricing/"
target="_blank"
rel="noreferrer"
>
Jobber pricing →
</a>
</div>
</section>

<section className="methodologyBlock methodologyReview">
<span className="compareEyebrow">Last reviewed</span>

<h2>18 August 2026</h2>

<p>
Software products, pricing and subscription plans change.
Comparisons reflect the information available when they were
last reviewed and may not reflect later changes.
</p>

<p>
If you believe any information in one of our comparisons is
inaccurate or out of date, please contact FixFlow so we can
review it.
</p>
</section>

<section className="methodologyBlock methodologyLegal">
<h2>Trademarks and affiliation</h2>

<p>
Tradify, Powered Now, Jobber and any other third-party product
or company names referred to on this website are the property
of their respective owners.
</p>

<p>
FixFlow is not affiliated with, endorsed by or sponsored by
Tradify, Powered Now or Jobber.
</p>
</section>
</div>
</div>
</section>

<HomeFooter />
</main>
);
}