import React from "react";
import DashboardSidebarShell from "@/components/dashboard/DashboardSidebarShell";
import PricingModalGate from "@/components/dashboard/PricingModalGate";
import { DashboardProvider } from "@/contexts/DashboardContext";
import DashboardLayoutContent from "@/components/dashboard/DashboardLayoutContent";
import RouteWeaveyChat from "@/components/ui/RouteWeaveyChat";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_BASE_NAMESPACES } from "@/lib/i18n/namespaces";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_BASE_NAMESPACES}>
      <DashboardProvider>
        <div className="flex min-h-dvh w-full flex-col overflow-x-clip bg-background lg:flex-row">
            <DashboardSidebarShell company={null} />


            <main className="flex min-h-dvh flex-1 flex-col overflow-x-clip overflow-y-auto lg:pl-56">
              <DashboardLayoutContent>{children}</DashboardLayoutContent>
            </main>


            <PricingModalGate />
            <RouteWeaveyChat />
        </div>
      </DashboardProvider>
    </ScopedIntlProvider>);

};

export default DashboardLayout;
