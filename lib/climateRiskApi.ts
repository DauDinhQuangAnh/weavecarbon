import { api } from "@/lib/apiClient";

export interface ClimateLocation {
  id: string; facilityRevisionId: string; facilityName?: string; latitude: number; longitude: number;
  precisionMeters: number; locationBasis?: string; evidenceSnapshot: { id: string; checksumSha256: string }; createdAt: string;
}
export interface ClimateAssessment {
  id: string; facilityRevisionId: string; facilityName?: string; locationRevisionId: string;
  hazardType: "heat" | "drought" | "extreme_rainfall"; scenarioKind: "historical" | "projection";
  scenarioReference: string; horizonStart: string; horizonEnd: string; sourceKind: "ERA5_LAND" | "CMIP6" | "OTHER";
  sourceUrl: string; datasetIdentifier: string; datasetVersion: string; spatialResolution: string; temporalResolution: string;
  gridReference: string; spatialMatchNotes: string;
  modelName?: string | null; scenarioName?: string | null; hazardMetric: string; metricValue: number; metricUnit: string;
  uncertaintyNotes: string; exposureRating: number; vulnerabilityRating: number; businessDependencyPercent: number;
  priorityBand: "low" | "medium" | "high"; ratingRationale: string; screeningStatus: string;
  evidenceSnapshot: { id: string; checksumSha256: string }; createdAt: string;
}
export interface ClimatePortfolio {
  id: string; portfolioReference: string; scenarioKind: string; scenarioReference: string; horizonStart: string; horizonEnd: string;
  facilityCount: number; assessmentCount: number; prioritySummary: {
    reviewStatus: string; facilityCountByPriority: Record<"low" | "medium" | "high", number>;
    dependencyPercentByPriority: Record<"low" | "medium" | "high", number>; incompleteHazardCoverageFacilities: number;
  }; methodologyNotes: string; createdAt: string;
}
export const climateRiskApi = {
  locations: () => api.get<ClimateLocation[]>("/climate-risk/locations"),
  createLocation: (input: Record<string, unknown>) => api.post<ClimateLocation>("/climate-risk/locations", input),
  assessments: () => api.get<ClimateAssessment[]>("/climate-risk/assessments"),
  createAssessment: (input: Record<string, unknown>) => api.post<ClimateAssessment>("/climate-risk/assessments", input),
  portfolios: () => api.get<ClimatePortfolio[]>("/climate-risk/portfolios"),
  createPortfolio: (input: Record<string, unknown>) => api.post<ClimatePortfolio>("/climate-risk/portfolios", input),
  portfolio: (id: string) => api.get<ClimatePortfolio & { assessments: ClimateAssessment[] }>(`/climate-risk/portfolios/${encodeURIComponent(id)}`)
};
