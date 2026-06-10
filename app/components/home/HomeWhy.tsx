// app/components/home/HomeWhy.tsx

const cards = [
  {
    title: "Forgotten quotes",
    body: "A customer asks for a price, waits too long, then books someone who responded faster. The job was yours to lose.",
  },
  {
    title: "Lost details",
    body: "Addresses, plans and customer notes buried across texts, emails, WhatsApp and paper. Nothing where you need it when you need it.",
  },
  {
    title: "Slow follow-up",
    body: "Customers are ready to book, but slow replies and no updates make the business look disorganised. They move on.",
  },
];

export default function HomeWhy() {
  return (
    <section id="why" className="homeSection">
      <div className="homeContainer">
        <div className="homeSectionHeader">
          <span className="homeEyebrow">Why FixFlow exists</span>
          <h2>You don&apos;t need more leads.<br />You need to stop losing the ones you have.</h2>
          <p>Most trades don&apos;t lose jobs because they&apos;re bad at the trade. They lose them because the business side breaks down.</p>
        </div>

        <div className="homeWhyGrid">
          {cards.map((card) => (
            <div key={card.title} className="homeWhyCard">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
