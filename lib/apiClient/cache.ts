import { buildAuthSnapshotEpoch, readAuthUserSnapshot } from "./authSnapshot";

let apiSessionEpoch = "anonymous";

export const inflightGetRequests = new Map<string, Promise<unknown>>();
const recentGetResponses = new Map<
  string,
  { value: unknown; expiresAt: number; tags: readonly string[] }
>();
export const GET_RESPONSE_CACHE_TTL_MS = 3000;

export const invalidateApiResponseCache = (
  reason?: string,
  tags?: readonly string[]
) => {
  void reason;
  inflightGetRequests.clear();
  if (tags?.length) {
    const selectedTags = new Set(tags);
    for (const [key, entry] of recentGetResponses) {
      if (entry.tags.some((tag) => selectedTags.has(tag))) {
        recentGetResponses.delete(key);
      }
    }
    return;
  }

  recentGetResponses.clear();
};

export const resetApiSessionEpochState = () => {
  apiSessionEpoch = "anonymous";
};

export const setApiSessionEpoch = (epoch: {
  authStatus?: string | null;
  companyId?: string | null;
  userId?: string | null;
}) => {
  const nextEpoch = [
    epoch.authStatus || "unknown",
    epoch.userId || "anonymous",
    epoch.companyId || "no-company"
  ].join(":");

  if (nextEpoch === apiSessionEpoch) {
    return;
  }

  apiSessionEpoch = nextEpoch;
  invalidateApiResponseCache("session-epoch-changed");
};

export const getApiSessionEpoch = () => (
  apiSessionEpoch === "anonymous" ?
    buildAuthSnapshotEpoch(readAuthUserSnapshot()) :
    apiSessionEpoch
);

export const readCachedGetResponse = (key: string) => {
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

export const writeCachedGetResponse = (
  key: string,
  value: unknown,
  options?: { tags?: readonly string[]; ttlMs?: number }
) => {
  const ttlMs = typeof options?.ttlMs === "number" && Number.isFinite(options.ttlMs)
    ? Math.max(0, Math.min(60_000, options.ttlMs))
    : GET_RESPONSE_CACHE_TTL_MS;

  recentGetResponses.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    tags: options?.tags ? [...new Set(options.tags)] : []
  });
};
