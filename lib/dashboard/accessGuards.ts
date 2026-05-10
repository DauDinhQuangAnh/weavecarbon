import {
  getSubscriptionPlanFamily,
  normalizeSubscriptionPlan
} from "@/lib/subscriptionPlans";
import {
  resolveSubscriptionState,
  type SubscriptionApiPayload
} from "@/lib/subscriptionState";

export const isStarterRestrictedDashboardPath = (
  pathname: string | null | undefined
) => {
  const currentPath = pathname || "";
  return (
    currentPath === "/export" ||
    currentPath.startsWith("/export/") ||
    currentPath === "/reports" ||
    currentPath.startsWith("/reports/")
  );
};

export const resolveDashboardSubscriptionPlan = (
  subscriptionPayload: SubscriptionApiPayload | null | undefined,
  accountCompanyPlan?: string | null
) => {
  const resolved = resolveSubscriptionState(subscriptionPayload);
  const planFromSubscription = normalizeSubscriptionPlan(resolved.plan, "free");

  if (getSubscriptionPlanFamily(planFromSubscription) !== "trial") {
    const planFromAccount = normalizeSubscriptionPlan(accountCompanyPlan, "free");
    if (getSubscriptionPlanFamily(planFromAccount) === "trial") {
      return "trial";
    }
  }

  return planFromSubscription;
};

export const resolveRestrictedDashboardRedirect = ({
  pathname,
  subscriptionPayload,
  accountCompanyPlan,
  overviewPath = "/overview"
}: {
  pathname: string | null | undefined;
  subscriptionPayload: SubscriptionApiPayload | null | undefined;
  accountCompanyPlan?: string | null;
  overviewPath?: string;
}) => {
  if (!isStarterRestrictedDashboardPath(pathname)) {
    return null;
  }

  const effectivePlan = resolveDashboardSubscriptionPlan(
    subscriptionPayload,
    accountCompanyPlan
  );

  return getSubscriptionPlanFamily(effectivePlan) === "trial" ? overviewPath : null;
};
