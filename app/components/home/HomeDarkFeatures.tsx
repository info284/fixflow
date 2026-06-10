// app/components/home/HomeDarkFeatures.tsx

const cards = [
  { name: "Enquiry inbox", desc: "Every new enquiry, organised and ready to act on." },
  { name: "Customer messaging", desc: "All conversations attached to the right job." },
  { name: "Job tracking", desc: "Progress, notes and next actions in one place." },
  { name: "Estimates", desc: "Price and send estimates before the job exists." },
  { name: "Invoices", desc: "Create, send and track — linked to the original job." },
  { name: "Direct payments", desc: "Get paid straight to your account via Stripe." },
  { name: "Verified reviews", desc: "Reviews linked to real completed jobs. Unfakeable." },
  { name: "Public profile", desc: "Your own trade page with QR code and trust signals." },
];

export default function HomeDarkFeatures() {
  return (
    <div className="homeDarkBand">
      <div className="homeContainer">
        <span className="homeDarkEyebrow">Everything in one flow</span>
        <h2>From first message<br />to paid invoice.</h2>
        <p className="homeDarkBandSub">Every stage of the job. One place. Nothing missing.</p>

        <div className="homeDarkGrid">
          {cards.map((card) => (
            <div key={card.name} className="homeDarkCard">
              <div className="homeDarkCardName">{card.name}</div>
              <div className="homeDarkCardDesc">{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
