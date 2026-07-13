import { canMutateData } from "@/lib/permissions";
import {
  isSubscriptionLocked,
  readSubscriptionLockState
} from "@/lib/subscriptionLockState";
import { env } from "@/lib/env";
import { getStoredCompanyRole } from "./authSnapshot";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PLAN_LOCK_PROTECTED_PREFIXES = [
  "/products",
  "/product-batches",
  "/logistics",
  "/export/markets",
  "/reports",
  "/company/members",
  "/account/company"
];
const CLIENT_ROLE_GUARD_ENABLED = env.NEXT_PUBLIC_ENFORCE_CLIENT_ROLE_GUARD === "1";

const isAuthPath = (path: string) => path.toLowerCase().includes("/auth/");

export const shouldBlockViewerMutation = (path: string, method: string) => {
  if (typeof window === "undefined") return false;
  if (!CLIENT_ROLE_GUARD_ENABLED) return false;
  if (!MUTATION_METHODS.has(method)) return false;
  if (isAuthPath(path)) return false;

  const companyRole = getStoredCompanyRole();
  if (!companyRole) return false;

  return !canMutateData(companyRole);
};

export const shouldBlockPlanLockedMutation = (path: string, method: string) => {
  if (typeof window === "undefined") return false;
  if (!MUTATION_METHODS.has(method)) return false;
  if (isAuthPath(path)) return false;
  const normalizedPath = path.toLowerCase();
  const isProtectedRoute = PLAN_LOCK_PROTECTED_PREFIXES.some((prefix) =>
    normalizedPath.includes(prefix)
  );
  if (!isProtectedRoute) return false;

  return isSubscriptionLocked(readSubscriptionLockState());
};
