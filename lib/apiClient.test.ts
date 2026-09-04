import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  authTokenStore,
  clearPersistedAuthState,
  ensureAccessToken,
  readAuthUserSnapshot,
  setAuthUserSnapshot
} from "@/lib/apiClient";

const ACCESS_TOKEN_STORAGE_KEY = "weavecarbon_access_token";
const COOKIE_SESSION_MODE_KEY = "weavecarbon_cookie_session_mode";
const REFRESH_TOKEN_STORAGE_KEY = "weavecarbon_refresh_token";
const TOKEN_STORAGE_MODE_KEY = "weavecarbon_token_storage_mode";
const USER_STORAGE_KEY = "weavecarbon_user";

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

const installBrowserStorage = (pathname = "/overview") => {
  const local = createMemoryStorage();
  const session = createMemoryStorage();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: local
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: session
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      dispatchEvent: vi.fn(),
      localStorage: local,
      location: { pathname },
      sessionStorage: session
    }
  });

  return { local, session };
};

const createJwt = (exp: number) => {
  const payload = btoa(JSON.stringify({ exp }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `header.${payload}.signature`;
};

describe("apiClient auth session storage", () => {
  beforeEach(() => {
    installBrowserStorage();
    vi.restoreAllMocks();
    authTokenStore.clear();
  });

  it("persists non-remembered auth tokens in sessionStorage only", () => {
    authTokenStore.setTokens(
      { access_token: "access-token", refresh_token: "refresh-token" },
      { persist: false, storageScope: "storage", storeRefreshToken: true }
    );

    expect(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe("access-token");
    expect(sessionStorage.getItem(TOKEN_STORAGE_MODE_KEY)).toBe("session");
    expect(sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe("refresh-token");
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_MODE_KEY)).toBeNull();
  });

  it("hydrates the access token from sessionStorage after runtime memory is cleared", () => {
    authTokenStore.setTokens(
      { access_token: "access-token" },
      { persist: false, storageScope: "storage", storeRefreshToken: false }
    );

    authTokenStore.clear({ clearPersistentTokens: false });

    expect(authTokenStore.getAccessToken()).toBe("access-token");
  });

  it("marks cookie-backed sessions when no readable refresh token is returned", () => {
    authTokenStore.setTokens(
      { access_token: "access-token" },
      { persist: false, storageScope: "storage", storeRefreshToken: true }
    );

    expect(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe("access-token");
    expect(sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(COOKIE_SESSION_MODE_KEY)).toBe("session");
    expect(authTokenStore.hasSessionMarker()).toBe(true);
    expect(authTokenStore.hasRefreshCapability()).toBe(true);
  });

  it("does not call refresh when no tab session marker exists", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureAccessToken()).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes an expired access token with the sessionStorage refresh token", async () => {
    const expiredAccessToken = createJwt(Math.floor(Date.now() / 1000) - 60);
    authTokenStore.setTokens(
      { access_token: expiredAccessToken, refresh_token: "refresh-token" },
      { persist: false, storageScope: "storage", storeRefreshToken: true }
    );

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            tokens: {
              access_token: "new-access-token",
              refresh_token: "new-refresh-token"
            }
          }
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureAccessToken()).resolves.toBe("new-access-token");

    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/auth/refresh");
    expect(JSON.parse(options.body as string)).toEqual({ refresh_token: "refresh-token" });
    expect(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe("new-access-token");
    expect(sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe("new-refresh-token");
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("clears auth state when token refresh is unauthorized", async () => {
    authTokenStore.setTokens(
      { access_token: createJwt(Math.floor(Date.now() / 1000) - 60), refresh_token: "bad-refresh" },
      { persist: false, storageScope: "storage", storeRefreshToken: true }
    );
    setAuthUserSnapshot({
      email: "user@example.com",
      id: "user-1"
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "INVALID_REFRESH_TOKEN",
              message: "Invalid refresh token"
            }
          }),
          {
            headers: { "content-type": "application/json" },
            status: 401
          }
        )
      )
    );

    await expect(ensureAccessToken()).resolves.toBeNull();

    expect(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(readAuthUserSnapshot()).toBeNull();
  });

  it("does not clear a valid access token when cookie refresh is missing", async () => {
    // Known issue: ensureAccessToken({ forceRefresh: true }) incorrectly clears sessionStorage
    // even when the existing access_token is still valid and the refresh fails with NO_ACTIVE_SESSION.
    // Fix requires updating apiClient.ts token-clear logic.
    const validAccessToken = createJwt(Math.floor(Date.now() / 1000) + 3600);
    authTokenStore.setTokens(
      { access_token: validAccessToken },
      { persist: false, storageScope: "storage", storeRefreshToken: true }
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NO_ACTIVE_SESSION",
              message: "No active session was found."
            }
          }),
          {
            headers: { "content-type": "application/json" },
            status: 401
          }
        )
      )
    );

    await expect(ensureAccessToken({ forceRefresh: true })).resolves.toBeNull();

    expect(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe(validAccessToken);
    expect(authTokenStore.getAccessToken()).toBe(validAccessToken);
  });

  it("does not force refresh when the auth session endpoint rejects a bearer token", async () => {
    const validAccessToken = createJwt(Math.floor(Date.now() / 1000) + 3600);
    authTokenStore.setTokens(
      { access_token: validAccessToken },
      { persist: false, storageScope: "storage", storeRefreshToken: true }
    );

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NO_ACTIVE_SESSION",
            message: "No active session was found."
          }
        }),
        {
          headers: { "content-type": "application/json" },
          status: 401
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.get("/auth/session", { disableResponseCache: true })
    ).rejects.toThrow("No active session was found.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/auth/session");
    expect((options.headers as Headers).get("Authorization")).toBe(`Bearer ${validAccessToken}`);
    expect(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe(validAccessToken);
  });

  it("sends the sessionStorage access token to the auth session endpoint", async () => {
    authTokenStore.setTokens(
      { access_token: "access-token" },
      { persist: false, storageScope: "storage", storeRefreshToken: false }
    );
    authTokenStore.clear({ clearPersistentTokens: false });

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            user: {
              email: "user@example.com",
              id: "user-1"
            }
          }
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.get("/auth/session", { disableResponseCache: true });

    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token");
  });

  it("stores and clears the auth user snapshot from sessionStorage", () => {
    setAuthUserSnapshot({
      company_id: "company-1",
      email: "user@example.com",
      id: "user-1"
    });

    expect(sessionStorage.getItem(USER_STORAGE_KEY)).toContain("user-1");
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();

    authTokenStore.clear();

    expect(sessionStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    expect(readAuthUserSnapshot()).toBeNull();
  });

  it("does not restore real auth users from legacy localStorage snapshots", () => {
    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({
        email: "legacy@example.com",
        id: "legacy-user"
      })
    );

    expect(readAuthUserSnapshot()).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();

    clearPersistedAuthState();
  });
});
