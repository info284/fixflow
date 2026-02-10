"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
business_name: string | null;
slug: string | null;
};

function SmallCard({
title,
children,
span = 1,
}: {
title: string;
children: React.ReactNode;
span?: 1 | 2 | 3 | 4;
}) {
return (
<div
style={{
border: "1px solid #E5E7EB",
borderRadius: 14,
padding: 16,
background: "#FFFFFF",
gridColumn: `span ${span}`,
minHeight: 92,
}}
>
<div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>
{title}
</div>
{children}
</div>
);
}

function Stat({
value,
sub,
}: {
value: string | number;
sub?: string;
}) {
return (
<>
<div style={{ fontSize: 28, fontWeight: 800, color: "#0B1C2D", lineHeight: 1 }}>
{value}
</div>
{sub ? (
<div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
{sub}
</div>
) : null}
</>
);
}

function TopFrontDoorBar({ profile, loading }: { profile: Profile; loading: boolean }) {
const slug = profile.slug;
const publicLink = slug ? `https://thefixflowapp.com/${slug}` : null;
const qrUrl = slug ? `/api/qr?slug=${encodeURIComponent(slug)}` : null;

return (
<div
style={{
border: "1px solid #E5E7EB",
borderRadius: 14,
padding: 14,
background: "#FFFFFF",
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 14,
flexWrap: "wrap",
marginBottom: 12, // sits above the small cards
}}
>
<div style={{ minWidth: 320 }}>
<div style={{ fontSize: 12, color: "#64748B" }}>
Trader link + QR code
</div>

{loading ? (
<div style={{ marginTop: 6, fontSize: 13, color: "#64748B" }}>
Loading…
</div>
) : publicLink && qrUrl ? (
<>
<div
style={{
marginTop: 6,
display: "flex",
gap: 10,
alignItems: "center",
flexWrap: "wrap",
}}
>
<code
style={{
background: "#F7F9FC",
border: "1px solid #E5E7EB",
padding: "8px 10px",
borderRadius: 10,
fontSize: 12,
}}
>
{publicLink}
</code>

<button
onClick={() => navigator.clipboard.writeText(publicLink)}
style={{
padding: "8px 12px",
borderRadius: 10,
background: "#1F6FFF",
color: "#FFFFFF",
border: "none",
cursor: "pointer",
fontWeight: 700,
fontSize: 13,
}}
>
Copy
</button>

<a
href={qrUrl}
download={`${slug}-fixflow-qr.png`}
style={{ color: "#1F6FFF", fontSize: 13 }}
>
Download QR
</a>
</div>

<div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
Put this on Google, website, vans & cards.
</div>
</>
) : (
<div style={{ marginTop: 6, fontSize: 13, color: "#991B1B" }}>
Branded link not set up yet (no slug found).
</div>
)}
</div>

{qrUrl ? (
<img
src={qrUrl}
alt="FixFlow QR code"
width={72}
height={72}
style={{
borderRadius: 12,
border: "1px solid #E5E7EB",
background: "#FFFFFF",
}}
/>
) : (
<div
style={{
width: 72,
height: 72,
borderRadius: 12,
border: "1px dashed #E5E7EB",
background: "#F7F9FC",
}}
/>
)}
</div>
);
}

export default function DashboardPage() {
const [loading, setLoading] = useState(true);
const [profile, setProfile] = useState<Profile>({ business_name: null, slug: null });

// Keep your existing stats (wire to real tables later if you want)
const stats = {
newRequests: 6,
requestsTotal: 10,
quotes: 0,
bookings: 0,
invoices: 4,
revenueThisMonth: "—",
lastActivity: "4h ago",
lastLogin: "5d ago",
};

useEffect(() => {
async function load() {
setLoading(true);

const { data: auth } = await supabase.auth.getUser();
const user = auth?.user;

if (!user) {
setLoading(false);
return;
}

// Change table name if yours isn’t profiles
const { data, error } = await supabase
.from("profiles")
.select("business_name, slug")
.eq("id", user.id)
.single();

if (!error && data) {
setProfile({
business_name: data.business_name ?? null,
slug: data.slug ?? null,
});
}

setLoading(false);
}

load();
}, []);

return (
<div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
<div style={{ marginBottom: 14 }}>
<div style={{ fontSize: 26, fontWeight: 800, color: "#0B1C2D" }}>
Dashboard
</div>
<div style={{ fontSize: 13, color: "#64748B" }}>
Quick overview of what needs attention.
</div>
</div>

{/* ✅ NEW: Trader link + QR bar at the TOP */}
<TopFrontDoorBar profile={profile} loading={loading} />

{/* ✅ The same small card layout */}
<div
style={{
display: "grid",
gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
gap: 12,
}}
>
{/* Row 1 */}
<SmallCard title="New requests">
<Stat value={stats.newRequests} sub={`Total: ${stats.requestsTotal}`} />
</SmallCard>

<SmallCard title="Quotes">
<Stat value={stats.quotes} sub="Sent / active quotes" />
</SmallCard>

<SmallCard title="Bookings">
<Stat value={stats.bookings} sub="Upcoming / scheduled" />
</SmallCard>

<SmallCard title="Invoices">
<Stat value={stats.invoices} sub="Total created" />
</SmallCard>

{/* Row 2 */}
<SmallCard title="Revenue this month" span={2}>
<div style={{ fontSize: 22, fontWeight: 800, color: "#0B1C2D" }}>
{stats.revenueThisMonth}
</div>
<div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
Based on invoices created this month (best effort).
</div>
</SmallCard>

<SmallCard title="Last activity">
<div style={{ fontSize: 22, fontWeight: 800, color: "#0B1C2D" }}>
{stats.lastActivity}
</div>
<div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
Latest request / quote / booking / invoice activity.
</div>
</SmallCard>

<SmallCard title="You last logged in">
<div style={{ fontSize: 22, fontWeight: 800, color: "#0B1C2D" }}>
{stats.lastLogin}
</div>
<div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
From Supabase auth.
</div>
</SmallCard>
</div>

{/* Responsive: switch to 2 columns on small screens */}
<style jsx>{`
@media (max-width: 900px) {
div[style*="grid-template-columns: repeat(4"] {
grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}
}
`}</style>
</div>
);
}
