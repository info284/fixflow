"use client";

export default function FrontDoorPage() {
// TEMP: replace with real data from Supabase auth/profile
const slug = "smith-plumbing";

const publicLink = `https://thefixflowapp.com/${slug}`;
const qrPng = `/api/qr?slug=${slug}`;
const qrSvg = `/api/qr-svg?slug=${slug}`;

return (
<div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
<h1 style={{ fontSize: 28, marginBottom: 8 }}>
Your FixFlow front door
</h1>

<p style={{ color: "#64748B", marginBottom: 24 }}>
This is how customers contact you. Use this everywhere you would
normally share your phone number.
</p>

{/* Branded link */}
<div style={{
border: "1px solid #E5E7EB",
borderRadius: 12,
padding: 16,
marginBottom: 24
}}>
<h2 style={{ marginBottom: 8 }}>Your FixFlow link</h2>

<div style={{
display: "flex",
gap: 12,
alignItems: "center",
flexWrap: "wrap"
}}>
<code style={{
background: "#F7F9FC",
padding: "8px 12px",
borderRadius: 6
}}>
{publicLink}
</code>

<button
onClick={() => navigator.clipboard.writeText(publicLink)}
style={{
padding: "8px 14px",
borderRadius: 6,
background: "#1F6FFF",
color: "#FFFFFF",
border: "none",
cursor: "pointer"
}}
>
Copy link
</button>
</div>
</div>

{/* QR code */}
<div style={{
border: "1px solid #E5E7EB",
borderRadius: 12,
padding: 16
}}>
<h2 style={{ marginBottom: 8 }}>Your personal QR code</h2>

<p style={{ color: "#64748B", marginBottom: 16 }}>
Put this on your van, business cards, or signage so customers can
request a quote instantly.
</p>

<img
src={qrPng}
alt="FixFlow QR code"
width={180}
height={180}
style={{ marginBottom: 16 }}
/>

<div style={{ display: "flex", gap: 12 }}>
<a href={qrPng} download={`${slug}-qr.png`}>
Download PNG
</a>

<a href={qrSvg} download={`${slug}-qr.svg`}>
Download SVG
</a>
</div>
</div>
</div>
);
}