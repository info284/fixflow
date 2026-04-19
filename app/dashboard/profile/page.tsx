"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  slug: string | null;
  display_name: string | null;
  headline: string | null;
  notify_email: string | null;
  logo_url: string | null;
  vat_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
};

type LocationRow = {
  id: string;
  user_id: string;
  postcode_prefix: string | null;
  label: string | null;
  created_at?: string;
};

type Trade = {
  id: string;
  name: string;
  slug: string;
};

type Service = {
  id: string;
  name: string;
  price_from: number | null;
  price_to: number | null;
  trade_id: string | null;
  user_id: string | null;
  created_at?: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const digitsOnly = (v: string) => v.replace(/\D/g, "");

const formatSortCode = (v: string) => {
  const d = digitsOnly(v).slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
};

function outwardFrom(input: string) {
  const t = (input || "").trim().toUpperCase();
  const outward = t.split(/\s+/)[0] || "";
  return outward.replace(/[^A-Z0-9]/g, "");
}

function looksLikeOutward(p: string) {
  return /^[A-Z0-9]{2,4}$/.test(p);
}

async function lookupLocationLabel(outward: string): Promise<string | null> {
  const p = outwardFrom(outward);
  if (!p || !looksLikeOutward(p)) return null;

  try {
    const res = await fetch(
      `https://api.postcodes.io/outcodes/${encodeURIComponent(p)}`
    );
    const json = await res.json();

    if (!res.ok || !json?.result) return null;

    const district = (json.result.admin_district || "").toString().trim();

    let county = "";
    const c = json.result.admin_county;
    if (Array.isArray(c)) county = (c[0] ? String(c[0]).trim() : "") || "";
    else if (typeof c === "string") county = c.trim();

    const fullLabel = [district, county].filter(Boolean).join(" — ").trim();
    return fullLabel || null;
  } catch {
    return null;
  }
}

function money(n: number | null) {
  if (n === null || typeof n === "undefined") return "—";
  return `£${Number(n).toFixed(2)}`;
}

function guidePrice(from: number | null, to: number | null) {
  if (from === null && to === null) return "—";
  if (from !== null && to !== null) return `${money(from)} – ${money(to)}`;
  if (from !== null) return `From ${money(from)}`;
  return `Up to ${money(to)}`;
}

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pageMsg, setPageMsg] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);
  const [tradeMsg, setTradeMsg] = useState<string | null>(null);
  const [serviceMsg, setServiceMsg] = useState<string | null>(null);
  const [calendarMsg, setCalendarMsg] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");

  const [vatNumber, setVatNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [calStatus, setCalStatus] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationLookupState, setLocationLookupState] = useState<
    "idle" | "looking" | "found" | "notfound"
  >("idle");
  const locationDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastLocationLookedUp = useRef<string>("");

  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeName, setTradeName] = useState("");
  const [tradeSlug, setTradeSlug] = useState("");
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeSearch, setTradeSearch] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceTradeId, setServiceTradeId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [servicePriceFrom, setServicePriceFrom] = useState("");
  const [servicePriceTo, setServicePriceTo] = useState("");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceTradeFilter, setServiceTradeFilter] = useState<string>("all");
  const [serviceSearch, setServiceSearch] = useState("");

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL || "https://thefixflowapp.com";

  const publicQuoteLink = useMemo(() => {
    const s = (slug || "").trim();
    if (!s) return "";
    const base = SITE_URL.replace(/\/$/, "");
    return `${base}/p/${s}/quote`;
  }, [slug, SITE_URL]);

  const publicProfileUrl = useMemo(() => {
    const s = (slug || "").trim();
    if (!s) return "";
    const base = SITE_URL.replace(/\/$/, "");
    return `${base}/${s}`;
  }, [slug, SITE_URL]);

  const outwardLocation = useMemo(
    () => outwardFrom(locationInput),
    [locationInput]
  );

  const tradeMap = useMemo(() => {
    return new Map(trades.map((t) => [t.id, t.name]));
  }, [trades]);

  const tradeNameById = (id: string | null) => {
    if (!id) return "—";
    return tradeMap.get(id) || "Unknown";
  };

  const filteredTrades = useMemo(() => {
    const term = tradeSearch.trim().toLowerCase();
    if (!term) return trades;

    return trades.filter((t) => {
      const n = (t.name || "").toLowerCase();
      const s = (t.slug || "").toLowerCase();
      return n.includes(term) || s.includes(term);
    });
  }, [trades, tradeSearch]);

  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();

    return services.filter((s) => {
      if (
        serviceTradeFilter !== "all" &&
        (s.trade_id || "") !== serviceTradeFilter
      ) {
        return false;
      }

      if (!term) return true;

      const n = (s.name || "").toLowerCase();
      const t = tradeNameById(s.trade_id).toLowerCase();
      return n.includes(term) || t.includes(term);
    });
  }, [services, serviceTradeFilter, serviceSearch, tradeMap]);

  const setupChips = useMemo(() => {
    return [
      {
        label: publicQuoteLink ? "Public link ready" : "Add your public link",
        ok: Boolean(publicQuoteLink),
      },
      {
        label: `${locations.length} location${locations.length === 1 ? "" : "s"} added`,
        ok: locations.length > 0,
      },
      {
        label: `${services.length} service${services.length === 1 ? "" : "s"} live`,
        ok: services.length > 0,
      },
    ];
  }, [publicQuoteLink, locations.length, services.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const v = params.get("cal");
    if (v) {
      setCalStatus(v);
      setCalendarMsg(null);
    }
  }, []);

  const loadLocations = async (uid: string) => {
    setLocationsLoading(true);

    const { data, error } = await supabase
      .from("trade_locations")
      .select("id, user_id, postcode_prefix, label, created_at")
      .eq("user_id", uid)
      .order("postcode_prefix", { ascending: true });

    if (!error) {
      setLocations((data || []) as LocationRow[]);
    }

    setLocationsLoading(false);
  };

  const loadTrades = async () => {
    setTradesLoading(true);

    const { data, error } = await supabase
      .from("trades")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (!error) {
      setTrades((data || []) as Trade[]);
    }

    setTradesLoading(false);
  };

  const loadServices = async (uid: string) => {
    setServicesLoading(true);

    const { data, error } = await supabase
      .from("services")
      .select("id, name, price_from, price_to, trade_id, user_id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!error) {
      setServices((data || []) as Service[]);
    }

    setServicesLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setPageMsg(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setLoading(false);
        setPageMsg("You must be logged in to view business setup.");
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, slug, display_name, headline, notify_email, logo_url, vat_number, bank_name, bank_account_name, bank_sort_code, bank_account_number"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setPageMsg(`Error loading profile: ${error.message}`);
        setLoading(false);
        return;
      }

      const p = (data || null) as ProfileRow | null;
      setProfile(p);

      setSlug(p?.slug || "");
      setDisplayName(p?.display_name || "");
      setHeadline(p?.headline || "");
      setNotifyEmail(p?.notify_email || user.email || "");

      setVatNumber(p?.vat_number || "");
      setBankName(p?.bank_name || "");
      setBankAccountName(p?.bank_account_name || "");
      setBankSortCode(p?.bank_sort_code || "");
      setBankAccountNumber(p?.bank_account_number || "");

      await Promise.all([
        loadLocations(user.id),
        loadTrades(),
        loadServices(user.id),
      ]);

      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    const p = outwardLocation;

    if (!p) {
      setLocationLabel("");
      setLocationLookupState("idle");
      lastLocationLookedUp.current = "";
      if (locationDebounceTimer.current) {
        clearTimeout(locationDebounceTimer.current);
      }
      return;
    }

    if (!looksLikeOutward(p)) {
      setLocationLabel("");
      setLocationLookupState("idle");
      if (locationDebounceTimer.current) {
        clearTimeout(locationDebounceTimer.current);
      }
      return;
    }

    if (locationDebounceTimer.current) {
      clearTimeout(locationDebounceTimer.current);
    }

    locationDebounceTimer.current = setTimeout(async () => {
      if (lastLocationLookedUp.current === p) return;
      lastLocationLookedUp.current = p;

      setLocationLookupState("looking");
      const found = await lookupLocationLabel(p);

      if (found) {
        setLocationLabel(found);
        setLocationLookupState("found");
      } else {
        setLocationLabel("");
        setLocationLookupState("notfound");
      }
    }, 500);

    return () => {
      if (locationDebounceTimer.current) {
        clearTimeout(locationDebounceTimer.current);
      }
    };
  }, [outwardLocation]);

  useEffect(() => {
    if (editingTradeId) return;
    if (!tradeName.trim()) {
      setTradeSlug("");
      return;
    }
    setTradeSlug(slugify(tradeName));
  }, [tradeName, editingTradeId]);

  const copyLink = async () => {
    if (!publicQuoteLink) return;
    try {
      await navigator.clipboard.writeText(publicQuoteLink);
      setProfileMsg("Public link copied ✅");
      setTimeout(() => setProfileMsg(null), 2000);
    } catch {
      setProfileMsg("Could not copy link. Please copy it manually.");
    }
  };

  const openQuoteLink = () => {
    if (!publicQuoteLink) return;
    window.open(publicQuoteLink, "_blank", "noopener,noreferrer");
  };

  const openProfileLink = () => {
    if (!publicProfileUrl) return;
    window.open(publicProfileUrl, "_blank", "noopener,noreferrer");
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setProfileMsg(null);

    const cleanSlug = slugify(slug);
    const sortDigits = digitsOnly(bankSortCode).slice(0, 6);
    const accDigits = digitsOnly(bankAccountNumber).slice(0, 8);

    const { error } = await supabase
      .from("profiles")
      .update({
        slug: cleanSlug || null,
        display_name: displayName.trim() || null,
        headline: headline.trim() || null,
        notify_email: notifyEmail.trim() || null,
        vat_number: vatNumber.trim() || null,
        bank_name: bankName.trim() || null,
        bank_account_name: bankAccountName.trim() || null,
        bank_sort_code: sortDigits || null,
        bank_account_number: accDigits || null,
      })
      .eq("id", userId);

    if (error) {
      setProfileMsg(error.message);
      setSaving(false);
      return;
    }

    setSlug(cleanSlug);
    setProfile((prev) => ({
      ...(prev || ({ id: userId } as ProfileRow)),
      slug: cleanSlug || null,
      display_name: displayName.trim() || null,
      headline: headline.trim() || null,
      notify_email: notifyEmail.trim() || null,
      vat_number: vatNumber.trim() || null,
      bank_name: bankName.trim() || null,
      bank_account_name: bankAccountName.trim() || null,
      bank_sort_code: sortDigits || null,
      bank_account_number: accDigits || null,
      logo_url: prev?.logo_url || null,
    }));

    setProfileMsg("Business profile saved ✅");
    setSaving(false);
  };

  const onLogoPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    setProfileMsg(null);
    if (!userId) return;

    const file = e.target.files?.[0] || null;
    if (!file) return;

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setLogoError("Logo too large (max 5MB).");
      return;
    }

    setLogoUploading(true);

    const ext = file.name.split(".").pop() || "png";
    const fileName = `logo-${Date.now()}.${ext}`;
    const path = `logos/${userId}/${fileName}`;

    const { error: upErr } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true });

    if (upErr) {
      setLogoError(upErr.message);
      setLogoUploading(false);
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    const url = data.publicUrl;

    const { error: saveErr } = await supabase
      .from("profiles")
      .update({ logo_url: url })
      .eq("id", userId);

    if (saveErr) {
      setLogoError(saveErr.message);
      setLogoUploading(false);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, logo_url: url } : prev));
    setLogoUploading(false);
    setProfileMsg("Logo updated ✅");
  };

  const resetLocationForm = () => {
    setLocationInput("");
    setLocationLabel("");
    setLocationLookupState("idle");
    lastLocationLookedUp.current = "";
  };

  const addLocation = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLocationMsg(null);

    const p = outwardFrom(locationInput);

    if (!p) {
      setLocationMsg("Type a postcode prefix like RH16.");
      return;
    }

    if (!looksLikeOutward(p)) {
      setLocationMsg("That postcode prefix looks invalid.");
      return;
    }

    let finalLabel = (locationLabel || "").trim();

    if (!finalLabel) {
      setLocationBusy(true);
      const found = await lookupLocationLabel(p);
      setLocationBusy(false);
      if (found) finalLabel = found;
    }

    if (!finalLabel) {
      setLocationMsg("Couldn’t find a location label for that prefix.");
      return;
    }

    const already = locations.some(
      (r) => outwardFrom(r.postcode_prefix || "") === p
    );

    if (already) {
      setLocationMsg("That postcode prefix is already added.");
      return;
    }

    setLocationBusy(true);

    const { data, error } = await supabase
      .from("trade_locations")
      .insert({
        user_id: userId,
        postcode_prefix: p,
        label: finalLabel,
      })
      .select("id, user_id, postcode_prefix, label, created_at")
      .maybeSingle();

    if (error) {
      setLocationMsg(`Add location error: ${error.message}`);
      setLocationBusy(false);
      return;
    }

    if (data) {
      setLocations((prev) =>
        [...prev, data as LocationRow].sort((a, b) =>
          String(a.postcode_prefix || "").localeCompare(
            String(b.postcode_prefix || "")
          )
        )
      );
    }

    resetLocationForm();
    setLocationMsg("Location added ✅");
    setLocationBusy(false);
  };

  const removeLocation = async (id: string) => {
    if (!userId) return;

    const ok = confirm("Delete this postcode prefix?");
    if (!ok) return;

    setLocationBusy(true);
    setLocationMsg(null);

    const { error } = await supabase
      .from("trade_locations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setLocationMsg(`Delete error: ${error.message}`);
      setLocationBusy(false);
      return;
    }

    setLocations((prev) => prev.filter((r) => r.id !== id));
    setLocationMsg("Location deleted ✅");
    setLocationBusy(false);
  };

  const resetTradeForm = () => {
    setEditingTradeId(null);
    setTradeName("");
    setTradeSlug("");
  };

  const beginTradeEdit = (t: Trade) => {
    setEditingTradeId(t.id);
    setTradeName(t.name);
    setTradeSlug(t.slug);
    setTradeMsg(null);
  };

  const cancelTradeEdit = () => {
    resetTradeForm();
    setTradeMsg(null);
  };

  const addOrSaveTrade = async (e: FormEvent) => {
    e.preventDefault();
    setTradeMsg(null);

    const cleanName = tradeName.trim();
    const cleanSlug = slugify(tradeSlug || tradeName);

    if (!cleanName) {
      setTradeMsg("Please enter a trade name.");
      return;
    }

    if (!cleanSlug) {
      setTradeMsg("Please enter a valid trade slug.");
      return;
    }

    setTradeBusy(true);

    if (editingTradeId) {
      const { error } = await supabase
        .from("trades")
        .update({ name: cleanName, slug: cleanSlug })
        .eq("id", editingTradeId);

      if (error) {
        setTradeMsg(`Could not update trade: ${error.message}`);
        setTradeBusy(false);
        return;
      }

      setTrades((prev) =>
        prev
          .map((t) =>
            t.id === editingTradeId
              ? { ...t, name: cleanName, slug: cleanSlug }
              : t
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      setTradeMsg("Trade updated ✅");
      resetTradeForm();
      setTradeBusy(false);
      return;
    }

    const { data, error } = await supabase
      .from("trades")
      .insert({ name: cleanName, slug: cleanSlug })
      .select("id, name, slug")
      .maybeSingle();

    if (error) {
      setTradeMsg(`Could not add trade: ${error.message}`);
      setTradeBusy(false);
      return;
    }

    if (data) {
      setTrades((prev) =>
        [...prev, data as Trade].sort((a, b) => a.name.localeCompare(b.name))
      );
    }

    setTradeMsg("Trade added ✅");
    resetTradeForm();
    setTradeBusy(false);
  };

  const removeTrade = async (id: string) => {
    const ok = confirm(
      "Delete this trade?\n\nAny services linked to it will need reassigning."
    );
    if (!ok) return;

    setTradeBusy(true);
    setTradeMsg(null);

    const { error } = await supabase.from("trades").delete().eq("id", id);

    if (error) {
      setTradeMsg(`Could not delete trade: ${error.message}`);
      setTradeBusy(false);
      return;
    }

    setTrades((prev) => prev.filter((t) => t.id !== id));
    if (editingTradeId === id) resetTradeForm();

    setTradeMsg("Trade deleted ✅");
    setTradeBusy(false);
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setServiceTradeId("");
    setServiceName("");
    setServicePriceFrom("");
    setServicePriceTo("");
  };

  const beginServiceEdit = (svc: Service) => {
    setEditingServiceId(svc.id);
    setServiceTradeId(svc.trade_id || "");
    setServiceName(svc.name || "");
    setServicePriceFrom(
      svc.price_from === null || typeof svc.price_from === "undefined"
        ? ""
        : String(svc.price_from)
    );
    setServicePriceTo(
      svc.price_to === null || typeof svc.price_to === "undefined"
        ? ""
        : String(svc.price_to)
    );
    setServiceMsg(null);
  };

  const cancelServiceEdit = () => {
    resetServiceForm();
    setServiceMsg(null);
  };

  const addOrSaveService = async (e: FormEvent) => {
    e.preventDefault();
    setServiceMsg(null);

    if (!userId) {
      setServiceMsg("You must be logged in.");
      return;
    }

    const cleanName = serviceName.trim();
    if (!serviceTradeId) {
      setServiceMsg("Please choose a trade.");
      return;
    }

    if (!cleanName) {
      setServiceMsg("Please enter a service name.");
      return;
    }

    let cleanPriceFrom: number | null = null;
    let cleanPriceTo: number | null = null;

    if (servicePriceFrom.trim()) {
      const n = Number(servicePriceFrom);
      if (!Number.isFinite(n) || n < 0) {
        setServiceMsg("Guide price from must be a valid number.");
        return;
      }
      cleanPriceFrom = n;
    }

    if (servicePriceTo.trim()) {
      const n = Number(servicePriceTo);
      if (!Number.isFinite(n) || n < 0) {
        setServiceMsg("Guide price to must be a valid number.");
        return;
      }
      cleanPriceTo = n;
    }

    if (
      cleanPriceFrom !== null &&
      cleanPriceTo !== null &&
      cleanPriceTo < cleanPriceFrom
    ) {
      setServiceMsg("Guide price to cannot be lower than guide price from.");
      return;
    }

    setServiceBusy(true);

    if (editingServiceId) {
      const { error } = await supabase
        .from("services")
        .update({
          trade_id: serviceTradeId,
          name: cleanName,
          price_from: cleanPriceFrom,
          price_to: cleanPriceTo,
        })
        .eq("id", editingServiceId)
        .eq("user_id", userId);

      if (error) {
        setServiceMsg(`Could not update service: ${error.message}`);
        setServiceBusy(false);
        return;
      }

      setServices((prev) =>
        prev.map((s) =>
          s.id === editingServiceId
            ? {
                ...s,
                trade_id: serviceTradeId,
                name: cleanName,
                price_from: cleanPriceFrom,
                price_to: cleanPriceTo,
              }
            : s
        )
      );

      setServiceMsg("Service updated ✅");
      resetServiceForm();
      setServiceBusy(false);
      return;
    }

    const { data, error } = await supabase
      .from("services")
      .insert({
        user_id: userId,
        trade_id: serviceTradeId,
        name: cleanName,
        price_from: cleanPriceFrom,
        price_to: cleanPriceTo,
      })
      .select("id, name, price_from, price_to, trade_id, user_id, created_at")
      .maybeSingle();

    if (error) {
      setServiceMsg(`Could not add service: ${error.message}`);
      setServiceBusy(false);
      return;
    }

    if (data) {
      setServices((prev) => [data as Service, ...prev]);
    }

    setServiceMsg("Service added ✅");
    resetServiceForm();
    setServiceBusy(false);
  };

  const removeService = async (id: string) => {
    if (!userId) return;

    const ok = confirm("Delete this service?");
    if (!ok) return;

    setServiceBusy(true);
    setServiceMsg(null);

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setServiceMsg(`Could not delete service: ${error.message}`);
      setServiceBusy(false);
      return;
    }

    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingServiceId === id) resetServiceForm();

    setServiceMsg("Service deleted ✅");
    setServiceBusy(false);
  };

  const calBanner = (() => {
    if (!calStatus && !calendarMsg) return null;

    if (calendarMsg) {
      return <p className="ff-help">Opening Google Calendar connect…</p>;
    }

    if (calStatus === "connected") {
      return <p className="ff-helpOk">Google Calendar connected ✅</p>;
    }

    if (calStatus === "notokens") {
      return (
        <p className="ff-helpBad">
          Google didn’t return a refresh token. Try reconnecting.
        </p>
      );
    }

    if (
      calStatus === "error" ||
      calStatus === "badstate" ||
      calStatus === "missing"
    ) {
      return <p className="ff-helpBad">Calendar connection failed. Try again.</p>;
    }

    if (calStatus === "dberror") {
      return <p className="ff-helpBad">Calendar save failed. Try again.</p>;
    }

    return <p className="ff-help">Calendar status: {calStatus}</p>;
  })();

  return (
    <div className="ff-page">
      <div className="ff-wrap">
        <div className="ff-hero">
          <div className="ff-heroGlow" />
          <div className="ff-heroRow">
            <div className="ff-heroText">
              <h1 className="ff-heroTitle">Business setup</h1>
              <p className="ff-heroSub">
                Manage your business profile, public link, locations, services and
                estimate details.
              </p>
              <p className="ff-heroTip">
                Keep everything up to date so your FixFlow profile feels polished,
                ready to share, and ready to win work.
              </p>

              <div className="ff-heroMeta">
                {setupChips.map((chip) => (
                  <div
                    key={chip.label}
                    className={`ff-heroChip ${chip.ok ? "ff-heroChipOk" : ""}`}
                  >
                    {chip.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="ff-heroActions">
              <button
                className="ff-btn ff-btnPrimary"
                type="submit"
                form="profileForm"
                disabled={saving || loading}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>

        {pageMsg ? <div className="ff-msg">{pageMsg}</div> : null}

        <div className="ff-stack">
          <form id="profileForm" onSubmit={handleSave} className="ff-card">
            <div className="ff-cardHead">
              <div className="ff-cardHeading">
                <div className="ff-cardAccent" />
                <div>
                  <div className="ff-cardTitle">BUSINESS PROFILE</div>
                  <div className="ff-cardSub">
                    These details appear on your public page and branded documents.
                  </div>
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              {profileMsg ? <div className="ff-inlineMsg">{profileMsg}</div> : null}

              <div className="ff-profileTop">
                <div className="ff-field">
                  <label className="ff-label">Logo</label>

                  <div className="ff-logoRow">
                    <div className="ff-logoBox">
                      {profile?.logo_url ? (
                        <img
                          src={profile.logo_url}
                          alt="Logo"
                          className="ff-logoImg"
                        />
                      ) : (
                        <span className="ff-logoFallback">
                          {(displayName || slug || "F").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="ff-logoPick">
                      <div className="ff-logoMiniTitle">Your brand</div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onLogoPicked}
                        className="ff-file"
                        disabled={logoUploading || loading}
                      />
                      <div className="ff-help">
                        PNG or JPG up to 5MB. This shows on estimates and documents.
                      </div>
                      {logoUploading ? <div className="ff-help">Uploading…</div> : null}
                      {logoError ? <div className="ff-helpBad">{logoError}</div> : null}
                    </div>
                  </div>
                </div>

                <div className="ff-two">
                  <div className="ff-field">
                    <label className="ff-label">Business name</label>
                    <input
                      className="ff-input"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Anna Plumbing"
                      disabled={loading}
                    />
                  </div>

                  <div className="ff-field">
                    <label className="ff-label">Your link name</label>
                    <input
                      className="ff-input"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="anna-plumbing"
                      disabled={loading}
                    />
                    <div className="ff-help">
                      This becomes your public FixFlow link, like{" "}
                      <span className="ff-inlineCode">
                        {SITE_URL.replace(/\/$/, "")}/{slugify(slug || "anna-plumbing")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ff-two">
                  <div className="ff-field">
                    <label className="ff-label">Headline</label>
                    <input
                      className="ff-input"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="Fast response • Clear pricing • Local service"
                      disabled={loading}
                    />
                  </div>

                  <div className="ff-field">
                    <label className="ff-label">Business email for alerts</label>
                    <input
                      className="ff-input"
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="you@business.com"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="ff-divider" />

                <div className="ff-sectionTitle">Estimate & invoice details</div>
                <div className="ff-help">
                  Optional details that can appear on your estimate and invoice PDFs.
                </div>

                <div className="ff-field" style={{ marginTop: 12 }}>
                  <label className="ff-label">VAT number</label>
                  <input
                    className="ff-input"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    placeholder="GB123456789"
                    disabled={loading}
                  />
                </div>

                <div className="ff-divider" />

                <div className="ff-field">
                  <label className="ff-label">Bank name</label>
                  <input
                    className="ff-input"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Barclays / Lloyds / etc"
                    disabled={loading}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Account name</label>
                  <input
                    className="ff-input"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    placeholder="Anna Plumbing Ltd"
                    disabled={loading}
                  />
                </div>

                <div className="ff-two">
                  <div className="ff-field">
                    <label className="ff-label">Sort code</label>
                    <input
                      className="ff-input"
                      value={formatSortCode(bankSortCode)}
                      onChange={(e) => setBankSortCode(e.target.value)}
                      placeholder="12-34-56"
                      inputMode="numeric"
                      disabled={loading}
                    />
                  </div>

                  <div className="ff-field">
                    <label className="ff-label">Account number</label>
                    <input
                      className="ff-input"
                      value={digitsOnly(bankAccountNumber).slice(0, 8)}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="12345678"
                      inputMode="numeric"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="ff-help">
                  We store sort code and account number as digits only.
                </div>
              </div>

              <div className="ff-footerRow">
                <button
                  className="ff-btn ff-btnSoftPrimary"
                  type="submit"
                  disabled={saving || loading}
                >
                  {saving ? "Saving…" : "Save business profile"}
                </button>
              </div>
            </div>
          </form>

          <div className="ff-card ff-cardFeature">
            <div className="ff-cardHead">
              <div className="ff-cardHeading">
                <div className="ff-cardAccent" />
                <div>
                  <div className="ff-cardTitle">PUBLIC LINK</div>
                  <div className="ff-cardSub">
                    Share this link so customers can request work from you in seconds.
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="ff-pillBtn"
                onClick={openProfileLink}
                disabled={loading || !publicProfileUrl}
              >
                View profile
              </button>
            </div>

            <div className="ff-cardBody">
              {loading ? (
                <div className="ff-help">Loading…</div>
              ) : publicQuoteLink ? (
                <>
                  <div className="ff-linkHero">
                    <div className="ff-linkBadge">Ready to share</div>
                    <div className="ff-linkUrl">{publicQuoteLink}</div>
                  </div>

                  <div className="ff-row">
                    <button type="button" className="ff-btn" onClick={copyLink}>
                      Copy link
                    </button>
                    <button type="button" className="ff-btn" onClick={openQuoteLink}>
                      Open quote page
                    </button>
                  </div>

                  <div className="ff-help">
                    Use this on Google, your website, vans, cards and social pages.
                  </div>
                </>
              ) : (
                <div className="ff-help">
                  Add your link name in business profile to generate your public link.
                </div>
              )}
            </div>
          </div>

          <div className="ff-card">
  <div className="ff-cardHead">
    <div className="ff-cardHeading">
      <div className="ff-cardAccent" />
      <div>
        <div className="ff-cardTitle">CALENDAR CONNECTION</div>
        <div className="ff-cardSub">
         Connect Google Calendar so FixFlow can add site visits and bookings automatically.
        </div>
      </div>
    </div>

    <button
      type="button"
      className={`ff-btn ${
        calStatus === "connected" ? "ff-btnSoftPrimary" : "ff-btnDark"
      }`}
      onClick={() => {
        setCalendarMsg("Opening Google Calendar connect…");
        window.location.href = "/api/calendar/connect";
      }}
      disabled={loading}
    >
      {calStatus === "connected" ? "Reconnect calendar" : "Connect calendar"}
    </button>
  </div>

  <div className="ff-cardBody">
    {calStatus === "connected" ? (
      <div className="ff-connectedCard">
        <div className="ff-connectedDot" />
        <div>
          <div className="ff-connectedTitle">Google Calendar connected</div>
          <div className="ff-connectedSub">
            Site visits can now be added to your calendar automatically.
          </div>
        </div>
      </div>
    ) : calStatus === "error" ||
      calStatus === "badstate" ||
      calStatus === "missing" ? (
      <p className="ff-helpBad">Calendar connection failed. Try again.</p>
    ) : calStatus === "dberror" ? (
      <p className="ff-helpBad">Calendar save failed. Try again.</p>
    ) : calendarMsg ? (
      <p className="ff-help">Opening Google Calendar connect…</p>
    ) : (
      <p className="ff-help">
        Once connected, site visits can be added to your calendar.
      </p>
    )}
  </div>
</div>
          <form onSubmit={addLocation} className="ff-card">
            <div className="ff-cardHead">
              <div className="ff-cardHeading">
                <div className="ff-cardAccent" />
                <div>
                  <div className="ff-cardTitle">LOCATIONS</div>
                  <div className="ff-cardSub">
                    Add postcode prefixes for the areas you cover.
                  </div>
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              {locationMsg ? <div className="ff-inlineMsg">{locationMsg}</div> : null}

              <div className="ff-two">
                <div className="ff-field">
                  <label className="ff-label">Postcode prefix</label>
                  <input
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    className="ff-input"
                    placeholder="RH16 or RH16 1AA"
                    disabled={locationBusy || loading}
                  />
                  <div className="ff-help">
                    We only store the outward code, for example RH16.
                  </div>
                </div>

                <div className="ff-field">
                  <label className="ff-label">Area label</label>
                  <input
                    value={locationLabel}
                    readOnly
                    className="ff-input ff-inputReadOnly"
                    placeholder="Auto-filled…"
                  />
                  <div className="ff-help">
                    {locationLookupState === "looking" ? "Looking up…" : null}
                    {locationLookupState === "found" && locationLabel ? "Found ✅" : null}
                    {locationLookupState === "notfound" && outwardLocation
                      ? `Couldn’t find a label for ${outwardLocation}`
                      : null}
                    {locationLookupState === "idle" && !locationLabel
                      ? "The area label will appear automatically."
                      : null}
                  </div>
                </div>
              </div>

              <div className="ff-footerRow">
                <button
                  type="submit"
                  className="ff-btn ff-btnSoftPrimary"
                  disabled={locationBusy || loading || !outwardLocation}
                >
                  {locationBusy ? "Saving…" : "Add location"}
                </button>
              </div>

              <div className="ff-divider" />

              {locationsLoading ? (
                <div className="ff-help">Loading locations…</div>
              ) : locations.length === 0 ? (
                <div className="ff-help">No locations added yet.</div>
              ) : (
                <div className="ff-tableWrap">
                  <table className="ff-table">
                    <thead>
                      <tr>
                        <th>Postcode prefix</th>
                        <th>Area</th>
                        <th className="ff-thRight">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span className="ff-code">{r.postcode_prefix || "—"}</span>
                          </td>
                          <td>{r.label || "—"}</td>
                          <td className="ff-actionsCell">
                            <button
                              type="button"
                              className="ff-actionDanger"
                              onClick={() => removeLocation(r.id)}
                              disabled={locationBusy}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </form>

          <form onSubmit={addOrSaveTrade} className="ff-card">
            <div className="ff-cardHead">
              <div className="ff-cardHeading">
                <div className="ff-cardAccent" />
                <div>
                  <div className="ff-cardTitle">TRADE CATEGORIES</div>
                  <div className="ff-cardSub">
                    Manage the trade categories available for your services.
                  </div>
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              {tradeMsg ? <div className="ff-inlineMsg">{tradeMsg}</div> : null}

              <div className="ff-two">
                <div className="ff-field">
                  <label className="ff-label">Trade name</label>
                  <input
                    className="ff-input"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    placeholder="Plumbing & Heating"
                    disabled={tradeBusy || loading}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Slug</label>
                  <input
                    className="ff-input"
                    value={tradeSlug}
                    onChange={(e) => setTradeSlug(e.target.value)}
                    placeholder="plumbing-heating"
                    disabled={tradeBusy || loading}
                  />
                  <div className="ff-help">
                    Auto-filled from the trade name. Letters, numbers and hyphens only.
                  </div>
                </div>
              </div>

              <div className="ff-footerRow">
                <button
                  className="ff-btn ff-btnSoftPrimary"
                  type="submit"
                  disabled={tradeBusy || loading}
                >
                  {tradeBusy ? "Saving…" : editingTradeId ? "Save trade" : "Add trade"}
                </button>

                {editingTradeId ? (
                  <button
                    className="ff-btn"
                    type="button"
                    onClick={cancelTradeEdit}
                    disabled={tradeBusy}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>

              <div className="ff-divider" />

              <div className="ff-field" style={{ marginBottom: 14 }}>
                <label className="ff-label">Search trades</label>
                <input
                  className="ff-input"
                  value={tradeSearch}
                  onChange={(e) => setTradeSearch(e.target.value)}
                  placeholder="Search trade…"
                />
              </div>

              {tradesLoading ? (
                <div className="ff-help">Loading trades…</div>
              ) : filteredTrades.length === 0 ? (
                <div className="ff-help">No trades added yet.</div>
              ) : (
                <div className="ff-tableWrap">
                  <table className="ff-table">
                    <thead>
                      <tr>
                        <th>Trade</th>
                        <th>Slug</th>
                        <th className="ff-thRight">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrades.map((t) => (
                        <tr
                          key={t.id}
                          className={editingTradeId === t.id ? "ff-rowEditing" : ""}
                        >
                          <td>
                            <div className="ff-tableMain">{t.name}</div>
                          </td>
                          <td>
                            <span className="ff-code">{t.slug}</span>
                          </td>
                          <td className="ff-actionsCell">
                            <button
                              type="button"
                              className="ff-btn ff-btnSm"
                              onClick={() => beginTradeEdit(t)}
                              disabled={tradeBusy}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="ff-actionDanger"
                              onClick={() => removeTrade(t.id)}
                              disabled={tradeBusy}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </form>

          <form onSubmit={addOrSaveService} className="ff-card">
            <div className="ff-cardHead">
              <div className="ff-cardHeading">
                <div className="ff-cardAccent" />
                <div>
                  <div className="ff-cardTitle">SERVICES</div>
                  <div className="ff-cardSub">
                    Add services under each trade so customers can choose what they need.
                  </div>
                </div>
              </div>
            </div>

            <div className="ff-cardBody">
              {serviceMsg ? <div className="ff-inlineMsg">{serviceMsg}</div> : null}

              <div className="ff-four">
                <div className="ff-field">
                  <label className="ff-label">Trade</label>
                  <select
                    value={serviceTradeId}
                    onChange={(e) => setServiceTradeId(e.target.value)}
                    className="ff-input"
                    disabled={serviceBusy || loading}
                  >
                    <option value="">Choose…</option>
                    {trades.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ff-field ff-fieldWide">
                  <label className="ff-label">Service name</label>
                  <input
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="ff-input"
                    placeholder="Boiler service"
                    disabled={serviceBusy || loading}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Guide price from</label>
                  <input
                    value={servicePriceFrom}
                    onChange={(e) => setServicePriceFrom(e.target.value)}
                    className="ff-input"
                    placeholder="e.g. 80"
                    inputMode="decimal"
                    disabled={serviceBusy || loading}
                  />
                </div>

                <div className="ff-field">
                  <label className="ff-label">Guide price to</label>
                  <input
                    value={servicePriceTo}
                    onChange={(e) => setServicePriceTo(e.target.value)}
                    className="ff-input"
                    placeholder="e.g. 120"
                    inputMode="decimal"
                    disabled={serviceBusy || loading}
                  />
                </div>
              </div>

              <div className="ff-footerRow">
                <button
                  className="ff-btn ff-btnSoftPrimary"
                  type="submit"
                  disabled={serviceBusy || loading}
                >
                  {serviceBusy
                    ? "Saving…"
                    : editingServiceId
                    ? "Save service"
                    : "Add service"}
                </button>

                {editingServiceId ? (
                  <button
                    className="ff-btn"
                    type="button"
                    onClick={cancelServiceEdit}
                    disabled={serviceBusy}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>

              <div className="ff-divider" />

              <div className="ff-headControls">
                <div className="ff-filterWrap">
                  <label className="ff-label">Filter by trade</label>
                  <select
                    value={serviceTradeFilter}
                    onChange={(e) => setServiceTradeFilter(e.target.value)}
                    className="ff-input"
                  >
                    <option value="all">All trades</option>
                    {trades.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ff-searchWrap">
                  <label className="ff-label">Search services</label>
                  <input
                    className="ff-input"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search service or trade…"
                  />
                </div>
              </div>

              <div className="ff-help" style={{ marginBottom: 12, marginTop: 12 }}>
                Guide prices help customers understand likely cost without making it
                a fixed quote.
              </div>

              {servicesLoading ? (
                <div className="ff-help">Loading services…</div>
              ) : filteredServices.length === 0 ? (
                <div className="ff-help">No services added yet.</div>
              ) : (
                <div className="ff-tableWrap">
                  <table className="ff-table ff-tableWide">
                    <thead>
                      <tr>
                        <th>Trade</th>
                        <th>Service</th>
                        <th>Guide price</th>
                        <th className="ff-thRight">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.map((s) => (
                        <tr
                          key={s.id}
                          className={editingServiceId === s.id ? "ff-rowEditing" : ""}
                        >
                          <td>
                            <span className="ff-code">{tradeNameById(s.trade_id)}</span>
                          </td>
                          <td>
                            <div className="ff-tableMain">{s.name}</div>
                          </td>
                          <td>{guidePrice(s.price_from, s.price_to)}</td>
                          <td className="ff-actionsCell">
                            <button
                              type="button"
                              onClick={() => beginServiceEdit(s)}
                              className="ff-btn ff-btnSm"
                              disabled={serviceBusy}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => removeService(s.id)}
                              className="ff-actionDanger"
                              disabled={serviceBusy}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
:global(body){ background:#f6f8fc; }


.ff-page{
  flex: 1;
  min-height: 0;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: transparent;
  padding: 0;
}

.ff-wrap{
  width: 100%;
  min-width: 0;
  max-width: none;
  margin: 0;
  padding: 4px 0 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ff-hero{
  position:relative;
  border:1px solid rgba(226,232,240,0.9);
  border-radius:22px;
  padding:24px;
  background:linear-gradient(135deg, rgba(31,111,255,0.16), rgba(255,255,255,0.96) 55%);
  overflow:hidden;
  box-shadow:0 18px 42px rgba(15,23,42,0.07);
}
.ff-connectedCard{
  display:flex;
  align-items:flex-start;
  gap:12px;
  padding:14px;
  border-radius:16px;
  border:1px solid rgba(16,185,129,0.18);
  background:linear-gradient(180deg,#f4fff9,#ecfdf5);
}

.ff-connectedDot{
  width:10px;
  height:10px;
  border-radius:999px;
  background:#10b981;
  margin-top:5px;
  box-shadow:0 0 0 6px rgba(16,185,129,0.12);
  flex-shrink:0;
}

.ff-connectedTitle{
  font-size:14px;
  font-weight:900;
  color:#065f46;
}

.ff-connectedSub{
  margin-top:4px;
  font-size:12px;
  color:#047857;
}
.ff-heroGlow{
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at 14% 18%, rgba(36,91,255,0.18), transparent 55%),
    radial-gradient(circle at 88% 20%, rgba(11,42,85,0.08), transparent 60%);
  pointer-events:none;
}

.ff-heroRow{
  position:relative;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:18px;
}

.ff-heroText{
  max-width:760px;
}

.ff-heroTitle{
  margin:0;
  font-size:30px;
  line-height:1.05;
  font-weight:950;
  color:#10213f;
  letter-spacing:-0.03em;
}

.ff-heroSub{
  margin:10px 0 0;
  font-size:14px;
  color:#576579;
  max-width:620px;
}

.ff-heroTip{
  margin:10px 0 0;
  font-size:13px;
  color:#5c6b84;
  max-width:680px;
}

.ff-heroMeta{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:16px;
}

.ff-heroChip{
  border: 1px solid rgba(15,23,42,0.08);
  background: rgba(255,255,255,0.72);
  color: #1f355c;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 800;
  backdrop-filter: blur(8px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
}

.ff-heroChipOk{
  border-color: rgba(36,91,255,0.14);
  background: rgba(255,255,255,0.86);
}

.ff-heroActions{
  flex-shrink:0;
  display:flex;
  gap:10px;
}

.ff-msg{
  border:1px solid rgba(226,232,240,0.9);
  background:rgba(255,255,255,0.82);
  backdrop-filter:blur(6px);
  border-radius:14px;
  padding:12px 14px;
  font-size:13px;
}

.ff-inlineMsg{
  border:1px solid rgba(213,225,255,0.95);
  background:linear-gradient(180deg, #f8fbff, #f2f7ff);
  border-radius:14px;
  padding:11px 13px;
  font-size:13px;
  margin-bottom:16px;
  color:#1F355C;
}

.ff-stack{
  display:flex;
  flex-direction:column;
  gap:20px;
}

.ff-card{
  background:#fff;
  border:1px solid rgba(226,232,240,0.9);
  border-radius:20px;
  box-shadow:0 16px 40px rgba(15,23,42,0.055);
  overflow:hidden;
}

.ff-cardFeature{
  border-color:rgba(210,223,255,0.95);
  box-shadow:0 18px 44px rgba(31,91,255,0.08);
}

.ff-cardHead{
  padding:18px 20px;
  border-bottom:1px solid rgba(226,232,240,0.75);
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
  background:linear-gradient(180deg, rgba(247,249,252,0.98), rgba(255,255,255,0.98));
}

.ff-cardHeading{
  display:flex;
  align-items:flex-start;
  gap:12px;
}

.ff-cardAccent{
  width:4px;
  min-width:4px;
  height:34px;
  border-radius:999px;
  background:linear-gradient(180deg, rgba(31,53,92,1), rgba(31,53,92,0.18));
}

.ff-cardTitle{
  font-size:12px;
  font-weight:900;
  letter-spacing:0.1em;
  text-transform:uppercase;
  color:#10213f;
}

.ff-cardSub{
  margin-top:4px;
  font-size:13px;
  color:#5b6472;
}

.ff-cardBody{
  padding:22px 20px 20px;
}

.ff-profileTop{
  display:flex;
  flex-direction:column;
  gap:18px;
}

.ff-logoRow{
  display:flex;
  gap:14px;
  align-items:center;
  padding:14px;
  border:1px solid rgba(226,232,240,0.9);
  background:linear-gradient(180deg, #fbfcff, #f7faff);
  border-radius:18px;
}

.ff-logoBox{
  width:64px;
  height:64px;
  border-radius:18px;
  border:1px solid rgba(226,232,240,0.95);
  background:linear-gradient(180deg, #ffffff, #f7f9fd);
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  flex-shrink:0;
}

.ff-logoImg{
  width:100%;
  height:100%;
  object-fit:cover;
}

.ff-logoFallback{
  font-size:22px;
  font-weight:900;
  color:#1F355C;
}

.ff-logoPick{
  min-width:0;
}

.ff-logoMiniTitle{
  font-size:14px;
  font-weight:900;
  color:#10213f;
  margin-bottom:6px;
}

.ff-linkHero{
  border:1px solid rgba(210,223,255,0.95);
  background:linear-gradient(180deg, #f7faff, #edf4ff);
  border-radius:18px;
  padding:14px;
}

.ff-linkBadge{
  display:inline-flex;
  padding:6px 10px;
  border-radius:999px;
  background:#fff;
  border:1px solid rgba(200,215,245,1);
  color:#245BFF;
  font-size:12px;
  font-weight:900;
  margin-bottom:10px;
}

.ff-linkUrl{
  font-size:14px;
  line-height:1.45;
  color:#10213f;
  font-weight:800;
  word-break:break-all;
}

.ff-pillBtn{
  border:1px solid rgba(226,232,240,1);
  background:#f6f8fc;
  color:#0b1320;
  border-radius:999px;
  padding:8px 12px;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
  transition:all .15s ease;
}

.ff-pillBtn:hover{
  background:#eef2f7;
  border-color:#cbd5e1;
  box-shadow:0 8px 16px rgba(15,23,42,0.08);
}

.ff-row{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:14px;
}

.ff-btn{
  border:1px solid rgba(226,232,240,1);
  background:#fff;
  color:#0b1320;
  border-radius:12px;
  padding:10px 13px;
  font-size:13px;
  font-weight:800;
  cursor:pointer;
  transition:all .15s ease;
}

.ff-btnSm{
  padding:8px 11px;
  font-size:12px;
}

.ff-btn:hover{
  background:#f3f6fb;
  border-color:#cbd5e1;
  box-shadow:0 8px 18px rgba(15,23,42,0.08);
}

.ff-btnPrimary{
  background: linear-gradient(180deg, #0f2f66 0%, #0b234d 100%);
  border: 1px solid rgba(11,35,77,0.95);
  color: #fff;
  box-shadow:
    0 12px 26px rgba(11,35,77,0.22),
    inset 0 1px 0 rgba(255,255,255,0.14);
}

.ff-btnPrimary:hover{
  background:linear-gradient(180deg,#1F355C,#162A4A);
  box-shadow:0 16px 30px rgba(31,53,92,0.20);
  filter:brightness(1.05);
}

.ff-btnSoftPrimary{
  border:1px solid rgba(205,218,238,1);
  background:linear-gradient(180deg,#f8fbff,#eef3fb);
  color:#1F355C;
  box-shadow:none;
}

.ff-btnSoftPrimary:hover{
  background:linear-gradient(180deg,#f6f9ff,#e9f0fb);
}

.ff-btnDark{
  border:1px solid rgba(15,23,42,0.15);
  background:#0b1320;
  color:#fff;
  box-shadow:0 12px 22px rgba(11,19,32,0.14);
}

.ff-btnDark:hover{
  background:#0b1320;
  filter:brightness(1.05);
  box-shadow:0 14px 26px rgba(11,19,32,0.18);
}

.ff-actionDanger{
  border:none;
  background:transparent;
  color:#b45353;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
  padding:8px 6px;
}

.ff-actionDanger:hover{
  color:#991b1b;
}

.ff-btn:disabled,
.ff-pillBtn:disabled,
.ff-input:disabled,
.ff-actionDanger:disabled{
  opacity:.6;
  cursor:not-allowed;
  box-shadow:none;
}

.ff-label{
  display:block;
  font-size:12px;
  font-weight:900;
  margin-bottom:6px;
  color:#13233f;
}

.ff-input{
  width:100%;
  border-radius:14px;
  border:1px solid rgba(226,232,240,0.95);
  background:#fff;
  padding:11px 12px;
  font-size:14px;
  box-sizing:border-box;
  color:#0b1320;
}

.ff-input:focus{
  outline:none;
  border-color:rgba(31,111,255,0.45);
  box-shadow:0 0 0 5px rgba(31,111,255,0.12);
}

.ff-inputReadOnly{
  background:#f8fafc;
}

.ff-help{
  margin-top:6px;
  font-size:12px;
  color:#5c6b84;
}

.ff-helpOk{
  font-size:12px;
  color:#0f766e;
  font-weight:700;
}

.ff-helpBad{
  font-size:12px;
  color:#b91c1c;
  font-weight:700;
}

.ff-inlineCode{
  display:inline-block;
  margin-top:4px;
  padding:4px 8px;
  border-radius:999px;
  background:#f6f8fc;
  border:1px solid rgba(226,232,240,0.9);
  font-size:12px;
  font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  color:#1F355C;
}

.ff-divider{
  height:1px;
  background:rgba(226,232,240,0.9);
  margin:16px 0;
}

.ff-two{
  display:grid;
  gap:14px;
}

.ff-four{
  display:grid;
  gap:14px;
}

.ff-field{
  min-width:0;
}

.ff-fieldWide{
  min-width:0;
}

.ff-file{
  font-size:13px;
}

.ff-sectionTitle{
  font-size:14px;
  font-weight:900;
  color:#10213f;
  margin-bottom:4px;
}

.ff-footerRow{
  display:flex;
  gap:10px;
  margin-top:12px;
  flex-wrap:wrap;
}

.ff-tableWrap{
  overflow-x:auto;
  border:1px solid rgba(226,232,240,0.85);
  border-radius:16px;
  margin-top:6px;
}

.ff-table{
  width:100%;
  min-width:640px;
  border-collapse:collapse;
}

.ff-tableWide{
  min-width:760px;
}

.ff-table thead th{
  background:#f8fafc;
  color:#5c6b84;
  font-size:12px;
  font-weight:800;
  text-align:left;
  padding:14px 16px;
  border-bottom:1px solid rgba(226,232,240,0.9);
}

.ff-table tbody td{
  padding:14px 16px;
  border-top:1px solid rgba(226,232,240,0.75);
  vertical-align:middle;
}

.ff-table tbody tr:hover{
  background:#fbfdff;
}

.ff-rowEditing{
  background:#f7faff;
}

.ff-thRight{
  text-align:right !important;
}

.ff-actionsCell{
  text-align:right;
  white-space:nowrap;
}

.ff-tableMain{
  font-weight:800;
  color:#0B1320;
}

.ff-code{
  display:inline-block;
  padding:6px 10px;
  border-radius:999px;
  background:#f6f8fc;
  border:1px solid rgba(226,232,240,0.9);
  font-size:12px;
  font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  color:#1F355C;
}

.ff-headControls{
  display:flex;
  gap:10px;
  align-items:flex-end;
  flex-wrap:wrap;
}

.ff-filterWrap{
  width:180px;
  max-width:100%;
}

.ff-searchWrap{
  width:260px;
  max-width:100%;
}

@media(min-width:720px){
  .ff-two{
    grid-template-columns:1fr 1fr;
  }
}

@media(min-width:980px){
  .ff-four{
    grid-template-columns:1fr 1.4fr 1fr 1fr;
  }
}

@media(max-width:720px){
  .ff-heroRow,
  .ff-cardHead,
  .ff-logoRow{
    flex-direction:column;
    align-items:stretch;
  }

  .ff-heroActions{
    width:100%;
  }

  .ff-heroActions .ff-btn{
    width:100%;
  }

  .ff-footerRow{
    flex-direction:column;
  }

  .ff-footerRow .ff-btn{
    width:100%;
  }

  .ff-headControls{
    flex-direction:column;
    align-items:stretch;
  }

  .ff-filterWrap,
  .ff-searchWrap{
    width:100%;
  }

  .ff-actionsCell{
    white-space:normal;
  }

  .ff-actionsCell .ff-btn,
  .ff-actionsCell .ff-actionDanger{
    margin-top:8px;
    margin-right:8px;
  }
}
`;