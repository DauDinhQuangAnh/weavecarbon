import type { Workbook } from "exceljs";

export async function createWorkbook(): Promise<Workbook> {
  // Reports use in-memory workbooks. The browser entry also keeps Node-only
  // streaming/ZIP/S3 modules out of the client-component SSR dependency graph.
  const { default: ExcelJS } = await import("exceljs/dist/exceljs.min.js");
  return new ExcelJS.Workbook();
}
