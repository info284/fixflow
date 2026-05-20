import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function acceptQuickEstimate(id: string) {
  const supabase = getSupabase();
  const acceptedAt = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("quick_estimates")
    .select("accepted_at, request_id, plumber_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error("Estimate not found");

  const finalAcceptedAt = existing.accepted_at || acceptedAt;

  const { error } = await supabase
    .from("quick_estimates")
    .update({
      status: "accepted",
      accepted_at: finalAcceptedAt,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (existing.request_id) {
    const { error: requestError } = await supabase
      .from("quote_requests")
     .update({
  stage: "won",
})
      .eq("id", existing.request_id);

    if (requestError) throw new Error(requestError.message);

    await supabase.from("enquiry_messages").insert({
      request_id: existing.request_id,
      plumber_id: existing.plumber_id,
      direction: "out",
      channel: "status",
      subject: "Quick estimate accepted",
      body_text: "Customer accepted the quick estimate. Job is ready to be booked.",
    });
  }

  return finalAcceptedAt;
}

export async function GET(_: Request, { params }: RouteProps) {
  const { id } = await params;

  try {
    await acceptQuickEstimate(id);

    return new Response(
      `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Estimate accepted</title>
        </head>
        <body style="margin:0; font-family: Arial, sans-serif; background:#F6F8FC; color:#0B1320;">
          <div style="min-height:100vh; padding:28px 18px; box-sizing:border-box; display:flex; align-items:center; justify-content:center;">
            <div style="width:100%; max-width:560px; background:#ffffff; border:1px solid #E6ECF5; border-radius:28px; padding:28px; box-shadow:0 18px 50px rgba(11,42,85,0.12);">
              
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
                <div style="width:44px; height:44px; border-radius:14px; background:#0B2A55; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:22px;">
                  F
                </div>
                <div>
                  <div style="font-weight:900; font-size:20px; color:#0B2A55;">FixFlow</div>
                  <div style="font-size:13px; color:#5C6B84;">Customer estimate</div>
                </div>
              </div>

              <div style="background:#ECFDF3; border:1px solid #BFEFD0; color:#087443; border-radius:999px; display:inline-block; padding:8px 14px; font-weight:800; font-size:13px; margin-bottom:18px;">
                Accepted
              </div>

              <h1 style="font-size:34px; line-height:1.1; margin:0 0 14px; color:#0B1320;">
                Estimate accepted
              </h1>

              <p style="font-size:17px; line-height:1.7; color:#5C6B84; margin:0 0 24px;">
                Thanks &mdash; your trader has been notified and will be in touch shortly.
              </p>

              <div style="border:1px solid #E6ECF5; border-radius:22px; padding:20px; background:#F4F7FF;">
                <div style="font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#5C6B84; margin-bottom:10px;">
                  What happens next
                </div>

                <div style="display:grid; gap:12px; font-size:15px; line-height:1.5; color:#0B1320;">
                  <div>✓ Your acceptance has been saved.</div>
                  <div>✓ The job has moved into won work.</div>
                  <div>✓ The trader can now arrange the booking with you.</div>
                </div>
              </div>

            </div>
          </div>
        </body>
      </html>
      `,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (e: any) {
    return new Response(
      `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Could not accept estimate</title>
        </head>
        <body style="margin:0; font-family: Arial, sans-serif; background:#F6F8FC; color:#0B1320;">
          <div style="min-height:100vh; padding:28px 18px; display:flex; align-items:center; justify-content:center;">
            <div style="width:100%; max-width:560px; background:#ffffff; border:1px solid #FFD0D0; border-radius:28px; padding:28px;">
              <h1 style="margin:0 0 12px;">Could not accept estimate</h1>
              <p style="color:#5C6B84;">${e?.message || "This estimate could not be accepted."}</p>
            </div>
          </div>
        </body>
      </html>
      `,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing estimate id" }, { status: 400 });
    }

    const acceptedAt = await acceptQuickEstimate(id);

    return NextResponse.json({
      ok: true,
      accepted_at: acceptedAt,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to accept quick estimate" },
      { status: 500 }
    );
  }
}