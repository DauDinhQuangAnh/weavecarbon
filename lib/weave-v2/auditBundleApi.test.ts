import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  raw: vi.fn()
}));

vi.mock("@/lib/apiClient", () => ({ api: apiMock }));

import {
  createAuditBundle,
  fetchAuditBundle,
  issueAuditBundle,
  reviewAuditBundle
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
      criteria: "Internal criteria v1"
    });

    expect(apiMock.post).toHaveBeenNthCalledWith(1, "/reports/v2/audit-packs/bundle%2F1/reviews", {
      decision: "approved",
      notes: "Reviewed",
      qaExceptions: [{ code: "QA-1", message: "Checked", severity: "warning", status: "resolved" }]
    });
    expect(apiMock.post).toHaveBeenNthCalledWith(2, "/reports/v2/audit-packs/bundle%2F1/issue", {
      assertion: "Internal assertion",
      criteria: "Internal criteria v1"
    });
  });
});
