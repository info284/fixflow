import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
} from "@/lib/emails/fixflowEmail";

export function buildWelcomeEmail(publicUrl: string) {
  const html = buildFixFlowEmail({
    title: "Your FixFlow page is ready",
    introHtml: `
      <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
        Welcome to FixFlow
      </div>

      <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
        Your page is now live and ready to receive enquiries.
      </div>
    `,
    bodyHtml: `
      ${buildFixFlowInfoCard(`
        <div style="padding:22px; text-align:center;">
          ${buildFixFlowSectionLabel("Your link")}
          <a href="${publicUrl}" style="font-size:16px; font-weight:800; color:#1F355C; text-decoration:none; word-break:break-all;">
            ${publicUrl}
          </a>
        </div>
      `)}

      <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-top:20px;">
        Send this link to a customer today or add it to your Instagram or WhatsApp.
      </div>
    `,
    ctaHtml: buildFixFlowButton("View your page", publicUrl),
    closingHtml: `
      <div style="font-size:15px; line-height:1.7; color:#5C6B84;">
        Thanks,<br />
        <span style="font-weight:800; color:#1F355C;">FixFlow</span>
      </div>
    `,
  });

  const text = `Welcome to FixFlow

Your page is now live and ready to receive enquiries.

Your link:
${publicUrl}

Send this link to a customer today or add it to your Instagram or WhatsApp.

Thanks,
FixFlow`;

  return { html, text };
}