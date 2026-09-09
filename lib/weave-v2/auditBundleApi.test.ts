import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  raw: vi.fn()
}));

vi.mock("@/lib/apiClient", () => ({ api: apiMock }));

import {
  createAuditBundleAssuranceRecord,
  createAuditBundleShare,
  createAuditBundle,
  fetchAuditBundle,
  issueAuditBundle,
  reviewAuditBundle,
  revokeAuditBundleShare
} from "./auditBundleApi";

describe("Audit Pack server API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates and polls only the server-side immutable bundle endpoints", async () => {
    apiMock.post.mockResolvedValue({ id: "bundle-1", status: "processing" });
    apiMock.get.mockResolvedValue({ id: "bundle-1", status: "completed" });

    await createAuditBundle("product-1");
    await fetchAuditBundle("bundle-1");

    expect(apiMock.post).toHaveBeenCalledWith("/reports/v2/audit-packs", {
      productId: "product-1"
    });
    expect(apiMock.get).toHaveBeenCalledWith("/reports/v2/audit-packs/bundle-1");
  });

  it("records review and internal issue through bundle-scoped endpoints", async () => {
    apiMock.post.mockResolvedValue({ id: "record-1" });

    await reviewAuditBundle("bundle/1", {
      decision: "approved",
      notes: "Reviewed",
      qaExceptions: [{ code: "QA-1", message: "Checked", severity: "warning", status: "resolved" }]
    });
    await issueAuditBundle("bundle/1", {
      assertion: "Internal assertion",
      criteria: "Internal criteria v1",
      signatureAcknowledged: true
    });

    expect(apiMock.post).toHaveBeenNthCalledWith(1, "/reports/v2/audit-packs/bundle%2F1/reviews", {
      decision: "approved",
      notes: "Reviewed",
      qaExceptions: [{ code: "QA-1", message: "Checked", severity: "warning", status: "resolved" }]
    });
    expect(apiMock.post).toHaveBeenNthCalledWith(2, "/reports/v2/audit-packs/bundle%2F1/issue", {
      assertion: "Internal assertion",
      criteria: "Internal criteria v1",
      signatureAcknowledged: true
    });
  });

  it("creates and revokes an expiring read-only share", async () => {
    apiMock.post.mockResolvedValue({ id: "share-1" });
    apiMock.delete.mockResolvedValue({ id: "share-1" });

    await createAuditBundleShare("bundle/1", {
      label: "Verifier", expiresInHours: 168, maxDownloads: 10
    });
    await revokeAuditBundleShare("bundle/1", "share/1");

    expect(apiMock.post).toHaveBeenCalledWith("/reports/v2/audit-packs/bundle%2F1/shares", {
      label: "Verifier", expiresInHours: 168, maxDownloads: 10
    });
    expect(apiMock.delete).toHaveBeenCalledWith(
      "/reports/v2/audit-packs/bundle%2F1/shares/share%2F1"
    );
  });

  it("records an external assurance outcome against explicit evidence", async () => {
    apiMock.post.mockResolvedValue({ id: "assurance-1" });
    await createAuditBundleAssuranceRecord("bundle-1", {
      outcome: "limited_assurance",
      providerName: "Independent Verifier",
      practitionerName: "Reviewer",
      standard: "ISAE 3410",
      scope: "Selected PCF assertions",
      statementDate: "2026-09-10",
      validTo: "2027-09-10",
      evidenceDocumentId: "evidence-1"
    });
    expect(apiMock.post).toHaveBeenCalledWith(
      "/reports/v2/audit-packs/bundle-1/assurance-records",
      expect.objectContaining({ outcome: "limited_assurance", evidenceDocumentId: "evidence-1" })
    );
  });
});
