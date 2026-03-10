export type SubscriptionPlanId =
  | "free"
  | "trial"
  | "standard"
  | "standard_20"
  | "standard_35"
  | "standard_50"
  | "export";

export type SubscriptionPlanFamily = "free" | "trial" | "standard" | "export";
export type StandardSkuLimit = 20 | 35 | 50;

export const STANDARD_SKU_LIMIT_OPTIONS: readonly StandardSkuLimit[] = [20, 35, 50];

const toPlanToken = (value: string | null | undefined) =>
  (value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

export const normalizeSubscriptionPlan = (
  value: string | null | undefined,
  fallback: SubscriptionPlanId = "free"
): SubscriptionPlanId => {
  const token = toPlanToken(value);
  if (!token) return fallback;
  if (token === "free") return "free";
  if (token === "trial") return "trial";
  if (token === "standard") return "standard";
  if (token.includes("standard_50") || token.includes("standard50")) return "standard_50";
  if (token.includes("standard_35") || token.includes("standard35")) return "standard_35";
  if (token.includes("standard_20") || token.includes("standard20")) return "standard_20";
  if (token.includes("standard")) return "standard";
  if (token.includes("export")) return "export";
  return fallback;
};

export const getSubscriptionPlanFamily = (
  value: string | null | undefined
): SubscriptionPlanFamily => {
  const normalized = normalizeSubscriptionPlan(value, "free");
  if (normalized === "trial") return "trial";
  if (normalized === "export") return "export";
  if (
    normalized === "standard" ||
    normalized === "standard_20" ||
    normalized === "standard_35" ||
    normalized === "standard_50"
  ) {
    return "standard";
  }
  return "free";
};

export const getSubscriptionPlanRank = (
  value: string | null | undefined
): number => {
  const normalized = normalizeSubscriptionPlan(value, "free");
  switch (normalized) {
    case "trial":
      return 1;
    case "standard":
    case "standard_20":
    case "standard_35":
    case "standard_50":
      return 2;
    case "export":
      return 3;
    default:
      return 0;
  }
};

export const isStarterPlan = (value: string | null | undefined) =>
  getSubscriptionPlanFamily(value) === "trial";

export const isStandardPlan = (value: string | null | undefined) =>
  getSubscriptionPlanFamily(value) === "standard";

export const getStandardSkuLimitFromPlan = (
  value: string | null | undefined
): StandardSkuLimit | null => {
  const normalized = normalizeSubscriptionPlan(value, "free");
  switch (normalized) {
    case "standard_20":
      return 20;
    case "standard_35":
      return 35;
    case "standard_50":
      return 50;
    case "standard":
    default:
      return null;
  }
};

export const resolveStandardPlanBySkuLimit = (
  value: number | string | null | undefined,
  fallback: SubscriptionPlanId = "standard_20"
): SubscriptionPlanId => {
  const numericValue = Number(value);
  if (numericValue >= 50) return "standard_50";
  if (numericValue >= 35) return "standard_35";
  if (numericValue >= 20) return "standard_20";
  return fallback;
};
