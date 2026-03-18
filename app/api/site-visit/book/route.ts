export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

/* ---------------- helpers ---------------- */
function pad(n: number) {
 return String(n).padStart(2, "0");
}

function toUtcIcs(dtLocal: string) {
 // NOTE: dtLocal is "YYYY-MM-DDTHH:mm" from <input type="datetime-local">
 // new Date(dtLocal) is treated as LOCAL time by Node and then we convert to UTC for ICS.
 const d = new Date(dtLocal);
 const yyyy = d.getUTCFullYear();
 const mm = pad(d.getUTCMonth() + 1);
 const dd = pad(d.getUTCDate());
 const hh = pad(d.getUTCHours());
 const mi = pad(d.getUTCMinutes());
 const ss = pad(d.getUTCSeconds());
 return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function addMinutes(dtLocal: string, mins: number) {
 const d = new Date(dtLocal);
 d.setMinutes(d.getMinutes() + mins);
 return d;
}

function buildIcs(opts: {
 uid: string;
 title: string;
 description: string;
 location?: string;
 startLocal: string;
 durationMins: number;
}) {
 const dtStart = toUtcIcs(opts.startLocal);

 const end = addMinutes(opts.startLocal, opts.durationMins);
 const dtEnd = `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}T${pad(
 end.getUTCHours()
 )}${pad(end.getUTCMinutes())}${pad(end.getUTCSeconds())}Z`;

 // dtstamp should be "now" in UTC, not derived from ISO string using toUtcIcs
 const now = new Date();
 const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
 now.getUTCHours()
 )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

 const lines = [
 "BEGIN:VCALENDAR",
 "VERSION:2.0",
 "PRODID:-//FixFlow//Site Visit//EN",
 "CALSCALE:GREGORIAN",
 "METHOD:REQUEST",
 "BEGIN:VEVENT",
 `UID:${opts.uid}`,
 `DTSTAMP:${dtStamp}`,
 `DTSTART:${dtStart}`,
 `DTEND:${dtEnd}`,
 `SUMMARY:${opts.title}`,
 opts.location ? `LOCATION:${opts.location.replace(/\n/g, " ")}` : "",
 `DESCRIPTION:${opts.description.replace(/\n/g, "\\n")}`,
 "END:VEVENT",
 "END:VCALENDAR",
 ].filter(Boolean);

 return lines.join("\r\n");
}

function jsonError(status: number, error: string, detail?: string, extra?: any) {
 return NextResponse.json({ ok: false, error, detail: detail || "", ...extra }, { status });
}

/* ---------------- route ---------------- */
export async function POST(req: Request) {
 try {
 const body = await req.json().catch(() => ({}));
 const requestId = String(body?.requestId || "").trim();
 const startsAtLocal = String(body?.startsAtLocal || "").trim(); // "YYYY-MM-DDTHH:mm"
 const plumberId = String(body?.plumberId || "").trim();
 const mins = Number(body?.durationMins || 60);

 if (!requestId || !startsAtLocal || !plumberId) {
 return jsonError(400, "Missing fields", "requestId, startsAtLocal, plumberId are required");
 }
 if (!Number.isFinite(mins) || mins <= 0 || mins > 8 * 60) {
 return jsonError(400, "Invalid durationMins", "Must be a number between 1 and 480");
 }

 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

 if (!url) return jsonError(500, "Server misconfigured", "Missing NEXT_PUBLIC_SUPABASE_URL");
 if (!serviceKey) return jsonError(500, "Server misconfigured", "Missing SUPABASE_SERVICE_ROLE_KEY");

 const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

 // Load enquiry
 const { data: enquiry, error: enquiryErr } = await supabase
 .from("quote_requests")
 .select("id, plumber_id, customer_name, customer_email, job_type, address, postcode")
 .eq("id", requestId)
 .maybeSingle();

 if (enquiryErr) return jsonError(500, "Database error", enquiryErr.message);
 if (!enquiry) return jsonError(404, "Enquiry not found");

 // Safety: ensure request belongs to this trader
 if (String(enquiry.plumber_id) !== plumberId) {
 return jsonError(403, "Not allowed");
 }

 const to = String(enquiry.customer_email || "").trim();
 if (!to) return jsonError(400, "Customer email missing");

 const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "";
 const key = process.env.RESEND_API_KEY || "";

 if (!from) return jsonError(500, "Missing RESEND_FROM");
 if (!key) return jsonError(500, "Missing RESEND_API_KEY");

 // Save booking (and prevent duplicates)
 // If you want "one booking per request", either:
 // - add a UNIQUE constraint on site_visits.request_id
 // - or do this pre-check:
 const { data: existing } = await supabase
 .from("site_visits")
 .select("id, request_id, starts_at, duration_mins, created_at")
 .eq("request_id", requestId)
 .eq("plumber_id", plumberId)
 .order("created_at", { ascending: false })
 .limit(1)
 .maybeSingle();

 // If you want to allow multiple bookings, delete this block.
 if (existing?.id) {
 // If you prefer overwrite instead of block, change to update.
 // For now: update the latest booking to the new time.
 const startsAtIso = new Date(startsAtLocal).toISOString();
 const { data: updated, error: updErr } = await supabase
 .from("site_visits")
 .update({ starts_at: startsAtIso, duration_mins: mins })
 .eq("id", existing.id)
 .select("id, request_id, plumber_id, starts_at, duration_mins, created_at")
 .single();

 if (updErr) return jsonError(500, "Booking save failed", updErr.message);

 // Continue sending email + return updated booking at end
 return await sendAndReturn({
 enquiry,
 from,
 key,
 startsAtLocal,
 mins,
 booking: updated,
 });
 }

 // Insert new booking
 const startsAtIso = new Date(startsAtLocal).toISOString();
 const { data: saved, error: saveErr } = await supabase
 .from("site_visits")
 .insert({
 request_id: requestId,
 plumber_id: plumberId,
 starts_at: startsAtIso,
 duration_mins: mins,
 })
 .select("id, request_id, plumber_id, starts_at, duration_mins, created_at")
 .single();

 if (saveErr) return jsonError(500, "Booking save failed", saveErr.message);

 return await sendAndReturn({
 enquiry,
 from,
 key,
 startsAtLocal,
 mins,
 booking: saved,
 });
 } catch (e: any) {
 return jsonError(500, "Unexpected error", e?.message || "Unknown error");
 }
}

/* ---------------- send email + return ---------------- */
async function sendAndReturn(opts: {
 enquiry: any;
 from: string;
 key: string;
 startsAtLocal: string;
 mins: number;
 booking: any;
}) {
 const resend = new Resend(opts.key);

 const title = `FixFlow site visit: ${opts.enquiry.job_type || "Enquiry"}`;
 const location = [opts.enquiry.address, opts.enquiry.postcode].filter(Boolean).join(", ");
 const description =
 `Site visit booked via FixFlow.\n\n` +
 `Enquiry: ${opts.enquiry.job_type || "Enquiry"}\n` +
 `Address: ${opts.enquiry.address || ""}\n` +
 `Postcode: ${opts.enquiry.postcode || ""}\n\n` +
 `If you need to change this booking, reply to this email.`;

 const uid = `fixflow-sitevisit-${opts.enquiry.id}-${Date.now()}`;
 const ics = buildIcs({
 uid,
 title,
 description,
 location,
 startLocal: opts.startsAtLocal,
 durationMins: opts.mins,
 });

 const humanWhen = new Date(opts.startsAtLocal).toLocaleString([], {
 weekday: "short",
 year: "numeric",
 month: "short",
 day: "2-digit",
 hour: "2-digit",
 minute: "2-digit",
 });

 const to = String(opts.enquiry.customer_email || "").trim();

 const { error: mailErr } = await resend.emails.send({
 from: opts.from,
 to,
 subject: title,
 html: `
 <div style="font-family: Arial, sans-serif; line-height: 1.5">
 <p>Hi ${opts.enquiry.customer_name || "there"},</p>
 <p>Your site visit has been booked.</p>
 <p><b>Date/time:</b> ${humanWhen}<br/>
 <b>Duration:</b> ${opts.mins} minutes</p>
 <p><b>Address:</b> ${location || "—"}</p>
 <p>Calendar invite attached (.ics).</p>
 <p>Thanks,<br/>FixFlow</p>
 </div>
 `,
 text: `Hi ${opts.enquiry.customer_name || "there"},\n\nYour site visit has been booked.\n\nDate/time: ${humanWhen}\nDuration: ${
 opts.mins
 } minutes\nAddress: ${location || "—"}\n\nCalendar invite attached.\n\nThanks,\nFixFlow`,
 attachments: [{ filename: "site-visit.ics", content: Buffer.from(ics).toString("base64") }],
 });

 if (mailErr) {
 // Booking saved but email failed → still return booking so UI can update
 return NextResponse.json(
 { ok: false, error: mailErr.message || "Email failed", booking: opts.booking },
 { status: 500 }
 );
 }

 return NextResponse.json({ ok: true, booking: opts.booking }, { status: 200 });
}