"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ================================
   TYPES (match Enquiries approach)
================================ */

type QuoteRequestRow = {
  id: string;
  job_number: string | null;
  plumber_id: string;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  postcode: string | null;
  address: string | null;

  job_type: string | null;
  urgency: string | null;
  details: string | null;

  status: string | null;
  created_at: string;

  trader_notes: string | null;

  calendar_html_link: string | null;
  site_visit_start: string | null;

  job_booked_at: string | null;
  job_calendar_html_link: string | null;
};

type SiteVisitRow = {
  id: string;
  request_id: string;
  plumber_id: string;
  starts_at: string;
  duration_mins: number;
  created_at: string;
};

/* ================================
   HELPERS
================================ */

function titleCase(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function nice(s?: string | null) {
  return (s || "").trim() || "—";
}

function niceDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      year: "2-digit",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function niceDateOnly(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString([], {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function urgencyChip(u?: string | null) {
  const v = String(u || "").toLowerCase();
  if (v.includes("asap") || v.includes("urgent") || v.includes("today")) {
    return { text: "ASAP", cls: "ff-chip ff-chipRed" };
  }
  if (v.includes("this week") || v.includes("this-week")) {
    return { text: "This week", cls: "ff-chip ff-chipAmber" };
  }
  if (v.includes("next week") || v.includes("next-week")) {
    return { text: "Next week", cls: "ff-chip ff-chipGreen" };
  }
  return { text: "Flexible", cls: "ff-chip ff-chipBlue" };
}

function statusChip(status?: string | null) {
  const v = String(status || "").toLowerCase();
  if (v.includes("complete")) {
    return { text: "Completed", cls: "ff-chip ff-chipGreen" };
  }
  if (v.includes("book") || v.includes("confirm")) {
    return { text: "Booked", cls: "ff-chip ff-chipGreen" };
  }
  if (v.includes("cancel")) {
    return { text: "Cancelled", cls: "ff-chip ff-chipRed" };
  }
  if (v.includes("offer")) {
    return { text: "Offered", cls: "ff-chip ff-chipBlue" };
  }
  if (v.includes("quote")) {
    return { text: "Quoted", cls: "ff-chip ff-chipBlue" };
  }
  return { text: titleCase(status || "New"), cls: "ff-chip ff-chipGray" };
}

function bookingStatusLabel(row: QuoteRequestRow, visit?: SiteVisitRow | null) {
  const v = String(row.status || "").toLowerCase();

  if (v.includes("complete")) return "Completed";
  if (v.includes("cancel")) return "Cancelled";
  if (v.includes("book")) return "Booked";
  if (visit?.starts_at || row.site_visit_start) return "Booked";

  return "Pending booking";
}

/* ================================
   COLOURS
================================ */

const FF = {
  pageBg: "#F6F8FC",
  card: "#FFFFFF",
  border: "#E6ECF5",
  text: "#0B1320",
  muted: "#5C6B84",
  navy: "#0B2A55",
  navySoft: "#1F355C",
  blue: "#245BFF",
  blueSoft: "#EAF1FF",
  blueSoft2: "#F4F7FF",
  greenSoft: "#ECFDF3",
  redSoft: "#FFF1F1",
  amberSoft: "#FFF7ED",
  blueLine:
    "linear-gradient(90deg, rgba(36,91,255,1) 0%, rgba(31,111,255,0.35) 55%, rgba(11,42,85,0.15) 100%)",
};

/* ================================
   SMALL UI HELPERS
================================ */

function Chip({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={cls}>{children}</span>;
}

function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ff-empty">
      <div className="ff-emptyTitle">{title}</div>
      {sub ? <div className="ff-emptySub">{sub}</div> : null}
    </div>
  );
}

/* ================================
   PAGE
================================ */

export default function BookingsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const requestIdParam = (sp.get("requestId") || "").trim();

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [rows, setRows] = useState<QuoteRequestRow[]>([]);
  const [visitMap, setVisitMap] = useState<Record<string, SiteVisitRow | null>>({});

  const [selectedIdState, setSelectedIdState] = useState<string | null>(requestIdParam || null);
  const selectedId = requestIdParam || selectedIdState;

  const [tab, setTab] = useState<"all" | "upcoming" | "past">("all");

  const [postcodeFilter, setPostcodeFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
const [bookingDateTime, setBookingDateTime] = useState("");
  const [rightTab, setRightTab] = useState<"details" | "visit" | "notes">("details");
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const threadBottomRef = useRef<HTMLDivElement | null>(null);

  const whenIso = (r: QuoteRequestRow) =>
  visitMap[r.id]?.starts_at || r.job_booked_at || r.created_at;

  const selectedRow = useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [rows, selectedId]);

  function goToCreateInvoice(requestId: string) {
    router.push(`/dashboard/invoices?requestId=${encodeURIComponent(requestId)}`);
  }

  function openBooking(id: string) {
    setSelectedIdState(id);
    setRightTab("details");
    router.replace(`/dashboard/bookings?requestId=${encodeURIComponent(id)}`);
  }

  function backToListMobile() {
    setSelectedIdState(null);
    setRightTab("details");
    router.replace(`/dashboard/bookings`);
  }

  async function loadSiteVisitMap(plumberId: string, requestIds: string[]) {
    if (!requestIds.length) {
      setVisitMap({});
      function buildCalendarLinks(row: QuoteRequestRow) {
  if (!row.job_booked_at) return null;

  const start = new Date(row.job_booked_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour job

  const iso = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const title = encodeURIComponent(
    `${row.job_type || "Job"} - ${row.customer_name || "Customer"}`
  );

  const details = encodeURIComponent(row.details || "Fixflow job");

  const location = encodeURIComponent(
    row.address || row.postcode || ""
  );

  const google =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${iso(start)}/${iso(end)}` +
    `&details=${details}` +
    `&location=${location}`;

  const ics =
    `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${decodeURIComponent(title)}
DTSTART:${iso(start)}
DTEND:${iso(end)}
DESCRIPTION:${decodeURIComponent(details)}
LOCATION:${decodeURIComponent(location)}
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([ics], { type: "text/calendar" });
  const icsUrl = URL.createObjectURL(blob);

  return { google, icsUrl };
}
      return;
    }

    const { data, error } = await supabase
      .from("site_visits")
      .select("id,request_id,plumber_id,starts_at,duration_mins,created_at")
      .eq("plumber_id", plumberId)
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });

    if (error) return;

    const map: Record<string, SiteVisitRow | null> = {};
    for (const id of requestIds) map[id] = null;

    (data || []).forEach((v: any) => {
      if (!map[v.request_id]) map[v.request_id] = v as SiteVisitRow;
    });

    setVisitMap(map);
  }

  async function loadBookingsForTrader(plumberId: string) {
    setToast(null);

    const { data, error } = await supabase
      .from("quote_requests")
     .select(
  "id,job_number,plumber_id,customer_name,customer_email,customer_phone,postcode,address,job_type,urgency,details,status,created_at,trader_notes,calendar_html_link,site_visit_start,job_booked_at,job_calendar_html_link"
)
      .eq("plumber_id", plumberId)
      .order("created_at", { ascending: false });

    if (error) {
      setRows([]);
      setToast(`Load failed: ${error.message}`);
      return;
    }

    const list = (data || []) as QuoteRequestRow[];
    setRows(list);

    await loadSiteVisitMap(plumberId, list.map((r) => r.id));
  }

  async function saveNotes() {
    if (!uid || !selectedRow) return;
    setNotesSaving(true);
    setToast(null);

    const { error } = await supabase
      .from("quote_requests")
      .update({ trader_notes: notes })
      .eq("id", selectedRow.id)
      .eq("plumber_id", uid);

    if (error) {
      setToast(error.message);
    } else {
      setToast("Saved ✓");
      setRows((prev) =>
        prev.map((r) => (r.id === selectedRow.id ? { ...r, trader_notes: notes } : r))
      );
      setTimeout(() => setToast(null), 1200);
    }

    setNotesSaving(false);
  }
async function saveBooking() {
if (!uid || !selectedRow) return;

setToast(null);
setNotesSaving(true);

const { error } = await supabase
.from("quote_requests")
.update({
trader_notes: notes,
status: "booked",
})
.eq("id", selectedRow.id)
.eq("plumber_id", uid);

if (error) {
setToast(`Save failed: ${error.message}`);
} else {
setToast("Booking saved ✓");
setRows((prev) =>
prev.map((r) =>
r.id === selectedRow.id
? { ...r, trader_notes: notes, status: "booked" }
: r
)
);
setTimeout(() => setToast(null), 1200);
}

setNotesSaving(false);
}
async function saveJobBookingDate() {
  if (!uid || !selectedRow) return;

  if (!bookingDateTime) {
    setToast("Pick a booking date and time.");
    return;
  }

  setToast(null);
  setNotesSaving(true);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) {
      setToast("Please log in again.");
      setNotesSaving(false);
      return;
    }

    const res = await fetch("/api/bookings/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestId: selectedRow.id,
        bookingDateTime,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((json as any)?.error || "Booking failed");
    }

    const bookedAt = (json as any).booked_at || new Date(bookingDateTime).toISOString();

    setRows((prev) =>
      prev.map((r) =>
        r.id === selectedRow.id
          ? {
              ...r,
              job_booked_at: bookedAt,
              status: "booked",
            }
          : r
      )
    );

    setToast("Booking confirmed ✓");
    setTimeout(() => setToast(null), 1200);
  } catch (e: any) {
    setToast(e?.message || "Booking failed");
  } finally {
    setNotesSaving(false);
  }
}

async function markComplete() {
  if (!uid || !selectedRow) return;

  setToast(null);
  setNotesSaving(true);

  const { error } = await supabase
    .from("quote_requests")
    .update({
      status: "completed",
    })
    .eq("id", selectedRow.id)
    .eq("plumber_id", uid);

  if (error) {
    setToast(`Update failed: ${error.message}`);
  } else {
    setToast("Job marked complete ✓");

    setRows((prev) =>
      prev.map((r) =>
        r.id === selectedRow.id
          ? { ...r, status: "completed" }
          : r
      )
    );

    setTimeout(() => setToast(null), 1200);
  }

  setNotesSaving(false);
}
async function deleteBooking() {
if (!uid || !selectedRow) return;

const ok = confirm("Delete this booking?");
if (!ok) return;

setToast(null);
setNotesSaving(true);

const { error } = await supabase
.from("quote_requests")
.update({
status: null,
calendar_html_link: null,
site_visit_start: null,
})
.eq("id", selectedRow.id)
.eq("plumber_id", uid);

if (error) {
setToast(`Delete failed: ${error.message}`);
setNotesSaving(false);
return;
}

setRows((prev) =>
prev.map((r) =>
r.id === selectedRow.id
? {
...r,
status: null,
calendar_html_link: null,
site_visit_start: null,
}
: r
)
);

backToListMobile();
setToast("Booking removed ✓");
setNotesSaving(false);
}

  useEffect(() => {
    setSelectedIdState(requestIdParam || null);
  }, [requestIdParam]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      if (!mounted) return;
      setUid(userId);

      if (!userId) {
        setLoading(false);
        setToast("Please log in.");
        return;
      }

      await loadBookingsForTrader(userId);

      const ch = supabase
        .channel("ff_bookings_quote_requests")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quote_requests",
            filter: `plumber_id=eq.${userId}`,
          },
          () => loadBookingsForTrader(userId)
        )
        .subscribe();

      setLoading(false);

      return () => {
        supabase.removeChannel(ch);
      };
    })();

    return () => {
      mounted = false;
    };
  }, []);

useEffect(() => {
  if (!selectedRow) return;

  setNotes(selectedRow.trader_notes || "");

  const existingBooking = selectedRow.job_booked_at || "";

  if (existingBooking) {
    const d = new Date(existingBooking);
    const pad = (n: number) => String(n).padStart(2, "0");

    const localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setBookingDateTime(localValue);
  } else {
    setBookingDateTime("");
  }

  setTimeout(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, 60);
}, [selectedRow?.id]);


  const isBooking = (r: QuoteRequestRow) => {
    const st = String(r.status || "").toLowerCase();
    const hasVisit = !!visitMap[r.id]?.starts_at || !!r.site_visit_start;
    const bookedish = st.includes("book") || st.includes("confirm");
    const hasCalendar = !!r.calendar_html_link;
    return hasVisit || bookedish || hasCalendar;
  };

  const visibleRows = useMemo(() => {
    let list = rows.filter(isBooking);

    if (tab === "upcoming") {
      const now = Date.now();
      list = list.filter((r) => {
        const d = new Date(whenIso(r)).getTime();
        return !Number.isNaN(d) && d >= now;
      });
    }

    if (tab === "past") {
      const now = Date.now();
      list = list.filter((r) => {
        const d = new Date(whenIso(r)).getTime();
        return !Number.isNaN(d) && d < now;
      });
    }

    if (postcodeFilter.trim()) {
      const needle = postcodeFilter.trim().toLowerCase();
      list = list.filter((r) => String(r.postcode || "").toLowerCase().includes(needle));
    }

    if (urgencyFilter.trim()) {
      const needle = urgencyFilter.trim().toLowerCase();
      list = list.filter((r) => String(r.urgency || "").toLowerCase().includes(needle));
    }

    list.sort((a, b) => {
      const da = new Date(whenIso(a)).getTime();
      const db = new Date(whenIso(b)).getTime();
      if (Number.isNaN(da) && Number.isNaN(db)) return 0;
      if (Number.isNaN(da)) return 1;
      if (Number.isNaN(db)) return -1;
      return da - db;
    });

    return list;
  }, [rows, visitMap, tab, postcodeFilter, urgencyFilter]);

  const counts = useMemo(() => {
    const all = rows.filter(isBooking).length;

    const now = Date.now();
    const upcoming = rows
      .filter(isBooking)
      .filter((r) => {
        const d = new Date(whenIso(r)).getTime();
        return !Number.isNaN(d) && d >= now;
      }).length;

    const past = rows
      .filter(isBooking)
      .filter((r) => {
        const d = new Date(whenIso(r)).getTime();
        return !Number.isNaN(d) && d < now;
      }).length;

    return { all, upcoming, past };
  }, [rows, visitMap]);

 const isMobileDetail = !!selectedRow;

function buildCalendarLinks(row: QuoteRequestRow) {
  if (!row.job_booked_at) return null;

  const start = new Date(row.job_booked_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const iso = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const title = encodeURIComponent(
    `${row.job_type || "Job"} - ${row.customer_name || "Customer"}`
  );

  const details = encodeURIComponent(row.details || "Fixflow job");

  const location = encodeURIComponent(
    row.address || row.postcode || ""
  );

  const google =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${iso(start)}/${iso(end)}` +
    `&details=${details}` +
    `&location=${location}`;

  const ics =
`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${decodeURIComponent(title)}
DTSTART:${iso(start)}
DTEND:${iso(end)}
DESCRIPTION:${decodeURIComponent(details)}
LOCATION:${decodeURIComponent(location)}
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([ics], { type: "text/calendar" });
  const icsUrl = URL.createObjectURL(blob);

  return { google, icsUrl };
}

return (
    <>
      <div className="ff-page" data-mobile-detail={isMobileDetail ? "1" : "0"}>
        <div className="ff-wrap">
          <div className="ff-top">
            <div className="ff-hero">
              <div className="ff-heroGlow" />
              <div className="ff-heroRow">
                <div className="ff-heroLeft">
                  <div className="ff-heroTitle">Bookings</div>
                  <div className="ff-heroRule" />
                  <div className="ff-heroSub">
                    Jobs booked with customers — upcoming and completed work.
                  </div>
                </div>

                <div className="ff-actions">
                  {isMobileDetail ? (
                    <button className="ff-btn ff-btnGhost" type="button" onClick={backToListMobile}>
                      ← Back
                    </button>
                  ) : null}

                  <button
                    className="ff-btn ff-btnGhost"
                    type="button"
                    onClick={() => uid && loadBookingsForTrader(uid)}
                  >
                    Refresh
                  </button>

                  <button className="ff-btn ff-btnPrimary" type="button" disabled>
                    Add booking
                  </button>
                </div>
              </div>
            </div>

            <div className="ff-controls">
              <div className="ff-filterRow">
                <button
                  type="button"
                  className={`ff-pillSmall ${tab === "all" ? "ff-pillNeutralActive" : ""}`}
                  onClick={() => setTab("all")}
                >
                  All {counts.all}
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ${tab === "upcoming" ? "ff-pillNeutralActive" : ""}`}
                  onClick={() => setTab("upcoming")}
                >
                  Upcoming {counts.upcoming}
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ${tab === "past" ? "ff-pillNeutralActive" : ""}`}
                  onClick={() => setTab("past")}
                >
                  Past {counts.past}
                </button>
              </div>

              <div className="ff-filterRow">
                <input
                  className="ff-input"
                  placeholder="Postcode / area"
                  value={postcodeFilter}
                  onChange={(e) => setPostcodeFilter(e.target.value)}
                />

                <button
                  type="button"
                  className={`ff-pillSmall ${urgencyFilter === "" ? "ff-pillNeutralActive" : ""}`}
                  onClick={() => setUrgencyFilter("")}
                >
                  All urgency
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ff-pillRed ${
                    urgencyFilter === "asap" ? "ff-pillRedActive" : ""
                  }`}
                  onClick={() => setUrgencyFilter("asap")}
                >
                  ASAP
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ff-pillAmber ${
                    urgencyFilter === "this week" ? "ff-pillAmberActive" : ""
                  }`}
                  onClick={() => setUrgencyFilter("this week")}
                >
                  This week
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ff-pillGreen ${
                    urgencyFilter === "next week" ? "ff-pillGreenActive" : ""
                  }`}
                  onClick={() => setUrgencyFilter("next week")}
                >
                  Next week
                </button>

                <button
                  type="button"
                  className={`ff-pillSmall ff-pillBlue ${
                    urgencyFilter === "flex" ? "ff-pillBlueActive" : ""
                  }`}
                  onClick={() => setUrgencyFilter("flex")}
                >
                  Flexible
                </button>
              </div>
            </div>

            {toast ? <div className="ff-toast">{toast}</div> : null}
          </div>

          <div className="ff-grid">
            <div className="ff-card ff-leftPane">
              <div className="ff-leftHeadRow">
                <div className="ff-leftTitle">All bookings</div>
                <div className="ff-leftCount">{loading ? "…" : visibleRows.length}</div>
              </div>

              <div className="ff-leftList">
                {loading ? (
                  <div style={{ padding: 12, color: FF.muted, fontSize: 13 }}>Loading…</div>
                ) : visibleRows.length ? (
                  visibleRows.map((r) => {
                    const active = r.id === selectedId;
                    const urg = urgencyChip(r.urgency);
                    const st = statusChip(r.status);
                    const urgencyGlow =
  urg.text === "ASAP"
    ? "ff-leftGlowASAP"
    : urg.text === "This week"
    ? "ff-leftGlowWeek"
    : urg.text === "Next week"
    ? "ff-leftGlowNext"
    : urg.text === "Flexible"
    ? "ff-leftGlowFlexible"
    : "";

                    const visit = visitMap[r.id];
                    const when = visit?.starts_at || r.site_visit_start || null;

                   return (
  <button
    key={r.id}
    className={`ff-leftItem ${urgencyGlow}`}
    data-active={active ? "1" : "0"}
    type="button"
    onClick={() => openBooking(r.id)}
  >
    <div className="ff-leftItemInner">
      <div className="ff-leftItemTop">
        <div className="ff-jobNumber">
          {r.job_number || `FF-${r.id.slice(0, 4).toUpperCase()}`}
        </div>
        <div className="ff-leftDate">{niceDateOnly(whenIso(r))}</div>
      </div>

      <div className="ff-leftMeta">
        {r.postcode ? `${r.postcode.toUpperCase()} • ` : ""}
        {titleCase(r.job_type || "Booking")}
      </div>

      <div className="ff-jobQuickRow">
        <div className="ff-jobBudget">{urg.text}</div>
        <div className="ff-jobPhotos">
          {visit?.starts_at
            ? niceDate(visit.starts_at)
            : r.site_visit_start
            ? niceDate(r.site_visit_start)
            : "No booking date"}
        </div>
      </div>

      <div className="ff-leftChips">
        <Chip cls={urg.cls}>{urg.text}</Chip>
        <Chip cls={st.cls}>{st.text}</Chip>
      </div>

      <div className="ff-leftVisit">
        Booking date{" "}
        <span className="ff-leftVisitMuted">{niceDateOnly(r.created_at)}</span>
      </div>
    </div>
  </button>
);
                  })
                ) : (
                  <div style={{ padding: 12, color: FF.muted, fontSize: 13 }}>
                    No bookings match your filters.
                  </div>
                )}
              </div>
            </div>

            <div className="ff-card ff-rightPane">
              <div className="ff-rightBody">
                {!selectedRow ? (
                  <div className="ff-emptyWrap">
                    <EmptyState title="Select a booking" sub="Pick one from the list to view details." />
                  </div>
                ) : (
                  <>
                    <button type="button" className="ff-backMobile" onClick={backToListMobile}>
                      ← Back to bookings
                    </button>

                    <div className="ff-enquiryHeader">
                      <div className="ff-enquiryHeaderLeft">
                       <div className="ff-enquiryTitle">
  {(selectedRow.job_number || "Booking")} · {titleCase(selectedRow.job_type || "Job")}
</div>
<div className="ff-enquiryMeta">
  {titleCase(selectedRow.customer_name || "Customer")} ·{" "}
  {(selectedRow.postcode || "—").toUpperCase()}
</div>
                      </div>

                     <div className="ff-headerBtnRow">
  <button
    type="button"
    className="ff-btn ff-btnGhost"
    onClick={saveBooking}
    disabled={notesSaving}
  >
    {notesSaving ? "Saving…" : "Save"}
  </button>

  <button
    type="button"
    className="ff-btn ff-btnPrimary"
    onClick={() => goToCreateInvoice(selectedRow.id)}
  >
    Create invoice
  </button>
<button
  type="button"
  className="ff-btn ff-btnGreen"
  onClick={markComplete}
  disabled={notesSaving}
>
  Mark complete
</button>
  <button
    type="button"
    className="ff-btn ff-btnDanger"
    onClick={deleteBooking}
    disabled={notesSaving}
  >
    Delete booking
  </button>
</div>
                    </div>

                    <div className="ff-rightTabs">
                      {(["details", "visit", "notes"] as const).map((t) => {
                        const active = rightTab === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`ff-tabPill ${active ? "isActive" : ""}`}
                            onClick={() => setRightTab(t)}
                          >
                            {t === "details" ? "Job details" : t === "visit" ? "Job booking" : "Notes"}
                          </button>
                        );
                      })}
                    </div>

                    {rightTab === "details" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Customer</div>
                            <div style={{ minWidth: 0 }}>
                              <div className="ff-detailValue">{nice(selectedRow.customer_name)}</div>
                              <div className="ff-detailSub">
                                {nice(selectedRow.customer_email)}
                                {selectedRow.customer_phone ? `\n${selectedRow.customer_phone}` : ""}
                              </div>
                            </div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Address</div>
                            <div className="ff-detailValue">{nice(selectedRow.address || selectedRow.postcode)}</div>
                          </div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Urgency</div>
                            <div className="ff-detailValue">{titleCase(selectedRow.urgency || "Flexible")}</div>
                          </div>

                          <div className="ff-detailRow">
  <div className="ff-detailLabel">Status</div>
  <div className="ff-detailValue">
    {bookingStatusLabel(selectedRow, visitMap[selectedRow.id])}
  </div>
</div>

                          <div className="ff-detailRow">
                            <div className="ff-detailLabel">Details</div>
                            <div className="ff-detailValue">{nice(selectedRow.details)}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {rightTab === "visit" ? (
  <div className="ff-detailGrid">
    <div className="ff-detailCard">
      <div className="ff-detailRow">
        <div className="ff-detailLabel">Booking date</div>
        <div style={{ minWidth: 0 }}>
          <input
            type="datetime-local"
            className="ff-input"
            value={bookingDateTime}
            onChange={(e) => setBookingDateTime(e.target.value)}
            style={{ width: "100%", maxWidth: 320 }}
          />
          <div className="ff-detailSub">
            Choose the confirmed job date and time.
          </div>
        </div>
      </div>
  <div className="ff-detailRow">
  <div className="ff-detailLabel">Saved booking</div>
  <div className="ff-detailValue">
    {selectedRow.job_booked_at ? niceDate(selectedRow.job_booked_at) : "—"}
  </div>
</div>

     <div className="ff-detailRow">
  <div className="ff-detailLabel">Status</div>
  <div className="ff-detailValue">
    {bookingStatusLabel(selectedRow, visitMap[selectedRow.id])}
  </div>
</div>
{(() => {
  const links = buildCalendarLinks(selectedRow);

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button
        type="button"
        className="ff-btn ff-btnPrimary"
        onClick={saveJobBookingDate}
        disabled={notesSaving}
      >
       {notesSaving ? "Confirming…" : "Confirm booking"}
      </button>

      {links ? (
        <>
          <a
            href={links.google}
            target="_blank"
            rel="noreferrer"
            className="ff-btn ff-btnGhost"
          >
            Google Calendar
          </a>

          <a
            href={links.icsUrl}
            download="fixflow-booking.ics"
            className="ff-btn ff-btnGhost"
          >
            Apple / Outlook
          </a>
        </>
      ) : null}
    </div>
  );
})()}

      <div style={{ marginTop: 10, fontSize: 12, color: FF.muted, fontWeight: 700 }}>
        This is the confirmed job booking date with the customer.
      </div>
    </div>
  </div>
) : null}
                    {rightTab === "notes" ? (
                      <div className="ff-detailGrid">
                        <div className="ff-detailCard">
                          <textarea
                            className="ff-textarea"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Private notes for this booking…"
                          />
                          <div className="ff-noteFoot">
                            <button
                              className="ff-btn ff-btnGhost ff-btnSm"
                              type="button"
                              onClick={() => setNotes("")}
                            >
                              Clear
                            </button>
                            <button
                              className="ff-btn ff-btnPrimary ff-btnSm"
                              type="button"
                              onClick={saveNotes}
                              disabled={notesSaving}
                            >
                              {notesSaving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div ref={threadBottomRef} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{styles}</style>
    </>
  );
}

const styles = `
:global(body){ background: ${FF.pageBg}; }

/* PAGE */
.ff-page{
  flex: 1;
  min-height: 0;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  padding:0;
}

.ff-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* TOP */
.ff-top{
  border: 1px solid ${FF.border};
  background: ${FF.card};
  border-radius: 18px;
  overflow:hidden;
  box-shadow: 0 8px 20px rgba(15,23,42,0.05);
}
.ff-hero{
  position:relative;
  padding: 18px 16px 14px;
  overflow:hidden;
  background: linear-gradient(135deg, rgba(36, 91, 255, 0.10), rgba(255, 255, 255, 0.96));
}
.ff-heroGlow{
  position:absolute; inset:0;
  background:
    radial-gradient(circle at 16% 20%, rgba(36, 91, 255, 0.14), transparent 55%),
    radial-gradient(circle at 86% 24%, rgba(11, 42, 85, 0.07), transparent 60%);
  pointer-events:none;
}
.ff-heroRow{
  position:relative;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.ff-heroLeft{ display:grid; gap:8px; }
.ff-heroTitle{
  font-size: 28px;
  font-weight: 950;
  color: ${FF.navySoft};
  letter-spacing: -0.02em;
  line-height:1.05;
}
.ff-heroRule{
  height: 3px;
  width: 220px;
  border-radius: 999px;
  background: ${FF.blueLine};
  opacity: 0.95;
}
.ff-heroSub{
  margin-top:2px;
  font-size: 12px;
  color: ${FF.muted};
  font-weight: 600;
}

/* ACTIONS */
.ff-actions{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.ff-btn{
  height: 36px;
  border-radius: 12px;
  border: 1px solid ${FF.border};
  background: #fff;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 800;
  color: ${FF.navySoft};
  cursor:pointer;
  transition: all 0.15s ease;
}
.ff-btn:hover{ transform: translateY(-1px); }
.ff-btnPrimary{
  height: 38px;
  border-radius: 999px;
  border:none;
  background: ${FF.navySoft};
  color:#fff;
  padding: 0 14px;
  font-weight: 850;
  font-size: 12px;
}
.ff-btnGhost{ border-radius: 999px; font-weight: 850; font-size: 12px; }
.ff-btnSm{ height: 38px; padding:0 14px; font-size:12px; border-radius:999px; }

/* CONTROLS */
.ff-controls{
  padding: 12px 14px;
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  justify-content:space-between;
  border-top: 1px solid ${FF.border};
  background: linear-gradient(180deg, rgba(36, 91, 255, 0.06), rgba(255, 255, 255, 0));
}
.ff-filterRow{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.ff-input{
  height: 38px;
  border-radius: 14px;
  border: 1px solid ${FF.border};
  background:#fff;
  padding: 0 12px;
  outline:none;
  font-size: 13px;
  color: ${FF.text};
}
.ff-pillSmall{
  height: 32px;
  border-radius: 999px;
  border: 1px solid ${FF.border};
  padding: 0 12px;
  font-size: 12px;
  font-weight: 900;
  background:#fff;
  color: ${FF.muted};
  cursor:pointer;
}
.ff-pillNeutralActive{
  border-color: rgba(36, 91, 255, 0.35);
  background: rgba(36, 91, 255, 0.12);
  color: ${FF.navySoft};
}
.ff-pillRed{ background:${FF.redSoft}; border-color:#FFC0C0; color:#8A1F1F; }
.ff-pillAmber{ background:${FF.amberSoft}; border-color:#FFD7A3; color:#8A4B00; }
.ff-pillGreen{ background:${FF.greenSoft}; border-color:#BFE9CF; color:#116B3A; }
.ff-pillBlue{ background:${FF.blueSoft}; border-color: rgba(36, 91, 255, 0.32); color:${FF.navySoft}; }
.ff-pillRedActive,.ff-pillAmberActive,.ff-pillGreenActive,.ff-pillBlueActive{
  outline: 2px solid rgba(36, 91, 255, 0.18);
  outline-offset: 1px;
}

/* TOAST */.ff-headerBtnRow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: center;
  justify-content: end;
  width: 100%;
  max-width: 460px;
}

.ff-headerBtnRow > button {
  width: 100%;
  min-width: 0;
}

.ff-btnDanger {
  height: 38px;
  border-radius: 999px;
  border: 1px solid #fecaca;
  background: #fff;
  color: #dc2626;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.ff-toast{
  margin: 0 14px 14px;
  border-radius: 14px;
  border: 1px solid ${FF.border};
  background:#fff;
  padding: 10px 12px;
  font-size: 13px;
  color: ${FF.text};
}

/* GRID */
.ff-grid{
  display:grid;
  gap:14px;
  grid-template-columns: 360px minmax(0, 1fr);
  flex:1;
  min-height:0;
}
.ff-grid > *{ min-height:0; }

.ff-card{
  border: 1px solid ${FF.border};
  border-radius: 18px;
  background:#fff;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  min-height:0;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03), 0 14px 30px rgba(15, 23, 42, 0.08);
}

/* LEFT */
.ff-leftHeadRow{
  padding: 12px;
  border-bottom: 1px solid ${FF.border};
  display:flex;
  justify-content:space-between;
  align-items:center;
}
.ff-leftTitle{ font-weight: 900; color:${FF.navySoft}; }
.ff-leftCount{
  font-weight: 900;
  color:${FF.muted};
  border: 1px solid ${FF.border};
  background:#F7F9FC;
  border-radius:999px;
  padding: 4px 10px;
  font-size: 12px;
}
  .ff-leftGlowASAP {
  box-shadow:
    0 0 0 3px rgba(239, 68, 68, 0.22),
    0 14px 30px rgba(15, 23, 42, 0.10) !important;
}

.ff-leftGlowWeek {
  box-shadow:
    0 0 0 3px rgba(245, 158, 11, 0.20),
    0 14px 30px rgba(15, 23, 42, 0.10) !important;
}

.ff-leftGlowNext {
  box-shadow:
    0 0 0 3px rgba(34, 197, 94, 0.18),
    0 12px 28px rgba(15, 23, 42, 0.08) !important;
}

.ff-leftGlowFlexible {
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.14),
    0 14px 30px rgba(15, 23, 42, 0.10) !important;
}

.ff-leftList{
  padding: 12px 12px 22px;
  display:flex;
  flex-direction:column;
  gap:12px;
  flex:1;
  min-height:0;
  overflow:auto;
  -webkit-overflow-scrolling: touch;
}
.ff-leftItem {
  width: 100%;
  text-align: left;
  border-radius: 22px;
  padding: 0;
  overflow: visible;
  border: 1px solid #e6ecf5;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.18s ease;
  display: block;
  min-height: 175px;
  position: relative;
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.03),
    0 10px 22px rgba(15, 23, 42, 0.06);
}
.ff-leftItem[data-active="1"] {
  border-color: rgba(36, 91, 255, 0.35);
  background: linear-gradient(
    90deg,
    rgba(36, 91, 255, 0.18) 0%,
    rgba(36, 91, 255, 0.06) 45%,
    #ffffff 100%
  );
  box-shadow:
    0 0 0 2px rgba(36, 91, 255, 0.18),
    0 18px 40px rgba(15, 23, 42, 0.12);
}
.ff-leftItem[data-active="1"]::before {
  content: "";
  position: absolute;
  left: 12px;
  top: 20px;
  bottom: 20px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    #1d4ed8 0%,
    #2563eb 35%,
    #60a5fa 72%,
    rgba(96, 165, 250, 0.18) 100%
  );
  box-shadow: 0 0 8px rgba(37, 99, 235, 0.22);
  z-index: 3;
  pointer-events: none;
}

.ff-leftItemInner {
  position: relative;
  z-index: 2;
  padding: 18px 18px 16px 30px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ff-jobNumber {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #1f355c;
  font-size: 20px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: -0.03em;
}
.ff-leftItem:hover {
  transform: translateY(-3px);
  border-color: rgba(36, 91, 255, 0.25);
  background: linear-gradient(
    90deg,
    rgba(36, 91, 255, 0.08) 0%,
    rgba(36, 91, 255, 0.03) 40%,
    #ffffff 85%
  );
  box-shadow:
    0 6px 18px rgba(15, 23, 42, 0.08),
    0 20px 42px rgba(15, 23, 42, 0.12);
}

.ff-leftItemTop{ display:flex; justify-content:space-between; gap:10px; }
.ff-leftName{ font-weight: 800; color:${FF.navySoft}; font-size: 14px; }
.ff-leftDate {
  white-space: nowrap;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
}

.ff-leftMeta {
  margin-top: 0;
  color: #8a94a6;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 700;
}
  .ff-jobQuickRow {
  display: flex;
  align-items: center;
  gap: 10px 14px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.ff-jobBudget {
  color: #102a56;
  font-size: 13px;
  line-height: 1.15;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.ff-jobPhotos {
  color: #9aa4b2;
  font-size: 13px;
  line-height: 1.15;
  font-weight: 700;
}


.ff-btnGreen{
  height: 38px;
  border-radius: 999px;
  border: none;
  background: #15803d;
  color: #ffffff;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ff-btnGreen:hover{
  background:#166534;
}


.ff-leftChips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.ff-leftVisit {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: #102a56;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 900;
}

.ff-leftVisitMuted {
  color: #9aa4b2;
  font-weight: 700;
}

/* RIGHT */
.ff-rightBody{
  flex:1;
  min-height:0;
  overflow:auto;
  padding: 24px 28px 28px;
  box-sizing:border-box;
}

/* HEADER CARD */
.ff-enquiryHeader{
  border: 1px solid rgba(36, 91, 255, 0.30);
  border-radius: 18px;
  padding: 16px 18px;
  background: linear-gradient(90deg, rgba(36, 91, 255, 0.16) 0%, rgba(36, 91, 255, 0.08) 35%, rgba(36, 91, 255, 0.03) 60%, #ffffff 100%);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:18px;
  margin-bottom: 16px;
}
.ff-enquiryTitle{ font-weight: 950; color:${FF.navySoft}; font-size: 16px; margin-bottom: 6px; }
.ff-enquiryMeta{
  color:${FF.muted};
  font-size: 13px;
  font-weight: 750;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.ff-enquiryHeaderRight{ display:flex; flex-direction:column; align-items:flex-end; gap:10px; }

.ff-rightTabs{ margin: 8px 0 18px; display:flex; gap:10px; flex-wrap:wrap; }
.ff-tabPill{
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid ${FF.border};
  background:#fff;
  font-weight: 850;
  font-size: 13px;
  color:${FF.navySoft};
  cursor:pointer;
}
.ff-tabPill.isActive{
  border-color: rgba(36, 91, 255, 0.35);
  background: rgba(36, 91, 255, 0.10);
}

/* EMPTY */
.ff-emptyWrap{ min-height: 260px; padding: 16px; display:flex; align-items:center; justify-content:center; }
.ff-empty{
  border: 1px dashed rgba(36, 91, 255, 0.28);
  background: ${FF.blueSoft2};
  border-radius: 18px;
  padding: 24px;
  text-align:center;
  width:100%;
  max-width: 520px;
}
.ff-emptyTitle{ font-weight: 900; color:${FF.navySoft}; }
.ff-emptySub{ margin-top: 6px; font-size: 13px; color:${FF.muted}; }

/* DETAILS CARD */
.ff-detailGrid{ display:grid; gap:12px; }
.ff-detailCard{
  border: 1px solid rgba(36, 91, 255, 0.18);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(36, 91, 255, 0.08) 0%, rgba(36, 91, 255, 0.04) 40%, #ffffff);
  box-shadow: 0 1px 0 rgba(36, 91, 255, 0.06), 0 12px 28px rgba(15, 23, 42, 0.06);
  padding: 16px;
  margin-top: 14px;
}
.ff-detailRow{
  display:grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 10px;
  align-items:start;
  padding: 10px 0;
}
.ff-detailRow + .ff-detailRow{ border-top: 1px solid rgba(230, 236, 245, 0.9); }
.ff-detailLabel{
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color:${FF.muted};
  opacity: 0.9;
}
.ff-detailValue{
  font-size: 14px;
  font-weight: 650;
  color:${FF.text};
  line-height: 1.45;
  word-break: break-word;
  overflow-wrap:anywhere;
}
.ff-detailSub{
  margin-top: 4px;
  font-size: 13px;
  font-weight: 500;
  color:${FF.muted};
  white-space: pre-wrap;
  overflow-wrap:anywhere;
  word-break: break-word;
}

.ff-textarea{
  width:100%;
  min-height: 160px;
  border-radius: 16px;
  border: 1px solid ${FF.border};
  padding: 12px;
  outline:none;
  font-size: 13px;
  line-height: 1.45;
  color:${FF.text};
  resize: vertical;
  box-sizing:border-box;
}
.ff-noteFoot{ margin-top: 10px; display:flex; justify-content:flex-end; gap:10px; }

/* CHIPS */
.ff-chip{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  border: 1px solid transparent;
  white-space:nowrap;
}
.ff-chipBlue{ background:${FF.blueSoft}; border-color: rgba(36,91,255,0.32); color:${FF.navySoft}; }
.ff-chipGray{ background:#F7F9FC; border-color:${FF.border}; color:${FF.muted}; }
.ff-chipRed{ background:${FF.redSoft}; border-color:#FFC0C0; color:#8A1F1F; }
.ff-chipAmber{ background:${FF.amberSoft}; border-color:#FFD7A3; color:#8A4B00; }
.ff-chipGreen{ background:${FF.greenSoft}; border-color:#BFE9CF; color:#116B3A; }

/* MOBILE */
.ff-backMobile{ display:none; }
@media (max-width: 980px){
  .ff-grid{ grid-template-columns: 1fr; }
  .ff-rightBody{ padding: 16px; }
  .ff-backMobile{
    display:inline-flex;
    background: rgba(31, 53, 92, 0.06);
    border: 1px solid rgba(31, 53, 92, 0.12);
    padding: 6px 12px;
    border-radius: 999px;
    margin: 0 0 16px 0;
    font-weight: 700;
    font-size: 13px;
    color: #1f355c;
    cursor:pointer;
  }

  .ff-page[data-mobile-detail="1"] .ff-leftPane{ display:none; }
  .ff-page[data-mobile-detail="0"] .ff-rightPane{ display:none; }

  .ff-leftItem[data-active="1"]::before{ content:none; }
  .ff-leftItem[data-active="1"]{
    background:#fff;
    border-color:${FF.border};
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
  }
}
`;