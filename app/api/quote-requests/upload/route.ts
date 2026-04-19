import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "quote-files";

const customerFolder = (requestId: string) => `request/${requestId}/customer`;
const traderFolder = (requestId: string) => `quote/${requestId}/trader`;
const documentsFolder = (requestId: string) => `job/${requestId}/documents`;

function safeName(name: string) {
  return (name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

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
    const kind = String(form.get("kind") || "customer").trim();
    const label = String(form.get("label") || "").trim() || null;
    const files = form.getAll("files").filter(Boolean) as File[];

    if (!requestId) {
      return NextResponse.json(
        {
          error: "Missing requestId",
          got: { requestId, kind, label, filesCount: files.length },
        },
        { status: 400 }
      );
    }

    if (!files.length) {
      return NextResponse.json(
        {
          error: "No files uploaded",
          got: { requestId, kind, label, filesCount: 0 },
        },
        { status: 400 }
      );
    }

    const area = getAreaFromKind(kind);

    if (!area) {
      return NextResponse.json({ error: "Invalid upload kind" }, { status: 400 });
    }

    const baseFolder =
      kind === "customer"
        ? customerFolder(requestId)
        : kind === "trader"
        ? traderFolder(requestId)
        : documentsFolder(requestId);

    const supabaseAdmin = createAdminClient();

    // ✅ get plumber_id from quote_requests
    const { data: enquiry, error: enquiryError } = await supabaseAdmin
      .from("quote_requests")
      .select("plumber_id")
      .eq("id", requestId)
      .single();

    if (enquiryError || !enquiry?.plumber_id) {
      return NextResponse.json(
        { error: enquiryError?.message || "Could not find enquiry plumber_id" },
        { status: 400 }
      );
    }

    const plumberId = enquiry.plumber_id;

    const uploaded: Array<{
      path: string;
      name: string;
      area: string;
      label: string | null;
    }> = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const cleanedName = safeName(file.name || "file");
      const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const filePath = `${baseFolder}/${unique}_${cleanedName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 400 });
      }

 const { error: metaError } = await supabaseAdmin.from("job_files").insert({
  request_id: requestId,
  plumber_id: plumberId,
  path: filePath,
  file_name: cleanedName,   // ✅ THIS FIXES IT
  area,
  label,
});

      if (metaError) {
        await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
        return NextResponse.json({ error: metaError.message }, { status: 400 });
      }

      uploaded.push({
        path: filePath,
        name: cleanedName,
        area,
        label,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        kind,
        label,
        uploaded,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Upload failed" },
      { status: 500 }
    );
  }
}