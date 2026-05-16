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
return String(text || "")
.replace(/\r/g, "")
.replace(/\n{3,}/g, "\n\n")
.trim();
}

function stripHtml(html: string) {
return String(html || "")
.replace(/<br\s*\/?>/gi, "\n")
.replace(/<\/p>/gi, "\n")
.replace(/<\/div>/gi, "\n")
.replace(/<[^>]+>/g, "")
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

function parseForwardedOriginal(text: string) {
const cleaned = stripHtml(text || "").replace(/\r/g, "");

const fromMatch =
cleaned.match(/(?:^|\n)\s*From:\s*(.+)/i) ||
cleaned.match(/(?:^|\n)\s*Sender:\s*(.+)/i);

const replyToMatch = cleaned.match(/(?:^|\n)\s*Reply-To:\s*(.+)/i);
const subjectMatch = cleaned.match(/(?:^|\n)\s*Subject:\s*(.+)/i);

const originalFromRaw = fromMatch?.[1]?.trim() || null;
const originalReplyToRaw = replyToMatch?.[1]?.trim() || null;
const originalSubject = subjectMatch?.[1]?.trim() || null;

const bestSource = originalReplyToRaw || originalFromRaw;

const customerEmail = bestSource ? extractEmailAddress(bestSource) : null;
const customerName = bestSource ? extractNameFromHeader(bestSource) : null;

return {
customerEmail,
customerName,
originalSubject,
details: cleanBody(cleaned),
};
}
function extractNameFromBody(text: string) {
  const match =
    text.match(/\bmy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i) ||
    text.match(/\bi am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i) ||
    text.match(/\bi'm\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i);

  return match?.[1]?.trim() || null;
}

function extractCustomerMessage(text: string) {
  const cleaned = cleanBody(text);

  const start =
    cleaned.search(/\n\s*Hi,?\s*\n/i) >= 0
      ? cleaned.search(/\n\s*Hi,?\s*\n/i)
      : cleaned.search(/I got your details|I('|’)m having|My name is/i);

  if (start >= 0) {
    return cleanBody(cleaned.slice(start));
  }

  return cleaned;
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
t.includes("emergency") ||
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

async function extractForwardedEnquiryWithAI(params: {
rawFrom: string;
rawTo: string;
rawSubject: string;
rawText: string;
}) {
try {
const response = await openai.responses.create({
model: "gpt-5",
input: [
{
role: "system",
content: [
{
type: "input_text",
text: `
You extract customer enquiry details from messy forwarded emails.

Important:
- The email was forwarded by a trader into FixFlow.
- NEVER treat the forwarding trader as the customer.
- Ignore trader signatures, trader email addresses, app text, disclaimers and previous forwarding noise.
- Find the original customer, their email if present, and what they actually asked for.
- If you cannot find the original customer email, return null.
- If job type is unclear, return null.
- Return valid JSON only. No markdown.
`,
},
],
},
{
role: "user",
content: [
{
type: "input_text",
text: `
Forwarded by:
${params.rawFrom}

Sent to:
${params.rawTo}

Inbound subject:
${params.rawSubject}

Full email body:
${params.rawText}

Return this JSON shape exactly:

{
"customer_name": string | null,
"customer_email": string | null,
"original_subject": string | null,
"job_type": string | null,
"urgency": "asap" | "this-week" | "next-week" | "flexible",
"details": string
}
`,
},
],
},
],
});

const raw = cleanJsonBlock(response.output_text || "{}");
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
: "flexible",
details:
typeof parsed?.details === "string" && parsed.details.trim()
? parsed.details.trim()
: "",
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

const receivedEmailId =
  emailData?.email_id ||
  emailData?.id ||
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

console.log("EMAIL PAYLOAD SHAPE:", {
  topLevelKeys: Object.keys(emailData || {}),
  emailKeys: Object.keys(emailData?.email || {}),
  bodyKeys: Object.keys(emailData?.body || {}),
  hasText: !!emailData?.text,
  hasHtml: !!emailData?.html,
  hasEmailText: !!emailData?.email?.text,
  hasEmailHtml: !!emailData?.email?.html,
  hasBodyText: !!emailData?.body?.text,
  hasBodyHtml: !!emailData?.body?.html,
  rawTextPreview: rawText.slice(0, 2000),
});

const to = extractEmailAddress(rawTo);
const requestId = extractRequestIdFromTo(to);
const forwardedByEmail = extractEmailAddress(rawFrom).toLowerCase().trim();

console.log("INBOUND EMAIL:", {
rawFrom,
rawTo,
forwardedByEmail,
inboundSubject,
rawTextPreview: rawText.slice(0, 1000),
});

/*
Case 1:
Customer replies to enquiries+<requestId>@...
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
*/
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

const aiExtracted = await extractForwardedEnquiryWithAI({
  rawFrom,
  rawTo,
  rawSubject: inboundSubject,
  rawText: rawText.slice(0, 12000),
});

const cleanCustomerMessage = extractCustomerMessage(rawText);
const bodyName = extractNameFromBody(cleanCustomerMessage);

const customerEmail =
  parsed.customerEmail && parsed.customerEmail !== forwardedByEmail
    ? parsed.customerEmail
    : aiExtracted?.customer_email || null;

const customerName =
  bodyName ||
  aiExtracted?.customer_name ||
  "Customer";

const details =
  cleanBody(cleanCustomerMessage || aiExtracted?.details || parsed.details || rawText) ||
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

console.log("FORWARDED EXTRACTION RESULT:", {
forwardedByEmail,
customerEmail,
customerName,
finalSubject,
detectedJobType,
detectedUrgency,
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
details,
status: "requested",
stage: "requested",
job_type: detectedJobType,
urgency: detectedUrgency,
postcode: null,
address: null,
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
};

if (customerName && customerName !== "Customer") {
updates.customer_name = customerName;
}

if (customerEmail && customerEmail !== forwardedByEmail) {
updates.customer_email = customerEmail;
}

if (details) {
updates.details = details;
}

if (detectedJobType) {
updates.job_type = detectedJobType;
}

if (detectedUrgency) {
updates.urgency = detectedUrgency;
}

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