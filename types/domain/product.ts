/**
 * Domain types for Product Carbon Assessment and Management
 * Pure domain interfaces decoupled from UI components.
 */

import type {
  CarbonComputationResult,
  CarbonDataQualityBreakdown,
  CarbonFactorSummaryItem,
  CarbonRange,
  ProductCategory,
} from "@/lib/carbon/types";
import type { EvidenceDocument } from "@/hooks/useEvidenceUpload";
import type { TransportLeg } from "./transport";

export type { ProductCategory, EvidenceDocument };

export interface MaterialInput {
  id: string;
  materialType: string;
  percentage: number;
  source: "domestic" | "imported" | "unknown";
  certifications: string[];
}

export interface AccessoryInput {
  id: string;
  name: string;
  type: string;
  weight?: number;
}

export interface EnergySourceInput {
  id: string;
  source: string;
  percentage: number;
  /**
   * Renewable source (solar/wind) whose I-REC/GO certificates have been SOLD: the
   * green attribute is transferred, so this electricity must be accounted at the
   * national grid factor (GHG Protocol Scope 2 market-based) to avoid double counting.
   */
  recsSold?: boolean;
}

export interface AddressInput {
  aptSuite?: string;
  streetNumber: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  stateRegion: string;
  country: string;
  postalCode: string;
  lat?: number;
  lng?: number;
}

export interface CarbonBreakdown {
  materials: number;
  production: number;
  energy: number;
  transport: number;
  packaging?: number;
  total: number;
}

export interface CarbonAssessmentResult
  extends Partial<
    Pick<
      CarbonComputationResult,
      | "biogenicCarbon"
      | "gwpBreakdown"
      | "cradleToGateCoreKgCO2e"
      | "gateToMarketExtensionKgCO2e"
      | "reportedTotalKgCO2e"
      | "methodology"
      | "boundary"
      | "quality"
      | "uncertainty"
      | "energyBreakdown"
      | "factorSources"
      | "warnings"
      | "trace"
      | "calculationTermsSchemaVersion"
      | "calculationTerms"
      | "stageBreakdown"
    >
  > {
  perProduct: CarbonBreakdown;
  totalBatch: CarbonBreakdown;
  confidenceLevel: "high" | "medium" | "low";
  confidenceScore?: number;
  proxyUsed: boolean;
  proxyNotes: string[];
  scope1: number | null;
  scope2: number | null;
  scope3: number | null;
  co2eRange?: CarbonRange;
  methodologyVersion?: string;
  assumptionsUsed?: string[];
  factorSourceSummary?: CarbonFactorSummaryItem[];
  dataQualityBreakdown?: CarbonDataQualityBreakdown;
}

export interface ProductAssessmentData {
  productCode: string;
  productName: string;
  productType: string;
  productCategory: ProductCategory;
  hsCode?: string;
  cnCode?: string;
  facility?: string;
  evidenceLookupCode?: string;
  evidenceDocument?: EvidenceDocument;
  supplierCountry?: string;
  supplyGap?: boolean;
  customsDeclarationNo?: string;
  poContractId?: string;
  billOfLadingNo?: string;
  containerNo?: string;
  weightPerUnit: number;
  quantity: number;

  materials: MaterialInput[];
  accessories: AccessoryInput[];

  productionProcesses: string[];
  energySources: EnergySourceInput[];
  manufacturingLocation: string;
  wasteRecovery: string;

  destinationMarket: string;
  originAddress: AddressInput;
  destinationAddress: AddressInput;
  transportLegs: TransportLeg[];
  estimatedTotalDistance: number;

  carbonResults?: CarbonAssessmentResult;

  status: "draft" | "published";
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductAssessmentSessionDraft {
  currentStep: number;
  data: ProductAssessmentData;
  updatedAt: string;
}

export interface MarketComplianceDocumentSummary {
  marketCode: string;
  marketName: string;
  addedDocumentNames: string[];
  requiredDocumentNames: string[];
  missingRequiredDocumentNames: string[];
}

export interface DraftVersion {
  id: string;
  version: number;
  data: ProductAssessmentData;
  timestamp: string;
  note?: string;
}

export interface BulkProductRow {
  sourceRow?: number;
  sku: string;
  productName: string;
  productType: string;
  hsCode?: string;
  cnCode?: string;
  facility?: string;
  evidenceLookupCode?: string;
  supplierCountry?: string;
  supplyGap?: boolean;
  customsDeclarationNo?: string;
  poContractId?: string;
  billOfLadingNo?: string;
  containerNo?: string;
  quantity: number;
  weightPerUnit: number;

  primaryMaterial: string;
  primaryMaterialPercentage: number;
  secondaryMaterial?: string;
  secondaryMaterialPercentage?: number;
  accessories?: string;
  accessoriesWeightGram?: string;
  certifications?: string;
  materialSource: "domestic" | "imported" | "unknown";

  processes: string[];
  energySource: "grid" | "solar" | "coal" | "mixed";

  marketType: "domestic" | "export";
  exportCountry?: string;
  exportComplianceDocuments?: string;
  transportMode?: "road" | "sea" | "air" | "rail" | "multimodal";
  manufacturingLocation?: string;
  wasteRecovery?: string;
  transportOrigin?: string;
  transportOriginCity?: string;
  transportOriginStateRegion?: string;
  transportOriginCountry?: string;
  transportDestination?: string;
  transportDestinationCity?: string;
  transportDestinationStateRegion?: string;
  transportDestinationCountry?: string;
  transportDistanceKm?: number;

  calculatedCO2?: number;
  scope?: "scope1" | "scope1_2" | "scope1_2_3";
  confidenceLevel?: "high" | "medium" | "low";
}
