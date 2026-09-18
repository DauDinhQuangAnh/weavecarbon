import { api } from '@/lib/apiClient';

export type CanonicalActivityField =
  | 'activityReference'
  | 'activityType'
  | 'periodStart'
  | 'periodEnd'
  | 'quantity'
  | 'canonicalUnit'
  | 'unmapped';

export interface EvidenceExtractionReview {
  id: string;
  evidenceDocumentId: string;
  evidenceChecksumSha256: string;
  extractionSha256: string;
  reviewerId: string | null;
  reviewerName: string;
  reviewerRole: 'evidence_ai_reviewer';
  decision: 'approved_for_mapping' | 'needs_correction' | 'rejected';
  notes: string;
  createdAt: string;
  fields: Array<{
    id: string;
    fieldPath: string;
    aiValue: unknown;
    decision: 'accepted' | 'corrected' | 'rejected';
    confirmedValue: unknown;
    canonicalField: string;
    fieldSha256: string;
  }>;
}

export interface ActivityPromotionSuggestion {
  engine: string;
  engineVersion: string;
  evidenceDocumentId: string;
  evidenceChecksumSha256: string;
  extractionReviewId: string;
  extractionSha256: string;
  suggestionSha256: string;
  fields: Array<{
    fieldPath: string;
    confirmedValue: unknown;
    fieldDecision: string;
    suggestedCanonicalField: CanonicalActivityField;
    confidence: number;
    rationale: string;
  }>;
  evidenceMatches: Array<{
    evidenceDocumentId: string;
    relationship: 'source_document' | 'supports_activity' | 'calibration_record' | 'review_record';
    confidence: number;
    rationale: string;
    evidence?: {
      id: string;
      documentName: string;
      evidenceType: string;
      status: string;
      checksumSha256: string;
      fileSizeBytes: number;
      relationship: string;
      reportingPeriodStart?: string | null;
      reportingPeriodEnd?: string | null;
    };
  }>;
}

export interface ActivityPromotionCandidate {
  id: string;
  evidenceDocumentId: string;
  extractionReviewId: string;
  candidateReference: string;
  revision: number;
  status: 'blocked' | 'ready_for_promotion';
  fieldDecisions: Array<Record<string, unknown>>;
  anomalySnapshot: Array<{
    code: string;
    severity: 'blocking' | 'warning';
    fieldPaths: string[];
    description: string;
  }>;
  canonicalPayload: Record<string, unknown>;
  blockerCodes: string[];
  warningCodes: string[];
  notes: string;
  payloadSha256: string;
  promoted: boolean;
  promotionId: string | null;
  activityId: string | null;
  promotedAt: string | null;
  createdAt: string;
}

export interface CreateActivityPromotionCandidateInput {
  candidateReference: string;
  suggestionSha256: string;
  notes: string;
  fieldDecisions: Array<{
    fieldPath: string;
    decision: 'accepted' | 'corrected' | 'rejected';
    confirmedCanonicalField: CanonicalActivityField;
    rationale: string;
  }>;
  overrideRationales: Record<string, string>;
  anomalyResolutions: Array<{
    code: string;
    resolution: 'resolved' | 'accepted_with_rationale';
    rationale: string;
  }>;
  evidenceMatches: Array<{
    evidenceDocumentId: string;
    relationship: 'supports_activity' | 'calibration_record' | 'review_record';
    decision: 'accepted' | 'rejected';
    rationale: string;
  }>;
  activityPayload: {
    activityReference: string;
    facilityRevisionId: string;
    processRevisionId?: string;
    measurementPointRevisionId?: string;
    activityType: string;
    periodStart: string;
    periodEnd: string;
    quantity: number;
    canonicalUnit: string;
    sourceKind: 'invoice' | 'meter' | 'plc' | 'sensor' | 'supplier' | 'manual' | 'api';
    dataQualityLevel: 'L1' | 'L2' | 'L3';
  };
}

const encoded = (value: string) => encodeURIComponent(value);

export const evidenceActivityPromotionApi = {
  reviews: (evidenceId: string) =>
    api.get<EvidenceExtractionReview[]>(`/evidence/${encoded(evidenceId)}/extraction-reviews`),
  suggestions: (evidenceId: string, reviewId: string) =>
    api.get<ActivityPromotionSuggestion>(
      `/evidence/${encoded(evidenceId)}/extraction-reviews/${encoded(reviewId)}/activity-promotion-suggestions`
    ),
  candidates: (evidenceId: string) =>
    api.get<ActivityPromotionCandidate[]>(`/evidence/${encoded(evidenceId)}/activity-candidates`),
  createCandidate: (
    evidenceId: string,
    reviewId: string,
    input: CreateActivityPromotionCandidateInput
  ) => api.post<ActivityPromotionCandidate>(
    `/evidence/${encoded(evidenceId)}/extraction-reviews/${encoded(reviewId)}/activity-candidates`,
    input
  ),
  promote: (evidenceId: string, candidateId: string, attestation: string) =>
    api.post<{ alreadyPromoted?: boolean; promotion?: { id: string; activityId: string }; activity?: { id: string } }>(
      `/evidence/${encoded(evidenceId)}/activity-candidates/${encoded(candidateId)}/promote`,
      { promoterRole: 'industrial_activity_promoter', attestation }
    )
};
