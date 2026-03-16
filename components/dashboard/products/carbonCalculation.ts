import { BulkProductRow } from "./types";


const MATERIAL_FACTORS: Record<string, number> = {
  cotton: 8.0,
  polyester: 5.5,
  nylon: 6.8,
  wool: 10.1,
  silk: 7.5,
  linen: 5.2,
  recycled_polyester: 2.5,
  organic_cotton: 4.5,
  bamboo: 3.8,
  hemp: 2.9,
  blend: 5.5
};

const ENERGY_FACTORS: Record<string, number> = {
  grid: 1.0,
  solar: 0.4,
  coal: 1.5,
  mixed: 0.7
};

const PROCESS_FACTORS: Record<string, number> = {
  knitting: 0.8,
  weaving: 1.0,
  cutting: 0.3,
  cutting_sewing: 0.3,
  dyeing: 1.5,
  printing: 0.6,
  finishing: 0.4
};

const TRANSPORT_FACTORS: Record<string, number> = {
  road: 0.089,
  sea: 0.016,
  air: 0.602,
  rail: 0.028,
  multimodal: 0.05
};

const MARKET_DISTANCES: Record<string, number> = {
  domestic: 500,
  eu: 10000,
  us: 14000,
  jp: 3500,
  kr: 3200,
  other: 8000
};

const MATERIAL_SOURCE_FACTORS: Record<string, number> = {
  domestic: 0.8,
  imported: 1.2,
  unknown: 1.0
};

export interface CarbonCalculationResult {
  materialsCO2: number;
  manufacturingCO2: number;
  transportCO2: number;
  totalCO2: number;
  scope: "scope1" | "scope1_2" | "scope1_2_3";
  confidenceLevel: "high" | "medium" | "low";
  confidenceScore: number;
}

export function calculateCarbonForProduct(
row: BulkProductRow)
: CarbonCalculationResult {
  const weightKg = row.weightPerUnit / 1000;


  const primaryMaterialFactor = MATERIAL_FACTORS[row.primaryMaterial] || 5.5;
  const primaryMaterialCO2 =
  weightKg * (row.primaryMaterialPercentage / 100) * primaryMaterialFactor;

  let secondaryMaterialCO2 = 0;
  if (row.secondaryMaterial && row.secondaryMaterialPercentage) {
    const secondaryMaterialFactor =
    MATERIAL_FACTORS[row.secondaryMaterial] || 5.5;
    secondaryMaterialCO2 =
    weightKg * (
    row.secondaryMaterialPercentage / 100) *
    secondaryMaterialFactor;
  }


  const sourceMultiplier = MATERIAL_SOURCE_FACTORS[row.materialSource];
  const materialsCO2 =
  (primaryMaterialCO2 + secondaryMaterialCO2) * sourceMultiplier;


  const energyFactor = ENERGY_FACTORS[row.energySource] || 1.0;
  const processTotal = row.processes.reduce((sum, process) => {
    return sum + (PROCESS_FACTORS[process] || 0.5);
  }, 0);
  const manufacturingCO2 = weightKg * processTotal * energyFactor;


  const hasTransportMode = Boolean(row.transportMode);
  const transportFactor =
  row.transportMode ?
  TRANSPORT_FACTORS[row.transportMode] || 0.05 :
  0;
  const distance =
  hasTransportMode ?
  typeof row.transportDistanceKm === "number" &&
  Number.isFinite(row.transportDistanceKm) &&
  row.transportDistanceKm > 0 ?
  row.transportDistanceKm :
  MARKET_DISTANCES[
  row.marketType === "domestic" ? "domestic" : row.exportCountry || "other"] :
  0;

  const transportCO2 = hasTransportMode ? weightKg * (distance / 1000) * transportFactor : 0;


  const totalCO2 = materialsCO2 + manufacturingCO2 + transportCO2;


  let scope: "scope1" | "scope1_2" | "scope1_2_3" = "scope1";
  let confidenceScore = 50;


  const hasFullMaterialData =
  row.primaryMaterial && row.primaryMaterialPercentage === 100 ||
  row.secondaryMaterial &&
  (row.primaryMaterialPercentage || 0) + (
  row.secondaryMaterialPercentage || 0) ===
  100;
  const hasFullManufacturingData = row.processes.length > 0 && row.energySource;
  const hasFullTransportData =
  row.transportMode &&
  (row.marketType === "domestic" ||
  Boolean(row.exportCountry) ||
  (Boolean(row.transportOrigin) && Boolean(row.transportDestination)));

  if (hasFullManufacturingData) {
    scope = "scope1_2";
    confidenceScore += 20;
  }

  if (hasFullMaterialData && hasFullTransportData) {
    scope = "scope1_2_3";
    confidenceScore += 30;
  }


  if (row.materialSource !== "unknown") confidenceScore += 5;
  if (row.processes.length >= 2) confidenceScore += 5;
  if (row.marketType === "export" && row.exportCountry) confidenceScore += 5;


  confidenceScore = Math.min(confidenceScore, 100);


  let confidenceLevel: "high" | "medium" | "low" = "low";
  if (confidenceScore >= 85) {
    confidenceLevel = "high";
  } else if (confidenceScore >= 65) {
    confidenceLevel = "medium";
  }

  return {
    materialsCO2: Math.round(materialsCO2 * 1000) / 1000,
    manufacturingCO2: Math.round(manufacturingCO2 * 1000) / 1000,
    transportCO2: Math.round(transportCO2 * 1000) / 1000,
    totalCO2: Math.round(totalCO2 * 1000) / 1000,
    scope,
    confidenceLevel,
    confidenceScore
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
  const avgCO2PerProduct = totalCO2 / totalQuantity;

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
