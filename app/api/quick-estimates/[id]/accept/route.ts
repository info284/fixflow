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

function escapeHtml(value: unknown) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, display_name")
    .eq("id", existing.plumber_id)
    .maybeSingle();

  const traderName =
    profile?.business_name ||
    profile?.display_name ||
    "your trader";

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
      body_text: "Customer accepted the quick estimate. The trader can now arrange the next step.",
    });
  }

  return {
    accepted_at: finalAcceptedAt,
    traderName,
  };
}

function successHtml(traderName: string) {
  const safeTraderName = escapeHtml(traderName);

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quick estimate accepted</title>
  </head>

  <body style="margin:0; font-family: Arial, sans-serif; background:linear-gradient(180deg,#EEF4FF 0%,#F8FAFC 100%); color:#0B1320;">
    <div style="min-height:100vh; padding:28px 18px; box-sizing:border-box; display:flex; align-items:center; justify-content:center;">
      <div style="width:100%; max-width:620px; background:#ffffff; border:1px solid #E6ECF5; border-radius:32px; padding:30px; box-shadow:0 22px 60px rgba(11,42,85,0.14); box-sizing:border-box;">

        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:30px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:56px; height:56px; border-radius:18px; background:#0B2A55; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:28px;">
              F
            </div>

            <div>
              <div style="font-size:24px; font-weight:900; color:#0B2A55; line-height:1.1;">
                ${safeTraderName}
              </div>
              <div style="font-size:15px; color:#5C6B84; margin-top:4px;">
                Estimate powered by FixFlow
              </div>
            </div>
          </div>

          <div style="background:#ffffff; border:1px solid #E6ECF5; color:#1F355C; border-radius:999px; padding:10px 18px; font-weight:900; font-size:15px;">
            Accepted
          </div>
        </div>

        <div style="background:#ECFDF3; border:1px solid #BFEFD0; color:#087443; border-radius:999px; display:inline-block; padding:9px 16px; font-weight:900; font-size:14px; margin-bottom:20px;">
          Quick estimate accepted
        </div>

        <h1 style="font-size:42px; line-height:1.08; margin:0 0 16px; color:#0B1320;">
          Estimate accepted
        </h1>

        <p style="font-size:19px; line-height:1.7; color:#5C6B84; margin:0 0 28px;">
          Thanks &mdash; ${safeTraderName} has been notified and will be in touch shortly.
        </p>

        <div style="border:1px solid #E6ECF5; border-radius:24px; padding:24px; background:#F4F7FF;">
          <div style="font-size:13px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; color:#5C6B84; margin-bottom:14px;">
            What happens next
          </div>

          <div style="display:grid; gap:14px; font-size:17px; line-height:1.55; color:#0B1320;">
            <div>✓ Your acceptance has been saved.</div>
            <div>✓ ${safeTraderName} has been notified.</div>
            <div>✓ Your trader can now arrange the next step with you.</div>
          </div>
        </div>

      </div>
    </div>
  </body>
</html>
`;
}

function errorHtml(message: string) {
  return `
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
        <p style="color:#5C6B84;">${escapeHtml(message)}</p>
      </div>
    </div>
  </body>
</html>
`;
}

export async function GET(_: Request, { params }: RouteProps) {
  const { id } = await params;

  try {
    const result = await acceptQuickEstimate(id);

    return new Response(successHtml(result.traderName), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    return new Response(
      errorHtml(e?.message || "This estimate could not be accepted."),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing estimate id" }, { status: 400 });
    }

    const result = await acceptQuickEstimate(id);

    return NextResponse.json({
      ok: true,
      accepted_at: result.accepted_at,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to accept quick estimate" },
      { status: 500 }
    );
  }
}