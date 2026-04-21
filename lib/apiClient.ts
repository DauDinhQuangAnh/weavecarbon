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

export interface AuthTokens {
  access_token?: string;
  refresh_token?: string;
}

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

const getStoredCompanyRole = () => {
  if (typeof window === "undefined") return null;
  const rawUser = readFromStorage(localStorage, USER_STORAGE_KEY);
  if (!rawUser) return null;

  try {
    const parsedUser = JSON.parse(rawUser) as Record<string, unknown>;
    const userTypeRaw = parsedUser.user_type ?? parsedUser.userType;
    const fallbackRole =
    userTypeRaw === "admin" ? "root" : "member";
    const membership =
    typeof parsedUser.company_membership === "object" &&
    parsedUser.company_membership !== null ?
    parsedUser.company_membership as Record<string, unknown> :
    null;

    const resolvedRole = resolveCompanyRole(
      {
        role:
        parsedUser.company_role ??
        parsedUser.companyRole ??
        parsedUser.role ??
        membership?.role,
        isRoot:
        parsedUser.is_root ??
        parsedUser.isRoot ??
        membership?.is_root ??
        membership?.isRoot
      },
      fallbackRole
    );

    return resolvedRole;
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

const hasSessionModeMarker = () => {
  return getCookieSessionMode() !== null;
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

export const authTokenStore = {
  getAccessToken: () => {
    const accessToken = readAccessTokenStorage();
    if (accessToken && !isTokenExpired(accessToken)) {
      return accessToken;
    }

    if (accessToken) {
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
    const refreshToken = readStorage(REFRESH_TOKEN_STORAGE_KEY);
    if (refreshToken && !isTokenExpired(refreshToken)) {
      return refreshToken;
    }

    if (refreshToken) {
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
    cookieBacked?: boolean;
    storeRefreshToken?: boolean;
  }) => {
    if (!tokens) {
      clearFromAllStorages([ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY]);
      clearFromAllStorages([COOKIE_SESSION_MODE_KEY]);
      clearFromAllStorages([TOKEN_STORAGE_MODE_KEY]);
      clearFromAllStorages(ALL_LEGACY_TOKEN_STORAGE_KEYS);
      return;
    }

    const mode: TokenStorageMode =
    typeof options?.persist === "boolean" ?
    options.persist ?
    "local" :
    "session" :
    getTokenStorageMode();

    setTokenStorageMode(mode);
    setCookieSessionMode(options?.cookieBacked ? mode : null);
    writeAccessTokenStorage(tokens.access_token || null);

    const shouldStoreRefreshToken =
    options?.storeRefreshToken ??
    !(options?.cookieBacked);

    writeStorage(
      REFRESH_TOKEN_STORAGE_KEY,
      shouldStoreRefreshToken ? tokens.refresh_token || null : null,
      mode
    );
    clearFromAllStorages(ALL_LEGACY_TOKEN_STORAGE_KEYS);
  },
  getSessionMode: () => getCookieSessionMode() || getTokenStorageMode(),
  hasSessionMarker: () => hasSessionModeMarker(),
  hasRefreshCapability: () =>
  hasSessionModeMarker() || Boolean(authTokenStore.getRefreshToken()),
  clear: () => {
    clearFromAllStorages([ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY]);
    clearFromAllStorages([COOKIE_SESSION_MODE_KEY]);
    clearFromAllStorages([TOKEN_STORAGE_MODE_KEY]);
    clearFromAllStorages(ALL_LEGACY_TOKEN_STORAGE_KEYS);
  }
};

export type ApiOptions = RequestInit & {
  skipJson?: boolean;
  disableResponseCache?: boolean;
};

type InternalApiOptions = ApiOptions & {
  _retryAfterRefresh?: boolean;
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

const AUTH_REFRESH_PATH = "/auth/refresh";
const NON_REFRESHABLE_AUTH_PATHS = [
"/auth/signin",
"/auth/sign-in",
"/auth/signup",
"/auth/sign-up",
"/auth/refresh",
"/auth/google",
"/auth/google/callback",
"/auth/verify-email",
"/auth/demo"];


const isNonRefreshableAuthPath = (path: string) => {
  const normalizedPath = path.toLowerCase();
  return NON_REFRESHABLE_AUTH_PATHS.some((segment) =>
  normalizedPath.includes(segment)
  );
};

const isReplayableBody = (body: RequestInit["body"] | undefined) => {
  if (typeof body === "undefined" || body === null) return true;
  if (typeof body === "string") return true;
  if (body instanceof Blob) return true;
  if (body instanceof URLSearchParams) return true;
  if (body instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(body)) return true;
  if (isFormData(body)) return true;
  return false;
};

const shouldAttemptTokenRefresh = (params: {
  path: string;
  method?: string;
  hasExplicitAuthorization: boolean;
  body: RequestInit["body"] | undefined;
  alreadyRetried: boolean;
}) => {
  if (params.alreadyRetried) return false;
  if (params.hasExplicitAuthorization) return false;
  if (!isReplayableBody(params.body)) return false;
  if (!authTokenStore.hasRefreshCapability()) return false;
  if ((params.method || "GET").toUpperCase() === "OPTIONS") return false;

  if (isNonRefreshableAuthPath(params.path)) {
    return false;
  }

  return true;
};

const extractTokensFromPayload = (payload: unknown): AuthTokens | null => {
  if (!isObject(payload)) return null;

  const dataCandidate = isObject(payload.data) ? payload.data : payload;
  const tokenCandidate = isObject(dataCandidate.tokens) ?
  dataCandidate.tokens :
  dataCandidate;

  const accessToken =
  typeof tokenCandidate.access_token === "string" ?
  tokenCandidate.access_token :
  undefined;
  const refreshToken =
  typeof tokenCandidate.refresh_token === "string" ?
  tokenCandidate.refresh_token :
  undefined;

  if (!accessToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken
  };
};

let refreshInFlight: Promise<AuthTokens | null> | null = null;
let apiRequestAdapter: ApiRequestAdapter | null = null;
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

const refreshAccessToken = async (): Promise<AuthTokens | null> => {
  const refreshToken = authTokenStore.getRefreshToken();
  const hasCookieBackedSession = authTokenStore.hasSessionMarker();

  if (!refreshToken && !hasCookieBackedSession) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const requestBody =
        refreshToken ?
        JSON.stringify({ refresh_token: refreshToken }) :
        undefined;
        const response = await fetch(buildUrl(AUTH_REFRESH_PATH), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          cache: "no-store",
          body: requestBody
        });

        const payload = await parseResponse(response);
        if (!response.ok) {
          authTokenStore.clear();
          return null;
        }

        const nextTokens = extractTokensFromPayload(payload);
        if (!nextTokens?.access_token) {
          authTokenStore.clear();
          return null;
        }

        const normalizedTokens: AuthTokens = {
          access_token: nextTokens.access_token,
          refresh_token: nextTokens.refresh_token || refreshToken || undefined
        };
        authTokenStore.setTokens(normalizedTokens, {
          persist: authTokenStore.getSessionMode() === "local",
          cookieBacked: hasCookieBackedSession,
          storeRefreshToken: !hasCookieBackedSession
        });
        return normalizedTokens;
      } catch {
        authTokenStore.clear();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
};

export const ensureAccessToken = async (): Promise<string | null> => {
  const accessToken = authTokenStore.getAccessToken();
  if (accessToken && !isTokenExpired(accessToken, ACCESS_TOKEN_EXPIRY_SKEW_MS)) {
    return accessToken;
  }

  if (accessToken) {
    clearFromAllStorages([ACCESS_TOKEN_STORAGE_KEY]);
  }

  if (!authTokenStore.hasRefreshCapability()) {
    return null;
  }

  const refreshedTokens = await refreshAccessToken();
  return normalizeToken(refreshedTokens?.access_token);
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
  const internalOptions = options as InternalApiOptions;
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

  if (!hasExplicitAuthorization) {
    const accessToken = isNonRefreshableAuthPath(path) ?
    authTokenStore.getAccessToken() :
    await ensureAccessToken();
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
    shouldAttemptTokenRefresh({
      path,
      method: options.method,
      hasExplicitAuthorization,
      body,
      alreadyRetried: Boolean(internalOptions._retryAfterRefresh)
    }))
    {
      const refreshedTokens = await refreshAccessToken();
      if (refreshedTokens?.access_token) {
        const retryHeaders = new Headers(headers);
        retryHeaders.set("Authorization", `Bearer ${refreshedTokens.access_token}`);
        ({ response, payload } = await doFetch(retryHeaders));
      }
    }

    if (!response.ok) {
      throw new ApiError(getErrorMessage(payload, response.statusText), {
        status: response.status,
        code: getErrorCode(payload),
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
