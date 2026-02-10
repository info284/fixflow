export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { google } from "googleapis";
import { supabaseServer } from "@/lib/supabaseServer";

function signState(payload: string) {
  const secret = process.env.CALENDAR_STATE_SECRET || "dev-secret";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyState(state: string) {
  const decoded = Buffer.from(state, "base64url").toString("utf8");
  const parts = decoded.split("|");
  if (parts.length !== 4) throw new Error("Bad state");

  const [userId, expStr, nonce, sig] = parts;
  const payload = `${userId}|${expStr}|${nonce}`;
  const expected = signState(payload);

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error("Invalid state signature");
  }

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) throw new Error("State expired");

  return { userId };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (err) return NextResponse.redirect(new URL(`/dashboard/profile?cal=error`, appOrigin));
  if (!code || !state) return NextResponse.redirect(new URL(`/dashboard/profile?cal=missing`, appOrigin));

  let userIdFromState: string;
  try {
    userIdFromState = verifyState(state).userId;
  } catch {
    return NextResponse.redirect(new URL(`/dashboard/profile?cal=badstate`, appOrigin));
  }

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  // Must be logged in (cookie session) and match the state userId
  if (!data.user || data.user.id !== userIdFromState) {
    return NextResponse.redirect(new URL(`/login`, appOrigin));
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const tokenRes = await oauth2.getToken(code);
  const tokens = tokenRes.tokens;

  const expiresAt =
    tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

  // Upsert into calendar_accounts (RLS allows user to upsert their own)
  const { error } = await supabase
    .from("calendar_accounts")
    .upsert(
      {
        user_id: data.user.id,
        provider: "google",
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        scope: tokens.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/profile?cal=dberror`, appOrigin));
  }

  return NextResponse.redirect(new URL(`/dashboard/profile?cal=connected`, appOrigin));
}
