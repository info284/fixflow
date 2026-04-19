export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { google } from "googleapis";

/* ---------------- types ---------------- */

type EnquiryRow = {
  id: string;
  plumber_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  job_type: string | null;
  address: string | null;
  postcode: string | null;
};

type SiteVisitRow = {
  id: string;
  request_id: string;
  plumber_id: string;
  starts_at: string;
  duration_mins: number;
  created_at: string;
  google_event_id?: string | null;
};

type CalendarTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
};

/* ---------------- helpers ---------------- */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isValidDateInput(value: string) {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function formatPostcode(postcode?: string | null) {
  const raw = String(postcode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (!raw) return "";
  if (raw.length <= 3) return raw;

  return `${raw.slice(0, -3)} ${raw.slice(-3)}`;
}

function buildCleanAddress(address?: string | null, postcode?: string | null) {
  const a = String(address || "").trim();
  const pc = formatPostcode(postcode);

  if (!a && !pc) return "—";
  if (!a) return pc;

  const normalizedAddress = a.replace(/\s+/g, " ").trim();
  const compactAddress = normalizedAddress.toUpperCase().replace(/\s+/g, "");

  if (pc && compactAddress.includes(pc.replace(/\s+/g, ""))) {
    return normalizedAddress;
  }

  return [normalizedAddress, pc].filter(Boolean).join(", ");
}

function toUtcIcs(dtLocal: string) {
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
  const dtEnd = `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(
    end.getUTCDate()
  )}T${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}${pad(
    end.getUTCSeconds()
  )}Z`;

  const now = new Date();
  const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate()
  )}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(
    now.getUTCSeconds()
  )}Z`;

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

function jsonError(
  status: number,
  error: string,
  detail?: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { ok: false, error, detail: detail || "", ...(extra || {}) },
    { status }
  );
}

function formatHumanDate(dtLocal: string) {
  return new Date(dtLocal).toLocaleString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCalendarText(enquiry: EnquiryRow, mins: number, when: string) {
  const location = buildCleanAddress(enquiry.address, enquiry.postcode);

  const jobLabel = enquiry.job_type
    ? enquiry.job_type.charAt(0).toUpperCase() + enquiry.job_type.slice(1)
    : "Job";

  const title = `Site visit booked – ${jobLabel}`;

  const description =
    `A site visit has been booked via FixFlow.\n\n` +
    `Job: ${jobLabel}\n` +
    `When: ${when}\n` +
    `Duration: ${mins} minutes\n` +
    `Address: ${location}\n\n` +
    `If you need to make any changes, please reply to the email from your trader.`;

  return {
    title,
    location,
    description,
    whenText: when,
    durationText: `${mins} minutes`,
    jobLabel,
  };
}

function hasColumnMissingError(error: unknown, columnName: string) {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message || "")
      : "";

  return msg.includes(`'${columnName}'`) || msg.includes(columnName);
}

/* ---------------- google calendar ---------------- */

async function createOrUpdateGoogleCalendarEvent(opts: {
  supabase: SupabaseClient;
  plumberId: string;
  enquiry: EnquiryRow;
  startsAtLocal: string;
  mins: number;
  existingGoogleEventId?: string | null;
}) {
  const { data: tokenRow, error: tokenErr } = await opts.supabase
    .from("google_calendar_tokens")
    .select("access_token, refresh_token")
    .eq("user_id", opts.plumberId)
    .maybeSingle();

  if (tokenErr) {
    console.error("calendar token fetch error:", tokenErr);
    return { ok: false as const, eventId: null };
  }

  const tokens = (tokenRow || null) as CalendarTokenRow | null;

  if (!tokens?.refresh_token) {
    return { ok: false as const, eventId: null };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("missing google calendar env vars");
    return { ok: false as const, eventId: null };
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  oauth2.setCredentials({
    access_token: tokens.access_token || undefined,
    refresh_token: tokens.refresh_token,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });

  const start = new Date(opts.startsAtLocal);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + opts.mins);

  const summary = `Site visit – ${opts.enquiry.job_type || "Enquiry"}`;
  const location = buildCleanAddress(
    opts.enquiry.address,
    opts.enquiry.postcode
  );

  const description =
    `Customer: ${opts.enquiry.customer_name || "Customer"}\n` +
    `Email: ${opts.enquiry.customer_email || "—"}\n` +
    `Job: ${opts.enquiry.job_type || "Enquiry"}\n` +
    `Address: ${location}`;

  const calendarId = "primary";

  try {
    if (opts.existingGoogleEventId) {
      const updated = await calendar.events.update({
        calendarId,
        eventId: opts.existingGoogleEventId,
        requestBody: {
          summary,
          location: location || undefined,
          description,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      });

      return {
        ok: true as const,
        eventId: updated.data.id || opts.existingGoogleEventId,
      };
    }

    const created = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        location: location || undefined,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });

    return {
      ok: true as const,
      eventId: created.data.id || null,
    };
  } catch (err) {
    console.error("google calendar insert/update error:", err);
    return { ok: false as const, eventId: null };
  }
}

/* ---------------- customer email ---------------- */

async function sendBookingEmail(opts: {
  enquiry: EnquiryRow;
  from: string;
  resendApiKey: string;
  startsAtLocal: string;
  mins: number;
}) {
  const resend = new Resend(opts.resendApiKey);

  const humanWhen = formatHumanDate(opts.startsAtLocal);
  const textParts = buildCalendarText(opts.enquiry, opts.mins, humanWhen);
  const cleanAddress = buildCleanAddress(
    opts.enquiry.address,
    opts.enquiry.postcode
  );

  const uid = `fixflow-sitevisit-${opts.enquiry.id}-${Date.now()}`;
  const ics = buildIcs({
    uid,
    title: textParts.title,
    description: textParts.description,
    location: cleanAddress === "—" ? undefined : cleanAddress,
    startLocal: opts.startsAtLocal,
    durationMins: opts.mins,
  });

  const to = String(opts.enquiry.customer_email || "").trim();

  const { error } = await resend.emails.send({
    from: opts.from,
    to,
    subject: textParts.title,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0b1320;">
        <p style="margin: 0 0 16px;">Hi ${opts.enquiry.customer_name || "there"},</p>

        <p style="margin: 0 0 16px;">Your site visit has been booked.</p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px; width: 100%; max-width: 520px;">
          <tr>
            <td style="padding: 0 0 8px; font-weight: 700; width: 110px; vertical-align: top;">Date/time:</td>
            <td style="padding: 0 0 8px; vertical-align: top;">${textParts.whenText}</td>
          </tr>
          <tr>
            <td style="padding: 0 0 8px; font-weight: 700; vertical-align: top;">Duration:</td>
            <td style="padding: 0 0 8px; vertical-align: top;">${textParts.durationText}</td>
          </tr>
          <tr>
            <td style="padding: 0; font-weight: 700; vertical-align: top;">Address:</td>
            <td style="padding: 0; vertical-align: top;">${cleanAddress}</td>
          </tr>
        </table>

        <p style="margin: 0 0 16px;">Calendar invite attached (.ics).</p>

        <p style="margin: 0;">Thanks,<br/>FixFlow</p>
      </div>
    `,
    text:
      `Hi ${opts.enquiry.customer_name || "there"},\n\n` +
      `Your site visit has been booked.\n\n` +
      `Date/time: ${textParts.whenText}\n` +
      `Duration: ${textParts.durationText}\n` +
      `Address: ${cleanAddress}\n\n` +
      `Calendar invite attached (.ics).\n\n` +
      `Thanks,\nFixFlow`,
    attachments: [
      {
        filename: "site-visit.ics",
        content: Buffer.from(ics).toString("base64"),
      },
    ],
  });

  return { ok: !error, error };
}

/* ---------------- route ---------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const requestId = String(body?.requestId || "").trim();
    const startsAtLocal = String(body?.startsAtLocal || "").trim();
    const plumberId = String(body?.plumberId || "").trim();
    const mins = Number(body?.durationMins || 60);

    if (!requestId || !startsAtLocal) {
      return jsonError(
        400,
        "Missing fields",
        "requestId and startsAtLocal are required"
      );
    }

    if (!isValidDateInput(startsAtLocal)) {
      return jsonError(
        400,
        "Invalid startsAtLocal",
        "Must be a valid datetime-local value"
      );
    }

    if (!Number.isFinite(mins) || mins <= 0 || mins > 8 * 60) {
      return jsonError(
        400,
        "Invalid durationMins",
        "Must be a number between 1 and 480"
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendFrom = process.env.RESEND_FROM || process.env.EMAIL_FROM || "";
    const resendApiKey = process.env.RESEND_API_KEY || "";

    if (!supabaseUrl) {
      return jsonError(
        500,
        "Server misconfigured",
        "Missing NEXT_PUBLIC_SUPABASE_URL"
      );
    }

    if (!serviceKey) {
      return jsonError(
        500,
        "Server misconfigured",
        "Missing SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    if (!resendFrom) {
      return jsonError(500, "Missing RESEND_FROM");
    }

    if (!resendApiKey) {
      return jsonError(500, "Missing RESEND_API_KEY");
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: enquiryData, error: enquiryErr } = await supabase
      .from("quote_requests")
      .select(
        "id, plumber_id, customer_name, customer_email, job_type, address, postcode"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (enquiryErr) {
      return jsonError(500, "Database error", enquiryErr.message);
    }

    if (!enquiryData) {
      return jsonError(404, "Enquiry not found");
    }

    const enquiry = enquiryData as EnquiryRow;
    const ownerPlumberId = String(enquiry.plumber_id || "").trim();

    if (!ownerPlumberId) {
      return jsonError(500, "Enquiry missing plumber_id");
    }

    if (plumberId && ownerPlumberId !== plumberId) {
      return jsonError(403, "Not allowed");
    }

    const customerEmail = String(enquiry.customer_email || "").trim();
    if (!customerEmail) {
      return jsonError(400, "Customer email missing");
    }

    const { data: existingData, error: existingErr } = await supabase
      .from("site_visits")
      .select("id, request_id, plumber_id, starts_at, duration_mins, created_at")
      .eq("request_id", requestId)
      .eq("plumber_id", ownerPlumberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return jsonError(500, "Database error", existingErr.message);
    }

    const startsAtIso = new Date(startsAtLocal).toISOString();
    let booking: SiteVisitRow | null = null;

    if (existingData?.id) {
      const existing = existingData as SiteVisitRow;
      existing.google_event_id = null;

      let updatedRow: SiteVisitRow | null = null;

      const updateWithGoogleEventId = await supabase
        .from("site_visits")
        .update({
          starts_at: startsAtIso,
          duration_mins: mins,
        })
        .eq("id", existing.id)
        .select(
          "id, request_id, plumber_id, starts_at, duration_mins, created_at, google_event_id"
        )
        .single();

      if (updateWithGoogleEventId.error) {
        if (
          hasColumnMissingError(updateWithGoogleEventId.error, "google_event_id")
        ) {
          const fallbackUpdate = await supabase
            .from("site_visits")
            .update({
              starts_at: startsAtIso,
              duration_mins: mins,
            })
            .eq("id", existing.id)
            .select(
              "id, request_id, plumber_id, starts_at, duration_mins, created_at"
            )
            .single();

          if (fallbackUpdate.error) {
            return jsonError(
              500,
              "Booking save failed",
              fallbackUpdate.error.message
            );
          }

          updatedRow = fallbackUpdate.data as SiteVisitRow;
          updatedRow.google_event_id = existing.google_event_id || null;
        } else {
          return jsonError(
            500,
            "Booking save failed",
            updateWithGoogleEventId.error.message
          );
        }
      } else {
        updatedRow = updateWithGoogleEventId.data as SiteVisitRow;
      }

      booking = updatedRow;

      const calendarResult = await createOrUpdateGoogleCalendarEvent({
        supabase,
        plumberId: ownerPlumberId,
        enquiry,
        startsAtLocal,
        mins,
        existingGoogleEventId: existing.google_event_id || null,
      });

      if (calendarResult.ok && calendarResult.eventId) {
        const saveEventId = await supabase
          .from("site_visits")
          .update({ google_event_id: calendarResult.eventId })
          .eq("id", existing.id);

        if (
          saveEventId.error &&
          !hasColumnMissingError(saveEventId.error, "google_event_id")
        ) {
          console.error("site visit google_event_id save error:", saveEventId.error);
        }

        booking.google_event_id = calendarResult.eventId;
      }
    } else {
      let insertedRow: SiteVisitRow | null = null;

      const insertWithGoogleEventId = await supabase
        .from("site_visits")
        .insert({
          request_id: requestId,
          plumber_id: ownerPlumberId,
          starts_at: startsAtIso,
          duration_mins: mins,
        })
        .select(
          "id, request_id, plumber_id, starts_at, duration_mins, created_at, google_event_id"
        )
        .single();

      if (insertWithGoogleEventId.error) {
        if (
          hasColumnMissingError(insertWithGoogleEventId.error, "google_event_id")
        ) {
          const fallbackInsert = await supabase
            .from("site_visits")
            .insert({
              request_id: requestId,
              plumber_id: ownerPlumberId,
              starts_at: startsAtIso,
              duration_mins: mins,
            })
            .select(
              "id, request_id, plumber_id, starts_at, duration_mins, created_at"
            )
            .single();

          if (fallbackInsert.error) {
            return jsonError(
              500,
              "Booking save failed",
              fallbackInsert.error.message
            );
          }

          insertedRow = fallbackInsert.data as SiteVisitRow;
          insertedRow.google_event_id = null;
        } else {
          return jsonError(
            500,
            "Booking save failed",
            insertWithGoogleEventId.error.message
          );
        }
      } else {
        insertedRow = insertWithGoogleEventId.data as SiteVisitRow;
      }

      booking = insertedRow;

      const calendarResult = await createOrUpdateGoogleCalendarEvent({
        supabase,
        plumberId: ownerPlumberId,
        enquiry,
        startsAtLocal,
        mins,
      });

      if (calendarResult.ok && calendarResult.eventId) {
        const saveEventId = await supabase
          .from("site_visits")
          .update({ google_event_id: calendarResult.eventId })
          .eq("id", insertedRow.id);

        if (
          saveEventId.error &&
          !hasColumnMissingError(saveEventId.error, "google_event_id")
        ) {
          console.error("site visit google_event_id save error:", saveEventId.error);
        }

        booking.google_event_id = calendarResult.eventId;
      }
    }

    if (!booking) {
      return jsonError(
        500,
        "Booking save failed",
        "Booking could not be created"
      );
    }

    const mailResult = await sendBookingEmail({
      enquiry,
      from: resendFrom,
      resendApiKey,
      startsAtLocal,
      mins,
    });

    if (!mailResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: mailResult.error?.message || "Email failed",
          booking,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, booking }, { status: 200 });
  } catch (e: any) {
    return jsonError(500, "Unexpected error", e?.message || "Unknown error");
  }
}