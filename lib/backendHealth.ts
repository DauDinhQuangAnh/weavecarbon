import { headers } from "next/headers";
import { env } from "@/lib/env";

const DEFAULT_API_BASE_URL = "/api";
const HEALTH_PATH = "/health";
const HEALTH_TIMEOUT_MS = 2500;

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

export interface BackendHealthResult {
  healthy: boolean;
  healthUrl: string;
  status: string;
  message: string | null;
}

export const getBackendHealth = async (): Promise<BackendHealthResult> => {
  const healthUrl = await resolveHealthUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    const payload = await response
      .json()
      .catch(() => null);

    const status = parseHealthStatus(payload) || (response.ok ? "healthy" : "unhealthy");
    const healthy = response.ok && status.toLowerCase() === "healthy";

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
  } finally {
    clearTimeout(timeout);
  }
};
