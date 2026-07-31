/**
 * Shared jsPDF report theme + builders (client-side vector PDFs).
 *
 * Companion to excelTheme.ts. Renders crisp, selectable, lightweight PDFs from
 * data — no html2canvas screenshots. jsPDF's built-in fonts cannot render
 * Vietnamese, so a Be Vietnam Pro TTF is embedded via `registerFonts`.
 *
 * `buildXxx` functions are pure (accept font bytes, no DOM/fetch) so they can be
 * unit-tested in Node; the browser wrapper fetches fonts from /public/fonts.
 */
import type { jsPDF } from "jspdf";

export const PDF_FONT = "BeVietnamPro";

export const PDF = {
  brand: "#1A7A4A",
  brandDark: "#12603A",
  brandSoft: "#E8F5EE",
  ink: "#1A1A1A",
  muted: "#666666",
  zebra: "#F6FBF8",
  border: "#D9E5DE",
  red: "#D32F2F",
  white: "#FFFFFF",
} as const;

// A4 portrait geometry (mm)
export const PAGE = { w: 210, h: 297, margin: 14 } as const;
export const CONTENT_W = PAGE.w - PAGE.margin * 2;

export interface FontPair {
  regular: string; // base64 TTF
  bold: string;    // base64 TTF
}

export function registerFonts(doc: jsPDF, fonts: FontPair): void {
  doc.addFileToVFS("BeVietnamPro-Regular.ttf", fonts.regular);
  doc.addFont("BeVietnamPro-Regular.ttf", PDF_FONT, "normal");
  doc.addFileToVFS("BeVietnamPro-Bold.ttf", fonts.bold);
  doc.addFont("BeVietnamPro-Bold.ttf", PDF_FONT, "bold");
  doc.setFont(PDF_FONT, "normal");
}

/** Browser-only: fetch the embedded fonts from /public/fonts as base64. Cached by the browser. */
export async function loadPdfFonts(): Promise<FontPair> {
  const toB64 = async (url: string) => {
    const buf = await (await fetch(url)).arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
  const [regular, bold] = await Promise.all([
    toB64("/fonts/BeVietnamPro-Regular.ttf"),
    toB64("/fonts/BeVietnamPro-Bold.ttf"),
  ]);
  return { regular, bold };
}

export async function newPdf(fonts: FontPair): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  registerFonts(doc, fonts);
  return doc;
}

const setFill = (doc: jsPDF, hex: string) => doc.setFillColor(hex);
const setText = (doc: jsPDF, hex: string) => doc.setTextColor(hex);
const setDraw = (doc: jsPDF, hex: string) => doc.setDrawColor(hex);

/** Brand header on the current page. Returns the y below it (mm). */
export function header(doc: jsPDF, title: string, subtitle: string, meta?: string): number {
  setFill(doc, PDF.brand);
  doc.rect(0, 0, PAGE.w, 16, "F");
  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(12);
  setText(doc, PDF.white);
  doc.text("WeaveCarbon", PAGE.margin, 10);
  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(8);
  doc.text("Carbon Intelligence Platform", PAGE.margin + 34, 10);
  if (meta) doc.text(meta, PAGE.w - PAGE.margin, 10, { align: "right" });

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(17);
  setText(doc, PDF.ink);
  doc.text(title, PAGE.margin, 28);

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(9.5);
  setText(doc, PDF.muted);
  doc.text(subtitle, PAGE.margin, 35, { maxWidth: CONTENT_W });

  setDraw(doc, PDF.brand);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, 39, PAGE.w - PAGE.margin, 39);
  return 45;
}

/** Section heading bar. Returns y below it. */
export function section(doc: jsPDF, y: number, text: string): number {
  const yy = pageBreak(doc, y, 12);
  setFill(doc, PDF.brandSoft);
  doc.rect(PAGE.margin, yy, CONTENT_W, 7, "F");
  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(10.5);
  setText(doc, PDF.brandDark);
  doc.text(text, PAGE.margin + 2, yy + 5);
  return yy + 11;
}

/** KPI cards row. Returns y below. */
export function kpiRow(doc: jsPDF, y: number, items: { label: string; value: string; unit?: string }[]): number {
  const gap = 3;
  const cardW = (CONTENT_W - gap * (items.length - 1)) / items.length;
  const cardH = 18;
  items.forEach((it, i) => {
    const x = PAGE.margin + i * (cardW + gap);
    setFill(doc, PDF.brandSoft);
    doc.rect(x, y, cardW, cardH, "F");
    setDraw(doc, PDF.border);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cardW, cardH, "S");
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(7.5);
    setText(doc, PDF.brandDark);
    doc.text(it.label, x + 2.5, y + 5, { maxWidth: cardW - 5 });
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(13);
    setText(doc, PDF.brand);
    doc.text(String(it.value), x + 2.5, y + 12.5, { maxWidth: cardW - 5 });
    if (it.unit) {
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(7);
      setText(doc, PDF.muted);
      doc.text(it.unit, x + 2.5, y + 16, { maxWidth: cardW - 5 });
    }
  });
  return y + cardH + 4;
}

export interface PdfColumn<T> {
  header: string;
  width: number;                       // mm
  align?: "left" | "right" | "center";
  value: (row: T) => string;
  color?: (row: T) => string | undefined;
}

/** Add the current page number footer + methodology/disclaimer line. Call once per finished doc. */
export function footers(doc: jsPDF, methodology: string): void {
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const y = PAGE.h - 10;
    setDraw(doc, PDF.border);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, y, PAGE.w - PAGE.margin, y);
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(7);
    setText(doc, PDF.muted);
    doc.text(methodology, PAGE.margin, y + 4, { maxWidth: CONTENT_W - 20 });
    doc.text(`Trang ${p}/${pageCount}`, PAGE.w - PAGE.margin, y + 4, { align: "right" });
  }
}

/** Add a page and return the starting content y. */
function newContentPage(doc: jsPDF): number {
  doc.addPage();
  return PAGE.margin + 6;
}

/** If `needed` mm won't fit before the footer, break to a new page. Returns the y to draw at. */
export function pageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE.h - 16) return newContentPage(doc);
  return y;
}

/** The workhorse: a styled, page-breaking data table. Returns y below the table. */
export function table<T>(
  doc: jsPDF,
  y: number,
  columns: PdfColumn<T>[],
  rows: T[],
  opts: { emptyText?: string; footRow?: string[]; fontSize?: number } = {},
): number {
  const x0 = PAGE.margin;
  const tableW = columns.reduce((s, c) => s + c.width, 0);
  const scale = tableW > CONTENT_W ? CONTENT_W / tableW : 1;
  const cols = columns.map((c) => ({ ...c, w: c.width * scale }));
  const fs = opts.fontSize ?? 8;
  const headerH = 8;
  const pad = 1.5;

  const drawHeader = (yy: number) => {
    setFill(doc, PDF.brand);
    doc.rect(x0, yy, CONTENT_W, headerH, "F");
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(fs);
    setText(doc, PDF.white);
    let cx = x0;
    cols.forEach((c) => {
      const tx = c.align === "right" ? cx + c.w - pad : c.align === "center" ? cx + c.w / 2 : cx + pad;
      doc.text(c.header, tx, yy + headerH / 2 + 1.4, { align: c.align ?? "left", maxWidth: c.w - pad * 2 });
      cx += c.w;
    });
    return yy + headerH;
  };

  let cy = pageBreak(doc, y, headerH + 12);
  cy = drawHeader(cy);

  if (rows.length === 0) {
    setDraw(doc, PDF.border);
    doc.setLineWidth(0.2);
    doc.rect(x0, cy, CONTENT_W, 8, "S");
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(fs);
    setText(doc, PDF.muted);
    doc.text(opts.emptyText ?? "Chưa có dữ liệu.", x0 + CONTENT_W / 2, cy + 5, { align: "center" });
    return cy + 12;
  }

  doc.setFontSize(fs);
  rows.forEach((row, ri) => {
    // Measure wrapped height for this row.
    doc.setFont(PDF_FONT, "normal");
    const lineCounts = cols.map((c) => doc.splitTextToSize(c.value(row) || "", c.w - pad * 2).length);
    const lines = Math.max(1, ...lineCounts);
    const rowH = Math.max(6, lines * (fs * 0.42) + 2.5);

    if (cy + rowH > PAGE.h - 16) {
      cy = newContentPage(doc);
      cy = drawHeader(cy);
      doc.setFontSize(fs);
    }

    if (ri % 2 === 1) {
      setFill(doc, PDF.zebra);
      doc.rect(x0, cy, CONTENT_W, rowH, "F");
    }
    let cx = x0;
    cols.forEach((c) => {
      const raw = c.value(row) || "";
      const txt = doc.splitTextToSize(raw, c.w - pad * 2);
      setText(doc, c.color?.(row) ?? PDF.ink);
      doc.setFont(PDF_FONT, "normal");
      const tx = c.align === "right" ? cx + c.w - pad : c.align === "center" ? cx + c.w / 2 : cx + pad;
      doc.text(txt, tx, cy + 3.6, { align: c.align ?? "left", maxWidth: c.w - pad * 2 });
      cx += c.w;
    });
    setDraw(doc, PDF.border);
    doc.setLineWidth(0.15);
    doc.line(x0, cy + rowH, x0 + CONTENT_W, cy + rowH);
    cy += rowH;
  });

  if (opts.footRow) {
    const rowH = 7;
    cy = pageBreak(doc, cy, rowH);
    setFill(doc, PDF.brandSoft);
    doc.rect(x0, cy, CONTENT_W, rowH, "F");
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(fs);
    setText(doc, PDF.brandDark);
    let cx = x0;
    cols.forEach((c, i) => {
      const raw = opts.footRow?.[i] ?? "";
      const tx = c.align === "right" ? cx + c.w - pad : c.align === "center" ? cx + c.w / 2 : cx + pad;
      doc.text(raw, tx, cy + rowH / 2 + 1.4, { align: c.align ?? "left", maxWidth: c.w - pad * 2 });
      cx += c.w;
    });
    cy += rowH;
  }

  // Outer border
  setDraw(doc, PDF.border);
  doc.setLineWidth(0.2);
  return cy + 4;
}

/** Horizontal percentage bars (a compact alternative to a pie chart). Returns y below. */
export function percentBars(doc: jsPDF, y: number, items: { label: string; value: number; color: string }[]): number {
  const labelW = 42;
  const barMaxW = CONTENT_W - labelW - 20;
  const rowH = 7;
  let cy = y;
  items.forEach((it) => {
    cy = pageBreak(doc, cy, rowH);
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(8.5);
    setText(doc, PDF.ink);
    doc.text(it.label, PAGE.margin, cy + 4, { maxWidth: labelW - 2 });
    setFill(doc, PDF.border);
    doc.rect(PAGE.margin + labelW, cy + 1, barMaxW, 4, "F");
    const w = Math.max(0, Math.min(100, it.value)) / 100 * barMaxW;
    setFill(doc, it.color);
    doc.rect(PAGE.margin + labelW, cy + 1, w, 4, "F");
    doc.setFont(PDF_FONT, "bold");
    setText(doc, PDF.muted);
    doc.text(`${it.value}%`, PAGE.margin + labelW + barMaxW + 3, cy + 4);
    cy += rowH;
  });
  return cy + 3;
}

/** Wrapped paragraph. Returns y below. */
export function paragraph(doc: jsPDF, y: number, text: string, opts: { size?: number; color?: string; italic?: boolean } = {}): number {
  const size = opts.size ?? 8.5;
  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(size);
  setText(doc, opts.color ?? PDF.muted);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  const yy = pageBreak(doc, y, lines.length * size * 0.42 + 2);
  doc.text(lines, PAGE.margin, yy + 3);
  return yy + lines.length * (size * 0.42) + 4;
}
