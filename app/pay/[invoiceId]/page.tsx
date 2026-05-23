export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
    .select("id, amount, currency, invoice_number, to_email")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!inv) {
    return <div>Invoice not found.</div>;
  }

  const amount = Number(inv.amount || 0);

  if (!amount || amount <= 0) {
    return <div>Invalid invoice amount.</div>;
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://thefixflowapp.com";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: inv.to_email || undefined,
    line_items: [
      {
        price_data: {
          currency: inv.currency?.toLowerCase() || "gbp",
          product_data: {
            name: `Invoice ${inv.invoice_number || inv.id.slice(0, 8)}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/pay/receipt?invoiceId=${invoiceId}`,
    cancel_url: `${origin}/pay/${invoiceId}`,
    metadata: {
      invoiceId: inv.id,
    },
  });

  redirect(session.url!);
}