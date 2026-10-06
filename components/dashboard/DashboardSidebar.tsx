"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Calculator as CalculatorIcon,
  CreditCard,
  Factory,
  DatabaseZap,
  ClipboardCheck,
  CloudSun,
  Scale,
  Layers3,
  FileCheck,
  FileText,
  History,
  Leaf,
  Loader2,
  LogOut,
  Package,
  Settings,
  TrendingUp,
  Truck,
  Users,
  RadioTower,
  Activity,
  GitBranch,
  Inbox,
  Workflow,
  Flame,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { authTokenStore } from "@/lib/apiClient";
import { useAppRoutes } from "@/lib/demo/routes";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { getSubscriptionPlanFamily } from "@/lib/subscriptionPlans";
import { Company, Profile } from "@/types/app.type";
import { PROTECTED_MENU_ITEMS, SIDEBAR_GROUPS, canShowNavigation } from "@/lib/dashboard/navigation";

interface DashboardSidebarProps {
  company: Company | null;
  companyLoading?: boolean;
  companyConfirmedMissing?: boolean;
  profile: Profile | null;
  currentPlan: string | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const icons = { AlertCircle, BarChart3, CalculatorIcon, CreditCard, Factory, DatabaseZap,
  ClipboardCheck, CloudSun, Scale, Layers3, FileCheck, FileText, History, Package,
  Settings, TrendingUp, Truck, Users, RadioTower, Activity, GitBranch, Inbox, Workflow, Flame, ShieldCheck };
type NavigationItem = { path: string; icon: keyof typeof icons; labelKey?: string; label?: string };

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  company,
  companyLoading = false,
  companyConfirmedMissing = false,
  profile,
  currentPlan,
  sidebarOpen,
  onToggleSidebar,
}) => {
  const t = useTranslations("sidebar");
  const { user, signOut, isDemoSession, exitDemoSession } = useAuth();
  const { canAccessSettings, isTrialPlan: isTrialPlanFromPermissions } =
    usePermissions();
  const appRoutes = useAppRoutes();
  const router = useRouter();
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["carbon"]);
  useEffect(() => {
    const group = SIDEBAR_GROUPS.find((entry) => entry.items.some((item) => pathname === appRoutes.toAppPath(item.path) || pathname.startsWith(`${appRoutes.toAppPath(item.path)}/`)));
    if (group) setExpandedGroups((previous) => previous.includes(group.id) ? previous : [...previous, group.id]);
  }, [pathname, appRoutes]);
  const [isLeavingDemo, setIsLeavingDemo] = useState(false);
  const hasSession = Boolean(
    user?.id || profile?.id || authTokenStore.getAccessToken()
  );
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

  const handleExitDemo = async () => {
    if (isLeavingDemo) {
      return;
    }

    setIsLeavingDemo(true);
    try {
      await exitDemoSession();
      router.push("/");
    } finally {
      setIsLeavingDemo(false);
    }
  };

  const isActive = (path: string) => {
    const targetPath = appRoutes.toAppPath(path);
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  };

  const menuPlan = currentPlan || company?.current_plan || null;
  const isTrialPlan =
    isTrialPlanFromPermissions ||
    getSubscriptionPlanFamily(menuPlan) === "trial";

  const access = { isDemo: isDemoSession, isTrial: isTrialPlan, canAccessSettings };
  const visibleMenuItems = PROTECTED_MENU_ITEMS.filter((item) => canShowNavigation(item.path, access));
  const renderMenuItem = (item: NavigationItem, nested = false) => {
    const active = isActive(item.path);
    const Icon = icons[item.icon];
    return <Link key={item.path} href={appRoutes.toAppPath(item.path)} prefetch={false}
      title={item.labelKey ? t(item.labelKey) : item.label}
      aria-current={active ? "page" : undefined}
      onClick={(event) => { if (active) { event.preventDefault(); return; } handleSidebarNavigate(); }}
      className={`flex w-full max-w-[11.25rem] items-center gap-3 rounded-lg px-3 py-2 transition-colors ${nested && sidebarOpen ? "pl-7" : ""} ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      <Icon className="h-5 w-5 shrink-0" />
      {sidebarOpen && <span className="text-sm font-medium">{item.labelKey ? t(item.labelKey) : item.label}</span>}
    </Link>;
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onToggleSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-transform duration-300 lg:z-20 lg:h-dvh lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-border px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] lg:p-4">
          <Link prefetch={false} href={homeHref} className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-forest">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            {sidebarOpen && (
              <span className="truncate font-display font-bold text-foreground">
                WEAVE<span className="text-primary">CARBON</span>
              </span>
            )}
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-4 py-4">
          {visibleMenuItems.map((item) => renderMenuItem(item))}
          {SIDEBAR_GROUPS.map((group) => {
            const open = expandedGroups.includes(group.id);
            const Icon = icons[group.icon];
            return <div key={group.id} className="w-full max-w-[11.25rem] border-t border-border/60 pt-2">
              {sidebarOpen && <button type="button" aria-expanded={open} aria-controls={`navigation-${group.id}`}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
                onClick={() => setExpandedGroups((previous) => open ? previous.filter((id) => id !== group.id) : [...previous, group.id])}>
                <Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{group.label}</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>}
              {(!sidebarOpen || open) && <div id={`navigation-${group.id}`} className="space-y-1">{group.items.map((item) => renderMenuItem(item, true))}</div>}
            </div>;
          })}
          {canShowNavigation("/settings", access) && <div className="w-full max-w-[11.25rem] border-t border-border pt-2">{renderMenuItem({ path: "/settings", icon: "Settings", labelKey: "settings" })}</div>}
        </nav>

        <div className="border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 lg:p-4">
          {sidebarOpen && (
            <div className="mb-3">
              <p className="truncate text-sm font-medium">
                {profile?.full_name || user?.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {company?.name || (companyLoading ? "" : companyConfirmedMissing ? "No company" : "")}
              </p>
            </div>
          )}

          {isDemoSession ? (
            <div className={sidebarOpen ? "space-y-3" : "flex justify-center"}>
              {sidebarOpen && (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Demo mode
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    Thoát khỏi chế độ demo
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                title="Thoát demo"
                disabled={isLeavingDemo}
                className={
                  sidebarOpen
                    ? "mx-auto h-10 w-full max-w-[11.25rem] justify-start gap-2 border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-100"
                    : "h-10 w-10 rounded-full border-slate-300 bg-white p-0 text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                }
                onClick={() => {
                  void handleExitDemo();
                }}
              >
                {isLeavingDemo ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 shrink-0" />
                )}
                {sidebarOpen && (
                  <span className="truncate">
                    {isLeavingDemo ? "Đang thoát demo..." : "Thoát demo"}
                  </span>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={
                sidebarOpen
                  ? "mx-auto h-9 w-full max-w-[11.25rem] justify-start gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                  : "h-9 w-9 p-0"
              }
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {sidebarOpen && <span className="truncate">{t("signOut")}</span>}
            </Button>
          )}
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
