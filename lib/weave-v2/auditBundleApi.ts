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

export interface AuditBundleRecord {
  id: string;
  reportId: string;
  productId?: string;
  calculationSnapshotId?: string;
  version: number;
  status: "processing" | "completed" | "failed";
  lifecycleStatus?: "draft" | "blocked" | "ready" | "issued" | "superseded";
  assuranceStatus: "not_verified";
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
    reviewedAt: string;
  } | null;
  issuance?: {
    id: string;
    assertion: string;
    criteria: string;
    issuedBy: string;
    issuedAt: string;
  } | null;
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
  payload: { assertion: string; criteria: string }
) => api.post(`/reports/v2/audit-packs/${encodeURIComponent(bundleId)}/issue`, payload);

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
