"use client";

import Link from "next/link";

export default function SubscribePage() {
  return (
    <main className="min-h-screen grid place-items-center bg-[var(--bg)] px-4">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <img
          src="/fixflow-logo.png"
          alt="FixFlow"
          className="mx-auto h-14 w-14 object-contain"
        />

        <h1 className="mt-4 text-2xl font-bold text-[var(--ff-navy)]">
          Complete your free trial
        </h1>

        <p className="mt-3 text-sm text-slate-600">
          Your FixFlow account is ready. Start your free trial to unlock your
          dashboard.
        </p>

        <Link
          href="/signup"
          className="mt-6 inline-flex w-full justify-center rounded-2xl bg-[var(--ff-navy)] px-5 py-3 text-sm font-semibold text-white"
        >
          Start free trial
        </Link>

        <Link
          href="/"
          className="mt-4 block text-sm font-semibold text-slate-500"
        >
          Back to website
        </Link>
      </div>
    </main>
  );
}