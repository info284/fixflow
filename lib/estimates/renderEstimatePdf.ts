import PDFDocument from "pdfkit";

type PdfLineItem = {
  title?: string | null;
  quantity?: number | null;
  line_total?: number | null;
};

type PdfCertificate = {
  name?: string | null;
  certificate_number?: string | null;
  expiry_date?: string | null;
  show_on_estimates?: boolean | null;
};

type RenderEstimatePdfOpts = {
  estimate?: any;
  items?: PdfLineItem[];
  certificates?: PdfCertificate[];
  profile?: {
    business_name?: string | null;
    display_name?: string | null;
    logo_url?: string | null;
    logo_buffer?: Buffer | null;
    vat_number?: string | null;
    business_phone?: string | null;
business_email?: string | null;
business_address?: string | null;
  } | null;
};

function safeText(v?: string | null) {
  return String(v || "").trim();
}

function cleanAddress(v?: string | null) {
  return safeText(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .join(", ");
}

function money(n?: number | null) {
  const x = Number(n || 0);
  return `£${x.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPostcode(pc?: string | null) {
  if (!pc) return "";
  const clean = String(pc).replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  return clean.slice(0, -3) + " " + clean.slice(-3);
}

function addressIncludesPostcode(address: string, postcode: string) {
  if (!address || !postcode) return false;

  const a = address.replace(/\s+/g, "").toUpperCase();
  const p = postcode.replace(/\s+/g, "").toUpperCase();

  return a.includes(p);
}

function shortDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const u = String(url || "").trim();
  if (!u) return null;

  try {
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) return null;

    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);

    if (!buf || buf.length < 200) return null;
    return buf;
  } catch {
    return null;
  }
}

function statusLabel(status?: string | null) {
  const s = safeText(status).toLowerCase();

  if (s === "accepted" || s === "approved") return "APPROVED";
  if (s === "sent") return "AWAITING APPROVAL";
if (s === "draft") return "";
  if (s === "expired") return "EXPIRED";

  return "AWAITING APPROVAL";
}

export async function renderEstimatePdfBuffer(opts: RenderEstimatePdfOpts) {
  const estimate = opts.estimate || {};
  const items = Array.isArray(opts.items) ? opts.items : [];
  const profile = opts.profile || {};

  const certificates = Array.isArray(opts.certificates)
    ? opts.certificates.filter((c) => c?.show_on_estimates !== false)
    : [];

  const traderName =
    safeText(profile.business_name) ||
    safeText(profile.display_name) ||
    "Your Trader";

  const logoBuf =
    profile.logo_buffer ||
    (safeText(profile.logo_url)
      ? await fetchImageBuffer(safeText(profile.logo_url))
      : null);

  const estimateNumber =
    safeText(estimate.job_number) ||
    safeText(estimate.trader_ref) ||
    safeText(estimate.id).slice(0, 8) ||
    "Estimate";

  const createdAt = shortDate(estimate.created_at);
  const validUntil = shortDate(estimate.valid_until);

  const customerName = safeText(estimate.customer_name) || "Customer";
  const customerEmail = safeText(estimate.customer_email);
  const customerPhone = safeText(estimate.customer_phone);
const address = cleanAddress(estimate.address);
  const postcode = formatPostcode(estimate.postcode);

  const jobType = safeText(estimate.job_type) || "Estimate";
  const customerMessage = safeText(estimate.customer_message);
  const includedNotes = safeText(estimate.included_notes);
  const excludedNotes = safeText(estimate.excluded_notes);
  const description = safeText(estimate.enquiry_details);

  const subtotal = Number(estimate.subtotal || 0);
  const vat = Number(estimate.vat || 0);
  const total = Number(estimate.total || subtotal + vat);

  const fallbackBreakdown = [
    {
      label: "Labour",
      description: "Labour and workmanship",
      qty: 1,
      value: Number(estimate.labour || 0),
    },
    {
      label: "Materials",
      description: "Materials, parts and supplies",
      qty: 1,
      value: Number(estimate.materials || 0),
    },
    {
      label: "Callout fee",
      description: "Callout and attendance",
      qty: 1,
      value: Number(estimate.callout || 0),
    },
    {
      label: "Parts",
      description: "Parts required for the work",
      qty: 1,
      value: Number(estimate.parts || 0),
    },
    {
      label: "Other",
      description: "Additional quoted costs",
      qty: 1,
      value: Number(estimate.other || 0),
    },
  ].filter((x) => x.value > 0);

  const itemBreakdown = items
    .map((item) => ({
      label: safeText(item.title) || "Item",
      description: "",
      qty: Number(item.quantity || 1),
      value: Number(item.line_total || 0),
    }))
    .filter((x) => x.value > 0);

  const breakdown = (itemBreakdown.length ? itemBreakdown : fallbackBreakdown)
    .slice(0, 6);

  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    autoFirstPage: true,
    bufferPages: false,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const PAGE_W = doc.page.width;
  const PAGE_H = doc.page.height;

  const NAVY = "#0B2A55";
  const NAVY_MID = "#1F355C";
  const BLUE = "#245BFF";
  const INK = "#0B1320";
  const MUTED = "#5C6B84";
  const FAINT = "#8A94A6";
  const BORDER = "#E6ECF5";
  const SOFT = "#F8FAFD";
  const SOFT_BLUE = "#EEF3FF";
  const WHITE = "#FFFFFF";

  const M = 52;
  const W = PAGE_W - M * 2;

  function hRule(y: number, colour = BORDER, lw = 0.75) {
    doc
      .save()
      .moveTo(M, y)
      .lineTo(M + W, y)
      .strokeColor(colour)
      .lineWidth(lw)
      .stroke()
      .restore();
  }

  function rBox(
    x: number,
    y: number,
    w: number,
    h: number,
    r = 10,
    fill = WHITE,
    strokeCol = BORDER,
    lw = 0.75
  ) {
    doc.save();
    doc.roundedRect(x, y, w, h, r).fillColor(fill).fill();

    if (lw > 0) {
      doc
        .roundedRect(x, y, w, h, r)
        .lineWidth(lw)
        .strokeColor(strokeCol)
        .stroke();
    }

    doc.restore();
  }

  function eyebrow(
    text: string,
    x: number,
    y: number,
    w: number,
    align: "left" | "right" = "left"
  ) {
    doc
      .fillColor(FAINT)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(text.toUpperCase(), x, y, {
        width: w,
        align,
        characterSpacing: 1.1,
        lineBreak: false,
      });
  }

  function drawLogo(x: number, y: number, size = 44) {
    if (logoBuf) {
      try {
        rBox(x, y, size, size, 10, WHITE, BORDER);
        doc.image(logoBuf, x + 6, y + 6, {
          fit: [size - 12, size - 12],
          align: "center",
          valign: "center",
        });
        return;
      } catch {
        // fallback below
      }
    }

    rBox(x, y, size, size, 10, SOFT_BLUE, BORDER);

    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(traderName.charAt(0).toUpperCase(), x, y + 12, {
        width: size,
        align: "center",
        lineBreak: false,
      });
  }

  // Background
  doc.rect(0, 0, PAGE_W, PAGE_H).fillColor(WHITE).fill();

  // Header
  const HEADER_H = 148;

  doc.rect(0, 0, PAGE_W, HEADER_H).fillColor(NAVY).fill();




  drawLogo(M, 28, 44);

  doc
    .fillColor(WHITE)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(traderName, M + 58, 32, {
      width: 260,
      lineBreak: false,
    });

  const metaLine = profile.vat_number
    ? `VAT No. ${safeText(profile.vat_number)}`
    : "Trusted local professionals";

  doc
    .fillColor("#BFD0EA")
    .font("Helvetica")
    .fontSize(8.5)
    .text(metaLine, M + 58, 52, {
      width: 300,
      lineBreak: false,
    });

  doc
    .fillColor("#A9BAD8")
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("DOCUMENT", PAGE_W - M - 120, 30, {
      width: 120,
      align: "right",
      characterSpacing: 1,
    });

  doc
    .fillColor(WHITE)
    .font("Helvetica-Bold")
    .fontSize(26)
    .text("Estimate", PAGE_W - M - 140, 44, {
      width: 140,
      align: "right",
      lineBreak: false,
    });

  doc
    .save()
    .moveTo(M, 84)
    .lineTo(M + W, 84)
    .strokeColor("#29466F")
    .lineWidth(0.75)
    .stroke()
    .restore();

  const metaCols = [
    ["Estimate no.", estimateNumber],
    ["Date issued", createdAt || "—"],
    ["Valid until", validUntil || "—"],
    ["Job type", jobType],
  ];

  const colW = W / 4;

  metaCols.forEach(([label, value], i) => {
    const cx = M + colW * i;

    doc
      .fillColor("#A9BAD8")
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(label.toUpperCase(), cx, 96, {
        width: colW - 8,
        characterSpacing: 1,
        lineBreak: false,
      });

    doc
      .fillColor("#F8FBFF")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(value, cx, 111, {
        width: colW - 8,
        lineBreak: false,
      });
  });

  let y = HEADER_H + 36;

  // From / prepared for
  const halfW = (W - 1) / 2;

  eyebrow("From", M, y, halfW);

doc
  .fillColor(NAVY_MID)
  .font("Helvetica-Bold")
  .fontSize(12)
  .text(traderName, M, y + 16, {
    width: halfW,
    lineBreak: false,
  });

const businessAddress = cleanAddress(profile.business_address);

const fromLines = [
  safeText(profile.business_phone),
  safeText(profile.business_email),
  businessAddress,
  profile.vat_number ? `VAT No. ${safeText(profile.vat_number)}` : "",
]
  .filter(Boolean)
  .join("\n");

doc
  .fillColor(MUTED)
  .font("Helvetica")
  .fontSize(9)
  .text(fromLines || "Contact details available on request", M, y + 34, {
    width: halfW,
    lineGap: 2,
  });

  eyebrow("Prepared for", M + halfW + 1, y, halfW, "right");

  doc
    .fillColor(NAVY_MID)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(customerName, M + halfW + 1, y + 16, {
      width: halfW,
      align: "right",
      lineBreak: false,
    });

const toLines = [
  address,
  addressIncludesPostcode(address, postcode) ? "" : postcode,
  customerEmail,
  customerPhone,
]
  .filter(Boolean)
  .join("\n");

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(toLines || "—", M + halfW + 1, y + 33, {
      width: halfW,
      align: "right",
      lineGap: 2,
    });

  doc
    .save()
    .moveTo(M + halfW, y)
    .lineTo(M + halfW, y + 80)
    .strokeColor(BORDER)
    .lineWidth(0.75)
    .stroke()
    .restore();

  y += 100;

  // Hero total
  rBox(M, y, W, 80, 14, SOFT_BLUE, "#C7D9FF", 0.75);

  eyebrow("Estimate total", M + 20, y + 16, 160);

  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(34)
    .text(money(total), M + 20, y + 30, {
      width: 260,
      lineBreak: false,
    });

  const heroDesc = customerMessage || description || jobType;

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(heroDesc, M + 20, y + 64, {
      width: W - 180,
      lineBreak: false,
    });

const badge = statusLabel(estimate.status);

if (badge) {
  rBox(M + W - 156, y + 26, 138, 28, 14, NAVY, NAVY, 0);

  doc
    .fillColor(WHITE)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(badge, M + W - 150, y + 36, {
      width: 126,
      align: "center",
      characterSpacing: 0.5,
      lineBreak: false,
    });
  }

  y += 104;

  // Price breakdown
  eyebrow("Price breakdown", M, y, W);
  y += 18;

  const ROW_H = 44;
  const HEAD_H = 26;
  const TABLE_H = HEAD_H + breakdown.length * ROW_H;

  rBox(M, y, W, TABLE_H, 10, WHITE, BORDER);

  doc.save();
  doc.roundedRect(M, y, W, TABLE_H, 10).clip();
  doc.rect(M, y, W, HEAD_H).fillColor(SOFT).fill();
  doc.restore();

  doc
    .fillColor(FAINT)
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("DESCRIPTION", M + 16, y + 10, {
      width: W - 130,
      characterSpacing: 1,
      lineBreak: false,
    });

  doc.text("QTY", M + W - 110, y + 10, {
    width: 30,
    align: "center",
    characterSpacing: 1,
    lineBreak: false,
  });

  doc.text("AMOUNT", M + W - 70, y + 10, {
    width: 54,
    align: "right",
    characterSpacing: 1,
    lineBreak: false,
  });

  hRule(y + HEAD_H);

  breakdown.forEach((item, i) => {
    const ry = y + HEAD_H + i * ROW_H;

    if (i > 0) hRule(ry, BORDER, 0.5);

    doc
      .fillColor(NAVY_MID)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(item.label, M + 16, ry + 12, {
        width: W - 140,
        lineBreak: false,
      });

    if (item.description) {
      doc
        .fillColor(FAINT)
        .font("Helvetica")
        .fontSize(8)
        .text(item.description, M + 16, ry + 27, {
          width: W - 140,
          lineBreak: false,
        });
    }

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(String(item.qty || 1), M + W - 110, ry + 16, {
        width: 30,
        align: "center",
        lineBreak: false,
      });

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(money(item.value), M + W - 74, ry + 16, {
        width: 58,
        align: "right",
        lineBreak: false,
      });
  });

  y += TABLE_H + 24;

  // Totals
  const totX = M + W - 200;
  const totW = 200;
  const labW = 100;
  const valX = totX + labW;
  const valW = 100;

  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("Subtotal", totX, y, {
      width: labW,
      lineBreak: false,
    });

  doc
    .fillColor(NAVY_MID)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(money(subtotal), valX, y, {
      width: valW,
      align: "right",
      lineBreak: false,
    });

  y += 20;

  if (vat > 0) {
    hRule(y - 5, BORDER, 0.5);

    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("VAT", totX, y, {
        width: labW,
        lineBreak: false,
      });

    doc
      .fillColor(NAVY_MID)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(money(vat), valX, y, {
        width: valW,
        align: "right",
        lineBreak: false,
      });

    y += 24;
  }

  hRule(y - 6, BORDER);

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Total", totX, y, {
      width: labW,
      lineBreak: false,
    });

  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(money(total), totX, y - 4, {
      width: totW,
      align: "right",
      lineBreak: false,
    });

  y += 36;

// Approve guide
if (y < PAGE_H - 110) {
  rBox(M, y, W, 66, 14, NAVY, NAVY, 0);

  doc
    .fillColor(WHITE)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Happy to go ahead?", M + 20, y + 16, {
      width: W - 40,
      lineBreak: false,
    });

  doc
    .fillColor("#C9D8F0")
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      "Please return to your email and use the approval button to accept this estimate.",
      M + 20,
      y + 36,
      {
        width: W - 40,
        lineBreak: false,
      }
    );

  y += 88;
}

  // Notes
  const notes = includedNotes || customerMessage || description;

  if (notes && y < PAGE_H - 150) {
    rBox(M, y, W, 68, 12, SOFT, BORDER);

    eyebrow("Notes", M + 16, y + 14, W - 32);

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8.8)
      .text(notes, M + 16, y + 32, {
        width: W - 32,
        height: 26,
        ellipsis: true,
      });

    y += 84;
  }

  if (excludedNotes && y < PAGE_H - 120) {
    rBox(M, y, W, 52, 12, SOFT, BORDER);

    eyebrow("Exclusions", M + 16, y + 13, W - 32);

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8.6)
      .text(excludedNotes, M + 16, y + 30, {
        width: W - 32,
        height: 16,
        ellipsis: true,
      });

    y += 68;
  }

  // Certificates
  if (certificates.length > 0 && y < PAGE_H - 100) {
    let pillX = M;
    const pillY = y;

    certificates.slice(0, 3).forEach((c) => {
      const name = safeText(c.name);
      const certNo = safeText(c.certificate_number);
      const expiry = shortDate(c.expiry_date);

      const parts = [
        name,
        certNo ? `No. ${certNo}` : "",
        expiry ? `Exp ${expiry}` : "",
      ].filter(Boolean);

      const label = parts.join("  ·  ");
      const pillW = Math.min(240, Math.max(130, label.length * 5.4 + 28));

      rBox(pillX, pillY, pillW, 24, 12, WHITE, BORDER);


      doc
        .fillColor(NAVY_MID)
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text(label, pillX + 22, pillY + 8, {
          width: pillW - 30,
          lineBreak: false,
        });

      pillX += pillW + 8;
    });
  }

  // Footer
  hRule(PAGE_H - 52, BORDER, 0.75);

  doc
    .fillColor("#B0BAC9")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("Powered by FixFlow", M, PAGE_H - 36, {
      width: 160,
      lineBreak: false,
    });


doc
  .fillColor("#C8D3E0")
  .font("Helvetica")
  .fontSize(7.5)
  .text(
    "This estimate is based on details provided and may change if the scope changes after inspection.",
    PAGE_W - M - 420,
    PAGE_H - 36,
    {
      width: 420,
      align: "right",
      lineBreak: false,
    }
  );

  doc.end();
  return await done;
}