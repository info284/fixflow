"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      setChecking(true);
      setMsg(null);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("getSession error:", error.message);
        setHasSession(false);
        setMsg("Could not verify your session. Please request a new reset link.");
        setChecking(false);
        return;
      }

      if (!data.session) {
        setHasSession(false);
        setMsg(
          "This reset link is no longer valid (or was opened in a different browser). Please request a new reset link."
        );
        setChecking(false);
        return;
      }

      setHasSession(true);
      setChecking(false);
    };

    check();

    // If session changes while user is on page, keep UI accurate
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async () => {
    setMsg(null);

    if (!hasSession) {
      setMsg("No active reset session. Please request a new reset link.");
      return;
    }

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error("updateUser error:", error.message);
      setMsg(error.message || "Could not update password.");
      setBusy(false);
      return;
    }

    setMsg("Password updated ✅ Redirecting to dashboard…");
    setBusy(false);

    router.replace("/dashboard/quotes");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-md p-6">
        <h1 className="text-2xl font-semibold mb-2">Set a new password</h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter your new password below.
        </p>

        {checking ? (
          <p className="text-sm text-gray-600">Checking…</p>
        ) : !hasSession ? (
          <div className="rounded-md border bg-gray-50 p-4">
            <p className="text-sm text-gray-700 mb-3">{msg}</p>
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Go to login
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                New password
              </label>
              <input
                type="password"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Confirm password
              </label>
              <input
                type="password"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {msg && <p className="text-sm text-gray-700">{msg}</p>}

            <button
              onClick={handleUpdate}
              disabled={busy}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-4">
          Tip: open the reset link in the same browser where you’ll set the new
          password.
        </p>
      </div>
    </div>
  );
}

