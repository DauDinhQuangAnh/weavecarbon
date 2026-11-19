"use client";

import React from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import MethodologyBanner from "@/components/app/MethodologyBanner";
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
    title: "Logistics",
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
    title: "Tính carbon",
    subtitle: "Ước tính phát thải CO2e theo vật liệu, sản xuất và vận chuyển",
  },
  "/evidence": {
    title: "Chứng từ",
    subtitle: "Quản lý chứng từ và nâng cấp độ tin cậy dữ liệu",
  },
  "/data-gap": {
    title: "Khoảng trống dữ liệu",
    subtitle: "Theo dõi dữ liệu còn thiếu cho tính toán carbon",
  },
  "/export": {
    title: "Xuất khẩu",
    subtitle: "Tạo gói dữ liệu và báo cáo tuân thủ",
  },
  "/reports": {
    title: "Báo cáo",
    subtitle: "Phân tích phát thải và hiệu quả giảm carbon",
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
  "/emissions": { title: "Phát thải", subtitle: "Kiểm kê theo Scope và nhịp vận hành" },
  "/processes": { title: "Quy trình", subtitle: "Đầu vào, năng lượng và đầu ra theo từng công đoạn" },
  "/facilities": { title: "Cơ sở sản xuất", subtitle: "Phát thải, độ đầy đủ dữ liệu và bối cảnh theo cơ sở" },
  "/carbon-operations": { title: "Vận hành carbon", subtitle: "Trạng thái năng lực lõi và luồng dữ liệu carbon" },
  "/industry-packs": { title: "Industry Packs", subtitle: "Taxonomy, field mapping và hệ số theo ngành" },
  "/activity-data": { title: "Dữ liệu hoạt động", subtitle: "Bản ghi điện, nhiên liệu, nguyên liệu và sản lượng" },
  "/evidence-graph": { title: "Đồ thị bằng chứng", subtitle: "Truy vết hoạt động → bằng chứng → hệ số → kết quả" },
  "/data-quality": { title: "Chất lượng dữ liệu", subtitle: "DQL, hệ số phát thải và bằng chứng còn thiếu" },
  "/inbox": { title: "Hộp thư công việc", subtitle: "Việc cần duyệt, bổ sung và rà soát" },
  "/hotspots": { title: "Điểm nóng phát thải", subtitle: "Nguồn đóng góp lớn nhất theo cơ sở và hạng mục" },
  "/climate-risk": { title: "Rủi ro khí hậu", subtitle: "Mức độ phơi nhiễm vật lý của cơ sở và nhà cung cấp" },
  "/vietnam-carbon": { title: "Carbon Việt Nam", subtitle: "Kiểm kê khí nhà kính và MRV theo NĐ 06/2022/NĐ-CP" },
  "/compliance": { title: "Tuân thủ", subtitle: "Ma trận báo cáo theo thị trường và khung tiêu chuẩn" },
  "/verification": { title: "Xác minh", subtitle: "Review bằng chứng và chuẩn bị cho bên xác minh" },
  "/mitigation-operations": { title: "Giảm phát thải & hạn ngạch", subtitle: "Sáng kiến giảm phát thải, kịch bản và hạn ngạch" },
  "/connected-data": { title: "WeaveNode", subtitle: "Thiết bị đo, telemetry và đối soát meter" },
  "/cbam-report": { title: "Báo cáo CBAM", subtitle: "Hồ sơ phát thải nhúng cho hàng hoá thuộc phạm vi EU CBAM" },
  "/reports/registry": { title: "Báo cáo", subtitle: "Trung tâm báo cáo pháp lý & thị trường" },
  "/report-builder": {
    title: "Báo cáo",
    subtitle: "Report Scope Engine · tổng hợp theo đúng phạm vi đối tượng và kỳ",
  },
  "/demo-lab": {
    title: "Phòng demo theo ngành",
    subtitle: "Input công nghiệp có nguồn → quy trình WeaveCarbon → đầu ra nội địa & xuất khẩu",
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
  // Tiêu đề thanh trên luôn khớp tên mục trên menu (nếu route đã khai báo); trang chỉ bổ sung phụ đề.
  const hasRouteTitle = Boolean(DASHBOARD_ROUTE_TITLES[normalizeDashboardPath(pathname)]);
  const displayTitle = hasRouteTitle ? routeTitle.title : titleBelongsToCurrentPath ? title : routeTitle.title;
  const displaySubtitle = hasRouteTitle ? routeTitle.subtitle : titleBelongsToCurrentPath ? subtitle : routeTitle.subtitle;
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
          }>("/account", {
            cacheTags: ["account"],
            cacheTtlMs: 15_000
          });
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
      <header className="sticky-glass fixed inset-x-2 top-2 z-30 rounded-2xl px-3 py-2.5 md:px-5 lg:sticky lg:mx-4 lg:mt-3 lg:py-3">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DashboardHeaderButton />
            <div className="min-w-0 overflow-hidden">
              <h1 className="truncate font-display text-base font-semibold leading-tight text-foreground md:text-lg">
                {displayTitle}
              </h1>
              {displaySubtitle ? (
                <p className="hidden truncate text-xs text-muted-foreground md:block">{displaySubtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="lg:hidden">
            {shouldShowMobileBackButton ? (
              <button
                type="button"
                aria-label="Go back"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-background/60 text-foreground backdrop-blur-md hover:bg-background/80"
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
        </div>
      </header>

      <div
        className={`page-stage mx-auto w-full max-w-[1600px] flex-1 px-2.5 pb-4 ${mobileContentTopPadding} md:px-4 md:pb-6 md:pt-24 lg:px-6 lg:pt-4`}
      >
        <div className="animate-fade-up">{children}</div>
      </div>
      <footer className="glass-shell mx-2 mb-3 mt-2 rounded-2xl px-4 py-3 md:mx-4 md:px-6">
        <MethodologyBanner />
      </footer>
    </>);

}
