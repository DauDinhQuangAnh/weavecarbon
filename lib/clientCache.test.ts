import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_CACHE_POLICIES,
  buildClientCacheKey,
  readSessionCache,
  writeSessionCache
} from "./clientCache";

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); }
  };
};

describe("tenant-scoped client cache", () => {
  beforeEach(() => {
    const sessionStorage = createMemoryStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { sessionStorage }
    });
    vi.restoreAllMocks();
  });

  it("isolates the same resource by user and tenant", () => {
    const policy = CLIENT_CACHE_POLICIES.productCatalog;
    expect(buildClientCacheKey(policy, { userId: "u1", companyId: "c1" }))
      .not.toBe(buildClientCacheKey(policy, { userId: "u1", companyId: "c2" }));
  });

  it("reads a valid entry and evicts it after TTL", () => {
    const policy = CLIENT_CACHE_POLICIES.summaryProductPrefetch;
    const key = buildClientCacheKey(policy, { userId: "u1", companyId: "c1" });
    writeSessionCache(key, policy, { id: "p1" }, 1000);

    expect(readSessionCache(key, policy, 1001)).toEqual({ id: "p1" });
    expect(readSessionCache(key, policy, 1000 + policy.ttlMs + 1)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });
});
