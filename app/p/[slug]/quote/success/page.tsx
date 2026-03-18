import Link from "next/link";

export default function QuoteSuccessPage() {
return (
<div className="min-h-screen bg-gray-50 px-4 py-14">
<div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow">
<h1 className="text-2xl font-semibold">Request sent ✅</h1>
<p className="mt-2 text-sm text-gray-600">
Thanks — we’ve received your request and will be in touch shortly.
</p>

<div className="mt-6 flex gap-3">
<Link
href="/"
className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
>
Back to site
</Link>
</div>
</div>
</div>
);
}