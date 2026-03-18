// lib/estimates/renderEstimatePdf.ts
import PDFDocument from "pdfkit";

function money(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `£${x.toFixed(2)}`;
}

function formatPostcode(pc?: string | null) {
  if (!pc) return "";
  const clean = String(pc).replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  return clean.slice(0, -3) + " " + clean.slice(-3);
}

// More tolerant: don’t require content-type to say “image”
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

export async function renderEstimatePdfBuffer(opts: {
  quote: any;
  profile: any;
  fallbackEnquiryDetails?: string;
}) {
  const q = opts.quote || {};
  const prof = opts.profile || {};

  const traderName =
    String(prof?.business_name || "").trim() ||
    String(prof?.display_name || "").trim() ||
    "Your trader";

  const vatNumber = String(prof?.vat_number || "").trim();
  const logoUrl = String(prof?.logo_url || "").trim();
  const logoBuf = logoUrl ? await fetchImageBuffer(logoUrl) : null;

  const subtotal = Number(q.subtotal ?? 0) || 0;
  const vatRate = Number(q.vat_rate ?? 0) || 0;
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;

  const created = q.created_at ? new Date(q.created_at) : new Date();
  const refDefault = String(q.id || "").slice(0, 8) || "estimate";
  const displayRef = String(q.trader_ref || refDefault).trim();

  const jobNumber = String(q.job_number || "").trim();
  const jobType = String(q.job_type || "—").trim();
  const postcode = formatPostcode(q.postcode);
  const custName = String(q.customer_name || "Customer").trim();
  const custEmail = String(q.customer_email || "").trim();
  const custPhone = String(q.customer_phone || "").trim();
  const custAddr = String(q.address || q.postcode || "").trim();

  const details =
    String(q.job_details || "").trim() ||
    String(opts.fallbackEnquiryDetails || "").trim() ||
    "—";

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const INK = "#0B1320";
  const MUTED = "#5C6B84";
  const BORDER = "#E6ECF5";
  const SOFT = "#F6F8FC";
  const HEADER = "#EEF2F7";

  const left = 48;
  const pageW = doc.page.width;
  const contentW = pageW - left * 2;

  // Header band
  doc.save();
  doc.rect(0, 0, pageW, 130).fill(HEADER);
  doc.restore();

  // Title
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(26)
    .text("Estimate", left, 42);

  // Ref/date pill
  const pillW = 200;
  const pillH = 52;
  const pillX = left + contentW - pillW;
  const pillY = 40;

  doc
    .roundedRect(pillX, pillY, pillW, pillH, 12)
    .fill("#FFFFFF")
    .strokeColor(BORDER)
    .stroke();

  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("REF", pillX + 14, pillY + 14);

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(displayRef, pillX + 60, pillY + 12);

  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("DATE", pillX + 14, pillY + 32);

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(created.toLocaleDateString("en-GB"), pillX + 60, pillY + 30);

  // Trader row
  const traderTop = 100;
  const logoBox = 74;

  doc
    .roundedRect(left, traderTop, logoBox, logoBox, 16)
    .fill("#FFFFFF")
    .strokeColor(BORDER)
    .stroke();

  if (logoBuf) {
    try {
      doc.image(logoBuf, left + 10, traderTop + 10, {
        fit: [logoBox - 20, logoBox - 20],
        align: "center",
        valign: "center",
      });
    } catch {}
  }

  const traderTextX = left + logoBox + 16;

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(traderName, traderTextX, traderTop + 10);

  const traderLines = [vatNumber ? `VAT: ${vatNumber}` : ""].filter(Boolean);

  if (traderLines.length) {
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text(traderLines.join("\n"), traderTextX, traderTop + 34, {
        width: contentW - (logoBox + 16),
      });
  }

  const dividerY = traderTop + logoBox + 18;
  doc
    .moveTo(left, dividerY)
    .lineTo(left + contentW, dividerY)
    .strokeColor(BORDER)
    .lineWidth(1)
    .stroke();

  // Cards
  const cardY = dividerY + 18;
  const cardH = 112;
  const gap = 16;
  const cardW = (contentW - gap) / 2;
  const customerX = left;
  const jobX = left + cardW + gap;

  doc
    .roundedRect(customerX, cardY, cardW, cardH, 14)
    .fill(SOFT)
    .strokeColor(BORDER)
    .stroke();

  doc
    .roundedRect(jobX, cardY, cardW, cardH, 14)
    .fill(SOFT)
    .strokeColor(BORDER)
    .stroke();

  // Customer card
  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("CUSTOMER", customerX + 14, cardY + 12);

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(custName, customerX + 14, cardY + 30, {
      width: cardW - 28,
    });

  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(9)
    .text([custAddr, custEmail, custPhone].filter(Boolean).join("\n"), customerX + 14, cardY + 50, {
      width: cardW - 28,
    });

  // Job card
  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("JOB", jobX + 14, cardY + 12);

  if (jobNumber) {
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(jobNumber, jobX + 14, cardY + 30, {
        width: cardW - 28,
      });

    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(10)
      .text(jobType, jobX + 14, cardY + 48, {
        width: cardW - 28,
      });

    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(9)
      .text(postcode ? `Postcode: ${postcode}` : "—", jobX + 14, cardY + 68, {
        width: cardW - 28,
      });
  } else {
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(jobType, jobX + 14, cardY + 30, {
        width: cardW - 28,
      });

    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(9)
      .text(postcode ? `Postcode: ${postcode}` : "—", jobX + 14, cardY + 52, {
        width: cardW - 28,
      });
  }

  // Work description
  const descY = cardY + cardH + 20;

  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("WORK DESCRIPTION", left, descY);

  const descBoxY = descY + 14;
  const descBoxH = 170;

  doc
    .roundedRect(left, descBoxY, contentW, descBoxH, 16)
    .fill("#FFFFFF")
    .strokeColor(BORDER)
    .stroke();

  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(11)
    .text(details, left + 14, descBoxY + 14, {
      width: contentW - 28,
      height: descBoxH - 28,
    });

  // Totals
  const sumY = descBoxY + descBoxH + 40;

  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("SUMMARY", left, sumY);

  const totalsX = left + contentW - 240;
  const totalsY = sumY - 8;

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(10)
    .text("Subtotal", totalsX, totalsY + 20);

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(money(subtotal), totalsX, totalsY + 20, {
      width: 240,
      align: "right",
    });

  if (vatRate > 0) {
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text(`VAT (${vatRate}%)`, totalsX, totalsY + 44);

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(money(vat), totalsX, totalsY + 44, {
        width: 240,
        align: "right",
      });

    doc
      .moveTo(totalsX, totalsY + 68)
      .lineTo(totalsX + 240, totalsY + 68)
      .strokeColor(BORDER)
      .stroke();

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Total", totalsX, totalsY + 82);

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(money(total), totalsX, totalsY + 78, {
        width: 240,
        align: "right",
      });
  } else {
    doc
      .moveTo(totalsX, totalsY + 46)
      .lineTo(totalsX + 240, totalsY + 46)
      .strokeColor(BORDER)
      .stroke();

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Total", totalsX, totalsY + 60);

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(money(total), totalsX, totalsY + 56, {
        width: 240,
        align: "right",
      });
  }

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "This estimate is based on the details provided and may change if the scope changes after inspection.",
      left,
      770,
      { width: contentW }
    );

  doc.end();
  return await done;
}