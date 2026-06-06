import { api } from "@/lib/apiClient";

export interface EvidenceDocumentV2 {
  id: string;
  companyId: string;
  productId?: string | null;
  shipmentId?: string | null;
  evidenceType: string;
  documentName: string;
  lookupCode?: string | null;
  sourceVendor?: string | null;
  reportingPeriodStart?: string | null;
  reportingPeriodEnd?: string | null;
  storageProvider?: string | null;
  storageBucket?: string | null;
  storageKey?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  fileSizeBytes: number;
  checksumSha256?: string | null;
  extractedJson: Record<string, unknown>;
  status: "uploaded" | "locked" | string;
  lockedAt?: string | null;
  uploadedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceListResponseV2 {
  items: EvidenceDocumentV2[];
  total: number;
}

export interface CreateEvidencePayloadV2 {
  productId?: string;
  shipmentId?: string;
  evidenceType?: string;
  documentName: string;
  lookupCode?: string;
  sourceVendor?: string;
  reportingPeriodStart?: string;
  reportingPeriodEnd?: string;
  storageProvider?: string;
  storageBucket?: string;
  storageKey?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  checksumSha256?: string;
  extractedJson?: Record<string, unknown>;
}

export const listEvidenceV2 = (params: { productId?: string; lookupCode?: string } = {}) => {
  const query = new URLSearchParams();
  if (params.productId) query.set("product_id", params.productId);
  if (params.lookupCode) query.set("lookup_code", params.lookupCode);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return api.get<EvidenceListResponseV2>(`/evidence${suffix}`);
};

export const listProductEvidenceV2 = (productId: string) =>
  api.get<EvidenceListResponseV2>(`/evidence/product/${encodeURIComponent(productId)}`);

export const createEvidenceV2 = (payload: CreateEvidencePayloadV2) =>
  api.post<EvidenceDocumentV2>("/evidence", payload);

export const lockEvidenceV2 = (id: string) =>
  api.post<EvidenceDocumentV2>(`/evidence/${encodeURIComponent(id)}/lock`, {});
