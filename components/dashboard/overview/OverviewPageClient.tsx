
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/contexts/ProductContext";
import { api, isUnauthorizedApiError } from "@/lib/apiClient";
import { generateCompanyRecommendations } from "@/lib/chatApi";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  Truck,
  FileCheck,
  ChevronRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Gauge,
  Lightbulb,
  PlusCircle,
  ShieldAlert,
  X } from
"lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import ProductOverviewModal from "../assessment/ProductOverviewModal";
import type { EmissionBreakdownPoint } from "../OverviewCharts";
import { useRouter } from "next/navigation";
import { useAppRoutes } from "@/lib/demo/routes";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import {
  MARKET_READINESS_PREVIEW_LIMIT,
  OVERVIEW_STAT_ACCENT_VALUE_CLASS,
  OVERVIEW_STAT_HEADER_CLASS,
  OVERVIEW_STAT_HEADER_INNER_CLASS,
  OVERVIEW_STAT_LABEL_CLASS,
  OVERVIEW_STAT_VALUE_CLASS,
  PRICING_MODAL_OPEN_EVENT,
  getImpactColor,
  mapComplianceMarketReadiness,
  mapOverviewMarketReadiness,
  pickEmissionColor,
  renderMarketReadinessItem,
  type DashboardOverviewResponse,
  type MarketReadinessItem,
  type OverviewStats,
  type RecommendationItem
} from "./overviewPageHelpers";

const OverviewCharts = dynamic(() => import("../OverviewCharts"), { ssr: false });

const OverviewPage: React.FC = () => {
  const t = useTranslations("overview");
  const locale = "vi";
  const displayLocale = "vi-VN";
  const { canMutate } = usePermissions();
  const { currentPlan } = useSubscriptionLock();
  const { user, loading: authLoading, authStatus } = useAuth();
  const {
    products,
    status: productHydrationStatus,
    pendingProductData,
    clearPendingProduct
  } = useProducts();
  const navigate = useRouter();
  const appRoutes = useAppRoutes();
  const [apiStats, setApiStats] = useState<OverviewStats | null>(null);
  const [showMarketReadinessDialog, setShowMarketReadinessDialog] = useState(false);
  const [modalMarketReadiness, setModalMarketReadiness] = useState<MarketReadinessItem[]>([]);
  const [modalMarketsLoading, setModalMarketsLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [marketReadiness, setMarketReadiness] = useState<MarketReadinessItem[]>(
    []
  );

  const handleOpenMarketReadinessDialog = async () => {
    setShowMarketReadinessDialog(true);
    if (modalMarketReadiness.length > 0 || modalMarketsLoading) return;

    setModalMarketsLoading(true);
    try {
      const complianceMarkets = await fetchComplianceMarkets();
      if (complianceMarkets && Object.keys(complianceMarkets).length > 0) {
        setModalMarketReadiness(mapComplianceMarketReadiness(complianceMarkets));
      }
    } catch (error) {
      if (!isUnauthorizedApiError(error)) {
        console.warn("Failed to load compliance markets for modal.");
      }
    } finally {
      setModalMarketsLoading(false);
    }
  };
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    []
  );
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsLoaded, setRecommendationsLoaded] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [emissionBreakdown, setEmissionBreakdown] = useState<
    EmissionBreakdownPoint[]>(
    []);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { setPageTitle } = useDashboardTitle();
  const isTrialPlan = String(currentPlan || "").trim().toLowerCase().includes("trial");
  const isAuthHydrating =
    authLoading || authStatus === "checking" || authStatus === "recovering";
  const recommendationsRequestSeqRef = useRef(0);

  const handleOpenPricingModal = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(PRICING_MODAL_OPEN_EVENT));
  };

  const disclaimerTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const alreadyShown = sessionStorage.getItem("weavecarbon_audit_disclaimer_shown");
      if (!alreadyShown) {
        setShowDisclaimer(true);
        sessionStorage.setItem("weavecarbon_audit_disclaimer_shown", "1");
        disclaimerTimerRef.current = setTimeout(() => {
          setShowDisclaimer(false);
        }, 5000);
      }
    } catch {
      // ignore storage access errors
    }

    return () => {
      if (disclaimerTimerRef.current) {
        clearTimeout(disclaimerTimerRef.current);
      }
    };
  }, []);

  const handleDismissDisclaimer = () => {
    if (disclaimerTimerRef.current) {
      clearTimeout(disclaimerTimerRef.current);
    }
    try {
      sessionStorage.setItem("weavecarbon_audit_disclaimer_shown", "1");
    } catch {
      // ignore storage access errors
    }
    setShowDisclaimer(false);
  };

  useEffect(() => {
    setPageTitle(t("pageTitle"), t("pageSubtitle"));
  }, [setPageTitle, t]);

  useEffect(() => {
    if (pendingProductData) {
      setShowProductModal(true);
    }
  }, [pendingProductData]);

  useEffect(() => {
    recommendationsRequestSeqRef.current += 1;
    setRecommendations([]);
    setRecommendationsLoading(false);
    setRecommendationsLoaded(false);
    setRecommendationsError(null);
  }, [user?.company_id]);

  const handleCloseModal = () => {
    setShowProductModal(false);
    clearPendingProduct();
  };


  const handleGenerateRecommendations = async () => {
    const companyId = user?.company_id?.trim() || "";
    if (!companyId || recommendationsLoading || isTrialPlan) return;

    const requestId = recommendationsRequestSeqRef.current + 1;
    recommendationsRequestSeqRef.current = requestId;

    setRecommendationsLoading(true);
    setRecommendationsError(null);

    try {
      const response = await generateCompanyRecommendations(
        companyId,
        {
          company_id: companyId,
          language: "vi",
        }
      );

      if (recommendationsRequestSeqRef.current !== requestId) return;

      setRecommendations(
        response.recommendations.map((item) => ({
          id: item.id,
          title: item.title || "Recommendation",
          description: item.description || "",
          impact: item.impact || "medium",
          reduction: item.reduction || "0%",
        }))
      );
      setRecommendationsLoaded(true);
    } catch (error) {
      if (recommendationsRequestSeqRef.current !== requestId) return;

      setRecommendations([]);
      setRecommendationsLoaded(true);
      setRecommendationsError(
        error instanceof Error && error.message.trim().length > 0 ?
          error.message :
          t("recommendations.errorGeneric")
      );
    } finally {
      if (recommendationsRequestSeqRef.current === requestId) {
        setRecommendationsLoading(false);
      }
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
  const isStatsHydrating =
    isAuthHydrating || (!apiStats && productHydrationStatus === "hydrating");
  const marketReadinessPreview = useMemo(
    () => marketReadiness.slice(0, MARKET_READINESS_PREVIEW_LIMIT),
    [marketReadiness]
  );
  const hiddenMarketReadinessCount = Math.max(
    0,
    marketReadiness.length - marketReadinessPreview.length
  );

  const productEmissions = useMemo(
    () =>
      products
        .filter((p) => p.co2 > 0)
        .sort((a, b) => b.co2 - a.co2)
        .map((p) => ({
          name: p.name,
          sku: p.sku,
          materials:  p.breakdown.materials,
          production: p.breakdown.production,
          transport:  p.breakdown.transport,
          packaging:  p.breakdown.packaging,
          total:      p.co2,
        })),
    [products]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchOverviewData = async () => {
      if (isAuthHydrating) {
        if (!cancelled) {
          setInsightsLoading(true);
        }
        return;
      }

      if (authStatus !== "authenticated" || !user) {
        if (!cancelled) {
          setApiStats(null);
          setMarketReadiness([]);
          setRecommendations([]);
          setEmissionBreakdown([]);
          setInsightsLoading(false);
        }
        return;
      }

      if (!cancelled) setInsightsLoading(true);

      try {
        const overview = await api.get<DashboardOverviewResponse>("/dashboard/overview?trend_months=6");

        if (cancelled) return;

        setApiStats({
          totalCO2: Math.round((overview.stats?.totalCo2e || 0) * 100) / 100,
          skuCount: overview.stats?.totalSkus || 0,
          exportReadiness: Math.round(overview.stats?.avgExportReadiness || 0),
          confidenceScore: Math.round(overview.stats?.dataConfidence || 0)
        });

        const overviewReadiness = mapOverviewMarketReadiness(overview.marketReadiness);
        setMarketReadiness(overviewReadiness);

        const usedBreakdownColors = new Set<string>();
        setEmissionBreakdown(
          (overview.emissionBreakdown || []).map((item, index) => {
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
        setEmissionBreakdown([]);
      }

      setInsightsLoading(false);
    };

    fetchOverviewData();

    return () => {
      cancelled = true;
    };
  }, [authStatus, isAuthHydrating, user]);

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
                {isStatsHydrating ? (
                  <span className="block h-8 w-24 animate-pulse rounded bg-slate-200" />
                ) : (
                  stats.totalCO2.toLocaleString(displayLocale)
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-[3.5rem] items-center p-3 pt-2 md:min-h-[4rem] md:pt-4">
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
                {isStatsHydrating ? (
                  <span className="block h-8 w-12 animate-pulse rounded bg-slate-200" />
                ) : (
                  stats.skuCount
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-[3.5rem] items-center p-3 pt-2 md:min-h-[4rem] md:pt-4">
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
                <CardTitle className="hidden shrink-0 text-right text-xl font-bold leading-tight text-amber-800 md:block md:text-2xl">
                  {t("stats.trialLocked")}
                </CardTitle>
              ) : (
                <CardTitle
                  className={`${OVERVIEW_STAT_ACCENT_VALUE_CLASS} text-primary`}>
                  {isStatsHydrating ? (
                    <span className="block h-8 w-14 animate-pulse rounded bg-slate-200" />
                  ) : (
                    `${stats.exportReadiness}%`
                  )}
                </CardTitle>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-2 md:pt-4">
            {isTrialPlan ? (
              <div className="flex items-start gap-3">
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={handleOpenPricingModal}
                >
                  {t("stats.upgradeCta")}
                </Button>
                <p className="hidden flex-1 text-xs text-amber-800 md:block md:text-sm">
                  {t("stats.trialLockedDescription")}
                </p>
              </div>
            ) : (
              <Progress
                value={isStatsHydrating ? 0 : stats.exportReadiness}
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
                {isStatsHydrating ? (
                  <span className="block h-8 w-14 animate-pulse rounded bg-slate-200" />
                ) : (
                  `${stats.confidenceScore}%`
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-[3.5rem] items-center p-3 pt-2 md:min-h-[4rem] md:pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 md:text-[15px]">
              <Gauge className="w-4 h-4" />
              {isStatsHydrating ? (
                <span className="block h-4 w-32 animate-pulse rounded bg-slate-200" />
              ) : (
                <span>{t("stats.basedOnSKUs", { count: stats.skuCount })}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <OverviewCharts
        productEmissions={productEmissions}
        emissionBreakdown={emissionBreakdown}
        isLoading={insightsLoading} />


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
                  onClick={handleOpenMarketReadinessDialog}
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
            ) : !(user?.company_id?.trim()) ? (
              <p className="text-sm text-slate-700">
                {t("recommendations.noCompany")}
              </p>
            ) : !recommendationsLoaded && !recommendationsLoading ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-700">
                    {t("recommendations.idleDescription")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void handleGenerateRecommendations()}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("recommendations.generateCta")}
                  </Button>
                </div>
              </div>
            ) : recommendationsLoading ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("recommendations.loadingTitle")}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {t("recommendations.loadingDescription")}
                  </p>
                </div>
                <div className="h-20 rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" />
                <div className="h-20 rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" />
              </div>
            ) : recommendationsError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-rose-900">
                        {t("recommendations.errorTitle")}
                      </p>
                      <p className="mt-1 text-sm text-rose-800">
                        {recommendationsError}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-rose-300 text-rose-800 hover:bg-rose-100"
                      onClick={() => void handleGenerateRecommendations()}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t("recommendations.retryCta")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-700">
                    {t("recommendations.empty")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleGenerateRecommendations()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("recommendations.regenerateCta")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleGenerateRecommendations()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("recommendations.regenerateCta")}
                  </Button>
                </div>
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-lg border border-slate-300 bg-slate-50 p-3 transition-colors hover:bg-slate-100">

                    <div className="flex items-start justify-between mb-2 gap-3">
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
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          onClick={() => {
            navigate.push(appRoutes.toAppPath("/logistics"));
          }}>

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
          onClick={() => {
            navigate.push(appRoutes.toAppPath("/reports"));
          }}>

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

      {/* ── Pre-audit Disclaimer (floating popup at top-right, auto-hides after 5s, shown once per session) ── */}
      {showDisclaimer && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm rounded-xl border border-amber-300/90 bg-amber-50/95 p-3.5 shadow-xl shadow-amber-950/10 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 sm:max-w-md sm:p-4"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1 space-y-1 pr-1">
              <p className="text-xs font-semibold text-amber-900 sm:text-sm">
                {"Lưu ý trước kiểm toán độc lập"}
              </p>
              <p className="text-xs leading-relaxed text-amber-800">
                {locale === "vi"
                  ? "Các kết quả phát thải CO₂e hiển thị trên dashboard được tính theo phương pháp ISO 14067:2018 và GHG Protocol. Số liệu sử dụng hệ số phát thải từ Ecoinvent v3.10, DEFRA 2024 và Niên giám Bộ TN&MT Việt Nam. Một số dữ liệu đầu vào vẫn là dữ liệu proxy — cần bổ sung hóa đơn, vận đơn và dữ liệu nhà cung ứng gốc để đạt mức xác minh L4–L5 cho kiểm toán SGS / Bureau Veritas."
                  : "CO₂e emission results shown on this dashboard are calculated per ISO 14067:2018 and the GHG Protocol. Emission factors are sourced from Ecoinvent v3.10, DEFRA 2024, and Vietnam MONRE. Some inputs remain proxy data — original invoices, shipping documents, and supplier data are required for L4–L5 verification suitable for SGS / Bureau Veritas audit."}
              </p>
            </div>
            <button
              type="button"
              aria-label={"Đóng thông báo"}
              onClick={handleDismissDisclaimer}
              className="shrink-0 rounded-md p-1 text-amber-700 hover:bg-amber-200/60 hover:text-amber-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-amber-200/60">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{
                animation: "countdown 5s linear forwards",
              }}
            />
          </div>
        </div>
      )}

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
            {modalMarketsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {"Đang tải thông tin thị trường..."}
              </div>
            ) : (
              (modalMarketReadiness.length > 0 ? modalMarketReadiness : marketReadiness).map(renderMarketReadinessItem)
            )}
          </div>
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
