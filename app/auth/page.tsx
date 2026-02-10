"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";






export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

async function signIn() {
  setMsg(null);
  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) setMsg(error.message);
  else setMsg("Check your email for a sign-in link.");
}



  async function signOut() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setMsg("Signed out.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>Sign in</h1>

      {userEmail ? (
        <>
          <p>Signed in as <b>{userEmail}</b></p>
          <button onClick={signOut} style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>Sign out</button>
        </>
      ) : (
        <>
          <input
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          <button onClick={signIn} disabled={!email.includes("@")} style={{ marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>
            Send magic link
          </button>
        </>
      )}

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
