export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
return NextResponse.redirect(new URL("/dashboard/inbox?calendar=error", origin));
}

// ✅ Verify state
const [payloadB64, sig] = state.split(".");
const payload = Buffer.from(payloadB64, "base64url").toString();
if (hmac(payload) !== sig) {
return NextResponse.redirect(new URL("/dashboard/inbox?calendar=badstate", origin));
}

const parsed = JSON.parse(payload);
const userId = parsed.uid;

const oauth2 = new google.auth.OAuth2(
process.env.GOOGLE_CLIENT_ID!,
process.env.GOOGLE_CLIENT_SECRET!,
process.env.GOOGLE_REDIRECT_URI!
);

// ✅ Exchange code for tokens
const { tokens } = await oauth2.getToken(code);

if (!tokens.refresh_token) {
return NextResponse.redirect(new URL("/dashboard/inbox?calendar=notokens", origin));
}

// ✅ SAVE TOKENS
const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!,
{ auth: { persistSession: false } }
);

await supabase.from("google_calendar_tokens").upsert({
user_id: userId,
access_token: tokens.access_token,
refresh_token: tokens.refresh_token,
expires_at: tokens.expiry_date
? new Date(tokens.expiry_date).toISOString()
: null,
});

return NextResponse.redirect(
new URL("/dashboard/inbox?calendar=connected", origin)
);
}
