// Barrel re-export — keeps `@/lib/apiClient` as the stable import path while
// the implementation lives in ./apiClient/*. Split for Phase 6 of the
// technical-debt roadmap (was a single ~1230-line file).
export {
  AUTH_INVALIDATED_EVENT,
  AUTH_INVALIDATED_STORAGE_KEY,
  authTokenStore,
  clearPersistedAuthState,
  type AuthTokens
} from "./apiClient/tokenStore";

export {
  readAuthUserSnapshot,
  setAuthUserSnapshot,
  syncAuthUserSnapshotFromPayload
} from "./apiClient/authSnapshot";

export {
  invalidateApiResponseCache,
  setApiSessionEpoch
} from "./apiClient/cache";

export {
  API_BASE_URL,
  ApiError,
  isApiError,
  isUnauthorizedApiError,
  isDefinitiveAuthExpiredCode,
  isCookieSessionMissingCode,
  resolveApiUrl,
  ensureAccessToken,
  setApiRequestAdapter,
  apiRequest,
  type ApiOptions,
  type ApiRequestAdapter,
  type ApiRequestAdapterRequest,
  type ApiRequestAdapterResult
} from "./apiClient/request";

import { apiRequest as _apiRequest, type ApiOptions as _ApiOptions } from "./apiClient/request";

export const api = {
  get: <T,>(path: string, options: Omit<_ApiOptions, "method" | "body"> = {}) =>
    _apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T,>(path: string, body?: unknown) =>
    _apiRequest<T>(path, {
      method: "POST",
      body: body as RequestInit["body"]
    }),
  patch: <T,>(path: string, body?: unknown) =>
    _apiRequest<T>(path, {
      method: "PATCH",
      body: body as RequestInit["body"]
    }),
  put: <T,>(path: string, body?: unknown) =>
    _apiRequest<T>(path, {
      method: "PUT",
      body: body as RequestInit["body"]
    }),
  delete: <T,>(path: string) => _apiRequest<T>(path, { method: "DELETE" })
};
