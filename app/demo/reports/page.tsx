import ReportClient from "@/components/dashboard/reports/ReportClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_REPORTS_NAMESPACES } from "@/lib/i18n/namespaces";

export default function DemoReportsPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_REPORTS_NAMESPACES}>
      <ReportClient />
    </ScopedIntlProvider>
  );
}

