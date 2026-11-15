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
  Sparkles,
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
import { ROOT_MENU_ITEMS, SIDEBAR_GROUPS, TAIL_MENU_ITEMS, canShowNavigation } from "@/lib/dashboard/navigation";

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
  Settings, TrendingUp, Truck, Users, RadioTower, Activity, GitBranch, Inbox, Workflow, Flame, ShieldCheck, Sparkles };
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
    if (path === "/reports" && pathname === appRoutes.toAppPath("/report-builder")) return true;
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  };

  const menuPlan = currentPlan || company?.current_plan || null;
  const isTrialPlan =
    isTrialPlanFromPermissions ||
    getSubscriptionPlanFamily(menuPlan) === "trial";

  const access = { isDemo: isDemoSession, isTrial: isTrialPlan, canAccessSettings };
  const visibleRootItems = ROOT_MENU_ITEMS.filter((item) => canShowNavigation(item.path, access)) as NavigationItem[];
  const visibleTailItems = TAIL_MENU_ITEMS.filter((item) => canShowNavigation(item.path, access)) as NavigationItem[];
  const renderMenuItem = (item: NavigationItem, nested = false) => {
    const active = isActive(item.path);
    const Icon = icons[item.icon];
    return <Link key={item.path} href={appRoutes.toAppPath(item.path)} prefetch={false}
      title={sidebarOpen ? undefined : item.labelKey ? t(item.labelKey) : item.label}
      aria-current={active ? "page" : undefined}
      onClick={(event) => { if (active) { event.preventDefault(); return; } handleSidebarNavigate(); }}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${nested && sidebarOpen ? "pl-9" : ""} ${active ? "bg-secondary font-medium text-secondary-foreground shadow-[0_1px_0_hsl(0_0%_100%/0.8)_inset]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      <Icon className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
      {sidebarOpen && <span className="flex-1 truncate">{item.labelKey ? t(item.labelKey) : item.label}</span>}
    </Link>;
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm lg:hidden"
          onClick={onToggleSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar-background/85 backdrop-blur-xl transition-transform duration-300 lg:z-20 lg:h-dvh lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-border px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] lg:p-4">
          <Link prefetch={false} href={homeHref} className="flex min-w-0 items-center gap-2" title="WeaveCarbon">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy">
              <Leaf className="h-4 w-4 text-accent" />
            </span>
            {sidebarOpen && (
              <span className="min-w-0">
                <span className="block font-display text-sm font-semibold leading-tight text-foreground">
                  Weave<span className="text-primary">Carbon</span>
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">Dữ liệu carbon công nghiệp</span>
              </span>
            )}
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {visibleRootItems.map((item) => renderMenuItem(item))}
          {SIDEBAR_GROUPS.map((group) => {
            const open = expandedGroups.includes(group.id);
            const Icon = icons[group.icon];
            const groupActive = group.items.some((item) => isActive(item.path));
            return <div key={group.id} className="w-full">
              {sidebarOpen && <button type="button" aria-expanded={open} aria-controls={`navigation-${group.id}`}
                className={`mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${groupActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setExpandedGroups((previous) => open ? previous.filter((id) => id !== group.id) : [...previous, group.id])}>
                <Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{group.label}</span><ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
              </button>}
              {(!sidebarOpen || open) && <div id={`navigation-${group.id}`} className="animate-fade-in space-y-0.5">{(group.items as readonly NavigationItem[]).filter((item) => canShowNavigation(item.path, access)).map((item) => renderMenuItem(item, true))}</div>}
            </div>;
          })}
          <div className="mt-2 w-full space-y-0.5 border-t border-border pt-2">
            {visibleTailItems.map((item) => renderMenuItem(item))}
            {canShowNavigation("/settings", access) && renderMenuItem({ path: "/settings", icon: "Settings", labelKey: "settings" })}
          </div>
        </nav>

        <div className="border-t border-border px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:p-3">
          {sidebarOpen && (
            <div className="mb-2 px-1">
              <p className="truncate text-sm font-medium text-foreground">
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
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">
                    Demo mode
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
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
                    ? "h-10 w-full justify-center gap-2 disabled:opacity-100"
                    : "h-10 w-10 rounded-full p-0"
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
                  ? "h-9 w-full justify-center gap-2"
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
