import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "quote-files";

function getAreaFromKind(kind: string): "customer" | "trader" | "documents" | null {
  if (kind === "customer") return "customer";
  if (kind === "trader") return "trader";
  if (kind === "documents") return "documents";
  return null;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const requestId = String(form.get("requestId") || "").trim();
    const kind = String(form.get("kind") || "").trim();
    const path = String(form.get("path") || "").trim();

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    if (!kind) {
      return NextResponse.json({ error: "Missing kind" }, { status: 400 });
    }

    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const area = getAreaFromKind(kind);

    if (!area) {
      return NextResponse.json({ error: "Invalid delete kind" }, { status: 400 });
    }

    const allowedPrefix =
      kind === "customer"
        ? `request/${requestId}/customer/`
        : kind === "trader"
        ? `quote/${requestId}/trader/`
        : `job/${requestId}/documents/`;

    if (!path.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([path]);

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 400 });
    }

    const { error: metaError } = await supabaseAdmin
      .from("job_files")
      .delete()
      .eq("request_id", requestId)
      .eq("area", area)
      .eq("path", path);

    if (metaError) {
      return NextResponse.json({ error: metaError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: 500 }
    );
  }
}