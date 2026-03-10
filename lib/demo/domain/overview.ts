"use client";

import type { DemoDataset } from "@/lib/demo/schema";
import {
  getEmissionBreakdown,
  getMarketReadiness,
  getOverviewRecommendations,
  getOverviewStats,
  getOverviewTrend,
} from "@/lib/demo/selectors";

type DemoDashboardTargetPayload = {
  mode?: unknown;
  year?: unknown;
  month?: unknown;
  target_co2e?: unknown;
  reduction_percentage?: unknown;
};

type SaveDemoDashboardTargetResult = {
  target_co2e: number;
  actual_co2e: number;
  reduction_percentage: number | null;
  baseline_co2e: number;
  year: number;
  month: number;
  mode: "manual" | "auto";
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `demo-target-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asObject = (value: unknown) => (isObject(value) ? value : {});

const toNumber = (value: unknown, fallback = Number.NaN) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const toInteger = (value: unknown, fallback: number) => {
  const parsed = Math.trunc(toNumber(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round = (value: number, digits = 4) => {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
};

const toPeriodLabel = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

const toRowPeriod = (row: Record<string, unknown>) =>
  String(row.period || row.month || row.label || "").trim();

const getAnalyticsRows = (dataset: DemoDataset) => {
  const analytics = asObject(dataset.analytics);
  const rows = Array.isArray(analytics.rows) ? analytics.rows : [];
  return rows.map((entry) => asObject(entry));
};

const getLatestActualCo2e = (rows: Array<Record<string, unknown>>, fallback = 0) => {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const value = toNumber(row.actual_emissions ?? row.total_co2e, Number.NaN);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return fallback;
};

const getBaselineCo2e = (rows: Array<Record<string, unknown>>, fallback = 0) => {
  const values = rows
    .map((row) => toNumber(row.actual_emissions ?? row.total_co2e, Number.NaN))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) {
    return fallback;
  }

  const sample = values.slice(-3);
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
};

export const saveDemoDashboardTarget = (
  dataset: DemoDataset,
  payload: DemoDashboardTargetPayload
): SaveDemoDashboardTargetResult => {
  const now = new Date();
  const year = toInteger(payload.year, now.getFullYear());
  const month = toInteger(payload.month, now.getMonth() + 1);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) {
    throw new Error("Invalid target month.");
  }

  const mode: "manual" | "auto" = payload.mode === "manual" ? "manual" : "auto";
  const analyticsRows = getAnalyticsRows(dataset);
  const stats = getOverviewStats(dataset);
  const baselineCo2e = Math.max(0, getBaselineCo2e(analyticsRows, stats.totalCO2));
  const actualCo2e = Math.max(0, getLatestActualCo2e(analyticsRows, baselineCo2e));

  let targetCo2e = 0;
  let reductionPercentage: number | null = null;

  if (mode === "manual") {
    const manualTarget = toNumber(payload.target_co2e, Number.NaN);
    if (!Number.isFinite(manualTarget) || manualTarget <= 0) {
      throw new Error("Please enter a valid target > 0.");
    }
    targetCo2e = manualTarget;
    if (baselineCo2e > 0) {
      reductionPercentage = round(((baselineCo2e - manualTarget) / baselineCo2e) * 100, 2);
    }
  } else {
    const requestedReduction = toNumber(payload.reduction_percentage, 8);
    const normalizedReduction = Math.max(1, Math.min(50, requestedReduction));
    targetCo2e = baselineCo2e * (1 - normalizedReduction / 100);
    reductionPercentage = round(normalizedReduction, 2);
  }

  const normalizedTargetCo2e = round(Math.max(0, targetCo2e), 4);
  const period = toPeriodLabel(year, month);
  const publishedProducts = dataset.products.filter((product) =>
    asObject(product).status === "published"
  ).length;
  const totalProducts = dataset.products.length;
  const totalQuantity = dataset.products.reduce(
    (sum, product) => sum + Math.max(0, toNumber(asObject(product).quantity, 0)),
    0
  );
  const avgCo2ePerUnit =
    totalQuantity > 0 ? round(actualCo2e / totalQuantity, 4) : 0;
  const exportReadyMarkets = Object.values(dataset.exportCompliance).filter((entry) =>
    toNumber(asObject(entry).score, 0) >= 70
  ).length;

  const existingRowIndex = analyticsRows.findIndex((row) => toRowPeriod(row) === period);
  const nextRow = {
    ...(existingRowIndex >= 0 ? analyticsRows[existingRowIndex] : {}),
    id:
      String(
        (existingRowIndex >= 0 ? analyticsRows[existingRowIndex].id : "") ||
          createId()
      ).trim() || createId(),
    month: period,
    period,
    label: period,
    actual_emissions: round(actualCo2e, 4),
    target_emissions: normalizedTargetCo2e,
    total_co2e: round(actualCo2e, 4),
    target_co2e: normalizedTargetCo2e,
    total_products: totalProducts,
    published_products: publishedProducts,
    avg_co2e_per_unit: avgCo2ePerUnit,
    export_ready_markets: exportReadyMarkets,
  };

  const nextRows = [...analyticsRows];
  if (existingRowIndex >= 0) {
    nextRows[existingRowIndex] = nextRow;
  } else {
    nextRows.push(nextRow);
  }

  const analytics = asObject(dataset.analytics);
  dataset.analytics = {
    ...analytics,
    rows: nextRows,
  } as DemoDataset["analytics"];

  dataset.uiState = {
    ...asObject(dataset.uiState),
    dashboardTarget: {
      mode,
      year,
      month,
      target_co2e: normalizedTargetCo2e,
      actual_co2e: round(actualCo2e, 4),
      reduction_percentage: reductionPercentage,
      baseline_co2e: round(baselineCo2e, 4),
      period,
      saved_at: new Date().toISOString(),
    },
  };

  return {
    target_co2e: normalizedTargetCo2e,
    actual_co2e: round(actualCo2e, 4),
    reduction_percentage: reductionPercentage,
    baseline_co2e: round(baselineCo2e, 4),
    year,
    month,
    mode,
  };
};

export const getDemoOverviewPayload = (dataset: DemoDataset) => {
  const stats = getOverviewStats(dataset);
  return {
    stats: {
      total_co2e: stats.totalCO2,
      total_skus: stats.skuCount,
      avg_export_readiness: stats.exportReadiness,
      data_confidence: stats.confidenceScore,
    },
    carbon_trend: getOverviewTrend(dataset).map((item) => ({
      month: item.month,
      label: item.month,
      actual_emissions: item.emissions,
      target_emissions: item.target,
    })),
    emission_breakdown: getEmissionBreakdown(dataset).map((item) => ({
      category: item.category,
      label: item.category,
      percentage: item.percentage,
      color: item.color,
    })),
    market_readiness: getMarketReadiness(dataset),
    recommendations: getOverviewRecommendations(dataset),
  };
};
