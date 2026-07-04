import React from "react";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import AISettings from "@/components/dashboard/settings/AISettings";
import {
  DASHBOARD_BASE_NAMESPACES,
  DASHBOARD_SETTINGS_NAMESPACES,
} from "@/lib/i18n/namespaces";

const SETTINGS_AI_PAGE_NAMESPACES = [
  ...DASHBOARD_BASE_NAMESPACES,
  ...DASHBOARD_SETTINGS_NAMESPACES,
] as const;

const DemoSettingsAIPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={SETTINGS_AI_PAGE_NAMESPACES}>
      <AISettings />
    </ScopedIntlProvider>
  );
};

export default DemoSettingsAIPage;
