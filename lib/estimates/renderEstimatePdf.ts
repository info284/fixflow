import PDFDocument from "pdfkit";

type PdfLineItem = {
  title?: string | null;
  quantity?: number | null;
  line_total?: number | null;
};

type RenderEstimatePdfOpts = {
  estimate?: any;
  items?: PdfLineItem[];
  profile?: {
    business_name?: string | null;
    display_name?: string | null;
    logo_url?: string | null;
    logo_buffer?: Buffer | null;
  } | null;
};

function money(n?: number | null) {
  const x = Number(n || 0);
  return `£${x.toFixed(2)}`;
}

function safeText(v?: string | null) {
  return String(v || "").trim();
}

function formatPostcode(pc?: string | null) {
  if (!pc) return "";
  const clean = String(pc).replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  return clean.slice(0, -3) + " " + clean.slice(-3);
}

function shortDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB");
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

function splitParagraphs(text: string) {
  return String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitWords(text: string) {
  return String(text || "").trim().split(/\s+/).filter(Boolean);
}

function fitWordsToLine(
  doc: PDFKit.PDFDocument,
  words: string[],
  maxWidth: number
) {
  let line = "";
  let used = 0;

  while (used < words.length) {
    const test = line ? `${line} ${words[used]}` : words[used];
    if (doc.widthOfString(test) <= maxWidth) {
      line = test;
      used += 1;
    } else {
      break;
    }
  }

  if (!line && words[0]) {
    let raw = words[0];
    while (raw.length > 1 && doc.widthOfString(`${raw}…`) > maxWidth) {
      raw = raw.slice(0, -1);
    }
    return { line: `${raw}…`, used: 1 };
  }

  return { line, used };
}

function truncateLines(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const paragraphs = splitParagraphs(text);
  if (!paragraphs.length) return [];

  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = splitWords(paragraph);
    let index = 0;

    while (index < words.length && lines.length < maxLines) {
      const fitted = fitWordsToLine(doc, words.slice(index), maxWidth);
      lines.push(fitted.line);
      index += fitted.used;
    }

    if (lines.length >= maxLines) break;
  }

  if (paragraphs.length && lines.length > maxLines) {
    lines.length = maxLines;
  }

  return lines.slice(0, maxLines);
}

function drawLines(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  maxLines: number,
  lineHeight: number,
  align: "left" | "center" | "right" = "left"
) {
  const lines = truncateLines(doc, text, width, maxLines);
  lines.forEach((line, i) => {
    doc.text(line, x, y + i * lineHeight, {
      width,
      align,
      lineBreak: false,
    });
  });
}

export async function renderEstimatePdfBuffer(opts: RenderEstimatePdfOpts) {
  const estimate = opts.estimate || {};
  const items = Array.isArray(opts.items) ? opts.items : [];
  const profile = opts.profile || {};

  const traderName =
    safeText(profile.business_name) ||
    safeText(profile.display_name) ||
    "Your trader";

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
  const address = safeText(estimate.address);
  const postcode = formatPostcode(estimate.postcode);

  const jobNumber =
  safeText(estimate.job_number) ||
  safeText(estimate.trader_ref) ||
  "—";
  const jobType = safeText(estimate.job_type) || "Estimate";

  const customerMessage = safeText(estimate.customer_message);
  const includedNotes = safeText(estimate.included_notes);
  const excludedNotes = safeText(estimate.excluded_notes);
  const description = safeText(estimate.enquiry_details);

  const subtotal = Number(estimate.subtotal || 0);
  const vat = Number(estimate.vat || 0);
  const total = Number(estimate.total || subtotal + vat);

  const fallbackBreakdown = [
    { label: "Labour", qty: 1, value: Number(estimate.labour || 0) },
    { label: "Materials", qty: 1, value: Number(estimate.materials || 0) },
    { label: "Callout fee", qty: 1, value: Number(estimate.callout || 0) },
    { label: "Parts", qty: 1, value: Number(estimate.parts || 0) },
    { label: "Other", qty: 1, value: Number(estimate.other || 0) },
  ].filter((x) => x.value > 0);

  const itemBreakdown = items
    .map((item) => ({
      label: safeText(item.title) || "Item",
      qty: Number(item.quantity || 1),
      value: Number(item.line_total || 0),
    }))
    .filter((x) => x.value > 0);

  const breakdown = (itemBreakdown.length ? itemBreakdown : fallbackBreakdown).slice(0, 5);

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

  const INK = "#0B1320";
  const NAVY = "#243B6B";
  const MUTED = "#67748E";
  const BORDER = "#D9E0EC";
  const SOFT_BORDER = "#E6EBF3";
  const PAGE_BG = "#F5F7FB";
  const PANEL_BG = "#EEF3FB";
  const CARD_BG = "#FFFFFF";
  const SOFT_BOX = "#F7F9FC";
  const SOFT_BLUE = "#F3F6FB";

  const OUTER = 34;
  const CARD_X = 54;
  const CARD_Y = 44;
  const CARD_W = PAGE_W - CARD_X * 2;
  const INNER = 18;

  function roundedBox(
    x: number,
    y: number,
    w: number,
    h: number,
    radius = 18,
    fill = CARD_BG,
    stroke = SOFT_BORDER
  ) {
    doc.save();
    doc.roundedRect(x, y, w, h, radius).fill(fill);
    doc.roundedRect(x, y, w, h, radius).lineWidth(1).strokeColor(stroke).stroke();
    doc.restore();
  }

  function label(text: string, x: number, y: number) {
    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(text.toUpperCase(), x, y, { lineBreak: false });
  }

  function drawLogoBox(x: number, y: number, size = 56) {
    if (logoBuf) {
      try {
        roundedBox(x, y, size, size, 14, "#FFFFFF", "#DCE3EF");
        doc.image(logoBuf, x + 8, y + 8, {
          fit: [size - 16, size - 16],
          align: "center",
          valign: "center",
        });
        return;
      } catch {
        // fallback below
      }
    }

    roundedBox(x, y, size, size, 14, SOFT_BLUE, BORDER);
    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text(traderName.charAt(0).toUpperCase(), x, y + 16, {
        width: size,
        align: "center",
        lineBreak: false,
      });
  }

  // Backgrounds
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(PAGE_BG);
  roundedBox(
    OUTER,
    OUTER,
    PAGE_W - OUTER * 2,
    PAGE_H - OUTER * 2,
    26,
    PANEL_BG,
    PANEL_BG
  );
 
const CARD_BOTTOM_PADDING = 14;

roundedBox(
  CARD_X,
  CARD_Y,
  CARD_W,
  PAGE_H - CARD_Y - CARD_BOTTOM_PADDING,
  22,
  CARD_BG,
 "#DCE3EF"
);
  const x = CARD_X + INNER;
  const w = CARD_W - INNER * 2;
  let y = CARD_Y + 14;

  // Title
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(24).text("Estimate", x, y, {
    lineBreak: false,
  });
  y += 44;

  // Header
const headerH = 88;

roundedBox(x, y, w, headerH, 18, "#FFFFFF", "#DCE3EF");

drawLogoBox(x + 14, y + 16, 56);

doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18);
drawLines(doc, traderName, x + 84, y + 18, w - 240, 1, 20);

doc.fillColor(MUTED).font("Helvetica").fontSize(11);
drawLines(doc, `Estimate no. ${estimateNumber}`, x + 84, y + 46, w - 240, 1, 14);

doc.fillColor(MUTED).font("Helvetica").fontSize(10);
if (createdAt) {
  drawLines(doc, `Created ${createdAt}`, x + w - 140, y + 18, 120, 1, 12, "right");
}
if (validUntil) {
  drawLines(doc, `Valid until ${validUntil}`, x + w - 140, y + 42, 120, 1, 12, "right");
}

  y += headerH + 16;

  // Customer + Job
  const gap = 14;
  const colW = (w - gap) / 2;
  const infoH = 112;

  roundedBox(x, y, colW, infoH, 18, SOFT_BOX, SOFT_BORDER);
  roundedBox(x + colW + gap, y, colW, infoH, 18, SOFT_BOX, SOFT_BORDER);

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12);
  drawLines(doc, customerName, x + 16, y + 26, colW - 32, 1, 16, "center");

  doc.fillColor(INK).font("Helvetica").fontSize(10);
 const customerBlock = [address, postcode, customerEmail, customerPhone]
  .filter(Boolean)
  .join(" • ");
  drawLines(doc, customerBlock || "—", x + 16, y + 50, colW - 32, 4, 12, "center");

  const jobX = x + colW + gap;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12);
  drawLines(doc, jobNumber, jobX + 16, y + 36, colW - 32, 1, 16, "center");

  doc.fillColor(INK).font("Helvetica").fontSize(10);
  drawLines(doc, jobType, jobX + 16, y + 62, colW - 32, 2, 12, "center");

  y += infoH + 16;

  // Summary
 const summaryH = customerMessage ? 92 : 76;
  roundedBox(x, y, w, summaryH, 18, CARD_BG, SOFT_BORDER);

  label("Estimate summary", x + 16, y + 16);

  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(24);
  drawLines(doc, money(total), x + 16, y + 42, w - 32, 1, 26);



  if (customerMessage) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(10);
    drawLines(
      doc,
      customerMessage,
      validUntil ? x + 150 : x + 16,
      validUntil ? y + 76 : y + 72,
      validUntil ? w - 166 : w - 32,
      1,
      12
    );
  }

  y += summaryH + 14;

  // Job details
  if (description) {
    const detailsH = 96;
    roundedBox(x, y, w, detailsH, 18, CARD_BG, SOFT_BORDER);

    label("Job details", x + 16, y + 16);

    doc.fillColor(INK).font("Helvetica").fontSize(10);
    drawLines(doc, description, x + 16, y + 38, w - 32, 4, 12);

    y += detailsH + 14;
  }

  // Price breakdown
  const rowH = 24;
  const breakdownH = 48 + breakdown.length * rowH;
  roundedBox(x, y, w, breakdownH, 18, CARD_BG, SOFT_BORDER);

  label("Price breakdown", x + 16, y + 16);

  let rowY = y + 40;
  breakdown.forEach((line) => {
    const qty = Number((line as any).qty || 0);
    const name = qty > 1 ? `${line.label} × ${qty}` : line.label;

    doc.fillColor(MUTED).font("Helvetica").fontSize(11);
    drawLines(doc, name, x + 16, rowY, w - 160, 1, 12);

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11);
    drawLines(doc, money(line.value), x + 16, rowY, w - 32, 1, 12, "right");

    rowY += rowH;
  });

  y += breakdownH + 14;

  // Totals
const totalsH = vat > 0 ? 120 : 92;
roundedBox(x, y, w, totalsH, 18, SOFT_BOX, SOFT_BORDER);

label("Totals", x + 16, y + 16);

doc.fillColor(MUTED).font("Helvetica").fontSize(11);
drawLines(doc, "Subtotal", x + 16, y + 40, w - 160, 1, 12);

doc.fillColor(INK).font("Helvetica-Bold").fontSize(11);
drawLines(doc, money(subtotal), x + 16, y + 40, w - 32, 1, 12, "right");

if (vat > 0) {
  doc.fillColor(MUTED).font("Helvetica").fontSize(11);
  drawLines(doc, "VAT", x + 16, y + 60, w - 160, 1, 12);

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11);
  drawLines(doc, money(vat), x + 16, y + 60, w - 32, 1, 12, "right");

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(14);
  drawLines(doc, "Total", x + 16, y + 82, w - 160, 1, 16);

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(18);
  drawLines(doc, money(total), x + 16, y + 78, w - 32, 1, 20, "right");
} else {
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(14);
  drawLines(doc, "Total", x + 16, y + 62, w - 160, 1, 16);

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(18);
  drawLines(doc, money(total), x + 16, y + 58, w - 32, 1, 20, "right");
}

y += totalsH + 2;

  // Optional notes — only include if there is room
  const footerTop = PAGE_H - 62;
  const remaining = footerTop - y;

  if (includedNotes && remaining >= 74) {
    const incH = 62;
    roundedBox(x, y, w, incH, 18, SOFT_BOX, SOFT_BORDER);

    label("What's included", x + 16, y + 16);

    doc.fillColor(INK).font("Helvetica").fontSize(10);
    drawLines(doc, includedNotes, x + 16, y + 36, w - 32, 1, 12);

    y += incH + 12;
  }

  if (excludedNotes && footerTop - y >= 74) {
    const excH = 62;
    roundedBox(x, y, w, excH, 18, SOFT_BOX, SOFT_BORDER);

    label("What's excluded", x + 16, y + 16);

    doc.fillColor(INK).font("Helvetica").fontSize(10);
    drawLines(doc, excludedNotes, x + 16, y + 36, w - 32, 1, 12);
  }


doc
  .fillColor(MUTED)
  .font("Helvetica")
  .fontSize(8);

drawLines(
  doc,
  "This estimate is based on the details provided and may change if the scope changes after inspection.",
  x,
  PAGE_H - 28,
  w,
  1,
  10,
  "center"
);

doc.end();
return await done;
}