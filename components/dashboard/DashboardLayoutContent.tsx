"use client";

import React from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import DashboardHeaderButton from "./DashboardHeaderButton";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { LanguageToggle } from "../ui/LanguageToggle";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { resolvePostLoginPath, type CompanyCheckPayload } from "@/lib/auth/routing";
import { getSubscriptionApiPayload } from "@/lib/subscriptionApi";
import {
  isStarterRestrictedDashboardPath,
  resolveRestrictedDashboardRedirect
} from "@/lib/dashboard/accessGuards";
import type { SubscriptionApiPayload } from "@/lib/subscriptionState";

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
  const isProductsPage = pathname === "/products" || pathname === "/demo/products";
  const isLogisticsPage = pathname === "/logistics" || pathname === "/demo/logistics";
  const isExportPage = pathname === "/export" || pathname === "/demo/export";
  const isAiSettingsPage =
    pathname === "/settings/ai" || pathname?.startsWith("/settings/ai/");
  const isOverviewPage = pathname === "/overview" || pathname === "/demo/overview";
  const shouldShowMobileBackButton = !isOverviewPage;
  const mobileContentTopPadding =
    isProductsPage
      ? "pt-[4.5rem]"
      : isLogisticsPage
        ? "pt-[4.6rem]"
        : isExportPage
          ? "pt-[4.6rem]"
          : isAiSettingsPage
            ? "pt-[4.5rem]"
          : "pt-[4.4rem]";

  useEffect(() => {
    if (loading || !user || user.user_type === "b2c") return;

    let cancelled = false;
    const verifyCompanyAndRedirect = async () => {
      if (user.company_id) return;

      try {
        const destination = await resolvePostLoginPath({
          accountType: user.user_type,
          companyCheckPayload: await api.get<CompanyCheckPayload>("/auth/check-company"),
          onboardingPath: "/onboarding",
          overviewPath: "/overview",
          b2cPath: "/b2c"
        });
        if (!cancelled && destination === "/onboarding" && destination !== (pathname || "")) {
          router.replace(destination);
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
  }, [loading, pathname, user, router]);

  useEffect(() => {
    if (loading || !user || user.user_type === "b2c") return;
    const currentPath = pathname || "";
    if (!isStarterRestrictedDashboardPath(currentPath)) return;

    let cancelled = false;
    const enforceStarterRestrictions = async () => {
      try {
        const payload: SubscriptionApiPayload = await getSubscriptionApiPayload();
        let accountPlan: string | null = null;
        try {
          const account = await api.get<{
            company?: {
              current_plan?: string | null;
            } | null;
          }>("/account");
          accountPlan = account?.company?.current_plan || null;
        } catch {
          // noop: subscription endpoint remains primary source
        }

        const redirectPath = resolveRestrictedDashboardRedirect({
          pathname: currentPath,
          subscriptionPayload: payload,
          accountCompanyPlan: accountPlan
        });

        if (!cancelled && redirectPath) {
          router.replace(redirectPath);
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
      <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-200 bg-white/95 py-2.5 backdrop-blur lg:sticky lg:top-0 lg:z-20 lg:bg-white lg:py-3">
        <div className="flex w-full items-center justify-between gap-3 px-2.5 md:px-3 lg:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DashboardHeaderButton />
            <div className="min-w-0 overflow-hidden">
              <div className="flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap">
                <h1
                  className="truncate text-xl font-extrabold leading-tight tracking-tight text-slate-800 md:text-2xl"
                  style={{ fontFamily: "\"Plus Jakarta Sans\", system-ui, sans-serif" }}
                >
                  {title}
                </h1>
                {subtitle ? (
                  <>
                    <span className="hidden shrink-0 text-sm font-medium leading-tight text-muted-foreground md:inline md:text-base">
                      &bull;
                    </span>
                    <p className="hidden min-w-0 truncate text-sm font-medium leading-tight text-muted-foreground md:block md:text-base">
                      {subtitle}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="shrink-0 lg:hidden">
            {shouldShowMobileBackButton ? (
              <button
                type="button"
                aria-label="Go back"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    router.back();
                    return;
                  }
                  router.push(pathname?.startsWith("/demo/") ? "/demo/overview" : "/overview");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="hidden shrink-0 lg:block">
            <LanguageToggle />
          </div>
        </div>
      </header>

      <div
        className={`flex-1 px-2.5 pb-4 ${mobileContentTopPadding} md:px-3 md:pb-6 md:pt-24 lg:px-4 lg:pt-4`}
      >
        {children}
      </div>
    </>);

}
