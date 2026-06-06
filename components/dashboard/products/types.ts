

export interface BulkProductRow {

  sourceRow?: number;


  sku: string;
  productName: string;
  productType: string;
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
  quantity: number;
  weightPerUnit: number;


  primaryMaterial: string;
  primaryMaterialPercentage: number;
  secondaryMaterial?: string;
  secondaryMaterialPercentage?: number;
  accessories?: string;
  accessoriesWeightGram?: string;
  certifications?: string;
  materialSource: "domestic" | "imported" | "unknown";


  processes: string[];
  energySource: "grid" | "solar" | "coal" | "mixed";


  marketType: "domestic" | "export";
  exportCountry?: string;
  exportComplianceDocuments?: string;
  transportMode?: "road" | "sea" | "air" | "rail" | "multimodal";
  manufacturingLocation?: string;
  wasteRecovery?: string;
  transportOrigin?: string;
  transportOriginCity?: string;
  transportOriginStateRegion?: string;
  transportOriginCountry?: string;
  transportDestination?: string;
  transportDestinationCity?: string;
  transportDestinationStateRegion?: string;
  transportDestinationCountry?: string;
  transportDistanceKm?: number;


  calculatedCO2?: number;
  scope?: "scope1" | "scope1_2" | "scope1_2_3";
  confidenceLevel?: "high" | "medium" | "low";
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  validRows: BulkProductRow[];
  invalidRows: {
    row: number;
    data: Partial<BulkProductRow>;
    errors: ValidationError[];
  }[];
  warnings: ValidationError[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
}

export interface BulkUploadStep {
  id: "upload" | "validate" | "preview" | "processing" | "complete";
  label: string;
  description: string;
}

export const BULK_UPLOAD_STEPS: BulkUploadStep[] = [
{ id: "upload", label: "Tải file", description: "Chọn file Excel hoặc CSV" },
{ id: "validate", label: "Kiểm tra", description: "Xác thực dữ liệu" },
{ id: "preview", label: "Xem trước", description: "Kiểm tra trước khi lưu" },
{ id: "processing", label: "Xử lý", description: "Tính toán carbon" },
{ id: "complete", label: "Hoàn tất", description: "Lưu sản phẩm" }];


export const PRODUCT_TYPES = [
{ value: "tshirt", label: "Áo thun" },
{ value: "pants", label: "Quần" },
{ value: "dress", label: "Váy/Đầm" },
{ value: "jacket", label: "Áo khoác" },
{ value: "shoes", label: "Giày" },
{ value: "bag", label: "Túi" },
{ value: "accessories", label: "Phụ kiện" },
{ value: "other", label: "Khác" }];


export const MATERIAL_TYPES = [
{ value: "cotton", label: "Cotton" },
{ value: "polyester", label: "Polyester" },
{ value: "nylon", label: "Nylon" },
{ value: "wool", label: "Len" },
{ value: "silk", label: "Lụa" },
{ value: "linen", label: "Linen" },
{ value: "recycled_polyester", label: "Polyester tái chế" },
{ value: "organic_cotton", label: "Cotton hữu cơ" },
{ value: "bamboo", label: "Bamboo" },
{ value: "hemp", label: "Hemp" },
{ value: "blend", label: "Pha trộn" }];


export const PROCESS_TYPES = [
{ value: "knitting", label: "Dệt kim" },
{ value: "weaving", label: "Dệt thoi" },
{ value: "cutting", label: "Cắt may" },
{ value: "dyeing", label: "Nhuộm" },
{ value: "printing", label: "In" },
{ value: "finishing", label: "Hoàn tất" }];


export const ENERGY_SOURCES = [
{ value: "grid", label: "Điện lưới" },
{ value: "solar", label: "Điện mặt trời" },
{ value: "coal", label: "Than đá" },
{ value: "mixed", label: "Hỗn hợp" }];


export const TRANSPORT_MODES = [
{ value: "road", label: "Đường bộ" },
{ value: "sea", label: "Đường biển" },
{ value: "air", label: "Đường hàng không" },
{ value: "rail", label: "Đường sắt" },
{ value: "multimodal", label: "Đa phương thức" }];


export const EXPORT_COUNTRIES = [
{ value: "eu", label: "EU (Châu Âu)" },
{ value: "us", label: "Mỹ" },
{ value: "jp", label: "Nhật Bản" },
{ value: "kr", label: "Hàn Quốc" },
{ value: "other", label: "Khác" }];
