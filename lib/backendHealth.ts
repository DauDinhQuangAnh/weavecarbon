import { headers } from "next/headers";
import { env } from "@/lib/env";
import { fetchWithPolicy } from "@/lib/http/requestPolicy";

const DEFAULT_API_BASE_URL = "/api";
const HEALTH_PATH = "/health";
const HEALTH_TIMEOUT_MS = 2500;
const HEALTHY_CACHE_TTL_MS = 30_000;
const UNHEALTHY_CACHE_TTL_MS = 5_000;
const MAX_HEALTH_CACHE_ENTRIES = 8;

type HealthCacheEntry = {
  expiresAt: number;
  promise: Promise<BackendHealthResult>;
};

const healthCache = new Map<string, HealthCacheEntry>();

const trimTrailingSlashes = (value: string) => value.trim().replace(/\/+$/, "");

const normalizeApiBaseUrl = (value: string) => {
  const trimmed = trimTrailingSlashes(value);
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const isAbsoluteUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://");

const resolveRequestOrigin = async () => {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost || headerStore.get("host") || "localhost:3000";
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol =
    forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
};

const resolveHealthUrl = async () => {
  const configuredHealthUrl = trimTrailingSlashes(process.env.BACKEND_HEALTH_URL || "");
  if (configuredHealthUrl) {
    if (isAbsoluteUrl(configuredHealthUrl)) {
      return configuredHealthUrl;
    }

    const origin = await resolveRequestOrigin();
    return new URL(configuredHealthUrl.startsWith("/") ? configuredHealthUrl : `/${configuredHealthUrl}`, origin).toString();
  }

  const normalizedApiBase = normalizeApiBaseUrl(
    env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
  );
  const backendBase = normalizedApiBase.replace(/\/api$/, "");

  if (isAbsoluteUrl(backendBase)) {
    return `${backendBase}${HEALTH_PATH}`;
  }

  const origin = await resolveRequestOrigin();
  const normalizedHealthPath = backendBase ? `${backendBase}${HEALTH_PATH}` : HEALTH_PATH;
  return new URL(normalizedHealthPath, origin).toString();
};

const parseHealthStatus = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typedPayload = payload as {
    status?: unknown;
    data?: {
      status?: unknown;
    };
  };

  if (typeof typedPayload.data?.status === "string") {
    return typedPayload.data.status;
  }

  if (typeof typedPayload.status === "string") {
    return typedPayload.status;
  }

  return null;
};

export const isBackendHealthyStatus = (status: string) =>
  ["healthy", "ready"].includes(status.trim().toLowerCase());

export interface BackendHealthResult {
  healthy: boolean;
  healthUrl: string;
  status: string;
  message: string | null;
}

const requestBackendHealth = async (
  healthUrl: string
): Promise<BackendHealthResult> => {
  try {
    const response = await fetchWithPolicy(healthUrl, {
      method: "GET",
      cache: "no-store"
    }, {
      retries: 0,
      timeoutMs: HEALTH_TIMEOUT_MS
    });

    const payload = await response
      .json()
      .catch(() => null);

    const status = parseHealthStatus(payload) || (response.ok ? "healthy" : "unhealthy");
    const healthy = response.ok && isBackendHealthyStatus(status);

    return {
      healthy,
      healthUrl,
      status,
      message: healthy ? null : "Backend returned a non-healthy status."
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Backend health check failed.";

    return {
      healthy: false,
      healthUrl,
      status: "unreachable",
      message
    };
  }
};

export const clearBackendHealthCache = () => {
  healthCache.clear();
};

export const getBackendHealth = async (): Promise<BackendHealthResult> => {
  const healthUrl = await resolveHealthUrl();
  const now = Date.now();
  const cached = healthCache.get(healthUrl);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }
  if (cached) {
    healthCache.delete(healthUrl);
  }

  const request = requestBackendHealth(healthUrl).then((result) => {
    const current = healthCache.get(healthUrl);
    if (current?.promise === request) {
      current.expiresAt = Date.now() + (
        result.healthy ? HEALTHY_CACHE_TTL_MS : UNHEALTHY_CACHE_TTL_MS
      );
    }
    return result;
  });

  healthCache.set(healthUrl, {
    expiresAt: now + HEALTHY_CACHE_TTL_MS,
    promise: request
  });

  while (healthCache.size > MAX_HEALTH_CACHE_ENTRIES) {
    const oldestKey = healthCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    healthCache.delete(oldestKey);
  }

  return request;
};
