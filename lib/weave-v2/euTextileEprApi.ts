import { api } from '@/lib/apiClient';

export type EprAddress = { street: string; postalCode: string; city: string; country: string };
export type EprActor = { name: string; address: EprAddress; email: string; phone: string; website: string;
  nationalIdentificationCode: string; tradeRegisterNumber: string; taxIdentificationNumber: string; mandateEvidenceIds: string[] };
export interface EuTextileEprInput {
  assessmentReference: string; assessmentDate: string; memberState: string; reportingPeriodStart: string; reportingPeriodEnd: string;
  intendedUse: string; producer: { legalName: string; trademarks: string[]; brandNames: string[]; address: EprAddress;
    email: string; phone: string; website: string; contactPoint: string; nationalIdentificationCode: string;
    tradeRegisterNumber: string; taxIdentificationNumber: string; establishedCountry: string;
    role: 'manufacturer_own_brand' | 'reseller_own_brand' | 'first_supplier_import' | 'distance_seller';
    employeeCount: number; annualTurnoverEur: number; annualBalanceSheetEur: number; suppliesUsedGoodsOnly: boolean;
    selfEmployedTailorCustomizedOnly: boolean; derivedFromUsedWasteOnly: boolean };
  authorizedRepresentative: EprActor & { applicable: boolean; nationalRuleBasis: string };
  producerResponsibilityOrganisation: EprActor; cnCodes: string[];
  memberStateRule: { adapterId: string; version: string; sourceUrl: string; effectiveFrom: string | null;
    schemeStatus: 'not_transposed' | 'transposed' | 'existing_scheme' | 'unknown'; competentAuthorityName: string;
    registerUrl: string; reportingSchedule: string; feeMethodStatus: 'unknown' | 'pending' | 'published'; reviewEvidenceIds: string[] };
  declaredMarketRows: Array<{ cnCode: string; quantity: number; unit: string; weightKg: number; productDescription: string }>;
  truthStatementConfirmed: boolean; evidenceDocumentIds: string[]; limitations: string; notes: string;
}
export interface EprReview { id: string; assessmentId: string; reviewerName: string; reviewerRole: 'eu_epr_specialist';
  decision: 'approved_for_internal_planning' | 'needs_information' | 'rejected'; notes: string; inputSha256: string;
  shipmentSnapshotSha256: string; resultSha256: string; createdAt: string }
export interface EprExternalEvent { id: string; assessmentId: string; eventType: string; externalReference: string;
  actorName: string; occurredAt: string; amount: number | null; currency: string | null; evidenceDocumentId: string;
  inputSha256: string; shipmentSnapshotSha256: string; resultSha256: string; createdAt: string }
export interface EuTextileEprAssessment { id: string; assessmentReference: string; revision: number; memberState: string;
  rulesetVersion: string; rulesetCoverage: 'limited' | 'complete'; assessmentDate: string; reportingPeriodStart: string;
  reportingPeriodEnd: string; input: EuTextileEprInput; inputSha256: string; shipmentSnapshot: Array<Record<string, unknown>>;
  shipmentSnapshotSha256: string; result: { automatedStatus: 'needs_information' | 'specialist_review_required';
    missingInputs: string[]; findings: Array<{ code: string; severity: 'blocker' | 'specialist' | 'warning'; message: string; path: string | null }>;
    totals: { declaredQuantity: number; declaredWeightKg: number; systemQuantity: number; systemWeightKg: number };
    reconciliation: Array<{ key: string; quantityDifference: number; weightDifferenceKg: number; status: 'matched' | 'mismatch' }>;
    registrationStatus: string; submissionStatus: string; paymentStatus: string; statutoryApplicationDate: string;
    microenterprise: boolean; disclaimer: string; sources: Array<{ title: string; url: string }> };
  resultSha256: string; automatedStatus: 'needs_information' | 'specialist_review_required';
  assessmentStatus: 'needs_information' | 'specialist_review_required' | 'approved_for_internal_planning' | 'external_evidence_recorded' | 'evidence_review_required' | 'rejected' | 'superseded';
  externalMilestones: string[]; staleEvidenceIds: string[]; latestReview: EprReview | null; externalEvents: EprExternalEvent[]; createdAt: string }

export const fetchEuTextileEprAssessments = () => api.get<EuTextileEprAssessment[]>('/eu-textile-epr/assessments');
export const createEuTextileEprAssessment = (input: EuTextileEprInput) =>
  api.post<EuTextileEprAssessment>('/eu-textile-epr/assessments', input);
export const reviewEuTextileEprAssessment = (assessmentId: string, payload: { reviewerRole: 'eu_epr_specialist';
  decision: EprReview['decision']; notes: string }) =>
  api.post<EprReview>(`/eu-textile-epr/assessments/${encodeURIComponent(assessmentId)}/reviews`, payload);
export const recordEuTextileEprExternalEvent = (assessmentId: string, payload: { eventType: string;
  externalReference: string; actorName: string; occurredAt: string; evidenceDocumentId: string; amount?: number;
  currency?: string; reportingPeriodStart?: string; reportingPeriodEnd?: string }) =>
  api.post<EprExternalEvent>(`/eu-textile-epr/assessments/${encodeURIComponent(assessmentId)}/external-events`, payload);
