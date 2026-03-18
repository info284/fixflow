"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "password" | "magic";

export default function LoginClient() {
  const [mode, setMode] = useState<Mode>("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ enable rules
  const canSubmit = useMemo(() => {
    const e = email.trim();
    if (e.length < 5) return false;
    if (mode === "magic") return true;
    return password.trim().length >= 6;
  }, [email, password, mode]);

  // ✅ completion intensity (stroke gets stronger)
  const intensity = useMemo(() => {
    let p = 0;
    if (email.trim()) p += 0.55;
    if (mode === "password" && password.trim().length >= 1) p += 0.45;
    if (mode === "magic") p += 0.25;
    return Math.max(0.65, Math.min(1.4, 0.65 + p));
  }, [email, password, mode]);

  // ✅ option 2: whole background “wash” while submitting / success
  const bgState = useMemo<"idle" | "sending" | "success">(() => {
    if (ok) return "success";
    if (loading) return "sending";
    return "idle";
  }, [ok, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (loading || !canSubmit) return;

    setLoading(true);
    setError(null);
    setOk(false);

    try {
      if (mode === "magic") {
        await sendMagicLink(email.trim());
        setOk(true);
      } else {
        await signInWithPassword(email.trim(), password);
        setOk(true);
      }
    } catch (err: any) {
      setError(err?.message || "Login failed. Please try again.");
      setOk(false);
    } finally {
      setLoading(false);
    }
  }



async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  await new Promise((r) => setTimeout(r, 800));
  window.location.href = "/dashboard";
}

async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        "https://fixflow-896m-ka2kl7gvc-anna-dowlings-projects.vercel.app/dashboard",
    },
  });

  if (error) throw error;
}
  // ------------------------------------------------------------

  const Stroke = ({ intensity = 1 }: { intensity?: number }) => {
    const a = Math.max(0.45, Math.min(1.45, intensity));
    return (
      <div
        className="absolute left-0 right-0 top-0 h-[4px]"
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

  const Wash = () => {
    if (bgState === "idle") return null;

    const color =
      bgState === "sending"
        ? "radial-gradient(circle at 20% 10%, rgba(31,111,255,0.22), transparent 55%), radial-gradient(circle at 80% 30%, rgba(31,111,255,0.14), transparent 45%)"
        : "radial-gradient(circle at 20% 10%, rgba(16,185,129,0.20), transparent 55%), radial-gradient(circle at 80% 30%, rgba(16,185,129,0.12), transparent 45%)";

    return (
      <div
        className="pointer-events-none fixed inset-0 transition-opacity duration-300"
        style={{ background: color, opacity: 1 }}
      />
    );
  };

  const Seg = ({
    active,
    children,
    onClick,
  }: {
    active?: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        // 👇 add the tactile scale here too
        "rounded-full px-3 py-1.5 text-[13px] font-semibold transition transform hover:scale-[1.01] active:scale-[0.99]",
        active
          ? "bg-blue-600 text-white shadow-[0_12px_24px_rgba(31,111,255,0.18)] hover:shadow-[0_16px_30px_rgba(31,111,255,0.28)]"
          : "bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );

  return (
    <main
      className="min-h-screen relative ff-dashboardText"
      style={{
        background:
          "radial-gradient(circle_at_20%_10%,rgba(31,111,255,0.10),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(31,111,255,0.06),transparent_40%),#f7f9fc",
}}
    >
      <Wash />

      <div className="relative mx-auto max-w-md px-4 py-14">
        {/* Brand header */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center">
            <span className="font-extrabold text-slate-800">Fix</span>
          </div>
          <div className="text-left">
            <div className="text-[12px] font-semibold text-slate-500">FixFlow</div>
            <div className="text-[16px] font-extrabold text-slate-950">Trader login</div>
          </div>
        </div>

        {/* Card */}
        <div
          className={[
            "relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur",
            "shadow-[0_2px_0_rgba(15,23,42,0.04),0_20px_45px_rgba(15,23,42,0.12)]",
          ].join(" ")}
        >
          <Stroke intensity={intensity} />

          <div
            className="pointer-events-none absolute -top-28 -right-28 h-80 w-80 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(31,111,255,0.14), transparent 60%)" }}
          />

          <form onSubmit={onSubmit} className="relative p-5">
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Log in</h1>
            <p className="mt-1 text-[14px] text-slate-600">
              Log in to manage your FixFlow enquiries and quotes.
            </p>

            {/* Mode switch */}
            <div className="mt-4 flex items-center gap-2">
              <Seg active={mode === "password"} onClick={() => setMode("password")}>
                Password
              </Seg>
              <Seg active={mode === "magic"} onClick={() => setMode("magic")}>
                Email link
              </Seg>
            </div>

            {/* Feedback */}
            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] font-semibold text-red-800">
                {error}
              </div>
            )}
            {ok && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13.5px] font-semibold text-emerald-800">
                {mode === "magic" ? "Check your email for your login link." : "Logged in — redirecting…"}
              </div>
            )}

            {/* Email */}
            <div className="mt-5">
              <label className="mb-1 block text-[13.5px] font-semibold text-slate-700">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                placeholder="you@business.com"
                className={[
                  "w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5",
                  "text-[15.5px] text-slate-900 placeholder:text-slate-400",
                  "outline-none transition",
                  "focus:ring-4 focus:ring-blue-100 focus:border-blue-300",
                ].join(" ")}
              />
            </div>

            {/* Password */}
            {mode === "password" && (
              <div className="mt-4">
                <label className="mb-1 block text-[13.5px] font-semibold text-slate-700">Password</label>

                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    type={showPw ? "text" : "password"}
                    className={[
                      "w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5 pr-16",
                      "text-[15.5px] text-slate-900 placeholder:text-slate-400",
                      "outline-none transition",
                      "focus:ring-4 focus:ring-blue-100 focus:border-blue-300",
                    ].join(" ")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between text-[13px]">
                  <a href="/forgot-password" className="text-slate-500 hover:text-slate-700">
                    Forgot password?
                  </a>
                  <a href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                    Create account
                  </a>
                </div>
              </div>
            )}

            {/* Magic mode helper row */}
            {mode === "magic" && (
              <div className="mt-3 text-[13px] text-slate-500">
                We’ll email you a secure link to log in — no password needed.
              </div>
            )}

            {/* Submit */}
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
                {loading ? (mode === "magic" ? "Sending link…" : "Logging in…") : "Log in"}
              </button>

              <div className="mt-3 text-center text-[13.5px] text-slate-500">
                By logging in, you agree to FixFlow’s{" "}
                <a href="/terms" className="font-semibold hover:text-slate-700">
                  terms
                </a>{" "}
                and{" "}
                <a href="/privacy" className="font-semibold hover:text-slate-700">
                  privacy policy
                </a>
                .
              </div>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-[13px] text-slate-500">
          Need help?{" "}
          <a className="font-semibold hover:text-slate-700" href="/support">
            Contact support
          </a>
        </div>
      </div>
    </main>
  );
}