"use client";

import Link from "next/link";
import { Bell, Bot, Settings as SettingsIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsTabId = "system" | "users" | "ai" | "notifications";

interface SettingsTabsNavProps {
  activeId: SettingsTabId;
  canAccessUsersTab: boolean;
  canAccessAISettings: boolean;
  labels: {
    system: string;
    users: string;
    ai: string;
    notifications: string;
  };
}

const baseTabClassName =
  "group flex min-h-[52px] h-auto flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center text-[11px] font-semibold leading-none transition-all sm:min-h-[44px] sm:flex-row sm:justify-center sm:gap-2.5 sm:rounded-lg sm:px-3 sm:py-2.5 sm:text-sm sm:leading-tight sm:shadow-sm sm:hover:-translate-y-0.5 sm:hover:shadow-md";

const MOBILE_TAB_TONES: Record<
  SettingsTabId,
  {
    activeTab: string;
    inactiveTab: string;
    activeIcon: string;
    inactiveIcon: string;
  }
> = {
  system: {
    activeTab: "border-emerald-200 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 shadow-sm",
    inactiveTab: "border-transparent bg-emerald-50/70 text-emerald-800 hover:bg-emerald-50",
    activeIcon: "bg-emerald-100 text-emerald-700",
    inactiveIcon: "bg-white/85 text-emerald-600",
  },
  users: {
    activeTab: "border-amber-200 bg-amber-50 text-amber-900 ring-1 ring-amber-200 shadow-sm",
    inactiveTab: "border-transparent bg-amber-50/70 text-amber-800 hover:bg-amber-50",
    activeIcon: "bg-amber-100 text-amber-700",
    inactiveIcon: "bg-white/85 text-amber-600",
  },
  ai: {
    activeTab: "border-sky-200 bg-sky-50 text-sky-900 ring-1 ring-sky-200 shadow-sm",
    inactiveTab: "border-transparent bg-sky-50/70 text-sky-800 hover:bg-sky-50",
    activeIcon: "bg-sky-100 text-sky-700",
    inactiveIcon: "bg-white/85 text-sky-600",
  },
  notifications: {
    activeTab: "border-violet-200 bg-violet-50 text-violet-900 ring-1 ring-violet-200 shadow-sm",
    inactiveTab: "border-transparent bg-violet-50/70 text-violet-800 hover:bg-violet-50",
    activeIcon: "bg-violet-100 text-violet-700",
    inactiveIcon: "bg-white/85 text-violet-600",
  },
};

const SettingsTabsNav: React.FC<SettingsTabsNavProps> = ({
  activeId,
  canAccessUsersTab,
  canAccessAISettings,
  labels,
}) => {
  const items = [
    {
      id: "system" as const,
      label: labels.system,
      icon: SettingsIcon,
      href: "/settings?tab=system",
    },
    ...(canAccessUsersTab
      ? [
          {
            id: "users" as const,
            label: labels.users,
            icon: Users,
            href: "/settings?tab=users",
          },
        ]
      : []),
    {
      id: "notifications" as const,
      label: labels.notifications,
      icon: Bell,
      href: "/settings?tab=notifications",
    },
    ...(canAccessAISettings
      ? [
          {
            id: "ai" as const,
            label: labels.ai,
            icon: Bot,
            href: "/settings/ai",
          },
        ]
      : []),
  ];

  return (
    <div className="w-full">
      <div
        className={cn(
          "grid h-auto w-full gap-1 overflow-visible rounded-2xl border border-slate-200 bg-slate-50/80 p-1 sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0",
          items.length === 1
            ? "grid-cols-1"
            : items.length === 2
              ? "grid-cols-2"
              : items.length === 3
                ? "grid-cols-3"
                : "grid-cols-4"
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
          const tone = MOBILE_TAB_TONES[item.id];

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                baseTabClassName,
                isActive
                  ? `${tone.activeTab} sm:border-primary/55 sm:bg-primary/12 sm:text-primary sm:ring-primary/30 sm:shadow-md`
                  : `${tone.inactiveTab} sm:border-slate-300 sm:bg-white sm:text-slate-700 sm:hover:border-slate-400 sm:hover:bg-white`
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full transition-all sm:h-7 sm:w-7",
                  isActive
                    ? `${tone.activeIcon} sm:bg-primary/20 sm:text-primary`
                    : `${tone.inactiveIcon} sm:bg-slate-200 sm:text-slate-600`
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="max-w-full truncate whitespace-nowrap px-1 sm:max-w-none sm:px-0">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsTabsNav;
