import { Suspense } from "react";
import CalculationHistoryClient from "@/components/dashboard/calculation-history/CalculationHistoryClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_CALCULATION_HISTORY_NAMESPACES } from "@/lib/i18n/namespaces";

interface DemoCalculationHistoryPageProps {
  searchParams: Promise<{ productId?: string }>;
}

const DemoCalculationHistoryPage = async ({
  searchParams,
}: DemoCalculationHistoryPageProps) => {
  const params = await searchParams;
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_CALCULATION_HISTORY_NAMESPACES}>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        }
      >
        <CalculationHistoryClient productId={params?.productId ?? null} />
      </Suspense>
    </ScopedIntlProvider>
  );
};

export default DemoCalculationHistoryPage;
