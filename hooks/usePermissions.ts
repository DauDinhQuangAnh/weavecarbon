"use client";

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import { getSubscriptionPlanFamily } from "@/lib/subscriptionPlans";
import {
  isSubscriptionLocked,
  readSubscriptionLockState
} from "@/lib/subscriptionLockState";
import {
  canAccessSettings,
  canAccessSystemSettings,
  canAccessUsersSettings,
  canMutateData,
  resolveCompanyRole,
  type CompanyRole
} from "@/lib/permissions";

export const usePermissions = () => {
  const { user } = useAuth();
  const { currentPlan, featuresLocked } = useSubscriptionLock();

  return useMemo(() => {
    const subscriptionLocked = featuresLocked || isSubscriptionLocked(readSubscriptionLockState());
    const fallbackRole = user?.user_type === "admin" ? "root" : "member";
    const role = resolveCompanyRole(
      {
        role: user?.company_role,
        isRoot: user?.is_root
      },
      fallbackRole
    );
    const canMutateByRole = canMutateData(role);
    const canMutate = canMutateByRole && !subscriptionLocked;
    const planFamily = getSubscriptionPlanFamily(currentPlan);
    const isTrialPlan = planFamily === "trial";
    const canAccessAISettings = canAccessSystemSettings(role) && !isTrialPlan;

    return {
      role,
      isRoot: role === "root",
      isMember: role === "member",
      isViewer: role === "viewer",
      isTrialPlan,
      canMutateByRole,
      isPlanLocked: subscriptionLocked,
      canMutate,
      canAccessSettings: canAccessSettings(role),
      canAccessSystemSettings: canAccessSystemSettings(role),
      canAccessAISettings,
      canAccessUsersSettings: canAccessUsersSettings(role)
    } as {
      role: CompanyRole;
      isRoot: boolean;
      isMember: boolean;
      isViewer: boolean;
      isTrialPlan: boolean;
      canMutateByRole: boolean;
      isPlanLocked: boolean;
      canMutate: boolean;
      canAccessSettings: boolean;
      canAccessSystemSettings: boolean;
      canAccessAISettings: boolean;
      canAccessUsersSettings: boolean;
    };
  }, [currentPlan, featuresLocked, user?.company_role, user?.is_root, user?.user_type]);
};
