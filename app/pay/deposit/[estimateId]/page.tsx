import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PayDepositClient from "./PayDepositClient";

function supabaseAdmin() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);
}

export default async function DepositPaymentPage({
params,
searchParams,
}: {
params: Promise<{ estimateId: string }>;
searchParams: Promise<{ type?: string }>;
}) {
const { estimateId } = await params;
const { type } = await searchParams;

const estimateType =
type === "detailed" ? "detailed" : "quick";

const table =
estimateType === "quick"
? "quick_estimates"
: "estimates";

const supabase = supabaseAdmin();

const { data: estimate, error } = await supabase
.from(table)
.select(`
id,
request_id,
plumber_id,
deposit_amount,
deposit_status
`)
.eq("id", estimateId)
.maybeSingle();

if (error || !estimate) {
notFound();
}

if (
!estimate.deposit_amount ||
Number(estimate.deposit_amount) <= 0
) {
notFound();
}

const { data: requestRow } = await supabase
.from("quote_requests")
.select(`
customer_name,
job_number,
job_type
`)
.eq("id", estimate.request_id)
.maybeSingle();

const { data: trader } = await supabase
.from("profiles")
.select(`
display_name,
business_name,
logo_url
`)
.eq("id", estimate.plumber_id)
.maybeSingle();

const depositEstimate = {
id: estimate.id,
estimate_type: estimateType as "quick" | "detailed",
deposit_amount: Number(estimate.deposit_amount),
deposit_status: estimate.deposit_status || "requested",
request_id: estimate.request_id,
customer_name: requestRow?.customer_name || null,
job_number: requestRow?.job_number || null,
job_type: requestRow?.job_type || null,
profiles: trader || null,
};

return <PayDepositClient estimate={depositEstimate} />;
}