import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  raw: vi.fn()
}));

vi.mock("@/lib/apiClient", () => ({ api: apiMock }));

import { createAuditBundle, fetchAuditBundle } from "./auditBundleApi";

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
});
