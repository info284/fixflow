"use client";

import "@/app/globals.css";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findAvailableSlug(base: string) {
  const cleanBase = slugify(base);
  if (!cleanBase) return null;

  for (let i = 1; i <= 10; i++) {
    const candidate = i === 1 ? cleanBase : `${cleanBase}-${i}`;

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!error && !data) return candidate;
  }

  return `${cleanBase}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewSlug = useMemo(
    () => slugify(businessName || "your-business"),
    [businessName]
  );

  const canSubmit = useMemo(() => {
    return (
      email.trim().length >= 5 &&
      password.trim().length >= 6 &&
      businessName.trim().length >= 2
    );
  }, [email, password, businessName]);

  const intensity = useMemo(() => {
    let p = 0;
    if (email.trim()) p += 0.35;
    if (password.trim()) p += 0.3;
    if (businessName.trim()) p += 0.35;
    return Math.max(0.65, Math.min(1.4, 0.65 + p));
  }, [email, password, businessName]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    if (loading || !canSubmit) return;

    setLoading(true);
    setErrorMsg(null);
    setOk(false);

    try {
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

      if (signUpError) throw signUpError;

      const userId = signUpData.user?.id;
      if (!userId) throw new Error("Signup worked, but user ID was missing.");

      const slug = await findAvailableSlug(businessName);
      if (!slug) throw new Error("Could not create your branded link.");

      const profileRes = await fetch("/api/signup/create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          businessName,
          slug,
          email: email.trim(),
        }),
      });

      const profileJson = await profileRes.json().catch(() => ({}));

      if (!profileRes.ok) {
        throw new Error(profileJson?.error || "Could not create profile");
      }

await fetch("/api/onboarding/send-welcome", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: email.trim(),
    businessName: businessName.trim(),
    publicUrl: `https://thefixflowapp.com/p/${slug}/quote`,
  }),
}).catch((err) => {
  console.error("Welcome email failed:", err);
});

setOk(true);

const checkoutRes = await fetch("/api/stripe/subscription/checkout", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: email.trim(),
    userId,
  }),
});

const checkoutJson = await checkoutRes.json().catch(() => ({}));

if (!checkoutRes.ok || !checkoutJson?.url) {
  throw new Error(checkoutJson?.error || "Could not start free trial");
}

window.location.href = checkoutJson.url;
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
      setOk(false);
    } finally {
      setLoading(false);
    }
  }

  const Stroke = ({ intensity = 1 }: { intensity?: number }) => {
    const a = Math.max(0.45, Math.min(1.45, intensity));

    return (
      <div
        className="absolute left-0 right-0 top-0 h-[5px]"
        style={{
          background: `linear-gradient(90deg,
            rgba(31,111,255,${0.98 * a}),
            rgba(31,111,255,${0.48 * a}),
            rgba(31,111,255,${0.10 * a})
          )`,
        }}
      />
    );
  };

  return (
    <main
      className="min-h-screen relative ff-dashboardText"
      style={{
        background:
          "radial-gradient(circle_at_20%_10%,rgba(31,111,255,0.10),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(31,111,255,0.06),transparent_40%),#f7f9fc",
      }}
    >
      <div className="relative mx-auto max-w-md px-4 py-14">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center">
            <span className="font-extrabold text-slate-800">Fix</span>
          </div>

          <div className="text-left">
            <div className="text-[12px] font-semibold text-slate-500">
              FixFlow
            </div>
            <div className="text-[16px] font-extrabold text-slate-950">
              Trader signup
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur shadow-[0_2px_0_rgba(15,23,42,0.04),0_20px_45px_rgba(15,23,42,0.12)]">
          <Stroke intensity={intensity} />

          <div
            className="pointer-events-none absolute -top-28 -right-28 h-80 w-80 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(31,111,255,0.14), transparent 60%)",
            }}
          />

          <form onSubmit={handleSignup} className="relative p-5">
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">
              Create account
            </h1>

            <p className="mt-1 text-[14px] text-slate-600">
             Set up your FixFlow workspace. 60 days free, then £29/month.

            </p>

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] font-semibold text-red-800">
                {errorMsg}
              </div>
            )}

            {ok && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13.5px] font-semibold text-emerald-800">
               Account created — taking you to your free trial…
              </div>
            )}

            <div className="mt-5">
              <label className="mb-1 block text-[13.5px] font-semibold text-slate-700">
                Email
              </label>

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                type="email"
                placeholder="you@business.com"
                className="w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5 text-[15.5px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-[13.5px] font-semibold text-slate-700">
                Password
              </label>

              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  type={showPw ? "text" : "password"}
                  placeholder="Create a secure password"
                  className="w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5 pr-16 text-[15.5px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
                />

                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-[13.5px] font-semibold text-slate-700">
                Business name
              </label>

              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                type="text"
                placeholder="Smith Plumbing"
                className="w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5 text-[15.5px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
              />

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
                Your quote link will be{" "}
                <span className="font-extrabold text-slate-900">
                  thefixflowapp.com/p/{previewSlug}/quote
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className={[
                  "w-full rounded-2xl px-6 py-4 text-[15.5px] font-extrabold text-white",
                  "bg-gradient-to-r from-blue-600 to-blue-500 shadow-[0_12px_24px_rgba(31,111,255,0.18)]",
                  "hover:bg-blue-700 transition transform hover:scale-[1.01] active:scale-[0.99]",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none",
                ].join(" ")}
              >
                {loading ? "Creating account…" : "Start 60-day free trial"}
              </button>

              <div className="mt-3 text-center text-[13.5px] text-slate-500">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Log in
                </a>
              </div>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-[13px] text-slate-500">
          By signing up, you agree to FixFlow’s{" "}
          <a className="font-semibold hover:text-slate-700" href="/terms">
            terms
          </a>{" "}
          and{" "}
          <a className="font-semibold hover:text-slate-700" href="/privacy">
            privacy policy
          </a>
          , including how FixFlow stores trader and customer enquiry data.
        </div>
      </div>
    </main>
  );
}