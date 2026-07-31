// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildCbamWorkbook, type CbamReportData } from "./cbamTemplate";
import { buildProductCarbonWorkbook, type ProductCarbonReportInput } from "./productCarbonTemplate";
import { buildStandardReportWorkbook } from "./standardReportXlsx";
import { buildStandardReportPdfWithFonts } from "./standardReportPdf";
import { buildSingleDatasetWorkbook } from "@/lib/reportsApi";
import { buildReportPayloadV2, type ReportPayloadV2 } from "@/lib/weave-v2/reportBuilder";
import { sanitizeCsvValue } from "./csv";

const fonts = () => ({
  regular: readFileSync("public/fonts/BeVietnamPro-Regular.ttf").toString("base64"),
  bold: readFileSync("public/fonts/BeVietnamPro-Bold.ttf").toString("base64"),
});

const WEIRD = '=cmd()|"a",\n\t emoji 😀 — "trích dẫn" ' + "x".repeat(400);

describe("Phase E — empty / missing data", () => {
  it("CBAM builds all sheets with no data and null company", async () => {
    const empty: CbamReportData = {
      company: null,
      reportingPeriod: "2024 Q2",
      periodStart: "2024-04-01",
      periodEnd: "2024-06-30",
      electricity: [],
      fuels: [],
      productSummary: [],
      totals: { scope1: 0, scope2: 0, scope3: 0, total: 0, totalKwh: 0 },
      checks: { items: [], score: 0, total: 0, pct: 0 },
      evidenceCount: 0,
    };
    const wb = await buildCbamWorkbook(empty);
    expect(wb.worksheets).toHaveLength(6);
    expect((await wb.xlsx.writeBuffer()).byteLength).toBeGreaterThan(3000);
  });

  it("Product carbon builds with empty arrays and quantity 0", async () => {
    const empty: ProductCarbonReportInput = {
      product: {},
      totalCo2ePerUnit: 0,
      confidenceLevel: "low",
      confidenceScore: 0,
      estimatedDistanceKm: 0,
      quantity: 0,
      generatedAt: new Date("2026-07-31T00:00:00Z"),
      breakdown: [],
      materials: [],
      compliance: [],
    };
    const wb = await buildProductCarbonWorkbook(empty);
    expect(wb.worksheets).toHaveLength(4);
  });

  it("Passport XLSX + PDF build from a sparse payload", async () => {
    const base = buildReportPayloadV2();
    const sparse: ReportPayloadV2 = { ...base, breakdownRows: [], esgRows: [], cbamRows: [], evidence: [] as ReportPayloadV2["evidence"] };
    const wb = await buildStandardReportWorkbook(sparse);
    expect(wb.worksheets).toHaveLength(6);
    const doc = await buildStandardReportPdfWithFonts(sparse, fonts());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});

describe("Phase E — large datasets", () => {
  it("full report handles 2000 rows without error", async () => {
    const columns = ["sku", "name", "total_co2e", "created_at"];
    const rows = Array.from({ length: 2000 }, (_, i) => ({
      sku: `SKU-${i}`,
      name: `Sản phẩm ${i}`,
      total_co2e: Math.round(Math.random() * 10000) / 100,
      created_at: "2026-04-15",
    }));
    const { buffer } = await buildSingleDatasetWorkbook("products", columns, rows, { locale: "vi-VN" });
    expect(buffer.byteLength).toBeGreaterThan(10000);
  });

  it("passport PDF paginates a long breakdown across multiple pages", async () => {
    const base = buildReportPayloadV2();
    const many = Array.from({ length: 120 }, (_, i) => ({
      ...base.breakdownRows[0],
      stage: `Giai đoạn ${i}`,
      activity: `Hoạt động ${i} ${"chi tiết ".repeat(3)}`,
    }));
    const doc = await buildStandardReportPdfWithFonts({ ...base, breakdownRows: many }, fonts());
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});

describe("Phase E — special characters & extreme numbers", () => {
  it("CBAM survives weird text, emoji and extreme numbers", async () => {
    const data: CbamReportData = {
      company: { name: WEIRD, business_type: "😀", address: WEIRD, tax_id: "=1+1", target_markets: ["EU"] },
      reportingPeriod: "2024 Q2",
      periodStart: "2024-04-01",
      periodEnd: "2024-06-30",
      electricity: [{ billing_period: "2024-Q2", facility_name: WEIRD, kwh: 1e12, emission_factor_kg_per_kwh: 1e-9, emission_factor_source: WEIRD, scope2_co2e_kg: -5.5, status: "verified" }],
      fuels: [],
      productSummary: [{ sku: "😀", name: WEIRD, weight: 0, materials: [WEIRD], direct: 0, indirect: 0, total: 0, embeddedPerTonne: null, proxyPct: 0, confidence: 0, hasCalc: false }],
      totals: { scope1: -1, scope2: 1e15, scope3: 0, total: 1e15, totalKwh: 1e12 },
      checks: { items: [{ ok: false, label: WEIRD }], score: 0, total: 1, pct: 0 },
      evidenceCount: 0,
    };
    const wb = await buildCbamWorkbook(data);
    expect((await wb.xlsx.writeBuffer()).byteLength).toBeGreaterThan(3000);
  });

  it("csv defence neutralises the weird string but keeps its content", () => {
    const out = sanitizeCsvValue(WEIRD);
    expect(out.startsWith("'")).toBe(true); // starts with '=', so escaped
    expect(out).toContain("😀");
  });
});
