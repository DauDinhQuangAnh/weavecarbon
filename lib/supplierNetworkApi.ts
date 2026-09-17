import { api } from "@/lib/apiClient";

export interface SupplierProfile {
  id: string; supplierReference: string; revision: number; legalName: string; tradingName?: string | null;
  countryCode: string; sector: string; supplierTier: number; lifecycleStatus: "prospective" | "active" | "inactive";
  evidenceSnapshot: { id: string; checksumSha256: string }; profileSha256: string; createdAt: string;
}
export interface SupplierSite {
  id: string; supplierRevisionId: string; supplierReference?: string; supplierName?: string; siteReference: string;
  revision: number; siteName: string; countryCode: string; latitude: number; longitude: number; precisionMeters: number;
  locationBasis: string; evidenceSnapshot: { id: string; checksumSha256: string }; siteSha256: string; createdAt: string;
}
export interface SupplierRelationship {
  id: string; supplierRevisionId: string; supplierReference?: string; supplierName?: string; relationshipReference: string;
  revision: number; materialOrService: string; procurementCategory: string; spendPercent: number;
  productionDependencyPercent: number; singleSource: boolean; dependentSkuCount: number; dependentRouteCount: number;
  effectiveFrom: string; effectiveTo?: string | null; relationshipSha256: string; createdAt: string;
}
export interface SupplierClimateAssessment {
  id: string; supplierRevisionId: string; supplierReference?: string; supplierName?: string; siteRevisionId: string;
  siteReference?: string; siteName?: string; hazardType: "heat" | "drought" | "extreme_rainfall";
  scenarioKind: "historical" | "projection"; scenarioReference: string; horizonStart: string; horizonEnd: string;
  sourceKind: "ERA5_LAND" | "CMIP6" | "OTHER"; sourceUrl: string; datasetIdentifier: string; datasetVersion: string;
  spatialResolution: string; temporalResolution: string; gridReference: string; spatialMatchNotes: string;
  modelName?: string | null; scenarioName?: string | null; hazardMetric: string; metricValue: number; metricUnit: string;
  uncertaintyNotes: string; exposureRating: number; vulnerabilityRating: number; priorityBand: "low" | "medium" | "high";
  ratingRationale: string; screeningStatus: string; inputSha256: string; createdAt: string;
}
export interface CarbonCriticalitySnapshot {
  id: string; subjectKind: "facility" | "supplier"; facilityRevisionId?: string | null; facilityName?: string;
  supplierRevisionId?: string | null; supplierName?: string; reportingPeriodStart: string; reportingPeriodEnd: string;
  grossKgCo2e: number; activityQuantity?: number | null; activityUnit?: string | null; intensityKgCo2e?: number | null;
  boundary: string; methodologyReference: string; sourceKind: "supplier_specific" | "facility_inventory" | "estimated" | "proxy";
  dataQualityLevel: "L1" | "L2" | "L3" | "L4" | "L5"; carbonSha256: string; createdAt: string;
}
export interface CriticalityModel {
  id: string; modelReference: string; revision: number; carbonWeightPercent: number; climateWeightPercent: number;
  dependencyWeightPercent: number; mediumThreshold: number; highThreshold: number; normalizationPolicy: string;
  rationale: string; approvalStatus: "draft" | "approved"; modelSha256: string; createdAt: string;
}
export interface CriticalitySnapshot {
  id: string; subjectKind: "facility" | "supplier"; facilityRevisionId?: string | null; facilityName?: string;
  supplierRevisionId?: string | null; supplierName?: string; relationshipRevisionId?: string | null;
  carbonSnapshotId: string; modelRevisionId: string; modelReference?: string; modelRevision?: number;
  assessmentPeriodStart: string; assessmentPeriodEnd: string; normalizedCarbonScore: number;
  normalizedClimateScore: number; normalizedDependencyScore: number; weightedScore: number;
  priorityBand: "low" | "medium" | "high"; reviewStatus: string; inputSnapshot: Record<string, unknown>;
  inputSha256: string; createdAt: string;
}
export interface CriticalityPortfolio {
  id: string; portfolioReference: string; modelRevisionId: string; assessmentPeriodStart: string; assessmentPeriodEnd: string;
  subjectCount: number; prioritySummary: { countByPriority: Record<"low" | "medium" | "high", number>; averageWeightedScore: number; reviewStatus: string };
  coverageSummary: { method: string; subjectCount: number; facilityCount: number; supplierCount: number;
    supplierSpecificCarbonCount: number; completeThreeHazardCount: number; supplierDependencyRecordCount: number;
    singleSourceSupplierCount: number; selectedSupplierSpendPercent: number };
  methodologyNotes: string; inputSha256: string; createdAt: string; members?: CriticalitySnapshot[];
}

export const supplierNetworkApi = {
  profiles: () => api.get<SupplierProfile[]>("/supplier-network/profiles"),
  createProfile: (input: Record<string, unknown>) => api.post<SupplierProfile>("/supplier-network/profiles", input),
  sites: () => api.get<SupplierSite[]>("/supplier-network/sites"),
  createSite: (input: Record<string, unknown>) => api.post<SupplierSite>("/supplier-network/sites", input),
  relationships: () => api.get<SupplierRelationship[]>("/supplier-network/relationships"),
  createRelationship: (input: Record<string, unknown>) => api.post<SupplierRelationship>("/supplier-network/relationships", input),
  climateAssessments: () => api.get<SupplierClimateAssessment[]>("/supplier-network/climate-assessments"),
  createClimateAssessment: (input: Record<string, unknown>) => api.post<SupplierClimateAssessment>("/supplier-network/climate-assessments", input),
  carbonSnapshots: () => api.get<CarbonCriticalitySnapshot[]>("/supplier-network/carbon-snapshots"),
  createCarbonSnapshot: (input: Record<string, unknown>) => api.post<CarbonCriticalitySnapshot>("/supplier-network/carbon-snapshots", input),
  models: () => api.get<CriticalityModel[]>("/supplier-network/criticality-models"),
  createModel: (input: Record<string, unknown>) => api.post<CriticalityModel>("/supplier-network/criticality-models", input),
  criticalitySnapshots: () => api.get<CriticalitySnapshot[]>("/supplier-network/criticality-snapshots"),
  createCriticalitySnapshot: (input: Record<string, unknown>) => api.post<CriticalitySnapshot>("/supplier-network/criticality-snapshots", input),
  portfolios: () => api.get<CriticalityPortfolio[]>("/supplier-network/portfolios"),
  portfolio: (id: string) => api.get<CriticalityPortfolio>(`/supplier-network/portfolios/${encodeURIComponent(id)}`),
  createPortfolio: (input: Record<string, unknown>) => api.post<CriticalityPortfolio>("/supplier-network/portfolios", input)
};
