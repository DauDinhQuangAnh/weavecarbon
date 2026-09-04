export interface ClientCachePolicy {
  owner: string;
  resource: string;
  ttlMs: number;
  version: number;
}

export interface ClientCacheScope {
  companyId?: string | null;
  userId?: string | null;
}

interface ClientCacheEnvelope<T> {
  cachedAt: number;
  expiresAt: number;
  value: T;
  version: number;
}

const MINUTE_MS = 60_000;

export const CLIENT_CACHE_POLICIES = Object.freeze({
  productCatalog: Object.freeze({
    owner: "ProductProvider",
    resource: "product-catalog",
    ttlMs: 5 * MINUTE_MS,
    version: 2
  }),
  batchCatalog: Object.freeze({
    owner: "BatchProvider",
    resource: "batch-catalog",
    ttlMs: 3 * MINUTE_MS,
    version: 2
  }),
  shipmentCatalog: Object.freeze({
    owner: "ShipmentProvider",
    resource: "shipment-catalog",
    ttlMs: 2 * MINUTE_MS,
    version: 2
  }),
  summaryProductPrefetch: Object.freeze({
    owner: "ProductsClient",
    resource: "summary-product-prefetch",
    ttlMs: 5 * MINUTE_MS,
    version: 2
  })
} satisfies Record<string, ClientCachePolicy>);

const normalizeKeyPart = (value: string | null | undefined, fallback: string) => {
  const normalized = String(value || "").trim();
  return normalized ? encodeURIComponent(normalized) : fallback;
};

export const buildClientCacheKey = (
  policy: ClientCachePolicy,
  scope: ClientCacheScope
) => [
  "weavecarbon-cache",
  `v${policy.version}`,
  policy.resource,
  normalizeKeyPart(scope.userId, "anonymous"),
  normalizeKeyPart(scope.companyId, "no-company")
].join(":");

export const readSessionCache = <T,>(
  key: string,
  policy: ClientCachePolicy,
  now = Date.now()
): T | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const envelope = JSON.parse(raw) as Partial<ClientCacheEnvelope<T>>;
    const isValid =
      envelope.version === policy.version &&
      typeof envelope.cachedAt === "number" &&
      typeof envelope.expiresAt === "number" &&
      envelope.expiresAt > now &&
      "value" in envelope;

    if (!isValid) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return envelope.value as T;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
};

export const writeSessionCache = <T,>(
  key: string,
  policy: ClientCachePolicy,
  value: T,
  now = Date.now()
) => {
  if (typeof window === "undefined") return;

  const envelope: ClientCacheEnvelope<T> = {
    cachedAt: now,
    expiresAt: now + policy.ttlMs,
    value,
    version: policy.version
  };

  try {
    window.sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Best-effort navigation cache; the API remains authoritative.
  }
};

export const removeSessionCache = (key: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
};
