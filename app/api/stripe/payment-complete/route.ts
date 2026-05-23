export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message:
      "Payment completion is handled by the Stripe webhook. This route no longer marks invoices as paid or sends receipts.",
  });
}