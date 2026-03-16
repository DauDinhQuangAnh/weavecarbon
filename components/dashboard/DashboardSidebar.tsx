"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authTokenStore } from "@/lib/apiClient";
import { useAppRoutes } from "@/lib/demo/routes";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  Leaf,
  LogOut,
  Loader2,
  RotateCcw,
  Package,
  Truck,
  FileCheck,
  TrendingUp,
  BarChart3,
  Settings,
  Menu,
  X } from
"lucide-react";
import { useRouter } from "next/navigation";
import { Company, Profile } from "@/types/app.type";
import { useTranslations } from "next-intl";
import { resetDemoDataset } from "@/lib/demo/storage";
import { ensureDemoSession } from "@/lib/demo/session";
import { writeSubscriptionLockState } from "@/lib/subscriptionLockState";

interface DashboardSidebarProps {
  company: Company | null;
  profile: Profile | null;
  currentPlan: string | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const menuItems = [
{
  icon: BarChart3,
  labelKey: "overview",
  path: "/overview"
},
{
  icon: Package,
  labelKey: "product",
  path: "/products"
},
{
  icon: Truck,
  labelKey: "logistics",
  path: "/logistics"
},
{ icon: FileCheck, labelKey: "export", path: "/export" },
{
  icon: TrendingUp,
  labelKey: "reports",
  path: "/reports"
},
{
  icon: Settings,
  labelKey: "settings",
  path: "/settings"
}];


const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  company,
  profile,
  currentPlan,
  sidebarOpen,
  onToggleSidebar
}) => {
  const t = useTranslations("sidebar");
  const { user, signOut, isDemoSession } = useAuth();
  const { canAccessSettings } = usePermissions();
  const appRoutes = useAppRoutes();
  const router = useRouter();
  const pathname = usePathname();
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const hasSession = Boolean(user?.id || profile?.id || authTokenStore.getAccessToken());
  const homeHref = hasSession ? appRoutes.homePath : "/";
  const handleSidebarNavigate = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sidebarNavigate"));
      if (window.innerWidth < 1024) {
        onToggleSidebar();
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleResetDemo = async () => {
    if (isResettingDemo) {
      return;
    }

    setIsResettingDemo(true);
    try {
      resetDemoDataset();
      ensureDemoSession();
      writeSubscriptionLockState({
        current_plan: "standard",
        trial_ends_at: null,
        trial_expired: false,
        features_locked: false
      });
      window.location.reload();
    } finally {
      setIsResettingDemo(false);
    }
  };

  const isActive = (path: string) => {
    const targetPath = appRoutes.toAppPath(path);
    return pathname === targetPath || pathname.startsWith(targetPath + "/");
  };

  const normalizedPlan = (currentPlan || company?.current_plan || "").trim().toLowerCase();
  const isStarterPlan = normalizedPlan.includes("trial");

  const visibleMenuItems = menuItems.filter((item) =>
  item.path === "/settings" ?
  !isDemoSession && canAccessSettings :
  isStarterPlan && (item.path === "/export" || item.path === "/reports") ?
  false :
  true
  );

  return (
    <>
      
      {sidebarOpen &&
      <div
        className="fixed inset-0 bg-black/50 lg:hidden z-40"
        onClick={onToggleSidebar} />

      }

      
      <aside
        className={`fixed left-0 top-0 z-50 flex h-dvh w-52 shrink-0 flex-col border-r border-border bg-card transition-transform duration-300 lg:z-20 lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
        }>
        
        <div className="border-b border-border p-4">
          <div className="flex justify-end mb-3 lg:hidden">
            <Button
              className="lg:hidden"
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}>
              
              {sidebarOpen ?
              <X className="w-4 h-4" /> :

              <Menu className="w-4 h-4" />
              }
            </Button>
          </div>
          <Link href={homeHref} className="flex min-w-0 items-center gap-2">
            <div className="w-8 h-8 bg-gradient-forest rounded-lg flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            {sidebarOpen &&
            <span className="truncate font-display font-bold text-foreground">
                WEAVE<span className="text-primary">CARBON</span>
              </span>
            }
          </Link>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1 p-4">
          {visibleMenuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                onClick={handleSidebarNavigate}
                key={item.path}
                href={appRoutes.toAppPath(item.path)}
                className={`flex w-full max-w-[10.25rem] items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                active ?
                "bg-primary/10 text-primary" :
                "text-muted-foreground hover:bg-muted hover:text-foreground"}`
                }>
                
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen &&
                <span className="text-sm font-medium">
                    {t(item.labelKey)}
                  </span>
                }
              </Link>);

          })}
        </nav>

        <div className="p-4 border-t border-border">
          {sidebarOpen &&
          <div className="mb-3">
              <p className="font-medium text-sm truncate">
                {profile?.full_name || user?.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {company?.name || "No company"}
              </p>
            </div>
          }
          {isDemoSession ? (
            <div className={sidebarOpen ? "space-y-3" : "flex justify-center"}>
              {sidebarOpen && (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Demo mode
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    Khôi phục dữ liệu mẫu
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                title="Khôi phục dữ liệu mẫu"
                disabled={isResettingDemo}
                className={
                  sidebarOpen ?
                    "mx-auto h-10 w-full max-w-[10.25rem] justify-start gap-2 border-emerald-300 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-100" :
                    "h-10 w-10 rounded-full border-emerald-300 bg-white p-0 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50"
                }
                onClick={() => {
                  void handleResetDemo();
                }}
              >
                {isResettingDemo ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 shrink-0" />
                )}
                {sidebarOpen && (
                  <span className="truncate">
                    {isResettingDemo ? "Đang làm mới demo..." : "Reset demo"}
                  </span>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={
                sidebarOpen ?
                  "mx-auto h-9 w-full max-w-[10.25rem] justify-start gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100" :
                  "h-9 w-9 p-0"
              }
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span className="truncate">{t("signOut")}</span>}
            </Button>
          )}
        </div>
      </aside>
    </>);

};

export default DashboardSidebar;
