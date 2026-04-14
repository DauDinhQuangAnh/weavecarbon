"use client";

import { useEffect, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import {
  getStandardSkuLimitFromPlan,
  getSubscriptionPlanFamily
} from "@/lib/subscriptionPlans";
import {
  resolveAnalyticsPageGroup,
  setAnalyticsIdentity,
  setAnalyticsUserProperties,
  trackPageView
} from "@/lib/analytics";

export default function AnalyticsProvider({
  children
}: Readonly<{children: ReactNode;}>) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isDemoSession, user } = useAuth();
  const { currentPlan } = useSubscriptionLock();
  const search = searchParams.toString();
  const pagePath = `${pathname || "/"}${search ? `?${search}` : ""}`;
  const resolvedPlan = currentPlan || user?.current_plan || null;

  useEffect(() => {
    setAnalyticsUserProperties({
      locale,
      accountType: user?.user_type || null,
      companyRole: user?.company_role || null,
      isDemo: isDemoSession,
      planFamily: getSubscriptionPlanFamily(resolvedPlan),
      planSkuLimit: getStandardSkuLimitFromPlan(resolvedPlan),
      businessType: user?.business_type || null,
      domesticMarket: user?.domestic_market || null
    });
  }, [
    currentPlan,
    isDemoSession,
    locale,
    resolvedPlan,
    user?.business_type,
    user?.company_role,
    user?.domestic_market,
    user?.user_type
  ]);

  useEffect(() => {
    setAnalyticsIdentity({
      userId: user?.analytics_user_key || null,
      companyKey: user?.analytics_company_key || null
    });
  }, [user?.analytics_company_key, user?.analytics_user_key]);

  useEffect(() => {
    trackPageView(resolveAnalyticsPageGroup(pagePath), pagePath);
  }, [pagePath]);

  return <>{children}</>;
}
