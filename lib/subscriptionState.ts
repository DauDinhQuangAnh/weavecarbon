import {
  getSubscriptionPlanFamily,
  normalizeSubscriptionPlan } from
"@/lib/subscriptionPlans";

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 14;

type MaybeString = string | null | undefined;

export interface SubscriptionApiPayload {
  current_plan?: string;
  subscription?: {
    current_plan?: string;
  };
  limits?: {
    products?: number;
  };
  plan_details?: {
    products?: number;
  };
  trial_started_at?: string;
  trial_ends_at?: string;
  trial_expired?: boolean;
  trial_days_remaining?: number;
  standard_started_at?: string;
  standard_expires_at?: string;
  standard_expired?: boolean;
  standard_days_remaining?: number;
  features_locked?: boolean;
  trial?: {
    started_at?: string;
    ends_at?: string;
    expired?: boolean;
    days_remaining?: number;
  };
  standard_cycle?: {
    started_at?: string;
    expires_at?: string;
    expired?: boolean;
    days_remaining?: number;
  };
  active_window?: {
    started_at?: string;
    ends_at?: string;
    expired?: boolean;
    days_remaining?: number | null;
  };
  trial_days?: number;
  standard_cycle_days?: number;
}

export interface ResolvedSubscriptionState {
  plan: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
  trialDaysRemaining: number | null;
  standardStartedAt: string | null;
  standardExpiresAt: string | null;
  standardExpired: boolean;
  standardDaysRemaining: number | null;
  featuresLocked: boolean;
}

const toDate = (value: MaybeString) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoOrNull = (value: Date | null) => (value ? value.toISOString() : null);

const calcDaysRemaining = (endsAt: Date | null) => {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / DAY_MS));
};

const normalizePlan = (value: MaybeString, fallback = "free") => {
  return normalizeSubscriptionPlan(
    value,
    normalizeSubscriptionPlan(fallback, "free")
  );
};

const inferStandardPlanFromLimits = (payload: SubscriptionApiPayload) => {
  const productsLimit =
    Number(payload?.plan_details?.products ?? payload?.limits?.products ?? 0) || 0;
  return productsLimit > 0 ? "standard" : null;
};

const inferPlanFromPayload = (payload: SubscriptionApiPayload | null | undefined) => {
  if (!payload) return null;

  const explicitPlan = normalizePlan(
    payload.current_plan || payload.subscription?.current_plan || null,
    ""
  );
  if (explicitPlan) {
    return explicitPlan;
  }

  const hasStandardWindow =
    Boolean(payload.standard_started_at) ||
    Boolean(payload.standard_expires_at) ||
    payload.standard_expired === true ||
    typeof payload.standard_days_remaining === "number" ||
    Boolean(payload.standard_cycle?.started_at) ||
    Boolean(payload.standard_cycle?.expires_at) ||
    payload.standard_cycle?.expired === true ||
    typeof payload.standard_cycle?.days_remaining === "number";
  if (hasStandardWindow) {
    return inferStandardPlanFromLimits(payload) || "standard";
  }

  const hasTrialWindow =
    Boolean(payload.trial_started_at) ||
    Boolean(payload.trial_ends_at) ||
    payload.trial_expired === true ||
    typeof payload.trial_days_remaining === "number" ||
    Boolean(payload.trial?.started_at) ||
    Boolean(payload.trial?.ends_at) ||
    payload.trial?.expired === true ||
    typeof payload.trial?.days_remaining === "number" ||
    Boolean(payload.active_window?.started_at) ||
    Boolean(payload.active_window?.ends_at) ||
    payload.active_window?.expired === true ||
    typeof payload.active_window?.days_remaining === "number" ||
    typeof payload.trial_days === "number";
  if (hasTrialWindow) {
    return "trial";
  }

  return null;
};

export const resolveSubscriptionState = (
  payload: SubscriptionApiPayload | null | undefined,
  options?: {
    fallbackPlan?: string | null;
    fallbackTrialStartedAt?: string | null;
  })
: ResolvedSubscriptionState => {
  const inferredPlan = inferPlanFromPayload(payload);
  const plan = normalizePlan(inferredPlan || options?.fallbackPlan || null, "free");
  const planFamily = getSubscriptionPlanFamily(plan);

  const trialStartedAtDate = toDate(
    payload?.trial_started_at ||
    (planFamily === "trial" ? payload?.active_window?.started_at : null) ||
    payload?.trial?.started_at ||
    options?.fallbackTrialStartedAt ||
    null
  );
  const trialEndsAtDateFromApi = toDate(
    payload?.trial_ends_at ||
    (planFamily === "trial" ? payload?.active_window?.ends_at : null) ||
    payload?.trial?.ends_at ||
    null
  );
  const trialEndsAtDateFromPlan =
    trialStartedAtDate ?
      new Date(trialStartedAtDate.getTime() + TRIAL_DAYS * DAY_MS) :
      null;
  const trialEndsAtDate =
    trialEndsAtDateFromApi && trialEndsAtDateFromPlan ?
      new Date(Math.max(trialEndsAtDateFromApi.getTime(), trialEndsAtDateFromPlan.getTime())) :
    trialEndsAtDateFromApi ||
    trialEndsAtDateFromPlan;

  const trialExpiredFromApi =
    payload?.trial_expired ??
    (planFamily === "trial" ? payload?.active_window?.expired : undefined) ??
    payload?.trial?.expired;
  const trialExpired =
    typeof trialExpiredFromApi === "boolean" ?
      trialExpiredFromApi :
      trialEndsAtDate ?
        Date.now() > trialEndsAtDate.getTime() :
        false;

  const trialDaysRemainingFromApi =
    payload?.trial_days_remaining ??
    (planFamily === "trial" ? payload?.active_window?.days_remaining ?? undefined : undefined) ??
    payload?.trial?.days_remaining;
  const trialDaysRemaining =
    trialEndsAtDate ?
      calcDaysRemaining(trialEndsAtDate) :
    typeof trialDaysRemainingFromApi === "number" ?
      trialDaysRemainingFromApi :
      null;

  const standardStartedAtDate = toDate(
    payload?.standard_started_at ||
    (planFamily === "standard" ? payload?.active_window?.started_at : null) ||
    payload?.standard_cycle?.started_at ||
    null
  );
  const standardExpiresAtDate = toDate(
    payload?.standard_expires_at ||
    (planFamily === "standard" ? payload?.active_window?.ends_at : null) ||
    payload?.standard_cycle?.expires_at ||
    null
  );

  const standardExpiredFromApi =
    payload?.standard_expired ??
    (planFamily === "standard" ? payload?.active_window?.expired : undefined) ??
    payload?.standard_cycle?.expired;
  const standardExpired =
    typeof standardExpiredFromApi === "boolean" ?
      standardExpiredFromApi :
      standardExpiresAtDate ?
        Date.now() > standardExpiresAtDate.getTime() :
        false;

  const standardDaysRemainingFromApi =
    payload?.standard_days_remaining ??
    (planFamily === "standard" ? payload?.active_window?.days_remaining ?? undefined : undefined) ??
    payload?.standard_cycle?.days_remaining;
  const standardDaysRemaining =
    typeof standardDaysRemainingFromApi === "number" ?
      standardDaysRemainingFromApi :
      calcDaysRemaining(standardExpiresAtDate);

  const featuresLockedFromApi = payload?.features_locked;
  const featuresLocked =
    typeof featuresLockedFromApi === "boolean" ?
      featuresLockedFromApi :
      planFamily === "trial" && Boolean(trialExpired);

  return {
    plan,
    trialStartedAt: toIsoOrNull(trialStartedAtDate),
    trialEndsAt: toIsoOrNull(trialEndsAtDate),
    trialExpired,
    trialDaysRemaining,
    standardStartedAt: toIsoOrNull(standardStartedAtDate),
    standardExpiresAt: toIsoOrNull(standardExpiresAtDate),
    standardExpired,
    standardDaysRemaining,
    featuresLocked
  };
};
