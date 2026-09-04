import { beforeEach, describe, expect, it } from "vitest";
import {
  invalidateApiResponseCache,
  readCachedGetResponse,
  resetApiSessionEpochState,
  setApiSessionEpoch,
  getApiSessionEpoch,
  writeCachedGetResponse
} from "./cache";

describe("API response cache", () => {
  beforeEach(() => {
    invalidateApiResponseCache("test-reset");
    resetApiSessionEpochState();
  });

  it("uses user and tenant identity in the session epoch", () => {
    setApiSessionEpoch({
      authStatus: "authenticated",
      companyId: "company-1",
      userId: "user-1"
    });

    expect(getApiSessionEpoch()).toBe("authenticated:user-1:company-1");
  });

  it("expires entries using their declared TTL", () => {
    const originalNow = Date.now;
    Date.now = () => 1000;
    try {
      writeCachedGetResponse("products", ["p1"], { ttlMs: 50 });
      expect(readCachedGetResponse("products")).toEqual({ hit: true, value: ["p1"] });
      Date.now = () => 1051;
      expect(readCachedGetResponse("products").hit).toBe(false);
    } finally {
      Date.now = originalNow;
    }
  });

  it("invalidates only entries owned by selected cache tags", () => {
    writeCachedGetResponse("products", ["p1"], { tags: ["products"] });
    writeCachedGetResponse("reports", ["r1"], { tags: ["reports"] });

    invalidateApiResponseCache("product-updated", ["products"]);

    expect(readCachedGetResponse("products").hit).toBe(false);
    expect(readCachedGetResponse("reports")).toEqual({ hit: true, value: ["r1"] });
  });
});
