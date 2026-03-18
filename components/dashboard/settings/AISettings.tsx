"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import WeaveyChat from "@/components/ui/WeaveyChat";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { usePermissions } from "@/hooks/usePermissions";
import SettingsTabsNav from "./SettingsTabsNav";

const AISettings: React.FC = () => {
  const t = useTranslations("settings");
  const router = useRouter();
  const { setPageTitle } = useDashboardTitle();
  const {
    canAccessSettings,
    canAccessAISettings,
    isRoot,
    isTrialPlan,
  } = usePermissions();
  const canAccessUsersTab = isRoot && !isTrialPlan;

  React.useEffect(() => {
    setPageTitle(t("ai.title"), t("ai.subtitle"));
  }, [setPageTitle, t]);

  React.useEffect(() => {
    if (!canAccessSettings) {
      router.replace("/overview");
      return;
    }

    if (!canAccessAISettings) {
      router.replace("/settings");
    }
  }, [canAccessAISettings, canAccessSettings, router]);

  if (!canAccessSettings || !canAccessAISettings) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <SettingsTabsNav
        activeId="ai"
        canAccessUsersTab={canAccessUsersTab}
        canAccessAISettings={canAccessAISettings}
        labels={{
          system: t("tabs.system"),
          users: t("tabs.users"),
          ai: t("tabs.ai"),
        }}
      />

      <WeaveyChat variant="dashboard" displayMode="page" />
    </div>
  );
};

export default AISettings;
