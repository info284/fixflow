"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      try {
        const code = search.get("code");
        const token_hash = search.get("token_hash");
        const type = search.get("type"); // e.g. "recovery"
        const next = search.get("next") || "/reset-password";

        // ✅ Handles PKCE/code links
        if (code) {
          setMsg("Finishing sign-in…");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          router.replace(next);
          return;
        }

        // ✅ Handles reset-password links (token_hash + type=recovery)
        if (token_hash && type) {
          setMsg("Verifying recovery link…");
          const { error } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash,
          });
          if (error) throw error;

          router.replace(next);
          return;
        }

        // If neither param exists, link is malformed or stripped
        setMsg("This link is missing required information. Please request a new reset link.");
        router.replace("/login?error=missing_code");
      } catch (e: any) {
        console.error("Auth callback error:", e?.message || e);
        router.replace("/login?error=auth_callback_failed");
      }
    };

    run();
  }, [router, search]);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold mb-2">FixFlow</h1>
      <p className="text-sm text-gray-600">{msg}</p>
    </div>
  );
}

