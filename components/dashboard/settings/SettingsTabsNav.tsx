"use client";

import Link from "next/link";
import { Bot, Settings as SettingsIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsTabId = "system" | "users" | "ai";

interface SettingsTabsNavProps {
  activeId: SettingsTabId;
  canAccessUsersTab: boolean;
  canAccessAISettings: boolean;
  labels: {
    system: string;
    users: string;
    ai: string;
  };
}

const baseTabClassName =
  "group flex min-h-[44px] h-auto items-center justify-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md";

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
          "grid h-auto w-full grid-cols-1 gap-2 overflow-visible bg-transparent p-0",
          items.length === 1
            ? "sm:grid-cols-1"
            : items.length === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-3"
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeId;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                baseTabClassName,
                isActive
                  ? "border-primary/55 bg-primary/12 text-primary ring-1 ring-primary/30 shadow-md"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition-all",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsTabsNav;
