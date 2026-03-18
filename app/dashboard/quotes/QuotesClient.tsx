"use client";

import { useEffect, useMemo, useState, ChangeEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type RequestRow = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  service_id: string | null;
  details: string | null;
  status: string | null;
  notes: string | null;
  user_id: string | null;

  booked_start?: string | null;
  booked_end?: string | null;
  calendar_event_id?: string | null;
  calendar_html_link?: string | null;
};

type Service = {
  id: string;
  name: string;
  user_id?: string | null;
};

function statusLabel(status: string | null) {
  if (!status) return "New";
  switch (status) {
    case "new":
      return "New";
    case "quoted":
      return "Quoted";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    case "booked":
      return "Booked";
    default:
      return status;
  }
}

function statusClass(status: string | null) {
  switch (status) {
    case "new":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "quoted":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "won":
    case "booked":
      return "bg-green-50 text-green-700 border-green-200";
    case "lost":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

export default function QuotesClient() {
  const [userId, setUserId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMsg("You must be logged in to view quotes.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const [{ data: reqData, error: reqError }, { data: svcData, error: svcError }] =
        await Promise.all([
          supabase
            .from("requests")
            .select(
              "id, created_at, name, email, phone, postcode, service_id, details, status, notes, user_id, booked_start, booked_end, calendar_event_id, calendar_html_link"
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase.from("services").select("id, name, user_id").eq("user_id", user.id),
        ]);

      if (reqError) {
        setErrorMsg(reqError.message);
        setRequests([]);
      } else {
        setRequests((reqData || []) as RequestRow[]);
      }

      if (svcError) {
        console.error("Error loading services:", svcError.message);
        setServices([]);
      } else {
        setServices((svcData || []) as Service[]);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const serviceNameById = (id: string | null) => {
    if (!id) return "—";
    const svc = services.find((s) => s.id === id);
    return svc ? svc.name : "Unknown service";
  };

  const isBooked = (r: RequestRow) => Boolean(r.calendar_event_id || r.calendar_html_link);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return requests.filter((req) => {
      if (statusFilter !== "all") {
        const s = (req.status || "new").toLowerCase();
        if (s !== statusFilter) return false;
      }

      if (!term) return true;

      const fields: string[] = [];
      if (req.name) fields.push(req.name);
      if (req.email) fields.push(req.email);
      if (req.phone) fields.push(req.phone);
      if (req.postcode) fields.push(req.postcode);
      if (req.details) fields.push(req.details);

      const svcName = serviceNameById(req.service_id);
      if (svcName) fields.push(svcName);

      return fields.some((f) => f.toLowerCase().includes(term));
    });
  }, [requests, statusFilter, searchTerm, services]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Quotes</h1>
          <p className="text-sm text-gray-500">View and manage your customer quote requests.</p>
          {userId && <p className="text-[11px] text-gray-400 mt-1">User: {userId}</p>}
        </div>

        <Link href="/dashboard/request" className="text-sm rounded-md border px-3 py-2 hover:bg-gray-50">
          + New quote
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-xs font-medium text-gray-600">
          Status
          <select
            value={statusFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
            className="mt-1 sm:mt-0 sm:ml-2 rounded-md border px-2 py-1 text-xs"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="quoted">Quoted</option>
            <option value="won">Won</option>
            <option value="booked">Booked</option>
            <option value="lost">Lost</option>
          </select>
        </label>

        <div className="flex-1 sm:max-w-xs">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, email, postcode, service, details…"
            className="w-full rounded-md border px-3 py-2 text-xs"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500 mb-4">Loading quotes…</p>}

      {errorMsg && <p className="text-sm text-red-600 mb-4">Couldn&apos;t load quotes: {errorMsg}</p>}

      {!loading && !errorMsg && filteredRequests.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          <p className="font-medium mb-1">No quotes found.</p>
          <p>Try changing the status filter or clearing the search box.</p>
        </div>
      )}

      {!loading && filteredRequests.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Customer</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Service</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Postcode</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Booked</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Details</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>

            <tbody>
              {filteredRequests.map((req) => (
                <tr key={req.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 align-top whitespace-nowrap">{formatDate(req.created_at)}</td>

                  <td className="px-3 py-2 align-top">
                    {req.name || "No name"}
                    {req.email && <div className="text-xs text-gray-500">{req.email}</div>}
                    {req.phone && <div className="text-xs text-gray-500">{req.phone}</div>}
                  </td>

                  <td className="px-3 py-2 align-top">{serviceNameById(req.service_id)}</td>
                  <td className="px-3 py-2 align-top">{req.postcode || "—"}</td>

                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(
                        req.status || "new"
                      )}`}
                    >
                      {statusLabel(req.status || "new")}
                    </span>
                  </td>

                  <td className="px-3 py-2 align-top">
                    {isBooked(req) ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Booked ✅
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2 align-top max-w-xs">
                    <span className="line-clamp-2">{req.details || "No details"}</span>
                  </td>

                  <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                    <Link
                      href={`/dashboard/quotes/${req.id}`}
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
