"use client";

type Visit = {
id: string;
starts_at: string;
duration: number | null;
request_id: string;
quote_requests?: {
customer_name?: string | null;
postcode?: string | null;
job_type?: string | null;
job_number?: string | null;
} | null;
};

type WeekAheadProps = {
visits: Visit[];
};

function startOfWeek(date: Date) {
const copy = new Date(date);
const day = copy.getDay();

// Monday = first day
const diff = day === 0 ? -6 : 1 - day;

copy.setDate(copy.getDate() + diff);
copy.setHours(0, 0, 0, 0);

return copy;
}

function sameDay(a: Date, b: Date) {
return (
a.getFullYear() === b.getFullYear() &&
a.getMonth() === b.getMonth() &&
a.getDate() === b.getDate()
);
}

export default function WeekAhead({ visits }: WeekAheadProps) {
const today = new Date();
const monday = startOfWeek(today);

const days = Array.from({ length: 7 }, (_, index) => {
const date = new Date(monday);
date.setDate(monday.getDate() + index);
return date;
});

return (
<section className="weekAhead">
<div className="weekAheadHeader">
<div>
<p className="weekAheadEyebrow">Schedule</p>
<h2>Week ahead</h2>
</div>
</div>

<div className="weekAheadDays">
{days.map((day) => {
const dayVisits = visits
.filter((visit) => sameDay(new Date(visit.starts_at), day))
.sort(
(a, b) =>
new Date(a.starts_at).getTime() -
new Date(b.starts_at).getTime()
);

const isToday = sameDay(day, today);

return (
<div
key={day.toISOString()}
className={`weekAheadDay ${isToday ? "isToday" : ""}`}
>
<div className="weekAheadDayHeader">
<span>
{day.toLocaleDateString("en-GB", {
weekday: "short",
})}
</span>

<strong>{day.getDate()}</strong>
</div>

<div className="weekAheadBookings">
{dayVisits.length === 0 ? (
<p className="weekAheadEmpty">Nothing booked</p>
) : (
dayVisits.map((visit) => {
const request = visit.quote_requests;

return (
<a
key={visit.id}
href={`/enquiries?request=${visit.request_id}`}
className="weekAheadBooking"
>
<div className="weekAheadTime">
{new Date(visit.starts_at).toLocaleTimeString(
"en-GB",
{
hour: "2-digit",
minute: "2-digit",
}
)}
</div>

<div className="weekAheadBookingInfo">
<strong>
{request?.customer_name || "Site visit"}
</strong>

<span>
{[request?.job_type, request?.postcode]
.filter(Boolean)
.join(" · ")}
</span>
</div>
</a>
);
})
)}
</div>
</div>
);
})}
</div>
</section>
);
}