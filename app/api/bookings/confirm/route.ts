import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getAuthedUserId(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) return null;

  const anon = supabaseAnon();
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

function formatDateForEmail(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function makeJobBookingIcs(opts: {
  startIso: string;
  title: string;
  description?: string;
  location?: string;
}) {
  const start = new Date(opts.startIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const esc = (v?: string) =>
    String(v || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FixFlow//Job Booking//EN
BEGIN:VEVENT
UID:${Date.now()}@thefixflowapp.com
DTSTAMP:${fmt(new Date())}
DTSTART:${fmt(start)}
DTEND:${fmt(end)}
SUMMARY:${esc(opts.title)}
DESCRIPTION:${esc(opts.description)}
LOCATION:${esc(opts.location)}
END:VEVENT
END:VCALENDAR`;
}

export async function POST(req: Request) {
  try {
    const uid = await getAuthedUserId(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const requestId = String(body.requestId || "").trim();
    const bookingDateTime = String(body.bookingDateTime || "").trim();

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    if (!bookingDateTime) {
      return NextResponse.json(
        { error: "Missing bookingDateTime" },
        { status: 400 }
      );
    }

    const bookedAt = new Date(bookingDateTime);
    if (Number.isNaN(bookedAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid bookingDateTime" },
        { status: 400 }
      );
    }

    const bookedAtIso = bookedAt.toISOString();
    const admin = supabaseAdmin();

    const { data: requestRow, error: requestErr } = await admin
      .from("quote_requests")
      .select(
        "id, plumber_id, customer_name, customer_email, job_type, details, address, postcode"
      )
      .eq("id", requestId)
      .eq("plumber_id", uid)
      .maybeSingle();

    if (requestErr) {
      return NextResponse.json({ error: requestErr.message }, { status: 500 });
    }

    if (!requestRow) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { error: updateErr } = await admin
      .from("quote_requests")
      .update({
        job_booked_at: bookedAtIso,
        status: "booked",
      })
      .eq("id", requestId)
      .eq("plumber_id", uid);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const customerEmail = String(requestRow.customer_email || "").trim();

    if (customerEmail) {
      const humanWhen = formatDateForEmail(bookedAtIso);
      const customerName = String(requestRow.customer_name || "there").trim();
      const jobType = String(requestRow.job_type || "job").trim();
      const location = String(
        requestRow.address || requestRow.postcode || ""
      ).trim();

      const ics = makeJobBookingIcs({
        startIso: bookedAtIso,
        title: `${jobType} - ${requestRow.customer_name || "Customer"}`,
        description: String(requestRow.details || "FixFlow job booking").trim(),
        location,
      });

      const { error: mailErr } = await resend.emails.send({
        from: "FixFlow <bookings@send.thefixflowapp.com>",
        to: customerEmail,
        subject: "Your booking is confirmed",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0B1320">
            <p>Hi ${customerName},</p>
            <p>Your job booking has been confirmed.</p>
            <p>
              <b>Date/time:</b> ${humanWhen}
            </p>
            <p>
              <b>Address:</b> ${location || "—"}
            </p>
            <p>We’ve attached a calendar invite for your booking.</p>
            <p>Thanks,<br/>FixFlow</p>
          </div>
        `,
        text: `Hi ${customerName},

Your job booking has been confirmed.

Date/time: ${humanWhen}
Address: ${location || "—"}

A calendar invite is attached.

Thanks,
FixFlow`,
        attachments: [
          {
            filename: "job-booking.ics",
            content: Buffer.from(ics).toString("base64"),
          },
        ],
      });

      if (mailErr) {
        return NextResponse.json(
          {
            ok: false,
            error: mailErr.message || "Email failed",
            booked_at: bookedAtIso,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        booked_at: bookedAtIso,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Booking confirmation failed" },
      { status: 500 }
    );
  }
}