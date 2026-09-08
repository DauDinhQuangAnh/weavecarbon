import { describe, expect, it } from "vitest";
import { DEMO_PACK_V2 } from "./demoPackV2";
import { buildAuditPackJsonV2, buildAuditPackPayloadV2, type AuditPanelRowV2 } from "./auditPackV2";
import type { AuthoritativeCarbonArtifactV2 } from "./productReportAdapter";

const sku = DEMO_PACK_V2[0];
const authority = {
  carbonAuthority: {
    authoritative: true,
    source: "product_assessment_snapshot",
    calculationId: "22222222-2222-4222-8222-222222222222",
    calculationVersion: 7,
    calculatedAt: "2026-09-08T00:00:00.000Z",
    engineVersion: "engine-1",
    methodologyVersion: "method-1",
    factorRegistryVersion: "factors-1",
    gwpBasis: "IPCC_AR5_100y",
    canonicalInputHash: "a".repeat(64),
    legacy: false
  },
  carbonResults: {
    perProduct: { materials: 2, production: 1, energy: 0, transport: 0.1, packaging: 0.1, total: 3.2 },
    totalBatch: { materials: 20, production: 10, energy: 0, transport: 1, packaging: 1, total: 32 },
    confidenceLevel: "medium",
    proxyUsed: false,
    proxyNotes: [],
    scope1: 0,
    scope2: 1,
    scope3: 2.2
  }
} as AuthoritativeCarbonArtifactV2;

describe("audit pack production guardrails", () => {
  it("does not insert fallback evidence or preview calculations in production mode", () => {
    const payload = buildAuditPackPayloadV2({ ...sku, evidence: [] }, null);

    expect(payload.status).toBe("blocked");
    expect(payload.rows).toEqual([]);
    expect(payload.evidence).toEqual([]);
    expect(payload.blockers).toHaveLength(3);
  });

  it("never converts authoritative stage totals into fake activity multiplied by factor 1", () => {
    const payload = buildAuditPackPayloadV2(sku, authority);
    const json = buildAuditPackJsonV2(payload);

    expect(payload.status).toBe("blocked");
    expect(payload.rows).toEqual([]);
    expect(json.locked).toBe(false);
    expect(json.immutable).toBe(false);
    expect(json.assuranceStatus).toBe("not_verified");
  });

  it("allows internal review only with authoritative AD x EF rows and checksummed evidence", () => {
    const row: AuditPanelRowV2 = {
      segment: "materials",
      detail: "Cotton",
      activity: 0.2,
      activityUnit: "kg",
      factor: 10,
      factorUnit: "kgCO2e/kg",
      source: "factor registry snapshot",
      kgCo2e: 2
    };
    const authorityWithTerms = {
      ...authority,
      carbonResults: {
        ...authority.carbonResults,
        calculationTermsSchemaVersion: "carbon-contribution-terms-v1",
        calculationTerms: [{
          stage: "materials",
          detail: row.detail,
          activity: row.activity,
          activityUnit: "kg",
          factorId: "cat-cotton-100",
          factorVersionId: "cat-cotton-100:v1",
          factorValue: row.factor,
          factorUnit: row.factorUnit,
          source: row.source,
          sourceUrl: "https://example.test/factor",
          sourceYear: 2024,
          geography: "global",
          boundaryType: "cradle_to_gate",
          gwpBasis: "IPCC_AR5_100y",
          factorClass: "documented_secondary",
          isProxy: false,
          kgCo2e: row.kgCo2e,
          allocation: null
        }]
      }
    } as AuthoritativeCarbonArtifactV2;
    const payload = buildAuditPackPayloadV2(sku, authorityWithTerms);

    expect(payload.status).toBe("internal_review");
    expect(payload.rows[0]).toMatchObject(row);
    expect(payload.rows[0].factorVersionId).toBe("cat-cotton-100:v1");
    expect(payload.evidence.length).toBeGreaterThan(0);
  });

  it("keeps illustrative rows explicitly confined to demo preview mode", () => {
    const payload = buildAuditPackPayloadV2(sku, null, { allowDemoPreview: true });

    expect(payload.status).toBe("demo_preview");
    expect(payload.rows.length).toBeGreaterThan(0);
    expect(payload.methodology).toContain("DEMO PREVIEW");
  });
});
