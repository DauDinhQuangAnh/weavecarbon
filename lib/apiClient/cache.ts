import { buildAuthSnapshotEpoch, readAuthUserSnapshot } from "./authSnapshot";

let apiSessionEpoch = "anonymous";

export const inflightGetRequests = new Map<string, Promise<unknown>>();
const recentGetResponses = new Map<string, { value: unknown; expiresAt: number }>();
const GET_RESPONSE_CACHE_TTL_MS = 3000;

export const invalidateApiResponseCache = (reason?: string) => {
  void reason;
  recentGetResponses.clear();
  inflightGetRequests.clear();
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

export const writeCachedGetResponse = (key: string, value: unknown) => {
  recentGetResponses.set(key, {
    value,
    expiresAt: Date.now() + GET_RESPONSE_CACHE_TTL_MS
  });
};
