import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resend = new Resend(process.env.RESEND_API_KEY);

  const today = new Date();
  const in30Days = new Date();
  in30Days.setDate(today.getDate() + 30);

  const { data: certs, error } = await supabase
    .from("trader_certificates")
    .select(`
      id,
      name,
      expiry_date,
      trader_id,
      last_reminder_sent_at,
      profiles:trader_id (notify_email, display_name)
    `)
    .not("expiry_date", "is", null)
    .lte("expiry_date", in30Days.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message });
  }

  let sent = 0;

  for (const cert of certs || []) {
    const lastSent = cert.last_reminder_sent_at
      ? new Date(cert.last_reminder_sent_at)
      : null;

    // ⛔ prevent daily spam (only send every 7 days)
    if (lastSent) {
      const daysSince = Math.ceil(
        (today.getTime() - lastSent.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSince < 7) continue;
    }

    const expiry = new Date(cert.expiry_date!);
    const daysLeft = Math.ceil(
      (expiry.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );

   const profile = Array.isArray(cert.profiles)
  ? cert.profiles[0]
  : cert.profiles;

const email = profile?.notify_email;

    if (!email) continue;

    try {
      await resend.emails.send({
        from: "FixFlow <alerts@yourdomain.com>",
        to: email,
        subject:
          daysLeft < 0
            ? `⚠️ ${cert.name} has expired`
            : `⏳ ${cert.name} expires in ${daysLeft} day${
                daysLeft === 1 ? "" : "s"
              }`,
html: `
  <div style="font-family: Arial; line-height:1.6;">
    <h2 style="color:#1f355c;">FixFlow reminder</h2>

    <p>
      Your certificate <strong>${cert.name}</strong>
      ${
        daysLeft < 0
          ? `expired ${Math.abs(daysLeft)} day(s) ago.`
          : `is due to expire in ${daysLeft} day(s).`
      }
    </p>

    <p>
      Keeping certificates up to date helps you win more jobs and stay compliant.
    </p>

    <a href="https://thefixflowapp.com/dashboard/profile"
       style="
         display:inline-block;
         margin-top:12px;
         padding:10px 14px;
         background:#1f355c;
         color:#fff;
         border-radius:8px;
         text-decoration:none;
       ">
      Update certificate
    </a>

    <p style="margin-top:20px; font-size:12px; color:#666;">
      You’re receiving this because you use FixFlow.
    </p>
  </div>
`,
      });

      // ✅ update last sent
      await supabase
        .from("trader_certificates")
        .update({ last_reminder_sent_at: today.toISOString() })
        .eq("id", cert.id);

      sent++;
    } catch (err) {
      console.error("Email failed:", err);
    }
  }

  return NextResponse.json({ success: true, sent });
}