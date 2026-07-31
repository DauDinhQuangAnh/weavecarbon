import { describe, it, expect } from "vitest";
import type { Workbook, Worksheet } from "exceljs";
import { buildCbamWorkbook, type CbamReportData } from "./cbamTemplate";
import { buildProductCarbonWorkbook, type ProductCarbonReportInput } from "./productCarbonTemplate";
import { buildStandardReportWorkbook } from "./standardReportXlsx";
import { buildSingleDatasetWorkbook } from "@/lib/reportsApi";
import { buildReportPayloadV2 } from "@/lib/weave-v2/reportBuilder";

// ── helpers ────────────────────────────────────────────────────────────────
const names = (wb: Workbook) => wb.worksheets.map((w) => w.name);

const findHeaderRow = (s: Worksheet, firstHeader: string): number => {
  for (let r = 1; r <= 20; r++) {
    if (String(s.getCell(r, 1).value ?? "") === firstHeader) return r;
  }
  return -1;
};

const headerAt = (s: Worksheet, row: number, count: number): string[] =>
  Array.from({ length: count }, (_, i) => String(s.getCell(row, i + 1).value ?? ""));

const headerFrom = (s: Worksheet, firstHeader: string, count: number): string[] => {
  const r = findHeaderRow(s, firstHeader);
  return r === -1 ? [] : headerAt(s, r, count);
};

// ── fixtures ───────────────────────────────────────────────────────────────
const cbam: CbamReportData = {
  company: { name: "X", business_type: "m", address: "a", tax_id: "t", target_markets: ["EU"] },
  reportingPeriod: "2024 Q2",
  periodStart: "2024-04-01",
  periodEnd: "2024-06-30",
  electricity: [{ billing_period: "2024-Q2", facility_name: "NM", kwh: 12500, emission_factor_kg_per_kwh: 0.429, emission_factor_source: "src", scope2_co2e_kg: 5362.5, status: "verified" }],
  fuels: [{ billing_period: "2024-Q2", fuel_type: "diesel", quantity_liters: 500, emission_factor_kg_per_liter: 2.688, scope1_co2e_kg: 1344, status: "verified" }],
  productSummary: [{ sku: "S1", name: "P1", weight: 0.18, materials: ["Cotton"], direct: 3.1, indirect: 9.3, total: 12.4, embeddedPerTonne: 17.2, proxyPct: 18, confidence: 82, hasCalc: true }],
  totals: { scope1: 1344, scope2: 10424.7, scope3: 13100, total: 24868.7, totalKwh: 24300 },
  checks: { items: [{ ok: true, label: "L" }], score: 1, total: 1, pct: 100 },
  evidenceCount: 4,
};

const product: ProductCarbonReportInput = {
  product: { id: "p1", productCode: "SKU-1", productName: "Áo", productType: "T", status: "published", weightPerUnitG: 180, destinationMarket: "EU" },
  totalCo2ePerUnit: 12.4,
  confidenceLevel: "medium",
  confidenceScore: 82,
  estimatedDistanceKm: 10800,
  quantity: 5000,
  generatedAt: new Date("2026-07-31T00:00:00Z"),
  breakdown: [{ stage: "Nguyên liệu", label: "Cotton", co2e: 6.2, percentage: 50, hasData: true, isProxy: false, note: "" }],
  materials: [{ material: "Cotton", percentage: 60, emissionFactor: 5.9, co2e: 6.2, source: "BOM", factorSource: "Higg" }],
  compliance: [{ criterion: "X", status: "Đạt", note: "" }],
};

// ── golden template locks ────────────────────────────────────────────────────
describe("report template structure (golden)", () => {
  it("CBAM: sheet set + electricity header", async () => {
    const wb = await buildCbamWorkbook(cbam);
    expect(names(wb)).toEqual([
      "Tổng quan", "A. Cơ sở", "B. Điện (Scope 2)", "C. Nhiên liệu (Scope 1)", "D. Sản phẩm (Embedded)", "E. Tổng hợp",
    ]);
    const s = wb.getWorksheet("B. Điện (Scope 2)")!;
    expect(headerFrom(s, "Kỳ", 7)).toEqual(["Kỳ", "Cơ sở", "kWh", "EF (kg/kWh)", "Nguồn EF", "CO₂e (kg)", "Trạng thái"]);
    // kWh column is a real integer-formatted number
    const hr = findHeaderRow(s, "Kỳ");
    expect(s.getCell(hr + 1, 3).numFmt).toBe("#,##0");
    expect(typeof s.getCell(hr + 1, 3).value).toBe("number");
  });

  it("Product carbon: sheet set + breakdown header", async () => {
    const wb = await buildProductCarbonWorkbook(product);
    expect(names(wb)).toEqual(["Tổng quan", "Bóc tách", "Vật liệu", "Tuân thủ"]);
    const s = wb.getWorksheet("Bóc tách")!;
    expect(headerFrom(s, "Giai đoạn", 8)).toEqual([
      "Giai đoạn", "Hạng mục", "CO₂e/SP (kg)", "CO₂e/lô (kg)", "Tỷ trọng (%)", "Có dữ liệu", "Dùng proxy", "Ghi chú",
    ]);
  });

  it("Passport XLSX: sheet set + breakdown header", async () => {
    const wb = await buildStandardReportWorkbook(buildReportPayloadV2());
    expect(names(wb)).toEqual(["Tổng quan", "Cơ sở", "Chứng từ", "ISO 14067", "ESG", "CBAM EU"]);
    const s = wb.getWorksheet("Tổng quan")!;
    expect(headerFrom(s, "Giai đoạn", 7)).toEqual(["Giai đoạn", "Hoạt động", "Lượng", "ĐVT", "Nguồn", "kg CO₂e", "Công thức"]);
  });

  it("Full report (reportsApi): sheet set", async () => {
    const { buffer } = await buildSingleDatasetWorkbook("products", ["sku", "name", "total_co2e"], [{ sku: "A", name: "x", total_co2e: 1 }], {});
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as ArrayBuffer);
    expect(names(wb)).toEqual(["Overview", "Products Summary", "Products Dictionary", "Products Data"]);
  });
});
