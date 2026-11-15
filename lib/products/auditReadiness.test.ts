import { describe, expect, it } from "vitest";
import { deriveAuditReadiness } from "./auditReadiness";

const results = (over: Record<string, unknown> = {}) => ({
  perProduct: { materials: 1, production: 1, transport: 1, packaging: 0, total: 3 },
  totalBatch: { materials: 1, production: 1, transport: 1, packaging: 0, total: 3 },
  confidenceLevel: "high", confidenceScore: 90, proxyUsed: false, proxyNotes: [], scope1: 1, scope2: 1, scope3: 1,
  ...over,
}) as never;
const authority = { authoritative: true } as never;

describe("deriveAuditReadiness", () => {
  it("marks products without results as draft estimates", () => {
    expect(deriveAuditReadiness({ status: "draft" })).toMatchObject({ mode: "estimate", dataStatus: "draft", auditReadyScore: 0 });
  });
  it("requires an authoritative snapshot, no proxy, high confidence and publication for audit-ready", () => {
    expect(deriveAuditReadiness({ status: "published", carbonResults: results(), carbonAuthority: authority })).toMatchObject({ mode: "audit_ready", dataStatus: "audit_ready", auditReadyScore: 95 });
    expect(deriveAuditReadiness({ status: "published", carbonResults: results({ proxyUsed: true }), carbonAuthority: authority })).toMatchObject({ mode: "estimate", dataStatus: "pre_audit" });
    expect(deriveAuditReadiness({ status: "published", carbonResults: results() })).toMatchObject({ mode: "estimate", dataStatus: "estimate" });
  });
  it("falls back to the confidence level and keeps proxy share at least 20% when proxies are used", () => {
    const r = deriveAuditReadiness({ status: "draft", carbonResults: results({ confidenceScore: undefined, confidenceLevel: "low", proxyUsed: true }) });
    expect(r.confidenceScore).toBe(35);
    expect(r.dataStatus).toBe("draft");
    expect(r.proxyPercentage).toBe(65);
  });
});
