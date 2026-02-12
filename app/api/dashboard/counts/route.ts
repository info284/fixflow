export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

const getCount = (r: any) => (r?.error ? 0 : r?.count ?? 0);

export async function GET() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const traderId = user.id;

  const [
    enquiriesAll,
    enquiriesUnread,
    enquiriesNotReplied,
    estimates,
    bookings,
    invoices,
  ] = await Promise.all([
    // ALL enquiries
    supabase
      .from("quote_requests")
      .select("id", { head: true, count: "exact" })
      .eq("plumber_id", traderId),

    // UNREAD enquiries
    supabase
      .from("quote_requests")
      .select("id", { head: true, count: "exact" })
      .eq("plumber_id", traderId)
      .is("read_at", null),

    // NOT REPLIED enquiries  ✅ THIS = NEW ENQUIRIES
    supabase
      .from("quote_requests")
      .select("id", { head: true, count: "exact" })
      .eq("plumber_id", traderId)
      .not("status", "ilike", "%replied%"),

    // ESTIMATES
    supabase
      .from("quotes")
      .select("id", { head: true, count: "exact" })
      .eq("plumber_id", traderId),

    // BOOKINGS
    supabase
      .from("requests")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", traderId)
      .or("status.eq.booked,calendar_event_id.not.is.null,calendar_html_link.not.is.null"),

    // INVOICES
    supabase
      .from("invoices")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", traderId),
  ]);

  return NextResponse.json({
    ok: true,
    counts: {
      // 👇 used by inbox page tabs
      enquiries_all: getCount(enquiriesAll),
      enquiries_unread: getCount(enquiriesUnread),
      enquiries_notReplied: getCount(enquiriesNotReplied),

      // 👇 sidebar badge
      enquiries: getCount(enquiriesNotReplied),

      // 👇 dashboard cards
      messages: getCount(enquiriesNotReplied), // New enquiries card
      quotes: getCount(estimates),
      bookings: getCount(bookings),
      invoices: getCount(invoices),
    },
  });
}