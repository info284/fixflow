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
  if (!budget) return "Not specified";

  if (budget === "under-100") return "Under £100";
  if (budget === "100-250") return "£100–£250";
  if (budget === "250-500") return "£250–£500";
  if (budget === "500-1000") return "£500–£1,000";
  if (budget === "1000-3000") return "£1,000–£3,000";
  if (budget === "3000-plus") return "£3,000+";
  if (budget === "not-sure") return "Not sure";

  return budget.startsWith("£") ? budget : `£${budget}`;
}

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getUrgencyBadge(urgency: string | null) {
  const value = String(urgency || "").toLowerCase().trim();

  if (value.includes("asap") || value.includes("urgent") || value.includes("today")) {
    return {
      label: "ASAP",
      bg: "#FEF2F2",
      border: "#FECACA",
      text: "#B91C1C",
    };
  }

  if (value.includes("this week")) {
    return {
      label: "This week",
      bg: "#FFF7ED",
      border: "#FED7AA",
      text: "#C2410C",
    };
  }

  if (value.includes("next week")) {
    return {
      label: "Next week",
      bg: "#EFF6FF",
      border: "#BFDBFE",
      text: "#1D4ED8",
    };
  }

  return {
    label: "Flexible",
    bg: "#F8FAFC",
    border: "#CBD5E1",
    text: "#475569",
  };
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
      .select("id, slug, display_name, business_name, notify_email, logo_url")
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
    let traderEmailError: string | null = null;

    const traderName =
      trader.business_name || trader.display_name || "the trader";

    const safeJobNumber = enquiry.job_number || "Pending";
    const safeJobType = niceText(job_type);
    const safeProblemLocation = niceText(problem_location);
    const safeUrgency = niceText(urgency);
    const safeStillWorking = niceText(is_still_working);
    const safeHappenedBefore = niceText(has_happened_before);
    const safeBudget = formatBudget(budget);
    const safeParking = niceText(parking);
    const safePropertyType = niceText(property_type);
    const safePostcode = postcode || "—";
    const safeAddress = address || "—";
    const safeDetails = details || "—";
    const safeFilesCount = files.length;
    const safeTraderName = traderName;
    const safeCustomerName = name;
    const safeCustomerEmail = email || "Not provided";
    const safeCustomerPhone = phone || "Not provided";

    const urgencyBadge = getUrgencyBadge(urgency);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

    const enquiryUrl = `${appUrl}/dashboard/enquiries?enquiryId=${enquiry.id}`;

    try {
      const subject = `Your FixFlow request has been sent — ${safeJobNumber}`;

      const text = `
Hi ${safeCustomerName},

Your request has been sent to ${safeTraderName} successfully.

Job reference: ${safeJobNumber}

What happens next:
- The trader reviews your request
- They may contact you for more details
- You may receive a quote or site visit offer

Your request summary:

Job type: ${safeJobType}
Problem location: ${safeProblemLocation}
Urgency: ${safeUrgency}
Still working: ${safeStillWorking}
Happened before: ${safeHappenedBefore}
Budget: ${safeBudget}
Parking / access: ${safeParking}
Property type: ${safePropertyType}
Postcode: ${safePostcode}
Address: ${safeAddress}

Details:
${safeDetails}

Files attached: ${safeFilesCount}

Thanks,
FixFlow
      `.trim();

      const html = `
      <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
          <div style="background:#ffffff;border:1px solid #e6ecf5;border-radius:24px;overflow:hidden;box-shadow:0 12px 28px rgba(15,23,42,0.08);">
            
            <div style="height:3px;background:linear-gradient(90deg, rgba(143,169,214,0.78), rgba(143,169,214,0.20), rgba(143,169,214,0));"></div>

            <div style="padding:24px;background:linear-gradient(135deg, rgba(220,232,250,0.34), rgba(255,255,255,0.96));border-bottom:1px solid #e6ecf5;">
              <div style="display:flex;align-items:flex-start;gap:14px;">
                ${
                  trader.logo_url
                    ? `<img src="${escapeHtml(trader.logo_url)}" alt="${escapeHtml(
                        safeTraderName
                      )}" width="52" height="52" style="width:52px;height:52px;border-radius:14px;object-fit:cover;border:1px solid rgba(143,169,214,0.22);background:#ffffff;" />`
                    : `<div style="width:52px;height:52px;border-radius:14px;background:#ffffff;border:1px solid rgba(143,169,214,0.22);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#1F355C;">${escapeHtml(
                        safeTraderName.charAt(0).toUpperCase()
                      )}</div>`
                }
                <div style="min-width:0;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,53,92,0.58);">
                    FixFlow confirmation
                  </div>
                  <div style="margin-top:4px;font-size:28px;line-height:1.15;font-weight:800;color:#1F355C;">
                    Request sent successfully
                  </div>
                  <div style="margin-top:12px;font-size:15px;line-height:1.7;color:rgba(31,53,92,0.72);">
                    Your request has been sent directly to <strong style="color:#1F355C;">${escapeHtml(
                      safeTraderName
                    )}</strong>. They’ll review the details and may contact you shortly.
                  </div>
                  <div style="margin-top:16px;">
                    <span style="display:inline-block;padding:10px 14px;border-radius:999px;background:#ecfdf3;border:1px solid #bbf7d0;font-size:13px;font-weight:700;color:#166534;">
                      Job reference: ${escapeHtml(safeJobNumber)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style="padding:24px;">
              <div style="border:1px solid #e6ecf5;border-radius:18px;background:#f8fbff;padding:18px 18px 16px;">
                <div style="font-size:16px;font-weight:800;color:#1F355C;">
                  What happens next
                </div>

                <div style="margin-top:14px;font-size:14.5px;line-height:1.7;color:rgba(31,53,92,0.72);">
                  <div style="margin-bottom:8px;">• The trader reviews your request and any photos attached.</div>
                  <div style="margin-bottom:8px;">• They may contact you by email or phone for more detail.</div>
                  <div>• You may receive a quote or a site visit offer next.</div>
                </div>
              </div>

              <div style="margin-top:18px;border:1px solid #e6ecf5;border-radius:18px;background:#ffffff;overflow:hidden;">
                <div style="padding:14px 16px;background:#f8fbff;border-bottom:1px solid #e6ecf5;">
                  <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,53,92,0.54);">
                    Your request summary
                  </div>
                </div>

                <div style="padding:16px;">
                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Job type</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeJobType)}</span>
                  </div>

                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Problem location</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeProblemLocation)}</span>
                  </div>

                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Urgency</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeUrgency)}</span>
                  </div>

                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Still working</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeStillWorking)}</span>
                  </div>

                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Happened before</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeHappenedBefore)}</span>
                  </div>

                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Budget</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeBudget)}</span>
                  </div>

                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Parking / access</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeParking)}</span>
                  </div>

                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Property type</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safePropertyType)}</span>
                  </div>

                  <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                    <span style="color:#64748b;">Postcode</span>
                    <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safePostcode)}</span>
                  </div>

                  <div style="padding:10px 0 0;font-size:14px;line-height:1.7;color:#0f172a;clear:both;">
                    <div style="font-size:13px;font-weight:700;color:#64748b;margin-bottom:4px;">Address</div>
                    <div>${escapeHtml(safeAddress)}</div>
                  </div>
                </div>
              </div>

              <div style="margin-top:18px;border:1px solid #e6ecf5;border-radius:18px;background:#ffffff;padding:16px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,53,92,0.54);margin-bottom:8px;">
                  Details
                </div>
                <div style="font-size:14px;line-height:1.7;color:#0f172a;white-space:pre-wrap;">${escapeHtml(safeDetails)}</div>
              </div>

              <div style="margin-top:18px;border:1px solid #e6ecf5;border-radius:18px;background:#ffffff;padding:16px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,53,92,0.54);margin-bottom:8px;">
                  Files attached
                </div>
                <div style="font-size:14px;line-height:1.7;color:#0f172a;">
                  ${safeFilesCount} ${safeFilesCount === 1 ? "file" : "files"} attached
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      `;

      const { error } = await resend.emails.send({
        from: "FixFlow <hello@send.thefixflowapp.com>",
        to: [email],
        subject,
        text,
        html,
      });

      if (error) {
        customerEmailError = JSON.stringify(error);
        console.error("Customer confirmation email failed:", error);
      }
    } catch (emailErr: any) {
      customerEmailError = emailErr?.message || "Unknown email error";
      console.error("Customer confirmation email failed:", emailErr);
    }

    try {
      const traderNotifyEmail = String(trader.notify_email || "").trim();

      if (traderNotifyEmail) {
        const traderSubject = `New enquiry received — ${safeJobNumber}`;

        const traderText = `
Hi ${safeTraderName},

You’ve received a new enquiry through FixFlow.

Job reference: ${safeJobNumber}
Urgency: ${safeUrgency}
Views: 0

Customer: ${safeCustomerName}
Email: ${safeCustomerEmail}
Phone: ${safeCustomerPhone}

Job type: ${safeJobType}
Problem location: ${safeProblemLocation}
Budget: ${safeBudget}
Postcode: ${safePostcode}
Address: ${safeAddress}

Details:
${safeDetails}

Files attached: ${safeFilesCount}

View enquiry:
${enquiryUrl}
        `.trim();

        const traderHtml = `
        <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
            <div style="background:#ffffff;border:1px solid #e6ecf5;border-radius:24px;overflow:hidden;box-shadow:0 12px 28px rgba(15,23,42,0.08);">
              
              <div style="height:3px;background:linear-gradient(90deg, rgba(143,169,214,0.78), rgba(143,169,214,0.20), rgba(143,169,214,0));"></div>

              <div style="padding:24px;background:linear-gradient(135deg, rgba(220,232,250,0.34), rgba(255,255,255,0.96));border-bottom:1px solid #e6ecf5;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,53,92,0.58);">
                  FixFlow notification
                </div>

                <div style="margin-top:4px;font-size:28px;line-height:1.15;font-weight:800;color:#1F355C;">
                  New enquiry received
                </div>

                <div style="margin-top:12px;font-size:15px;line-height:1.7;color:rgba(31,53,92,0.72);">
                  You’ve received a new enquiry through <strong style="color:#1F355C;">FixFlow</strong>.
                </div>

                <div style="margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;">
                  <span style="display:inline-block;padding:10px 14px;border-radius:999px;background:#eef4ff;border:1px solid #dbe6ff;font-size:13px;font-weight:700;color:#1f355c;">
                    Job reference: ${escapeHtml(safeJobNumber)}
                  </span>

                  <span style="display:inline-block;padding:10px 14px;border-radius:999px;background:${urgencyBadge.bg};border:1px solid ${urgencyBadge.border};font-size:13px;font-weight:700;color:${urgencyBadge.text};">
                    ${escapeHtml(urgencyBadge.label)}
                  </span>

                  <span style="display:inline-block;padding:10px 14px;border-radius:999px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#475569;">
                    0 views
                  </span>
                </div>

                <div style="margin-top:18px;">
                  <a
                    href="${escapeHtml(enquiryUrl)}"
                    style="
                      display:inline-block;
                      padding:14px 22px;
                      background:#1F355C;
                      color:#ffffff;
                      border-radius:12px;
                      text-decoration:none;
                      font-weight:700;
                      font-size:14px;
                      box-shadow:0 10px 24px rgba(31,53,92,0.18);
                    "
                  >
                    View enquiry
                  </a>
                </div>
              </div>

              <div style="padding:24px;">
                <div style="border:1px solid #e6ecf5;border-radius:18px;background:#ffffff;overflow:hidden;">
                  <div style="padding:14px 16px;background:#f8fbff;border-bottom:1px solid #e6ecf5;">
                    <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,53,92,0.54);">
                      Enquiry summary
                    </div>
                  </div>

                  <div style="padding:16px;">
                    <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                      <span style="color:#64748b;">Customer</span>
                      <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeCustomerName)}</span>
                    </div>

                    <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                      <span style="color:#64748b;">Email</span>
                      <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeCustomerEmail)}</span>
                    </div>

                    <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                      <span style="color:#64748b;">Phone</span>
                      <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeCustomerPhone)}</span>
                    </div>

                    <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                      <span style="color:#64748b;">Job type</span>
                      <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeJobType)}</span>
                    </div>

                    <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                      <span style="color:#64748b;">Problem location</span>
                      <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeProblemLocation)}</span>
                    </div>

                    <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                      <span style="color:#64748b;">Budget</span>
                      <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safeBudget)}</span>
                    </div>

                    <div style="padding:7px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
                      <span style="color:#64748b;">Postcode</span>
                      <span style="float:right;font-weight:700;color:#0f172a;">${escapeHtml(safePostcode)}</span>
                    </div>

                    <div style="padding:10px 0 0;font-size:14px;line-height:1.7;color:#0f172a;clear:both;">
                      <div style="font-size:13px;font-weight:700;color:#64748b;margin-bottom:4px;">Address</div>
                      <div>${escapeHtml(safeAddress)}</div>
                    </div>
                  </div>
                </div>

                <div style="margin-top:18px;border:1px solid #e6ecf5;border-radius:18px;background:#ffffff;padding:16px;">
                  <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,53,92,0.54);margin-bottom:8px;">
                    Job details
                  </div>
                  <div style="font-size:14px;line-height:1.7;color:#0f172a;white-space:pre-wrap;">${escapeHtml(safeDetails)}</div>
                </div>

                <div style="margin-top:18px;border:1px solid #e6ecf5;border-radius:18px;background:#ffffff;padding:16px;">
                  <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,53,92,0.54);margin-bottom:8px;">
                    Photos attached
                  </div>
                  <div style="font-size:14px;line-height:1.7;color:#0f172a;">
                    ${safeFilesCount} ${safeFilesCount === 1 ? "photo/file" : "photos/files"} attached
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        `;

        const { error } = await resend.emails.send({
          from: "FixFlow <hello@send.thefixflowapp.com>",
          to: [traderNotifyEmail],
          subject: traderSubject,
          text: traderText,
          html: traderHtml,
          replyTo: email,
        });

        if (error) {
          traderEmailError = JSON.stringify(error);
          console.error("Trader notification email failed:", error);
        }
      }
    } catch (emailErr: any) {
      traderEmailError = emailErr?.message || "Unknown trader email error";
      console.error("Trader notification email failed:", emailErr);
    }

    return NextResponse.json({
      ok: true,
      id: enquiry.id,
      job_number: enquiry.job_number || null,
      uploaded_files: files.length,
      upload_errors: uploadErrors,
      customer_email_error: customerEmailError,
      trader_email_error: traderEmailError,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", debug: e?.message || null },
      { status: 500 }
    );
  }
}