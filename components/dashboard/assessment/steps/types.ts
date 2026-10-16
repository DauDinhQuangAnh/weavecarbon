import { MATERIAL_CERTIFICATION_OPTIONS } from "@/lib/materialCertificationDefinitions";
import type { ProductCategory } from "@/lib/carbon/types";
import type { EvidenceDocument } from "@/hooks/useEvidenceUpload";

// Re-export domain types from canonical domain locations
export type { ProductCategory, EvidenceDocument };
export type {
  MaterialInput,
  AccessoryInput,
  EnergySourceInput,
  AddressInput,
  ProductAssessmentData,
  ProductAssessmentSessionDraft,
  CarbonBreakdown,
  CarbonAssessmentResult,
  MarketComplianceDocumentSummary,
  DraftVersion,
} from "@/types/domain/product";
export type {
  TransportLegNodeRef,
  TransportLeg,
} from "@/types/domain/transport";

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "textile", label: "Dệt may / May mặc" },
];

export const PRODUCT_TYPES: {
  value: string;
  label: string;
  categories: ProductCategory[];
}[] = [
  // Dệt may / da giày
  { value: "tshirt", label: "Áo thun", categories: ["textile"] },
  { value: "polo", label: "Áo polo", categories: ["textile"] },
  { value: "shirt", label: "Áo sơ mi", categories: ["textile"] },
  { value: "pants", label: "Quần dài", categories: ["textile"] },
  { value: "shorts", label: "Quần short", categories: ["textile"] },
  { value: "dress", label: "Váy/Đầm", categories: ["textile"] },
  { value: "jacket", label: "Áo khoác", categories: ["textile"] },
  { value: "sweater", label: "Áo len", categories: ["textile"] },
  { value: "shoes", label: "Giày", categories: ["textile"] },
  { value: "sandals", label: "Dép/Sandal", categories: ["textile"] },
  { value: "bag", label: "Túi xách", categories: ["textile"] },
  { value: "accessories", label: "Phụ kiện", categories: ["textile"] },
  { value: "other", label: "Khác", categories: ["textile"] },
];

export const MATERIAL_TYPES = [
  { value: "cotton", label: "Cotton", co2Factor: 8.0 },
  { value: "organic_cotton", label: "Cotton hữu cơ", co2Factor: 4.5 },
  { value: "polyester", label: "Polyester", co2Factor: 5.5 },
  { value: "recycled_polyester", label: "Polyester tái chế", co2Factor: 2.5 },
  { value: "wool", label: "Len", co2Factor: 10.1 },
  { value: "silk", label: "Lụa", co2Factor: 7.5 },
  { value: "linen", label: "Lanh", co2Factor: 5.2 },
  { value: "nylon", label: "Nylon", co2Factor: 6.8 },
  { value: "bamboo", label: "Tre/Bamboo", co2Factor: 3.8 },
  { value: "hemp", label: "Gai dầu", co2Factor: 2.9 },
  { value: "viscose", label: "Viscose", co2Factor: 4.2 },
  { value: "tencel", label: "Tencel", co2Factor: 3.5 },
  { value: "blend", label: "Vải pha", co2Factor: 6.0 },
];

export const ACCESSORY_TYPES: {
  value: string;
  label: string;
  categories: ProductCategory[];
}[] = [
  // Dệt may
  { value: "button", label: "Nút", categories: ["textile"] },
  { value: "zipper", label: "Khóa kéo", categories: ["textile"] },
  { value: "thread", label: "Chỉ may", categories: ["textile"] },
  { value: "label", label: "Nhãn mác", categories: ["textile"] },
  { value: "elastic", label: "Thun co giãn", categories: ["textile"] },
  { value: "lining", label: "Vải lót", categories: ["textile"] },
  { value: "padding", label: "Đệm/Mút", categories: ["textile"] },
  { value: "other", label: "Khác", categories: ["textile"] },
];

export const PRODUCTION_PROCESSES: {
  value: string;
  label: string;
  co2Factor: number;
  categories: ProductCategory[];
}[] = [
  { value: "knitting", label: "Dệt kim", co2Factor: 1.2, categories: ["textile"] },
  { value: "weaving", label: "Dệt thoi", co2Factor: 1.5, categories: ["textile"] },
  { value: "cutting_sewing", label: "Cắt may", co2Factor: 0.8, categories: ["textile"] },
  { value: "dyeing", label: "Nhuộm", co2Factor: 2.5, categories: ["textile"] },
  { value: "printing", label: "In", co2Factor: 1.8, categories: ["textile"] },
  { value: "finishing", label: "Hoàn tất", co2Factor: 0.5, categories: ["textile"] },
];

export const ENERGY_SOURCES = [
  { value: "grid", label: "Điện lưới", co2Factor: 0.6592 },
  { value: "solar", label: "Điện mặt trời", co2Factor: 0.05 },
  { value: "wind", label: "Điện gió", co2Factor: 0.03 },
  { value: "coal", label: "Than đá", co2Factor: 2.2 },
  { value: "gas", label: "Khí đốt", co2Factor: 0.5 },
  { value: "mixed", label: "Hỗn hợp", co2Factor: 0.7 },
];

export const DESTINATION_MARKETS = [
  { value: "vietnam", label: "Việt Nam", distance: 500 },
  { value: "usa", label: "Hoa Kỳ", distance: 14000 },
  { value: "korea", label: "Hàn Quốc", distance: 3200 },
  { value: "japan", label: "Nhật Bản", distance: 3500 },
  { value: "eu", label: "Châu Âu", distance: 10000 },
  { value: "china", label: "Trung Quốc", distance: 2500 },
  { value: "asean", label: "ASEAN", distance: 2000 },
  { value: "australia", label: "Australia / Oceania", distance: 6500 },
  { value: "other", label: "Khác", distance: 5000 },
];

export const TRANSPORT_MODES = [
  { value: "road", label: "Đường bộ", co2Factor: 0.12226 },
  { value: "sea", label: "Đường biển", co2Factor: 0.01612 },
  { value: "air", label: "Hàng không", co2Factor: 0.89939 },
  { value: "rail", label: "Đường sắt", co2Factor: 0.02779 },
];

export const CERTIFICATIONS = MATERIAL_CERTIFICATION_OPTIONS;

export const MATERIAL_SOURCES = [
  { value: "domestic", label: "Trong nước" },
  { value: "imported", label: "Nhập khẩu" },
  { value: "unknown", label: "Không xác định" },
];
