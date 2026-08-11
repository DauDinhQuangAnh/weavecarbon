/**
 * Styled "fill-in" Excel templates (blank forms users complete and re-upload),
 * built on the excelTheme engine. Replaces raw SheetJS (aoa_to_sheet) templates
 * for evidence and product bulk-import.
 */
import type { Workbook, Worksheet } from "exceljs";
import { THEME, SIZE, newBrandedWorkbook, addWorksheet, downloadWorkbook } from "./excelTheme";

const FONT = "Calibri";
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const thin = (argb: string) => ({ style: "thin" as const, color: { argb } });
const borders = (argb: string) => ({ top: thin(argb), left: thin(argb), bottom: thin(argb), right: thin(argb) });

export interface FormColumn {
  header: string;
  width?: number;
}

export interface FormSheetSpec {
  name: string;
  title: string;
  subtitle?: string;
  columns: FormColumn[];
  sampleRows: (string | number)[][];
  notes?: string[]; // muted guidance lines shown under the sample rows
}

export interface InfoSheetSpec {
  name: string;
  title: string;
  rows: Array<string | [string, string]>;
}

function titleBar(sheet: Worksheet, title: string, subtitle: string | undefined, span: number): number {
  const cols = Math.max(span, 2);
  sheet.mergeCells(1, 1, 1, cols);
  const brand = sheet.getCell(1, 1);
  brand.value = "WeaveCarbon · File mẫu";
  brand.font = { name: FONT, size: SIZE.brandBar, bold: true, color: { argb: "FFFFFF" } };
  brand.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  brand.fill = fill(THEME.brand);
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, cols);
  const t = sheet.getCell(2, 1);
  t.value = title;
  t.font = { name: FONT, size: SIZE.title, bold: true, color: { argb: THEME.ink } };
  sheet.getRow(2).height = 34;

  sheet.mergeCells(3, 1, 3, cols);
  const s = sheet.getCell(3, 1);
  s.value = subtitle
    ? `${subtitle}  ·  Dòng ví dụ (nền nhạt) — xoá và thay bằng dữ liệu thật. Ô có * là bắt buộc.`
    : "Dòng ví dụ (nền nhạt) — xoá và thay bằng dữ liệu thật. Ô có * là bắt buộc.";
  s.font = { name: FONT, size: SIZE.subtitle, italic: true, color: { argb: THEME.muted } };
  s.alignment = { vertical: "top", wrapText: true };
  sheet.getRow(3).height = 34;
  return 5;
}

function addFormSheet(wb: Workbook, spec: FormSheetSpec): void {
  const sheet = addWorksheet(wb, spec.name);
  const startRow = titleBar(sheet, spec.title, spec.subtitle, spec.columns.length);

  const header = sheet.getRow(startRow);
  spec.columns.forEach((col, i) => {
    const cell = header.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: FONT, size: SIZE.tableHeader, bold: true, color: { argb: "FFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    cell.fill = fill(THEME.brand);
    cell.border = borders(THEME.border);
    if (col.width) sheet.getColumn(i + 1).width = Math.ceil(col.width * 1.2);
  });
  header.height = 34;

  spec.sampleRows.forEach((row, ri) => {
    const r = sheet.getRow(startRow + 1 + ri);
    spec.columns.forEach((_, ci) => {
      const cell = r.getCell(ci + 1);
      cell.value = row[ci] === undefined || row[ci] === "" ? null : row[ci];
      cell.font = { name: FONT, size: SIZE.tableBody, italic: true, color: { argb: THEME.muted } };
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
      cell.fill = fill(THEME.zebra);
      cell.border = borders(THEME.border);
    });
  });

  // Freeze the header row; enable autofilter across the header.
  sheet.views = [{ state: "frozen", ySplit: startRow, xSplit: 0, showGridLines: false }];
  sheet.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow, column: spec.columns.length } };

  if (spec.notes && spec.notes.length > 0) {
    let noteRow = startRow + 1 + spec.sampleRows.length + 1;
    spec.notes.forEach((note) => {
      sheet.mergeCells(noteRow, 1, noteRow, Math.min(spec.columns.length, 8) || 1);
      const cell = sheet.getCell(noteRow, 1);
      cell.value = note;
      cell.font = { name: FONT, size: SIZE.footnote, italic: true, color: { argb: THEME.muted } };
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      noteRow += 1;
    });
  }
}

function addInfoSheet(wb: Workbook, spec: InfoSheetSpec): void {
  const sheet = addWorksheet(wb, spec.name);
  titleBar(sheet, spec.title, undefined, 2);
  let r = 5;
  spec.rows.forEach((row) => {
    if (Array.isArray(row)) {
      const a = sheet.getCell(r, 1);
      a.value = row[0];
      a.font = { name: FONT, size: SIZE.tableBody, bold: true, color: { argb: THEME.brandDark } };
      a.alignment = { vertical: "top", wrapText: true };
      const b = sheet.getCell(r, 2);
      b.value = row[1];
      b.font = { name: FONT, size: SIZE.tableBody, color: { argb: THEME.ink } };
      b.alignment = { vertical: "top", wrapText: true };
      if (r % 2 === 1) {
        a.fill = fill(THEME.zebra);
        b.fill = fill(THEME.zebra);
      }
    } else {
      sheet.mergeCells(r, 1, r, 2);
      const cell = sheet.getCell(r, 1);
      cell.value = row;
      cell.font = { name: FONT, size: SIZE.tableBody, color: { argb: THEME.ink } };
      cell.alignment = { vertical: "top", wrapText: true };
    }
    r += 1;
  });
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 92;
}

export async function buildFormWorkbook(spec: { sheets: FormSheetSpec[]; info?: InfoSheetSpec[] }): Promise<Workbook> {
  const wb = await newBrandedWorkbook();
  spec.sheets.forEach((s) => addFormSheet(wb, s));
  (spec.info ?? []).forEach((i) => addInfoSheet(wb, i));
  return wb;
}

export async function downloadFormTemplate(spec: { sheets: FormSheetSpec[]; info?: InfoSheetSpec[] }, fileName: string): Promise<void> {
  const wb = await buildFormWorkbook(spec);
  await downloadWorkbook(wb, fileName);
}
