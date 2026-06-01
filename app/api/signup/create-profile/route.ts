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
    const { userId, businessName, slug, email } = await req.json();

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
      },
      { onConflict: "id" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Profile creation failed" },
      { status: 500 }
    );
  }
}