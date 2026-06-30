import React from "react";
import DashboardSidebarShell from "@/components/dashboard/DashboardSidebarShell";
import DashboardLayoutContent from "@/components/dashboard/DashboardLayoutContent";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import DemoProvider from "@/components/demo/DemoProvider";
import DemoRoutePrefetch from "@/components/demo/DemoRoutePrefetch";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { ProductProvider } from "@/contexts/ProductContext";
import { DASHBOARD_BASE_NAMESPACES } from "@/lib/i18n/namespaces";
import RouteWeaveyChat from "@/components/ui/RouteWeaveyChat";

const DemoLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_BASE_NAMESPACES}>
      <DashboardProvider>
        <ProductProvider>
          <DemoProvider>
            <DemoRoutePrefetch />
            <div className="flex min-h-dvh w-full flex-col overflow-x-clip bg-background lg:flex-row">
              <DashboardSidebarShell company={null} />
              <main className="flex min-h-dvh flex-1 flex-col overflow-x-clip overflow-y-auto lg:pl-56">
                <DashboardLayoutContent>{children}</DashboardLayoutContent>
              </main>
              <RouteWeaveyChat />
            </div>
          </DemoProvider>
        </ProductProvider>
      </DashboardProvider>
    </ScopedIntlProvider>
  );
};

export default DemoLayout;
