"use client";

import React, { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import SettingsTabsNav from "./SettingsTabsNav";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { usePermissions } from "@/hooks/usePermissions";

const SettingsPanelLoading = () => (
  <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
);

const SystemSettings = dynamic(() => import("./SystemSettings"), {
  loading: SettingsPanelLoading
});
const PersonalSettings = dynamic(() => import("./PersonalSettings"), {
  loading: SettingsPanelLoading
});
const UsersSettings = dynamic(() => import("./UsersSettings"), {
  loading: SettingsPanelLoading
});
const NotificationSettings = dynamic(() => import("./NotificationSettings"), {
  loading: SettingsPanelLoading
});
const EnterpriseSecuritySettings = dynamic(
  () => import("./EnterpriseSecuritySettings"),
  { loading: SettingsPanelLoading }
);

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
    if (requestedTab === "users" && canAccessUsersTab) return "users";
    if (requestedTab === "notifications") return "notifications";
    if (requestedTab === "security") return "security";
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
          notifications: "Thông báo",
          security: "Bảo mật",
        }}
      />

      <div className="mt-3">
        {activeTab === "system" ? (isRoot ? <SystemSettings /> : <PersonalSettings />) : null}
        {activeTab === "users" && canAccessUsersTab ? <UsersSettings /> : null}
        {activeTab === "notifications" ? <NotificationSettings /> : null}
        {activeTab === "security" ? <EnterpriseSecuritySettings /> : null}
      </div>
    </div>
  );

};

export default SettingsPage;
