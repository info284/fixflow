import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { buildFixFlowEmail } from "@/lib/emails/fixflowEmail";

/* =========================
   SUPABASE
========================= */

function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function createSupabaseAnon() {
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

  const supabaseAnon = createSupabaseAnon();
  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data?.user?.id) return null;
  return data.user.id;
}

/* =========================
   HELPERS
========================= */

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

function escapeHtml(value?: string | null) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function makeJobBookingIcs(opts: {
  startIso: string;
  title: string;
  description?: string;
  location?: string;
}) {
  const start = new Date(opts.startIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const formatUtc = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const escapeIcs = (value?: string) =>
    String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FixFlow//Job Booking//EN
BEGIN:VEVENT
UID:${Date.now()}@thefixflowapp.com
DTSTAMP:${formatUtc(new Date())}
DTSTART:${formatUtc(start)}
DTEND:${formatUtc(end)}
SUMMARY:${escapeIcs(opts.title)}
DESCRIPTION:${escapeIcs(opts.description)}
LOCATION:${escapeIcs(opts.location)}
END:VEVENT
END:VCALENDAR`;
}

/* =========================
   ROUTE
========================= */

export async function POST(req: Request) {
  try {
    const userId = await getAuthedUserId(req);

    if (!userId) {
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

    const bookingDate = new Date(bookingDateTime);

    if (Number.isNaN(bookingDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid bookingDateTime" },
        { status: 400 }
      );
    }

    const bookedAtIso = bookingDate.toISOString();
    const supabaseAdmin = createSupabaseAdmin();

    const { data: requestRow, error: requestError } = await supabaseAdmin
      .from("quote_requests")
      .select(
        "id, plumber_id, customer_name, customer_email, job_type, details, address, postcode"
      )
      .eq("id", requestId)
      .eq("plumber_id", userId)
      .maybeSingle();

    if (requestError) {
      return NextResponse.json(
        { error: requestError.message },
        { status: 500 }
      );
    }

    if (!requestRow) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("quote_requests")
      .update({
        job_booked_at: bookedAtIso,
        status: "booked",
        stage: "won",
      })
      .eq("id", requestId)
      .eq("plumber_id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    const customerEmail = String(requestRow.customer_email || "").trim();

    if (customerEmail) {
      const resendKey = process.env.RESEND_API_KEY;

      if (!resendKey) {
        return NextResponse.json(
          { error: "Missing RESEND_API_KEY" },
          { status: 500 }
        );
      }

      const resend = new Resend(resendKey);

      const customerName = String(requestRow.customer_name || "there").trim();
      const jobType = String(requestRow.job_type || "job").trim();
      const location = String(
        requestRow.address || requestRow.postcode || ""
      ).trim();
      const humanWhen = formatDateForEmail(bookedAtIso);

      const safeCustomerName = escapeHtml(customerName);
      const safeHumanWhen = escapeHtml(humanWhen);
      const safeLocation = escapeHtml(location || "—");

      const ics = makeJobBookingIcs({
        startIso: bookedAtIso,
        title: `${jobType} - ${requestRow.customer_name || "Customer"}`,
        description: String(requestRow.details || "FixFlow job booking").trim(),
        location,
      });

      const html = buildFixFlowEmail({
        title: "Booking confirmed",
        introHtml: `
          <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
            Hi ${safeCustomerName},
          </div>

          <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
            Your job is now booked in. Here are the details for your appointment:
          </div>
        `,
        bodyHtml: `
          <div style="background:#F4F7FF; border:1px solid #E6ECF5; border-radius:18px; overflow:hidden; margin-bottom:20px;">
            <div style="padding:18px 18px 16px 18px; border-bottom:1px solid #E6ECF5;">
              <div style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#5C6B84; margin-bottom:6px;">
                Date and time
              </div>
              <div style="font-size:18px; font-weight:800; color:#0B1320;">
                ${safeHumanWhen}
              </div>
            </div>

            <div style="padding:18px;">
              <div style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#5C6B84; margin-bottom:6px;">
                Address
              </div>
              <div style="font-size:18px; font-weight:800; color:#0B1320;">
                ${safeLocation}
              </div>
            </div>
          </div>

          <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
            We’ve attached a calendar invite so you can save this booking easily.
          </div>
        `,
      });

      const text = `Hi ${customerName},

Your job is now booked in. Here are the details for your appointment:

Date and time: ${humanWhen}
Address: ${location || "—"}

We’ve attached a calendar invite so you can save this booking easily.

Thanks,
FixFlow`;

      const emailResult = await resend.emails.send({
        from: "FixFlow <bookings@send.thefixflowapp.com>",
        to: customerEmail,
        subject: "Your booking is confirmed",
        html,
        text,
        attachments: [
          {
            filename: "job-booking.ics",
            content: Buffer.from(ics).toString("base64"),
          },
        ],
      });

      if ("error" in emailResult && emailResult.error) {
        return NextResponse.json(
          {
            ok: false,
            error: emailResult.error.message || "Email failed",
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Booking confirmation failed" },
      { status: 500 }
    );
  }
}