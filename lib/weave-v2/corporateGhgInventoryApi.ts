import { api } from '@/lib/apiClient';

export type GhgBoundaryDecision = { category: string; status: 'quantified' | 'not_relevant' | 'excluded'; rationale: string };
export type GhgActivitySource = { sourceReference: string; facilityReference: string; scope: 'scope1' | 'scope2' | 'scope3';
  category: string; gas: string; accountingMethod: 'location_based' | 'market_based'; activityValue: number; activityUnit: string;
  emissionFactor: number; factorUnit: string; factorSource: string; factorVersion: string; gwpBasis: string; evidenceDocumentIds: string[] };
export interface CorporateGhgInventoryInput {
  inventoryReference: string; inventoryDate: string; reportingEntityName: string; reportingPeriodStart: string; reportingPeriodEnd: string;
  intendedUse: string; organizationalBoundary: { approach: 'equity_share' | 'financial_control' | 'operational_control';
    description: string; entities: Array<{ reference: string; name: string; ownershipPercent: number; included: boolean; rationale: string }> };
  facilities: Array<{ reference: string; name: string; country: string; included: boolean; rationale: string; evidenceDocumentIds: string[] }>;
  defaultFuelFacilityReference: string; operationalBoundary: { scope1: GhgBoundaryDecision[]; scope2: GhgBoundaryDecision[];
    scope3Claim: 'not_included' | 'screened' | 'full_inventory'; scope3: GhgBoundaryDecision[] };
  gasCoverage: Array<{ gas: string; status: 'quantified' | 'not_relevant'; rationale: string }>;
  baseYear: { year: number; emissionsKgCo2e: number | null; recalculationPolicy: string; significanceThresholdPercent: number; structuralChanges: string };
  scope2Accounting: { marketBasedApplicable: boolean; locationBasedFactorVersion: string; gwpBasis: string;
    marketBasedMethod: string; contractualInstrumentEvidenceIds: string[] };
  fuelFactorMetadata: Array<{ fuelType: string; source: string; version: string; gwpBasis: string }>;
  additionalSources: GhgActivitySource[]; dataCompletenessPercent: number; dataQualityAssessment: string; dataImprovementPlan: string;
  uncertaintyAssessment: string; biogenicCo2Kg: number; removalsCo2Kg: number; offsetsRetiredKgCo2e: number;
  exclusions: Array<{ source: string; rationale: string; estimatedImpactPercent: number }>;
  evidenceDocumentIds: string[]; assurance: { verifiedLanguageRequested: boolean; providerName: string;
    level: '' | 'limited_assurance' | 'reasonable_assurance'; statementDate: string | null; evidenceDocumentId: string | null };
  limitations: string; notes: string;
}
export interface CorporateGhgReview { id: string; inventoryId: string; reviewerId: string; reviewerName: string;
  reviewerEmail: string | null; reviewerRole: 'corporate_ghg_inventory_reviewer';
  decision: 'approved_for_internal_report' | 'needs_information' | 'rejected'; notes: string; inputSha256: string;
  activitySnapshotSha256: string; resultSha256: string; evidenceSnapshot: Array<{ id: string; type: string; name: string;
    checksumSha256: string; fileSizeBytes: number; status: string }>; createdAt: string }
export interface CorporateGhgInventory { id: string; inventoryReference: string; revision: number; rulesetId: string; rulesetVersion: string;
  rulesetCoverage: 'limited' | 'complete'; sourceManifestSha256: string; inventoryDate: string; reportingPeriodStart: string;
  reportingPeriodEnd: string; input: CorporateGhgInventoryInput; inputSha256: string; activitySnapshot: Array<Record<string, unknown>>;
  activitySnapshotSha256: string; result: { automatedStatus: 'needs_information' | 'inventory_review_required'; missingInputs: string[];
    findings: Array<{ code: string; severity: 'blocker' | 'specialist' | 'warning'; message: string; path: string | null }>;
    sources: Array<{ id: string; title: string; url: string; version: string }>; totals: { scope1KgCo2e: number;
      scope2LocationBasedKgCo2e: number; scope2MarketBasedKgCo2e: number | null; scope3KgCo2e: number | null;
      biogenicCo2Kg: number; removalsCo2Kg: number; offsetsRetiredKgCo2e: number; grossScope1AndLocationScope2KgCo2e: number };
    activitySourceCount: number; evidenceCount: number; inventoryScopeLabel: string; assuranceStatus: string; disclaimer: string;
    resultSha256: string }; resultSha256: string; automatedStatus: 'needs_information' | 'inventory_review_required';
  inventoryStatus: 'needs_information' | 'inventory_review_required' | 'approved_for_internal_report' | 'evidence_review_required' | 'rejected' | 'superseded';
  staleEvidenceIds: string[]; latestReview: CorporateGhgReview | null; createdAt: string }

export const fetchCorporateGhgInventories = () => api.get<CorporateGhgInventory[]>('/corporate-ghg-inventories');
export const createCorporateGhgInventory = (input: CorporateGhgInventoryInput) =>
  api.post<CorporateGhgInventory>('/corporate-ghg-inventories', input);
export const reviewCorporateGhgInventory = (inventoryId: string, payload: { reviewerRole: 'corporate_ghg_inventory_reviewer';
  decision: CorporateGhgReview['decision']; notes: string }) =>
  api.post<CorporateGhgReview>(`/corporate-ghg-inventories/${encodeURIComponent(inventoryId)}/reviews`, payload);
