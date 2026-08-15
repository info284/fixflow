// lib/invoices/renderInvoicePdf.ts
import PDFDocument from "pdfkit";

type PdfCertificate = {
  name?: string | null;
  certificate_number?: string | null;
  expiry_date?: string | null;
  show_on_invoices?: boolean | null;
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

function invoiceStatusLabel(status?: string | null) {
  const s = safeText(status).toLowerCase();

  if (s === "paid") return "PAID";
  if (s === "overdue") return "OVERDUE";
  if (s === "sent") return "AWAITING PAYMENT";
  if (s === "draft") return "";

  return "AWAITING PAYMENT";
}

export async function renderInvoicePdfBuffer(opts: {
  invoice: any;
  profile: any;
  fallbackEnquiryDetails?: string;
  certificates?: PdfCertificate[];
}) {
  const invoice = opts.invoice || {};
  const profile = opts.profile || {};

  const certificates = Array.isArray(opts.certificates)
    ? opts.certificates.filter((c) => c?.show_on_invoices !== false)
    : [];

  const traderName =
    safeText(profile.business_name) ||
    safeText(profile.display_name) ||
    "Your Trader";

  const logoUrl = safeText(profile.logo_url);
  const logoBuf = logoUrl ? await fetchImageBuffer(logoUrl) : null;

  const invoiceNumber =
    safeText(invoice.invoice_number) ||
    safeText(invoice.job_number) ||
    safeText(invoice.id).slice(0, 8) ||
    "Invoice";

  const createdAt = shortDate(invoice.created_at);
 const dueDate = shortDate(invoice.due_at || invoice.due_date);
const dueDateText = dueDate || "Payment due on receipt";

  const customerName = safeText(invoice.customer_name) || "Customer";
  const customerEmail = safeText(invoice.customer_email || invoice.to_email);
  const customerPhone = safeText(invoice.customer_phone);
  const address = cleanAddress(invoice.address);
  const postcode = formatPostcode(invoice.postcode);

  const jobType = safeText(invoice.job_type) || "Invoice";
  const description =
    safeText(invoice.job_details) ||
    safeText(opts.fallbackEnquiryDetails) ||
    safeText(invoice.notes) ||
    jobType;

  const subtotal = Number(invoice.subtotal ?? invoice.amount ?? 0) || 0;
  const vatRate = Number(invoice.vat_rate ?? 0) || 0;
  const vat = Number(invoice.vat ?? subtotal * (vatRate / 100)) || 0;
  const total = Number(invoice.total ?? invoice.amount ?? subtotal + vat) || 0;

  const breakdown = [
    {
      label: "Work completed",
      description,
      qty: 1,
      value: subtotal,
    },
  ].filter((x) => x.value > 0);

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

  const BRAND = safeText(profile.brand_colour) || "#0B2A55";
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
      } catch {}
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

  doc.rect(0, 0, PAGE_W, PAGE_H).fillColor(WHITE).fill();

  const HEADER_H = 148;

  doc.rect(0, 0, PAGE_W, HEADER_H).fillColor(BRAND).fill();

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
    .text("Invoice", PAGE_W - M - 140, 44, {
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
    ["Invoice no.", invoiceNumber],
    ["Date issued", createdAt || "—"],
   ["Due date", dueDateText],
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

  const businessAddress = cleanAddress(profile.trading_address);

const fromLines = [
safeText(profile.business_phone),
safeText(profile.notify_email),
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

  eyebrow("Bill to", M + halfW + 1, y, halfW, "right");

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

  rBox(M, y, W, 80, 14, SOFT_BLUE, "#C7D9FF", 0.75);

  eyebrow("Amount due", M + 20, y + 16, 160);

  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(34)
    .text(money(total), M + 20, y + 30, {
      width: 260,
      lineBreak: false,
    });

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(dueDate ? `Payment due by ${dueDate}` : dueDateText, M + 20, y + 64, {
      width: W - 180,
      lineBreak: false,
    });

  const badge = invoiceStatusLabel(invoice.status);

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

  eyebrow("Invoice breakdown", M, y, W);
  y += 18;

  const ROW_H = 52;
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

    doc
      .fillColor(FAINT)
      .font("Helvetica")
      .fontSize(8)
      .text(item.description, M + 16, ry + 27, {
        width: W - 140,
        height: 18,
        ellipsis: true,
      });

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(String(item.qty || 1), M + W - 110, ry + 18, {
        width: 30,
        align: "center",
        lineBreak: false,
      });

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(money(item.value), M + W - 74, ry + 18, {
        width: 58,
        align: "right",
        lineBreak: false,
      });
  });

  y += TABLE_H + 24;

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
      .text(vatRate > 0 ? `VAT (${vatRate}%)` : "VAT", totX, y, {
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

  if (invoice.status !== "paid" && y < PAGE_H - 110) {
    rBox(M, y, W, 66, 14, NAVY, NAVY, 0);

    doc
      .fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("Ready to pay?", M + 20, y + 16, {
        width: W - 40,
        lineBreak: false,
      });

    doc
      .fillColor("#C9D8F0")
      .font("Helvetica")
      .fontSize(8.5)
      .text(
        "Please return to your email and use the payment button to pay this invoice securely.",
        M + 20,
        y + 36,
        {
          width: W - 40,
          lineBreak: false,
        }
      );

    y += 88;
  }

  if (description && y < PAGE_H - 150) {
    rBox(M, y, W, 68, 12, SOFT, BORDER);

    eyebrow("Notes", M + 16, y + 14, W - 32);

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8.8)
      .text(description, M + 16, y + 32, {
        width: W - 32,
        height: 26,
        ellipsis: true,
      });

    y += 84;
  }

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
        .text(label, pillX + 14, pillY + 8, {
          width: pillW - 24,
          lineBreak: false,
        });

      pillX += pillW + 8;
    });
  }

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
      "This invoice reflects the work and charges agreed for the completed job.",
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