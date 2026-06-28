import SettingClient from "@/components/dashboard/settings/SettingClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_SETTINGS_NAMESPACES } from "@/lib/i18n/namespaces";

export default function DemoSettingsPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_SETTINGS_NAMESPACES}>
      <SettingClient />
    </ScopedIntlProvider>
  );
}
