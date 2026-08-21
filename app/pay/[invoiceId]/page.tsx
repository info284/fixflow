export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import PayInvoiceClient from "./PayInvoiceClient";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function PayPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;

  const supabase = supabaseAdmin();

  const { data: inv, error } = await supabase
    .from("invoices")
    .select(`
id,
user_id,
amount,
amount_before_deposit,
deposit_paid_amount,
currency,
invoice_number,
to_email,
status
`)
    .eq("id", invoiceId)
    .maybeSingle();



  if (!inv) return <div>Invoice not found.</div>;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, business_name, logo_url")
    .eq("id", inv.user_id)
    .maybeSingle();

  return (
    <PayInvoiceClient
      invoice={{
        ...inv,
        profiles: profile || null,
      }}
    />
  );
}