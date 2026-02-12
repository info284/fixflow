"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CountResult = number | null;

export type DashboardStats = {
  loading: boolean;
  error: string | null;
  userId: string | null;

  // Used by your dashboard cards
  requestsNew: CountResult;   // New enquiries = UNREAD quote_requests
  requestsTotal: CountResult; // Total enquiries = ALL quote_requests

  quotesTotal: CountResult;       // estimates
  bookingsUpcoming: CountResult;  // bookings
  invoicesTotal: CountResult;
};

async function safeCount(
  table: string,
  filter: (q: any) => any
): Promise<CountResult> {
  try {
    let q = supabase.from(table).select("id", { head: true, count: "exact" });
    q = filter(q);
    const { count, error } = await q;

    if (error) {
      console.warn(`[safeCount] ${table} failed:`, error.message);
      return null;
    }
    return typeof count === "number" ? count : 0;
  } catch (e: any) {
    console.warn(`[safeCount] ${table} exception:`, e?.message || e);
    return null;
  }
}

export function useDashboardStats(): DashboardStats {
  const [state, setState] = useState<DashboardStats>({
    loading: true,
    error: null,
    userId: null,

    requestsNew: null,
    requestsTotal: null,

    quotesTotal: null,
    bookingsUpcoming: null,
    invoicesTotal: null,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setState((s) => ({ ...s, loading: true, error: null }));

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userErr || !user) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: "Not logged in",
            userId: null,
          }));
        }
        return;
      }

      const userId = user.id;

      // ✅ ENQUIRIES (MUST match /dashboard/inbox)
      // Total enquiries = ALL quote_requests for this plumber
      const requestsTotal = await safeCount("quote_requests", (q) =>
        q.eq("plumber_id", userId)
      );

      // New enquiries = UNREAD (read_at is null)
      const requestsNew = await safeCount("quote_requests", (q) =>
        q.eq("plumber_id", userId).is("read_at", null)
      );

      // ✅ ESTIMATES (adjust to .eq("user_id", userId) if your quotes table uses user_id)
      const quotesTotal = await safeCount("quotes", (q) =>
        q.eq("plumber_id", userId)
      );

      // ✅ BOOKINGS (MUST match your /dashboard/bookings page)
      // Your bookings page reads from requests where user_id = logged in user
      const bookingsUpcoming = await safeCount("requests", (q) =>
        q
          .eq("user_id", userId)
          .or(
            "status.eq.booked,calendar_event_id.not.is.null,calendar_html_link.not.is.null"
          )
      );

      const invoicesTotal = await safeCount("invoices", (q) =>
        q.eq("user_id", userId)
      );

      if (!cancelled) {
        setState({
          loading: false,
          error: null,
          userId,

          requestsNew,
          requestsTotal,

          quotesTotal,
          bookingsUpcoming,
          invoicesTotal,
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}