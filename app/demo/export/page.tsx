import ExportClient from "@/components/dashboard/export/ExportClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_EXPORT_NAMESPACES } from "@/lib/i18n/namespaces";

export default function DemoExportPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_EXPORT_NAMESPACES}>
      <ExportClient />
    </ScopedIntlProvider>
  );
}

