
import { MATERIAL_CERTIFICATION_OPTIONS } from "@/lib/materialCertificationDefinitions";
import type {
  CarbonDataQualityBreakdown,
  CarbonFactorSummaryItem,
  CarbonRange
} from "@/lib/carbon/types";


export interface MaterialInput {
  id: string;
  materialType: string;
  percentage: number;
  source: "domestic" | "imported" | "unknown";
  certifications: string[];
}

export interface AccessoryInput {
  id: string;
  name: string;
  type: string;
  weight?: number;
}

export interface EnergySourceInput {
  id: string;
  source: string;
  percentage: number;
}

export interface TransportLegNodeRef {
  type: "origin_address" | "destination_address" | "hub";
  hubId?: string;
}

export interface TransportLeg {
  id: string;
  mode: "road" | "sea" | "air" | "rail";
  estimatedDistance?: number;
  emissionFactor?: number;
  co2Kg?: number;
  co2PerTonKg?: number;
  allocatedCo2Kg?: number;
  routeResolved?: boolean;
  fromNode?: TransportLegNodeRef;
  toNode?: TransportLegNodeRef;
  autoSuggested?: boolean;
  geometry?: Array<[number, number]>;
  distanceSource?: "road_route" | "air_gc" | "sea_graph" | "rail_graph" | "manual";
  distanceStatus?: "resolved" | "pending" | "estimated" | "manual";
  segmentKind?: "feeder" | "line_haul" | "transfer";
}

export interface AddressInput {
  aptSuite?: string;
  streetNumber: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  stateRegion: string;
  country: string;
  postalCode: string;

  lat?: number;
  lng?: number;
}

export interface ProductAssessmentData {

  productCode: string;
  productName: string;
  productType: string;
  weightPerUnit: number;
  quantity: number;


  materials: MaterialInput[];
  accessories: AccessoryInput[];


  productionProcesses: string[];
  energySources: EnergySourceInput[];
  manufacturingLocation: string;
  wasteRecovery: string;


  destinationMarket: string;
  originAddress: AddressInput;
  destinationAddress: AddressInput;
  transportLegs: TransportLeg[];
  estimatedTotalDistance: number;


  carbonResults?: CarbonAssessmentResult;


  status: "draft" | "published";
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductAssessmentSessionDraft {
  currentStep: number;
  data: ProductAssessmentData;
  updatedAt: string;
}

export interface CarbonBreakdown {
  materials: number;
  production: number;
  energy: number;
  transport: number;
  packaging?: number;
  total: number;
}

export interface CarbonAssessmentResult {
  perProduct: CarbonBreakdown;
  totalBatch: CarbonBreakdown;
  confidenceLevel: "high" | "medium" | "low";
  confidenceScore?: number;
  proxyUsed: boolean;
  proxyNotes: string[];
  scope1: number | null;
  scope2: number | null;
  scope3: number | null;
  co2eRange?: CarbonRange;
  methodologyVersion?: string;
  assumptionsUsed?: string[];
  factorSourceSummary?: CarbonFactorSummaryItem[];
  dataQualityBreakdown?: CarbonDataQualityBreakdown;
}

export interface MarketComplianceDocumentSummary {
  marketCode: string;
  marketName: string;
  addedDocumentNames: string[];
  requiredDocumentNames: string[];
  missingRequiredDocumentNames: string[];
}

export interface DraftVersion {
  id: string;
  version: number;
  data: ProductAssessmentData;
  timestamp: string;
  note?: string;
}


export const PRODUCT_TYPES = [
{ value: "tshirt", label: "Áo thun" },
{ value: "polo", label: "Áo polo" },
{ value: "shirt", label: "Áo sơ mi" },
{ value: "pants", label: "Quần dài" },
{ value: "shorts", label: "Quần short" },
{ value: "dress", label: "Váy/Đầm" },
{ value: "jacket", label: "Áo khoác" },
{ value: "sweater", label: "Áo len" },
{ value: "shoes", label: "Giày" },
{ value: "sandals", label: "Dép/Sandal" },
{ value: "bag", label: "Túi xách" },
{ value: "accessories", label: "Phụ kiện" },
{ value: "other", label: "Khác" }];


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
{ value: "blend", label: "Vải pha", co2Factor: 6.0 }];


export const ACCESSORY_TYPES = [
{ value: "button", label: "Nút" },
{ value: "zipper", label: "Khóa kéo" },
{ value: "thread", label: "Chỉ may" },
{ value: "label", label: "Nhãn mác" },
{ value: "elastic", label: "Thun co giãn" },
{ value: "lining", label: "Vải lót" },
{ value: "padding", label: "Đệm/Mút" },
{ value: "other", label: "Khác" }];


export const PRODUCTION_PROCESSES = [
{ value: "knitting", label: "Dệt kim", co2Factor: 1.2 },
{ value: "weaving", label: "Dệt thoi", co2Factor: 1.5 },
{ value: "cutting_sewing", label: "Cắt may", co2Factor: 0.8 },
{ value: "dyeing", label: "Nhuộm", co2Factor: 2.5 },
{ value: "printing", label: "In", co2Factor: 1.8 },
{ value: "finishing", label: "Hoàn tất", co2Factor: 0.5 }];


export const ENERGY_SOURCES = [
{ value: "grid", label: "Điện lưới", co2Factor: 1.0 },
{ value: "solar", label: "Điện mặt trời", co2Factor: 0.05 },
{ value: "wind", label: "Điện gió", co2Factor: 0.03 },
{ value: "coal", label: "Than đá", co2Factor: 2.2 },
{ value: "gas", label: "Khí đốt", co2Factor: 0.5 },
{ value: "mixed", label: "Hỗn hợp", co2Factor: 0.7 }];


export const DESTINATION_MARKETS = [
{ value: "vietnam", label: "Việt Nam", distance: 500 },
{ value: "usa", label: "Hoa Kỳ", distance: 14000 },
{ value: "korea", label: "Hàn Quốc", distance: 3200 },
{ value: "japan", label: "Nhật Bản", distance: 3500 },
{ value: "eu", label: "Châu Âu", distance: 10000 },
{ value: "china", label: "Trung Quốc", distance: 2500 },
{ value: "other", label: "Khác", distance: 5000 }];


export const TRANSPORT_MODES = [
{ value: "road", label: "Đường bộ", co2Factor: 0.089 },
{ value: "sea", label: "Đường biển", co2Factor: 0.016 },
{ value: "air", label: "Hàng không", co2Factor: 0.602 },
{ value: "rail", label: "Đường sắt", co2Factor: 0.028 }];


export const CERTIFICATIONS = MATERIAL_CERTIFICATION_OPTIONS;


export const MATERIAL_SOURCES = [
{ value: "domestic", label: "Trong nước" },
{ value: "imported", label: "Nhập khẩu" },
{ value: "unknown", label: "Không xác định" }];
