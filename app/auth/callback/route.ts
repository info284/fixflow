export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/dashboard/profile";

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;

  const supabase = await supabaseServer();

  try {
    // PKCE/code flow (OAuth + some Supabase flows)
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return NextResponse.redirect(new URL(next, origin));
    }

    // Recovery flow (password reset links)
    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type: type as any,
        token_hash,
      });
      if (error) throw error;
      return NextResponse.redirect(new URL(next, origin));
    }

    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  } catch (e) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", origin)
    );
  }
}
