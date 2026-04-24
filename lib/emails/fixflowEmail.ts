// lib/emails/fixflowEmail.ts

type FixFlowEmailOptions = {
  title: string;
  introHtml: string;
  bodyHtml: string;
  ctaHtml?: string;
  closingHtml?: string;
};

export function escapeEmailHtml(value?: string | null) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildFixFlowEmail({
  title,
  introHtml,
  bodyHtml,
  ctaHtml = "",
closingHtml = `
  <div style="font-size:15px; line-height:1.7; color:#5C6B84;">
    Thanks,<br />
    <span style="font-weight:800; color:#1F355C;">Your trader</span><br/>
    <span style="font-size:12px; color:#8A94A6;">via FixFlow</span>
  </div>
`,
}: FixFlowEmailOptions) {
  return `
    <div style="margin:0; padding:24px; background:#F6F8FC; font-family:Arial, sans-serif; color:#0B1320;">
      <div style="max-width:640px; margin:0 auto; background:#FFFFFF; border:1px solid #E6ECF5; border-radius:22px; overflow:hidden;">
        
        <div style="background:#0B2A55; padding:24px 24px 20px 24px;">
          <div style="font-size:12px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#C9D8FF; margin-bottom:10px;">
            FixFlow
          </div>
          <div style="font-size:32px; line-height:1.1; font-weight:800; color:#FFFFFF; margin-bottom:12px;">
            ${title}
          </div>
          <div style="width:170px; height:4px; background:#245BFF; border-radius:999px;"></div>
        </div>

        <div style="padding:24px;">
          ${introHtml}
          ${bodyHtml}
          ${ctaHtml ? `<div style="margin:24px 0;">${ctaHtml}</div>` : ""}
          ${closingHtml}
        </div>
      </div>
    </div>
  `;
}

export function buildFixFlowButton(label: string, href: string) {
  return `
    <div style="text-align:center;">
      <a
        href="${href}"
        style="display:inline-block; padding:14px 24px; background:#1F355C; color:#FFFFFF; border-radius:12px; text-decoration:none; font-weight:700; font-size:15px;"
      >
        ${label}
      </a>
    </div>
  `;
}

export function buildFixFlowInfoCard(innerHtml: string) {
  return `
    <div style="border:1px solid #E6ECF5; border-radius:18px; overflow:hidden; margin-bottom:20px; background:#F4F7FF;">
      ${innerHtml}
    </div>
  `;
}

export function buildFixFlowSectionLabel(label: string) {
  return `
    <div style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#5C6B84; margin-bottom:8px;">
      ${label}
    </div>
  `;
}