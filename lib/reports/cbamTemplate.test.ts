import { describe, it, expect } from "vitest";
import { buildCbamWorkbook, type CbamReportData } from "./cbamTemplate";
import { THEME } from "./excelTheme";

const sample: CbamReportData = {
  company: {
    name: "Công ty Dệt May Cường Thịnh",
    business_type: "manufacturer",
    address: "KCN Sóng Thần, Bình Dương",
    tax_id: "3700123456",
    target_markets: ["EU", "Hoa Kỳ"],
  },
  reportingPeriod: "2024 Q2",
  periodStart: "2024-04-01",
  periodEnd: "2024-06-30",
  electricity: [
    { billing_period: "2024-Q2", facility_name: "Nhà máy Bình Dương", kwh: 12500, emission_factor_kg_per_kwh: 0.429, emission_factor_source: "Bộ TN&MT VN 2024", scope2_co2e_kg: 5362.5, status: "verified" },
    { billing_period: "2024-Q3", facility_name: "Nhà máy Bình Dương", kwh: 11800, emission_factor_kg_per_kwh: 0.429, emission_factor_source: "Bộ TN&MT VN 2024", scope2_co2e_kg: 5062.2, status: "verified" },
  ],
  fuels: [
    { billing_period: "2024-Q2", fuel_type: "diesel", quantity_liters: 500, emission_factor_kg_per_liter: 2.688, scope1_co2e_kg: 1344, status: "verified" },
  ],
  productSummary: [
    { sku: "SKU-AT-001", name: "Áo thun cổ tròn Cotton", weight: 0.18, materials: ["Cotton"], direct: 3.1, indirect: 9.3, total: 12.4, embeddedPerTonne: 17.2, proxyPct: 18, confidence: 82, hasCalc: true },
    { sku: "SKU-VS-003", name: "Váy sơ mi lụa tơ tằm", weight: 0.24, materials: ["Lụa"], direct: 1.5, indirect: 3.8, total: 5.3, embeddedPerTonne: null, proxyPct: 60, confidence: 45, hasCalc: false },
  ],
  totals: { scope1: 1344, scope2: 10424.7, scope3: 13100, total: 24868.7, totalKwh: 24300 },
  checks: {
    items: [
      { ok: true, label: "Tên doanh nghiệp" },
      { ok: false, label: "Hóa đơn nhiên liệu (Scope 1)" },
    ],
    score: 1,
    total: 2,
    pct: 50,
  },
  evidenceCount: 4,
};

describe("buildCbamWorkbook", () => {
  it("produces the 6 CBAM sheets", async () => {
    const wb = await buildCbamWorkbook(sample);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Tổng quan",
      "A. Cơ sở",
      "B. Điện (Scope 2)",
      "C. Nhiên liệu (Scope 1)",
      "D. Sản phẩm (Embedded)",
      "E. Tổng hợp",
    ]);
  });

  it("fills electricity rows with a styled, branded header", async () => {
    const wb = await buildCbamWorkbook(sample);
    const elec = wb.getWorksheet("B. Điện (Scope 2)")!;

    // The title block occupies rows 1-3; the data table header is at row 5.
    const header = elec.getRow(5).getCell(1);
    expect(String(header.value)).toBe("Kỳ");
    const fill = header.fill as { fgColor?: { argb?: string } };
    expect(fill.fgColor?.argb).toBe(THEME.brand);

    // First data row carries the real kWh value as a number.
    const kwhCell = elec.getRow(6).getCell(3);
    expect(kwhCell.value).toBe(12500);

    // A totals row sums CO2e.
    const values = elec.getSheetValues() as unknown[][];
    const hasTotals = values.some((row) => Array.isArray(row) && row.includes("Tổng"));
    expect(hasTotals).toBe(true);
  });

  it("writes a valid non-trivial xlsx buffer", async () => {
    const wb = await buildCbamWorkbook(sample);
    const buf = await wb.xlsx.writeBuffer();
    // xlsx is a zip: starts with PK, and a styled 6-sheet book is clearly > 5KB.
    expect(buf.byteLength).toBeGreaterThan(5000);
    const head = Buffer.from(buf.slice(0, 2)).toString("latin1");
    expect(head).toBe("PK");
  });
});
