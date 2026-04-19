import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
} from "@/lib/emails/fixflowEmail";

export function buildFirstEnquiryEmail(publicUrl: string) {
  const html = buildFixFlowEmail({
    title: "Get your first enquiry",

    introHtml: `
      <div style="font-size:16px; font-weight:700; margin-bottom:10px;">
        Let’s get your first enquiry
      </div>

      <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
        Your FixFlow page is live — now it’s time to use it.
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
        Send this link to your next customer instead of texting back and forth.
      </div>

      <div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-top:12px;">
        You can also:
        <ul style="margin:10px 0 0 18px;">
          <li>Add it to your WhatsApp replies</li>
          <li>Put it on your Instagram bio</li>
          <li>Share it after missed calls</li>
        </ul>
      </div>
    `,

    ctaHtml: buildFixFlowButton("View your page", publicUrl),

    closingHtml: `
      <div style="font-size:15px; line-height:1.7; color:#5C6B84;">
        Once your first enquiry comes in, everything is handled inside FixFlow.<br /><br />
        <strong style="color:#1F355C;">FixFlow</strong>
      </div>
    `,
  });

  const text = `Let’s get your first enquiry

Your FixFlow page is live — now it’s time to use it.

Your link:
${publicUrl}

Send this link to your next customer instead of texting back and forth.

You can also:
- Add it to your WhatsApp replies
- Put it on your Instagram bio
- Share it after missed calls

Once your first enquiry comes in, everything is handled inside FixFlow.

FixFlow`;

  return { html, text };
}