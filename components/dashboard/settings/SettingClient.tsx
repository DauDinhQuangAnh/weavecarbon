"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Settings as SettingsIcon, Users } from "lucide-react";
import SystemSettings from "./SystemSettings";
import PersonalSettings from "./PersonalSettings";
import UsersSettings from "./UsersSettings";
import AISettings from "./AISettings";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { usePermissions } from "@/hooks/usePermissions";

const SettingsPage: React.FC = () => {
  const t = useTranslations("settings");
  const systemT = useTranslations("settings.system");
  const router = useRouter();
  const {
    canAccessSettings,
    canAccessAISettings,
    isRoot,
    isTrialPlan
  } = usePermissions();
  const [activeTab, setActiveTab] = useState("system");
  const { setPageTitle } = useDashboardTitle();
  const canAccessUsersTab = isRoot && !isTrialPlan;

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

  const SETTINGS_TABS = useMemo(
    () => isRoot ?
    [
    { id: "system", label: t("tabs.system"), icon: SettingsIcon },
    ...(canAccessUsersTab ? [{ id: "users", label: t("tabs.users"), icon: Users }] : []),
    ...(canAccessAISettings ? [{ id: "ai", label: "AI", icon: Bot }] : [])] :
    [{ id: "system", label: t("tabs.system"), icon: SettingsIcon }],
    [canAccessAISettings, canAccessUsersTab, isRoot, t]
  );

  useEffect(() => {
    if (SETTINGS_TABS.some((tab) => tab.id === activeTab)) return;
    if (SETTINGS_TABS.length > 0) {
      setActiveTab(SETTINGS_TABS[0].id);
    }
  }, [SETTINGS_TABS, activeTab]);

  if (!canAccessSettings) {
    return null;
  }

  if (!isRoot) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <PersonalSettings />
      </div>);

  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4">
        
        
        <div className="w-full">
          <TabsList
            className={`grid h-auto w-full grid-cols-1 gap-2 overflow-visible bg-transparent p-0 ${
            SETTINGS_TABS.length === 1 ?
            "sm:grid-cols-1" :
            SETTINGS_TABS.length === 2 ?
            "sm:grid-cols-2" :
            "sm:grid-cols-3"
            }`}>
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="group flex min-h-[44px] h-auto items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md data-[state=active]:border-primary/55 data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/30 data-[state=active]:shadow-md">

                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition-all group-data-[state=active]:bg-primary/20 group-data-[state=active]:text-primary">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span>{tab.label}</span>
                </TabsTrigger>);

            })}
          </TabsList>
        </div>

        
        <TabsContent value="system" className="mt-3">
          <SystemSettings />
        </TabsContent>

        {canAccessUsersTab && (
          <TabsContent value="users" className="mt-3">
            <UsersSettings />
          </TabsContent>
        )}

        {canAccessAISettings && (
          <TabsContent value="ai" className="mt-3">
            <AISettings />
          </TabsContent>
        )}
      </Tabs>
    </div>);

};

export default SettingsPage;
