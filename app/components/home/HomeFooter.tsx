// app/components/home/HomeFooter.tsx
import Link from "next/link";

const links = [
  { label: "How it works", href: "#why" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export default function HomeFooter() {
  return (
    <footer className="homeFooter">
      <div className="homeFooterInner homeContainer">
        <div>
          <div className="homeFooterLogo">FixFlow</div>
          <div className="homeFooterEmail">
            hello@thefixflowapp.com
          </div>
        </div>

        <div className="homeFooterLinks">
          {links.map((l) => (
            <Link key={l.label} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="homeFooterCopy">
          © 2026 FixFlow Software Ltd
        </div>
      </div>
    </footer>
  );
}