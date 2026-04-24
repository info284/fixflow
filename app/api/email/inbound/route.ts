import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();

  const plainEmailMatch = value.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  );

  if (plainEmailMatch?.[0]) return plainEmailMatch[0].trim().toLowerCase();

  return value.trim().toLowerCase();
}

function extractNameFromHeader(value: string) {
  const angleMatch = value.match(/^(.+?)\s*<[^>]+>$/);

  if (angleMatch?.[1]) {
    return angleMatch[1].replace(/(^"|"$)/g, "").trim();
  }

  const email = extractEmailAddress(value);
  const local = email.split("@")[0] || "";

  return (
    local
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || null
  );
}

function extractRequestIdFromTo(toEmail: string) {
  const match = toEmail.match(/\+([0-9a-fA-F-]{36})@/);
  return match?.[1] || null;
}

function cleanBody(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseForwardedOriginal(text: string) {
  const cleaned = text.replace(/\r/g, "");

  const fromMatch =
    cleaned.match(/^From:\s*(.+)$/im) ||
    cleaned.match(/^Sender:\s*(.+)$/im);

  const replyToMatch = cleaned.match(/^Reply-To:\s*(.+)$/im);
  const subjectMatch = cleaned.match(/^Subject:\s*(.+)$/im);

  const originalFromRaw = fromMatch?.[1]?.trim() || null;
  const originalReplyToRaw = replyToMatch?.[1]?.trim() || null;
  const originalSubject = subjectMatch?.[1]?.trim() || null;

  const bestSource = originalReplyToRaw || originalFromRaw;

  const customerEmail = bestSource ? extractEmailAddress(bestSource) : null;
  const customerName = bestSource ? extractNameFromHeader(bestSource) : null;

  let details = cleaned;

  const forwardedSeparatorPatterns = [
    /---------- Forwarded message ----------/i,
    /Begin forwarded message:/i,
    /^From:\s.+$/im,
  ];

  for (const pattern of forwardedSeparatorPatterns) {
    const match = cleaned.match(pattern);

    if (match?.index != null) {
      details = cleaned.slice(match.index);
      break;
    }
  }

  return {
    customerEmail,
    customerName,
    originalSubject,
    details: cleanBody(details),
  };
}

async function findExistingEnquiry(params: {
  plumberId: string;
  customerEmail: string | null;
  subject: string;
  details: string;
}) {
  if (!params.customerEmail) return null;

  const { data, error } = await supabaseAdmin
    .from("quote_requests")
    .select("id, customer_name, customer_email, stage, job_type, details, created_at")
    .eq("plumber_id", params.plumberId)
    .eq("customer_email", params.customerEmail)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Find existing enquiry error:", error);
    throw new Error("Failed to check existing enquiries");
  }

  const rows = data || [];

  // Only consider open enquiries
  const openRows = rows.filter((row) => {
    const stage = String(row.stage || "").toLowerCase();
    return !["won", "lost", "completed", "cancelled"].includes(stage);
  });

  if (!openRows.length) return null;

  const newest = openRows[0];

  // Ignore if too old (over 30 days)
  const createdAt = new Date(newest.created_at).getTime();
  const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

  if (daysOld > 30) return null;

  // Compare text similarity
  const oldText = `${newest.job_type || ""} ${newest.details || ""}`.toLowerCase();
  const newText = `${params.subject || ""} ${params.details || ""}`.toLowerCase();

  const sharedWords = newText
    .split(/\W+/)
    .filter((word) => word.length > 4 && oldText.includes(word));

  // If similar enough → treat as same enquiry
  if (sharedWords.length >= 2) {
    return newest;
  }

  return null;
}

async function triggerAiForEnquiry(enquiryId: string) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    await fetch(`${baseUrl.replace(/\/$/, "")}/api/ai/run-enquiry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enquiryId }),
    });
  } catch (aiError) {
    console.error("Failed to trigger AI after inbound email:", aiError);
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

 const emailData = payload?.data || payload;

const rawFrom = (emailData?.from || emailData?.sender || "").toString();
const rawTo = (emailData?.to || emailData?.recipient || "").toString();
const inboundSubject = (emailData?.subject || "").toString().trim();

const rawText =
  (
    emailData?.text ||
    emailData?.body_text ||
    emailData?.plain ||
    emailData?.html ||
    ""
  ).toString();

    const to = extractEmailAddress(rawTo);
    const requestId = extractRequestIdFromTo(to);
    const forwardedByEmail = extractEmailAddress(rawFrom)
  .toLowerCase()
  .trim();

    /*
      Case 1:
      Customer replies to:
      enquiries+<requestId>@send.thefixflowapp.com

      This should go straight into the existing enquiry thread.
    */
    if (requestId) {
      const { data: enquiry, error: enquiryError } = await supabaseAdmin
        .from("quote_requests")
        .select("id, plumber_id")
        .eq("id", requestId)
        .single();

      if (enquiryError || !enquiry) {
        return NextResponse.json(
          { ok: false, error: "Enquiry not found for reply address" },
          { status: 404 }
        );
      }

      const { error: messageError } = await supabaseAdmin
        .from("enquiry_messages")
        .insert({
          request_id: requestId,
          plumber_id: enquiry.plumber_id,
          direction: "in",
          channel: "email",
          subject: inboundSubject || "Customer reply",
          body_text: cleanBody(rawText),
          from_email: forwardedByEmail,
          to_email: to,
        });

      if (messageError) {
        console.error("Create inbound thread message error:", messageError);

        return NextResponse.json(
          { ok: false, error: messageError.message },
          { status: 500 }
        );
      }

      await supabaseAdmin
        .from("quote_requests")
        .update({
          ai_last_customer_message_at: new Date().toISOString(),
          ai_thread_status: "customer_replied",
        })
        .eq("id", requestId);

      await triggerAiForEnquiry(requestId);

      return NextResponse.json({
        ok: true,
        mode: "existing-thread-by-address",
        enquiryId: requestId,
      });
    }

    /*
      Case 2:
      Trader forwards an outside customer email into FixFlow.
      We match trader by notify_email and either attach to an existing enquiry
      or create a new one.
    */


console.log("EMAIL LOOKUP:", forwardedByEmail);
console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

const { data: profile, error: profileError } = await supabaseAdmin
  .from("profiles")
  .select("id, notify_email")
  .ilike("notify_email", forwardedByEmail)
  .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);

      return NextResponse.json(
        { ok: false, error: "Could not look up trader profile" },
        { status: 500 }
      );
    }

    if (!profile?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "No FixFlow trader found for this forwarding email",
          forwardedByEmail,
        },
        { status: 404 }
      );
    }

    const parsed = parseForwardedOriginal(rawText);

const customerEmail = parsed.customerEmail || forwardedByEmail;
const customerName = parsed.customerName || extractNameFromHeader(rawFrom);
const details = parsed.details || cleanBody(rawText);
    const finalSubject =
      parsed.originalSubject || inboundSubject || "Forwarded email";

    let enquiryId: string;
    let createdNewEnquiry = false;

const existingEnquiry = await findExistingEnquiry({
  plumberId: profile.id,
  customerEmail,
  subject: finalSubject,
  details,
});

    if (existingEnquiry?.id) {
      enquiryId = existingEnquiry.id;
    } else {
      const { data: enquiry, error: enquiryError } = await supabaseAdmin
        .from("quote_requests")
.insert({
  plumber_id: profile.id,
  customer_name: customerName || "Customer",
  customer_email: customerEmail,

  details,

  status: "new",
  stage: "new",

  job_type: "General",
  urgency: "Flexible",
  postcode: "Unknown",
  address: "Unknown",
  property_type: "Unknown",
  problem_location: "Unknown",

  ai_thread_status: "customer_replied",
  ai_last_customer_message_at: new Date().toISOString(),
})
        .select("id, customer_name, customer_email, created_at")
        .single();

      if (enquiryError) {
        console.error("Create enquiry error:", enquiryError);

return NextResponse.json(
  { ok: false, error: enquiryError.message },
  { status: 500 }
);
      }

      enquiryId = enquiry.id;
      createdNewEnquiry = true;
    }

    const { error: messageError } = await supabaseAdmin
      .from("enquiry_messages")
      .insert({
        request_id: enquiryId,
        plumber_id: profile.id,
        direction: "in",
        channel: "email",
        subject: finalSubject,
        body_text: cleanBody(rawText),
        from_email: customerEmail || forwardedByEmail,
        to_email: forwardedByEmail,
      });

    if (messageError) {
      console.error("Create enquiry message error:", messageError);

      return NextResponse.json(
        {
          ok: false,
          error: "Enquiry matched/created but failed to log message",
          enquiryId,
        },
        { status: 500 }
      );
    }

    if (!createdNewEnquiry) {
      const updates: Record<string, string> = {
        ai_last_customer_message_at: new Date().toISOString(),
        ai_thread_status: "customer_replied",
      };

      if (customerName) updates.customer_name = customerName;
      if (customerEmail) updates.customer_email = customerEmail;
      if (details) updates.details = details;

      const { error: updateError } = await supabaseAdmin
        .from("quote_requests")
        .update(updates)
        .eq("id", enquiryId);

      if (updateError) {
        console.error("Update existing enquiry error:", updateError);
      }
    }

    await triggerAiForEnquiry(enquiryId);

    return NextResponse.json({
      ok: true,
      mode: createdNewEnquiry ? "new-enquiry" : "existing-enquiry",
      enquiryId,
      customerName,
      customerEmail,
      forwardedByEmail,
    });
  } catch (error) {
    console.error("Inbound email error:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to process inbound email" },
      { status: 500 }
    );
  }
}