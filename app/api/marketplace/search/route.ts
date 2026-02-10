import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE!
);

function normalisePostcodePrefix(pc: string) {
// RH17 6TL -> RH17
const clean = pc.toUpperCase().replace(/\s+/g, "").trim();
const m = clean.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
return m ? m[1] : clean.slice(0, 4);
}

export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
const tradeId = searchParams.get("tradeId")?.trim();
const postcode = searchParams.get("postcode")?.trim();

if (!tradeId || !postcode) {
return NextResponse.json({ covered: false, error: "Missing params" }, { status: 400 });
}

const prefix = normalisePostcodePrefix(postcode);

// ✅ Check trade_locations for a matching postcode_prefix for that user
const { data, error } = await supabase
.from("trade_locations")
.select("id, postcode_prefix")
.eq("user_id", tradeId)
.eq("postcode_prefix", prefix)
.limit(1);

if (error) {
return NextResponse.json({ covered: false, error: error.message }, { status: 500 });
}

return NextResponse.json({ covered: !!(data && data.length > 0), prefix });
}