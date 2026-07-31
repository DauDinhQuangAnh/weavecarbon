/**
 * CSV formula-injection defence + field escaping, shared by every CSV export.
 *
 * Excel / Google Sheets execute a cell as a formula when its text starts with
 * `= + - @` (or a leading tab / carriage return). Since report cells contain
 * user-supplied data (product names, notes, addresses, filenames…), those values
 * are neutralised with a leading apostrophe — EXCEPT plain numbers, so legitimate
 * negative values (e.g. -5.2) are preserved.
 */

const NUMBER_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const DANGEROUS_RE = /^[=+\-@\t\r]/;

/** Neutralise a value that a spreadsheet might interpret as a formula. */
export const sanitizeCsvValue = (value: unknown): string => {
  const text = String(value ?? "");
  if (text === "") return "";
  if (DANGEROUS_RE.test(text) && !NUMBER_RE.test(text.trim())) {
    return `'${text}`;
  }
  return text;
};

/** Sanitise + quote a single CSV field (handles commas, quotes, newlines). */
export const csvField = (value: unknown): string => {
  const text = sanitizeCsvValue(value).replace(/\r?\n/g, " ");
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Build a full CSV string (with UTF-8 BOM) from headers + row objects. */
export const toCsv = (columns: string[], rows: Array<Record<string, unknown>>): string => {
  const lines = [
    columns.map(csvField).join(","),
    ...rows.map((row) => columns.map((column) => csvField(row[column])).join(",")),
  ];
  return "﻿" + lines.join("\n");
};
