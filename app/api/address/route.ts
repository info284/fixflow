// app/api/address/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

type IdealPostcodesAddress = {
  organisation_name?: string;
  line_1?: string;
  line_2?: string;
  line_3?: string;
  post_town?: string;
  county?: string;
  postcode?: string;
};

type IdealPostcodesResponse = {
  result?: IdealPostcodesAddress[];
  message?: string;
  code?: number;
};

function formatAddress(item: IdealPostcodesAddress) {
  return [
    item.organisation_name,
    item.line_1,
    item.line_2,
    item.line_3,
    item.post_town,
    item.county,
    item.postcode,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
}

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get("postcode")?.trim() || "";
  const apiKey = process.env.IDEAL_POSTCODES_API_KEY?.trim();

  if (!postcode) {
    return NextResponse.json({ error: "Missing postcode" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Ideal Postcodes API key is missing" },
      { status: 500 }
    );
  }

  try {
    const cleanPostcode = postcode.toUpperCase().replace(/\s+/g, "");

    const res = await fetch(
      `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(
        cleanPostcode
      )}?api_key=${encodeURIComponent(apiKey)}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const json =
      (await res.json().catch(() => null)) as IdealPostcodesResponse | null;

    if (!res.ok) {
      return NextResponse.json(
        {
          error: json?.message || `Address provider error status ${res.status}`,
        },
        { status: res.status }
      );
    }

    const addresses = Array.isArray(json?.result)
      ? json.result.map(formatAddress).filter(Boolean)
      : [];

    return NextResponse.json({ addresses });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Address lookup failed",
      },
      { status: 500 }
    );
  }
}