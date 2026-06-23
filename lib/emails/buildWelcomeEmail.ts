import {
  buildFixFlowEmail,
  buildFixFlowButton,
  buildFixFlowInfoCard,
  buildFixFlowSectionLabel,
} from "@/lib/emails/fixflowEmail";


export function buildWelcomeEmail({
publicUrl,
businessName,
}: {
publicUrl: string;
businessName?: string;
}) {
  const html = buildFixFlowEmail({
    title: "Your FixFlow page is ready",
introHtml: `
<div style="font-size:16px; font-weight:700; margin-bottom:10px;">
Welcome to FixFlow${businessName ? `, ${businessName}` : ""}
</div>

<div style="font-size:15px; line-height:1.7; color:#5C6B84; margin-bottom:20px;">
Thanks for joining FixFlow.
We built FixFlow to help trade businesses stop losing work through forgotten quotes,
missed follow-ups, buried messages and disorganised admin.
</div>
`,
bodyHtml: `
${buildFixFlowInfoCard(`
<div style="padding:22px;">
${buildFixFlowSectionLabel("Your enquiry link")}

<a href="${publicUrl}"
style="font-size:16px;font-weight:800;color:#1F355C;text-decoration:none;word-break:break-all;">
${publicUrl}
</a>

<div style="margin-top:14px;color:#5C6B84;line-height:1.7;">
Share this link with customers, add it to WhatsApp,
Facebook, Instagram and your website.
</div>
</div>
`)}

${buildFixFlowInfoCard(`
<div style="padding:22px;">
${buildFixFlowSectionLabel("What FixFlow can do")}

<div style="line-height:1.9;color:#5C6B84;">
✅ Receive customer enquiries<br/>
✅ Store photos and job details<br/>
✅ Keep customer messages organised<br/>
✅ Send professional estimates<br/>
✅ Track visits and jobs<br/>
✅ Create invoices<br/>
✅ Collect reviews<br/>
✅ Look more professional
</div>
</div>
`)}
${buildFixFlowInfoCard(`
<div style="padding:22px;">
${buildFixFlowSectionLabel("Add FixFlow to your phone")}

<div style="line-height:1.8;color:#5C6B84;">
FixFlow works like an app on iPhone and Android.

Add it to your home screen for quick access to enquiries,
jobs, invoices and customer messages wherever you are.

<div style="margin-top:14px;">
<strong style="color:#1F355C;">iPhone</strong><br/>
Open FixFlow in Safari → tap Share → Add to Home Screen
</div>

<div style="margin-top:14px;">
<strong style="color:#1F355C;">Android</strong><br/>
Open FixFlow in Chrome → tap the menu → Install App or Add to Home Screen
</div>
</div>
</div>
`)}
${buildFixFlowInfoCard(`
<div style="padding:22px;">
${buildFixFlowSectionLabel("Forward emails into FixFlow")}

<div style="line-height:1.8;color:#5C6B84;">
Already receiving enquiries by email?

Forward customer emails to:

<div style="margin:12px 0;font-weight:800;color:#1F355C;">
enquiries@send.thefixflowapp.com
</div>

FixFlow can create enquiries from forwarded emails,
helping keep customer details and conversations in one place.
</div>
</div>
`)}

<div style="font-size:15px;line-height:1.7;color:#5C6B84;margin-top:20px;">
Next step: complete your profile, add your services,
coverage areas and business details so customers can trust your business.
</div>
`,
  ctaHtml: buildFixFlowButton(
"Open your dashboard",
"https://thefixflowapp.com/dashboard"
),
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

Add FixFlow to your phone:

iPhone:
Open FixFlow in Safari → Share → Add to Home Screen

Android:
Open FixFlow in Chrome → Menu → Install App

Thanks,
FixFlow`;

return { html, text };
}