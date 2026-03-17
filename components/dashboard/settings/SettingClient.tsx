"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import SystemSettings from "./SystemSettings";
import PersonalSettings from "./PersonalSettings";
import UsersSettings from "./UsersSettings";
import SettingsTabsNav from "./SettingsTabsNav";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { usePermissions } from "@/hooks/usePermissions";

const SettingsPage: React.FC = () => {
  const t = useTranslations("settings");
  const systemT = useTranslations("settings.system");
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    canAccessSettings,
    canAccessAISettings,
    isRoot,
    isTrialPlan
  } = usePermissions();
  const { setPageTitle } = useDashboardTitle();
  const canAccessUsersTab = isRoot && !isTrialPlan;
  const activeTab = useMemo(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "users" && canAccessUsersTab) {
      return "users";
    }
    return "system";
  }, [canAccessUsersTab, searchParams]);

  useEffect(() => {
    setPageTitle(
      t("title"),
      isRoot ? t("subtitle") : systemT("personalInfoDesc")
    );
  }, [setPageTitle, t, systemT, isRoot]);

  useEffect(() => {
    if (!canAccessSettings) {
      router.replace("/overview");
      return;
    }
  }, [canAccessSettings, router]);

  if (!canAccessSettings) {
    return null;
  }

  return (
    <div
      className={`mx-auto w-full space-y-4 ${isRoot ? "max-w-[1200px]" : "max-w-5xl"}`}
    >
      <SettingsTabsNav
        activeId={activeTab}
        canAccessUsersTab={canAccessUsersTab}
        canAccessAISettings={canAccessAISettings}
        labels={{
          system: t("tabs.system"),
          users: t("tabs.users"),
          ai: "AI",
        }}
      />

      <div className="mt-3">
        {activeTab === "system" ? (isRoot ? <SystemSettings /> : <PersonalSettings />) : null}
        {activeTab === "users" && canAccessUsersTab ? <UsersSettings /> : null}
      </div>
    </div>
  );

};

export default SettingsPage;
