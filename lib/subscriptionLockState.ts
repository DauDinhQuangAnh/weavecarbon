import { getSubscriptionPlanFamily } from "@/lib/subscriptionPlans";

export const SUBSCRIPTION_LOCK_STATE_KEY = "weavecarbon_subscription_lock_state";
export const SUBSCRIPTION_LOCK_STATE_CHANGED_EVENT =
  "weavecarbon:subscription-lock-state-changed";

export interface SubscriptionLockState {
  current_plan?: string | null;
  trial_ends_at?: string | null;
  trial_expired?: boolean;
  features_locked?: boolean;
}

const toSafeStringOrNull = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const emitSubscriptionLockStateChanged = () => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(SUBSCRIPTION_LOCK_STATE_CHANGED_EVENT));
  } catch {
    // noop: dispatch failures should not break app flow
  }
};

export const parseSubscriptionLockState = (
  raw: string | null | undefined
): SubscriptionLockState | null => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SubscriptionLockState;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      current_plan: toSafeStringOrNull(parsed.current_plan),
      trial_ends_at: toSafeStringOrNull(parsed.trial_ends_at),
      trial_expired: parsed.trial_expired === true,
      features_locked: parsed.features_locked === true
    };
  } catch {
    return null;
  }
};

export const readSubscriptionLockState = (): SubscriptionLockState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SUBSCRIPTION_LOCK_STATE_KEY);
    return parseSubscriptionLockState(raw);
  } catch {
    return null;
  }
};

export const isSubscriptionLocked = (
  state: SubscriptionLockState | null | undefined
) => {
  if (!state) return false;
  if (state.features_locked === true) return true;

  const planFamily = getSubscriptionPlanFamily(state.current_plan || null);
  return planFamily === "trial" && state.trial_expired === true;
};

export const writeSubscriptionLockState = (state: SubscriptionLockState) => {
  if (typeof window === "undefined") return;
  try {
    const payload: SubscriptionLockState = {
      current_plan: toSafeStringOrNull(state.current_plan),
      trial_ends_at: toSafeStringOrNull(state.trial_ends_at),
      trial_expired: state.trial_expired === true,
      features_locked: state.features_locked === true
    };

    window.localStorage.setItem(
      SUBSCRIPTION_LOCK_STATE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // noop: local cache is best-effort only
  } finally {
    emitSubscriptionLockStateChanged();
  }
};

export const clearSubscriptionLockStateCache = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SUBSCRIPTION_LOCK_STATE_KEY);
    window.sessionStorage.removeItem(SUBSCRIPTION_LOCK_STATE_KEY);
  } catch {
    // noop: local cache is best-effort only
  } finally {
    emitSubscriptionLockStateChanged();
  }
};
