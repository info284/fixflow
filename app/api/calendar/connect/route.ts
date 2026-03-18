export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { google } from "googleapis";
import { createServerClient } from "@supabase/ssr";

function hmac(payload: string) {
const secret = process.env.CALENDAR_STATE_SECRET || "dev-secret-change-me";
return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function GET(req: Request) {
const url = new URL(req.url);
const origin = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;

const cookieStore = await cookies();

// ✅ Supabase server client (reads auth from cookies)
const supabase = createServerClient(
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

const { data } = await supabase.auth.getUser();
const user = data.user;

if (!user) {
return NextResponse.redirect(new URL("/login", origin));
}

const clientId = process.env.GOOGLE_CLIENT_ID!;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/calendar/callback`;

if (!clientId || !clientSecret || !redirectUri) {
return NextResponse.json(
{ ok: false, error: "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI" },
{ status: 500 }
);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// ✅ Signed state we can verify in callback
const payload = JSON.stringify({
uid: user.id,
ts: Date.now(),
nonce: crypto.randomBytes(12).toString("hex"),
});

const state = `${Buffer.from(payload).toString("base64url")}.${hmac(payload)}`;

// store state for callback verification
cookieStore.set({
name: "ff_cal_state",
value: state,
httpOnly: true,
sameSite: "lax",
secure: origin.startsWith("https"), // secure only when https
path: "/",
maxAge: 10 * 60,
});

const authUrl = oauth2.generateAuthUrl({
access_type: "offline",
prompt: "consent",
scope: ["https://www.googleapis.com/auth/calendar"],
state,
});

return NextResponse.redirect(authUrl);
}