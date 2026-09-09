import { api } from "@/lib/apiClient";

export interface AuditTermEvidenceCoverage {
  status: "complete" | "incomplete";
  termCount: number;
  coveredTermCount: number;
  missingTermCount: number;
  terms: Array<{
    termKey: string;
    termIndex: number;
    stage: string;
    detail?: string | null;
    factorVersionId: string;
    activityEvidenceDocumentIds: string[];
    factorEvidenceDocumentIds: string[];
    missing: string[];
    status: "covered" | "incomplete";
  }>;
}

export interface AuditQaException {
  code: string;
  message: string;
  severity?: "warning" | "blocking";
  status?: "open" | "resolved";
}

export type AuditAssuranceOutcome =
  | "requested"
  | "evidence_received"
  | "limited_assurance"
  | "reasonable_assurance"
  | "qualified"
  | "adverse"
  | "expired"
  | "withdrawn";

export type AuditAssuranceStatus =
  | "not_verified"
  | "limited_assurance"
  | "reasonable_assurance"
  | "qualified"
  | "adverse"
  | "withdrawn";

export interface AuditBundleShareLink {
  id: string;
  label?: string | null;
  expiresAt: string;
  maxDownloads: number | null;
  downloadCount: number;
  lastAccessedAt?: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  createdAt: string;
}

export interface CreatedAuditBundleShare extends AuditBundleShareLink {
  token: string;
  shareUrl: string;
}

export interface AuditExternalAssurance {
  id: string;
  outcome: AuditAssuranceOutcome;
  providerName: string;
  practitionerName?: string | null;
  standard?: string | null;
  scope: string;
  statementDate?: string | null;
  validTo?: string | null;
  evidenceDocumentId?: string | null;
  evidenceSha256?: string | null;
  notes?: string | null;
  recordedAt: string;
}

export interface AuditBundleRecord {
  id: string;
  reportId: string;
  productId?: string;
  calculationSnapshotId?: string;
  version: number;
  status: "processing" | "completed" | "failed";
  lifecycleStatus?: "draft" | "blocked" | "ready" | "issued" | "superseded";
  assuranceStatus: AuditAssuranceStatus;
  termEvidenceCoverage?: AuditTermEvidenceCoverage | null;
  manifestSha256?: string | null;
  bundleSha256?: string | null;
  fileSizeBytes?: number;
  filename?: string | null;
  errorMessage?: string | null;
  downloadUrl: string | null;
  completedAt?: string | null;
  createdAt?: string;
  latestReview?: {
    id: string;
    decision: "approved" | "rejected";
    qaExceptions: AuditQaException[];
    notes?: string | null;
    reviewedBy: string;
    reviewerName?: string | null;
    reviewerEmail?: string | null;
    reviewedAt: string;
  } | null;
  issuance?: {
    id: string;
    assertion: string;
    criteria: string;
    issuedBy: string;
    signerName?: string | null;
    signerEmail?: string | null;
    signatureAlgorithm?: string | null;
    signaturePayloadSha256?: string | null;
    signaturePublicKey?: string | null;
    signatureValue?: string | null;
    signatureValid?: boolean;
    signatureAcknowledgedAt?: string | null;
    issuedAt: string;
  } | null;
  externalAssurance?: AuditExternalAssurance | null;
  shareLinks?: AuditBundleShareLink[];
}

export const createAuditBundle = (productId: string) =>
  api.post<AuditBundleRecord>("/reports/v2/audit-packs", { productId });

export const fetchAuditBundle = (bundleId: string) =>
  api.get<AuditBundleRecord>(`/reports/v2/audit-packs/${encodeURIComponent(bundleId)}`);

export const reviewAuditBundle = (
  bundleId: string,
  payload: { decision: "approved" | "rejected"; notes?: string; qaExceptions?: AuditQaException[] }
) => api.post(`/reports/v2/audit-packs/${encodeURIComponent(bundleId)}/reviews`, payload);

export const issueAuditBundle = (
  bundleId: string,
  payload: { assertion: string; criteria: string; signatureAcknowledged: true }
) => api.post(`/reports/v2/audit-packs/${encodeURIComponent(bundleId)}/issue`, payload);

export const createAuditBundleShare = (
  bundleId: string,
  payload: { label?: string; expiresInHours: number; maxDownloads: number | null }
) => api.post<CreatedAuditBundleShare>(
  `/reports/v2/audit-packs/${encodeURIComponent(bundleId)}/shares`,
  payload
);

export const revokeAuditBundleShare = (bundleId: string, shareId: string) =>
  api.delete(`/reports/v2/audit-packs/${encodeURIComponent(bundleId)}/shares/${encodeURIComponent(shareId)}`);

export const createAuditBundleAssuranceRecord = (
  bundleId: string,
  payload: {
    outcome: AuditAssuranceOutcome;
    providerName: string;
    practitionerName?: string;
    standard?: string;
    scope: string;
    statementDate?: string;
    validTo?: string;
    evidenceDocumentId?: string;
    notes?: string;
  }
) => api.post<AuditExternalAssurance>(
  `/reports/v2/audit-packs/${encodeURIComponent(bundleId)}/assurance-records`,
  payload
);

export const downloadAuditBundle = async (bundle: AuditBundleRecord) => {
  if (bundle.status !== "completed" || !bundle.reportId) {
    throw new Error("Audit Pack is not ready for download.");
  }
  const response = await api.raw(`/reports/${encodeURIComponent(bundle.reportId)}/download`);
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] || bundle.filename || `AuditPack_v${bundle.version}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
