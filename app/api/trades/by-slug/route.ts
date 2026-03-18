import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
const slug = searchParams.get("slug");

if (!slug) {
return NextResponse.json({ error: "Missing slug" }, { status: 400 });
}

const { data, error } = await supabase
.from("profiles")
.select("id, slug, display_name, business_name, logo_url, headline, accent")
.eq("slug", slug)
.single();

console.log("SLUG RECEIVED:", slug);

if (error || !data) {
return NextResponse.json(
{ error: "Trader not found", debug: error?.message },
{ status: 404 }
);
}

return NextResponse.json({ trader: data });
}