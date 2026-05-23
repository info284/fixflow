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

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, amount, currency, invoice_number, to_email, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!inv) return <div>Invoice not found.</div>;

  return <PayInvoiceClient invoice={inv} />;
}