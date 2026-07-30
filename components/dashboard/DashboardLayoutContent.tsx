"use client";

import React from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import DashboardHeaderButton from "./DashboardHeaderButton";
import { useDashboardTitle } from "@/contexts/DashboardContext";
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

const DASHBOARD_ROUTE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/overview": {
    title: "Tổng quan",
    subtitle: "Theo dõi phát thải, dữ liệu và trạng thái tuân thủ",
  },
  "/products": {
    title: "Sản phẩm",
    subtitle: "Quản lý danh mục sản phẩm và hồ sơ carbon",
  },
  "/logistics": {
    title: "Quản lý vận chuyển",
    subtitle: "Theo dõi tất cả các lô hàng trên bản đồ thế giới",
  },
  "/transport": {
    title: "Vận chuyển",
    subtitle: "Quản lý chặng vận chuyển và phát thải logistics",
  },
  "/track-shipment": {
    title: "Theo dõi lô hàng",
    subtitle: "Tra cứu trạng thái vận chuyển theo mã lô hàng",
  },
  "/carbon-calculator": {
    title: "Tính Carbon Proxy",
    subtitle: "Ước tính phát thải CO2e theo vật liệu, sản xuất và vận chuyển",
  },
  "/evidence": {
    title: "Tải chứng từ",
    subtitle: "Quản lý chứng từ và nâng cấp độ tin cậy dữ liệu",
  },
  "/data-gap": {
    title: "Khoảng trống dữ liệu",
    subtitle: "Theo dõi dữ liệu còn thiếu cho tính toán carbon",
  },
  "/export": {
    title: "Xuất báo cáo",
    subtitle: "Tạo gói dữ liệu và báo cáo tuân thủ",
  },
  "/reports": {
    title: "Báo cáo",
    subtitle: "Phân tích phát thải và hiệu quả giảm carbon",
  },
  "/cbam-report": {
    title: "Báo cáo kiểu CBAM (Pre-audit, không phải tờ khai chính thức)",
    subtitle: "Cấu trúc 6 tab phỏng theo EU CBAM communication template — phục vụ ESG/CSDDD, chưa thuộc phạm vi CBAM",
  },
  "/audit-trail": {
    title: "Audit Trail",
    subtitle: "Theo dõi lịch sử thay đổi và xác minh dữ liệu",
  },
  "/suppliers": {
    title: "Nhà cung ứng",
    subtitle: "Yêu cầu dữ liệu Scope 3 từ nhà cung ứng",
  },
  "/billing": {
    title: "Gói dịch vụ",
    subtitle: "Quản lý gói đăng ký và thanh toán",
  },
  "/settings": {
    title: "Cài đặt",
    subtitle: "Quản lý cấu hình tài khoản và hệ thống",
  },
  "/settings/ai": {
    title: "Cấu hình AI",
    subtitle: "Quản lý runtime cho trợ lý AI",
  },
  "/assessment": {
    title: "Đánh giá sản phẩm",
    subtitle: "Tạo hồ sơ carbon và chứng từ cho sản phẩm",
  },
  "/calculation-history": {
    title: "Lịch sử tính toán",
    subtitle: "Xem lại các lần tính phát thải đã lưu",
  },
  "/passport-dashboard": {
    title: "Product Passport",
    subtitle: "Quản lý hộ chiếu sản phẩm số",
  },
};

const normalizeDashboardPath = (pathname?: string | null) => {
  if (!pathname) return "/overview";
  const withoutDemo = pathname.startsWith("/demo")
    ? pathname.replace(/^\/demo/, "") || "/overview"
    : pathname;
  return withoutDemo.replace(/\/$/, "") || "/overview";
};

const resolveRouteTitle = (pathname?: string | null) => {
  const normalized = normalizeDashboardPath(pathname);
  if (normalized.startsWith("/summary/")) {
    return {
      title: "Chi tiết sản phẩm",
      subtitle: "Xem hồ sơ carbon, chứng từ và dữ liệu tuân thủ",
    };
  }

  return DASHBOARD_ROUTE_TITLES[normalized] ?? {
    title: "Dashboard",
    subtitle: undefined,
  };
};

// Set to false to restore auth protection
const SKIP_AUTH_GUARD = false;

export default function DashboardLayoutContent({
  children
}: DashboardLayoutContentProps) {
  const { title, subtitle, titlePath } = useDashboardTitle();
  const { user, loading, authStatus } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const routeTitle = resolveRouteTitle(pathname);
  const titleBelongsToCurrentPath =
    Boolean(titlePath) &&
    normalizeDashboardPath(titlePath) === normalizeDashboardPath(pathname);
  const displayTitle = titleBelongsToCurrentPath ? title : routeTitle.title;
  const displaySubtitle = titleBelongsToCurrentPath
    ? subtitle
    : routeTitle.subtitle;
  const isProductsPage = pathname === "/products" || pathname === "/demo/products";
  const isLogisticsPage = pathname === "/logistics" || pathname === "/demo/logistics";
  const isExportPage = pathname === "/export" || pathname === "/demo/export";
  const isDemoPage = pathname?.startsWith("/demo");
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
    if (SKIP_AUTH_GUARD) return;
    if (
      isDemoPage ||
      loading ||
      authStatus === "checking" ||
      authStatus === "recovering"
    ) return;

    if (!user || authStatus === "expired" || authStatus === "anonymous") {
      router.replace("/auth?forceLogin=1");
    }
  }, [authStatus, isDemoPage, loading, router, user]);

  useEffect(() => {
    if (SKIP_AUTH_GUARD) return;
    if (
      loading ||
      authStatus === "checking" ||
      authStatus === "recovering" ||
      !user ||
      user.user_type === "b2c"
    ) return;

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
        // Keep the current page on transient session/network errors.
      }
    };

    void verifyCompanyAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [authStatus, loading, pathname, user, router]);

  useEffect(() => {
    if (SKIP_AUTH_GUARD) return;
    if (
      loading ||
      authStatus === "checking" ||
      authStatus === "recovering" ||
      !user ||
      user.user_type === "b2c"
    ) return;
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
  }, [authStatus, loading, user, pathname, router]);

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
                  {displayTitle}
                </h1>
                {displaySubtitle ? (
                  <>
                    <span className="hidden shrink-0 text-sm font-medium leading-tight text-muted-foreground md:inline md:text-base">
                      &bull;
                    </span>
                    <p className="hidden min-w-0 truncate text-sm font-medium leading-tight text-muted-foreground md:block md:text-base">
                      {displaySubtitle}
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
        </div>
      </header>

      <div
        className={`flex-1 px-2.5 pb-4 ${mobileContentTopPadding} md:px-3 md:pb-6 md:pt-24 lg:px-4 lg:pt-4`}
      >
        {children}
      </div>
    </>);

}
