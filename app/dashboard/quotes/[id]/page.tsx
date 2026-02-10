import { redirect } from "next/navigation";

export default function QuoteRedirectPage({ params }: { params: { id: string } }) {
const id = params?.id || "";
redirect(`/dashboard/estimates?quoteId=${encodeURIComponent(id)}`);
}