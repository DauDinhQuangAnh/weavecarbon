export type CarbonConfidenceLevel = "high" | "medium" | "low";

export type CarbonFactorQuality =
  | "primary"
  | "documented_secondary"
  | "internal_proxy"
  | "market_default_or_missing";

export type CarbonStageKey =
  | "materials"
  | "production"
  | "energy"
  | "transport"
  | "packaging";

export interface CarbonRange {
  min: number;
  max: number;
}

export interface CarbonFactorMetadata {
  id: string;
  label: string;
  unit: string;
  value: number;
  source: string;
  sourceUrl: string;
  year?: number;
  geography?: string;
  quality: CarbonFactorQuality;
  isProxy: boolean;
}

export interface CarbonFactorSummaryItem {
  factorId: string;
  label: string;
  stage: CarbonStageKey;
  unit: string;
  value: number;
  source: string;
  sourceUrl: string;
  geography?: string;
  year?: number;
  quality: CarbonFactorQuality;
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
  source?: "domestic" | "imported" | "unknown";
  provenanceFactorId?: string;
  name?: string;
  isPrimaryData?: boolean;
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
  isPrimaryData?: boolean;
}

export interface CarbonEngineInput {
  unitMassKg: number;
  quantity: number;
  materials: CarbonMaterialInput[];
  accessories: CarbonAccessoryInput[];
  packaging?: CarbonPackagingInput | null;
  includePackagingFallbackNote?: boolean;
  processFactorIds: string[];
  energyMix: CarbonEnergyInput[];
  manufacturingGeography?: string;
  originGeography?: string;
  destinationMarket?: string;
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

export interface CarbonComputationResult {
  perProduct: CarbonBreakdownResult;
  totalBatch: CarbonBreakdownResult;
  confidenceLevel: CarbonConfidenceLevel;
  confidenceScore: number;
  proxyUsed: boolean;
  proxyNotes: string[];
  scope1: number | null;
  scope2: number | null;
  scope3: number | null;
  co2eRange: CarbonRange;
  methodologyVersion: string;
  assumptionsUsed: string[];
  factorSourceSummary: CarbonFactorSummaryItem[];
  dataQualityBreakdown: CarbonDataQualityBreakdown;
  stageBreakdown: CarbonStageBreakdown[];
}
