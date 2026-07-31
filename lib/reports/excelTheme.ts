/**
 * Shared Excel report theme + builders (ExcelJS).
 *
 * This is the reusable "template engine" for downloadable Excel reports: a report
 * module (e.g. cbamTemplate.ts) describes its sheets/columns and the data, and these
 * helpers render a consistently branded, styled workbook. Add a new file next to this
 * one per report — the folder is the template library.
 *
 * Excel's default fonts render Vietnamese fine, so (unlike the PDF reports) no font
 * embedding is needed here.
 */
import type { Workbook, Worksheet, Row } from "exceljs";

export const THEME = {
  brand: "1A7A4A",       // primary green (header bars, KPI values)
  brandDark: "12603A",
  brandSoft: "E8F5EE",   // light green (KPI/label backgrounds)
  headerText: "FFFFFF",
  ink: "0F172A",         // near-black body text
  muted: "64748B",       // subtitles / captions
  zebra: "F6FBF8",       // alternating row fill
  border: "D9E5DE",
  red: "D32F2F",
  amber: "B45309",
} as const;

const FONT = "Calibri";

export type CellValue = string | number | null | undefined;

export interface TemplateColumn<T = unknown> {
  header: string;
  width?: number;
  numFmt?: string;                 // e.g. "#,##0.00"
  align?: "left" | "center" | "right";
  total?: boolean;                 // include a summed total in the totals row
  value: (row: T) => CellValue;    // how to pull the cell value from a data row
}

const fill = (argb: string) =>
  ({ type: "pattern", pattern: "solid", fgColor: { argb } }) as const;

const thin = (argb: string) => ({ style: "thin" as const, color: { argb } });

const allBorders = (argb: string) => ({
  top: thin(argb),
  left: thin(argb),
  bottom: thin(argb),
  right: thin(argb),
});

export async function newBrandedWorkbook(): Promise<Workbook> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "WeaveCarbon Reporting Engine";
  wb.created = new Date();
  wb.modified = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

export function addWorksheet(wb: Workbook, name: string): Worksheet {
  const safe = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
  const sheet = wb.addWorksheet(safe, {
    properties: { tabColor: { argb: THEME.brand }, defaultRowHeight: 16 },
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }],
  });
  return sheet;
}

/** Brand header block: "WeaveCarbon" bar + report title + subtitle. Returns next free row. */
export function addTitleBlock(
  sheet: Worksheet,
  title: string,
  subtitle: string,
  span: number,
  meta?: string,
): number {
  const cols = Math.max(span, 3);

  sheet.mergeCells(1, 1, 1, cols);
  const brandCell = sheet.getCell(1, 1);
  brandCell.value = "WeaveCarbon · Carbon Intelligence Platform";
  brandCell.font = { name: FONT, size: 11, bold: true, color: { argb: THEME.headerText } };
  brandCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  brandCell.fill = fill(THEME.brand);
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, cols);
  const titleCell = sheet.getCell(2, 1);
  titleCell.value = title;
  titleCell.font = { name: FONT, size: 17, bold: true, color: { argb: THEME.ink } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(2).height = 26;

  sheet.mergeCells(3, 1, 3, cols);
  const subCell = sheet.getCell(3, 1);
  subCell.value = meta ? `${subtitle}\n${meta}` : subtitle;
  subCell.font = { name: FONT, size: 9.5, italic: true, color: { argb: THEME.muted } };
  subCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
  sheet.getRow(3).height = meta ? 28 : 16;

  return 5; // leave one blank row
}

/** Row of KPI cards (label + big value + unit). Returns next free row. */
export function addKpiStrip(
  sheet: Worksheet,
  startRow: number,
  items: { label: string; value: CellValue; unit?: string }[],
): number {
  const perCard = 2; // each card spans 2 columns
  items.forEach((item, i) => {
    const c = i * perCard + 1;
    sheet.mergeCells(startRow, c, startRow, c + perCard - 1);
    const label = sheet.getCell(startRow, c);
    label.value = item.label;
    label.font = { name: FONT, size: 8.5, bold: true, color: { argb: THEME.brandDark } };
    label.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    label.fill = fill(THEME.brandSoft);

    sheet.mergeCells(startRow + 1, c, startRow + 2, c + perCard - 1);
    const val = sheet.getCell(startRow + 1, c);
    val.value = item.unit ? `${item.value ?? "—"}  ${item.unit}` : (item.value ?? "—");
    val.font = { name: FONT, size: 15, bold: true, color: { argb: THEME.brand } };
    val.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    val.fill = fill("FFFFFF");
    val.border = { bottom: thin(THEME.border), left: thin(THEME.border), right: thin(THEME.border) };
  });
  sheet.getRow(startRow).height = 16;
  sheet.getRow(startRow + 1).height = 20;
  return startRow + 4;
}

/** Section label bar. Returns next free row. */
export function addSectionBar(sheet: Worksheet, startRow: number, text: string, span: number): number {
  const cols = Math.max(span, 3);
  sheet.mergeCells(startRow, 1, startRow, cols);
  const cell = sheet.getCell(startRow, 1);
  cell.value = text;
  cell.font = { name: FONT, size: 10.5, bold: true, color: { argb: THEME.brandDark } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cell.fill = fill(THEME.brandSoft);
  sheet.getRow(startRow).height = 20;
  return startRow + 2;
}

/** A styled label/value(/source) table for facility-style key-value blocks. */
export function addKeyValueTable(
  sheet: Worksheet,
  startRow: number,
  rows: { label: string; value: CellValue; source?: string }[],
  withSource = true,
): number {
  const span = withSource ? 3 : 2;
  const header = withSource ? ["Trường", "Giá trị", "Nguồn dữ liệu"] : ["Trường", "Giá trị"];
  const headerRow = sheet.getRow(startRow);
  header.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: FONT, size: 9.5, bold: true, color: { argb: THEME.headerText } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.fill = fill(THEME.brand);
    cell.border = allBorders(THEME.border);
  });
  headerRow.height = 18;

  rows.forEach((r, i) => {
    const row = sheet.getRow(startRow + 1 + i);
    const cells: CellValue[] = withSource ? [r.label, r.value ?? "—", r.source ?? ""] : [r.label, r.value ?? "—"];
    cells.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v === "" ? null : v;
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
      cell.border = allBorders(THEME.border);
      if (i % 2 === 1) cell.fill = fill(THEME.zebra);
      if (ci === 0) cell.font = { name: FONT, size: 9.5, color: { argb: THEME.muted } };
      else if (ci === 1) cell.font = { name: FONT, size: 10, bold: true, color: { argb: THEME.ink } };
      else cell.font = { name: FONT, size: 8, color: { argb: THEME.muted } };
    });
  });

  void span;
  return startRow + rows.length + 2;
}

/** The workhorse: a fully styled data table (header, zebra, borders, number formats,
 *  autofilter, frozen header, optional totals row). Returns next free row. */
export function addDataTable<T>(
  sheet: Worksheet,
  opts: {
    startRow: number;
    columns: TemplateColumn<T>[];
    rows: T[];
    emptyText?: string;
    totalsLabel?: string;
  },
): number {
  const { startRow, columns, rows } = opts;
  const nCols = columns.length;

  // Header
  const header = sheet.getRow(startRow);
  columns.forEach((col, i) => {
    const cell = header.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: THEME.headerText } };
    cell.alignment = { vertical: "middle", horizontal: col.align ?? "left", wrapText: true, indent: col.align === "right" ? 0 : 1 };
    cell.fill = fill(THEME.brand);
    cell.border = allBorders(THEME.border);
  });
  header.height = 26;

  if (rows.length === 0) {
    sheet.mergeCells(startRow + 1, 1, startRow + 1, nCols);
    const cell = sheet.getCell(startRow + 1, 1);
    cell.value = opts.emptyText ?? "Chưa có dữ liệu.";
    cell.font = { name: FONT, size: 9.5, italic: true, color: { argb: THEME.muted } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = allBorders(THEME.border);
    return startRow + 3;
  }

  // Body
  rows.forEach((dataRow, ri) => {
    const row = sheet.getRow(startRow + 1 + ri);
    columns.forEach((col, ci) => {
      const cell = row.getCell(ci + 1);
      const v = col.value(dataRow);
      cell.value = v === undefined || v === null || v === "" ? null : v;
      cell.alignment = { vertical: "middle", horizontal: col.align ?? "left", indent: col.align === "right" ? 0 : 1, wrapText: true };
      cell.font = { name: FONT, size: 9, color: { argb: THEME.ink } };
      cell.border = allBorders(THEME.border);
      if (ri % 2 === 1) cell.fill = fill(THEME.zebra);
      if (col.numFmt && typeof cell.value === "number") cell.numFmt = col.numFmt;
    });
  });

  let lastRow = startRow + rows.length;

  // Totals row
  if (opts.totalsLabel && columns.some((c) => c.total)) {
    const totalRow = sheet.getRow(lastRow + 1);
    columns.forEach((col, ci) => {
      const cell = totalRow.getCell(ci + 1);
      if (ci === 0) {
        cell.value = opts.totalsLabel;
      } else if (col.total) {
        const sum = rows.reduce((acc, r) => {
          const v = col.value(r);
          return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
        }, 0);
        cell.value = sum;
        if (col.numFmt) cell.numFmt = col.numFmt;
      }
      cell.font = { name: FONT, size: 9, bold: true, color: { argb: THEME.brandDark } };
      cell.alignment = { vertical: "middle", horizontal: col.align ?? "left", indent: col.align === "right" ? 0 : 1 };
      cell.fill = fill(THEME.brandSoft);
      cell.border = allBorders(THEME.border);
    });
    lastRow += 1;
  }

  // Column widths (explicit or auto from content), autofilter + frozen header.
  columns.forEach((col, i) => {
    const column = sheet.getColumn(i + 1);
    if (col.width) {
      column.width = col.width;
    } else {
      let w = Math.max(col.header.length + 4, 10);
      rows.forEach((r) => {
        const v = col.value(r);
        w = Math.max(w, Math.min(String(v ?? "").length + 2, 44));
      });
      column.width = w;
    }
  });

  sheet.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow, column: nCols } };
  sheet.views = [{ showGridLines: false, state: "frozen", ySplit: startRow, xSplit: 0 }];

  return lastRow + 2;
}

export function styleAsFootnote(row: Row) {
  row.eachCell((cell) => {
    cell.font = { name: FONT, size: 8, italic: true, color: { argb: THEME.muted } };
    cell.alignment = { vertical: "top", wrapText: true };
  });
}

/** Trigger a browser download of the workbook. */
export async function downloadWorkbook(wb: Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
