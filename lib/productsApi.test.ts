import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductAssessmentData } from "@/components/dashboard/assessment/steps/types";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  invalidate: vi.fn()
}));

vi.mock("@/lib/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: mocks.post,
    put: mocks.put,
    patch: vi.fn(),
    delete: vi.fn()
  },
  invalidateApiResponseCache: mocks.invalidate,
  isApiError: vi.fn()
}));

import { createProduct, updateProduct } from "@/lib/productsApi";

const assessmentWithTamperedPreview = {
  productCode: "SKU-1",
  productName: "Tee",
  productType: "tshirt",
  weightPerUnit: 200,
  quantity: 10,
  materials: [],
  accessories: [],
  productionProcesses: [],
  energySources: [],
  transportLegs: [],
  carbonResults: {
    perProduct: {
      materials: 999999,
      production: 999999,
      energy: 0,
      transport: 999999,
      packaging: 999999,
      total: 999999
    }
  }
} as unknown as ProductAssessmentData;

const serverMutation = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "draft",
  version: 1,
  carbonResults: {
    perProduct: {
      materials: 2.864,
      production: 1.591,
      energy: 0,
      transport: 0.106,
      packaging: 0.017,
      total: 4.577
    },
    totalBatch: {
      materials: 28.64,
      production: 15.91,
      energy: 0,
      transport: 1.06,
      packaging: 0.17,
      total: 45.77
    },
    confidenceLevel: "medium",
    confidenceScore: 77,
    scope1: 0,
    scope2: 1.591,
    scope3: 2.986
  }
};

describe("authoritative product mutation results", () => {
  beforeEach(() => {
    mocks.post.mockReset();
    mocks.put.mockReset();
    mocks.invalidate.mockReset();
  });

  it("uses the server carbon result returned after create", async () => {
    mocks.post.mockResolvedValue(serverMutation);

    const result = await createProduct(assessmentWithTamperedPreview, "draft");

    expect(mocks.post).toHaveBeenCalledWith(
      "/products",
      expect.objectContaining({ carbonResults: assessmentWithTamperedPreview.carbonResults })
    );
    expect(result.carbonResults?.perProduct.total).toBe(4.577);
    expect(result.carbonResults?.confidenceScore).toBe(77);
  });

  it("uses the server carbon result returned after update", async () => {
    mocks.put.mockResolvedValue({ ...serverMutation, version: 2 });

    const result = await updateProduct(serverMutation.id, assessmentWithTamperedPreview);

    expect(result.version).toBe(2);
    expect(result.carbonResults?.perProduct.total).toBe(4.577);
  });
});
