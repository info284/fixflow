export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

type TokenRow = {
user_id: string;
access_token: string | null;
refresh_token: string | null;
expires_at: string | null; // ISO
};

function getAdminSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service =
process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
if (!url || !service) {
throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE)");
}
return createClient(url, service, { auth: { persistSession: false } });
}

function getAuthSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
return createClient(url, anon, { auth: { persistSession: false } });
}

function bearerToken(req: Request) {
const h = req.headers.get("authorization") || "";
const m = h.match(/^Bearer\s+(.+)$/i);
return m?.[1] || "";
}

function asISO(d: any) {
const dt = new Date(d);
if (Number.isNaN(dt.getTime())) return null;
return dt.toISOString();
}

export async function POST(req: Request) {
try {
// 1) Auth: must be logged-in trader (Bearer token from client)
const token = bearerToken(req);
if (!token) {
return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
}

const authSb = getAuthSupabase();
const { data: u, error: uErr } = await authSb.auth.getUser(token);
const user = u?.user;

if (uErr || !user) {
return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
}

// 2) Parse body
const body = await req.json().catch(() => null);

const startISO = body?.startISO as string | undefined;
const durationMinutes = Number(body?.durationMinutes ?? 60);
const summary = (body?.summary as string | undefined) || "Site visit";
const description = (body?.description as string | undefined) || "";
const attendeeEmail = (body?.attendeeEmail as string | undefined) || "";
const location = (body?.location as string | undefined) || "";

const start = asISO(startISO);
if (!start) {
return NextResponse.json({ ok: false, error: "Missing/invalid startISO" }, { status: 400 });
}

const mins = Number.isFinite(durationMinutes)
? Math.max(15, Math.min(durationMinutes, 8 * 60))
: 60;

const end = new Date(new Date(start).getTime() + mins * 60 * 1000).toISOString();

// 3) Load Google tokens (✅ use the table you actually have)
const TOKENS_TABLE = "google_calendar_tokens";

const admin = getAdminSupabase();
const { data: tokenRow, error: tErr } = await admin
.from(TOKENS_TABLE)
.select("user_id, access_token, refresh_token")
.eq("user_id", user.id)
.maybeSingle();

if (tErr) {
return NextResponse.json(
{ ok: false, error: `Token lookup failed: ${tErr.message}` },
{ status: 500 }
);
}

const tr = (tokenRow || null) as TokenRow | null;

if (!tr?.refresh_token) {
return NextResponse.json(
{ ok: false, error: "Google Calendar is not connected for this trader." },
{ status: 400 }
);
}

// 4) Google OAuth client
const clientId = process.env.GOOGLE_CLIENT_ID!;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
if (!clientId || !clientSecret || !redirectUri) {
return NextResponse.json({ ok: false, error: "Missing Google OAuth env vars" }, { status: 500 });
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
oauth2.setCredentials({
access_token: tr.access_token || undefined,
refresh_token: tr.refresh_token || undefined,
});

// Persist refreshed access tokens when Google rotates them
oauth2.on("tokens", async (tokens) => {
try {
const updates: any = {};
if (tokens.access_token) updates.access_token = tokens.access_token;
if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;
if (Object.keys(updates).length) {
await admin.from(TOKENS_TABLE).update(updates).eq("user_id", user.id);
}
} catch {
// ignore
}
});

const calendar = google.calendar({ version: "v3", auth: oauth2 });

// 5) Build event (+ guest)
const attendee = attendeeEmail.trim();
const attendees = attendee ? [{ email: attendee }] : undefined;

const event = {
summary,
description,
location: location || undefined,
start: { dateTime: start },
end: { dateTime: end },
attendees,
conferenceData: {
createRequest: {
requestId: `ff-${user.id}-${Date.now()}`,
conferenceSolutionKey: { type: "hangoutsMeet" },
},
},
};

// 6) Insert event (+ send email invite)
const created = await calendar.events.insert({
calendarId: "primary",
requestBody: event as any,
sendUpdates: attendees ? "all" : "none",
conferenceDataVersion: 1,
});

return NextResponse.json({
ok: true,
eventId: created.data.id,
htmlLink: created.data.htmlLink,
start,
end,
invited: attendees?.map((a) => a.email) || [],
});
} catch (e: any) {
return NextResponse.json(
{ ok: false, error: e?.message || "Create event failed" },
{ status: 500 }
);
}
}
