import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "quote-files";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const requestId = String(form.get("requestId") || "").trim();
    const customerEmail = String(form.get("customerEmail") || "").trim();
    const file = form.get("file") as File | null;

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: enquiry, error: enquiryError } = await supabase
      .from("quote_requests")
      .select("id, plumber_id")
      .eq("id", requestId)
      .maybeSingle();

    if (enquiryError) throw enquiryError;

    if (!enquiry?.plumber_id) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = safeFileName(file.name);
    const path = `request/${requestId}/customer/${Date.now()}_${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { error: fileInsertError } = await supabase.from("job_files").insert({
      request_id: requestId,
      plumber_id: enquiry.plumber_id,
      path,
      file_name: file.name,
      area: "customer",
      label: file.type?.startsWith("image/") ? "photo" : "file",
    });

    if (fileInsertError) throw fileInsertError;

    const { error: messageError } = await supabase
      .from("enquiry_messages")
      .insert({
        request_id: requestId,
        plumber_id: enquiry.plumber_id,
        direction: "in",
        channel: "file",
        subject: "Customer uploaded a file",
        body_text: `Customer uploaded: ${file.name}`,
        from_email: customerEmail || null,
        to_email: null,
      });

    if (messageError) throw messageError;

    await supabase
      .from("quote_requests")
      .update({
        read_at: null,
        ai_thread_status: "customer_replied",
        ai_needs_human: true,
        ai_recommended_action: "reply_now",
        ai_last_customer_message_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    return NextResponse.json({ ok: true, path });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Upload failed" },
      { status: 500 }
    );
  }
}