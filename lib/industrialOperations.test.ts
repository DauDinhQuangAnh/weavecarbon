import { describe, expect, it } from "vitest";
import { isControlledEvidence, selectLatestRevisions, sha256CanonicalJson, zonedLocalDateTimeToIso } from "./industrialOperations";

describe("industrial operations helpers", () => {
  it("selects only the latest revision for each business reference", () => {
    const rows = [
      { id: "a1", reference: "FAC-A", revision: 1 },
      { id: "b1", reference: "FAC-B", revision: 1 },
      { id: "a2", reference: "FAC-A", revision: 2 },
    ];
    expect(selectLatestRevisions(rows, (row) => row.reference).map((row) => row.id)).toEqual(["a2", "b1"]);
  });

  it("accepts only non-empty locked evidence with a SHA-256 checksum", () => {
    const base = {
      id: "evidence-1", companyId: "company-1", evidenceType: "meter_export", documentName: "meter.pdf",
      fileSizeBytes: 42, checksumSha256: "a".repeat(64), extractedJson: {}, status: "locked",
      createdAt: "2026-09-26T00:00:00.000Z", updatedAt: "2026-09-26T00:00:00.000Z",
    };
    expect(isControlledEvidence(base)).toBe(true);
    expect(isControlledEvidence({ ...base, status: "uploaded" })).toBe(false);
    expect(isControlledEvidence({ ...base, fileSizeBytes: 0 })).toBe(false);
  });

  it("creates a stable SHA-256 provenance digest", async () => {
    const first = await sha256CanonicalJson({ activityReference: "ACT-1", quantity: 12 });
    const second = await sha256CanonicalJson({ quantity: 12, activityReference: "ACT-1" });
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("converts a facility-local activity period to an unambiguous UTC instant", () => {
    expect(zonedLocalDateTimeToIso("2026-09-01T00:00", "Asia/Ho_Chi_Minh")).toBe("2026-08-31T17:00:00.000Z");
    expect(zonedLocalDateTimeToIso("2026-09-01T12:30", "UTC")).toBe("2026-09-01T12:30:00.000Z");
  });
});
