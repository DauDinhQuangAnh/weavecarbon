"use client";

import type { DemoDataset, DemoReportSnapshot } from "@/lib/demo/schema";
import type { ProductRecord } from "@/lib/productsApi";
import type { MarketCompliance } from "@/components/dashboard/export/types";
import type { ReportDatasetType, ReportExportSourceCounts } from "@/lib/reportsApi";
import {
  getDemoAuditTrail,
  getDemoCarbonCalculations,
} from "@/lib/demo/domain/operations";

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toProductRecord = (value: unknown): ProductRecord => value as ProductRecord;

const formatMonthLabel = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return "N/A";
};

export const getDemoProducts = (dataset: DemoDataset) =>
  dataset.products.map((product) => toProductRecord(product));

export const getDemoMarkets = (dataset: DemoDataset) =>
  dataset.exportCompliance as unknown as Record<string, MarketCompliance>;

export const getDemoUsersRows = (dataset: DemoDataset) => dataset.users;

export const getDemoHistoryRows = (dataset: DemoDataset) => dataset.history;

export const getDemoAnalyticsRows = (dataset: DemoDataset) => dataset.analytics.rows;

export const getDemoProductRows = (dataset: DemoDataset) =>
  getDemoProducts(dataset).map((product) => ({
    product_id: product.id,
    sku: product.productCode,
    product_name: product.productName,
    product_type: product.productType,
    status: product.status,
    quantity: product.quantity,
    weight_per_unit_g: product.weightPerUnit,
    destination_market: product.destinationMarket,
    shipment_id: product.shipmentId || "",
    total_co2e_per_unit: product.carbonResults?.perProduct?.total || 0,
    total_co2e_batch: product.carbonResults?.totalBatch?.total || 0,
    confidence_score: product.carbonResults?.confidenceScore || 0,
    updated_at: product.updatedAt,
  }));

export const getOverviewStats = (dataset: DemoDataset) => {
  const products = getDemoProducts(dataset);
  const totalCo2 = products.reduce(
    (sum, product) => sum + asNumber(product.carbonResults?.totalBatch?.total, 0),
    0
  );
  const confidenceScores = products
    .map((product) => asNumber(product.carbonResults?.confidenceScore, 0))
    .filter((score) => score > 0);
  const avgConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;
  const markets = Object.values(getDemoMarkets(dataset));
  const avgReadiness =
    markets.length > 0
      ? markets.reduce((sum, market) => sum + asNumber(market.score, 0), 0) / markets.length
      : 0;

  return {
    totalCO2: Math.round(totalCo2 * 100) / 100,
    skuCount: products.length,
    exportReadiness: Math.round(avgReadiness),
    confidenceScore: Math.round(avgConfidence),
  };
};

export const getOverviewTrend = (dataset: DemoDataset) =>
  getDemoAnalyticsRows(dataset).map((rawRow, index) => {
    const row = rawRow as Record<string, unknown>;
    const emissions = asNumber(row.actual_emissions ?? row.total_co2e, 0);
    const fallbackTarget = emissions > 0 ?
      Math.round(emissions * (index === 0 ? 1.02 : 0.985) * 100) / 100 :
      0;

    return {
      month: formatMonthLabel(row.month, row.period, row.label),
      emissions,
      target: asNumber(row.target_emissions ?? row.target_co2e, fallbackTarget),
    };
  });

export const getEmissionBreakdown = (dataset: DemoDataset) => {
  const totals = getDemoProducts(dataset).reduce(
    (acc, product) => {
      const per = product.carbonResults?.perProduct;
      acc.materials += asNumber(per?.materials, 0);
      acc.production += asNumber(per?.production, 0);
      acc.energy += asNumber(per?.energy, 0);
      acc.transport += asNumber(per?.transport, 0);
      return acc;
    },
    { materials: 0, production: 0, energy: 0, transport: 0 }
  );
  const sum = totals.materials + totals.production + totals.energy + totals.transport;
  if (sum <= 0) return [];

  return [
    { category: "Materials", percentage: Math.round((totals.materials / sum) * 100), color: "#0f766e" },
    { category: "Production", percentage: Math.round((totals.production / sum) * 100), color: "#2563eb" },
    { category: "Energy", percentage: Math.round((totals.energy / sum) * 100), color: "#f59e0b" },
    { category: "Transport", percentage: Math.max(0, 100 - Math.round((totals.materials / sum) * 100) - Math.round((totals.production / sum) * 100) - Math.round((totals.energy / sum) * 100)), color: "#7c3aed" },
  ];
};

export const getMarketReadiness = (dataset: DemoDataset) =>
  Object.values(getDemoMarkets(dataset)).map((market) => ({
    marketCode: market.market,
    marketName: market.marketName,
    score: market.score,
    status: market.score >= 80 ? "good" : market.score >= 50 ? "warning" : "danger",
  }));

export const getOverviewRecommendations = (dataset: DemoDataset) => {
  const recommendations = Object.values(getDemoMarkets(dataset)).flatMap((market) =>
    (market.recommendations || [])
      .filter((item) => item.status === "active")
      .slice(0, 2)
      .map((item) => ({
        id: item.id,
        title: item.missingItem,
        description: item.regulatoryReason,
        impactLevel:
          item.priority === "mandatory"
            ? "high"
            : item.priority === "important"
              ? "medium"
              : "low",
        reductionPercentage:
          item.priority === "mandatory" ? 12 : item.priority === "important" ? 7 : 3,
      }))
  );

  return recommendations.slice(0, 6);
};

export const getComplianceMarkets = (dataset: DemoDataset) =>
  getDemoMarkets(dataset);

export const getReportRowsByType = (dataset: DemoDataset, type: ReportDatasetType) => {
  if (type === "products") return getDemoProductRows(dataset);
  if (type === "activity") return getDemoCarbonCalculations(dataset) as Record<string, unknown>[];
  if (type === "audit") return getDemoAuditTrail(dataset) as Record<string, unknown>[];
  if (type === "users") return getDemoUsersRows(dataset) as Record<string, unknown>[];
  if (type === "history") return getDemoHistoryRows(dataset) as Record<string, unknown>[];
  if (type === "analytics") return getDemoAnalyticsRows(dataset) as Record<string, unknown>[];
  if (type === "company") {
    return [
      {
        company_name: dataset.company.name,
        business_type: dataset.company.business_type,
        domestic_market: dataset.company.domestic_market,
        target_markets: dataset.company.target_markets.join(", "),
        current_plan: dataset.company.current_plan,
        standard_sku_limit: dataset.company.standard_sku_limit,
        products: getDemoProducts(dataset).length,
        shipments: dataset.shipments.length,
        reports: dataset.reports.length,
      },
    ];
  }
  return [];
};

export const createReportSnapshot = (
  dataset: DemoDataset,
  type: ReportDatasetType
): DemoReportSnapshot | DemoReportSnapshot[] => {
  if (type === "company") {
    const companyDatasets: ReportDatasetType[] = ["products", "users", "analytics", "history"];
    return companyDatasets.map((datasetType) => {
      const rows = getReportRowsByType(dataset, datasetType);
      const columns = Array.from(
        rows.reduce((set, row) => {
          Object.keys(row).forEach((key) => set.add(key));
          return set;
        }, new Set<string>())
      );
      return {
        datasetType,
        columns,
        rows,
      };
    });
  }

  const rows = getReportRowsByType(dataset, type);
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  return {
    datasetType: type,
    columns,
    rows,
  };
};

export const getReportSourceCounts = (dataset: DemoDataset): ReportExportSourceCounts => ({
  products: getDemoProducts(dataset).length,
  activity: getDemoCarbonCalculations(dataset).length,
  audit: getDemoAuditTrail(dataset).length,
  users: dataset.users.length,
  history: dataset.history.length,
});
