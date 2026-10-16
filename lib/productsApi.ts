/**
 * Products API Facade
 * Provides unified interface and backward compatibility by re-exporting
 * from decomposed domain modules in lib/products/.
 *
 * Architecture:
 * - lib/products/types.ts: Domain and API data contracts
 * - lib/products/productsAuthority.ts: Calculation snapshots and authority reference
 * - lib/products/productsQueries.ts: Read operations, search, pagination, and data normalization
 * - lib/products/productsMutations.ts: Create, update, delete, batching, and bulk operations
 */

export * from "./products/types";
export * from "./products/productsAuthority";
export {
  isValidProductId,
  isValidBatchId,
  isPublishedProductStatus,
  normalizeProductFromUnknown,
  fetchProducts,
  fetchAllProducts,
  fetchProductById,
  listProductBatches,
  getProductBatchById,
} from "./products/productsQueries";
export {
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  validateProductsBulkImport,
  importProductsBulkRows,
  createProductBatch,
  updateProductBatch,
  deleteProductBatch,
  addProductToBatch,
  updateProductBatchItem,
  removeProductBatchItem,
  publishProductBatch,
  formatApiErrorMessage,
  getApiErrorCode,
} from "./products/productsMutations";
