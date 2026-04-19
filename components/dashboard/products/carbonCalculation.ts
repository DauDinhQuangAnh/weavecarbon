import type { BulkProductRow } from "./types";
import { calculateBulkRowCarbon } from "@/lib/carbon/adapters";
import type { CarbonComputationResult } from "@/lib/carbon/types";

export interface CarbonCalculationResult {
  materialsCO2: number;
  manufacturingCO2: number;
  energyCO2: number;
  transportCO2: number;
  packagingCO2: number;
  totalCO2: number;
  scope?: "scope1" | "scope1_2" | "scope1_2_3";
  confidenceLevel: "high" | "medium" | "low";
  confidenceScore: number;
  co2eRange: CarbonComputationResult["co2eRange"];
  methodologyVersion: string;
  assumptionsUsed: string[];
  factorSourceSummary: CarbonComputationResult["factorSourceSummary"];
  dataQualityBreakdown: CarbonComputationResult["dataQualityBreakdown"];
  proxyUsed: boolean;
  proxyNotes: string[];
  scope1: number | null;
  scope2: number | null;
  scope3: number | null;
}

const resolveLegacyScope = (result: CarbonComputationResult) => {
  const hasProduction = result.perProduct.production > 0;
  const hasScope3 =
    result.perProduct.materials > 0 ||
    result.perProduct.transport > 0 ||
    result.perProduct.packaging > 0;

  if (hasProduction && hasScope3) return "scope1_2_3" as const;
  if (hasProduction) return "scope1_2" as const;
  return "scope1" as const;
};

export function calculateCarbonForProduct(row: BulkProductRow): CarbonCalculationResult {
  const result = calculateBulkRowCarbon(row);

  return {
    materialsCO2: result.perProduct.materials,
    manufacturingCO2: result.perProduct.production,
    energyCO2: result.perProduct.energy,
    transportCO2: result.perProduct.transport,
    packagingCO2: result.perProduct.packaging,
    totalCO2: result.perProduct.total,
    scope: resolveLegacyScope(result),
    confidenceLevel: result.confidenceLevel,
    confidenceScore: result.confidenceScore,
    co2eRange: result.co2eRange,
    methodologyVersion: result.methodologyVersion,
    assumptionsUsed: result.assumptionsUsed,
    factorSourceSummary: result.factorSourceSummary,
    dataQualityBreakdown: result.dataQualityBreakdown,
    proxyUsed: result.proxyUsed,
    proxyNotes: result.proxyNotes,
    scope1: result.scope1,
    scope2: result.scope2,
    scope3: result.scope3
  };
}

export function calculateBulkCarbon(rows: BulkProductRow[]): BulkProductRow[] {
  return rows.map((row) => {
    const result = calculateCarbonForProduct(row);
    return {
      ...row,
      calculatedCO2: result.totalCO2,
      scope: result.scope,
      confidenceLevel: result.confidenceLevel
    };
  });
}

export function getAggregateStats(rows: BulkProductRow[]) {
  const calculatedRows = calculateBulkCarbon(rows);

  const totalProducts = calculatedRows.length;
  const totalQuantity = calculatedRows.reduce(
    (sum, row) => sum + row.quantity,
    0
  );
  const totalCO2 = calculatedRows.reduce(
    (sum, row) => sum + (row.calculatedCO2 || 0) * row.quantity,
    0
  );
  const avgCO2PerProduct = totalQuantity > 0 ? totalCO2 / totalQuantity : 0;

  const byConfidence = {
    high: calculatedRows.filter((r) => r.confidenceLevel === "high").length,
    medium: calculatedRows.filter((r) => r.confidenceLevel === "medium").length,
    low: calculatedRows.filter((r) => r.confidenceLevel === "low").length
  };

  const byScope = {
    scope1: calculatedRows.filter((r) => r.scope === "scope1").length,
    scope1_2: calculatedRows.filter((r) => r.scope === "scope1_2").length,
    scope1_2_3: calculatedRows.filter((r) => r.scope === "scope1_2_3").length
  };

  return {
    totalProducts,
    totalQuantity,
    totalCO2: Math.round(totalCO2 * 100) / 100,
    avgCO2PerProduct: Math.round(avgCO2PerProduct * 1000) / 1000,
    byConfidence,
    byScope,
    calculatedRows
  };
}
