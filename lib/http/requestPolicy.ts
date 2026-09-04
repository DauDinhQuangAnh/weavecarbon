const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 250;
const MAX_RETRY_AFTER_MS = 5_000;

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface HttpRequestPolicy {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export class HttpTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "HttpTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

const normalizeBoundedInteger = (
  value: number | undefined,
  fallback: number,
  maximum: number
) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(0, Math.trunc(value)));
};

const parseRetryAfterMs = (response: Response) => {
  const rawValue = response.headers.get("retry-after");
  if (!rawValue) return null;

  const seconds = Number(rawValue);
  if (Number.isFinite(seconds)) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, seconds * 1000));
  }

  const retryAt = Date.parse(rawValue);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAt - Date.now()));
};

const waitForRetry = (delayMs: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);

    const handleAbort = () => {
      globalThis.clearTimeout(timeout);
      signal.removeEventListener("abort", handleAbort);
      reject(signal.reason);
    };

    signal.addEventListener("abort", handleAbort, { once: true });
  });

/**
 * Shared bounded transport for browser and server HTTP calls.
 *
 * Retries are deliberately restricted to idempotent methods and transient
 * statuses. One timeout covers the complete operation, including backoff, so a
 * slow dependency cannot keep a route alive indefinitely.
 */
export const fetchWithPolicy = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  policy: HttpRequestPolicy = {}
) => {
  const method = (init.method || "GET").toUpperCase();
  const timeoutMs = normalizeBoundedInteger(
    policy.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    120_000
  );
  const retries = RETRYABLE_METHODS.has(method)
    ? normalizeBoundedInteger(policy.retries, 1, 3)
    : 0;
  const retryDelayMs = normalizeBoundedInteger(
    policy.retryDelayMs,
    DEFAULT_RETRY_DELAY_MS,
    MAX_RETRY_AFTER_MS
  );

  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let timedOut = false;

  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) {
    abortFromUpstream();
  } else {
    upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  }

  const timeout = timeoutMs > 0
    ? globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : null;

  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal
        });

        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt >= retries) {
          return response;
        }

        await response.body?.cancel().catch(() => undefined);
        const retryAfterMs = parseRetryAfterMs(response);
        await waitForRetry(
          retryAfterMs ?? retryDelayMs * Math.pow(2, attempt),
          controller.signal
        );
      } catch (error) {
        if (controller.signal.aborted) {
          if (timedOut) throw new HttpTimeoutError(timeoutMs);
          if (upstreamSignal?.aborted) throw upstreamSignal.reason ?? error;
          throw error;
        }

        if (attempt >= retries) throw error;
        await waitForRetry(retryDelayMs * Math.pow(2, attempt), controller.signal);
      }
    }
  } finally {
    if (timeout !== null) globalThis.clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
};

export const createCorrelationId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `wc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const HTTP_REQUEST_DEFAULTS = Object.freeze({
  retryDelayMs: DEFAULT_RETRY_DELAY_MS,
  retries: 1,
  timeoutMs: DEFAULT_TIMEOUT_MS
});
