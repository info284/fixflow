import { NextResponse } from "next/server";
import { runEnquiryAiEngine } from "@/lib/ai/runEnquiryAiEngine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const enquiryId = body?.enquiryId as string | undefined;

    if (!enquiryId) {
      return NextResponse.json(
        { ok: false, error: "Missing enquiryId" },
        { status: 400 }
      );
    }

    const result = await runEnquiryAiEngine(enquiryId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error("run-enquiry error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to run AI engine",
      },
      { status: 500 }
    );
  }
}