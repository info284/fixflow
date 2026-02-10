"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function NewQuotePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [postcode, setPostcode] = useState("");
  const [details, setDetails] = useState("");
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.from("services").select("id,name").then(({ data }) => setServices((data ?? []) as any));
  }, []);

  async function submit() {
    setMsg(null);
    if (!userId || !serviceId || !postcode) {
      setMsg("Please sign in and fill all fields.");
      return;
    }
    const { error } = await supabase.from("quote_requests").insert({
      customer_id: userId,
      service_id: serviceId,
      postcode,
      details
    });
    if (error) setMsg(error.message);
    else setMsg("Quote requested! A plumber will respond soon.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1>Request a Quote</h1>

      <label>Service</label>
      <select value={serviceId ?? ""} onChange={(e) => setServiceId(e.target.value)} style={{ display: "block", marginBottom: 12, padding: 8 }}>
        <option value="">Select a service</option>
        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <label>Postcode</label>
      <input value={postcode} onChange={(e) => setPostcode(e.target.value)} style={{ display: "block", marginBottom: 12, padding: 8, width: "100%" }} />

      <label>Details</label>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} style={{ display: "block", marginBottom: 12, padding: 8, width: "100%" }} />

      <button onClick={submit} style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd", background: "#111", color: "#fff" }}>
        Send request
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
