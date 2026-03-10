import ExportClient from "@/components/dashboard/export/ExportClient";
import React from "react";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_EXPORT_NAMESPACES } from "@/lib/i18n/namespaces";

const ExportPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_EXPORT_NAMESPACES}>
      <ExportClient />
    </ScopedIntlProvider>);
};

export default ExportPage;
