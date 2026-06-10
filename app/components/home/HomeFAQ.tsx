// app/components/home/HomeFAQ.tsx

const faqs = [
  {
    q: "Is FixFlow free?",
    a: "Yes — free during early access. After launch, plans start from £29/month with everything included.",
  },
  {
    q: "Do customers need an app?",
    a: "No. Customers use your enquiry link from any device — no download, no account required.",
  },
  {
    q: "Does FixFlow work on mobile?",
    a: "Yes. FixFlow works on phones, tablets and desktop — built for trades on the go.",
  },
  {
    q: "Can I send invoices?",
    a: "Yes. Create and send branded invoices directly from FixFlow, connected to the original job.",
  },
];

export default function HomeFAQ() {
  return (
    <section className="homeSection" id="faq">
      <div className="homeContainer">
        <div className="homeSectionHeader">
          <span className="homeEyebrow">FAQ</span>
          <h2>Questions before you start?</h2>
        </div>

        <div className="homeFAQGrid">
          {faqs.map((faq) => (
            <div key={faq.q} className="homeFAQCard">
              <h3>{faq.q}</h3>
              <p>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
