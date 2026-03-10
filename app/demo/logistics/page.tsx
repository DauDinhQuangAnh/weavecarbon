import LogisticsClient from "@/components/dashboard/LogisticsClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_LOGISTICS_NAMESPACES } from "@/lib/i18n/namespaces";

export default function DemoLogisticsPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_LOGISTICS_NAMESPACES}>
      <LogisticsClient />
    </ScopedIntlProvider>
  );
}

