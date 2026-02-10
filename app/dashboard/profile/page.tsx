"use client";

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  slug: string | null;
  display_name: string | null;
  headline: string | null;
  notify_email: string | null;
  logo_url: string | null;
  accent: string | null;
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

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");

  // logo upload state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // calendar state (simple)
  const [calStatus, setCalStatus] = useState<string | null>(null);

  const publicQuoteLink = useMemo(() => {
    const s = (slug || "").trim();
    if (!s) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/p/${s}/quote`;
  }, [slug]);

  useEffect(() => {
    // read ?cal=... feedback from callback redirect
    if (typeof window !== "undefined") {
      const v = new URLSearchParams(window.location.search).get("cal");
      if (v) setCalStatus(v);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setLoading(false);
        setMsg("You must be logged in to view profile settings.");
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, slug, display_name, headline, notify_email, logo_url, accent")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile:", error.message);
        setMsg(`Error loading profile: ${error.message}`);
        setLoading(false);
        return;
      }

      const p = (data || null) as ProfileRow | null;
      setProfile(p);

      setSlug(p?.slug || "");
      setDisplayName(p?.display_name || "");
      setHeadline(p?.headline || "");
      setNotifyEmail(p?.notify_email || user.email || "");

      setLoading(false);
    };

    load();
  }, []);

  const copyLink = async () => {
    if (!publicQuoteLink) return;
    try {
      await navigator.clipboard.writeText(publicQuoteLink);
      setMsg("Public link copied ✅");
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg("Could not copy link. Please copy it manually.");
    }
  };

  const openLink = () => {
    if (!publicQuoteLink) return;
    window.open(publicQuoteLink, "_blank", "noopener,noreferrer");
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setMsg(null);

    const cleanSlug = slugify(slug);

    const { error } = await supabase
      .from("profiles")
      .update({
        slug: cleanSlug || null,
        display_name: displayName.trim() || null,
        headline: headline.trim() || null,
        notify_email: notifyEmail.trim() || null,
      })
      .eq("id", userId);

    if (error) {
      console.error("Error saving profile:", error.message);
      setMsg(error.message);
      setSaving(false);
      return;
    }

    setSlug(cleanSlug);
    setMsg("Saved ✅");
    setSaving(false);
  };

  const onLogoPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    if (!userId) return;

    const file = e.target.files?.[0] || null;
    if (!file) return;

    // 5MB limit
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
      console.error("Logo upload error:", upErr.message);
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
      console.error("Error saving logo_url:", saveErr.message);
      setLogoError(saveErr.message);
      setLogoUploading(false);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, logo_url: url } : prev));
    setLogoUploading(false);
    setMsg("Logo updated ✅");
  };

  const calBanner = (() => {
    if (!calStatus) return null;
    if (calStatus === "connected") {
      return <p className="text-sm text-green-700">Google Calendar connected ✅</p>;
    }
    if (calStatus === "error") {
    return (
  <p className="text-sm text-red-600">
    Calendar connection failed ({calStatus}). Try again.
  </p>
);
    }
    if (calStatus === "badstate" || calStatus === "missing") {
      return <p className="text-sm text-red-600">Calendar connection failed. Try again.</p>;
    }
    if (calStatus === "dberror") {
      return <p className="text-sm text-red-600">Calendar saved failed. Try again.</p>;
    }
    return <p className="text-sm text-gray-600">Calendar status: {calStatus}</p>;
  })();

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-sm text-gray-500">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Profile Settings</h1>
        <p className="text-sm text-gray-500">
          Set your public quote link and where notifications should be sent.
        </p>
      </div>

      {msg && (
        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {msg}
        </div>
      )}

      {/* Public link card */}
      <div className="rounded-2xl bg-white shadow-md p-6 mb-6">
        <h2 className="text-sm font-semibold mb-2">Your public quote link</h2>

        {publicQuoteLink ? (
          <>
            <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm break-all">
              {publicQuoteLink}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={openLink}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Open
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            Add a public slug below to generate your link.
          </p>
        )}
      </div>

      {/* Calendar card */}
      <div className="rounded-2xl bg-white shadow-md p-6 mb-6">
        <h2 className="text-sm font-semibold mb-2">Calendar</h2>
        <p className="text-sm text-gray-600 mb-3">
          Connect Google Calendar so FixFlow can create job bookings for you.
        </p>

       <button
  type="button"
  onClick={() => {
    setMsg("Opening Google Calendar connect…");
    // Force a real navigation (avoids client routing / overlay issues)
    window.location.href = "/api/calendar/connect";
  }}
  className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
>
  Connect Google Calendar
</button>


        <div className="mt-3">{calBanner}</div>
      </div>

      {/* Profile form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-white shadow-md p-6 space-y-4"
      >
        {/* Logo */}
        <div>
          <label className="block text-sm font-medium mb-1">Logo</label>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl border bg-gray-50 overflow-hidden flex items-center justify-center">
              {profile?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-gray-700">
                  {(displayName || slug || "F").charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <input
                type="file"
                accept="image/*"
                onChange={onLogoPicked}
                className="text-sm"
                disabled={logoUploading}
              />
              {logoUploading && (
                <p className="text-xs text-gray-500 mt-1">Uploading…</p>
              )}
              {logoError && (
                <p className="text-xs text-red-600 mt-1">{logoError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Public slug (your link name)
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="anna-plumbing"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use letters/numbers/hyphens. We’ll auto-format it.
          </p>
        </div>

        {/* Display name */}
        <div>
          <label className="block text-sm font-medium mb-1">Business name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Anna Plumbing"
          />
        </div>

        {/* Headline */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Headline (shown on public quote page)
          </label>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Fast response • Clear pricing • Local service"
          />
        </div>

        {/* Notification email */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Notification email (see new quote alerts)
          </label>
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="you@business.com"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}

