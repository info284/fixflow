import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const BUCKET = "quote-files";
const resend = new Resend(process.env.RESEND_API_KEY!);

function safeFileName(name: string) {
  return (name || "file")
    .replaceAll(" ", "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120);
}

function niceText(value: string | null) {
  if (!value) return "—";

  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatBudget(budget: string | null) {
  if (!budget) return "No budget";

  if (budget === "under-100") return "Under £100";
  if (budget === "100-250") return "£100–£250";
  if (budget === "250-500") return "£250–£500";
  if (budget === "500-1000") return "£500–£1,000";
  if (budget === "1000-3000") return "£1,000–£3,000";
  if (budget === "3000-plus") return "£3,000+";
  if (budget === "not-sure") return "Not sure";

  return budget.startsWith("£") ? budget : `£${budget}`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const slug = String(formData.get("slug") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const postcode = String(formData.get("postcode") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const job_type = String(formData.get("job_type") || "").trim();
    const problem_location = String(formData.get("problem_location") || "").trim();
    const urgency = String(formData.get("urgency") || "").trim();
    const is_still_working = String(formData.get("is_still_working") || "").trim();
    const has_happened_before = String(formData.get("has_happened_before") || "").trim();
    const budget = String(formData.get("budget") || "").trim();
    const parking = String(formData.get("parking") || "").trim();
    const property_type = String(formData.get("property_type") || "").trim();
    const details = String(formData.get("details") || "").trim();

    const files = formData.getAll("files").filter(Boolean) as File[];

    if (!slug || !name || !email || !postcode || !address || !job_type || !urgency || !details) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: trader, error: traderError } = await supabase
      .from("profiles")
      .select("id, slug, display_name, business_name, notify_email")
      .eq("slug", slug)
      .single();

    if (traderError || !trader) {
      return NextResponse.json(
        { error: "Trader not found", debug: traderError?.message || null },
        { status: 404 }
      );
    }

    const { data: enquiry, error: insertError } = await supabase
      .from("quote_requests")
      .insert({
        plumber_id: trader.id,
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        postcode,
        address,
        job_type,
        problem_location: problem_location || null,
        urgency,
        is_still_working: is_still_working || null,
        has_happened_before: has_happened_before || null,
        budget: budget || null,
        parking: parking || null,
        property_type: property_type || null,
        details,
        status: "requested",
        read_at: null,
      })
      .select("id, job_number")
      .single();

    if (insertError || !enquiry) {
      return NextResponse.json(
        { error: "Insert failed", debug: insertError?.message || null },
        { status: 500 }
      );
    }

    const uploadErrors: string[] = [];

    for (const file of files) {
      try {
        if (!file || file.size === 0) continue;

        const arrayBuffer = await file.arrayBuffer();
        const filePath = `request/${enquiry.id}/customer/${safeFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, arrayBuffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          uploadErrors.push(`${file.name}: ${uploadError.message}`);
        }
      } catch (err: any) {
        uploadErrors.push(`${file.name}: ${err?.message || "Upload failed"}`);
      }
    }

    let customerEmailError: string | null = null;

    try {
      const traderName =
        trader.business_name || trader.display_name || "the trader";

      const subject = `Your FixFlow request has been sent — ${enquiry.job_number || "Job received"}`;

      const text = `
Hi ${name},

Your request has been sent to ${traderName} successfully.

Job number: ${enquiry.job_number || "Pending"}

Here is a copy of your request:

Job type: ${niceText(job_type)}
Problem location: ${niceText(problem_location)}
Postcode: ${postcode || "—"}
Address: ${address || "—"}

Urgency: ${niceText(urgency)}
Still working: ${niceText(is_still_working)}
Happened before: ${niceText(has_happened_before)}
Budget: ${formatBudget(budget)}
Parking / access: ${niceText(parking)}
Property type: ${niceText(property_type)}

Details:
${details || "—"}

Files attached: ${files.length}

Your details were sent directly to the trader via FixFlow.

If you need to refer to this request later, please use job number ${enquiry.job_number || "Pending"}.

The trader will reply as soon as possible.

Thanks,
FixFlow
      `.trim();

      const { data, error } = await resend.emails.send({
        from: "FixFlow <hello@send.thefixflowapp.com>",
        to: [email],
        subject,
        text,
      });

      if (error) {
        customerEmailError = JSON.stringify(error);
        console.error("Customer confirmation email failed:", error);
      } else {
        console.log("Customer confirmation email sent:", data);
      }
    } catch (emailErr: any) {
      customerEmailError = emailErr?.message || "Unknown email error";
      console.error("Customer confirmation email failed:", emailErr);
    }

    return NextResponse.json({
      ok: true,
      id: enquiry.id,
      job_number: enquiry.job_number || null,
      uploaded_files: files.length,
      upload_errors: uploadErrors,
      customer_email_error: customerEmailError,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", debug: e?.message || null },
      { status: 500 }
    );
  }
}