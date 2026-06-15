// app/components/home/HomeFounder.tsx

const stats = [
  { num: "£0", label: "VC funding. Just one founder who cared enough to build it." },
  { num: "1", label: "Person. One product. All in." },
  { num: "£29", label: "Per month. Less than one lost job." },
  { num: "0", label: "Competitors who start at the enquiry." },
];

export default function HomeFounder() {
  return (
    <section className="homeFounder">
      <div className="homeFounderInner homeContainer">
        <div className="homeFounderLeft">
          <div className="homeFounderEyebrow">Why FixFlow exists</div>
          <div className="homeFounderQuote">
            &ldquo;Every competitor starts at the quote.<br />
            <em>I start where the job is actually lost.</em>&rdquo;
          </div>
<p className="homeFounderBody">
  Most job management software is built by people who&apos;ve never watched a trade lose a job to slow admin. FixFlow was built by someone who has — thousands of times.
</p>

          <p className="homeFounderBody">
            After years working directly with tradespeople every single day, the pattern was
            impossible to miss. Jobs lost before a quote was even sent. Customers ghosted.
            Follow-ups that never happened. Not because the trade was bad at their job —
            because nothing existed to manage the bit before the job.
          </p>
          <p className="homeFounderBody">
            Every competitor starts at the quote stage. FixFlow starts at the enquiry. That gap
            is where trade businesses live or die — and nobody was filling it. So I did.
          </p>
          <div className="homeFounderSig">
            
            <div>
              <div className="homeFounderName">Anna, Founder</div>
              <div className="homeFounderRole">
Built after years of watching trade businesses lose work through disorganisation
</div>
            </div>
          </div>
        </div>

        <div className="homeFounderRight">
         <div className="homeStatGrid homeStatGridMobile">

            {stats.map((s) => (
              <div key={s.num} className="homeStat">
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
