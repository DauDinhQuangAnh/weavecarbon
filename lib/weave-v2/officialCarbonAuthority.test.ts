import { describe, expect, it } from "vitest";
import type { ProductRecord } from "@/lib/productsApi";
import {
  buildReportPayloadFromProductV2,
  getProductAuthoritativeCarbonV2,
  getProductEmbeddedBreakdownV2,
  productToDemoSkuV2
} from "./productReportAdapter";
import { buildAuditPackJsonV2, buildAuditPackPayloadV2, buildAuditRowsCsvV2 } from "./auditPackV2";

const product = {
  id: "11111111-1111-4111-8111-111111111111",
  productCode: "SKU-1",
  productName: "Authoritative Tee",
  productType: "tshirt",
  weightPerUnit: 200,
  quantity: 10,
  materials: [{ materialType: "cotton", percentage: 100 }],
  accessories: [],
  productionProcesses: [],
  energySources: [],
  transportLegs: [],
  carbonResults: {
    perProduct: {
      materials: 2.864,
      production: 1.591,
      energy: 0,
      transport: 0.106,
      packaging: 0.016,
      total: 4.577
    },
    totalBatch: {
      materials: 28.64,
      production: 15.91,
      energy: 0,
      transport: 1.06,
      packaging: 0.16,
      total: 45.77
    },
    confidenceLevel: "medium",
    confidenceScore: 77,
    proxyUsed: false,
    proxyNotes: [],
    scope1: 0.2,
    scope2: 1.391,
    scope3: 2.986
  },
  carbonAuthority: {
    authoritative: true,
    source: "product_assessment_snapshot",
    calculationId: "22222222-2222-4222-8222-222222222222",
    calculationVersion: 7,
    calculatedAt: "2026-08-31T00:00:00.000Z"
  },
  status: "published",
  version: 7,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z"
} as unknown as ProductRecord;

describe("official frontend carbon outputs", () => {
  it("uses one server total and calculation identity across report, export and audit", () => {
    const report = buildReportPayloadFromProductV2(product);
    const embedded = getProductEmbeddedBreakdownV2(product);
    const sku = productToDemoSkuV2(product);
    const authority = getProductAuthoritativeCarbonV2(product);
    const audit = buildAuditPackPayloadV2(sku, authority);
    const auditJson = buildAuditPackJsonV2(audit);
    const auditCsv = buildAuditRowsCsvV2(audit);

    expect(report.totals.pcfKgPerUnit).toBe(4.577);
    expect(embedded.embeddedKgPerUnit).toBe(4.577);
    expect(audit.totals.total).toBe(4.577);
    expect(auditJson.carbonResults?.perProduct.total).toBe(4.577);
    expect(report.carbonAuthority).toEqual(embedded.carbonAuthority);
    expect(report.carbonAuthority).toEqual(audit.carbonAuthority);
    expect(auditCsv).toContain("22222222-2222-4222-8222-222222222222");
    expect(auditCsv).toContain(",7,");
  });
});
