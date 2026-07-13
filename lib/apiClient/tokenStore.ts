import { readFromStorage, writeToStorage, normalizeToken } from "./storageUtils";
import { invalidateApiResponseCache, resetApiSessionEpochState } from "./cache";
import { clearAuthUserSnapshotState, clearPersistedAuthUserSnapshot, readAuthUserSnapshot } from "./authSnapshot";

const ACCESS_TOKEN_STORAGE_KEY = "weavecarbon_access_token";
const COOKIE_SESSION_MODE_KEY = "weavecarbon_cookie_session_mode";
const REFRESH_TOKEN_STORAGE_KEY = "weavecarbon_refresh_token";
const TOKEN_STORAGE_MODE_KEY = "weavecarbon_token_storage_mode";
const LEGACY_ACCESS_TOKEN_STORAGE_KEYS = ["token", "access_token"];
const LEGACY_REFRESH_TOKEN_STORAGE_KEYS = ["refresh_token"];
const ALL_LEGACY_TOKEN_STORAGE_KEYS = [
  ...new Set([
    ...LEGACY_ACCESS_TOKEN_STORAGE_KEYS,
    ...LEGACY_REFRESH_TOKEN_STORAGE_KEYS
  ])
];

export const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30 * 1000;
export const AUTH_INVALIDATED_EVENT = "weavecarbon:auth-invalidated";
export const AUTH_INVALIDATED_STORAGE_KEY = "weavecarbon_auth_invalidated_at";

export type TokenStorageMode = "local" | "session";
type AuthTokenStorageScope = "memory" | "storage";

export interface AuthTokens {
  access_token?: string;
  refresh_token?: string;
}

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

export const getTokenStorageMode = (): TokenStorageMode => {
  if (typeof window === "undefined") return "local";

  const explicitLocalMode = readFromStorage(localStorage, TOKEN_STORAGE_MODE_KEY);
  if (explicitLocalMode === "local" || explicitLocalMode === "session") {
    return explicitLocalMode;
  }

  const explicitSessionMode = readFromStorage(sessionStorage, TOKEN_STORAGE_MODE_KEY);
  if (explicitSessionMode === "local" || explicitSessionMode === "session") {
    return explicitSessionMode;
  }

  const hasLocalToken = Boolean(
    normalizeToken(readFromStorage(localStorage, ACCESS_TOKEN_STORAGE_KEY)) ||
    normalizeToken(readFromStorage(localStorage, REFRESH_TOKEN_STORAGE_KEY))
  );
  if (hasLocalToken) return "local";

  const hasSessionToken = Boolean(
    normalizeToken(readFromStorage(sessionStorage, ACCESS_TOKEN_STORAGE_KEY)) ||
    normalizeToken(readFromStorage(sessionStorage, REFRESH_TOKEN_STORAGE_KEY))
  );
  if (hasSessionToken) return "session";

  return "local";
};

const setTokenStorageMode = (mode: TokenStorageMode) => {
  if (typeof window === "undefined") return;

  writeToStorage(localStorage, TOKEN_STORAGE_MODE_KEY, mode === "local" ? mode : null);
  writeToStorage(sessionStorage, TOKEN_STORAGE_MODE_KEY, mode === "session" ? mode : null);
};

const getCookieSessionMode = (): TokenStorageMode | null => {
  if (typeof window === "undefined") return null;

  const explicitLocalMode = readFromStorage(localStorage, COOKIE_SESSION_MODE_KEY);
  if (explicitLocalMode === "local" || explicitLocalMode === "session") {
    return explicitLocalMode;
  }

  const explicitSessionMode = readFromStorage(sessionStorage, COOKIE_SESSION_MODE_KEY);
  if (explicitSessionMode === "local" || explicitSessionMode === "session") {
    return explicitSessionMode;
  }

  return null;
};

const setCookieSessionMode = (mode: TokenStorageMode | null) => {
  if (typeof window === "undefined") return;

  writeToStorage(localStorage, COOKIE_SESSION_MODE_KEY, mode === "local" ? mode : null);
  writeToStorage(sessionStorage, COOKIE_SESSION_MODE_KEY, mode === "session" ? mode : null);
};

const readStorage = (key: string) => {
  if (typeof window === "undefined") return null;
  const isDemoRoute = window.location.pathname.toLowerCase().startsWith("/demo");
  if (!isDemoRoute) {
    return normalizeToken(readFromStorage(sessionStorage, key));
  }

  const mode = getTokenStorageMode();
  const primaryStorage = mode === "local" ? localStorage : sessionStorage;
  const secondaryStorage = mode === "local" ? sessionStorage : localStorage;

  return (
    normalizeToken(readFromStorage(primaryStorage, key)) ||
    normalizeToken(readFromStorage(secondaryStorage, key))
  );
};

const shouldReadPersistedTokens = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return true;
};

const readAccessTokenStorage = () => {
  if (typeof window === "undefined") return null;

  return (
    normalizeToken(readFromStorage(sessionStorage, ACCESS_TOKEN_STORAGE_KEY)) ||
    (window.location.pathname.toLowerCase().startsWith("/demo") ?
      normalizeToken(readFromStorage(localStorage, ACCESS_TOKEN_STORAGE_KEY)) :
      null)
  );
};

const readLegacyStorage = (keys: string[]) => {
  if (typeof window === "undefined") return null;
  const isDemoRoute = window.location.pathname.toLowerCase().startsWith("/demo");
  for (const key of keys) {
    if (isDemoRoute) {
      const localValue = normalizeToken(readFromStorage(localStorage, key));
      if (localValue) {
        return localValue;
      }
    }
    const sessionValue = normalizeToken(readFromStorage(sessionStorage, key));
    if (sessionValue) {
      return sessionValue;
    }
  }
  return null;
};

const clearFromAllStorages = (keys: string[]) => {
  if (typeof window === "undefined") return;
  for (const key of keys) {
    writeToStorage(localStorage, key, null);
    writeToStorage(sessionStorage, key, null);
  }
};

const clearPersistedTokenState = () => {
  clearFromAllStorages([
    ACCESS_TOKEN_STORAGE_KEY,
    REFRESH_TOKEN_STORAGE_KEY,
    COOKIE_SESSION_MODE_KEY,
    TOKEN_STORAGE_MODE_KEY,
    ...ALL_LEGACY_TOKEN_STORAGE_KEYS
  ]);
};

const emitAuthInvalidated = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTH_INVALIDATED_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore storage write failures (e.g. private browsing quota)
  }
  window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT));
};

export const clearPersistedAuthState = () => {
  clearPersistedAuthUserSnapshot();
  clearPersistedTokenState();
};

const writeStorage = (key: string, value: string | null, mode: TokenStorageMode) => {
  if (typeof window === "undefined") return;
  const normalized = normalizeToken(value);
  const targetStorage = mode === "local" ? localStorage : sessionStorage;
  const fallbackStorage = mode === "local" ? sessionStorage : localStorage;

  writeToStorage(targetStorage, key, normalized);
  writeToStorage(fallbackStorage, key, null);
};

const writeAccessTokenStorage = (value: string | null, mode: TokenStorageMode = "session") => {
  if (typeof window === "undefined") return;

  const normalized = normalizeToken(value);
  writeStorage(ACCESS_TOKEN_STORAGE_KEY, normalized, mode);
};

const getJwtExpMs = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as { exp?: unknown };
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return null;
    }
    return parsed.exp * 1000;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token: string, skewMs = 0) => {
  const expMs = getJwtExpMs(token);
  if (!expMs) {
    return false;
  }
  return Date.now() + skewMs >= expMs;
};

const clearRuntimeTokens = ({
  clearPersistentTokens = true,
  notify = false
}: {
  clearPersistentTokens?: boolean;
  notify?: boolean;
} = {}) => {
  inMemoryAccessToken = null;
  inMemoryRefreshToken = null;
  clearAuthUserSnapshotState();
  resetApiSessionEpochState();
  invalidateApiResponseCache("auth-cleared");

  if (clearPersistentTokens) {
    clearPersistedAuthState();
  }

  if (notify) {
    emitAuthInvalidated();
  }
};

export const authTokenStore = {
  getAccessToken: () => {
    const runtimeAccessToken = normalizeToken(inMemoryAccessToken);
    if (runtimeAccessToken) {
      if (isTokenExpired(runtimeAccessToken)) {
        inMemoryAccessToken = null;
        return null;
      }
      return runtimeAccessToken;
    }

    if (!shouldReadPersistedTokens()) {
      return null;
    }

    const storedAccessToken = readAccessTokenStorage();
    if (storedAccessToken && !isTokenExpired(storedAccessToken)) {
      return storedAccessToken;
    }

    if (storedAccessToken) {
      clearFromAllStorages([ACCESS_TOKEN_STORAGE_KEY]);
    }

    const legacyAccessToken = readLegacyStorage(LEGACY_ACCESS_TOKEN_STORAGE_KEYS);
    if (!legacyAccessToken) {
      return null;
    }

    if (isTokenExpired(legacyAccessToken)) {
      clearFromAllStorages(LEGACY_ACCESS_TOKEN_STORAGE_KEYS);
      return null;
    }

    writeAccessTokenStorage(legacyAccessToken, "session");
    clearFromAllStorages(LEGACY_ACCESS_TOKEN_STORAGE_KEYS);
    return legacyAccessToken;
  },
  getRefreshToken: () => {
    const runtimeRefreshToken = normalizeToken(inMemoryRefreshToken);
    if (runtimeRefreshToken) {
      if (isTokenExpired(runtimeRefreshToken)) {
        inMemoryRefreshToken = null;
        return null;
      }
      return runtimeRefreshToken;
    }

    if (!shouldReadPersistedTokens()) {
      return null;
    }

    const storedRefreshToken = readStorage(REFRESH_TOKEN_STORAGE_KEY);
    if (storedRefreshToken && !isTokenExpired(storedRefreshToken)) {
      return storedRefreshToken;
    }

    if (storedRefreshToken) {
      clearFromAllStorages([REFRESH_TOKEN_STORAGE_KEY]);
    }

    const legacyRefreshToken = readLegacyStorage(LEGACY_REFRESH_TOKEN_STORAGE_KEYS);
    if (!legacyRefreshToken) {
      return null;
    }

    if (isTokenExpired(legacyRefreshToken)) {
      clearFromAllStorages(LEGACY_REFRESH_TOKEN_STORAGE_KEYS);
      return null;
    }

    writeStorage(REFRESH_TOKEN_STORAGE_KEY, legacyRefreshToken, getTokenStorageMode());
    clearFromAllStorages(LEGACY_REFRESH_TOKEN_STORAGE_KEYS);
    return legacyRefreshToken;
  },
  setTokens: (
    tokens: AuthTokens | null | undefined,
    options?: {
      persist?: boolean;
      storageScope?: AuthTokenStorageScope;
      storeRefreshToken?: boolean;
    }
  ) => {
    if (!tokens) {
      clearRuntimeTokens();
      return;
    }

    inMemoryAccessToken = normalizeToken(tokens.access_token);
    inMemoryRefreshToken =
      options?.storeRefreshToken === false ?
        null :
        normalizeToken(tokens.refresh_token);

    const storageScope = options?.storageScope ?? "memory";
    if (storageScope !== "storage") {
      clearPersistedTokenState();
      return;
    }

    const mode: TokenStorageMode =
      typeof options?.persist === "boolean" ?
        options.persist ?
          "local" :
          "session" :
        getTokenStorageMode();

    setTokenStorageMode(mode);
    writeAccessTokenStorage(tokens.access_token || null, mode);

    const shouldStoreRefreshToken = options?.storeRefreshToken ?? true;
    const normalizedRefreshToken = normalizeToken(tokens.refresh_token);

    writeStorage(
      REFRESH_TOKEN_STORAGE_KEY,
      shouldStoreRefreshToken ? normalizedRefreshToken : null,
      mode
    );
    setCookieSessionMode(
      shouldStoreRefreshToken && !normalizedRefreshToken ? mode : null
    );
    clearFromAllStorages(ALL_LEGACY_TOKEN_STORAGE_KEYS);
  },
  getSessionMode: () => getCookieSessionMode() || getTokenStorageMode(),
  hasSessionMarker: () =>
    Boolean(
      authTokenStore.getAccessToken() ||
      authTokenStore.getRefreshToken() ||
      getCookieSessionMode() ||
      readAuthUserSnapshot()
    ),
  hasRefreshCapability: () =>
    Boolean(authTokenStore.getRefreshToken() || getCookieSessionMode()),
  clearAccessToken: () => {
    inMemoryAccessToken = null;
    clearFromAllStorages([ACCESS_TOKEN_STORAGE_KEY]);
  },
  clear: (options?: { clearPersistentTokens?: boolean; notify?: boolean }) =>
    clearRuntimeTokens(options)
};
