import ReportClient from "@/components/dashboard/reports/ReportClient";
import React from "react";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_REPORTS_NAMESPACES } from "@/lib/i18n/namespaces";

const ReportPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_REPORTS_NAMESPACES}>
      <ReportClient />
    </ScopedIntlProvider>);
};

export default ReportPage;
