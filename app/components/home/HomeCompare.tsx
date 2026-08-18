// app/components/home/HomeCompare.tsx

import Link from "next/link";

export default function HomeCompare() {
return (
<section className="homeCompare">
<div className="homeCompareInner">
<div className="homeCompareEyebrow">Compare FixFlow</div>

<h2>Not all trade software is built the same.</h2>

<p className="homeCompareIntro">
See how FixFlow compares with Tradify, Powered Now and Jobber —
and find the right fit for the way you run your business.
</p>

<div className="homeCompareCards">
<Link href="/compare/tradify" className="homeCompareCard">
<span>FixFlow vs</span>
<strong>Tradify</strong>
<div>Compare →</div>
</Link>

<Link href="/compare/powered-now" className="homeCompareCard">
<span>FixFlow vs</span>
<strong>Powered Now</strong>
<div>Compare →</div>
</Link>

<Link href="/compare/jobber" className="homeCompareCard">
<span>FixFlow vs</span>
<strong>Jobber</strong>
<div>Compare →</div>
</Link>
</div>

<Link href="/compare" className="homeCompareButton">
Compare trade software
</Link>
</div>
</section>
);
}