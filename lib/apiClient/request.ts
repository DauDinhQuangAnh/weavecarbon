import { env } from "@/lib/env";
import { normalizeToken } from "./storageUtils";
import { authTokenStore, isTokenExpired, ACCESS_TOKEN_EXPIRY_SKEW_MS } from "./tokenStore";
import { syncAuthUserSnapshotFromPayload } from "./authSnapshot";
import { shouldBlockViewerMutation, shouldBlockPlanLockedMutation } from "./guards";
import {
  getApiSessionEpoch,
  inflightGetRequests,
  invalidateApiResponseCache,
  readCachedGetResponse,
  writeCachedGetResponse
} from "./cache";
import { NO_PERMISSION_MESSAGE } from "@/lib/permissions";

const DEFAULT_API_BASE_URL = "/api";

const normalizeBaseUrl = (baseUrl: string) => {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

export const API_BASE_URL = normalizeBaseUrl(
  env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
);

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
    options: { status: number; code?: string; details?: unknown }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

export const isUnauthorizedApiError = (error: unknown) => {
  if (isApiError(error)) {
    return (
      error.status === 401 ||
      error.code === "UNAUTHORIZED" ||
      error.code === "INVALID_TOKEN" ||
      error.code === "TOKEN_EXPIRED"
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("unauthorized") || message.includes("invalid token");
  }

  return false;
};

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
  "/auth/google",
  "/auth/google/callback",
  "/auth/verify-email",
  "/auth/demo"
];

const isNonInvalidatingAuthPath = (path: string) => {
  const normalizedPath = path.toLowerCase();
  return NON_INVALIDATING_AUTH_PATHS.some((segment) =>
    normalizedPath.includes(segment)
  );
};

const isAuthSessionPath = (path: string) =>
  path.toLowerCase().includes("/auth/session");

const shouldRetryWithForcedRefresh = ({
  hasExplicitAuthorization,
  path,
  status
}: {
  hasExplicitAuthorization: boolean;
  path: string;
  status: number;
}) =>
  status === 401 &&
  !hasExplicitAuthorization &&
  !isNonInvalidatingAuthPath(path) &&
  !isAuthSessionPath(path);

let apiRequestAdapter: ApiRequestAdapter | null = null;
let inflightAccessTokenRefresh: Promise<string | null> | null = null;

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
  fallback: string
) => {
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
  "SESSION_USER_NOT_FOUND",
  "INVALID_TOKEN"
]);

const COOKIE_SESSION_MISSING_CODES = new Set(["NO_ACTIVE_SESSION"]);

export const isDefinitiveAuthExpiredCode = (code?: string) =>
  typeof code === "string" && DEFINITIVE_AUTH_EXPIRED_CODES.has(code);

export const isCookieSessionMissingCode = (code?: string) =>
  typeof code === "string" && COOKIE_SESSION_MISSING_CODES.has(code);

const shouldClearAuthForRequestFailure = ({
  errorCode,
  hasExplicitAuthorization,
  path,
  status
}: {
  errorCode?: string;
  hasExplicitAuthorization: boolean;
  path: string;
  status: number;
}) =>
  status === 401 &&
  !hasExplicitAuthorization &&
  !isNonInvalidatingAuthPath(path) &&
  isDefinitiveAuthExpiredCode(errorCode) &&
  !isCookieSessionMissingCode(errorCode);

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
  headers: Headers
) => {
  if (typeof body === "undefined" || body === null) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) ||
    isFormData(body)
  ) {
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

export const ensureAccessToken = async (options?: { forceRefresh?: boolean }): Promise<string | null> => {
  const forceRefresh = options?.forceRefresh === true;
  const accessToken = authTokenStore.getAccessToken();
  if (!forceRefresh && accessToken && !isTokenExpired(accessToken, ACCESS_TOKEN_EXPIRY_SKEW_MS)) {
    return accessToken;
  }

  if (inflightAccessTokenRefresh) {
    return inflightAccessTokenRefresh;
  }

  const refreshToken = authTokenStore.getRefreshToken();
  if (!refreshToken && !authTokenStore.hasSessionMarker()) {
    return null;
  }

  inflightAccessTokenRefresh = (async () => {
    try {
      const response = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
        credentials: "include",
        cache: "no-store"
      });
      const payload = await parseResponse(response);

      if (!response.ok) {
        const errorCode = getErrorCode(payload);
        // 401 on /auth/refresh always means session is definitively dead — clear regardless of error code
        if (response.status === 401 || isDefinitiveAuthExpiredCode(errorCode)) {
          authTokenStore.clear({ notify: true });
          invalidateApiResponseCache("refresh-expired");
        }
        return null;
      }

      const sessionPayload = unwrapPayload<{
        tokens?: { access_token?: string; refresh_token?: string };
      }>(payload);
      const nextAccessToken = normalizeToken(sessionPayload?.tokens?.access_token);
      if (!nextAccessToken) {
        return null;
      }

      authTokenStore.setTokens(
        {
          access_token: nextAccessToken,
          refresh_token: normalizeToken(sessionPayload?.tokens?.refresh_token) || refreshToken || undefined
        },
        { persist: false, storageScope: "storage", storeRefreshToken: true }
      );
      syncAuthUserSnapshotFromPayload(sessionPayload);
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
  invalidateApiResponseCache("adapter-changed");
};

export const apiRequest = async <T,>(
  path: string,
  options: ApiOptions = {}
): Promise<T> => {
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
        invalidateApiResponseCache("adapter-mutation");
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
      `${url}|epoch=${getApiSessionEpoch()}|auth=${headers.get("Authorization") || ""}` :
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

    if (shouldRetryWithForcedRefresh({
      hasExplicitAuthorization,
      path,
      status: response.status
    })) {
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
      if (shouldClearAuthForRequestFailure({
        errorCode,
        hasExplicitAuthorization,
        path,
        status: response.status
      })) {
        authTokenStore.clear({ notify: true });
        invalidateApiResponseCache("request-auth-expired");
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
      invalidateApiResponseCache("mutation");
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
