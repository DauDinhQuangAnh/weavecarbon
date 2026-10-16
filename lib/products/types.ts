/**
 * Product API Types & Interfaces
 */
import type {
  AddressInput,
  CarbonAssessmentResult,
  ProductAssessmentData,
} from "@/types/domain/product";

export type ProductStatus = "draft" | "published";

export interface CarbonAuthorityReference {
  authoritative: true;
  source: "product_assessment_snapshot";
  calculationId: string;
  calculationVersion: number;
  calculatedAt: string | null;
  engineVersion: string;
  methodologyVersion: string;
  factorRegistryVersion: string;
  gwpBasis: string;
  canonicalInputHash: string;
  legacy: boolean;
}

export interface ProductRecord extends Omit<ProductAssessmentData, "status"> {
  id: string;
  status: ProductStatus;
  hsCode?: string;
  cnCode?: string;
  facility?: string;
  evidenceLookupCode?: string;
  supplierCountry?: string;
  supplyGap?: boolean;
  customsDeclarationNo?: string;
  poContractId?: string;
  billOfLadingNo?: string;
  containerNo?: string;
  shipmentId?: string | null;
  carbonAuthority?: CarbonAuthorityReference;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ProductListResult {
  items: ProductRecord[];
  pagination: Pagination;
}

export interface ProductListQuery {
  search?: string;
  status?: "draft" | "published" | "all";
  category?: string;
  page?: number;
  page_size?: number;
  sort_by?: "created_at" | "updated_at" | "name" | "sku" | "total_co2e";
  sort_order?: "asc" | "desc";
  // "summary" asks the API to skip the per-product logistics payload + latest-shipment
  // join, returning only the core catalog + carbon totals. Consumers that need
  // addresses/transport legs (report/export builders) must omit this.
  view?: "summary";
}

export type ProductSaveMode = "draft" | "publish";

export interface ProductMutationResult {
  id: string;
  status: ProductStatus;
  version: number;
  updatedAt?: string;
  shipmentId?: string | null;
  carbonResults?: CarbonAssessmentResult;
  carbonAuthority?: CarbonAuthorityReference;
}

export interface BulkValidationErrorItem {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface BulkValidationRowError {
  row: number;
  data: Record<string, unknown>;
  errors: BulkValidationErrorItem[];
}

export interface BulkValidationResult {
  isValid: boolean;
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  validRows: Record<string, unknown>[];
  invalidRows: BulkValidationRowError[];
  warnings: BulkValidationErrorItem[];
}

export interface BulkImportError {
  row: number;
  code: string;
  message: string;
}

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors: BulkImportError[];
  ids: string[];
}

export interface OperationalJobReceipt {
  job_id: string;
  status: string;
}

export interface OperationalJobStatus {
  status: string;
  result?: unknown;
  last_error?: string | null;
}

export type ProductBatchStatus = "draft" | "published" | "archived";

export interface ProductBatchItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  productType: string;
  quantity: number;
  weightKg: number;
  co2PerUnit: number;
}

export interface ProductBatchSummary {
  id: string;
  name: string;
  description: string;
  status: ProductBatchStatus;
  originAddress?: AddressInput;
  destinationAddress?: AddressInput;
  destinationMarket: string;
  transportModes: string[];
  shipmentId: string | null;
  totalProducts: number;
  totalQuantity: number;
  totalWeight: number;
  totalCO2: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductBatchDetail extends ProductBatchSummary {
  items: ProductBatchItem[];
}

export interface ProductBatchListResult {
  items: ProductBatchSummary[];
  pagination: Pagination;
}

export interface ProductBatchListQuery {
  search?: string;
  status?: ProductBatchStatus | "all";
  page?: number;
  page_size?: number;
}

export interface CreateBatchPayload {
  name: string;
  description?: string;
  originAddress?: Partial<AddressInput>;
  destinationAddress?: Partial<AddressInput>;
  destinationMarket?: string;
  transportModes?: string[];
}

export interface UpdateBatchPayload {
  name?: string;
  description?: string;
  originAddress?: Partial<AddressInput>;
  destinationAddress?: Partial<AddressInput>;
  destinationMarket?: string;
  transportModes?: string[];
}

export interface AddBatchItemPayload {
  product_id: string;
  quantity: number;
  weight_kg?: number;
  co2_per_unit?: number;
}

export interface UpdateBatchItemPayload {
  quantity?: number;
  weight_kg?: number;
  co2_per_unit?: number;
}

export interface PublishBatchResult {
  id: string;
  status: ProductBatchStatus;
  shipmentId: string | null;
  shipmentCreationSkipped?: boolean;
  skipReason?: string;
  message?: string;
  updatedAt?: string;
  publishedAt?: string;
}
