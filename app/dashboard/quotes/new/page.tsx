"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewQuotePage() {
const router = useRouter();
const sp = useSearchParams();
const requestId = sp.get("requestId") || "";

return (
<div className="mx-auto max-w-[1100px] p-4">
<div className="rounded-xl border border-gray-200 bg-white p-4">
<div className="flex items-center justify-between gap-3">
<div>
<h1 className="text-lg font-semibold">Create estimate</h1>
<p className="text-sm text-gray-600">
This page creates an estimate from an enquiry.
</p>
<p className="mt-1 text-xs text-gray-500">
requestId: {requestId || "—"}
</p>
</div>

<button
type="button"
onClick={() => router.push("/dashboard/quotes")}
className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
>
Back to estimates
</button>
</div>

<div className="mt-4 text-sm text-gray-700">
{/* TODO: paste your estimate form UI here */}
Your estimate form goes here.
</div>
</div>
</div>
);
}