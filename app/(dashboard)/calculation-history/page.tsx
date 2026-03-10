import React from "react";
import { Suspense } from "react";
import CalculationHistoryClient from "@/components/dashboard/calculation-history/CalculationHistoryClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_CALCULATION_HISTORY_NAMESPACES } from "@/lib/i18n/namespaces";

interface CalculationHistoryPageProps {
  searchParams: Promise<{
    productId?: string;
  }>;
}

const CalculationHistoryPage = async ({
  searchParams
}: CalculationHistoryPageProps) => {
  const params = await searchParams;
  const productId = params?.productId || null;

  return (
    <ScopedIntlProvider namespaces={DASHBOARD_CALCULATION_HISTORY_NAMESPACES}>
      <Suspense
        fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
        
        <CalculationHistoryClient productId={productId} />
      </Suspense>
    </ScopedIntlProvider>);

};

export default CalculationHistoryPage;
