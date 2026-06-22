import { BulkProductRow } from './types';
import {
  getCarbonFactor,
  resolveMarketDistanceDefault,
} from '@/lib/carbon/factorRegistry';

// Map bulk-upload material keys to factorRegistry aliases
const MATERIAL_ALIAS_MAP: Record<string, string> = {
  cotton: 'cotton',
  organic_cotton: 'organiccotton',
  polyester: 'polyester',
  recycled_polyester: 'recycledpolyester',
  nylon: 'nylon',
  wool: 'wool',
  silk: 'silk',
  linen: 'linen',
  bamboo: 'bamboo',
  hemp: 'hemp',
  blend: 'blend',
};

// Proxy fallback factors (kg CO₂e/kg) if registry lookup fails
const MATERIAL_FALLBACK: Record<string, number> = {
  cotton: 5.9,
  organic_cotton: 3.8,
  polyester: 6.4,
  recycled_polyester: 2.1,
  nylon: 7.2,
  wool: 10.1,
  silk: 8.5,
  linen: 1.5,
  bamboo: 3.5,
  hemp: 2.3,
  blend: 5.5,
};

const MATERIAL_SOURCE_MULTIPLIERS: Record<string, number> = {
  domestic: 0.8,
  imported: 1.2,
  unknown: 1.0,
};

// Process energy intensities (kg CO₂e / kg product)
const PROCESS_FACTORS: Record<string, number> = {
  knitting: 0.73,
  weaving: 1.31,
  cutting: 0.58,
  dyeing: 2.61,
  printing: 0.87,
  finishing: 0.44,
};

const KWH_PER_KG = 2; // proxy energy intensity per kg product

function getMaterialFactor(key: string): number {
  const alias = MATERIAL_ALIAS_MAP[key] ?? key;
  const factor = getCarbonFactor(alias);
  return factor?.value ?? MATERIAL_FALLBACK[key] ?? 5.5;
}

function getTransportFactor(mode: string): number {
  const factor = getCarbonFactor(mode);
  // factorRegistry transport factors are kg CO₂e per tkm (tonne-km)
  // Convert: value is per tonne-km → per kg·km = value / 1000
  return factor ? factor.value / 1000 : 0.016 / 1000;
}

function getGridFactor(energySource: string): number {
  const factor = getCarbonFactor(energySource);
  return factor?.value ?? 0.6766; // VN grid default kg CO₂e/kWh
}

export interface CarbonCalculationResult {
  materialsCO2: number;
  manufacturingCO2: number;
  transportCO2: number;
  totalCO2: number;
  scope: 'scope1' | 'scope1_2' | 'scope1_2_3';
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceScore: number;
}

export function calculateCarbonForProduct(
  row: BulkProductRow
): CarbonCalculationResult {
  const weightKg = row.weightPerUnit / 1000;

  // Materials CO₂
  const primaryFactor = getMaterialFactor(row.primaryMaterial);
  const primaryCO2 =
    weightKg * (row.primaryMaterialPercentage / 100) * primaryFactor;

  let secondaryCO2 = 0;
  if (row.secondaryMaterial && row.secondaryMaterialPercentage) {
    const secondaryFactor = getMaterialFactor(row.secondaryMaterial);
    secondaryCO2 =
      weightKg * (row.secondaryMaterialPercentage / 100) * secondaryFactor;
  }

  const sourceMultiplier =
    MATERIAL_SOURCE_MULTIPLIERS[row.materialSource] ?? 1.0;
  const materialsCO2 = (primaryCO2 + secondaryCO2) * sourceMultiplier;

  // Manufacturing CO₂
  const gridFactor = getGridFactor(row.energySource);
  const processTotal = row.processes.reduce(
    (sum, process) => sum + (PROCESS_FACTORS[process] ?? 0.5),
    0
  );
  const manufacturingCO2 =
    weightKg * processTotal + weightKg * KWH_PER_KG * gridFactor;

  // Transport CO₂
  const transportFactor = getTransportFactor(row.transportMode);
  const distanceKey =
    row.marketType === 'domestic'
      ? 'domestic'
      : row.exportCountry || 'other';
  const distance = resolveMarketDistanceDefault(distanceKey);
  const transportCO2 = weightKg * distance * transportFactor;

  const totalCO2 = materialsCO2 + manufacturingCO2 + transportCO2;

  // Scope & confidence
  let scope: 'scope1' | 'scope1_2' | 'scope1_2_3' = 'scope1';
  let confidenceScore = 50;

  const hasFullMaterialData =
    (row.primaryMaterial && row.primaryMaterialPercentage === 100) ||
    (row.secondaryMaterial &&
      (row.primaryMaterialPercentage || 0) +
        (row.secondaryMaterialPercentage || 0) ===
        100);
  const hasFullManufacturingData =
    row.processes.length > 0 && row.energySource;
  const hasFullTransportData =
    row.transportMode &&
    (row.marketType === 'domestic' || row.exportCountry);

  if (hasFullManufacturingData) {
    scope = 'scope1_2';
    confidenceScore += 20;
  }
  if (hasFullMaterialData && hasFullTransportData) {
    scope = 'scope1_2_3';
    confidenceScore += 30;
  }
  if (row.materialSource !== 'unknown') confidenceScore += 5;
  if (row.processes.length >= 2) confidenceScore += 5;
  if (row.marketType === 'export' && row.exportCountry) confidenceScore += 5;
  confidenceScore = Math.min(confidenceScore, 100);

  let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
  if (confidenceScore >= 85) confidenceLevel = 'high';
  else if (confidenceScore >= 65) confidenceLevel = 'medium';

  return {
    materialsCO2: Math.round(materialsCO2 * 1000) / 1000,
    manufacturingCO2: Math.round(manufacturingCO2 * 1000) / 1000,
    transportCO2: Math.round(transportCO2 * 1000) / 1000,
    totalCO2: Math.round(totalCO2 * 1000) / 1000,
    scope,
    confidenceLevel,
    confidenceScore,
  };
}

export function calculateBulkCarbon(rows: BulkProductRow[]): BulkProductRow[] {
  return rows.map((row) => {
    const result = calculateCarbonForProduct(row);
    return {
      ...row,
      calculatedCO2: result.totalCO2,
      scope: result.scope,
      confidenceLevel: result.confidenceLevel,
    };
  });
}

export function getAggregateStats(rows: BulkProductRow[]) {
  const calculatedRows = calculateBulkCarbon(rows);
  const totalProducts = calculatedRows.length;
  const totalQuantity = calculatedRows.reduce((sum, r) => sum + r.quantity, 0);
  const totalCO2 = calculatedRows.reduce(
    (sum, r) => sum + (r.calculatedCO2 || 0) * r.quantity,
    0
  );
  const avgCO2PerProduct = totalQuantity > 0 ? totalCO2 / totalQuantity : 0;
  const byConfidence = {
    high: calculatedRows.filter((r) => r.confidenceLevel === 'high').length,
    medium: calculatedRows.filter((r) => r.confidenceLevel === 'medium').length,
    low: calculatedRows.filter((r) => r.confidenceLevel === 'low').length,
  };
  const byScope = {
    scope1: calculatedRows.filter((r) => r.scope === 'scope1').length,
    scope1_2: calculatedRows.filter((r) => r.scope === 'scope1_2').length,
    scope1_2_3: calculatedRows.filter((r) => r.scope === 'scope1_2_3').length,
  };
  return {
    totalProducts,
    totalQuantity,
    totalCO2: Math.round(totalCO2 * 100) / 100,
    avgCO2PerProduct: Math.round(avgCO2PerProduct * 1000) / 1000,
    byConfidence,
    byScope,
    calculatedRows,
  };
}
