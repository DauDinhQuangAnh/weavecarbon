"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useCalculationHistory } from "@/hooks/useCalculationHistory";
import {
  fetchProductById,
  isValidProductId,
  type ProductRecord
} from "@/lib/productsApi";
import { Button } from "@/components/ui/button";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { Download, Package } from "lucide-react";
import HistorySummaryStats from "./HistorySummaryStats";
import HistoryTable from "./HistoryTable";
import HistoryEmptyState from "./HistoryEmptyState";

interface CalculationHistoryClientProps {
  productId?: string | null;
}

interface HistoryRecord {
  id: string;
  productId: string;
  productName: string;
  materialsCO2: number;
  manufacturingCO2: number;
  transportCO2: number;
  packagingCO2: number;
  totalCO2: number;
  carbonVersion: string;
  createdAt: string;
  createdBy: string;
}

const MIN_COMPONENT_CO2 = 0.01;

const TRANSPORT_FACTOR_BY_MODE: Record<"road" | "sea" | "air" | "rail", number> = {
  road: 0.089,
  sea: 0.016,
  air: 0.602,
  rail: 0.028
};

const inferTransportPerProduct = (product: ProductRecord): number => {
  const weightTonnes = Math.max(0, Number(product.weightPerUnit) || 0) / 1_000_000;
  if (weightTonnes <= 0) {
    return 0;
  }

  if (product.transportLegs.length > 0) {
    const transportFromLegs = product.transportLegs.reduce((sum, leg) => {
      const distance = Number(leg.estimatedDistance) || 0;
      if (distance <= 0) {
        return sum;
      }

      const factor =
      typeof leg.emissionFactor === "number" &&
      Number.isFinite(leg.emissionFactor) &&
      leg.emissionFactor > 0 ?
      leg.emissionFactor :
      TRANSPORT_FACTOR_BY_MODE[leg.mode] ?? TRANSPORT_FACTOR_BY_MODE.road;

      return sum + weightTonnes * distance * factor;
    }, 0);

    if (transportFromLegs > 0) {
      return transportFromLegs;
    }
  }

  const estimatedDistance = Number(product.estimatedTotalDistance) || 0;
  if (estimatedDistance > 0) {
    const fallbackMode = product.transportLegs[0]?.mode ?? "sea";
    const factor =
    TRANSPORT_FACTOR_BY_MODE[fallbackMode] ?? TRANSPORT_FACTOR_BY_MODE.sea;
    return weightTonnes * estimatedDistance * factor;
  }

  return 0;
};

const resolvePackagingPerProduct = (product: ProductRecord): number => {
  const perProduct = product.carbonResults?.perProduct as {
    packaging?: number;
  } | undefined;
  const totalBatch = product.carbonResults?.totalBatch as {
    packaging?: number;
  } | undefined;

  const perProductPackaging = Number(perProduct?.packaging) || 0;
  if (perProductPackaging > 0) {
    return perProductPackaging;
  }

  const totalBatchPackaging = Number(totalBatch?.packaging) || 0;
  if (totalBatchPackaging > 0 && product.quantity > 0) {
    return totalBatchPackaging / product.quantity;
  }

  return 0;
};

const applyMinimumComponentValues = (record: HistoryRecord): HistoryRecord => {
  const hasCarbonData =
  record.totalCO2 > 0 ||
  record.materialsCO2 > 0 ||
  record.manufacturingCO2 > 0;

  if (!hasCarbonData) {
    return record;
  }

  const transportCO2 =
  record.transportCO2 > 0 ? record.transportCO2 : MIN_COMPONENT_CO2;
  const packagingCO2 =
  record.packagingCO2 > 0 ? record.packagingCO2 : MIN_COMPONENT_CO2;
  const totalFromBreakdown =
  record.materialsCO2 +
  record.manufacturingCO2 +
  transportCO2 +
  packagingCO2;

  return {
    ...record,
    transportCO2,
    packagingCO2,
    totalCO2: Math.max(record.totalCO2, totalFromBreakdown)
  };
};

const CalculationHistoryClient: React.FC<CalculationHistoryClientProps> = ({
  productId
}) => {
  const { loading } = useAuth();
  const t = useTranslations("calculationHistory");
  const router = useRouter();
  const { setPageTitle } = useDashboardTitle();
  const { history, isLoaded } = useCalculationHistory();
  const [fallbackHistory, setFallbackHistory] = React.useState<HistoryRecord | null>(null);
  const [fallbackLoading, setFallbackLoading] = React.useState(false);

  const filteredHistory = productId ?
  history.filter((h) => h.productId === productId) :
  history;
  const historyForView = React.useMemo(() => {
    if (filteredHistory.length === 0) {
      return fallbackHistory ? [applyMinimumComponentValues(fallbackHistory)] : [];
    }

    if (!fallbackHistory || !productId) {
      return filteredHistory.map((item) => applyMinimumComponentValues(item as HistoryRecord));
    }

    return filteredHistory.map((item) => {
      if (item.productId !== productId) {
        return applyMinimumComponentValues(item as HistoryRecord);
      }

      return applyMinimumComponentValues({
        ...item,
        transportCO2:
        item.transportCO2 > 0 ? item.transportCO2 : fallbackHistory.transportCO2,
        packagingCO2:
        item.packagingCO2 > 0 ? item.packagingCO2 : fallbackHistory.packagingCO2,
        totalCO2:
        item.totalCO2 > 0 ? item.totalCO2 : fallbackHistory.totalCO2
      } as HistoryRecord);
    });
  }, [fallbackHistory, filteredHistory, productId]);

  const getProductName = (id: string) => {
    if (fallbackHistory?.productId === id && fallbackHistory.productName) {
      return fallbackHistory.productName;
    }
    return id;
  };

  const handleExportCSV = () => {
    const headers = [
    t("csvHeaders.id"),
    t("csvHeaders.product"),
    t("csvHeaders.materials"),
    t("csvHeaders.manufacturing"),
    t("csvHeaders.transport"),
    t("csvHeaders.packaging"),
    t("csvHeaders.totalCO2"),
    t("csvHeaders.version"),
    t("csvHeaders.createdDate"),
    t("csvHeaders.createdBy")];

    const rows = historyForView.map((h) => [
    h.id,
    h.productName,
    h.materialsCO2,
    h.manufacturingCO2,
    h.transportCO2,
    h.packagingCO2,
    h.totalCO2,
    h.carbonVersion,
    h.createdAt,
    h.createdBy]
    );

    const csvContent = [headers, ...rows].
    map((row) => row.join(",")).
    join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${t("csvExportFileName")}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  React.useEffect(() => {
    setPageTitle(t("title"), t("subtitle"));
  }, [setPageTitle, t]);

  React.useEffect(() => {
    let cancelled = false;

    const loadFallback = async () => {
      if (!productId || !isValidProductId(productId)) {
        setFallbackHistory(null);
        return;
      }

      setFallbackLoading(true);
      try {
        const product = await fetchProductById(productId);
        if (cancelled) return;
        const materialsCO2 = Number(product.carbonResults?.perProduct?.materials) || 0;
        const manufacturingCO2 = Number(product.carbonResults?.perProduct?.production) || 0;
        const energyCO2 = Number(product.carbonResults?.perProduct?.energy) || 0;
        const transportFromResult = Number(product.carbonResults?.perProduct?.transport) || 0;
        const transportCO2 =
        transportFromResult > 0 ?
        transportFromResult :
        inferTransportPerProduct(product);
        const packagingCO2 = resolvePackagingPerProduct(product);
        const totalFromResult = Number(product.carbonResults?.perProduct?.total) || 0;
        const totalCO2 =
        totalFromResult > 0 ?
        totalFromResult :
        materialsCO2 + manufacturingCO2 + energyCO2 + transportCO2 + packagingCO2;

        setFallbackHistory({
          id: `fallback-${product.id}`,
          productId: product.id,
          productName: product.productName || product.productCode || product.id,
          materialsCO2,
          manufacturingCO2,
          transportCO2,
          packagingCO2,
          totalCO2,
          carbonVersion: `v${product.version || 1}`,
          createdAt: product.updatedAt || product.createdAt || new Date().toISOString(),
          createdBy: "system"
        });
      } catch {
        if (!cancelled) {
          setFallbackHistory(null);
        }
      } finally {
        if (!cancelled) {
          setFallbackLoading(false);
        }
      }
    };

    void loadFallback();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!isLoaded || loading || fallbackLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>);

  }

  return (
    <div className="space-y-6">
      <HistorySummaryStats history={historyForView} />

      
      {historyForView.length === 0 ?
      <HistoryEmptyState
        onNavigateAssessment={() => router.push("/assessment")} /> :


      <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200 bg-slate-50/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>{t("detailsTitle")}</CardTitle>
                <CardDescription className="text-slate-600">
                  {productId ?
                `${t("productHistoryTitle")}${getProductName(productId)}` :
                t("allCalculations")}
                </CardDescription>
              </div>
              <Button
                variant="destructive"
                className="mt-1 shrink-0 self-start bg-red-600 text-white hover:bg-red-700 sm:mt-2 sm:self-end"
                onClick={handleExportCSV}>

                <Download className="w-4 h-4 mr-2" />
                {t("exportCSV")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <HistoryTable
            history={historyForView}
            onProductClick={(id) => router.push(`/summary/${id}`)} />

          </CardContent>
        </Card>
      }

      {!productId &&
      <div className="flex justify-center gap-4">
          <Button
          variant="outline"
          className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          onClick={() => router.push("/overview")}>

            {t("backToDashboard")}
          </Button>
          <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => router.push("/assessment")}>

            <Package className="w-4 h-4 mr-2" />
            {t("addNewProduct")}
          </Button>
        </div>
      }
    </div>);

};

export default CalculationHistoryClient;
