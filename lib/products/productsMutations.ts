/**
 * Product Mutations Service
 * Handles creating, updating, deleting products, status transitions, bulk imports, and product batches.
 */
import {
  api,
  invalidateApiResponseCache,
  isApiError,
  type ApiError,
} from "@/lib/apiClient";
import type {
  ProductAssessmentData,
} from "@/types/domain/product";
import type {
  AddBatchItemPayload,
  BulkImportResult,
  BulkValidationErrorItem,
  BulkValidationResult,
  CreateBatchPayload,
  OperationalJobReceipt,
  OperationalJobStatus,
  ProductBatchDetail,
  ProductMutationResult,
  ProductSaveMode,
  ProductStatus,
  PublishBatchResult,
  UpdateBatchItemPayload,
  UpdateBatchPayload,
} from "./types";
import { normalizeCarbonAuthority } from "./productsAuthority";
import {
  inflightProductListRequests,
  isObject,
  asString,
  asNumber,
  toProductStatus,
  normalizeCarbonResults,
  resolvePublishedStatusForApi,
  writePublishStatusApiMode,
  asArray,
  getProductBatchById,
  normalizeBatchSummary,
  normalizeBatchDetail,
  toBatchStatus
} from "./productsQueries";

const invalidateProductCaches = (reason: string) => {
  inflightProductListRequests.clear();
  invalidateApiResponseCache(reason);
};

const normalizeMutationPayload = (payload: unknown): ProductMutationResult => {
  if (!isObject(payload)) {
    throw new Error("Invalid product mutation response from server.");
  }

  const id = asString(payload.id);
  if (!id) {
    throw new Error("Product id was not returned by server.");
  }

  const rawCarbonResults = payload.carbonResults ?? payload.carbon_results;
  const carbonAuthority = normalizeCarbonAuthority(
    payload.carbonAuthority ?? payload.carbon_authority
  );

  return {
    id,
    status: toProductStatus(payload.status),
    version: Math.max(1, asNumber(payload.version, 1)),
    shipmentId: (() => {
      const shipmentId = asString(payload.shipmentId ?? payload.shipment_id);
      return shipmentId || null;
    })(),
    updatedAt: payload.updatedAt ?
    asString(payload.updatedAt) :
    payload.updated_at ?
    asString(payload.updated_at) :
    undefined,
    ...(isObject(rawCarbonResults)
      ? { carbonResults: normalizeCarbonResults(rawCarbonResults, payload, 1) }
      : {}),
    ...(carbonAuthority ? { carbonAuthority } : {})
  };
};

const stripTransportLegGeometry = (
  leg: ProductAssessmentData["transportLegs"][number]
) => {
  const sanitizedLeg = { ...leg };
  delete sanitizedLeg.geometry;
  return sanitizedLeg;
};

const buildProductRequestBody = (
product: ProductAssessmentData,
saveMode?: ProductSaveMode) =>
{
  const payload: Record<string, unknown> = {
    ...product,
    transportLegs: (product.transportLegs || []).map(stripTransportLegGeometry)
  };

  if (saveMode) {
    payload.save_mode = saveMode;
  }

  return payload;
};

export const createProduct = async (
product: ProductAssessmentData,
saveMode: ProductSaveMode)
: Promise<ProductMutationResult> => {
  const payload = await api.post<unknown>(
    "/products",
    buildProductRequestBody(product, saveMode)
  );
  invalidateProductCaches("product-created");
  return normalizeMutationPayload(payload);
};

export const updateProduct = async (
productId: string,
product: ProductAssessmentData)
: Promise<ProductMutationResult> => {
  const payload = await api.put<unknown>(
    `/products/${productId}`,
    buildProductRequestBody(product)
  );
  invalidateProductCaches("product-updated");
  return normalizeMutationPayload(payload);
};

export const updateProductStatus = async (
productId: string,
status: ProductStatus)
: Promise<ProductMutationResult> => {
  const statusForApi =
  status === "published" ? resolvePublishedStatusForApi() : status;

  const payload = await api.patch<unknown>(`/products/${productId}/status`, {
    status: statusForApi
  });
  if (status === "published") {
    writePublishStatusApiMode("published");
  }
  invalidateProductCaches("product-status-updated");
  return normalizeMutationPayload(payload);
};

export const deleteProduct = async (productId: string) => {
  await api.delete<unknown>(`/products/${productId}`);
  invalidateProductCaches("product-deleted");
};


const normalizeValidationErrors = (
errors: unknown,
row: number,
severity: "error" | "warning")
: BulkValidationErrorItem[] => {
  if (Array.isArray(errors)) {
    return errors.map((error, index) => {
      if (isObject(error)) {
        return {
          row: asNumber(error.row, row),
          field: asString(error.field, `field_${index + 1}`),
          message: asString(error.message, "Invalid value"),
          severity:
          asString(error.severity).toLowerCase() === "warning" ? "warning" : severity
        };
      }

      return {
        row,
        field: `field_${index + 1}`,
        message: asString(error, "Invalid value"),
        severity
      };
    });
  }

  if (typeof errors === "string") {
    return [
    {
      row,
      field: "general",
      message: errors,
      severity
    }];

  }

  return [];
};

const normalizeBulkValidationPayload = (payload: unknown): BulkValidationResult => {
  if (!isObject(payload)) {
    return {
      isValid: false,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
      validRows: [],
      invalidRows: [],
      warnings: []
    };
  }

  const invalidRows = asArray(payload.invalidRows ?? payload.invalid_rows).
  filter(isObject).
  map((rowData, index) => {
    const row = asNumber(rowData.row, index + 1);
    return {
      row,
      data: isObject(rowData.data) ? rowData.data : {},
      errors: normalizeValidationErrors(rowData.errors, row, "error")
    };
  });

  const warnings = asArray(payload.warnings).
  flatMap((warning, index) => {
    if (isObject(warning)) {
      return [
      {
        row: asNumber(warning.row, index + 1),
        field: asString(warning.field, "general"),
        message: asString(warning.message),
        severity: "warning" as const
      }];

    }
    return [
    {
      row: index + 1,
      field: "general",
      message: asString(warning),
      severity: "warning" as const
    }];

  }).
  filter((item) => item.message.length > 0);

  const validRows = asArray(payload.validRows ?? payload.valid_rows).filter(isObject);

  return {
    isValid: Boolean(payload.isValid ?? payload.is_valid ?? invalidRows.length === 0),
    totalRows: asNumber(payload.totalRows ?? payload.total_rows, validRows.length + invalidRows.length),
    validCount: asNumber(payload.validCount ?? payload.valid_count, validRows.length),
    errorCount: asNumber(payload.errorCount ?? payload.error_count, invalidRows.length),
    warningCount: asNumber(payload.warningCount ?? payload.warning_count, warnings.length),
    validRows,
    invalidRows,
    warnings
  };
};

const normalizeBulkImportPayload = (payload: unknown): BulkImportResult => {
  if (!isObject(payload)) {
    return {
      imported: 0,
      failed: 0,
      errors: [],
      ids: []
    };
  }

  return {
    imported: Math.max(0, asNumber(payload.imported)),
    failed: Math.max(0, asNumber(payload.failed)),
    errors: asArray(payload.errors).
    filter(isObject).
    map((error, index) => ({
      row: asNumber(error.row, index + 1),
      code: asString(error.code, "IMPORT_ERROR"),
      message: asString(error.message, "Import failed")
    })),
    ids: asArray(payload.ids).map((id) => asString(id)).filter(Boolean)
  };
};

export const validateProductsBulkImport = async (
rows: Record<string, unknown>[])
: Promise<BulkValidationResult> => {
  const payload = await api.post<unknown>("/products/bulk-import/validate", {
    rows
  });
  return normalizeBulkValidationPayload(payload);
};

export const importProductsBulkRows = async (
rows: Record<string, unknown>[],
saveMode: ProductSaveMode = "draft")
: Promise<BulkImportResult> => {
  const payload = await api.post<unknown>("/products/bulk-import", {
    rows,
    save_mode: saveMode
  });
  let completedPayload = payload;
  if (isObject(payload) && typeof payload.job_id === "string") {
    const receipt = payload as unknown as OperationalJobReceipt;
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const job = await api.get<OperationalJobStatus>(
        `/operations/jobs/${encodeURIComponent(receipt.job_id)}`,
        { disableResponseCache: true }
      );
      if (job.status === "completed") {
        completedPayload = job.result;
        break;
      }
      if (job.status === "dead") {
        throw new Error(job.last_error || "Bulk import failed after all retry attempts.");
      }
    }
    if (completedPayload === payload) {
      throw new Error("Bulk import is still processing. Please check again shortly.");
    }
  }
  invalidateProductCaches("products-bulk-imported");
  return normalizeBulkImportPayload(completedPayload);
};


export const createProductBatch = async (
input: CreateBatchPayload)
: Promise<ProductBatchDetail> => {
  const camelPayload = {
    name: input.name,
    description: input.description,
    originAddress: input.originAddress,
    destinationAddress: input.destinationAddress,
    destinationMarket: input.destinationMarket,
    transportModes: input.transportModes
  };
  const snakePayload = {
    batch_name: input.name,
    description: input.description,
    origin_address: input.originAddress,
    destination_address: input.destinationAddress,
    destination_market: input.destinationMarket,
    transport_modes: input.transportModes
  };

  const tryCreate = async (payload: Record<string, unknown>) =>
  api.post<unknown>("/product-batches", payload);

  let payload: unknown;
  try {
    payload = await tryCreate(camelPayload);
  } catch (error) {
    const shouldRetryWithSnakeCase =
    isApiError(error) && error.code === "VALIDATION_ERROR";
    if (!shouldRetryWithSnakeCase) {
      throw error;
    }
    payload = await tryCreate(snakePayload);
  }

  invalidateProductCaches("batch-created");
  if (isObject(payload) && typeof payload.id === "string") {
    try {
      return await getProductBatchById(payload.id);
    } catch {
      const summary = normalizeBatchSummary(payload);
      if (summary) {
        return { ...summary, items: [] };
      }
    }
  }

  const detail = normalizeBatchDetail(payload);
  if (!detail) {
    throw new Error("Unable to create batch.");
  }

  return detail;
};

export const updateProductBatch = async (
batchId: string,
input: UpdateBatchPayload)
: Promise<ProductBatchDetail> => {
  const camelPayload = {
    name: input.name,
    description: input.description,
    originAddress: input.originAddress,
    destinationAddress: input.destinationAddress,
    destinationMarket: input.destinationMarket,
    transportModes: input.transportModes
  };
  const snakePayload = {
    batch_name: input.name,
    description: input.description,
    origin_address: input.originAddress,
    destination_address: input.destinationAddress,
    destination_market: input.destinationMarket,
    transport_modes: input.transportModes
  };

  try {
    await api.patch<unknown>(`/product-batches/${batchId}`, camelPayload);
  } catch (error) {
    const shouldRetryWithSnakeCase =
    isApiError(error) && error.code === "VALIDATION_ERROR";
    if (!shouldRetryWithSnakeCase) {
      throw error;
    }
    await api.patch<unknown>(`/product-batches/${batchId}`, snakePayload);
  }
  invalidateProductCaches("batch-updated");
  return getProductBatchById(batchId);
};

export const deleteProductBatch = async (batchId: string) => {
  await api.delete<unknown>(`/product-batches/${batchId}`);
  invalidateProductCaches("batch-deleted");
};

export const addProductToBatch = async (
batchId: string,
payload: AddBatchItemPayload) =>
{
  await api.post<unknown>(`/product-batches/${batchId}/items`, payload);
  invalidateProductCaches("batch-item-added");
};

export const updateProductBatchItem = async (
batchId: string,
productId: string,
payload: UpdateBatchItemPayload) =>
{
  await api.patch<unknown>(`/product-batches/${batchId}/items/${productId}`, payload);
  invalidateProductCaches("batch-item-updated");
};

export const removeProductBatchItem = async (
batchId: string,
productId: string) =>
{
  await api.delete<unknown>(`/product-batches/${batchId}/items/${productId}`);
  invalidateProductCaches("batch-item-removed");
};

export const publishProductBatch = async (
batchId: string)
: Promise<PublishBatchResult> => {
  const payload = await api.patch<unknown>(`/product-batches/${batchId}/publish`);
  invalidateProductCaches("batch-published");

  if (!isObject(payload)) {
    throw new Error("Invalid publish response from server.");
  }

  return {
    id: asString(payload.id, batchId),
    status: toBatchStatus(payload.status),
    shipmentId: asString(payload.shipmentId ?? payload.shipment_id) || null,
    shipmentCreationSkipped: Boolean(
      payload.shipmentCreationSkipped ?? payload.shipment_creation_skipped
    ),
    skipReason: asString(payload.skipReason ?? payload.skip_reason) || undefined,
    message: asString(payload.message) || undefined,
    updatedAt: payload.updatedAt ?
    asString(payload.updatedAt) :
    payload.updated_at ?
    asString(payload.updated_at) :
    undefined,
    publishedAt: payload.publishedAt ?
    asString(payload.publishedAt) :
    payload.published_at ?
    asString(payload.published_at) :
    undefined
  };
};


export const formatApiErrorMessage = (error: unknown, fallback: string) => {
  if (isApiError(error)) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
};

export const getApiErrorCode = (error: unknown) => {
  if (isApiError(error)) {
    return (error as ApiError).code;
  }
  return undefined;
};

