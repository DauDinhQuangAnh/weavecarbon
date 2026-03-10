import SettingClient from "@/components/dashboard/settings/SettingClient";
import React from "react";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import {
  DASHBOARD_BASE_NAMESPACES,
  DASHBOARD_SETTINGS_NAMESPACES
} from "@/lib/i18n/namespaces";

const SETTINGS_PAGE_NAMESPACES = [
  ...DASHBOARD_BASE_NAMESPACES,
  ...DASHBOARD_SETTINGS_NAMESPACES
] as const;

const SettingPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={SETTINGS_PAGE_NAMESPACES}>
      <SettingClient />
    </ScopedIntlProvider>);
};

export default SettingPage;
