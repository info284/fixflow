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
};

type Service = {
  id: string;
  name: string;
};

function statusLabel(status: string | null) {
  if (!status) return "new";
  switch (status) {
    case "new":
      return "New";
    case "quoted":
      return "Quoted";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
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
      return "bg-green-50 text-green-700 border-green-200";
    case "lost":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

export default function QuotesPage() {
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

      const [{ data: reqData, error: reqError }, { data: svcData, error: svcError }] =
        await Promise.all([
          supabase
            .from("requests")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase.from("services").select("id, name"),
        ]);

      if (reqError) {
        console.error("Error loading requests:", reqError.message);
        setErrorMsg(reqError.message);
      } else {
        setRequests((reqData || []) as RequestRow[]);
      }

      if (svcError) {
        console.error("Error loading services:", svcError.message);
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

  const handleStatusFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Apply filters + search in memory
  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return requests.filter((req) => {
      // status filter
      if (statusFilter !== "all") {
        const s = (req.status || "new").toLowerCase();
        if (s !== statusFilter) return false;
      }

      // search filter
      if (!term) return true;

      const fieldsToSearch: string[] = [];

      if (req.name) fieldsToSearch.push(req.name);
      if (req.email) fieldsToSearch.push(req.email);
      if (req.phone) fieldsToSearch.push(req.phone);
      if (req.postcode) fieldsToSearch.push(req.postcode);
      if (req.details) fieldsToSearch.push(req.details);

      const svcName = serviceNameById(req.service_id);
      if (svcName) fieldsToSearch.push(svcName);

      return fieldsToSearch.some((f) =>
        f.toLowerCase().includes(term)
      );
    });
  }, [requests, statusFilter, searchTerm, services]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Quotes</h1>
          <p className="text-sm text-gray-500">
            View and manage all customer quote requests.
          </p>
        </div>
        <Link
          href="/dashboard/request"
          className="text-sm rounded-md border px-3 py-2 hover:bg-gray-50"
        >
          + New quote
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-xs font-medium text-gray-600">
            Status
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="mt-1 sm:mt-0 sm:ml-2 rounded-md border px-2 py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="quoted">Quoted</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </label>
        </div>

        <div className="flex-1 sm:max-w-xs">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by name, email, postcode, service, details…"
            className="w-full rounded-md border px-3 py-2 text-xs"
          />
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 mb-4">Loading quotes…</p>
      )}

      {errorMsg && (
        <p className="text-sm text-red-600 mb-4">
          Couldn&apos;t load quotes: {errorMsg}
        </p>
      )}

      {!loading && !errorMsg && filteredRequests.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          <p className="font-medium mb-1">No quotes found.</p>
          <p>
            Try changing the status filter or clearing the search box.
          </p>
        </div>
      )}

      {!loading && filteredRequests.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Date
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
                  Status
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Notes
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Details
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr key={req.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {req.created_at
                      ? new Date(req.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {req.name || "No name"}
                    {req.email && (
                      <div className="text-xs text-gray-500">
                        {req.email}
                      </div>
                    )}
                    {req.phone && (
                      <div className="text-xs text-gray-500">
                        {req.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {serviceNameById(req.service_id)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {req.postcode || "—"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(
                        req.status
                      )}`}
                    >
                      {statusLabel(req.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {req.notes && req.notes.trim().length > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-white">
                        Notes
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top max-w-xs">
                    <span className="line-clamp-2">
                      {req.details || "No details"}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-right">
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
