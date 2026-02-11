import { createClient } from "@supabase/supabase-js";

export default async function AcceptEstimatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find quote by accept token
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, customer_name")
    .eq("accept_token", token)
    .maybeSingle();

  if (!quote) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Estimate not found</h1>
        <p>This estimate link may have expired.</p>
      </div>
    );
  }

  // Mark as accepted (idempotent)
  if (quote.status !== "accepted") {
    await supabase
      .from("quotes")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", quote.id);
  }

  return (
    <div style={{ maxWidth: 600, margin: "60px auto", fontFamily: "system-ui" }}>
      <h1>Estimate accepted ✅</h1>
      <p>Thank you{quote.customer_name ? `, ${quote.customer_name}` : ""}.</p>
      <p>Your trader has been notified and will be in touch.</p>
    </div>
  );
}