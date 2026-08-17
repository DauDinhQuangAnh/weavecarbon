export type CarbonConfidenceLevel = "high" | "medium" | "low";

export type CarbonFactorQuality =
  | "primary"
  | "documented_secondary"
  | "internal_proxy"
  | "market_default_or_missing";

export type CarbonFactorClass =
  | "measured_primary_activity"
  | "supplier_specific"
  | "documented_secondary"
  | "market_default"
  | "internal_proxy";

export type CarbonStageKey =
  | "materials"
  | "finished_goods_manufacturing"
  | "logistics_and_storage"
  | "production"
  | "transport"
  | "packaging";

export type CarbonReportingActorRole = "manufacturer" | "brand" | "supplier" | "other";

export type ProductCategory = "textile";

export interface CarbonRange {
  min: number;
  max: number;
}

export interface CarbonQualityScores {
  technologicalRepresentativeness: number;
  temporalRepresentativeness: number;
  geographicalRepresentativeness: number;
  completeness: number;
  reliability: number;
}

export interface CarbonFactorMetadata {
  id: string;
  factorVersionId: string;
  label: string;
  unit: string;
  value: number;
  source: string;
  sourceUrl: string;
  year?: number;
  geography?: string;
  quality: CarbonFactorQuality;
  factorClass: CarbonFactorClass;
  boundaryType: "cradle_to_gate" | "gate_to_gate" | "gate_to_market" | "unknown";
  gwpBasis: string;
  validFrom?: string;
  validTo?: string;
  uncertaintyCv: number;
  qualityScores: CarbonQualityScores;
  isProxy: boolean;
  /** kg CO2 stored per kg of this material (dry-mass basis), for biogenic materials like wood. */
  biogenicCarbonKgPerKg?: number;
}

export interface CarbonFactorSummaryItem {
  factorId: string;
  factorVersionId: string;
  label: string;
  stage: CarbonStageKey;
  unit: string;
  value: number;
  source: string;
  sourceUrl: string;
  geography?: string;
  year?: number;
  quality: CarbonFactorQuality;
  factorClass: CarbonFactorClass;
  boundaryType: CarbonFactorMetadata["boundaryType"];
  gwpBasis: string;
  uncertaintyCv: number;
  qualityScores: CarbonQualityScores;
  isProxy: boolean;
}

export interface CarbonAxisScore {
  score: number;
  maxScore: number;
}

export interface CarbonDataQualityBreakdown {
  completeness: CarbonAxisScore;
  specificity: CarbonAxisScore;
  geographicRelevance: CarbonAxisScore;
  transportSpecificity: CarbonAxisScore;
  proxyShare: CarbonAxisScore;
}

export interface CarbonStageBreakdown {
  stage: CarbonStageKey;
  amount: number;
  range: CarbonRange;
  quality: CarbonFactorQuality;
  factors: CarbonFactorSummaryItem[];
  isEstimated: boolean;
}

export interface CarbonMaterialInput {
  id: string;
  factorId?: string;
  type: string;
  percentage: number;
  yieldToProduct?: number;
  source?: "domestic" | "imported" | "unknown";
  provenanceFactorId?: string;
  name?: string;
  isPrimaryData?: boolean;
  /**
   * kg CO2 stored per kg of this material (dry-mass basis), for biogenic materials like wood.
   * Reported separately from the fossil CO2e total, never netted into it.
   */
  biogenicCarbonFactorKgPerKg?: number;
}

export interface CarbonAccessoryInput {
  id: string;
  type: string;
  weightKg?: number;
  factorId?: string;
  name?: string;
  isPrimaryData?: boolean;
}

export interface CarbonPackagingInput {
  factorId?: string;
  weightKg: number;
  yieldToProduct?: number;
  label?: string;
  isPrimaryData?: boolean;
}

export interface CarbonEnergyInput {
  factorId?: string;
  percentage: number;
  geography?: string;
  year?: number;
  isPrimaryData?: boolean;
}

export interface CarbonTransportInput {
  mode?: string;
  factorId?: string;
  distanceKm?: number;
  defaultDistanceKey?: string;
  geography?: string;
  boundaryType?: "gate_to_market" | "inbound" | "interfacility";
  isPrimaryData?: boolean;
}

export interface CarbonEngineInput {
  unitMassKg: number;
  quantity: number;
  /** Defaults to "textile" when omitted, preserving existing engine behavior. */
  productCategory?: ProductCategory;
  materials: CarbonMaterialInput[];
  accessories: CarbonAccessoryInput[];
  packaging?: CarbonPackagingInput | null;
  includePackagingFallbackNote?: boolean;
  processFactorIds: string[];
  energyMix: CarbonEnergyInput[];
  manufacturingGeography?: string;
  originGeography?: string;
  destinationMarket?: string;
  reportingActorRole?: CarbonReportingActorRole;
  transport: CarbonTransportInput[];
}

export interface CarbonBreakdownResult {
  materials: number;
  production: number;
  energy: number;
  transport: number;
  packaging: number;
  total: number;
}

export interface CarbonBiogenicCarbonResult {
  removedKgCO2e: number;
  note: string;
}

/**
 * The three GHG buckets kept separate per ISO 14067:2018 (6.4.9) / EN 16485 so a
 * fossil-based PCF is never conflated with stored biogenic carbon or land-use change.
 */
export interface CarbonGwpBreakdownResult {
  /** Fossil-based GWP — equals the reported PCF total; the DPP "gateway metric". */
  fossilKgCO2e: number;
  /** Biogenic CO2 stored in bio-based materials, reported separately (never netted). */
  biogenicRemovedKgCO2e: number;
  /** Land-use-change GWP. null = not modeled for this product's partial boundary. */
  lulucKgCO2e: number | null;
  note: string;
}

export interface CarbonComputationResult {
  perProduct: CarbonBreakdownResult;
  totalBatch: CarbonBreakdownResult;
  /**
   * Biogenic CO2 removed/stored by bio-based materials (e.g. wood), reported per GHG
   * Protocol/PAS 2050 convention: separately from perProduct.total, never netted into it.
   */
  biogenicCarbon: CarbonBiogenicCarbonResult | null;
  /** Explicit fossil / biogenic / luluc split (ISO 14067 6.4.9). */
  gwpBreakdown: CarbonGwpBreakdownResult;
  cradleToGateCoreKgCO2e: number;
  gateToMarketExtensionKgCO2e: number;
  reportedTotalKgCO2e: number;
  confidenceLevel: CarbonConfidenceLevel;
  confidenceScore: number;
  proxyUsed: boolean;
  proxyNotes: string[];
  scope1: number | null;
  scope2: number | null;
  scope3: number | null;
  co2eRange: CarbonRange;
  methodologyVersion: string;
  methodology: {
    name: string;
    methodologyVersion: string;
    standardsAlignment: string[];
    impactCategory: "climate_change_only";
    inventoryType: "partial_cfp";
    boundaryType: "cradle_to_gate_plus_gate_to_market_extension";
    gwpBasis: string;
    reportingActorRole: CarbonReportingActorRole;
  };
  boundary: {
    includedStages: CarbonStageKey[];
    excludedStages: string[];
    partialCfp: boolean;
  };
  quality: {
    dataQualityRating1To5: number;
    dataQualityPercent: number;
    confidenceLevel: CarbonConfidenceLevel;
    primaryDataEmissionsShare: number;
    supplierSpecificEmissionsShare: number;
    secondaryEmissionsShare: number;
    proxyEmissionsShare: number;
  };
  uncertainty: {
    method: "rss_fallback";
    p5KgCO2e: number;
    p95KgCO2e: number;
    halfWidth95Percent: number;
  };
  energyBreakdown: Array<{
    factorId: string;
    label: string;
    amount: number;
    scope: "scope1" | "scope2" | "scope3";
  }>;
  factorSources: CarbonFactorSummaryItem[];
  warnings: string[];
  trace: {
    factorManifest: string[];
    calculationGraphVersion: string;
    ruleEngineVersion: string;
  };
  assumptionsUsed: string[];
  factorSourceSummary: CarbonFactorSummaryItem[];
  dataQualityBreakdown: CarbonDataQualityBreakdown;
  stageBreakdown: CarbonStageBreakdown[];
}
