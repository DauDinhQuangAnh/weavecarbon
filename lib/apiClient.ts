import { canMutateData, NO_PERMISSION_MESSAGE, resolveCompanyRole } from "@/lib/permissions";
import {
  isSubscriptionLocked,
  readSubscriptionLockState
} from "@/lib/subscriptionLockState";

const DEFAULT_API_BASE_URL = "/api";

const normalizeBaseUrl = (baseUrl: string) => {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

export const API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
);

const ACCESS_TOKEN_STORAGE_KEY = "weavecarbon_access_token";
const COOKIE_SESSION_MODE_KEY = "weavecarbon_cookie_session_mode";
const REFRESH_TOKEN_STORAGE_KEY = "weavecarbon_refresh_token";
const TOKEN_STORAGE_MODE_KEY = "weavecarbon_token_storage_mode";
const LEGACY_ACCESS_TOKEN_STORAGE_KEYS = ["token", "access_token"];
const LEGACY_REFRESH_TOKEN_STORAGE_KEYS = ["refresh_token"];
const ALL_LEGACY_TOKEN_STORAGE_KEYS = [
...new Set([
...LEGACY_ACCESS_TOKEN_STORAGE_KEYS,
...LEGACY_REFRESH_TOKEN_STORAGE_KEYS]
)];

const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30 * 1000;
const USER_STORAGE_KEY = "weavecarbon_user";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const AUTH_INVALIDATED_EVENT = "weavecarbon:auth-invalidated";
export const AUTH_INVALIDATED_STORAGE_KEY = "weavecarbon_auth_invalidated_at";
const PLAN_LOCK_PROTECTED_PREFIXES = [
"/products",
"/product-batches",
"/logistics",
"/export/markets",
"/reports",
"/company/members",
"/account/company"];
const CLIENT_ROLE_GUARD_ENABLED =
process.env.NEXT_PUBLIC_ENFORCE_CLIENT_ROLE_GUARD === "1";
type TokenStorageMode = "local" | "session";
type AuthTokenStorageScope = "memory" | "storage";

export interface AuthTokens {
  access_token?: string;
  refresh_token?: string;
}

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;
let authUserSnapshot: Record<string, unknown> | null = null;

const readFromStorage = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeToStorage = (storage: Storage, key: string, value: string | null) => {
  try {
    if (value) {
      storage.setItem(key, value);
      return;
    }
    storage.removeItem(key);
  } catch {

  }
};

const normalizeToken = (token: string | null | undefined) => {
  if (typeof token !== "string") return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
};

const getTokenStorageMode = (): TokenStorageMode => {
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

const resolveCompanyRoleFromSnapshot = (snapshot: Record<string, unknown> | null) => {
  if (!snapshot) return null;

  const userTypeRaw = snapshot.user_type ?? snapshot.userType;
  const fallbackRole =
  userTypeRaw === "admin" ? "root" : "member";
  const membership =
  typeof snapshot.company_membership === "object" &&
  snapshot.company_membership !== null ?
  snapshot.company_membership as Record<string, unknown> :
  null;

  return resolveCompanyRole(
    {
      role:
      snapshot.company_role ??
      snapshot.companyRole ??
      snapshot.role ??
      membership?.role,
      isRoot:
      snapshot.is_root ??
      snapshot.isRoot ??
      membership?.is_root ??
      membership?.isRoot
    },
    fallbackRole
  );
};

const getStoredCompanyRole = () => {
  const runtimeRole = resolveCompanyRoleFromSnapshot(authUserSnapshot);
  if (runtimeRole) {
    return runtimeRole;
  }

  if (typeof window === "undefined") return null;
  const rawUser = readFromStorage(localStorage, USER_STORAGE_KEY);
  if (!rawUser) return null;

  try {
    const parsedUser = JSON.parse(rawUser) as Record<string, unknown>;
    return resolveCompanyRoleFromSnapshot(parsedUser);
  } catch {
    return null;
  }
};

const isAuthPath = (path: string) => path.toLowerCase().includes("/auth/");

const shouldBlockViewerMutation = (path: string, method: string) => {
  if (typeof window === "undefined") return false;
  if (!CLIENT_ROLE_GUARD_ENABLED) return false;
  if (!MUTATION_METHODS.has(method)) return false;
  if (isAuthPath(path)) return false;

  const companyRole = getStoredCompanyRole();
  if (!companyRole) return false;

  return !canMutateData(companyRole);
};

const shouldBlockPlanLockedMutation = (path: string, method: string) => {
  if (typeof window === "undefined") return false;
  if (!MUTATION_METHODS.has(method)) return false;
  if (isAuthPath(path)) return false;
  const normalizedPath = path.toLowerCase();
  const isProtectedRoute = PLAN_LOCK_PROTECTED_PREFIXES.some((prefix) =>
  normalizedPath.includes(prefix)
  );
  if (!isProtectedRoute) return false;

  return isSubscriptionLocked(readSubscriptionLockState());
};

const readStorage = (key: string) => {
  if (typeof window === "undefined") return null;
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

  return window.location.pathname.toLowerCase().startsWith("/demo");
};

const readAccessTokenStorage = () => {
  if (typeof window === "undefined") return null;

  return (
    normalizeToken(readFromStorage(sessionStorage, ACCESS_TOKEN_STORAGE_KEY)) ||
    normalizeToken(readFromStorage(localStorage, ACCESS_TOKEN_STORAGE_KEY))
  );
};

const readLegacyStorage = (keys: string[]) => {
  if (typeof window === "undefined") return null;
  for (const key of keys) {
    const localValue = normalizeToken(readFromStorage(localStorage, key));
    if (localValue) {
      return localValue;
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

  }
  window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT));
};

export const clearPersistedAuthState = () => {
  clearFromAllStorages([
    USER_STORAGE_KEY,
  ]);
  clearPersistedTokenState();
};

export const readAuthUserSnapshot = (): Record<string, unknown> | null => {
  if (authUserSnapshot) {
    return { ...authUserSnapshot };
  }

  if (typeof window === "undefined") {
    return null;
  }

  const rawUser = readFromStorage(localStorage, USER_STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(rawUser);
    if (parsedUser && typeof parsedUser === "object" && !Array.isArray(parsedUser)) {
      return parsedUser as Record<string, unknown>;
    }
  } catch {
    writeToStorage(localStorage, USER_STORAGE_KEY, null);
  }

  return null;
};

export const setAuthUserSnapshot = (snapshot: object | null) => {
  authUserSnapshot =
    snapshot && typeof snapshot === "object" ?
      { ...(snapshot as Record<string, unknown>) } :
      null;

  if (typeof window === "undefined") {
    return;
  }

  const isDemoSnapshot = Boolean(authUserSnapshot?.is_demo);
  if (authUserSnapshot && !isDemoSnapshot) {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUserSnapshot));
    } catch {

    }
    return;
  }

  writeToStorage(localStorage, USER_STORAGE_KEY, null);
};

const writeAccessTokenStorage = (value: string | null) => {
  if (typeof window === "undefined") return;

  const normalized = normalizeToken(value);
  writeToStorage(sessionStorage, ACCESS_TOKEN_STORAGE_KEY, normalized);
  writeToStorage(localStorage, ACCESS_TOKEN_STORAGE_KEY, null);
};

const writeStorage = (key: string, value: string | null, mode: TokenStorageMode) => {
  if (typeof window === "undefined") return;
  const normalized = normalizeToken(value);
  const targetStorage = mode === "local" ? localStorage : sessionStorage;
  const fallbackStorage = mode === "local" ? sessionStorage : localStorage;

  writeToStorage(targetStorage, key, normalized);
  writeToStorage(fallbackStorage, key, null);
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
    const parsed = JSON.parse(decoded) as {exp?: unknown;};
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return null;
    }
    return parsed.exp * 1000;
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string, skewMs = 0) => {
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
  authUserSnapshot = null;

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

    writeAccessTokenStorage(legacyAccessToken);
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
  }) => {
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
    setCookieSessionMode(null);
    writeAccessTokenStorage(tokens.access_token || null);

    const shouldStoreRefreshToken = options?.storeRefreshToken ?? true;

    writeStorage(
      REFRESH_TOKEN_STORAGE_KEY,
      shouldStoreRefreshToken ? tokens.refresh_token || null : null,
      mode
    );
    clearFromAllStorages(ALL_LEGACY_TOKEN_STORAGE_KEYS);
  },
  getSessionMode: () => getCookieSessionMode() || getTokenStorageMode(),
  hasSessionMarker: () => true,
  hasRefreshCapability: () => true,
  clearAccessToken: () => {
    inMemoryAccessToken = null;
    clearFromAllStorages([ACCESS_TOKEN_STORAGE_KEY]);
  },
  clear: (options?: { clearPersistentTokens?: boolean; notify?: boolean; }) =>
  clearRuntimeTokens(options)
};

export type ApiOptions = RequestInit & {
  skipJson?: boolean;
  disableResponseCache?: boolean;
};

interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string | ApiErrorPayload;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
  message: string,
  options: {status: number;code?: string;details?: unknown;})
  {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export interface ApiRequestAdapterRequest {
  path: string;
  url: string;
  method: string;
  options: ApiOptions;
  headers: Headers;
  body: RequestInit["body"] | undefined;
  hasExplicitAuthorization: boolean;
}

export interface ApiRequestAdapterResult<T = unknown> {
  handled: boolean;
  value?: T;
  error?: ApiError;
}

export type ApiRequestAdapter = <T = unknown>(
  request: ApiRequestAdapterRequest
) => Promise<ApiRequestAdapterResult<T>> | ApiRequestAdapterResult<T>;

const isObject = (value: unknown): value is Record<string, unknown> =>
typeof value === "object" && value !== null;

const isFormData = (value: unknown): value is FormData =>
typeof FormData !== "undefined" && value instanceof FormData;

const buildUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path;
  const safePath = normalizedPath.startsWith("/") ?
  normalizedPath :
  `/${normalizedPath}`;
  return `${API_BASE_URL}${safePath}`;
};

export const resolveApiUrl = (path: string) => buildUrl(path);

const NON_INVALIDATING_AUTH_PATHS = [
"/auth/signin",
"/auth/sign-in",
"/auth/signup",
"/auth/sign-up",
"/auth/refresh",
"/auth/session",
"/auth/google",
"/auth/google/callback",
"/auth/verify-email",
"/auth/demo"];


const isNonInvalidatingAuthPath = (path: string) => {
  const normalizedPath = path.toLowerCase();
  return NON_INVALIDATING_AUTH_PATHS.some((segment) =>
  normalizedPath.includes(segment)
  );
};
let apiRequestAdapter: ApiRequestAdapter | null = null;
let inflightAccessTokenRefresh: Promise<string | null> | null = null;
const inflightGetRequests = new Map<string, Promise<unknown>>();
const recentGetResponses = new Map<string, {value: unknown;expiresAt: number;}>();
const GET_RESPONSE_CACHE_TTL_MS = 3000;

const readCachedGetResponse = (key: string) => {
  const cached = recentGetResponses.get(key);
  if (!cached) {
    return { hit: false as const, value: undefined };
  }

  if (Date.now() > cached.expiresAt) {
    recentGetResponses.delete(key);
    return { hit: false as const, value: undefined };
  }

  return { hit: true as const, value: cached.value };
};

const writeCachedGetResponse = (key: string, value: unknown) => {
  recentGetResponses.set(key, {
    value,
    expiresAt: Date.now() + GET_RESPONSE_CACHE_TTL_MS
  });
};

export const ensureAccessToken = async (options?: { forceRefresh?: boolean }): Promise<string | null> => {
  const forceRefresh = options?.forceRefresh === true;
  const accessToken = authTokenStore.getAccessToken();
  if (!forceRefresh && accessToken && !isTokenExpired(accessToken, ACCESS_TOKEN_EXPIRY_SKEW_MS)) {
    return accessToken;
  }

  if (accessToken) {
    authTokenStore.clearAccessToken();
  }

  if (inflightAccessTokenRefresh) {
    return inflightAccessTokenRefresh;
  }

  inflightAccessTokenRefresh = (async () => {
    try {
      const response = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({}),
        credentials: "include",
        cache: "no-store"
      });
      const payload = await parseResponse(response);

      if (!response.ok) {
        const errorCode = getErrorCode(payload);
        if (response.status === 401 && isDefinitiveAuthExpiredCode(errorCode)) {
          authTokenStore.clear({ notify: true });
        }
        return null;
      }

      const sessionPayload = unwrapPayload<{
        tokens?: AuthTokens;
      }>(payload);
      const nextAccessToken = normalizeToken(sessionPayload?.tokens?.access_token);
      if (!nextAccessToken) {
        return null;
      }

      authTokenStore.setTokens(
        { access_token: nextAccessToken },
        { storeRefreshToken: false }
      );
      return nextAccessToken;
    } catch {
      return null;
    } finally {
      inflightAccessTokenRefresh = null;
    }
  })();

  return inflightAccessTokenRefresh;
};

export const setApiRequestAdapter = (adapter: ApiRequestAdapter | null) => {
  apiRequestAdapter = adapter;
};

const parseResponse = async (response: Response) => {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const getErrorMessage = (
payload: unknown,
fallback: string) =>
{
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (isObject(payload)) {
    const error = payload.error;
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
    if (isObject(error) && typeof error.message === "string") {
      return error.message;
    }
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }
  }

  return fallback;
};

const getErrorCode = (payload: unknown) => {
  if (!isObject(payload)) return undefined;
  const error = payload.error;
  if (isObject(error) && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
};

const DEFINITIVE_AUTH_EXPIRED_CODES = new Set([
  "SESSION_EXPIRED",
  "INVALID_REFRESH_TOKEN",
  "REFRESH_TOKEN_REUSED_OR_REVOKED",
  "SESSION_USER_NOT_FOUND"
]);

export const isDefinitiveAuthExpiredCode = (code?: string) =>
  typeof code === "string" && DEFINITIVE_AUTH_EXPIRED_CODES.has(code);

const getErrorDetails = (payload: unknown) => {
  if (!isObject(payload)) return undefined;
  const error = payload.error;
  if (isObject(error) && "details" in error) {
    return error.details;
  }
  return undefined;
};

const serializeRequestBody = (
body: RequestInit["body"] | undefined,
headers: Headers) =>
{
  if (typeof body === "undefined" || body === null) {
    return undefined;
  }

  if (
  typeof body === "string" ||
  body instanceof Blob ||
  body instanceof URLSearchParams ||
  body instanceof ArrayBuffer ||
  ArrayBuffer.isView(body) ||
  typeof ReadableStream !== "undefined" && body instanceof ReadableStream ||
  isFormData(body))
  {
    return body;
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return JSON.stringify(body);
};

const unwrapPayload = <T,>(payload: unknown): T => {
  if (!isObject(payload)) {
    return payload as T;
  }

  const envelope = payload as ApiEnvelope<T>;
  if (typeof envelope.success !== "boolean") {
    return payload as T;
  }

  if (!envelope.success) {
    throw new ApiError(getErrorMessage(payload, "Request failed"), {
      status: 400,
      code: getErrorCode(payload),
      details: getErrorDetails(payload)
    });
  }

  if (typeof envelope.data !== "undefined") {
    return envelope.data;
  }

  return payload as T;
};

export const apiRequest = async <T,>(
path: string,
options: ApiOptions = {})
: Promise<T> => {
  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});
  const hasExplicitAuthorization = headers.has("Authorization");
  const method = (options.method || "GET").toUpperCase();

  if (apiRequestAdapter) {
    const adapterResult = await apiRequestAdapter<T>({
      path,
      url,
      method,
      options,
      headers,
      body: options.body,
      hasExplicitAuthorization
    });

    if (adapterResult.handled) {
      if (adapterResult.error) {
        throw adapterResult.error;
      }
      if (method !== "GET") {
        recentGetResponses.clear();
      }
      return adapterResult.value as T;
    }
  }

  if (shouldBlockViewerMutation(path, method)) {
    throw new ApiError(NO_PERMISSION_MESSAGE, {
      status: 403,
      code: "VIEWER_READ_ONLY"
    });
  }

  if (shouldBlockPlanLockedMutation(path, method)) {
    throw new ApiError(
      "Gói Trial đã hết hạn dùng thử. Vui lòng nâng cấp gói để tiếp tục thao tác.",
      {
        status: 403,
        code: "PLAN_LOCKED"
      }
    );
  }

  if (!hasExplicitAuthorization && !isNonInvalidatingAuthPath(path)) {
    const accessToken = await ensureAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const body = serializeRequestBody(options.body, headers);
  const dedupeKey =
  method === "GET" && !options.disableResponseCache ?
  `${url}|auth=${headers.get("Authorization") || ""}` :
  null;

  const executeRequest = async (): Promise<T> => {
    const doFetch = async (requestHeaders: Headers) => {
      const response = await fetch(url, {
        ...options,
        headers: requestHeaders,
        body,
        credentials: "include",
        cache: options.cache ?? "no-store"
      });
      const payload = await parseResponse(response);
      return { response, payload };
    };

    let { response, payload } = await doFetch(headers);

    if (
      response.status === 401 &&
      !hasExplicitAuthorization &&
      !isNonInvalidatingAuthPath(path)
    ) {
      const refreshedAccessToken = await ensureAccessToken({ forceRefresh: true });
      if (refreshedAccessToken) {
        const retryHeaders = new Headers(headers);
        retryHeaders.set("Authorization", `Bearer ${refreshedAccessToken}`);
        const retryResult = await doFetch(retryHeaders);
        response = retryResult.response;
        payload = retryResult.payload;
      }
    }

    if (!response.ok) {
      const errorCode = getErrorCode(payload);
      if (
        response.status === 401 &&
        !hasExplicitAuthorization &&
        !isNonInvalidatingAuthPath(path) &&
        isDefinitiveAuthExpiredCode(errorCode))
      {
        authTokenStore.clear({ notify: true });
      }

      throw new ApiError(getErrorMessage(payload, response.statusText), {
        status: response.status,
        code: errorCode,
        details: getErrorDetails(payload)
      });
    }

    return unwrapPayload<T>(payload);
  };

  if (!dedupeKey) {
    const response = await executeRequest();

    if (method !== "GET") {
      recentGetResponses.clear();
    }
    return response;
  }

  const cachedResponse = readCachedGetResponse(dedupeKey);
  if (cachedResponse.hit) {
    return cachedResponse.value as T;
  }

  const existingRequest = inflightGetRequests.get(dedupeKey);
  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  const requestPromise = executeRequest() as Promise<unknown>;
  inflightGetRequests.set(dedupeKey, requestPromise);
  try {
    const result = (await requestPromise) as T;
    writeCachedGetResponse(dedupeKey, result);
    return result;
  } finally {
    inflightGetRequests.delete(dedupeKey);
  }
};

export const api = {
  get: <T,>(path: string, options: Omit<ApiOptions, "method" | "body"> = {}) =>
  apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T,>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: "POST",
    body: body as RequestInit["body"]
  }),
  patch: <T,>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: "PATCH",
    body: body as RequestInit["body"]
  }),
  put: <T,>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: "PUT",
    body: body as RequestInit["body"]
  }),
  delete: <T,>(path: string) => apiRequest<T>(path, { method: "DELETE" })
};

export const isApiError = (error: unknown): error is ApiError =>
error instanceof ApiError;

export const isUnauthorizedApiError = (error: unknown) => {
  if (isApiError(error)) {
    return (
      error.status === 401 ||
      error.code === "UNAUTHORIZED" ||
      error.code === "INVALID_TOKEN" ||
      error.code === "TOKEN_EXPIRED");

  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("unauthorized") || message.includes("invalid token");
  }

  return false;
};
