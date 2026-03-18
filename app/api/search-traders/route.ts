export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // In route handlers cookies can be read-only; keep these safe:
        set() {},
        remove() {},
      },
    }
  );
}

function postcodePrefix(input: string) {
  const clean = (input || "").trim().toUpperCase();
  if (!clean) return "";
  const first = clean.split(/\s+/)[0] || "";
  return first.replace(/[^A-Z0-9]/g, "");
}

export async function POST(req: Request) {
  const supabase = await getSupabase(); // ✅ MUST await

  const body = await req.json().catch(() => null);
  const postcode = (body?.postcode as string | undefined) || "";
  const tradeId = (body?.tradeId as string | undefined) || "";

  const prefix = postcodePrefix(postcode);

  if (!prefix || !tradeId) {
    return NextResponse.json(
      { ok: false, error: "Missing postcode or tradeId" },
      { status: 400 }
    );
  }

  const { data: locs, error: locErr } = await supabase
    .from("locations")
    .select("user_id, area")
    .eq("area", prefix);

  if (locErr) {
    return NextResponse.json(
      { ok: false, error: `Locations query failed: ${locErr.message}` },
      { status: 500 }
    );
  }

  const userIds = Array.from(new Set((locs || []).map((x) => x.user_id))).filter(Boolean);

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, traders: [] });
  }

  const { data: svcRows, error: svcErr } = await supabase
    .from("services")
    .select("user_id")
    .in("user_id", userIds)
    .eq("trade_id", tradeId);

  if (svcErr) {
    return NextResponse.json(
      { ok: false, error: `Services query failed: ${svcErr.message}` },
      { status: 500 }
    );
  }

  const eligibleIds = Array.from(new Set((svcRows || []).map((x) => x.user_id)));

  if (eligibleIds.length === 0) {
    return NextResponse.json({ ok: true, traders: [] });
  }

  const { data: profs, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name, slug, headline, logo_url")
    .in("id", eligibleIds);

  if (profErr) {
    return NextResponse.json(
      { ok: false, error: `Profiles query failed: ${profErr.message}` },
      { status: 500 }
    );
  }

  const traders = (profs || []).map((p) => ({
    user_id: p.id,
    display_name: p.display_name,
    slug: p.slug,
    headline: p.headline,
    logo_url: p.logo_url,
  }));

  return NextResponse.json({ ok: true, traders });
}
