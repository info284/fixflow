import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

function extractEmailAddress(value: string) {
  const match = String(value || "").match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();

  const plainEmailMatch = String(value || "").match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  );

  if (plainEmailMatch?.[0]) return plainEmailMatch[0].trim().toLowerCase();

  return String(value || "").trim().toLowerCase();
}

function cleanBody(text: string) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(html: string) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function cleanJsonBlock(text: string) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractRequestIdFromTo(toEmail: string) {
  const match = String(toEmail || "").match(/\+([0-9a-fA-F-]{36})@/);
  return match?.[1] || null;
}

function extractNameFromBody(text: string) {
  const match =
    text.match(/\bmy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i) ||
    text.match(/\bname is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i) ||
    text.match(/\bi am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i) ||
    text.match(/\bi'm\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i);

  return match?.[1]?.trim() || null;
}

function extractCustomerMessage(text: string) {
  const cleaned = cleanBody(text);

  const starts = [
    cleaned.search(/\n\s*Hi,?\s*\n/i),
    cleaned.search(/I got your details/i),
    cleaned.search(/I('|’)m having/i),
    cleaned.search(/My name is/i),
    cleaned.search(/You can reach me/i),
  ].filter((n) => n >= 0);

  if (starts.length) {
    return cleanBody(cleaned.slice(Math.min(...starts)));
  }

  const forwardedIndex = cleaned.search(/Begin forwarded message:/i);
  if (forwardedIndex >= 0) {
    return cleanBody(cleaned.slice(forwardedIndex));
  }

  return cleaned;
}

function extractPhone(text: string) {
  const match = text.match(/(?:\+44\s?|0)\d[\d\s]{8,13}\d/);
  return match?.[0]?.replace(/\s+/g, " ").trim() || null;
}

function extractPostcode(text: string) {
  const match = text.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i);
  return match?.[0]?.toUpperCase().replace(/\s+/, " ") || null;
}

function extractAddress(text: string) {
  const match =
    text.match(/full address is\s+(.+?)(?:\.|\n|$)/i) ||
    text.match(/address is\s+(.+?)(?:\.|\n|$)/i);

  return match?.[1]?.trim() || null;
}

function detectJobType(text: string) {
  const t = text.toLowerCase();

  if (t.includes("boiler")) return "boiler";
  if (t.includes("bathroom") || t.includes("shower") || t.includes("toilet"))
    return "bathroom";
  if (t.includes("kitchen") || t.includes("tap") || t.includes("sink"))
    return "kitchen";
  if (t.includes("leak") || t.includes("pipe")) return "leak";

  return null;
}

function detectUrgency(text: string) {
  const t = text.toLowerCase();

  if (
    t.includes("urgent") ||
    t.includes("asap") ||
    t.includes("as soon as possible") ||
    t.includes("emergency") ||
    t.includes("today") ||
    t.includes("tomorrow") ||
    t.includes("no heating") ||
    t.includes("no hot water") ||
    t.includes("leak")
  ) {
    return "asap";
  }

  if (t.includes("this week")) return "this-week";
  if (t.includes("next week")) return "next-week";

  return "flexible";
}

function parseForwardedOriginal(text: string) {
  const cleaned = cleanBody(stripHtml(text || ""));

  const fromMatch =
    cleaned.match(/(?:^|\n)\s*From:\s*(.+)/i) ||
    cleaned.match(/(?:^|\n)\s*Sender:\s*(.+)/i);

  const subjectMatch = cleaned.match(/(?:^|\n)\s*Subject:\s*(.+)/i);

  const originalFromRaw = fromMatch?.[1]?.trim() || null;
  const originalSubject = subjectMatch?.[1]?.trim() || null;

  const customerEmail = originalFromRaw
    ? extractEmailAddress(originalFromRaw)
    : null;

  return {
    customerEmail,
    originalSubject,
    details: cleaned,
  };
}

async function extractForwardedEnquiryWithAI(params: {
  rawFrom: string;
  rawTo: string;
  rawSubject: string;
  rawText: string;
}) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
You extract customer enquiry details from forwarded emails.

NEVER use the forwarding trader as the customer.

Return ONLY valid JSON with exactly these fields:
{
  "customer_name": string | null,
  "customer_email": string | null,
  "original_subject": string | null,
  "job_type": string | null,
  "urgency": "asap" | "this-week" | "next-week" | "flexible",
  "details": string,
  "phone": string | null,
  "postcode": string | null,
  "address": string | null
}

Rules:
- customer_name should be the real person asking for the job.
- If the body says "My name is Claire Watkins", use Claire Watkins.
- customer_email should be the original sender if available.
- Do not use the forwarding trader email.
- details should only describe the customer’s job/problem.
`,
        },
        {
          role: "user",
          content: `
Forwarded by:
${params.rawFrom}

Sent to:
${params.rawTo}

Subject:
${params.rawSubject}

Email:
${params.rawText}
`,
        },
      ],
    });

    const raw = cleanJsonBlock(
      response.choices?.[0]?.message?.content || "{}"
    );

    const parsed = JSON.parse(raw);

    return {
      customer_name:
        typeof parsed?.customer_name === "string" && parsed.customer_name.trim()
          ? parsed.customer_name.trim()
          : null,
      customer_email:
        typeof parsed?.customer_email === "string" &&
        parsed.customer_email.includes("@")
          ? extractEmailAddress(parsed.customer_email)
          : null,
      original_subject:
        typeof parsed?.original_subject === "string" &&
        parsed.original_subject.trim()
          ? parsed.original_subject.trim()
          : null,
      job_type:
        typeof parsed?.job_type === "string" && parsed.job_type.trim()
          ? parsed.job_type.trim().toLowerCase()
          : null,
      urgency:
        parsed?.urgency === "asap" ||
        parsed?.urgency === "this-week" ||
        parsed?.urgency === "next-week" ||
        parsed?.urgency === "flexible"
          ? parsed.urgency
          : null,
      details:
        typeof parsed?.details === "string" && parsed.details.trim()
          ? parsed.details.trim()
          : "",
      phone:
        typeof parsed?.phone === "string" && parsed.phone.trim()
          ? parsed.phone.trim()
          : null,
      postcode:
        typeof parsed?.postcode === "string" && parsed.postcode.trim()
          ? parsed.postcode.trim().toUpperCase()
          : null,
      address:
        typeof parsed?.address === "string" && parsed.address.trim()
          ? parsed.address.trim()
          : null,
    };
  } catch (error) {
    console.error("AI forwarded email extraction failed:", error);
    return null;
  }
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

  const openRows = (data || []).filter((row) => {
    const stage = String(row.stage || "").toLowerCase();
    return !["won", "lost", "completed", "cancelled"].includes(stage);
  });

  if (!openRows.length) return null;

  const newest = openRows[0];
  const createdAt = new Date(newest.created_at).getTime();
  const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

  if (daysOld > 30) return null;

  const oldText = `${newest.job_type || ""} ${newest.details || ""}`.toLowerCase();
  const newText = `${params.subject || ""} ${params.details || ""}`.toLowerCase();

  const sharedWords = newText
    .split(/\W+/)
    .filter((word) => word.length > 4 && oldText.includes(word));

  return sharedWords.length >= 2 ? newest : null;
}

async function triggerAiForEnquiry(enquiryId: string) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
     "https://thefixflowapp.com";

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

    const receivedEmailId =
      emailData?.email_id ||
      emailData?.id ||
      emailData?.email?.id ||
      payload?.email_id ||
      payload?.id ||
      payload?.data?.id ||
      payload?.data?.email_id ||
      null;

    let fullReceivedEmail: any = null;

    if (receivedEmailId) {
      const { data, error } = await resend.emails.receiving.get(receivedEmailId);

      if (error) {
        console.error("Failed to fetch received email:", error);
      } else {
        fullReceivedEmail = data;
      }
    }

    const rawFrom = (
      fullReceivedEmail?.headers?.from ||
      fullReceivedEmail?.from ||
      emailData?.from ||
      emailData?.sender ||
      emailData?.headers?.from ||
      ""
    ).toString();

    const rawTo = (
      Array.isArray(fullReceivedEmail?.to)
        ? fullReceivedEmail.to.join(", ")
        : fullReceivedEmail?.to ||
          emailData?.to ||
          emailData?.recipient ||
          emailData?.headers?.to ||
          ""
    ).toString();

    const inboundSubject = (
      fullReceivedEmail?.subject ||
      emailData?.subject ||
      emailData?.headers?.subject ||
      ""
    )
      .toString()
      .trim();

    const rawText = cleanBody(
      [
        fullReceivedEmail?.text,
        stripHtml(fullReceivedEmail?.html || ""),
        emailData?.text,
        emailData?.body_text,
        emailData?.plain,
        stripHtml(emailData?.html || ""),
      ]
        .filter(Boolean)
        .join("\n\n")
    );

    const to = extractEmailAddress(rawTo);
    const requestId = extractRequestIdFromTo(to);
    const forwardedByEmail = extractEmailAddress(rawFrom).toLowerCase().trim();

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
    const cleanCustomerMessage = extractCustomerMessage(rawText);

    const aiExtracted = await extractForwardedEnquiryWithAI({
      rawFrom,
      rawTo,
      rawSubject: inboundSubject,
      rawText: cleanCustomerMessage.slice(0, 12000),
    });

    const bodyName = extractNameFromBody(cleanCustomerMessage);

const customerEmail =
  aiExtracted?.customer_email ||
  (parsed.customerEmail && parsed.customerEmail !== forwardedByEmail
    ? parsed.customerEmail
    : null);

    const customerName =
      bodyName ||
      aiExtracted?.customer_name ||
      "Customer";

    const details =
      cleanBody(aiExtracted?.details || cleanCustomerMessage || parsed.details || rawText) ||
      "Forwarded email received.";

    const finalSubject =
      aiExtracted?.original_subject ||
      parsed.originalSubject ||
      inboundSubject ||
      "Forwarded email";

    const detectedJobType =
      detectJobType(`${finalSubject} ${cleanCustomerMessage}`) ||
      aiExtracted?.job_type ||
      null;

    const detectedUrgency =
      aiExtracted?.urgency ||
      detectUrgency(`${finalSubject} ${details}`);

    const detectedPhone =
      aiExtracted?.phone ||
      extractPhone(cleanCustomerMessage);

    const detectedPostcode =
      aiExtracted?.postcode ||
      extractPostcode(cleanCustomerMessage);

    const detectedAddress =
      aiExtracted?.address ||
      extractAddress(cleanCustomerMessage);

    console.log("FORWARDED EXTRACTION RESULT:", {
      forwardedByEmail,
      customerEmail,
      customerName,
      finalSubject,
      detectedJobType,
      detectedUrgency,
      detectedPhone,
      detectedPostcode,
      detectedAddress,
      detailsPreview: details.slice(0, 1000),
    });

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
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: detectedPhone,
          postcode: detectedPostcode,
          address: detectedAddress,
          details,
          status: "requested",
          stage: "requested",
          job_type: detectedJobType,
          urgency: detectedUrgency,
          property_type: null,
          problem_location:
            detectedJobType === "bathroom" || detectedJobType === "kitchen"
              ? detectedJobType
              : null,
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
        body_text: details,
        from_email: customerEmail || "unknown@customer.local",
        to_email: to,
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
      const updates: Record<string, any> = {
        ai_last_customer_message_at: new Date().toISOString(),
        ai_thread_status: "customer_replied",
        details,
      };

      if (customerName && customerName !== "Customer") {
        updates.customer_name = customerName;
      }

      if (customerEmail && customerEmail !== forwardedByEmail) {
        updates.customer_email = customerEmail;
      }

      if (detectedPhone) updates.customer_phone = detectedPhone;
      if (detectedPostcode) updates.postcode = detectedPostcode;
      if (detectedAddress) updates.address = detectedAddress;
      if (detectedJobType) updates.job_type = detectedJobType;
      if (detectedUrgency) updates.urgency = detectedUrgency;

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
      detectedJobType,
      detectedUrgency,
    });
  } catch (error: any) {
    console.error("Inbound email error:", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to process inbound email" },
      { status: 500 }
    );
  }
}