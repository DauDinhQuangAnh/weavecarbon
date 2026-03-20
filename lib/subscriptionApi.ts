import { api, authTokenStore } from "@/lib/apiClient";
import { writeSubscriptionLockState } from "@/lib/subscriptionLockState";
import {
  resolveSubscriptionState,
  type SubscriptionApiPayload,
} from "@/lib/subscriptionState";

const SUBSCRIPTION_CACHE_TTL_MS = 5000;

type SubscriptionCacheEntry = {
  authKey: string;
  expiresAt: number;
  value: SubscriptionApiPayload;
};

type SubscriptionInflightEntry = {
  authKey: string;
  promise: Promise<SubscriptionApiPayload>;
};

let cachedSubscription: SubscriptionCacheEntry | null = null;
let inflightSubscription: SubscriptionInflightEntry | null = null;

const getSubscriptionAuthKey = () => {
  if (typeof window === "undefined") return "server";
  return (
    authTokenStore.getAccessToken() ||
    authTokenStore.getRefreshToken() ||
    "anonymous"
  );
};

const canUseCachedSubscription = (
  entry: SubscriptionCacheEntry | null,
  authKey: string
) => {
  if (!entry) return false;
  if (entry.authKey !== authKey) return false;
  return entry.expiresAt > Date.now();
};

const syncSubscriptionLockState = (payload: SubscriptionApiPayload) => {
  if (typeof window === "undefined") return;

  const resolved = resolveSubscriptionState(payload);
  writeSubscriptionLockState({
    current_plan: resolved.plan,
    trial_ends_at: resolved.trialEndsAt,
    trial_expired: resolved.trialExpired,
    features_locked: resolved.featuresLocked,
  });
};

export const invalidateSubscriptionApiCache = () => {
  cachedSubscription = null;
  inflightSubscription = null;
};

export const getSubscriptionApiPayload = async <
  T extends SubscriptionApiPayload = SubscriptionApiPayload,
>(
  options?: { force?: boolean }
): Promise<T> => {
  const authKey = getSubscriptionAuthKey();
  const force = options?.force === true;
  const cachedEntry = cachedSubscription;
  const inflightEntry = inflightSubscription;

  if (cachedEntry && !force && canUseCachedSubscription(cachedEntry, authKey)) {
    return cachedEntry.value as T;
  }

  if (inflightEntry && inflightEntry.authKey === authKey) {
    return inflightEntry.promise as Promise<T>;
  }

  const request = api
    .get<T>(
      "/subscription",
      force ? { disableResponseCache: true } : undefined
    )
    .then((payload) => {
      cachedSubscription = {
        authKey,
        expiresAt: Date.now() + SUBSCRIPTION_CACHE_TTL_MS,
        value: payload,
      };
      syncSubscriptionLockState(payload);
      return payload;
    })
    .finally(() => {
      if (inflightSubscription?.promise === request) {
        inflightSubscription = null;
      }
    });

  inflightSubscription = {
    authKey,
    promise: request,
  };

  return request;
};
