import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { fetchComplianceMarkets } from "@/lib/exportComplianceApi";

export interface Company {
  target_markets: string[] | null;
  name?: string;
}

export interface MarketReadinessItem {
  market: string;
  score: number;
  status?: "good" | "warning" | "danger";
}

export interface RecommendationItem {
  id: string | number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  reduction: string;
}

export interface OverviewStats {
  totalCO2: number;
  skuCount: number;
  exportReadiness: number;
  confidenceScore: number;
}

export interface DashboardOverviewResponse {
  stats?: {
    totalCo2e?: number;
    totalSkus?: number;
    avgExportReadiness?: number;
    dataConfidence?: number;
  };
  carbonTrend?: Array<{
    month?: string;
    label?: string;
    actualEmissions?: number;
    targetEmissions?: number;
  }>;
  emissionBreakdown?: Array<{
    category?: string;
    label?: string;
    percentage?: number;
    color?: string;
  }>;
  marketReadiness?: Array<{
    marketCode?: string;
    marketName?: string;
    score?: number;
    status?: "good" | "warning" | "danger";
  }>;
  recommendations?: Array<{
    id: string | number;
    title?: string;
    description?: string;
    impactLevel?: "high" | "medium" | "low";
    reductionPercentage?: number;
  }>;
}

export const MARKET_READINESS_PREVIEW_LIMIT = 3;

export const EMISSION_COLOR_PALETTE = [
"hsl(171 78% 33%)",
"hsl(220 85% 54%)",
"hsl(281 78% 56%)",
"hsl(8 82% 56%)"];

export const PRICING_MODAL_OPEN_EVENT = "weavecarbon:open-pricing-modal";
export const OVERVIEW_STAT_HEADER_CLASS =
  "rounded-t-[inherit] border-b border-slate-300 bg-slate-100 p-3 pb-2 md:p-6 md:pb-3";
export const OVERVIEW_STAT_HEADER_INNER_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2";
export const OVERVIEW_STAT_LABEL_CLASS =
  "line-clamp-2 text-sm font-semibold leading-snug text-slate-700 md:text-[15px]";
export const OVERVIEW_STAT_VALUE_CLASS =
  "shrink-0 text-right text-2xl font-bold leading-none text-slate-900 md:text-3xl";
export const OVERVIEW_STAT_ACCENT_VALUE_CLASS =
  "shrink-0 text-right text-2xl font-bold leading-none md:text-3xl";

export const normalizeEmissionKey = (value: string) =>
value.
toLowerCase().
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
replace(/[^a-z0-9]+/g, " ").
trim();

export const getCategoryColor = (label: string) => {
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

export const pickEmissionColor = (
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

export const getReadinessColor = (score: number) => {
  if (score >= 80) return "border border-emerald-300 bg-emerald-100 text-emerald-800";
  if (score >= 50) return "border border-amber-300 bg-amber-100 text-amber-800";
  return "border border-rose-300 bg-rose-100 text-rose-800";
};

export const clampReadiness = (score: number) => Math.max(0, Math.min(100, score));

export const normalizeReadinessScore = (score: number) => clampReadiness(Math.round(score * 100) / 100);

export const mapOverviewMarketReadiness = (
items: DashboardOverviewResponse["marketReadiness"] = []) =>
(items || []).map((item) => ({
  market: item.marketName || item.marketCode || "Unknown",
  score: normalizeReadinessScore(item.score || 0),
  status: item.status
}));

export const mapComplianceMarketReadiness = (
markets: Awaited<ReturnType<typeof fetchComplianceMarkets>>) =>
Object.values(markets).map((market) => ({
  market: market.marketName || market.market,
  score: normalizeReadinessScore(market.score)
}));

export const renderMarketReadinessItem = (market: MarketReadinessItem) =>
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

export const getImpactColor = (impact: string) => {
  switch (impact) {
    case "high":
      return "border border-emerald-300 bg-emerald-100 text-emerald-800";
    case "medium":
      return "border border-amber-300 bg-amber-100 text-amber-800";
    default:
      return "border border-sky-300 bg-sky-100 text-sky-800";
  }
};
