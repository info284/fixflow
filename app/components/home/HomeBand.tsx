// app/components/home/HomeBand.tsx

const tags = [
  "Enquiry inbox",
  "Customer messaging",
  "Job tracking",
  "Estimates",
  "Site visits",
  "Invoices",
  "Verified reviews",
  "Direct payments",
];

export default function HomeBand() {
  return (
    <div className="homeBand">
      <div className="homeBandInner">
        {tags.map((tag) => (
          <div key={tag} className="homeBandTag">{tag}</div>
        ))}
      </div>
    </div>
  );
}
