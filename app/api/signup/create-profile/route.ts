import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const { userId, businessName, slug, email, referredBy } = await req.json();

    if (!userId || !businessName || !slug) {
      return NextResponse.json(
        { error: "Missing signup details" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        business_name: businessName,
        display_name: businessName,
        slug,
        notify_email: email || null,
        referred_by: referredBy || null,
      },
      { onConflict: "id" }
    );

    if (error) throw error;

    // If they signed up with a referral code, log it
    if (referredBy) {
      const { data: affiliate } = await supabase
        .from("affiliates")
        .select("id, commission_amount")
        .eq("code", referredBy.toUpperCase())
        .eq("active", true)
        .maybeSingle();

      if (affiliate) {
        await supabase.from("referrals").insert({
          affiliate_id: affiliate.id,
          referred_profile_id: userId,
          commission_amount: affiliate.commission_amount,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Profile creation failed" },
      { status: 500 }
    );
  }
}
