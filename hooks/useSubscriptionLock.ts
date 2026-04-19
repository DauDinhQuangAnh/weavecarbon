"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readSubscriptionLockState,
  isSubscriptionLocked,
  SUBSCRIPTION_LOCK_STATE_CHANGED_EVENT,
  SUBSCRIPTION_LOCK_STATE_KEY
} from "@/lib/subscriptionLockState";

interface SubscriptionLockSnapshot {
  currentPlan: string | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
  featuresLocked: boolean;
}

const EMPTY_SNAPSHOT: SubscriptionLockSnapshot = {
  currentPlan: null,
  trialEndsAt: null,
  trialExpired: false,
  featuresLocked: false
};

const readSnapshot = (): SubscriptionLockSnapshot => {
  const state = readSubscriptionLockState();
  return {
    currentPlan: state?.current_plan || null,
    trialEndsAt: state?.trial_ends_at || null,
    trialExpired: state?.trial_expired === true,
    featuresLocked: isSubscriptionLocked(state)
  };
};

export const useSubscriptionLock = () => {
  const [snapshot, setSnapshot] = useState<SubscriptionLockSnapshot>(
    EMPTY_SNAPSHOT
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  const refresh = useCallback(() => {
    setSnapshot(readSnapshot());
  }, []);

  useEffect(() => {
    refresh();
    setHasHydrated(true);

    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === SUBSCRIPTION_LOCK_STATE_KEY) {
        refresh();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const handleCustomEvent = () => {
      refresh();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener(
      SUBSCRIPTION_LOCK_STATE_CHANGED_EVENT,
      handleCustomEvent
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        SUBSCRIPTION_LOCK_STATE_CHANGED_EVENT,
        handleCustomEvent
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  return useMemo(
    () => ({
      ...snapshot,
      hasHydrated,
      refresh
    }),
    [hasHydrated, refresh, snapshot]
  );
};
