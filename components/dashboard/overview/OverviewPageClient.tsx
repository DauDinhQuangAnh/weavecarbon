
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/contexts/ProductContext";
import { api, isUnauthorizedApiError } from "@/lib/apiClient";
import { fetchComplianceMarkets } from "@/lib/exportComplianceApi";
import { showNoPermissionToast } from "@/lib/noPermissionToast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  FileCheck,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Target,
  Gauge,
  Lightbulb,
  PlusCircle } from
"lucide-react";
import { useLocale, useTranslations } from "next-intl";
import ProductOverviewModal from "../assessment/ProductOverviewModal";
import OverviewCharts, {
  EmissionBreakdownPoint,
  TrendDataPoint } from
"../OverviewCharts";
import { useRouter } from "next/navigation";
import { useAppRoutes } from "@/lib/demo/routes";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import { toast } from "sonner";

interface Company {
  target_markets: string[] | null;
  name?: string;
}

interface MarketReadinessItem {
  market: string;
  score: number;
  status?: "good" | "warning" | "danger";
}

interface RecommendationItem {
  id: string | number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  reduction: string;
}

interface OverviewStats {
  totalCO2: number;
  skuCount: number;
  exportReadiness: number;
  confidenceScore: number;
}

interface DashboardOverviewResponse {
  stats?: {
    total_co2e?: number;
    total_skus?: number;
    avg_export_readiness?: number;
    data_confidence?: number;
  };
  carbon_trend?: Array<{
    month?: string;
    label?: string;
    actual_emissions?: number;
    target_emissions?: number;
  }>;
  emission_breakdown?: Array<{
    category?: string;
    label?: string;
    percentage?: number;
    color?: string;
  }>;
  market_readiness?: Array<{
    market_code?: string;
    market_name?: string;
    score?: number;
    status?: "good" | "warning" | "danger";
  }>;
  recommendations?: Array<{
    id: string | number;
    title?: string;
    description?: string;
    impact_level?: "high" | "medium" | "low";
    reduction_percentage?: number;
  }>;
}

interface SaveTargetResponse {
  target_co2e?: number;
  actual_co2e?: number;
  reduction_percentage?: number | null;
  baseline_co2e?: number | null;
  year?: number;
  month?: number;
  mode?: "manual" | "auto";
}

const MARKET_READINESS_PREVIEW_LIMIT = 3;

const EMISSION_COLOR_PALETTE = [
"hsl(171 78% 33%)",
"hsl(220 85% 54%)",
"hsl(281 78% 56%)",
"hsl(8 82% 56%)"];

const PRICING_MODAL_OPEN_EVENT = "weavecarbon:open-pricing-modal";
const OVERVIEW_STAT_HEADER_CLASS =
  "rounded-t-[inherit] border-b border-slate-300 bg-slate-100 p-3 pb-2 md:p-6 md:pb-3";
const OVERVIEW_STAT_HEADER_INNER_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2";
const OVERVIEW_STAT_LABEL_CLASS =
  "line-clamp-2 text-sm font-semibold leading-snug text-slate-700 md:text-[15px]";
const OVERVIEW_STAT_VALUE_CLASS =
  "shrink-0 text-right text-2xl font-bold leading-none text-slate-900 md:text-3xl";
const OVERVIEW_STAT_ACCENT_VALUE_CLASS =
  "shrink-0 text-right text-2xl font-bold leading-none md:text-3xl";


const normalizeEmissionKey = (value: string) =>
value.
toLowerCase().
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
replace(/[^a-z0-9]+/g, " ").
trim();

const getCategoryColor = (label: string) => {
  const key = normalizeEmissionKey(label);

  if (
  key.includes("material") ||
  key.includes("materials") ||
  key.includes("vat lieu") ||
  key.includes("nguyen lieu"))
  {
    return EMISSION_COLOR_PALETTE[0];
  }

  if (
  key.includes("production") ||
  key.includes("manufacturing") ||
  key.includes("san xuat"))
  {
    return EMISSION_COLOR_PALETTE[1];
  }

  if (
  key.includes("energy") ||
  key.includes("electricity") ||
  key.includes("power") ||
  key.includes("dien") ||
  key.includes("nang luong"))
  {
    return EMISSION_COLOR_PALETTE[2];
  }

  if (
  key.includes("transport") ||
  key.includes("transportation") ||
  key.includes("logistics") ||
  key.includes("shipping") ||
  key.includes("van chuyen"))
  {
    return EMISSION_COLOR_PALETTE[3];
  }

  if (key.includes("packaging") || key.includes("dong goi")) {
    return EMISSION_COLOR_PALETTE[2];
  }

  return null;
};

const pickEmissionColor = (
label: string,
apiColor: string | undefined,
usedColors: Set<string>,
index: number) =>
{
  const preferred = getCategoryColor(label);
  if (preferred && !usedColors.has(preferred.toLowerCase())) {
    usedColors.add(preferred.toLowerCase());
    return preferred;
  }

  const cleanApiColor = apiColor?.trim();
  const apiKey = cleanApiColor?.toLowerCase();

  if (cleanApiColor && apiKey && !usedColors.has(apiKey)) {
    usedColors.add(apiKey);
    return cleanApiColor;
  }

  const fallback =
  EMISSION_COLOR_PALETTE.find(
    (color) => !usedColors.has(color.toLowerCase())
  ) || EMISSION_COLOR_PALETTE[index % EMISSION_COLOR_PALETTE.length];

  usedColors.add(fallback.toLowerCase());
  return fallback;
};

const getReadinessColor = (score: number) => {
  if (score >= 80) return "border border-emerald-300 bg-emerald-100 text-emerald-800";
  if (score >= 50) return "border border-amber-300 bg-amber-100 text-amber-800";
  return "border border-rose-300 bg-rose-100 text-rose-800";
};

const clampReadiness = (score: number) => Math.max(0, Math.min(100, score));

const normalizeReadinessScore = (score: number) => clampReadiness(Math.round(score * 100) / 100);

const mapOverviewMarketReadiness = (
items: DashboardOverviewResponse["market_readiness"] = []) =>
(items || []).map((item) => ({
  market: item.market_name || item.market_code || "Unknown",
  score: normalizeReadinessScore(item.score || 0),
  status: item.status
}));

const mapComplianceMarketReadiness = (
markets: Awaited<ReturnType<typeof fetchComplianceMarkets>>) =>
Object.values(markets).map((market) => ({
  market: market.marketName || market.market,
  score: normalizeReadinessScore(market.score)
}));

const renderMarketReadinessItem = (market: MarketReadinessItem) =>
<div
  key={market.market}
  className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">

    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-2">
        <span className="truncate font-medium text-slate-900">
          {market.market}
        </span>
        <Badge
          className={getReadinessColor(market.score)}
          variant="secondary">

          {market.score >= 80 ?
          <CheckCircle2 className="w-3 h-3 mr-1" /> :
          <AlertCircle className="w-3 h-3 mr-1" />
          }
          {market.score}%
        </Badge>
      </div>
    </div>
    <Progress value={market.score} className="h-2 bg-slate-300" />
  </div>;

const getImpactColor = (impact: string) => {
  switch (impact) {
    case "high":
      return "border border-emerald-300 bg-emerald-100 text-emerald-800";
    case "medium":
      return "border border-amber-300 bg-amber-100 text-amber-800";
    default:
      return "border border-sky-300 bg-sky-100 text-sky-800";
  }
};

const getCurrentPeriod = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
};

const OverviewPage: React.FC = () => {
  const t = useTranslations("overview");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const { canMutate } = usePermissions();
  const { currentPlan } = useSubscriptionLock();
  const { user } = useAuth();
  const { products, pendingProductData, clearPendingProduct } = useProducts();
  const navigate = useRouter();
  const appRoutes = useAppRoutes();
  const [, setCompany] = useState<Company | null>(null);
  const [apiStats, setApiStats] = useState<OverviewStats | null>(null);
  const [showMarketReadinessDialog, setShowMarketReadinessDialog] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [targetMode, setTargetMode] = useState<"auto" | "manual">("auto");
  const [autoReduction, setAutoReduction] = useState<number>(8);
  const [manualTarget, setManualTarget] = useState<string>("");
  const initialPeriod = getCurrentPeriod();
  const [targetYear, setTargetYear] = useState<number>(initialPeriod.year);
  const [targetMonth, setTargetMonth] = useState<number>(initialPeriod.month);
  const [saveTargetLoading, setSaveTargetLoading] = useState(false);
  const [overviewReloadKey, setOverviewReloadKey] = useState(0);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [marketReadiness, setMarketReadiness] = useState<MarketReadinessItem[]>(
    []
  );
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    []
  );
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [emissionBreakdown, setEmissionBreakdown] = useState<
    EmissionBreakdownPoint[]>(
    []);
  const { setPageTitle } = useDashboardTitle();
  const isTrialPlan = String(currentPlan || "").trim().toLowerCase().includes("trial");

  const handleOpenPricingModal = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(PRICING_MODAL_OPEN_EVENT));
  };

  useEffect(() => {
    setPageTitle(t("pageTitle"), t("pageSubtitle"));
  }, [setPageTitle, t]);

  useEffect(() => {
    if (pendingProductData) {
      setShowProductModal(true);
    }
  }, [pendingProductData]);

  const handleCloseModal = () => {
    setShowProductModal(false);
    clearPendingProduct();
  };

  const handleOpenTargetDialog = () => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }

    const period = getCurrentPeriod();
    setTargetYear(period.year);
    setTargetMonth(period.month);
    setTargetMode("auto");
    setShowTargetDialog(true);
  };

  const handleSaveTarget = async () => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }

    if (targetYear < 2020 || targetYear > 2100 || targetMonth < 1 || targetMonth > 12) {
      toast.error(locale === "vi" ? "Kỳ tháng không hợp lệ." : "Invalid target month.");
      return;
    }

    const payload: Record<string, unknown> = {
      mode: targetMode,
      year: targetYear,
      month: targetMonth
    };

    if (targetMode === "manual") {
      const manualValue = Number.parseFloat(manualTarget);
      if (!Number.isFinite(manualValue) || manualValue <= 0) {
        toast.error(locale === "vi" ? "Nhập mục tiêu lớn hơn 0." : "Please enter a valid target > 0.");
        return;
      }
      payload.target_co2e = Math.round(manualValue * 10000) / 10000;
    } else {
      const normalizedReduction = Math.min(50, Math.max(1, Number(autoReduction) || 0));
      payload.reduction_percentage = normalizedReduction;
    }

    try {
      setSaveTargetLoading(true);
      const result = await api.post<SaveTargetResponse>("/dashboard/targets", payload);
      const targetValue = Number(result?.target_co2e || 0);
      const monthLabel = `${String(targetMonth).padStart(2, "0")}/${targetYear}`;
      toast.success(
        locale === "vi" ?
        `Đã lưu mục tiêu ${targetValue.toLocaleString("vi-VN")} kg CO2e cho ${monthLabel}.` :
        `Saved ${targetValue.toLocaleString("en-US")} kg CO2e target for ${monthLabel}.`
      );
      setShowTargetDialog(false);
      setManualTarget("");
      setOverviewReloadKey((prev) => prev + 1);
    } catch (error) {
      if (!isUnauthorizedApiError(error)) {
        toast.error(locale === "vi" ? "Không lưu được mục tiêu." : "Unable to save target.");
      }
    } finally {
      setSaveTargetLoading(false);
    }
  };

  const localStats = useMemo(() => {
    const totalCO2 = products.reduce((sum, p) => sum + p.co2, 0);
    const skuCount = products.length;
    const publishedCount = products.filter(
      (p) => p.status === "published"
    ).length;
    const avgConfidence =
    products.length > 0 ?
    Math.round(
      products.reduce((sum, p) => sum + p.confidenceScore, 0) /
      products.length
    ) :
    0;

    const exportReadiness =
    products.length > 0 ?
    Math.round(
      publishedCount / products.length * 50 + avgConfidence * 0.5
    ) :
    0;

    return {
      totalCO2: Math.round(totalCO2 * 100) / 100,
      skuCount,
      exportReadiness: Math.min(exportReadiness, 100),
      confidenceScore: avgConfidence
    };
  }, [products]);

  const stats = apiStats || localStats;
  const marketReadinessPreview = useMemo(
    () => marketReadiness.slice(0, MARKET_READINESS_PREVIEW_LIMIT),
    [marketReadiness]
  );
  const hiddenMarketReadinessCount = Math.max(
    0,
    marketReadiness.length - marketReadinessPreview.length
  );

  const autoBaseline = useMemo(() => {
    const nonZero = trendData.
    map((point) => point.emissions).
    filter((value) => Number.isFinite(value) && value > 0);
    const source = nonZero.length > 0 ? nonZero.slice(-3) : [stats.totalCO2];
    const valid = source.filter((value) => Number.isFinite(value) && value > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }, [trendData, stats.totalCO2]);

  const autoSuggestedTarget = useMemo(() => {
    const reduction = Math.min(50, Math.max(1, autoReduction || 0));
    return Math.max(0, autoBaseline * (1 - reduction / 100));
  }, [autoBaseline, autoReduction]);

  useEffect(() => {
    let cancelled = false;

    const fetchOverviewData = async () => {
      if (!user) {
        if (!cancelled) {
          setApiStats(null);
          setMarketReadiness([]);
          setRecommendations([]);
          setTrendData([]);
          setEmissionBreakdown([]);
          setInsightsLoading(false);
        }
        return;
      }

      if (!cancelled) setInsightsLoading(true);

      try {
        const shouldLoadComplianceMarkets =
          user.user_type === "b2b" || user.user_type === "admin";

        const [overview, complianceMarkets] = await Promise.all([
        api.get<DashboardOverviewResponse>("/dashboard/overview?trend_months=6"),
        (shouldLoadComplianceMarkets ?
        fetchComplianceMarkets() :
        Promise.resolve(null)).catch((error) => {
          if (!isUnauthorizedApiError(error)) {
            console.warn("Failed to load compliance markets for overview readiness.");
          }
          return null;
        })]);

        if (cancelled) return;

        setApiStats({
          totalCO2: Math.round((overview.stats?.total_co2e || 0) * 100) / 100,
          skuCount: overview.stats?.total_skus || 0,
          exportReadiness: Math.round(overview.stats?.avg_export_readiness || 0),
          confidenceScore: Math.round(overview.stats?.data_confidence || 0)
        });

        const complianceReadiness =
        complianceMarkets && Object.keys(complianceMarkets).length > 0 ?
        mapComplianceMarketReadiness(complianceMarkets) :
        [];
        const overviewReadiness = mapOverviewMarketReadiness(overview.market_readiness);

        setCompany({
          target_markets:
          complianceReadiness.length > 0 ?
          Object.keys(complianceMarkets || {}) :
          overview.market_readiness?.map((item) => item.market_code || "") || []
        });

        setMarketReadiness(
          complianceReadiness.length > 0 ? complianceReadiness : overviewReadiness
        );

        setRecommendations(
          (overview.recommendations || []).map((item) => ({
            id: item.id,
            title: item.title || "Recommendation",
            description: item.description || "",
            impact: item.impact_level || "medium",
            reduction: `${Math.round(item.reduction_percentage || 0)}%`
          }))
        );

        setTrendData(
          (overview.carbon_trend || []).map((point) => ({
            month: point.label || point.month || "-",
            emissions: Math.round((point.actual_emissions || 0) * 100) / 100,
            target: Math.round((point.target_emissions || 0) * 100) / 100
          }))
        );

        const usedBreakdownColors = new Set<string>();
        setEmissionBreakdown(
          (overview.emission_breakdown || []).map((item, index) => {
            const name = item.label || item.category || "unknown";
            return {
              name,
              value: Math.round(item.percentage || 0),
              color: pickEmissionColor(
                name,
                item.color,
                usedBreakdownColors,
                index
              )
            };
          })
        );
      } catch {
        if (cancelled) return;

        setApiStats(null);
        setMarketReadiness([]);
        setRecommendations([]);
        setTrendData([]);
        setEmissionBreakdown([]);
      }

      setInsightsLoading(false);
    };

    fetchOverviewData();

    return () => {
      cancelled = true;
    };
  }, [user, overviewReloadKey]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <CardHeader className={OVERVIEW_STAT_HEADER_CLASS}>
            <div className={OVERVIEW_STAT_HEADER_INNER_CLASS}>
              <CardDescription className={OVERVIEW_STAT_LABEL_CLASS}>
                {t("stats.totalCO2")}
              </CardDescription>
              <CardTitle className={OVERVIEW_STAT_VALUE_CLASS}>
                {stats.totalCO2.toLocaleString(displayLocale)}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-2 md:pt-4">
            <p className="text-sm font-medium text-slate-700 md:text-[15px]">
              {t("stats.kgCO2eThisMonth")}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <CardHeader className={OVERVIEW_STAT_HEADER_CLASS}>
            <div className={OVERVIEW_STAT_HEADER_INNER_CLASS}>
              <CardDescription className={OVERVIEW_STAT_LABEL_CLASS}>
                {t("stats.skuTracking")}
              </CardDescription>
              <CardTitle className={OVERVIEW_STAT_VALUE_CLASS}>
                {stats.skuCount}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-2 md:pt-4">
            <p className="text-sm font-medium text-slate-700 md:text-[15px]">
              {t("stats.activeProducts")}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <CardHeader className={OVERVIEW_STAT_HEADER_CLASS}>
            <div className={OVERVIEW_STAT_HEADER_INNER_CLASS}>
              <CardDescription className={OVERVIEW_STAT_LABEL_CLASS}>
                {t("stats.exportReadiness")}
              </CardDescription>
              {isTrialPlan ? (
                <CardTitle className="shrink-0 text-right text-xl font-bold leading-tight text-amber-800 md:text-2xl">
                  {t("stats.trialLocked")}
                </CardTitle>
              ) : (
                <CardTitle
                  className={`${OVERVIEW_STAT_ACCENT_VALUE_CLASS} text-primary`}>
                  {stats.exportReadiness}%
                </CardTitle>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-2 md:pt-4">
            {isTrialPlan ? (
              <div className="space-y-3">
                <p className="text-xs text-amber-800 md:text-sm">
                  {t("stats.trialLockedDescription")}
                </p>
                <Button type="button" size="sm" onClick={handleOpenPricingModal}>
                  {t("stats.upgradeCta")}
                </Button>
              </div>
            ) : (
              <Progress
                value={stats.exportReadiness}
                className="h-2 bg-slate-300" />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <CardHeader className={OVERVIEW_STAT_HEADER_CLASS}>
            <div className={OVERVIEW_STAT_HEADER_INNER_CLASS}>
              <CardDescription className={OVERVIEW_STAT_LABEL_CLASS}>
                {t("stats.dataReliability")}
              </CardDescription>
              <CardTitle
                className={`${OVERVIEW_STAT_ACCENT_VALUE_CLASS} text-amber-700`}>
                {stats.confidenceScore}%
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-2 md:pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 md:text-[15px]">
              <Gauge className="w-4 h-4" />
              <span>{t("stats.basedOnSKUs", { count: stats.skuCount })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <OverviewCharts
        carbonTrendData={trendData}
        emissionBreakdown={emissionBreakdown}
        isLoading={insightsLoading}
        onOpenTargetSetup={handleOpenTargetDialog}
        canConfigureTarget={canMutate} />


      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <CardHeader className="rounded-t-[inherit] border-b border-slate-300 bg-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  {t("marketReadiness.title")}
                </CardTitle>
                <CardDescription className="text-slate-700">
                  {t("marketReadiness.subtitle")}
                </CardDescription>
              </div>
              {!isTrialPlan && hiddenMarketReadinessCount > 0 && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="mt-0.5 h-7 min-w-[2.25rem] rounded-full px-2.5 text-xs font-bold shadow-sm shadow-primary/25"
                  onClick={() => setShowMarketReadinessDialog(true)}
                  aria-label={
                    locale === "vi" ?
                      `Xem tat ca ${marketReadiness.length} thi truong` :
                      `View all ${marketReadiness.length} markets`
                  }
                  title={
                    locale === "vi" ?
                      `Xem tat ca ${marketReadiness.length} thi truong` :
                      `View all ${marketReadiness.length} markets`
                  }>
                  +{hiddenMarketReadinessCount}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 bg-white pt-5">
            {isTrialPlan ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  {t("marketReadiness.trialLockedTitle")}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {t("marketReadiness.trialLockedDescription")}
                </p>
                <Button type="button" size="sm" className="mt-3" onClick={handleOpenPricingModal}>
                  {t("marketReadiness.upgradeCta")}
                </Button>
              </div>
            ) : insightsLoading ? (
              <div className="h-28 rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" />
            ) : marketReadiness.length === 0 ? (
              <p className="text-sm text-slate-700">
                No market readiness data yet.
              </p>
            ) : (
              <>
                {marketReadinessPreview.map(renderMarketReadinessItem)}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <CardHeader className="rounded-t-[inherit] border-b border-slate-300 bg-slate-100">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              {t("recommendations.title")}
            </CardTitle>
            <CardDescription className="text-slate-700">
              {t("recommendations.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 bg-white pt-5">
            {isTrialPlan ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  {t("recommendations.trialLockedTitle")}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {t("recommendations.trialLockedDescription")}
                </p>
                <Button type="button" size="sm" className="mt-3" onClick={handleOpenPricingModal}>
                  {t("recommendations.upgradeCta")}
                </Button>
              </div>
            ) : insightsLoading ? (
              <div className="h-28 rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" />
            ) : recommendations.length === 0 ? (
              <p className="text-sm text-slate-700">
                No recommendations available.
              </p>
            ) : (
              recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border border-slate-300 bg-slate-50 p-3 transition-colors hover:bg-slate-100">

                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm text-slate-900">
                      {rec.title}
                    </h4>
                    <Badge
                      className={getImpactColor(rec.impact)}
                      variant="secondary">

                      -{rec.reduction}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-700">
                    {rec.description}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-3">
        <Card
          className="w-full cursor-pointer overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-all hover:border-primary/55 hover:shadow-md"
          onClick={() => {
            if (!canMutate) {
              showNoPermissionToast();
              return;
            }
            navigate.push(appRoutes.toAppPath("/products"));
          }}>

          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-primary">
                <PlusCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base leading-tight md:text-lg">
                  {t("quickActions.addProduct.title")}
                </CardTitle>
                <CardDescription className="line-clamp-1 text-xs text-slate-700 md:text-sm">
                  {t("quickActions.addProduct.description")}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 border-slate-300 bg-white px-2.5 text-xs text-slate-800 hover:bg-slate-100 md:px-3 md:text-sm">
                {t("quickActions.getStarted")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          className="w-full cursor-pointer overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-all hover:border-primary/55 hover:shadow-md"
          onClick={() => navigate.push(appRoutes.toAppPath("/logistics"))}>

          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-primary">
                <Truck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base leading-tight md:text-lg">
                  {t("quickActions.trackShipment.title")}
                </CardTitle>
                <CardDescription className="line-clamp-1 text-xs text-slate-700 md:text-sm">
                  {t("quickActions.trackShipment.description")}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 border-slate-300 bg-white px-2.5 text-xs text-slate-800 hover:bg-slate-100 md:px-3 md:text-sm">
                {t("quickActions.getStarted")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          className="w-full cursor-pointer overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-all hover:border-primary/55 hover:shadow-md"
          onClick={() => navigate.push(appRoutes.toAppPath("/reports"))}>

          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-primary">
                <FileCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base leading-tight md:text-lg">
                  {t("quickActions.generateReport.title")}
                </CardTitle>
                <CardDescription className="line-clamp-1 text-xs text-slate-700 md:text-sm">
                  {t("quickActions.generateReport.description")}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 border-slate-300 bg-white px-2.5 text-xs text-slate-800 hover:bg-slate-100 md:px-3 md:text-sm">
                {t("quickActions.getStarted")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={showMarketReadinessDialog}
        onOpenChange={setShowMarketReadinessDialog}>
        <DialogContent className="border border-slate-200 bg-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("marketReadiness.title")}
            </DialogTitle>
            <DialogDescription className="text-slate-700">
              {t("marketReadiness.subtitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {marketReadiness.map(renderMarketReadinessItem)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showTargetDialog}
        onOpenChange={(open) => {
          if (!saveTargetLoading) {
            setShowTargetDialog(open);
          }
        }}>
        <DialogContent className="border border-slate-200 bg-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {locale === "vi" ? "Đặt mục tiêu phát thải theo tháng" : "Set monthly emissions target"}
            </DialogTitle>
            <DialogDescription className="text-slate-700">
              {locale === "vi" ?
              "Bạn có thể chọn gợi ý tự động hoặc nhập mục tiêu thủ công." :
              "Use an automatic suggestion or configure your target manually."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="target-year">{locale === "vi" ? "Năm" : "Year"}</Label>
              <Input
                id="target-year"
                type="number"
                min={2020}
                max={2100}
                value={targetYear}
                onChange={(event) => setTargetYear(Number.parseInt(event.target.value, 10) || getCurrentPeriod().year)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-month">{locale === "vi" ? "Tháng" : "Month"}</Label>
              <Input
                id="target-month"
                type="number"
                min={1}
                max={12}
                value={targetMonth}
                onChange={(event) => setTargetMonth(Number.parseInt(event.target.value, 10) || getCurrentPeriod().month)} />
            </div>
          </div>

          <Tabs
            value={targetMode}
            onValueChange={(value) => setTargetMode(value === "manual" ? "manual" : "auto")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="auto">{locale === "vi" ? "Tự động" : "Auto"}</TabsTrigger>
              <TabsTrigger value="manual">{locale === "vi" ? "Thủ công" : "Manual"}</TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="space-y-4 pt-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {locale === "vi" ?
                `Baseline gần nhất: ${autoBaseline.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kg CO2e` :
                `Recent baseline: ${autoBaseline.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg CO2e`}
              </div>
              <div className="space-y-2">
                <Label htmlFor="auto-reduction">
                  {locale === "vi" ? "Tỷ lệ giảm (%)" : "Reduction (%)"}
                </Label>
                <Input
                  id="auto-reduction"
                  type="number"
                  min={1}
                  max={50}
                  value={autoReduction}
                  onChange={(event) => {
                    const next = Number.parseFloat(event.target.value);
                    setAutoReduction(Number.isFinite(next) ? next : 8);
                  }} />
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {locale === "vi" ?
                `Mục tiêu gợi ý: ${autoSuggestedTarget.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kg CO2e` :
                `Suggested target: ${autoSuggestedTarget.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg CO2e`}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-2 pt-2">
              <Label htmlFor="manual-target">{locale === "vi" ? "Mục tiêu (kg CO2e)" : "Target (kg CO2e)"}</Label>
              <Input
                id="manual-target"
                type="number"
                step="0.01"
                min="0"
                placeholder={locale === "vi" ? "Ví dụ: 980" : "e.g. 980"}
                value={manualTarget}
                onChange={(event) => setManualTarget(event.target.value)} />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
              disabled={saveTargetLoading}
              onClick={() => setShowTargetDialog(false)}>
              {locale === "vi" ? "Hủy" : "Cancel"}
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saveTargetLoading}
              onClick={handleSaveTarget}>
              {saveTargetLoading ?
              locale === "vi" ? "Đang lưu..." : "Saving..." :
              locale === "vi" ? "Lưu mục tiêu" : "Save target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pendingProductData &&
      <ProductOverviewModal
        open={showProductModal}
        onClose={handleCloseModal}
        productData={pendingProductData} />

      }
    </div>);

};

export default OverviewPage;
