import { describe, it, expect } from "vitest";
import { buildProductCarbonWorkbook, type ProductCarbonReportInput } from "./productCarbonTemplate";
import { THEME } from "./excelTheme";

const sample: ProductCarbonReportInput = {
  product: {
    id: "p-1",
    productCode: "SKU-AT-001",
    productName: "Áo thun cổ tròn Cotton",
    productType: "Dệt may",
    status: "published",
    weightPerUnitG: 180,
    destinationMarket: "EU",
  },
  totalCo2ePerUnit: 12.4,
  confidenceLevel: "medium",
  confidenceScore: 82,
  estimatedDistanceKm: 10800,
  quantity: 5000,
  generatedAt: new Date("2026-07-31T00:00:00Z"),
  carbonAuthority: {
    authoritative: true,
    source: "product_assessment_snapshot",
    calculationId: "22222222-2222-4222-8222-222222222222",
    calculationVersion: 7,
    calculatedAt: "2026-07-31T00:00:00Z"
  },
  breakdown: [
    { stage: "Nguyên liệu", label: "Cotton", co2e: 6.2, percentage: 50, hasData: true, isProxy: false, note: "" },
    { stage: "Khuyết dữ liệu", label: "Phụ liệu", co2e: 1.9, percentage: 15, hasData: false, isProxy: true, note: "Dùng hệ số mặc định" },
  ],
  materials: [
    { material: "Cotton 100%", percentage: 60, emissionFactor: 5.9, co2e: 6.2, source: "BOM", factorSource: "Higg MSI" },
  ],
  compliance: [
    { criterion: "Có hệ số CO₂e", status: "Đạt", note: "" },
    { criterion: "Chứng từ xác minh", status: "Thiếu", note: "Cần bổ sung" },
  ],
};

describe("buildProductCarbonWorkbook", () => {
  it("produces the 4 product-carbon sheets", async () => {
    const wb = await buildProductCarbonWorkbook(sample);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Tổng quan", "Bóc tách", "Vật liệu", "Tuân thủ"]);
  });

  it("styles the breakdown table and computes per-batch CO2e", async () => {
    const wb = await buildProductCarbonWorkbook(sample);
    const s = wb.getWorksheet("Bóc tách")!;
    const header = s.getRow(5).getCell(1);
    expect(String(header.value)).toBe("Giai đoạn");
    const fill = header.fill as { fgColor?: { argb?: string } };
    expect(fill.fgColor?.argb).toBe(THEME.brand);
    // CO2e/batch = 6.2 * 5000 on the first data row (col 4).
    expect(s.getRow(6).getCell(4).value).toBeCloseTo(31000, 5);
  });

  it("writes a valid xlsx buffer", async () => {
    const wb = await buildProductCarbonWorkbook(sample);
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(4000);
    expect(Buffer.from(buf.slice(0, 2)).toString("latin1")).toBe("PK");
  });

  it("embeds the server calculation identity", async () => {
    const wb = await buildProductCarbonWorkbook(sample);
    const values = wb.worksheets[0].getSheetValues().flat(2).map(String);
    expect(values).toContain("22222222-2222-4222-8222-222222222222");
    expect(values).toContain("7");
  });
});
