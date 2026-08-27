import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn()
}));

vi.mock("@/lib/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: mocks.post,
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

import {
  generateCompanyRecommendations,
  generateProductSuggestions
} from "@/lib/ragApi";

describe("RAG recommendation adapters", () => {
  beforeEach(() => {
    mocks.post.mockReset();
  });

  it("routes product suggestions through the authenticated backend", async () => {
    mocks.post.mockResolvedValue({
      product_id: "product/42",
      suggestions: []
    });
    const browserFetch = vi.spyOn(globalThis, "fetch");

    await expect(
      generateProductSuggestions(
        "https://untrusted-rag.example",
        "product/42",
        { language: "en" },
        5000
      )
    ).resolves.toEqual({ product_id: "product/42", suggestions: [] });

    expect(mocks.post).toHaveBeenCalledWith(
      "/chat/recommendations/product/product%2F42",
      { product_id: "product/42", language: "en" }
    );
    expect(browserFetch).not.toHaveBeenCalled();
    browserFetch.mockRestore();
  });

  it("routes company recommendations through the authenticated backend", async () => {
    mocks.post.mockResolvedValue({
      company_id: "company/7",
      recommendations: []
    });
    const browserFetch = vi.spyOn(globalThis, "fetch");

    await expect(
      generateCompanyRecommendations(
        "https://untrusted-rag.example",
        "company/7",
        {},
        5000
      )
    ).resolves.toEqual({ company_id: "company/7", recommendations: [] });

    expect(mocks.post).toHaveBeenCalledWith(
      "/chat/recommendations/company/company%2F7",
      { company_id: "company/7", language: "vi" }
    );
    expect(browserFetch).not.toHaveBeenCalled();
    browserFetch.mockRestore();
  });
});
