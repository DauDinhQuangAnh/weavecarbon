"use client";

import React from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardHeaderButton from "./DashboardHeaderButton";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { LanguageToggle } from "../ui/LanguageToggle";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import {
  resolveSubscriptionState,
  type SubscriptionApiPayload } from
"@/lib/subscriptionState";

type CompanyCheckPayload = {
  is_b2b?: boolean;
  has_company?: boolean;
  user_type?: "b2b" | "b2c" | "admin";
  data?: {
    is_b2b?: boolean;
    has_company?: boolean;
    user_type?: "b2b" | "b2c" | "admin";
  };
};

const normalizeCompanyCheck = (payload: CompanyCheckPayload | null) => {
  const nested = payload?.data;
  const source = nested || payload || {};
  const isB2b =
    typeof source.is_b2b === "boolean" ? source.is_b2b : source.user_type === "b2b";
  const hasCompany =
    typeof source.has_company === "boolean" ? source.has_company : false;
  return { isB2b, hasCompany };
};

interface DashboardLayoutContentProps {
  children: React.ReactNode;
}

export default function DashboardLayoutContent({
  children
}: DashboardLayoutContentProps) {
  const { title, subtitle } = useDashboardTitle();
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !user || user.user_type === "b2c") return;

    let cancelled = false;
    const verifyCompanyAndRedirect = async () => {
      if (user.company_id) return;

      try {
        const payload = await api.get<CompanyCheckPayload>("/auth/check-company");
        const { isB2b, hasCompany } = normalizeCompanyCheck(payload);
        if (!cancelled && isB2b && !hasCompany) {
          router.replace("/onboarding");
        }
      } catch {
        if (!cancelled) {
          router.replace("/onboarding");
        }
      }
    };

    void verifyCompanyAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user || user.user_type === "b2c") return;
    const currentPath = pathname || "";
    const isRestrictedPage =
      currentPath === "/export" ||
      currentPath.startsWith("/export/") ||
      currentPath === "/reports" ||
      currentPath.startsWith("/reports/");
    if (!isRestrictedPage) return;

    let cancelled = false;
    const enforceStarterRestrictions = async () => {
      try {
        const payload = await api.get<SubscriptionApiPayload>("/subscription");
        const resolved = resolveSubscriptionState(payload);
        let effectivePlan = resolved.plan;

        if (effectivePlan !== "trial") {
          try {
            const account = await api.get<{
              company?: {
                current_plan?: string | null;
              } | null;
            }>("/account");
            const rawPlan = (account?.company?.current_plan || "").trim().toLowerCase();
            if (rawPlan.includes("trial")) {
              effectivePlan = "trial";
            }
          } catch {
            // noop: subscription endpoint remains primary source
          }
        }

        if (
          !cancelled &&
          effectivePlan === "trial"
        ) {
          router.replace("/overview");
        }
      } catch {
        // Do not hard redirect on transient errors to avoid false Starter lock.
      }
    };

    void enforceStarterRestrictions();
    return () => {
      cancelled = true;
    };
  }, [loading, user, pathname, router]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-card/95 p-3 backdrop-blur lg:sticky lg:top-0 lg:z-20 lg:bg-card lg:p-4">
        <div className="page-shell flex items-start justify-between gap-3 px-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <DashboardHeaderButton />
            <h1 className="text-xl md:text-2xl font-display font-bold truncate">
              {title}
            </h1>
          </div>
          <div className="shrink-0">
            <LanguageToggle />
          </div>
        </div>
        <p className="page-shell mt-1 px-0 text-xs text-muted-foreground md:text-sm lg:pl-0">
          {subtitle}
        </p>
      </header>

      <div className="page-shell flex-1 pb-4 pt-[5.5rem] md:pb-6 md:pt-24 lg:pt-4">{children}</div>
    </>);

}
