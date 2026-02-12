import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // ✅ service role key must never run on edge
export const dynamic = "force-dynamic"; // ✅ stops build-time evaluation/prerender weirdness

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // IMPORTANT: this prevents build/runtime crashes if env isn't set
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key);
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase(); // ✅ created only when route is called

    const body = await req.json();

    const tradeId = String(body.tradeId || "").trim(); // trader user_id (uuid)
    const slug = String(body.slug || "").trim();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const postcode = String(body.postcode || "").trim();

    const jobType = String(body.jobType || "").trim();
    const when = String(body.when || "").trim();
    const details = String(body.details || "").trim();

    const photo_names = Array.isArray(body.photo_names) ? body.photo_names : [];

    if (!tradeId || !isUUID(tradeId)) {
      return NextResponse.json(
        { error: "Invalid tradeId (must be trader user_id uuid)" },
        { status: 400 }
      );
    }

    if (!name || !email || !postcode) {
      return NextResponse.json(
        { error: "Missing required fields (name, email, postcode)" },
        { status: 400 }
      );
    }

    const row = {
      // trader linkage (keep both for now if you’re unsure which your DB uses)
      trade_id: tradeId,
      user_id: tradeId,
      slug,

      // customer
      name,
      email,
      phone,
      postcode,

      // job
      job_type: jobType,
      when_needed: when,
      details,

      // attachments
      photo_names,

      // backup payload
      payload: body,
    };

    // Try "requests" first
    let inserted: any = null;

    {
      const { data, error } = await supabase
        .from("requests")
        .insert([row])
        .select("*")
        .maybeSingle();

      if (!error) inserted = data;
    }

    // Fallback to "quote_requests"
    if (!inserted) {
      const { data, error } = await supabase
        .from("quote_requests")
        .insert([row])
        .select("*")
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "Insert failed", details: error.message },
          { status: 500 }
        );
      }

      inserted = data;
    }

    // Optional notification call (don’t fail if it fails)
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/notifications/new-quote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: inserted }),
        }
      );
    } catch {}

    return NextResponse.json({ ok: true, request: inserted });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Bad request", details: e?.message || "Unknown error" },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    // keep GET simple so it never crashes builds
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}