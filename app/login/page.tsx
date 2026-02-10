"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);

  const cleanEmail = email.trim();

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin; // works for 3000 or 3001 automatically
  }, []);

  const redirectTo = useMemo(() => {
    if (!origin) return "";
    return `${origin}/auth/callback?next=/reset-password`;
  }, [origin]);

  const callbackUrl = useMemo(() => {
    if (!origin) return "";
    return `${origin}/auth/callback`;
  }, [origin]);

  const resetUrl = useMemo(() => {
    if (!origin) return "";
    return `${origin}/reset-password`;
  }, [origin]);

  const clearAllMessages = () => {
    setMsg(null);
    setErr(null);
    setResetMsg(null);
    setResetErr(null);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    clearAllMessages();

    if (!cleanEmail || !password) {
      setErr("Enter your email and password.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setErr(error.message || "Could not sign in.");
      setBusy(false);
      return;
    }

    setMsg("Signed in! Redirecting…");
    setBusy(false);
    router.replace("/dashboard/quotes");
  };

  const handleForgotPassword = async () => {
    clearAllMessages();

    if (!cleanEmail) {
      setResetErr("Type your email first, then click Forgot password.");
      return;
    }

    if (!redirectTo) {
      setResetErr("Could not determine site URL. Refresh and try again.");
      return;
    }

    setResetBusy(true);

    // Send the user to /auth/callback first to establish a session,
    // then forward to /reset-password
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (error) {
      setResetErr(error.message || "Could not send password reset email.");
      setResetBusy(false);
      return;
    }

    setResetMsg(
      "Reset email sent. Open the link in the SAME browser to set a new password."
    );
    setResetBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-md p-6">
        <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
        <p className="text-sm text-gray-600 mb-6">
          Log in to manage your FixFlow quotes.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-green-700">{msg}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetBusy}
            className="text-sm text-blue-600 underline disabled:opacity-60"
          >
            {resetBusy ? "Sending…" : "Forgot password?"}
          </button>

          <Link href="/signup" className="text-sm text-gray-700 underline">
            Create account
          </Link>
        </div>

        {(resetErr || resetMsg) && (
          <div className="mt-4 rounded-md border bg-gray-50 p-3">
            {resetErr && <p className="text-sm text-red-600">{resetErr}</p>}
            {resetMsg && <p className="text-sm text-green-700">{resetMsg}</p>}

            <p className="mt-2 text-xs text-gray-500">
              If you don’t receive an email, check spam.
              <br />
              In Supabase → Authentication → URL Configuration, add these Redirect URLs:
              <br />
              <span className="font-mono break-all">{callbackUrl || "(loading...)"}</span>
              <br />
              <span className="font-mono break-all">{resetUrl || "(loading...)"}</span>
            </p>

            <p className="mt-2 text-xs text-gray-500">
              If the email link says “code missing” or “invalid”, request a new reset email
              and open it in the same browser where you’ll set the password.
            </p>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          Dev tip: you can always set a new password in Supabase → Authentication → Users.
        </p>
      </div>
    </div>
  );
}

