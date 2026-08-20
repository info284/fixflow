// app/components/home/HomeFounder.tsx

const stats = [
{
num: "£0",
label: "VC funding. Just one founder who cared enough to build it.",
},
{
num: "1",
label: "Person. One product. All in.",
},
{
num: "£29",
label: "Per month. Less than one lost job.",
},
{
num: "1",
label: "Connected flow. From first enquiry to finished job.",
},
];

export default function HomeFounder() {
return (
<section className="homeFounder">
<div className="homeFounderInner homeContainer">
<div className="homeFounderLeft">
<div className="homeFounderEyebrow">
Why FixFlow exists
</div>

<div className="homeFounderQuote">
&ldquo;The job doesn&apos;t start with the quote.
<br />
<em>It starts with the opportunity.</em>&rdquo;
</div>

<p className="homeFounderBody">
FixFlow was built after years of working directly with
tradespeople and seeing how easily good opportunities can
disappear through slow admin and disorganisation.
</p>

<p className="homeFounderBody">
Enquiries get buried. Quotes get forgotten. Follow-ups
don&apos;t happen. Customer information ends up spread across
WhatsApp, emails, notes, photos and diaries. Not because the
trade is bad at their job — because running the business around
the job is another job in itself.
</p>

<p className="homeFounderBody">
That&apos;s why FixFlow starts with the opportunity and keeps
the journey connected — from the first customer enquiry through
quoting, follow-up, managing the job, invoicing and getting paid.
</p>

<div className="homeFounderSig">
<div>
<div className="homeFounderName">
Anna, Founder
</div>

<div className="homeFounderRole">
Built after years of watching trade businesses lose work
through disorganisation
</div>
</div>
</div>
</div>

<div className="homeFounderRight">
<div className="homeStatGrid homeStatGridMobile">
{stats.map((s) => (
<div key={`${s.num}-${s.label}`} className="homeStat">
<div className="homeStatNum">{s.num}</div>
<div className="homeStatLabel">{s.label}</div>
</div>
))}
</div>
</div>
</div>
</section>
);
}