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

export default function PublicQuotePage() {
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

  // Load services for dropdown
  useEffect(() => {
    const loadServices = async () => {
      setLoadingServices(true);
      setServicesError(null);

      const { data, error } = await supabase
        .from("services")
        .select("id, name, price")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading services:", error.message);
        setServicesError("We couldn't load the services list. Please try again later.");
        setServices([]);
      } else {
        setServices((data || []) as Service[]);
      }

      setLoadingServices(false);
    };

    loadServices();
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

    // basic front-end validation
    if (!form.name.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setSubmitError("Please provide at least an email or a phone number.");
      return;
    }
    if (!form.postcode.trim()) {
      setSubmitError("Please enter your postcode.");
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
        // status will default to 'new' in the DB
        // notes stays null
      });

      if (error) {
        console.error("Error submitting public quote:", error.message);
        setSubmitError(
          "Something went wrong sending your request. Please try again in a moment."
        );
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
      setSubmitError(
        "Something went wrong sending your request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const noServices = !loadingServices && services.length === 0;

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full rounded-xl bg-white shadow-md p-6">
          <h1 className="text-2xl font-semibold mb-3">
            Thanks for your request!
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            We&apos;ve received your details and will get back to you with a
            quote as soon as possible.
          </p>
          <button
            type="button"
            onClick={() => setSubmitSuccess(false)}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Send another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        {/* Simple “public page” card */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold mb-2">Request a Quote</h1>
          <p className="text-sm text-gray-600">
            Tell us a bit about the job and we&apos;ll get back to you with a
            price and availability.
          </p>
        </div>

        <div className="rounded-xl bg-white shadow-md p-6">
          {loadingServices && (
            <p className="mb-4 text-sm text-gray-500">
              Loading services…
            </p>
          )}

          {servicesError && (
            <p className="mb-4 text-sm text-red-600">
              {servicesError}
            </p>
          )}

          {noServices && !servicesError && (
            <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
              We&apos;re not accepting online quote requests at the moment.
              Please contact us directly.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="name"
              >
                Your name *
              </label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  htmlFor="email"
                >
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
                <label
                  className="block text-sm font-medium mb-1"
                  htmlFor="phone"
                >
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

            <p className="text-xs text-gray-500">
              Please provide at least one way for us to contact you.
            </p>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="postcode"
              >
                Postcode *
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
                What do you need help with? *
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
                    {service.price != null ? ` (from £${service.price})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="details"
              >
                Tell us about the job
              </label>
              <textarea
                id="details"
                name="details"
                value={form.details}
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={4}
                placeholder="Where is the job, what needs doing, access details, preferred dates, etc."
              />
            </div>

            {submitError && (
              <p className="text-sm text-red-600">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || loadingServices || noServices}
              className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Request my quote"}
            </button>

            <p className="text-[11px] text-gray-400 mt-2 text-center">
              By submitting this form you agree to be contacted about your
              quote request.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
