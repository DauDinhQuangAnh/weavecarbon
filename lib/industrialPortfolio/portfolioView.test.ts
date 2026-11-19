import { describe, expect, it } from "vitest";
import type { CorporateGhgInventory } from "@/lib/weave-v2/corporateGhgInventoryApi";
import type { IndustrialActivity, IndustrialFacility } from "@/lib/industrialCoreApi";
import type { EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import type { ProductRecord } from "@/lib/products/types";
import { getIndustrialPortfolio } from "./dataset";
import { getIndustrialReporting } from "./reporting";
import { buildDemoPortfolioView, buildRealPortfolioView, latestInventories } from "./portfolioView";

const SHA = "a".repeat(64);
const inventory = (over: Partial<CorporateGhgInventory> & { rows?: Array<Record<string, unknown>> } = {}): CorporateGhgInventory => {
  const { rows, ...rest } = over;
  return {
    id: "inv-1", inventoryReference: "INV-2026", revision: 1, rulesetId: "ghg", rulesetVersion: "1.4", rulesetCoverage: "limited",
    sourceManifestSha256: SHA, inventoryDate: "2026-07-01", reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-06-30",
    input: {} as CorporateGhgInventory["input"], inputSha256: SHA,
    activitySnapshot: rows ?? [
      { scope: "scope1", facilityReference: "F1", category: "Đốt nhiên liệu", calculatedCo2eKg: 6000 },
      { scope: "scope2", facilityReference: "F1", category: "Điện mua", accountingMethod: "location_based", calculatedCo2eKg: 3000 },
      { scope: "scope2", facilityReference: "F1", category: "Điện mua", accountingMethod: "market_based", calculatedCo2eKg: 2500 },
      { scope: "scope1", facilityReference: "F2", category: "Quá trình", calculatedCo2eKg: 1000 },
    ],
    activitySnapshotSha256: SHA,
    result: {
      automatedStatus: "inventory_review_required", missingInputs: [],
      findings: [{ code: "W1", severity: "warning", message: "Thiếu đánh giá bất định", path: null }, { code: "B1", severity: "blocker", message: "Thiếu ranh giới", path: null }],
      sources: [], totals: { scope1KgCo2e: 7000, scope2LocationBasedKgCo2e: 3000, scope2MarketBasedKgCo2e: 2500, scope3KgCo2e: null,
        biogenicCo2Kg: 0, removalsCo2Kg: 0, offsetsRetiredKgCo2e: 0, grossScope1AndLocationScope2KgCo2e: 10000 },
      activitySourceCount: 4, evidenceCount: 0, inventoryScopeLabel: "", assuranceStatus: "", disclaimer: "", resultSha256: SHA,
    },
    resultSha256: SHA, automatedStatus: "inventory_review_required", inventoryStatus: "inventory_review_required",
    staleEvidenceIds: [], latestReview: null, createdAt: "2026-07-01T00:00:00Z",
    ...rest,
  };
};
const facility = (ref: string, name: string, metadata: Record<string, unknown> = {}): IndustrialFacility => ({
  id: ref, facilityReference: ref, revision: 1, name, countryCode: "VN", timezone: "Asia/Ho_Chi_Minh", lifecycleStatus: "active",
  boundaryNotes: null, metadata, createdAt: "2026-01-01T00:00:00Z",
});
const product = (over: Partial<ProductRecord>): ProductRecord => ({
  id: "p1", productCode: "SKU-1", productName: "Thép cuộn", productType: "steel", productCategory: "steel",
  destinationMarket: "EU", cnCode: "7208", status: "published", createdAt: "2026-01-01", updatedAt: "2026-02-01",
  ...over,
} as ProductRecord);
const evidence = (over: Partial<EvidenceDocumentV2>): EvidenceDocumentV2 => ({
  id: "e1", companyId: "c", evidenceType: "electricity_bill", documentName: "Hoá đơn điện 06/2026", fileSizeBytes: 1,
  extractedJson: {}, status: "locked", checksumSha256: SHA, createdAt: "2026-07-02", updatedAt: "2026-07-02", ...over,
});
const empty = { inventories: [], facilities: [], activities: [], evidence: [], products: [], factors: [] };

describe("portfolio view", () => {
  it("demo view keeps the seeded demo figures", () => {
    const view = buildDemoPortfolioView();
    const core = getIndustrialPortfolio();
    expect(view.mode).toBe("demo");
    expect(view.totalTonnes).toBe(core.emissionsSummary.totalTonnes);
    expect(view.coverage.value).toBe(core.facilities.length);
    expect(view.products).toHaveLength(getIndustrialReporting().products.length);
    expect(view.cadence.series.map((s) => s.key)).toContain("Steel");
  });

  it("real view with no data stays empty and never shows demo rows", () => {
    const view = buildRealPortfolioView(empty);
    expect(view.mode).toBe("real");
    expect(view.hasInventory).toBe(false);
    expect(view.totalTonnes).toBe(0);
    expect(view.products).toEqual([]);
    expect(view.evidence).toEqual([]);
    expect(view.hotspots).toEqual([]);
    expect(view.cadence.rows).toEqual([]);
  });

  it("real view uses engine totals and location-based scope 2 only", () => {
    const view = buildRealPortfolioView({ ...empty, inventories: [inventory()], facilities: [facility("F1", "Nhà máy A"), facility("F2", "Nhà máy B")] });
    expect(view.totalTonnes).toBe(10);
    expect(view.emissionsMonthly).toEqual([{ period: "06/2026", scope1: 7, scope2: 3, scope3: 0 }]);
    expect(view.emissionsQuarterly[0].period).toBe("Q2 2026");
    expect(view.emissionsBySource[0]).toEqual({ source: "Đốt nhiên liệu", pct: 60 });
    expect(view.emissionsBySource.reduce((s, r) => s + r.pct, 0)).toBeCloseTo(100, 5);
    expect(view.hotspots[0]).toMatchObject({ entity: "Đốt nhiên liệu", facility: "Nhà máy A", tonnes: 6, pct: 60 });
    expect(view.cadence.series.map((s) => s.label)).toEqual(["Nhà máy A", "Nhà máy B"]);
    expect(view.cadence.rows[0]).toMatchObject({ F1: 9, F2: 1 });
    expect(view.engineVersion).toBe("1.4");
    expect(view.coverage.label).toBe("Cơ sở đang theo dõi");
    expect(view.alerts[0]).toMatchObject({ severity: "critical", text: "Thiếu ranh giới" });
  });

  it("keeps only the latest non-superseded revision of each inventory", () => {
    const rows = latestInventories([
      inventory({ id: "a", revision: 1 }),
      inventory({ id: "b", revision: 2 }),
      inventory({ id: "c", revision: 3, inventoryStatus: "superseded" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("maps products, markets, report targets and evidence counts", () => {
    const view = buildRealPortfolioView({
      ...empty,
      facilities: [facility("F1", "A", { industry: "Steel" })],
      products: [product({}), product({ id: "p2", productCode: "SKU-2", productName: "Xi măng", destinationMarket: "Việt Nam", cnCode: undefined, updatedAt: "2026-01-15" })],
      evidence: [evidence({ productId: "p1" }), evidence({ id: "e2", productId: "p1", checksumSha256: null, status: "uploaded" })],
    });
    expect(view.coverage).toMatchObject({ value: 1, label: "Độ phủ ngành" });
    expect(view.exportProducts).toBe(1);
    expect(view.domesticProducts).toBe(1);
    expect(view.products[0]).toMatchObject({ id: "p1", marketScope: "export", evidenceCount: 2 });
    expect(view.products[0].reportTargets).toEqual(expect.arrayContaining(["EU ESPR · DPP", "EU CBAM (sàng lọc)"]));
    expect(view.products[1].reportTargets).toContain("Kiểm kê KNK Việt Nam");
    expect(view.avgEvidence).toBe(1);
    expect(view.evidence[0]).toMatchObject({ fileName: "Hoá đơn điện 06/2026", linkedActivity: "Thép cuộn" });
    expect(view.alerts[0]).toMatchObject({ severity: "critical", text: "Chứng từ thiếu checksum SHA-256 hợp lệ" });
  });

  it("flags low-quality activity data", () => {
    const activity = { id: "a1", activityReference: "ELEC-06", dataQualityLevel: "L1" } as IndustrialActivity;
    const view = buildRealPortfolioView({ ...empty, activities: [activity] });
    expect(view.alerts).toEqual([expect.objectContaining({ severity: "warning", entity: "ELEC-06" })]);
  });
});
