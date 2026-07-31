import { describe, it, expect } from "vitest";
import { buildSingleDatasetWorkbook } from "@/lib/reportsApi";
import { THEME } from "@/lib/reports/excelTheme";

describe("buildSingleDatasetWorkbook", () => {
  const columns = ["sku", "name", "total_co2e", "created_at"];
  const rows = [
    { sku: "A-1", name: "Áo thun", total_co2e: 12.4, created_at: "2026-04-15" },
    { sku: "A-2", name: "Quần jeans", total_co2e: 8.9, created_at: "2026-04-20" },
  ];

  it("builds the overview/summary/dictionary/data sheets", async () => {
    const { buffer } = await buildSingleDatasetWorkbook("products", columns, rows, { locale: "vi-VN" });
    expect(buffer.byteLength).toBeGreaterThan(4000);
  });

  it("renders the title in the shared brand colour (unified with the engine)", async () => {
    const ExcelJS = await import("exceljs");
    const { buffer } = await buildSingleDatasetWorkbook("products", columns, rows, {});
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as ArrayBuffer);
    const overview = wb.worksheets[0];
    const title = overview.getCell(1, 1);
    const fill = title.fill as { fgColor?: { argb?: string } };
    // ExcelJS normalises argb to 8-hex (FF-prefixed) on reload.
    expect(fill.fgColor?.argb).toContain(THEME.brand);
  });
});
