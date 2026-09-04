import { api } from "@/lib/apiClient";
import type { ExportConfigV2 } from "./exportLogisticsDocs";
import type { CarbonAuthorityReference } from "@/lib/productsApi";

export interface DppLockResponseV2 {
  id: string;
  productId?: string;
  sku: string;
  gtin: string;
  barcodeStandard: string;
  payload: Record<string, unknown>;
  carbonAuthority?: CarbonAuthorityReference;
  payloadSha256: string;
  decentralizedUrl: string;
  status: string;
  lockedAt: string;
}

export const fetchExportConfigurationV2 = () =>
  api.get<ExportConfigV2>("/export/configuration");

export const saveExportConfigurationV2 = (payload: Partial<ExportConfigV2>) =>
  api.put<ExportConfigV2>("/export/configuration", payload);

export const createDppLockV2 = (payload: { productId?: string; product_id?: string; sku?: string }) =>
  api.post<DppLockResponseV2>("/export/dpp-locks", payload);

export const buildBuyerWebhookPayloadV2 = () =>
  api.post<Record<string, unknown>>("/export/buyer-webhook-payload", {});

export const downloadExportDocumentV2 = async (
  type: "commercial-invoice" | "packing-list" | "bill-of-lading"
) => {
  const response = await api.raw(`/export/documents/${type}`);
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `${type}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
