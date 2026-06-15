// app/components/home/HomeFAQ.tsx

const faqs = [
 {
   q: "How much does FixFlow cost?",
   a: "Every account includes a 60-day free trial. After that, FixFlow is £29/month with everything included — enquiries, customer messaging, estimates, jobs, invoices, card payments and reviews.",
 },
 {
   q: "How do enquiries get into FixFlow?",
   a: "Customers can submit enquiries through your personal FixFlow link, which you can share on your website, social media, Google Business Profile, business cards, vans or QR codes. You can also add enquiries manually or simply forward customer emails into FixFlow to keep everything in one place.",
 },
 {
   q: "Do customers need an app?",
   a: "No. Customers simply use your enquiry link from any phone, tablet or computer. No downloads, accounts or apps required.",
 },
 {
   q: "Does FixFlow work on mobile?",
   a: "Yes. FixFlow is built for trades on the move and works on phones, tablets and desktop devices.",
 },
 {
   q: "Can I send invoices and take card payments?",
   a: "Yes. Create branded invoices, send them to customers and accept secure card payments through Stripe. Payments are linked back to the original job automatically.",
 },
 {
   q: "Can I cancel anytime?",
   a: "Yes. There are no contracts and you can cancel your subscription at any time.",
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

