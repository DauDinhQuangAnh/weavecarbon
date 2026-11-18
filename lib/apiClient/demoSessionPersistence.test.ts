import { beforeEach, describe, expect, it, vi } from "vitest";
import { authTokenStore } from "@/lib/apiClient";

// Regression test for "B2C demo loses its session on reload" (test report
// 2026-11-18, #2). Demo sign-in runs on /b2c, which is not a /demo route.

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    }
  };
};

const installBrowser = (pathname: string) => {
  const local = createMemoryStorage();
  const session = createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: local });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: session });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent: vi.fn(), localStorage: local, location: { pathname }, sessionStorage: session }
  });
};

const futureJwt = () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `header.${payload}.signature`;
};

describe("demo session persistence on non-/demo routes", () => {
  beforeEach(() => {
    installBrowser("/b2c");
    authTokenStore.clear();
  });

  it("restores a sessionStorage demo token after a reload on /b2c", () => {
    const token = futureJwt();
    authTokenStore.setTokens(
      { access_token: token, refresh_token: token },
      { persist: false, storageScope: "storage" }
    );
    // simulate a full page reload: runtime memory is gone, storage remains
    authTokenStore.clear({ clearPersistentTokens: false });
    expect(authTokenStore.getAccessToken()).toBe(token);
  });

  it("documents why persist:true broke the B2C demo: localStorage is ignored outside /demo", () => {
    const token = futureJwt();
    authTokenStore.setTokens(
      { access_token: token, refresh_token: token },
      { persist: true, storageScope: "storage" }
    );
    authTokenStore.clear({ clearPersistentTokens: false });
    expect(authTokenStore.getAccessToken()).toBeNull();
  });
});
