// app/components/home/HomeFooter.tsx
import Link from "next/link";
import { Instagram, Facebook } from "lucide-react";

const links = [
{ label: "How it works", href: "#why" },
{ label: "Pricing", href: "#pricing" },
{ label: "FAQ", href: "#faq" },
{ label: "Privacy", href: "/privacy" },
{ label: "Terms", href: "/terms" },
];

const socials = [
{ label: "Instagram", href: "https://instagram.com/thefixflowapp", Icon: Instagram },
{ label: "Facebook", href: "https://facebook.com/Thefixflowapp", Icon: Facebook },
];

export default function HomeFooter() {
return (
<footer className="homeFooter">
<div className="homeFooterInner homeContainer">
<div>
<div className="homeFooterLogo">
<img src="/fixflow-logo.png" alt="FixFlow" style={{ height: '32px', width: 'auto' }} />
</div>
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

<div className="homeFooterSocials" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
{socials.map(({ label, href, Icon }) => (
<a
key={label}
href={href}
target="_blank"
rel="noopener noreferrer"
aria-label={label}
>
<Icon
style={{ width: '20px', height: '20px' }}
className="homeFooterSocialIcon"
/>
</a>
))}
</div>

<div className="homeFooterCopy">
© 2026 FixFlow Software Ltd
</div>
</div>
</footer>
);
}