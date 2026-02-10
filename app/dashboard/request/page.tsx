"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

type Service = {
  id: string;
  name: string;
  price: number | null;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  postcode: string;
  serviceId: string;
  details: string;
};

export default function RequestQuotePage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    postcode: "",
    serviceId: "",
    details: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load user + their services
  useEffect(() => {
    const loadUserAndServices = async () => {
      setLoadingServices(true);
      setServicesError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("No user found on request page:", userError?.message);
        setServicesError("You must be logged in to request a quote here.");
        setLoadingServices(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading services:", error.message);
        setServicesError("Could not load your services.");
        setServices([]);
      } else {
        setServices((data || []) as Service[]);
      }

      setLoadingServices(false);
    };

    loadUserAndServices();
  }, []);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!userId) {
      setSubmitError("No logged-in user; please sign in again.");
      return;
    }

    if (!form.serviceId) {
      setSubmitError("Please choose a service.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("requests").insert({
        name: form.name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        postcode: form.postcode.trim() || null,
        service_id: form.serviceId,
        details: form.details.trim() || null,
        user_id: userId,
        // status default and notes handled in DB
      });

      if (error) {
        console.error("Error submitting request:", error.message);
        setSubmitError(error.message);
      } else {
        setSubmitSuccess(true);
        setForm({
          name: "",
          email: "",
          phone: "",
          postcode: "",
          serviceId: "",
          details: "",
        });
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const noServices = !loadingServices && services.length === 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-1">Request a Quote</h1>

      <p className="text-xs text-gray-500 mb-4">
        Debug – services loaded: {services.length} | user:{" "}
        {userId ? userId : "none"}
      </p>

      {loadingServices && (
        <p className="mb-4 text-sm text-gray-500">Loading services…</p>
      )}

      {servicesError && (
        <p className="mb-4 text-sm text-red-600">
          Couldn&apos;t load services: {servicesError}
        </p>
      )}

      {noServices && !servicesError && (
        <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm">
          <p className="font-medium">No services available yet.</p>
          <p className="mt-1">
            Please add at least one service on the{" "}
            <a href="/dashboard/services" className="text-blue-600 underline">
              Services
            </a>{" "}
            page before requesting a quote.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* name, contact, postcode, etc – same as before */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="07..."
              autoComplete="tel"
            />
          </div>
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="postcode"
          >
            Postcode
          </label>
          <input
            id="postcode"
            name="postcode"
            value={form.postcode}
            onChange={handleChange}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g. SW1A 1AA"
            autoComplete="postal-code"
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="serviceId"
          >
            Service
          </label>
          <select
            id="serviceId"
            name="serviceId"
            value={form.serviceId}
            onChange={handleChange}
            className="w-full rounded-md border px-3 py-2 text-sm"
            disabled={loadingServices || noServices}
          >
            <option value="">Select a service…</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
                {service.price != null ? ` (£${service.price})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="details"
          >
            Job details
          </label>
          <textarea
            id="details"
            name="details"
            value={form.details}
            onChange={handleChange}
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={4}
            placeholder="Describe the job, access, preferred dates, etc."
          />
        </div>

        {submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}

        {submitSuccess && (
          <p className="text-sm text-green-600">
            Your quote request has been sent!
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || loadingServices || noServices}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Request Quote"}
        </button>
      </form>
    </div>
  );
}

