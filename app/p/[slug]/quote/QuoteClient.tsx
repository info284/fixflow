"use client";

import React, { useMemo, useRef, useState } from "react";

/* =========================
   Types
========================= */
type Trader = {
  id?: string;
  slug?: string;
  display_name?: string;
  business_name?: string;
  headline?: string;
  logo_url?: string;
  accent?: string;
  notify_email?: string;
};

type AddressLookupResponse = {
  addresses?: string[];
  error?: string;
  debug?: any;
};

/* =========================
   Safe JSON helper
========================= */
async function safeJson(res: Response) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/* =========================
   Small UI helpers
========================= */
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function Stroke({ strength = 0.2 }: { strength?: number }) {
  const s = clamp01(strength);
  const height = 3 + Math.round(s * 2);
  const opacityA = 0.35 + s * 0.55;
  const opacityB = 0.1 + s * 0.4;
  const glow = 10 + s * 18;

  return (
    <div
      className="absolute left-0 right-0 top-0"
      style={{
        height,
        background: `linear-gradient(90deg,
          rgba(31,111,255,${opacityA}),
          rgba(31,111,255,${opacityB}),
          rgba(31,111,255,0)
        )`,
        boxShadow: `0 0 ${glow}px rgba(31,111,255,${0.18 + s * 0.22})`,
      }}
    />
  );
}

function Card({
  title,
  sub,
  strength,
  rightTag,
  children,
}: {
  title: string;
  sub?: string;
  strength: number;
  rightTag?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div
        className={[
          "relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur",
          "shadow-[0_1px_0_rgba(15,23,42,0.03),0_14px_30px_rgba(15,23,42,0.08)]",
        ].join(" ")}
      >
        <Stroke strength={strength} />

        <div
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, rgba(31,111,255,${0.06 + strength * 0.1}), transparent 60%)`,
          }}
        />

        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[19px] sm:text-[20px] font-extrabold tracking-tight text-slate-900">
                {title}
              </h2>
              {sub ? <p className="mt-1 text-[14px] text-slate-600">{sub}</p> : null}
            </div>

            {rightTag ? <div className="shrink-0">{rightTag}</div> : null}
          </div>

          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[13.5px] font-semibold text-slate-700">
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  autoComplete,
  type = "text",
  uppercase = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
  uppercase?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={[
        "w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5",
        "text-[15.5px] text-slate-900 placeholder:text-slate-400",
        "outline-none transition",
        "focus:ring-4 focus:ring-blue-100 focus:border-blue-300",
        "shadow-[inset_0_1px_0_rgba(15,23,42,0.03)]",
        uppercase ? "uppercase" : "",
      ].join(" ")}
    />
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={[
        "w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5",
        "text-[15.5px] text-slate-900",
        "outline-none transition",
        "focus:ring-4 focus:ring-blue-100 focus:border-blue-300",
        "disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200/70",
      ].join(" ")}
    >
      {children}
    </select>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        "min-h-[160px] w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5",
        "text-[15.5px] text-slate-900 placeholder:text-slate-400",
        "outline-none transition",
        "focus:ring-4 focus:ring-blue-100 focus:border-blue-300",
      ].join(" ")}
    />
  );
}

function StatusTag({ ok, label }: { ok: boolean; label: string }) {
  if (!ok) return null;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-extrabold text-emerald-800">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[12px]">
        ✓
      </span>
      {label}
    </span>
  );
}

/* =========================
   Main Component
========================= */
export default function QuoteClient({
  slug,
  initialTrader,
}: {
  slug: string;
  initialTrader: Trader | null;
}) {
  const trader = initialTrader;
  const traderError = initialTrader ? null : "Trader not found.";

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobNumber, setJobNumber] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [postcode, setPostcode] = useState("");
  const [addressList, setAddressList] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [parking, setParking] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [problemLocation, setProblemLocation] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lookupMsg, setLookupMsg] = useState("");
  const [isStillWorking, setIsStillWorking] = useState("");
  const [hasHappenedBefore, setHasHappenedBefore] = useState("");
  const [budget, setBudget] = useState("");
  const [jobType, setJobType] = useState("");
  const [urgency, setUrgency] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const isNameOk = useMemo(() => name.trim().length >= 2, [name]);

  const isEmailOk = useMemo(() => {
    const v = email.trim();
    return v.length >= 6 && v.includes("@") && v.includes(".");
  }, [email]);

  const isDetailsOk = useMemo(() => details.trim().length >= 10, [details]);
  const canLookup = useMemo(() => postcode.trim().length >= 5, [postcode]);
  const photosOk = useMemo(() => Boolean(files && files.length > 0), [files]);

  const detailsSectionOk = useMemo(() => isNameOk && isEmailOk, [isNameOk, isEmailOk]);

  const locationSectionOk = useMemo(
    () => postcode.trim().length >= 5 && Boolean(selectedAddress.trim()),
    [postcode, selectedAddress]
  );

  const jobSectionOk = useMemo(
    () =>
      Boolean(jobType) &&
      Boolean(urgency) &&
      Boolean(isStillWorking) &&
      Boolean(hasHappenedBefore) &&
      isDetailsOk,
    [jobType, urgency, isStillWorking, hasHappenedBefore, isDetailsOk]
  );

  const progress = useMemo(() => {
    let p = 0;
    if (detailsSectionOk) p += 25;
    if (postcode.trim().length >= 5) p += 10;
    if (selectedAddress.trim()) p += 15;
    if (jobType) p += 8;
    if (urgency) p += 8;
    if (isStillWorking) p += 8;
    if (hasHappenedBefore) p += 8;
    if (isDetailsOk) p += 8;
    if (photosOk) p += 10;
    return Math.min(100, p);
  }, [
    detailsSectionOk,
    postcode,
    selectedAddress,
    jobType,
    urgency,
    isStillWorking,
    hasHappenedBefore,
    isDetailsOk,
    photosOk,
  ]);

  const heroStrength = useMemo(() => clamp01(progress / 100), [progress]);

  const detailsStrength = useMemo(
    () => (detailsSectionOk ? 1 : clamp01((name.trim().length + email.trim().length) / 25)),
    [detailsSectionOk, name, email]
  );

  const locationStrength = useMemo(
    () =>
      locationSectionOk
        ? 1
        : clamp01((postcode.trim().length >= 5 ? 0.45 : 0.15) + (selectedAddress.trim() ? 0.4 : 0)),
    [locationSectionOk, postcode, selectedAddress]
  );

  const jobStrength = useMemo(
    () =>
      jobSectionOk
        ? 1
        : clamp01(
            (jobType ? 0.2 : 0) +
              (urgency ? 0.2 : 0) +
              (isStillWorking ? 0.2 : 0) +
              (hasHappenedBefore ? 0.2 : 0) +
              (isDetailsOk ? 0.2 : 0.1)
          ),
    [jobSectionOk, jobType, urgency, isStillWorking, hasHappenedBefore, isDetailsOk]
  );

  const photosStrength = useMemo(() => (files?.length ? 0.75 : 0.2), [files]);

  async function findAddresses() {
    setLookupStatus("loading");
    setLookupMsg("");
    setAddressList([]);
    setSelectedAddress("");

    const pc = postcode.trim().toUpperCase().replace(/\s+/g, " ");
    if (!pc) return;

    try {
      const res = await fetch(`/api/address?postcode=${encodeURIComponent(pc)}`, {
        cache: "no-store",
      });

      const json = (await safeJson(res)) as AddressLookupResponse | null;

      if (!res.ok) {
        setLookupStatus("error");
        setLookupMsg((json as any)?.error || "Address lookup failed");
        return;
      }

      const addresses = (json as any)?.addresses;

      if (!Array.isArray(addresses) || addresses.length === 0) {
        setLookupStatus("error");
        setLookupMsg("No addresses found for that postcode.");
        return;
      }

      setAddressList(addresses);
      setLookupStatus("success");
      setLookupMsg(`${addresses.length} addresses found`);
    } catch (e: any) {
      setLookupStatus("error");
      setLookupMsg(e?.message || "Address lookup failed");
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setPostcode("");
    setAddressList([]);
    setSelectedAddress("");
    setParking("");
    setPropertyType("");
    setProblemLocation("");
    setLookupStatus("idle");
    setLookupMsg("");
    setIsStillWorking("");
    setHasHappenedBefore("");
    setBudget("");
    setJobType("");
    setUrgency("");
    setDetails("");
    setFiles(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function submitRequest() {
    if (submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitted(false);
    setJobNumber("");

    try {
      const fd = new FormData();

      fd.append("slug", slug);
      fd.append("name", name.trim());
      fd.append("email", email.trim());
      fd.append("phone", phone.trim() || "");
      fd.append("postcode", postcode.trim());
      fd.append("address", selectedAddress.trim());
      fd.append("job_type", jobType);
      fd.append("problem_location", problemLocation);
      fd.append("urgency", urgency);
      fd.append("is_still_working", isStillWorking);
      fd.append("has_happened_before", hasHappenedBefore);
      fd.append("budget", budget);
      fd.append("parking", parking);
      fd.append("property_type", propertyType);
      fd.append("details", details.trim());

      if (files && files.length) {
        Array.from(files).forEach((file) => {
          fd.append("files", file);
        });
      }

     const res = await fetch("/api/enquiries/create", {
  method: "POST",
  body: fd,
});

      const json = await safeJson(res);

      if (!res.ok) {
      throw new Error((json as any)?.debug || (json as any)?.error || "Insert failed");
      }

      setJobNumber((json as any)?.job_number || "");
      setSubmitted(true);
      resetForm();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setSubmitError(e?.message || "Insert failed");
    } finally {
      setSubmitting(false);
    }
  }

  const submitEnabled =
    Boolean(detailsSectionOk && locationSectionOk && jobSectionOk && photosOk) && !submitting;

  const traderName = trader?.display_name || trader?.business_name || slug;
  const subtitle = trader?.headline || "Request an estimate";

  const bgStyle = useMemo(() => {
    if (!submitting && !submitted) {
      return "bg-[radial-gradient(circle_at_20%_10%,rgba(31,111,255,0.10),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(31,111,255,0.06),transparent_40%),#f7f9fc]";
    }

    if (submitting && !submitted) {
      return "bg-[radial-gradient(circle_at_20%_10%,rgba(31,111,255,0.22),transparent_50%),radial-gradient(circle_at_80%_30%,rgba(31,111,255,0.14),transparent_45%),#f3f7ff]";
    }

    return "bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(31,111,255,0.10),transparent_45%),#f6fbf9]";
  }, [submitting, submitted]);

  return (
    <main className={`min-h-screen ${bgStyle} ff-dashboardText transition-colors duration-500`}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header
          className={[
            "relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur",
            "shadow-[0_1px_0_rgba(15,23,42,0.03),0_14px_30px_rgba(15,23,42,0.08)]",
          ].join(" ")}
        >
          <Stroke strength={heroStrength} />

          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -top-28 -left-28 h-80 w-80 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(31,111,255,0.16), transparent 60%)" }}
            />
            <div
              className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(31,111,255,0.10), transparent 60%)" }}
            />
            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/70 to-transparent" />
          </div>

          <div className="relative p-6 sm:p-7">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm sm:h-20 sm:w-20">
                {trader?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={trader.logo_url} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[18px] font-extrabold text-slate-700 sm:text-[20px]">
                    {(traderName?.[0] || "T").toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="text-[12.5px] font-semibold text-slate-500">
                  FixFlow quote request
                </div>
                <h1 className="mt-1 truncate text-[22px] font-extrabold tracking-tight text-slate-900 sm:text-[28px]">
                  {traderName}
                </h1>
                <p className="mt-1 text-[14.5px] text-slate-600 sm:text-[15.5px]">
                  {subtitle}. Fill in the form below — it goes straight to the trader.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-[13.5px] text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    No signup needed
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Sent directly to the trader
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Reply by email / phone
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-[12.5px] font-semibold text-slate-500">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-slate-200/70 bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${progress}%`,
                    background:
                      "linear-gradient(90deg, rgba(31,111,255,0.95), rgba(31,111,255,0.25))",
                    boxShadow: `0 0 ${10 + heroStrength * 18}px rgba(31,111,255,${0.12 + heroStrength * 0.18})`,
                  }}
                />
              </div>
            </div>

            <div className="mt-4">
              {traderError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700">
                  {traderError}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {submitted ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900 shadow-[0_1px_0_rgba(15,23,42,0.02),0_6px_14px_rgba(15,23,42,0.05)]">
            <div className="text-[15px] font-extrabold">Request received.</div>
            <div className="mt-1 text-[14.5px] text-emerald-800">
              Your details have been sent to the trader. They’ll be in touch shortly.
            </div>
            {jobNumber ? (
              <div className="mt-2 text-[14px] font-semibold text-emerald-900">
                Job reference: {jobNumber}
              </div>
            ) : null}
          </div>
        ) : null}

        {submitError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-900 shadow-[0_1px_0_rgba(15,23,42,0.02),0_6px_14px_rgba(15,23,42,0.05)]">
            <div className="text-[15px] font-extrabold">Something went wrong</div>
            <div className="mt-1 text-[14.5px] text-red-800">{submitError}</div>
          </div>
        ) : null}

        <Card
          title="Your details"
          sub="So the trader can reply quickly."
          strength={detailsStrength}
          rightTag={<StatusTag ok={detailsSectionOk} label="Complete" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
              {!isNameOk && name.length > 0 ? (
                <p className="mt-2 text-[13px] text-slate-500">
                  Add your full name (at least 2 characters).
                </p>
              ) : null}
            </div>

            <div>
              <Label>Email</Label>
              <Input
                value={email}
                onChange={setEmail}
                placeholder="you@email.com"
                autoComplete="email"
              />
              {!isEmailOk && email.length > 0 ? (
                <p className="mt-2 text-[13px] text-slate-500">
                  Make sure this looks like an email address.
                </p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <Label>
                Phone <span className="font-semibold text-slate-400">(optional)</span>
              </Label>
              <Input value={phone} onChange={setPhone} placeholder="07..." autoComplete="tel" />
            </div>
          </div>
        </Card>

        <Card
          title="Location"
          sub="Postcode + address helps confirm the area."
          strength={locationStrength}
          rightTag={<StatusTag ok={locationSectionOk} label="Complete" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
            <div>
              <Label>Postcode</Label>
              <Input value={postcode} onChange={setPostcode} placeholder="RH17 6TL" uppercase />

              {lookupStatus === "error" ? (
                <p className="mt-2 text-[13.5px] font-semibold text-red-700">
                  {lookupMsg || "Address lookup failed"}
                </p>
              ) : lookupStatus === "success" ? (
                <p className="mt-2 text-[13.5px] font-semibold text-emerald-700">{lookupMsg}</p>
              ) : lookupStatus === "loading" ? (
                <p className="mt-2 text-[13.5px] font-semibold text-slate-600">
                  Finding addresses…
                </p>
              ) : (
                <p className="mt-2 text-[13.5px] text-slate-500">
                  Enter your postcode, then click “Find address”.
                </p>
              )}
            </div>

            <div className="sm:pt-6">
              <button
                type="button"
                onClick={findAddresses}
                disabled={!canLookup || lookupStatus === "loading"}
                className={[
                  "w-full rounded-2xl border border-slate-300/70 bg-white px-4 py-3.5",
                  "text-[14.5px] font-semibold text-slate-900",
                  "transition hover:bg-slate-50",
                  "focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:border-slate-200/70",
                ].join(" ")}
              >
                {lookupStatus === "loading" ? "Finding…" : "Find address"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <Label>Select address</Label>
            <Select
              value={selectedAddress}
              onChange={setSelectedAddress}
              disabled={addressList.length === 0}
            >
              <option value="">
                {addressList.length ? "Select your address…" : "Find addresses first…"}
              </option>
              {addressList.map((a, i) => (
                <option key={`${a}-${i}`} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card
          title="About the job"
          sub="Answer a few quick questions so the trader can assess the job properly."
          strength={jobStrength}
          rightTag={<StatusTag ok={jobSectionOk} label="Complete" />}
        >
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Job type</Label>
              <Select value={jobType} onChange={setJobType}>
                <option value="">Select…</option>
                <option value="bathroom">Bathroom</option>
                <option value="kitchen">Kitchen</option>
                <option value="leak">Leak</option>
                <option value="boiler">Boiler</option>
                <option value="drain">Drain / Blockage</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div>
              <Label>Where is the problem?</Label>
              <Select value={problemLocation} onChange={setProblemLocation}>
                <option value="">Select…</option>
                <option value="kitchen">Kitchen</option>
                <option value="bathroom">Bathroom</option>
                <option value="boiler-area">Boiler / heating system</option>
                <option value="outside">Outside / garden</option>
                <option value="loft">Loft</option>
                <option value="basement">Basement</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div>
              <Label>When do you need it?</Label>
              <Select value={urgency} onChange={setUrgency}>
                <option value="">Select…</option>
                <option value="asap">As soon as possible</option>
                <option value="this-week">This week</option>
                <option value="next-week">Next week</option>
                <option value="flexible">Flexible</option>
              </Select>
            </div>

            <div>
              <Label>Is everything still working?</Label>
              <Select value={isStillWorking} onChange={setIsStillWorking}>
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="partly">Partly</option>
                <option value="no">No</option>
                <option value="not-sure">Not sure</option>
              </Select>
            </div>

            <div>
              <Label>Has this happened before?</Label>
              <Select value={hasHappenedBefore} onChange={setHasHappenedBefore}>
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="not-sure">Not sure</option>
              </Select>
            </div>

            <div>
              <Label>
                Budget range <span className="font-semibold text-slate-400">(optional)</span>
              </Label>
              <Select value={budget} onChange={setBudget}>
                <option value="">Select…</option>
                <option value="under-100">Under £100</option>
                <option value="100-250">£100 – £250</option>
                <option value="250-500">£250 – £500</option>
                <option value="500-1000">£500 – £1,000</option>
                <option value="1000-3000">£1,000 – £3,000</option>
                <option value="3000-plus">£3,000+</option>
                <option value="not-sure">Not sure</option>
              </Select>
            </div>

            <div>
              <Label>Parking / access</Label>
              <Select value={parking} onChange={setParking}>
                <option value="">Select…</option>
                <option value="easy-driveway">Easy driveway parking</option>
                <option value="street-nearby">Street parking nearby</option>
                <option value="permit-area">Permit area</option>
                <option value="limited-access">Limited access</option>
                <option value="no-parking">No parking nearby</option>
                <option value="not-sure">Not sure</option>
              </Select>
            </div>

            <div>
              <Label>Property type</Label>
              <Select value={propertyType} onChange={setPropertyType}>
                <option value="">Select…</option>
                <option value="house">House</option>
                <option value="flat">Flat / Apartment</option>
                <option value="commercial">Commercial</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div>
              <Label>Details</Label>
              <Textarea
                value={details}
                onChange={setDetails}
                placeholder="Describe the job… (What’s happening? Where is it? Any photos?)"
              />
              {!isDetailsOk && details.length > 0 ? (
                <p className="mt-2 text-[13.5px] text-slate-500">
                  Add a bit more detail (at least 10 characters).
                </p>
              ) : (
                <p className="mt-2 text-[13.5px] text-slate-500">
                  Tip: include measurements or model numbers if you have them.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card
          title="Photos"
          sub="Please upload at least one photo so the trader can assess the job properly."
          strength={photosStrength}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            className="block w-full text-[14.5px] text-slate-700 file:mr-4 file:rounded-2xl file:border file:border-slate-300/70 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-slate-900 hover:file:bg-slate-50"
          />
          {files?.length ? (
            <p className="mt-2 text-[13.5px] font-semibold text-slate-700">
              {files.length} file(s) selected
            </p>
          ) : (
            <p className="mt-2 text-[13.5px] font-semibold text-red-600">
              Please upload at least one photo.
            </p>
          )}
        </Card>

        <div className="mt-8 pb-10">
          <button
            type="button"
            onClick={submitRequest}
            disabled={!submitEnabled}
            className={[
              "w-full rounded-2xl px-6 py-4 text-[15.5px] font-extrabold text-white",
              "bg-blue-600 shadow-[0_12px_24px_rgba(31,111,255,0.18)]",
              "transition hover:bg-blue-700",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            {submitting ? "Sending…" : "Send request"}
          </button>

          <div className="mt-3 text-center text-[13.5px] text-slate-500">
            By sending, you agree FixFlow will share your details with this trader.
          </div>
        </div>
      </div>
    </main>
  );
}