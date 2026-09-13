import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/apiClient";
import {
  createCorporateGhgInventory,
  fetchCorporateGhgInventories,
  reviewCorporateGhgInventory,
  type CorporateGhgInventoryInput
} from "./corporateGhgInventoryApi";

vi.mock("@/lib/apiClient", () => ({
  api: { get: vi.fn(), post: vi.fn() }
}));

describe("corporateGhgInventoryApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the company-scoped inventory collection", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    await fetchCorporateGhgInventories();

    expect(api.get).toHaveBeenCalledWith("/corporate-ghg-inventories");
  });

  it("creates an immutable revision and appends a named review", async () => {
    const input = { inventoryReference: "GHG-2026" } as CorporateGhgInventoryInput;
    vi.mocked(api.post).mockResolvedValue({});

    await createCorporateGhgInventory(input);
    await reviewCorporateGhgInventory("inventory id/1", {
      reviewerRole: "corporate_ghg_inventory_reviewer",
      decision: "approved_for_internal_report",
      notes: "Boundary and factors reviewed."
    });

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      "/corporate-ghg-inventories",
      input
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      "/corporate-ghg-inventories/inventory%20id%2F1/reviews",
      expect.objectContaining({
        reviewerRole: "corporate_ghg_inventory_reviewer",
        decision: "approved_for_internal_report"
      })
    );
  });
});
