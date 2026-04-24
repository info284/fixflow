import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
  escapeEmailHtml,
} from "@/lib/emails/fixflowEmail";

type RenderFixFlowCustomerMessageEmailArgs = {
  customerName?: string | null;
  traderName?: string | null;
  subject: string;
  message: string;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
};

export function renderFixFlowCustomerMessageEmail({
  customerName,
  traderName,
  subject,
  message,
  ctaUrl,
  ctaLabel,
}: RenderFixFlowCustomerMessageEmailArgs) {
  const safeCustomerName = escapeEmailHtml(customerName || "there");
  const safeTraderName = escapeEmailHtml(traderName || "FixFlow");
  const safeSubject = escapeEmailHtml(subject);
  const safeMessage = escapeEmailHtml(message).replace(/\n/g, "<br />");

  return buildFixFlowEmail({
    title: safeSubject,
    introHtml: `
      <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
        Hi ${safeCustomerName},
      </div>

      <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
        Here’s an update on your enquiry.
      </div>
    `,
    bodyHtml: `
      ${buildFixFlowInfoCard(`
        <div style="padding:18px;">
          ${buildFixFlowSectionLabel("Message")}
          <div style="font-size:15px; line-height:1.8; color:#0B1320;">
            ${safeMessage}
          </div>
        </div>
      `)}
    `,
    ctaHtml:
      ctaUrl && ctaLabel
        ? buildFixFlowButton(ctaLabel, ctaUrl)
        : "",
    closingHtml: `
      <div style="font-size:15px; line-height:1.7; color:#5C6B84;">
        Thanks,<br />
        <span style="font-weight:800; color:#1F355C;">${safeTraderName}</span>
      </div>
    `,
  });
}