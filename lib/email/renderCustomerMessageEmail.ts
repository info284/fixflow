type RenderCustomerMessageEmailArgs = {
  customerName?: string | null;
  businessName?: string | null;
  message: string;
  subject?: string | null;
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMessageAsHtml(message: string) {
  return escapeHtml(message).replace(/\n/g, "<br />");
}

export function renderCustomerMessageEmail({
  customerName,
  businessName,
  message,
  subject,
}: RenderCustomerMessageEmailArgs) {
  const safeBusinessName = businessName?.trim() || "FixFlow";
  const greeting = customerName?.trim() ? `Hi ${customerName},` : "Hi,";

  return `
  <div style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
      <div style="
        border-radius:24px;
        overflow:hidden;
        background:#ffffff;
        border:1px solid #e7edf5;
        box-shadow:0 8px 30px rgba(15,23,42,0.06);
      ">
        <div style="
          padding:24px 28px;
          background:linear-gradient(135deg,#0f172a 0%, #1d4ed8 100%);
          color:#ffffff;
        ">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.82;">
            FixFlow
          </div>
          <div style="margin-top:8px;font-size:24px;font-weight:700;line-height:1.2;">
            ${escapeHtml(subject || "Update on your enquiry")}
          </div>
          <div style="margin-top:8px;font-size:14px;opacity:0.9;">
            Message from ${escapeHtml(safeBusinessName)}
          </div>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
            ${escapeHtml(greeting)}
          </p>

          <div style="
            margin:0;
            padding:18px 20px;
            border-radius:18px;
            background:#f8fbff;
            border:1px solid #dbe7f5;
            font-size:15px;
            line-height:1.7;
            color:#0f172a;
          ">
            ${formatMessageAsHtml(message)}
          </div>

          <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
            Sent via FixFlow
          </p>
        </div>
      </div>
    </div>
  </div>
  `;
}