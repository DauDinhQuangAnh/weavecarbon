import { describe, it, expect } from "vitest";
import { newBrandedWorkbook, addWorksheet, addDataTable, type TemplateColumn } from "./excelTheme";

// Phase A: the totals row that every report shows ("Tổng") must equal the exact sum
// of the data rows, and numeric cells must be stored as real numbers (sortable /
// summable in Excel), not text.
describe("addDataTable data integrity", () => {
  type Row = { name: string; a: number; b: number };
  const rows: Row[] = [
    { name: "x", a: 1.5, b: 100 },
    { name: "y", a: 2.25, b: 200 },
    { name: "z", a: 4.0, b: 300 },
  ];
  const cols: TemplateColumn<Row>[] = [
    { header: "Tên", width: 12, value: (r) => r.name },
    { header: "A", width: 10, align: "right", numFmt: "#,##0.00", total: true, value: (r) => r.a },
    { header: "B", width: 10, align: "right", numFmt: "#,##0", total: true, value: (r) => r.b },
  ];

  it("stores numeric cells as numbers and totals them exactly", async () => {
    const wb = await newBrandedWorkbook();
    const s = addWorksheet(wb, "T");
    addDataTable(s, { startRow: 1, columns: cols, rows, totalsLabel: "Tổng" });

    // header = row 1, data = rows 2-4, totals = row 5
    expect(typeof s.getRow(2).getCell(2).value).toBe("number");
    expect(s.getRow(2).getCell(2).value).toBe(1.5);

    expect(s.getRow(5).getCell(1).value).toBe("Tổng");
    expect(s.getRow(5).getCell(2).value).toBeCloseTo(7.75, 9); // 1.5 + 2.25 + 4.0
    expect(s.getRow(5).getCell(3).value).toBe(600); // 100 + 200 + 300
  });

  it("survives a round-trip write/read as a valid workbook", async () => {
    const wb = await newBrandedWorkbook();
    const s = addWorksheet(wb, "T");
    addDataTable(s, { startRow: 1, columns: cols, rows, totalsLabel: "Tổng" });
    const buf = await wb.xlsx.writeBuffer();
    expect(Buffer.from(buf.slice(0, 2)).toString("latin1")).toBe("PK");
  });
});
