export const runtime = "nodejs";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Profile = {
id: string;
slug: string | null;
display_name: string | null;
headline: string | null;
logo_url: string | null;
};

function supabasePublic() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
{ auth: { persistSession: false } }
);
}

export default async function ProPage({
params,
}: {
params: Promise<{ slug: string }>;
}) {
const { slug } = await params;

const supabase = supabasePublic();

const { data: profile, error } = await supabase
.from("profiles")
.select("id, slug, display_name, headline, logo_url")
.eq("slug", slug)
.maybeSingle();

if (error) {
return (
<div className="min-h-screen bg-gray-50 px-4 py-10">
<div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow">
<p className="text-sm text-red-600">Load error: {error.message}</p>
</div>
</div>
);
}

if (!profile) {
return (
<div className="min-h-screen bg-gray-50 px-4 py-10">
<div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow">
<h1 className="text-xl font-semibold">Trader not found</h1>
<p className="mt-2 text-sm text-gray-600">
No profile found for: <span className="font-mono">{slug}</span>
</p>
<div className="mt-4">
<Link href="/" className="text-sm text-blue-600 underline">
Back to home
</Link>
</div>
</div>
</div>
);
}

const p = profile as Profile;
const title = p.display_name || "Trader";
const headline = p.headline || "Get a quote in minutes";

return (
<div className="min-h-screen bg-gray-50 px-4 py-10">
<div className="mx-auto max-w-2xl">
<div className="rounded-2xl bg-white p-6 shadow">
<div className="flex items-start gap-3">
<div className="h-14 w-14 rounded-xl border bg-gray-50 overflow-hidden flex items-center justify-center">
{p.logo_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={p.logo_url}
alt={title}
className="h-full w-full object-cover"
/>
) : (
<span className="text-lg font-semibold text-gray-700">
{title.charAt(0).toUpperCase()}
</span>
)}
</div>

<div className="min-w-0">
<h1 className="text-2xl font-semibold">{title}</h1>
<p className="text-sm text-gray-600">{headline}</p>

<div className="mt-3 flex flex-wrap gap-2">
<Link
href={`/p/${p.slug}/quote`}
className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
>
Request a quote
</Link>

<Link
href="/browse"
className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
>
Browse more
</Link>
</div>
</div>
</div>
</div>

<p className="mt-4 text-xs text-gray-500">Powered by FixFlow</p>
</div>
</div>
);
}