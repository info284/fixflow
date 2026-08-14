"use client";
import "@/app/dashboard/shared-flow.css";
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
  brand_colour: string | null;
  headline: string | null;
  notify_email: string | null;
  logo_url: string | null;
  profile_photo_url: string | null;
  business_phone: string | null;
  business_description: string | null;
  trading_address: string | null;
  years_in_business: number | null;
 insurance_cover: string | null;
  vat_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  after_job_guarantee: string | null;
  completion_email_enabled: boolean | null;
default_completion_message: string | null;
stripe_account_id: string | null;
stripe_charges_enabled: boolean | null;
stripe_payouts_enabled: boolean | null;
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

type TraderCertificate = {
  id: string;
  trader_id: string;
  name: string;
  certificate_number: string | null;
  expiry_date: string | null;
  file_url: string | null;
  show_on_estimates: boolean;
  show_on_invoices: boolean;
  created_at: string;
  updated_at: string;

};

type ReviewRow = {
  id: string;
  tradesperson_id: string;
  request_id: string | null;
  rating: number;
  comment: string | null;
  reviewer_name: string | null;
  customer_name: string | null;
  created_at: string;
  verified: boolean | null;
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
function getCertificateStatus(expiry: string | null) {
  if (!expiry) return { label: "No expiry", tone: "neutral" };

  const today = new Date();
  const exp = new Date(expiry);

  const diffMs = exp.getTime() - today.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { label: "Expired", tone: "red" };
  }

  if (days <= 7) {
    return { label: `Expires in ${days} day${days === 1 ? "" : "s"}`, tone: "red" };
  }

  if (days <= 30) {
    return { label: `Expires in ${days} days`, tone: "amber" };
  }

  return { label: `Valid (${days} days left)`, tone: "green" };
}
function getCertificateWarning(expiryDate?: string | null) {
  if (!expiryDate) return null;

  const expiry = new Date(expiryDate);
  const today = new Date();

  const diffDays = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return `Expired ${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (diffDays <= 14) {
    return `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  }

  if (diffDays <= 30) return "Expires within 1 month";
  if (diffDays <= 60) return "Expires within 2 months";

  return null;
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

  const [certificateMsg, setCertificateMsg] = useState<string | null>(null);
const [certificateBusy, setCertificateBusy] = useState(false);


  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [brandColour, setBrandColour] = useState("#2563EB");
  const [businessDescription, setBusinessDescription] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
const [billingBusy, setBillingBusy] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);
const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [calStatus, setCalStatus] = useState<string | null>(null);
const [tradingAddress, setTradingAddress] = useState("");
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
  const certFileInputRef = useRef<HTMLInputElement | null>(null);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeName, setTradeName] = useState("");
  const [tradeSlug, setTradeSlug] = useState("");
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeSearch, setTradeSearch] = useState("");
const [confirmState, setConfirmState] = useState<{
  open: boolean;
  message: string;
  onConfirm: (() => void) | null;
}>({
  open: false,
  message: "",
  onConfirm: null,
});
const [editingCertId, setEditingCertId] = useState<string | null>(null);
const [certificates, setCertificates] = useState<TraderCertificate[]>([]);
const [reviews, setReviews] = useState<ReviewRow[]>([]);
const [reviewsLoading, setReviewsLoading] = useState(false);
const [certName, setCertName] = useState("");
const [certNumber, setCertNumber] = useState("");
const [certExpiry, setCertExpiry] = useState("");
const [certShowEstimates, setCertShowEstimates] = useState(true);
const [certShowInvoices, setCertShowInvoices] = useState(true);
const [certFile, setCertFile] = useState<File | null>(null);
const [insuranceCover, setInsuranceCover] = useState("");
const [afterJobGuarantee, setAfterJobGuarantee] = useState("");
const [completionEmailEnabled, setCompletionEmailEnabled] = useState(true);
const [defaultCompletionMessage, setDefaultCompletionMessage] = useState("");
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

const profileCompleteness = useMemo(() => {
  const checks = [
    displayName,
    slug,
    headline,
    businessDescription,
    businessPhone,
    notifyEmail,
    profile?.logo_url,
    profile?.profile_photo_url,
    locations.length > 0 ? "locations" : "",
    services.length > 0 ? "services" : "",
    certificates.length > 0 ? "certificates" : "",
    yearsInBusiness,
    insuranceCover,
  ];

  const done = checks.filter((x) => String(x || "").trim()).length;
  return Math.round((done / checks.length) * 100);
}, [
  displayName,
  slug,
  headline,
  businessDescription,
  businessPhone,
  notifyEmail,
  profile?.logo_url,
  profile?.profile_photo_url,
  locations.length,
  services.length,
  certificates.length,
  yearsInBusiness,
  insuranceCover,
]);

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
      {
  label: `${profileCompleteness}% profile complete`,
  ok: profileCompleteness >= 80,
},
    ];
 }, [publicQuoteLink, locations.length, services.length, profileCompleteness]);

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

const loadCertificates = async (uid: string) => {
  const { data, error } = await supabase
    .from("trader_certificates")
    .select("*")
    .eq("trader_id", uid)
    .order("expiry_date", { ascending: true });

  if (!error) {
    setCertificates((data || []) as TraderCertificate[]);
  }
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

const loadReviews = async (uid: string) => {
  setReviewsLoading(true);

  const { data, error } = await supabase
    .from("reviews")
    .select(`
      id,
      tradesperson_id,
      request_id,
      rating,
      comment,
      reviewer_name,
      customer_name,
      created_at,
      verified
    `)
    .eq("tradesperson_id", uid)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (!error) {
    setReviews((data || []) as ReviewRow[]);
  }

  setReviewsLoading(false);
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
  "id, slug, display_name, brand_colour, headline, notify_email, logo_url, profile_photo_url, business_phone, business_description, years_in_business, trading_address, insurance_cover, after_job_guarantee, completion_email_enabled, default_completion_message, vat_number, bank_name, bank_account_name, bank_sort_code, bank_account_number, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled"
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
      setBrandColour(p?.brand_colour || "#2563EB");
      setHeadline(p?.headline || "");
      setBusinessDescription(p?.business_description || "");
      setYearsInBusiness(
  p?.years_in_business ? String(p.years_in_business) : ""
);
setInsuranceCover(
  p?.insurance_cover ? String(p.insurance_cover) : ""
);

setAfterJobGuarantee(
  p?.after_job_guarantee
    ? String(p.after_job_guarantee)
    : ""
);

setCompletionEmailEnabled(
  p?.completion_email_enabled ?? true
);

setDefaultCompletionMessage(
  p?.default_completion_message || ""
);

setTradingAddress(p?.trading_address || "");
      setNotifyEmail(p?.notify_email || user.email || "");
      setBusinessPhone(p?.business_phone || "");

      setVatNumber(p?.vat_number || "");
      setBankName(p?.bank_name || "");
      setBankAccountName(p?.bank_account_name || "");
      setBankSortCode(p?.bank_sort_code || "");
      setBankAccountNumber(p?.bank_account_number || "");

await Promise.all([
  loadLocations(user.id),
  loadTrades(),
  loadServices(user.id),
  loadCertificates(user.id),
  loadReviews(user.id),
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

async function connectStripe() {
  try {
    if (!userId) {
      alert("Missing user");
      return;
    }

    const res = await fetch(
      "/api/stripe/connect/create-account",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Could not connect Stripe");
    }

    window.location.href = data.url;
  } catch (err) {
    console.error(err);
    alert("Could not connect Stripe");
  }
}
async function manageSubscription() {
  try {
    if (!userId) {
      alert("Missing user");
      return;
    }

    setBillingBusy(true);

    const res = await fetch("/api/stripe/billing-portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Could not open billing portal");
    }

    window.location.href = data.url;
  } catch (err) {
    console.error(err);
    alert("Could not open billing portal");
    setBillingBusy(false);
  }
}
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
        brand_colour: brandColour,
        headline: headline.trim() || null,
        business_description: businessDescription.trim() || null,
        years_in_business: yearsInBusiness
  ? Number(yearsInBusiness)
  : null,
insurance_cover: insuranceCover.trim() || null,
after_job_guarantee: afterJobGuarantee.trim() || null,
completion_email_enabled: completionEmailEnabled,
default_completion_message:
  defaultCompletionMessage.trim() || null,
  trading_address: tradingAddress.trim() || null,
        notify_email: notifyEmail.trim() || null,
        business_phone: businessPhone.trim() || null,
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
      brand_colour: brandColour,
      headline: headline.trim() || null,
      notify_email: notifyEmail.trim() || null,
      business_description: businessDescription.trim() || null,
      years_in_business: yearsInBusiness
  ? Number(yearsInBusiness)
  : null,
insurance_cover: insuranceCover.trim() || null,
after_job_guarantee: afterJobGuarantee.trim() || null,
completion_email_enabled: completionEmailEnabled,
default_completion_message:
  defaultCompletionMessage.trim() || null,
  trading_address: tradingAddress.trim() || null,
  business_phone: businessPhone.trim() || null,
      vat_number: vatNumber.trim() || null,
      bank_name: bankName.trim() || null,
      bank_account_name: bankAccountName.trim() || null,
      bank_sort_code: sortDigits || null,
      bank_account_number: accDigits || null,
      logo_url: prev?.logo_url || null,
      profile_photo_url: prev?.profile_photo_url || null,
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
const onProfilePhotoPicked = async (e: ChangeEvent<HTMLInputElement>) => {
  setProfilePhotoError(null);
  setProfileMsg(null);
  if (!userId) return;

  const file = e.target.files?.[0] || null;
  if (!file) return;

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    setProfilePhotoError("Photo too large (max 5MB).");
    return;
  }

  setProfilePhotoUploading(true);

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `profile-${Date.now()}.${ext}`;
  const path = `profile-photos/${userId}/${fileName}`;

  const { error: upErr } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true });

  if (upErr) {
    setProfilePhotoError(upErr.message);
    setProfilePhotoUploading(false);
    return;
  }

  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  const url = data.publicUrl;

  const { error: saveErr } = await supabase
    .from("profiles")
    .update({ profile_photo_url: url })
    .eq("id", userId);

  if (saveErr) {
    setProfilePhotoError(saveErr.message);
    setProfilePhotoUploading(false);
    return;
  }

  setProfile((prev) =>
    prev ? { ...prev, profile_photo_url: url } : prev
  );

  setProfilePhotoUploading(false);
  setProfileMsg("Profile photo updated ✅");
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

  setConfirmState({
    open: true,
    message: "Delete this postcode prefix?",
    onConfirm: async () => {
      await deleteLocationConfirmed(id);
    },
  });
};
const deleteLocationConfirmed = async (id: string) => {
  if (!userId) return;

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
  setConfirmState({
    open: true,
    message: "Delete this trade? Any services linked to it may need reassigning.",
    onConfirm: async () => {
      await deleteTradeConfirmed(id);
    },
  });
};

const deleteTradeConfirmed = async (id: string) => {
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

  setConfirmState({
    open: true,
    message: "Delete this service?",
    onConfirm: async () => {
      await deleteServiceConfirmed(id);
    },
  });
};
const deleteServiceConfirmed = async (id: string) => {
  if (!userId) return;

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

const resetCertificateForm = () => {
  setCertName("");
  setCertNumber("");
  setCertExpiry("");
  setCertShowEstimates(true);
  setCertShowInvoices(true);
  setCertFile(null);
};

const addCertificate = async (e: any) => {
  e.preventDefault();

  if (!userId) return;

  setCertificateMsg(null);

  if (!certName.trim()) {
    setCertificateMsg("Please enter a certificate name.");
    return;
  }

setCertificateBusy(true);

if (editingCertId) {
  const { error } = await supabase
    .from("trader_certificates")
    .update({
      name: certName.trim(),
      certificate_number: certNumber.trim() || null,
      expiry_date: certExpiry || null,
      show_on_estimates: certShowEstimates,
      show_on_invoices: certShowInvoices,
    })
    .eq("id", editingCertId)
    .eq("trader_id", userId);

  if (error) {
    setCertificateMsg(error.message);
    setCertificateBusy(false);
    return;
  }

  setCertificates((prev) =>
    prev.map((c) =>
      c.id === editingCertId
        ? {
            ...c,
            name: certName.trim(),
            certificate_number: certNumber.trim() || null,
            expiry_date: certExpiry || null,
            show_on_estimates: certShowEstimates,
            show_on_invoices: certShowInvoices,
          }
        : c
    )
  );

  setEditingCertId(null);
  resetCertificateForm();
  setCertificateMsg("Certificate updated ✅");
  setCertificateBusy(false);
  return;
}
  let fileUrl: string | null = null;

try {
  if (certFile) {
    const ext = certFile.name.split(".").pop() || "pdf";

    const fileName = `${Date.now()}-${certName
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "-")}.${ext}`;

    const path = `certificates/${userId}/${fileName}`;



    const { error: uploadError } = await supabase.storage
      .from("quote-files")
      .upload(path, certFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("quote-files")
      .getPublicUrl(path);

    fileUrl = data.publicUrl;
  }


    const { data, error } = await supabase
      .from("trader_certificates")
      .insert({
        trader_id: userId,
        name: certName.trim(),
        certificate_number: certNumber.trim() || null,
        expiry_date: certExpiry || null,
        file_url: fileUrl,
        show_on_estimates: certShowEstimates,
        show_on_invoices: certShowInvoices,
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (data) {
      setCertificates((prev) => [data as TraderCertificate, ...prev]);
    }

    resetCertificateForm();
    setCertificateMsg("Certificate added ✅");
  } catch (err: any) {
console.error("CERT ERROR:", err);

setCertificateMsg(
  err?.message ||
  err?.error_description ||
  JSON.stringify(err) ||
  "Could not add certificate."
);
    setCertFile(null);
  }

  setCertificateBusy(false);
};

const removeCertificate = async (id: string) => {
  if (!userId) return;

  setConfirmState({
    open: true,
    message: "Delete this certificate?",
    onConfirm: async () => {
      await deleteCertificateConfirmed(id);
    },
  });
};

const deleteCertificateConfirmed = async (id: string) => {
  if (!userId) return;

  setCertificateBusy(true);
  setCertificateMsg(null);

  const { error } = await supabase
    .from("trader_certificates")
    .delete()
    .eq("id", id)
    .eq("trader_id", userId);

  if (error) {
    setCertificateMsg(error.message);
    setCertificateBusy(false);
    return;
  }

  setCertificates((prev) => prev.filter((c) => c.id !== id));
  setCertificateMsg("Certificate deleted ✅");
  setCertificateBusy(false);
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

const certificateWarnings = useMemo(() => {
  let expiringSoon = 0;
  let expired = 0;

  const today = new Date();

  for (const c of certificates) {
    if (!c.expiry_date) continue;

    const exp = new Date(c.expiry_date);
    const diffDays = Math.ceil(
      (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      expired++;
    } else if (diffDays <= 30) {
      expiringSoon++;
    }
  }

  return { expiringSoon, expired };
}, [certificates]);

const reviewStats = useMemo(() => {
  const count = reviews.length;

  const average =
    count > 0
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count
      : 0;

  return {
    count,
    average,
    rounded: average ? average.toFixed(1) : "—",
  };
}, [reviews]);

  return (
    <div className="ff-page">
      <div className="ff-wrap">
<div className="ff-top">
  <div className="ff-hero">
    <div className="ff-heroGlow" />

    <div className="ff-heroRow">
      <div className="ff-heroLeft">
        <div className="ff-heroTitle">Business setup</div>
        <div className="ff-heroRule" />
        <div className="ff-heroSub">
          Manage your business profile, public link, certificates, locations and services.
        </div>

<div className="ff-progressWrap">
  <div className="ff-progressTop">
    <div className="ff-progressLabel">Profile strength</div>
    <div className="ff-progressValue">{profileCompleteness}%</div>
  </div>

  <div className="ff-progressBar">
    <div
      className="ff-progressFill"
      style={{ width: `${profileCompleteness}%` }}
    />
  </div>

  <div className="ff-progressHint">
    Complete your profile to win more jobs and build trust with customers.
  </div>
</div>

<div className="ff-trustMetrics">
  <div className="ff-trustMetric">
    <strong>{locations.length}</strong>
    <span>Coverage areas</span>
  </div>

  <div className="ff-trustMetric">
    <strong>{services.length}</strong>
    <span>Services</span>
  </div>

  <div className="ff-trustMetric">
    <strong>{certificates.length}</strong>
    <span>Certificates</span>
  </div>

  <div className="ff-trustMetric">
    <strong>{reviewStats.rounded}</strong>
    <span>Rating</span>
  </div>
</div>

{profileCompleteness < 100 && (
  <div className="ff-profileMissingBox">
    <div className="ff-profileMissingTitle">To improve your profile</div>

    <div className="ff-profileMissingList">
      {!profile?.profile_photo_url && <span>Add a profile photo</span>}
      {!businessPhone.trim() && <span>Add a business phone</span>}
      {!businessDescription.trim() && <span>Add a business description</span>}
      {locations.length === 0 && <span>Add locations</span>}
      {services.length === 0 && <span>Add services</span>}
      {certificates.length === 0 && <span>Add certificates</span>}
    </div>
  </div>
)}

{profileCompleteness >= 80 && (
  <div className="ff-topProfileBadge">
    🏆 Top profile — ready for marketplace discovery
  </div>
)}
{tradingAddress.trim() && businessPhone.trim() && certificates.length > 0 && (
  <div className="ff-verifiedBusinessBadge">
    ✅ Verified business — address, phone and certificates added
  </div>
)}
<div className="ff-heroStats">
  {setupChips.map((chip) => (
    <div key={chip.label} className="ff-statCard">
      <div className="ff-statLabel">{chip.label}</div>
      <div className="ff-statValue">
        {chip.ok ? "✓" : "—"}
      </div>
    </div>
  ))}
</div>
      </div>

      <div className="ff-actions">
        <button
          className="ff-btn ff-btnPrimary"
          type="submit"
          form="profileForm"
          disabled={saving || loading}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
{profile?.stripe_account_id ? (
  <button
    type="button"
    className="ff-btn ff-btnSoftPrimary"
    disabled
  >
    ✅ Stripe connected
  </button>
) : (
  <button
    type="button"
    className="ff-btn ff-btnDark"
    onClick={connectStripe}
  >
    Connect Stripe
  </button>
)}
<button
  type="button"
  className="ff-btn ff-btnSoftPrimary"
  onClick={manageSubscription}
  disabled={billingBusy || loading}
>
  {billingBusy ? "Opening…" : "Manage subscription"}
</button>
      </div>
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

    {(!displayName.trim() ||
      !tradingAddress.trim() ||
      !businessPhone.trim() ||
      !notifyEmail.trim()) && (
      <div className="ff-docWarning">
        <div className="ff-docWarningTitle">
          Important for estimates & invoices
        </div>

        <div className="ff-docWarningText">
          Your business name, trading address, phone number and email
          appear on customer estimates and invoices. Add them here so
          your documents look professional.
        </div>
      </div>
    )}

    <div className="ff-cardBody">

              {profileMsg ? <div className="ff-inlineMsg">{profileMsg}</div> : null}

              <div className="ff-profileTop">
                <div className="ff-field">
                  <label className="ff-label">Business images</label>

                  <div className="ff-logoRow">
                    <div className="ff-logoBox">
{profile?.profile_photo_url ? (
  <img
    src={profile.profile_photo_url}
    alt="Profile"
    className="ff-logoImg"
  />
) : profile?.logo_url ? (
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
<label className="ff-btn ff-btnSoftPrimary">
  {profile?.logo_url ? "Change brand image" : "Upload brand image"}

  <input
    type="file"
    accept="image/*"
    onChange={onLogoPicked}
    disabled={logoUploading || loading}
    style={{ display: "none" }}
  />
</label>

<div className="ff-helpOk">
  {profile?.logo_url
    ? "Brand image saved ✅"
    : "No brand image uploaded yet."}
</div>

<div className="ff-help">
  PNG or JPG up to 5MB. This shows on estimates and documents.
</div>
<div style={{ marginTop: 14 }}>
<label className="ff-label">Profile photo</label>

<label className="ff-btn ff-btnSoftPrimary">
  {profile?.profile_photo_url
    ? "Change profile photo"
    : "Upload profile photo"}

  <input
    type="file"
    accept="image/*"
    onChange={onProfilePhotoPicked}
    disabled={profilePhotoUploading || loading}
    style={{ display: "none" }}
  />
</label>

<div className="ff-helpOk">
  {profile?.profile_photo_url
    ? "Profile photo saved ✅"
    : "No profile photo uploaded yet."}
</div>

<div className="ff-help">
  A friendly face builds trust with customers.
</div>

  {profilePhotoUploading ? <div className="ff-help">Uploading…</div> : null}
  {profilePhotoError ? <div className="ff-helpBad">{profilePhotoError}</div> : null}
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
  <label className="ff-label">Trading address</label>
  <textarea
    className="ff-input"
    value={tradingAddress}
    onChange={(e) => setTradingAddress(e.target.value)}
    placeholder="123 High Street, Staines, TW18 4AB"
    disabled={loading}
    style={{ minHeight: 90, paddingTop: 12 }}
  />
  <div className="ff-help">
    This will appear on invoices and builds trust with customers.
  </div>
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
    <label className="ff-label">Business phone</label>
    <input
      className="ff-input"
      value={businessPhone}
      onChange={(e) => setBusinessPhone(e.target.value)}
      placeholder="07700 900123"
      disabled={loading}
    />
  </div>

  <div className="ff-field">
    <label className="ff-label">Years in business</label>
    <input
      className="ff-input"
      value={yearsInBusiness}
      onChange={(e) =>
        setYearsInBusiness(e.target.value.replace(/[^\d]/g, ""))
      }
      placeholder="10"
      inputMode="numeric"
      disabled={loading}
    />
    <div className="ff-help">
      This can appear later on your public marketplace profile.
    </div>
  </div>
</div>
<div className="ff-field">
  <label className="ff-label">Insurance cover</label>
  <input
    className="ff-input"
    value={insuranceCover}
    onChange={(e) => setInsuranceCover(e.target.value)}
    placeholder="e.g. £2m public liability cover"
    disabled={loading}
  />
  <div className="ff-help">
    This can later show as “£2m public liability cover” on your marketplace profile.
  </div>
</div>

<div className="ff-field">
  <label className="ff-label">After-job guarantee</label>

  <input
    className="ff-input"
    value={afterJobGuarantee}
    onChange={(e) => setAfterJobGuarantee(e.target.value)}
    placeholder="e.g. 12-month workmanship guarantee"
    disabled={loading}
  />

  <div className="ff-help">
    Reassure customers with a workmanship or aftercare guarantee.
  </div>
</div>
<div className="ff-divider" />

<div className="ff-sectionTitle">
  Job completion & aftercare
</div>

<div className="ff-help">
  Automatically send a professional completion summary after work is finished.
</div>

<div className="ff-field" style={{ marginTop: 14 }}>
  <label className="ff-checkRow">
    <input
      type="checkbox"
      checked={completionEmailEnabled}
      onChange={(e) =>
        setCompletionEmailEnabled(e.target.checked)
      }
    />
    Automatically send completion summary emails
  </label>
</div>

<div className="ff-field">
  <label className="ff-label">
    Default completion message
  </label>

  <textarea
    className="ff-input"
    value={defaultCompletionMessage}
    onChange={(e) =>
      setDefaultCompletionMessage(e.target.value)
    }
    placeholder="Thank you for choosing us. Your work has now been completed and is covered by our workmanship guarantee."
    disabled={loading}
    style={{
      minHeight: 120,
      paddingTop: 12,
      resize: "vertical",
    }}
  />

  <div className="ff-help">
    FixFlow can later use this in automatic completion emails.
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

<div className="ff-sectionTitle">Branding</div>

<div className="ff-help">
Choose the colour FixFlow will use on your estimates, invoices and customer-facing documents.
</div>

<div className="ff-field" style={{ marginTop: 14 }}>
<label className="ff-label">Brand colour</label>

<div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
<input
type="color"
value={brandColour}
onChange={(e) => setBrandColour(e.target.value)}
disabled={loading}
style={{
width: 56,
height: 44,
padding: 0,
border: "1px solid #e6ecf5",
borderRadius: 12,
background: "#fff",
cursor: "pointer",
}}
/>

<input
className="ff-input"
value={brandColour}
onChange={(e) => setBrandColour(e.target.value)}
placeholder="#2563EB"
disabled={loading}
style={{ maxWidth: 180 }}
/>


</div>

<div className="ff-help">
This colour will be used as an accent so your documents match your business branding.
</div>
</div>

<div className="ff-field">
  <label className="ff-label">Business description</label>
  <textarea
    className="ff-input"
    value={businessDescription}
    onChange={(e) => setBusinessDescription(e.target.value)}
    placeholder="Tell customers what you do, the areas you cover, and why they should choose you."
    disabled={loading}
    style={{ minHeight: 110, paddingTop: 12, resize: "vertical" }}
  />
  <div className="ff-help">
    This will be useful later for your public profile and marketplace listing.
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
                Preview profile
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
        <div className="ff-cardTitle">REVIEWS</div>
        <div className="ff-cardSub">
          Verified customer reviews collected through FixFlow.
        </div>
      </div>
    </div>
  </div>

  <div className="ff-cardBody">
    {reviewsLoading ? (
      <div className="ff-help">Loading reviews…</div>
    ) : reviews.length === 0 ? (
      <div className="ff-help">
        No reviews yet. Use “Ask for review” from a completed job.
      </div>
    ) : (
      <>
        <div className="ff-reviewSummary">
          <div>
            <div className="ff-reviewStars">★★★★★</div>

            <div className="ff-reviewScore">
              {reviewStats.rounded} average rating
            </div>
          </div>

          <div className="ff-reviewCount">
            {reviewStats.count}
            <span>
              review{reviewStats.count === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="ff-reviewList">
          {reviews.slice(0, 3).map((r) => (
            <div key={r.id} className="ff-reviewItem">
              <div className="ff-reviewTop">
              <strong>
  {r.reviewer_name || r.customer_name || "Customer"}
</strong>

                <span>
                  {r.verified ? "Verified" : "Review"}
                </span>
              </div>

              <div className="ff-reviewMiniStars">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </div>

              {r.comment ? (
                <div className="ff-reviewComment">
                  “{r.comment}”
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </>
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

<form onSubmit={addCertificate} className="ff-card">
  <div className="ff-cardHead">
    <div className="ff-cardHeading">
      <div className="ff-cardAccent" />
      <div>
        <div className="ff-cardTitle">CERTIFICATES & TRUST</div>
        <div className="ff-cardSub">
          Add certificates, insurance and memberships that can appear on estimates and invoices.
        </div>
      </div>
    </div>
  </div>

<div className="ff-cardBody">
  {certificateMsg ? <div className="ff-inlineMsg">{certificateMsg}</div> : null}

  {(certificateWarnings.expired > 0 || certificateWarnings.expiringSoon > 0) && (
    <div className="ff-certWarningBanner">
      {certificateWarnings.expired > 0 && (
        <div className="ff-certWarning ff-certWarning--red">
          ⚠ {certificateWarnings.expired} expired certificate
          {certificateWarnings.expired > 1 ? "s" : ""}
        </div>
      )}

      {certificateWarnings.expiringSoon > 0 && (
        <div className="ff-certWarning ff-certWarning--amber">
          ⏳ {certificateWarnings.expiringSoon} expiring soon (within 30 days)
        </div>
      )}
    </div>
  )}

  <div className="ff-two">
      <div className="ff-field">
        <label className="ff-label">Certificate name</label>
        <input
          className="ff-input"
          value={certName}
          onChange={(e) => setCertName(e.target.value)}
          placeholder="Gas Safe / Public Liability / NICEIC"
          disabled={certificateBusy || loading}
        />
      </div>

      <div className="ff-field">
        <label className="ff-label">Certificate number</label>
        <input
          className="ff-input"
          value={certNumber}
          onChange={(e) => setCertNumber(e.target.value)}
          placeholder="Registration or policy number"
          disabled={certificateBusy || loading}
        />
      </div>
    </div>

<div className="ff-two" style={{ marginTop: 14 }}>
  <div className="ff-field">
    <label className="ff-label">Expiry date</label>
    <input
      className="ff-input"
      type="date"
      value={certExpiry}
      onChange={(e) => setCertExpiry(e.target.value)}
      disabled={certificateBusy || loading}
    />
  </div>



      <div className="ff-field">
        <label className="ff-label">Show on documents</label>

        <label className="ff-checkRow">
          <input
            type="checkbox"
            checked={certShowEstimates}
            onChange={(e) => setCertShowEstimates(e.target.checked)}
          />
          Show on estimates
        </label>

        <label className="ff-checkRow">
          <input
            type="checkbox"
            checked={certShowInvoices}
            onChange={(e) => setCertShowInvoices(e.target.checked)}
          />
          Show on invoices
        </label>
      </div>
    </div>
<div className="ff-field" style={{ marginTop: 14 }}>
  <label className="ff-label">Certificate file</label>

  <input
    ref={certFileInputRef}
    type="file"
    accept=".pdf,image/*"
    onChange={(e) => setCertFile(e.target.files?.[0] || null)}
    disabled={certificateBusy || loading}
    style={{ display: "none" }}
  />

<button
  className="ff-btn ff-btnSoftPrimary"
  type="button"
  onClick={() => certFileInputRef.current?.click()}
  disabled={certificateBusy || loading}
>
Choose PDF / image
</button>

  {certFile ? (
    <div className="ff-helpOk">
      Selected: {certFile.name}
    </div>
  ) : (
    <div className="ff-help">
      No file selected yet.
    </div>
  )}

  <div className="ff-help">
   Choose a file first, then click Save certificate.
  </div>
</div>

<div className="ff-footerRow">
<button
  className="ff-btn ff-btnSoftPrimary"
  type="submit"
  disabled={certificateBusy || loading}
>
  {certificateBusy ? "Saving…" : "Save certificate"}
</button>

{editingCertId && (
  <button
    type="button"
    className="ff-btn"
    onClick={() => {
      setEditingCertId(null);
      resetCertificateForm();
      setCertificateMsg(null); // 👈 ADD THIS LINE
    }}
  >
    Cancel
  </button>
)}
</div>

    <div className="ff-divider" />

    {certificates.length === 0 ? (
      <div className="ff-help">No certificates added yet.</div>
    ) : (
      <div className="ff-tableWrap">
        <table className="ff-table">
          <thead>
            <tr>
              <th>Certificate</th>
              <th>Number</th>
              <th>Expiry</th>
              <th>Shows on</th>
              <th className="ff-thRight">Actions</th>
            </tr>
          </thead>

<tbody>
  {certificates.map((c) => {
    const status = getCertificateStatus(c.expiry_date);

    return (
      <tr key={c.id}>
        <td>
          <div className="ff-tableMain">{c.name}</div>
        </td>

        <td>{c.certificate_number || "—"}</td>

<td>
  <div className={`ff-certStatus ff-certStatus--${status.tone}`}>
    {c.expiry_date || "No expiry"}
  </div>

  <div className="ff-certSub">{status.label}</div>

  {getCertificateWarning(c.expiry_date) ? (
    <div className="ff-certSub">
      {getCertificateWarning(c.expiry_date)}
    </div>
  ) : null}
</td>

<td>
  {c.show_on_estimates ? "Estimates" : ""}
  {c.show_on_estimates && c.show_on_invoices ? " + " : ""}
  {c.show_on_invoices ? "Invoices" : ""}
</td>

<td className="ff-actionsCell">
  {c.file_url ? (
    <a
      href={c.file_url}
      target="_blank"
      rel="noreferrer"
      className="ff-btn ff-btnSm"
    >
      View certificate
    </a>
  ) : null}
          <button
            type="button"
            className="ff-actionDanger"
            onClick={() => removeCertificate(c.id)}
            disabled={certificateBusy}
          >
            Delete
          </button>
          <button
  type="button"
  className="ff-btn ff-btnSm"
  onClick={() => {
    setEditingCertId(c.id);
    setCertName(c.name);
    setCertNumber(c.certificate_number || "");
    setCertExpiry(c.expiry_date || "");
    setCertShowEstimates(c.show_on_estimates);
    setCertShowInvoices(c.show_on_invoices);
  }}
>
  Edit
</button>
        </td>
      </tr>
    );
  })}
</tbody>
        </table>
      </div>
    )}

    <div className="ff-help" style={{ marginTop: 12 }}>
      FixFlow will use these later to show trust badges on customer-facing estimates and invoices.
    </div>
  </div>
</form>

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
{confirmState.open && (
  <div className="ff-modalOverlay">
    <div className="ff-modal">
      <div className="ff-modalTitle">Confirm action</div>
      <div className="ff-modalText">{confirmState.message}</div>

      <div className="ff-modalActions">
        <button
          className="ff-btn"
          onClick={() =>
            setConfirmState({ open: false, message: "", onConfirm: null })
          }
        >
          Cancel
        </button>

        <button
          className="ff-btn ff-btnPrimary"
          onClick={() => {
            confirmState.onConfirm?.();
            setConfirmState({ open: false, message: "", onConfirm: null });
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `

.ff-trustMetrics{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:10px;
  margin-top:16px;
}

.ff-trustMetric{
  padding:14px;
  border-radius:16px;
  border:1px solid #e6ecf5;
  background:#fff;
}

.ff-trustMetric strong{
  display:block;
  font-size:22px;
  font-weight:950;
  color:#102a56;
}

.ff-trustMetric span{
  font-size:12px;
  color:#5c6b84;
  font-weight:800;
}

@media(max-width:720px){
  .ff-trustMetrics{
    grid-template-columns:1fr 1fr;
  }
}

.ff-reviewSummary{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:16px;
  padding:16px;
  border:1px solid #e6ecf5;
  border-radius:18px;
  background:linear-gradient(180deg,#f8fbff,#ffffff);
}

.ff-reviewStars{
  color:#f5b301;
  font-size:22px;
  letter-spacing:2px;
}

.ff-reviewScore{
  margin-top:4px;
  font-size:13px;
  font-weight:900;
  color:#1f355c;
}

.ff-reviewCount{
  font-size:30px;
  font-weight:950;
  color:#102a56;
  text-align:right;
}

.ff-reviewCount span{
  display:block;
  font-size:12px;
  color:#5c6b84;
  font-weight:800;
}

.ff-reviewList{
  display:flex;
  flex-direction:column;
  gap:10px;
  margin-top:14px;
}

.ff-reviewItem{
  padding:14px;
  border:1px solid #e6ecf5;
  border-radius:16px;
  background:#fff;
}

.ff-reviewTop{
  display:flex;
  justify-content:space-between;
  gap:12px;
  font-size:13px;
  color:#102a56;
}

.ff-reviewTop span{
  padding:4px 8px;
  border-radius:999px;
  background:#ecfdf3;
  color:#116b3a;
  font-size:11px;
  font-weight:900;
}

.ff-reviewMiniStars{
  margin-top:6px;
  color:#f5b301;
  font-size:14px;
  letter-spacing:1px;
}

.ff-reviewComment{
  margin-top:8px;
  font-size:13px;
  line-height:1.5;
  color:#5c6b84;
}

.ff-docWarning{
  margin:16px 20px 0;
  padding:14px;
  border-radius:16px;
  border:1px solid #ffd6a8;
  background:#fff7ed;
}

.ff-docWarningTitle{
  font-size:12px;
  font-weight:950;
  color:#9a4d00;
  margin-bottom:6px;
}

.ff-docWarningText{
  font-size:12px;
  line-height:1.45;
  color:#9a4d00;
}
.ff-msg{
  border:1px solid #e6ecf5;
  background:#fff;
  border-radius:16px;
  padding:12px 14px;
  font-size:13px;
  color:#1f355c;
}
.ff-logoPick .ff-btn {
  width: fit-content;
  margin-bottom: 8px;
}

.ff-progressWrap{
  margin-top:16px;
  padding:14px;
  border:1px solid #e6ecf5;
  border-radius:16px;
  background:linear-gradient(180deg,#f8fbff,#ffffff);
}

.ff-progressTop{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:8px;
}

.ff-progressLabel{
  font-size:12px;
  font-weight:900;
  color:#1f355c;
}
  .ff-topProfileBadge{
  margin-top:12px;
  padding:12px 14px;
  border-radius:16px;
  border:1px solid #d9c27a;
  background:#fff8dc;
  color:#7a5a00;
  font-size:13px;
  font-weight:900;
}
.ff-trustScoreBox{
  margin-top:12px;
  padding:14px;
  border:1px solid #bfe9cf;
  border-radius:16px;
  background:#ecfdf3;
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:center;
}
.ff-modalOverlay{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.4);
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:999;
}

.ff-modal{
  background:#fff;
  border-radius:16px;
  padding:20px;
  width:90%;
  max-width:380px;
}

.ff-modalTitle{
  font-weight:900;
  margin-bottom:8px;
}

.ff-modalText{
  font-size:14px;
  margin-bottom:16px;
}

.ff-modalActions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
}
.ff-trustScoreLabel{
  font-size:12px;
  font-weight:900;
  color:#116b3a;
  text-transform:uppercase;
  letter-spacing:.08em;
}

.ff-trustScoreText{
  margin-top:4px;
  font-size:12px;
  color:#116b3a;
  line-height:1.4;
}

.ff-trustScoreValue{
  font-size:26px;
  font-weight:950;
  color:#116b3a;
}
.ff-progressValue{
  font-size:12px;
  font-weight:900;
  color:#1f355c;
}
.ff-verifiedBusinessBadge{
  margin-top:12px;
  padding:12px 14px;
  border-radius:16px;
  border:1px solid #bfe9cf;
  background:#ecfdf3;
  color:#116b3a;
  font-size:13px;
  font-weight:900;
}
.ff-progressBar{
  width:100%;
  height:8px;
  background:#eef2f8;
  border-radius:999px;
  overflow:hidden;
}

.ff-progressFill{
  height:100%;
  background:linear-gradient(90deg,#1f355c,#8fa9d6);
  border-radius:999px;
  transition:width 0.4s ease;
}

.ff-progressHint{
  margin-top:8px;
  font-size:12px;
  color:#5c6b84;
}
  .ff-profileMissingBox{
  margin-top:12px;
  padding:14px;
  border:1px solid #ffd6a8;
  border-radius:16px;
  background:#fff7ed;
}

.ff-profileMissingTitle{
  font-size:12px;
  font-weight:900;
  color:#9a4d00;
  margin-bottom:8px;
}

.ff-profileMissingList{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

.ff-profileMissingList span{
  padding:6px 10px;
  border-radius:999px;
  background:#fff;
  border:1px solid #ffd6a8;
  color:#9a4d00;
  font-size:12px;
  font-weight:800;
}
.ff-cardFeature{
  border-color:rgba(143,169,214,0.28);
  box-shadow:0 14px 32px rgba(31,53,92,0.06);
}

.ff-row{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:14px;
}

.ff-pillBtn{
  border:1px solid #e6ecf5;
  background:#fff;
  color:#1f355c;
  border-radius:999px;
  padding:8px 12px;
  font-size:12px;
  font-weight:900;
  cursor:pointer;
}

.ff-btnSoftPrimary{
  border:1px solid rgba(143,169,214,0.3);
  background:#eef4ff;
  color:#1f355c;
}

.ff-btnDark{
  border:none;
  background:linear-gradient(180deg,#1f355c,#182b49);
  color:#fff;
}

.ff-inputReadOnly{
  background:#f8fbff;
}

.ff-checkRow{
  display:flex;
  align-items:center;
  gap:8px;
  margin-top:8px;
  font-size:13px;
  font-weight:800;
  color:#1f355c;
}

.ff-stack{
  display:flex;
  flex-direction:column;
  gap:16px;
}
.ff-certStatus {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.ff-certStatus--green {
  background: #ecfdf3;
  color: #116b3a;
  border: 1px solid #bfe9cf;
}

.ff-certStatus--amber {
  background: #fff7ed;
  color: #9a4d00;
  border: 1px solid #ffd6a8;
}

.ff-certStatus--red {
  background: #fef2f2;
  color: #a12828;
  border: 1px solid #fecaca;
}

.ff-certStatus--neutral {
  background: #f4f6fa;
  color: #5c6b84;
  border: 1px solid #e6ecf5;
}

.ff-certSub {
  font-size: 11px;
  margin-top: 4px;
  color: #5c6b84;
}
.ff-cardHead{
  padding:18px 20px;
  border-bottom:1px solid #e6ecf5;
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
  background:
    linear-gradient(180deg, rgba(143,169,214,0.08), rgba(255,255,255,0)),
    #fff;
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
  background:linear-gradient(180deg, #1f355c, rgba(143,169,214,0.25));
}

.ff-cardTitle{
  font-size:11px;
  font-weight:900;
  letter-spacing:0.12em;
  text-transform:uppercase;
  color:#1f355c;
}

.ff-cardSub{
  margin-top:4px;
  font-size:13px;
  color:#5c6b84;
}

.ff-cardBody{
  padding:20px;
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
  border:1px solid #e6ecf5;
  background:linear-gradient(180deg, #ffffff, #fbfdff);
  border-radius:18px;
}
.ff-certWarningBanner {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.ff-certWarning {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 900;
}

.ff-certWarning--red {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #a12828;
}

.ff-certWarning--amber {
  background: #fff7ed;
  border: 1px solid #ffd6a8;
  color: #9a4d00;
}
.ff-logoBox{
  width:64px;
  height:64px;
  border-radius:18px;
  border:1px solid #e6ecf5;
  background:#fff;
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
  color:#1f355c;
}

.ff-logoMiniTitle{
  font-size:14px;
  font-weight:900;
  color:#0b1320;
  margin-bottom:6px;
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

.ff-label{
  display:block;
  font-size:12px;
  font-weight:900;
  margin-bottom:6px;
  color:#1f355c;
}

.ff-help{
  margin-top:6px;
  font-size:12px;
  color:#5c6b84;
}

.ff-helpOk{
  font-size:12px;
  color:#116b3a;
  font-weight:800;
}

.ff-helpBad{
  font-size:12px;
  color:#a12828;
  font-weight:800;
}

.ff-inlineMsg{
  border:1px solid #dbe7ff;
  background:#f8fbff;
  border-radius:14px;
  padding:11px 13px;
  font-size:13px;
  margin-bottom:16px;
  color:#1f355c;
  font-weight:700;
}

.ff-sectionTitle{
  font-size:14px;
  font-weight:900;
  color:#0b1320;
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
  border:1px solid #e6ecf5;
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
  background:#f8fbff;
  color:#5c6b84;
  font-size:12px;
  font-weight:900;
  text-align:left;
  padding:14px 16px;
  border-bottom:1px solid #e6ecf5;
}

.ff-table tbody td{
  padding:14px 16px;
  border-top:1px solid #e6ecf5;
  vertical-align:middle;
}

.ff-tableMain{
  font-weight:900;
  color:#0b1320;
}

.ff-code,
.ff-inlineCode{
  display:inline-block;
  padding:6px 10px;
  border-radius:999px;
  background:#f8fbff;
  border:1px solid #e6ecf5;
  font-size:12px;
  color:#1f355c;
}

.ff-actionsCell,
.ff-thRight{
  text-align:right;
  white-space:nowrap;
}

.ff-actionDanger{
  border:none;
  background:transparent;
  color:#a12828;
  font-size:12px;
  font-weight:900;
  cursor:pointer;
  padding:8px 6px;
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

.ff-linkHero{
  border:1px solid #e6ecf5;
  background:linear-gradient(180deg, #f8fbff, #ffffff);
  border-radius:18px;
  padding:14px;
}

.ff-linkBadge{
  display:inline-flex;
  padding:6px 10px;
  border-radius:999px;
  background:#eef4ff;
  border:1px solid rgba(143,169,214,0.3);
  color:#1f355c;
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

.ff-connectedCard{
  display:flex;
  align-items:flex-start;
  gap:12px;
  padding:14px;
  border-radius:16px;
  border:1px solid #bfe9cf;
  background:#ecfdf3;
}

.ff-connectedDot{
  width:10px;
  height:10px;
  border-radius:999px;
  background:#16a34a;
  margin-top:5px;
  box-shadow:0 0 0 6px rgba(22,163,74,0.12);
  flex-shrink:0;
}

.ff-connectedTitle{
  font-size:14px;
  font-weight:900;
  color:#116b3a;
}

.ff-connectedSub{
  margin-top:4px;
  font-size:12px;
  color:#116b3a;
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
  .ff-cardHead,
  .ff-logoRow{
    flex-direction:column;
    align-items:stretch;
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
}
`;