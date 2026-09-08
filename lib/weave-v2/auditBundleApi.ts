import { api } from "@/lib/apiClient";

export interface AuditBundleRecord {
  id: string;
  reportId: string;
  productId?: string;
  calculationSnapshotId?: string;
  version: number;
  status: "processing" | "completed" | "failed";
  assuranceStatus: "not_verified";
  manifestSha256?: string | null;
  bundleSha256?: string | null;
  fileSizeBytes?: number;
  filename?: string | null;
  errorMessage?: string | null;
  downloadUrl: string | null;
  completedAt?: string | null;
  createdAt?: string;
}

export const createAuditBundle = (productId: string) =>
  api.post<AuditBundleRecord>("/reports/v2/audit-packs", { productId });

export const fetchAuditBundle = (bundleId: string) =>
  api.get<AuditBundleRecord>(`/reports/v2/audit-packs/${encodeURIComponent(bundleId)}`);

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
