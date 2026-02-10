export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supabaseServer() {
const cookieStore = cookies();
return createServerClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
{
cookies: {
get(name: string) {
return cookieStore.get(name)?.value;
},
set(name: string, value: string, options: any) {
cookieStore.set({ name, value, ...options });
},
remove(name: string, options: any) {
cookieStore.set({ name, value: "", ...options });
},
},
}
);
}

export async function GET() {
const supabase = supabaseServer();

const {
data: { user },
} = await supabase.auth.getUser();

if (!user) {
return NextResponse.json(
{ ok: false, error: "Not authenticated" },
{ status: 401 }
);
}

// ✅ These MUST match your actual pages' tables/filters.
// If your Messages page uses a different table, change it here.
const [messages, requests, quotes, bookings, invoices] = await Promise.all([
supabase
.from("quote_requests")
.select("id", { head: true, count: "exact" })
.eq("status", "requested")
.is("plumber_id", null),

supabase
.from("requests")
.select("id", { head: true, count: "exact" })
.eq("user_id", user.id),

// If you don’t have a quotes table, change this to match your quotes page logic
supabase
.from("quotes")
.select("id", { head: true, count: "exact" })
.eq("user_id", user.id),

supabase
.from("bookings")
.select("id", { head: true, count: "exact" })
.eq("user_id", user.id),

supabase
.from("invoices")
.select("id", { head: true, count: "exact" })
.eq("user_id", user.id),
]);

// Helper to read count safely
const getCount = (r: any) => (r?.error ? 0 : r?.count ?? 0);

return NextResponse.json({
ok: true,
counts: {
messages: getCount(messages),
requests: getCount(requests),
quotes: getCount(quotes),
bookings: getCount(bookings),
invoices: getCount(invoices),
},
// optional debug so you can see if a table name is wrong
errors: {
messages: messages.error?.message ?? null,
requests: requests.error?.message ?? null,
quotes: quotes.error?.message ?? null,
bookings: bookings.error?.message ?? null,
invoices: invoices.error?.message ?? null,
},
});
}
