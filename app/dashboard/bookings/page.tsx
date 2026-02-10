"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type BookingRow = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  service_id: string | null;
  details: string | null;
  status: string | null;
  user_id: string | null;

  booked_start?: string | null;
  booked_end?: string | null;
  calendar_event_id?: string | null;
  calendar_html_link?: string | null;
};

type Service = { id: string; name: string; user_id?: string | null };

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function BookingsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setErr("You must be logged in to view bookings.");
        setLoading(false);
        return;
      }

      const [{ data: reqData, error: reqErr }, { data: svcData, error: svcErr }] =
        await Promise.all([
          supabase
            .from("requests")
            .select(
              "id, created_at, name, email, phone, postcode, service_id, details, status, user_id, booked_start, booked_end, calendar_event_id, calendar_html_link"
            )
            .eq("user_id", user.id)
            .order("booked_start", { ascending: true }),
          supabase.from("services").select("id, name, user_id").eq("user_id", user.id),
        ]);

      if (reqErr) {
        setErr(reqErr.message);
        setRows([]);
      } else {
        const all = (reqData || []) as BookingRow[];
        setRows(
          all.filter(
            (r) => r.status === "booked" || r.calendar_event_id || r.calendar_html_link
          )
        );
      }

      if (svcErr) {
        console.error("Services load error:", svcErr.message);
        setServices([]);
      } else {
        setServices((svcData || []) as Service[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const serviceNameById = (id: string | null) => {
    if (!id) return "—";
    const s = services.find((x) => x.id === id);
    return s?.name || "Unknown service";
  };

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;

    return rows.filter((r) => {
      const fields = [
        r.name || "",
        r.email || "",
        r.phone || "",
        r.postcode || "",
        r.details || "",
        serviceNameById(r.service_id),
      ];
      return fields.some((f) => f.toLowerCase().includes(t));
    });
  }, [rows, search, services]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="text-sm text-gray-500">
            All jobs you’ve booked into your calendar.
          </p>
        </div>

        <Link
          href="/dashboard/quotes"
          className="text-sm rounded-md border px-3 py-2 hover:bg-gray-50"
        >
          Back to quotes
        </Link>
      </div>

      <div className="mb-4">
        <input
          className="w-full sm:max-w-sm rounded-md border px-3 py-2 text-sm"
          placeholder="Search bookings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <p className="text-sm text-gray-500">Loading bookings…</p>}
      {err && <p className="text-sm text-red-600">Couldn&apos;t load: {err}</p>}

      {!loading && !err && filtered.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          <p className="font-medium mb-1">No bookings yet.</p>
          <p>Open a quote and click “Book job” to add it to Google Calendar.</p>
        </div>
      )}

      {!loading && !err && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Start
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Customer
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Service
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Postcode
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Calendar
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {fmt(r.booked_start)}
                    <div className="text-xs text-gray-500">
                      End: {fmt(r.booked_end)}
                    </div>
                  </td>

                  <td className="px-3 py-2 align-top">
                    {r.name || "No name"}
                    {r.email && (
                      <div className="text-xs text-gray-500">{r.email}</div>
                    )}
                  </td>

                  <td className="px-3 py-2 align-top">
                    {serviceNameById(r.service_id)}
                  </td>

                  <td className="px-3 py-2 align-top">{r.postcode || "—"}</td>

                  <td className="px-3 py-2 align-top">
                    {r.calendar_html_link ? (
                      <a
                        href={r.calendar_html_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                    <Link
                      href={`/dashboard/quotes/${r.id}`}
                      className="text-xs rounded-md border px-3 py-1 hover:bg-gray-100"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
