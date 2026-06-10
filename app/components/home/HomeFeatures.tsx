// app/components/home/HomeFeatures.tsx
import Image from "next/image";

const features = [
  {
    label: "Enquiries",
    title: "Never lose another job in your inbox.",
    body: "Every enquiry lands in one organised dashboard with the customer name, postcode, job details, messages and next action — so nothing gets buried.",
    image: "/screenshots/enquiries-hero.png",
    alt: "FixFlow enquiries dashboard",
    reverse: false,
  },
  {
    label: "Messages",
    title: "Forgotten what you said? FixFlow remembers.",
    body: "Every conversation stays attached to the right job — no more digging through texts, emails and WhatsApp to piece together what happened.",
    image: "/screenshots/messages.png",
    alt: "FixFlow messages",
    reverse: true,
  },
  {
    label: "Jobs",
    title: "Stop jobs falling through the cracks.",
    body: "Track booked work, progress, notes and next actions without relying on memory, paper diaries or scattered messages.",
    image: "/screenshots/jobs.png",
    alt: "FixFlow jobs",
    reverse: false,
  },
  {
    label: "Get paid faster",
    title: "From job complete to paid invoice.",
    body: "Create invoices, send them instantly and track every payment in one place — connected directly to the job it came from.",
    image: "/screenshots/invoices.png",
    alt: "FixFlow invoices",
    reverse: true,
  },
];

export default function HomeFeatures() {
  return (
    <section className="homeSection homeSectionAlt" id="product">
      <div className="homeContainer">
        <div className="homeSectionHeader">
          <span className="homeEyebrow">The FixFlow system</span>
          <h2>One place. Every job. Start to finish.</h2>
          <p>From the first enquiry through to the paid invoice — nothing falls through the cracks.</p>
        </div>

        {features.map((f) => (
          <div
            key={f.label}
            className={`homeFeatureRow${f.reverse ? " homeFeatureRowReverse" : ""}`}
          >
            <div className="homeFeatureText">
              <div className="homeEyebrow">{f.label}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
            <div className="homeFeatureShot">
              <Image src={f.image} alt={f.alt} width={1400} height={900} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
