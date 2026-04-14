"use client";

import { useEffect, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  resolveAnalyticsPageGroup,
  setAnalyticsContext,
  trackPageView
} from "@/lib/analytics";

export default function AnalyticsProvider({
  children
}: Readonly<{children: ReactNode;}>) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isDemoSession, user } = useAuth();
  const search = searchParams.toString();
  const pagePath = `${pathname || "/"}${search ? `?${search}` : ""}`;

  useEffect(() => {
    setAnalyticsContext({
      locale,
      accountType: user?.user_type || null,
      companyRole: user?.company_role || null,
      isDemo: isDemoSession
    });
  }, [isDemoSession, locale, user?.company_role, user?.user_type]);

  useEffect(() => {
    trackPageView(resolveAnalyticsPageGroup(pagePath), pagePath);
  }, [pagePath]);

  return <>{children}</>;
}
