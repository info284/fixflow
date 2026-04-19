export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function hmac(payload: string) {
  const secret = process.env.CALENDAR_STATE_SECRET || "dev-secret-change-me";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/profile?cal=error", origin)
    );
  }

  try {
    const [payloadB64, sig] = state.split(".");

    if (!payloadB64 || !sig) {
      return NextResponse.redirect(
        new URL("/dashboard/profile?cal=badstate", origin)
      );
    }

    const payload = Buffer.from(payloadB64, "base64url").toString();

    if (hmac(payload) !== sig) {
      return NextResponse.redirect(
        new URL("/dashboard/profile?cal=badstate", origin)
      );
    }

    const parsed = JSON.parse(payload);
    const userId = parsed?.uid;

    if (!userId) {
      return NextResponse.redirect(
        new URL("/dashboard/profile?cal=missing", origin)
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL("/dashboard/profile?cal=error", origin)
      );
    }

    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2.getToken(code);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.redirect(
        new URL("/dashboard/profile?cal=error", origin)
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: existingRow, error: existingError } = await supabase
      .from("google_calendar_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      console.error("calendar token fetch error:", existingError);
      return NextResponse.redirect(
        new URL("/dashboard/profile?cal=dberror", origin)
      );
    }

    const refreshTokenToSave =
      tokens.refresh_token || existingRow?.refresh_token || null;

    if (!refreshTokenToSave) {
      return NextResponse.redirect(
        new URL("/dashboard/profile?cal=notokens", origin)
      );
    }

    const { error } = await supabase
      .from("google_calendar_tokens")
      .upsert(
        {
          user_id: userId,
          access_token: tokens.access_token ?? null,
          refresh_token: refreshTokenToSave,
          expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          calendar_id: "primary",
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("calendar token save error:", error);
      return NextResponse.redirect(
        new URL("/dashboard/profile?cal=dberror", origin)
      );
    }

    return NextResponse.redirect(
      new URL("/dashboard/profile?cal=connected", origin)
    );
  } catch (error) {
    console.error("calendar callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/profile?cal=error", origin)
    );
  }
}