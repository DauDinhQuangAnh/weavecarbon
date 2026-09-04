import React from "react";
import OverviewPageClient from "@/components/dashboard/overview/OverviewPageClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_OVERVIEW_NAMESPACES } from "@/lib/i18n/namespaces";
import { ProductProvider } from "@/contexts/ProductContext";

const OverviewPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_OVERVIEW_NAMESPACES}>
      <ProductProvider>
        <OverviewPageClient />
      </ProductProvider>
    </ScopedIntlProvider>);
};

export default OverviewPage;
