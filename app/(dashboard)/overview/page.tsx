import React from "react";
import OverviewPageClient from "@/components/dashboard/overview/OverviewPageClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_OVERVIEW_NAMESPACES } from "@/lib/i18n/namespaces";

const OverviewPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_OVERVIEW_NAMESPACES}>
      <OverviewPageClient />
    </ScopedIntlProvider>);
};

export default OverviewPage;
