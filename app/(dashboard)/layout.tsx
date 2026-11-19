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
        <div className="app-contrast relative flex min-h-dvh w-full flex-col overflow-x-clip lg:flex-row">
              <div aria-hidden className="pointer-events-none fixed -left-24 top-24 z-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              <div aria-hidden className="pointer-events-none fixed -right-20 bottom-0 z-0 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
            <DashboardSidebarShell company={null} />


            <main className="relative z-10 flex min-h-dvh flex-1 flex-col overflow-x-clip overflow-y-auto lg:pl-64">
              <DashboardLayoutContent>{children}</DashboardLayoutContent>
            </main>


            <PricingModalGate />
            <RouteWeaveyChat />
        </div>
      </DashboardProvider>
    </ScopedIntlProvider>);

};

export default DashboardLayout;
