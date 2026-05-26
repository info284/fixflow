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

function money(value?: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function niceDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function trackQuickEstimateView(id: string) {
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("quick_estimates")
    .select("id, view_count, first_viewed_at")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) return;

  await supabase
    .from("quick_estimates")
    .update({
      view_count: Number(existing.view_count || 0) + 1,
      first_viewed_at: existing.first_viewed_at || nowIso,
      last_viewed_at: nowIso,
    })
    .eq("id", id);
}

async function acceptQuickEstimate(id: string) {
  const supabase = getSupabase();
  const acceptedAt = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("quick_estimates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error("Estimate not found");

  const finalAcceptedAt = existing.accepted_at || acceptedAt;

  const total =
    Number(existing.total_amount || 0) ||
    Number(existing.total || 0) ||
    Number(existing.labour_amount || 0) +
      Number(existing.materials_amount || 0) +
      Number(existing.other_amount || 0);

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, display_name")
    .eq("id", existing.plumber_id)
    .maybeSingle();

  const traderName =
    profile?.business_name || profile?.display_name || "your trader";

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
      .update({ stage: "won" })
      .eq("id", existing.request_id);

    if (requestError) throw new Error(requestError.message);

    await supabase.from("enquiry_messages").insert({
      request_id: existing.request_id,
      plumber_id: existing.plumber_id,
      direction: "out",
      channel: "status",
      subject: "Quick estimate accepted",
      body_text:
        "Customer accepted the quick estimate. The trader can now arrange the next step.",
    });
  }

  return {
    accepted_at: finalAcceptedAt,
    traderName,
    total,
  };
}

function successHtml(traderName: string, acceptedAt: string, total: number) {
  const safeTraderName = escapeHtml(traderName);
  const safeAcceptedAt = escapeHtml(niceDateTime(acceptedAt));
  const safeTotal = escapeHtml(money(total));

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Estimate accepted</title>
</head>

<body style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; background:#F6F8FC; color:#0B1320;">
  <div style="min-height:100vh; padding:28px 18px; box-sizing:border-box; background:
    radial-gradient(circle at 18% 8%, rgba(36,91,255,0.16), transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(11,42,85,0.12), transparent 30%),
    linear-gradient(180deg,#EEF4FF 0%,#F8FAFC 100%);
  ">
    <div style="width:100%; max-width:760px; margin:0 auto;">

      <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:28px;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="width:54px; height:54px; border-radius:16px; background:linear-gradient(180deg,#245BFF,#0B2A55); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:28px;">
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

      <div style="background:#ffffff; border:1px solid #E6ECF5; border-radius:32px; padding:30px; box-shadow:0 22px 60px rgba(11,42,85,0.14); box-sizing:border-box;">

        <div style="font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:#5C6B84; margin-bottom:18px;">
          Estimate review
        </div>

        <h1 style="font-size:44px; line-height:1.08; margin:0 0 18px; color:#0B1320; letter-spacing:-0.04em;">
          Estimate accepted
        </h1>

        <p style="font-size:19px; line-height:1.7; color:#5C6B84; margin:0 0 28px;">
          Thanks — ${safeTraderName} has received your confirmation and will be in touch shortly.
        </p>

        <div style="background:#ECFDF3; border:1px solid #BFEFD0; color:#087443; border-radius:999px; display:inline-block; padding:9px 16px; font-weight:900; font-size:14px; margin-bottom:24px;">
          ✓ Accepted
        </div>

        <div style="background:#0B2A55; color:#fff; border-radius:26px; padding:24px; margin-bottom:24px; box-shadow:0 18px 42px rgba(11,42,85,0.22);">
          <div style="font-size:15px; font-weight:800; opacity:.8; margin-bottom:8px;">
            Accepted estimate amount
          </div>
          <div style="font-size:40px; line-height:1; font-weight:950; letter-spacing:-0.04em;">
            ${safeTotal}
          </div>
          <div style="font-size:14px; opacity:.78; margin-top:10px;">
            No payment has been taken now.
          </div>
        </div>

        <div style="display:grid; gap:14px; margin-bottom:24px;">
          <div style="border:1px solid #E6ECF5; border-radius:18px; padding:18px; background:#F8FAFC;">
            <div style="font-size:14px; color:#5C6B84; font-weight:800; margin-bottom:8px;">Accepted at</div>
            <div style="font-size:18px; color:#0B1320; font-weight:900;">${safeAcceptedAt}</div>
          </div>

          <div style="border:1px solid #E6ECF5; border-radius:18px; padding:18px; background:#F8FAFC;">
            <div style="font-size:14px; color:#5C6B84; font-weight:800; margin-bottom:8px;">Status</div>
            <div style="font-size:18px; color:#0B1320; font-weight:900;">Accepted</div>
          </div>
        </div>

        <div style="border:1px solid #E6ECF5; border-radius:24px; padding:24px; background:#F4F7FF;">
          <div style="font-size:13px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; color:#5C6B84; margin-bottom:16px;">
            What happens next
          </div>

          <div style="display:grid; gap:14px; font-size:17px; line-height:1.55; color:#0B1320;">
            <div>✓ Your acceptance has been saved.</div>
            <div>✓ ${safeTraderName} has received your confirmation.</div>
            <div>✓ Your trader can now arrange the next step with you.</div>
          </div>
        </div>

      </div>
    </div>
  </div>
</body>
</html>
`;
}