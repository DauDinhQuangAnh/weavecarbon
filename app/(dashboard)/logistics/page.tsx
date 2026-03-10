import React from "react";
import LogisticsClient from "@/components/dashboard/LogisticsClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_LOGISTICS_NAMESPACES } from "@/lib/i18n/namespaces";

const LogisticsPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_LOGISTICS_NAMESPACES}>
      <LogisticsClient />
    </ScopedIntlProvider>);
};

export default LogisticsPage;
