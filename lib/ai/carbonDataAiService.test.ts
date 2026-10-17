import { describe, it, expect } from "vitest";
import {
  analyzeActivityAnomalies,
  auditEvidenceForensics,
  assessDataQualityPedigree,
  scanAuditDataGaps,
  resolveInboxTaskWithAi,
} from "./carbonDataAiService";
import type { IndustrialActivity, IndustrialActivityLineage } from "@/lib/industrialCoreApi";

describe("carbonDataAiService", () => {
  describe("analyzeActivityAnomalies", () => {
    it("handles empty activity list gracefully", () => {
      const result = analyzeActivityAnomalies([]);
      expect(result.outliers).toHaveLength(0);
      expect(result.auditReadinessTier).toBe("L1");
    });

    it("detects consumption spikes and categorizes scopes", () => {
      const mockActivities: IndustrialActivity[] = [
        {
          id: "act-1",
          activityReference: "ACT-ELEC-01",
          facilityRevisionId: "fac-1",
          facilityReference: "FAC-1",
          activityType: "electricity",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          quantity: 10000,
          canonicalUnit: "kWh",
          sourceKind: "invoice",
          dataQualityLevel: "L2",
          sourceSha256: "abc",
          evidenceDocumentIds: ["ev-1"],
        },
        {
          id: "act-2",
          activityReference: "ACT-ELEC-02",
          facilityRevisionId: "fac-1",
          facilityReference: "FAC-1",
          activityType: "electricity",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
          quantity: 10500,
          canonicalUnit: "kWh",
          sourceKind: "invoice",
          dataQualityLevel: "L2",
          sourceSha256: "abc",
          evidenceDocumentIds: ["ev-2"],
        },
        {
          id: "act-3",
          activityReference: "ACT-ELEC-SPIKE",
          facilityRevisionId: "fac-1",
          facilityReference: "FAC-1",
          activityType: "electricity",
          periodStart: "2026-03-01",
          periodEnd: "2026-03-31",
          quantity: 120000, // Spike > 10x
          canonicalUnit: "kWh",
          sourceKind: "invoice",
          dataQualityLevel: "L2",
          sourceSha256: "abc",
          evidenceDocumentIds: [],
        },
        {
          id: "act-4",
          activityReference: "ACT-DIESEL-01",
          facilityRevisionId: "fac-1",
          facilityReference: "FAC-1",
          activityType: "diesel_fuel",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          quantity: 500,
          canonicalUnit: "L",
          sourceKind: "manual",
          dataQualityLevel: "L4",
          sourceSha256: "abc",
          evidenceDocumentIds: [],
        },
      ];

      const result = analyzeActivityAnomalies(mockActivities);
      expect(result.scopeBreakdown.scope1Quantity).toBe(500);
      expect(result.scopeBreakdown.scope2Quantity).toBe(140500);
      expect(result.outliers.length).toBeGreaterThan(0);
      expect(result.outliers.some((o) => o.activityReference === "ACT-ELEC-SPIKE")).toBe(true);
    });
  });

  describe("auditEvidenceForensics", () => {
    it("handles null lineage gracefully", () => {
      const result = auditEvidenceForensics(null);
      expect(result.integrityScore).toBe(0);
      expect(result.verdict).toBe("high_risk_gap");
    });

    it("verifies hash checks and issues forensic attestation certificate", () => {
      const mockLineage: IndustrialActivityLineage = {
        activity: {
          id: "act-1",
          activityReference: "ACT-TEST-01",
          facilityRevisionId: "fac-1",
          facilityReference: "FAC-1",
          activityType: "electricity",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          quantity: 5000,
          canonicalUnit: "kWh",
          sourceKind: "meter",
          dataQualityLevel: "L2",
          sourceSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          evidenceDocumentIds: ["ev-1"],
        },
        facility: { id: "fac-1", reference: "FAC-1", name: "Nhà máy Test" },
        process: { id: "proc-1", reference: "PROC-1", name: "Quy trình Dệt" },
        measurementPoint: { id: "mp-1", reference: "MP-1", type: "meter" },
        evidence: [
          {
            id: "ev-1",
            name: "Hoa-don-dien-T1.pdf",
            type: "financial",
            status: "locked",
            checksumSha256: "a".repeat(64),
          },
        ],
        latestReview: {
          id: "rev-1",
          activityId: "act-1",
          reviewerId: "usr-auditor-1",
          reviewerRole: "industrial_activity_reviewer",
          reviewerName: "Auditor",
          decision: "approved",
          notes: "Approved",
          sourceSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          evidenceSnapshot: [],
          createdAt: "2026-02-01T00:00:00Z",
        },
      };

      const result = auditEvidenceForensics(mockLineage);
      expect(result.integrityScore).toBeGreaterThanOrEqual(80);
      expect(result.verdict).toBe("audit_ready");
      expect(result.hashChecks.length).toBeGreaterThan(0);
      expect(result.complianceCert.certId).toContain("WCB-FORENSIC-");
    });
  });

  describe("assessDataQualityPedigree", () => {
    it("evaluates 5 pedigree dimensions and recommends upgrade roadmap", () => {
      const result = assessDataQualityPedigree({
        type: "activity",
        reference: "ACT-DYEING-ELEC",
        sourceKind: "meter",
        unit: "kWh",
        description: "Điện lưới EVN đo đếm bằng công tơ điện tử",
      });

      expect(result.overallScore).toBeGreaterThanOrEqual(3.5);
      expect(["L3", "L4", "L5"]).toContain(result.dqlLevel);
      expect(result.dimensions.reliabilityScore).toBe(4);
      expect(result.dimensions.geographicScore).toBe(5);
    });
  });

  describe("scanAuditDataGaps", () => {
    it("scans and detects audit gaps for compliance frameworks", () => {
      const result = scanAuditDataGaps({ framework: "CBAM" });
      expect(result.detectedGaps.length).toBeGreaterThan(0);
      expect(result.readinessScore).toBeDefined();
      expect(result.detectedGaps.some((g) => g.regulationTag.includes("CBAM"))).toBe(true);
    });
  });

  describe("resolveInboxTaskWithAi", () => {
    it("provides root cause, audit exposure and step-by-step resolution for evidence tasks", () => {
      const advice = resolveInboxTaskWithAi({
        id: "task-1",
        title: "Thiếu bằng chứng hóa đơn tiền điện",
        reason: "Hoạt động chưa có chứng từ khóa",
        category: "evidence",
        priority: "critical",
      });

      expect(advice.rootCause).toBeDefined();
      expect(advice.auditExposure).toContain("Kiểm toán viên");
      expect(advice.stepByStepAction.length).toBeGreaterThan(0);
      expect(advice.draftActionText).toBeDefined();
    });
  });
});
