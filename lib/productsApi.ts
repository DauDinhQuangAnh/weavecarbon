import {
  api,
  invalidateApiResponseCache,
  isApiError,
  type ApiError } from
"@/lib/apiClient";
import type {
  AccessoryInput,
  AddressInput,
  CarbonAssessmentResult,
  EnergySourceInput,
  MaterialInput,
  ProductAssessmentData,
  ProductCategory,
  TransportLeg } from
"@/components/dashboard/assessment/steps/types";

export type ProductStatus = "draft" | "published";

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

const inflightProductListRequests = new Map<string, Promise<ProductListResult>>();

const invalidateProductCaches = (reason: string) => {
  inflightProductListRequests.clear();
  invalidateApiResponseCache(reason);
};
const PRODUCT_ID_REGEX =
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type PublishStatusApiMode = "unknown" | "published";
const PRODUCT_STATUS_API_MODE_STORAGE_KEY = "weavecarbon_products_status_api_mode";

const readPublishStatusApiMode = (): PublishStatusApiMode => {
  if (typeof window === "undefined") return "unknown";
  try {
    const mode = window.localStorage.getItem(PRODUCT_STATUS_API_MODE_STORAGE_KEY);
    if (mode === "published") {
      return mode;
    }
    if (mode === "active") {
      window.localStorage.removeItem(PRODUCT_STATUS_API_MODE_STORAGE_KEY);
    }
  } catch {

  }
  return "unknown";
};

void readPublishStatusApiMode();

const writePublishStatusApiMode = (mode: Exclude<PublishStatusApiMode, "unknown">) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRODUCT_STATUS_API_MODE_STORAGE_KEY, mode);
  } catch {

  }
};

export const isValidProductId = (productId: string) =>
PRODUCT_ID_REGEX.test(productId.trim());

export const isValidBatchId = (batchId: string) =>
batchId.trim().length > 0;

const emptyAddress: AddressInput = {
  aptSuite: "",
  streetNumber: "",
  street: "",
  ward: "",
  district: "",
  city: "",
  stateRegion: "",
  country: "",
  postalCode: ""
};

const isObject = (value: unknown): value is Record<string, unknown> =>
typeof value === "object" && value !== null;

const asString = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const asNonEmptyString = (value: unknown) => {
  const normalized = asString(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const asNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = toFiniteNumber(value);
  return parsed ?? null;
};

const asBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return fallback;
};

const asArray = <T = unknown,>(value: unknown): T[] =>
Array.isArray(value) ? value as T[] : [];

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const firstFiniteNumber = (...candidates: unknown[]): number | undefined => {
  for (const candidate of candidates) {
    const parsed = toFiniteNumber(candidate);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
};

const resolveMetricValue = (
primary?: number,
fallback?: number)
: number => {
  const primaryFinite = typeof primary === "number" && Number.isFinite(primary);
  const fallbackFinite = typeof fallback === "number" && Number.isFinite(fallback);

  if (primaryFinite && primary! > 0) return primary!;
  if (fallbackFinite && fallback! > 0) return fallback!;
  if (primaryFinite) return Math.max(0, primary!);
  if (fallbackFinite) return Math.max(0, fallback!);
  return 0;
};

const normalizeTransportLegNodeType = (value: unknown) => {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "origin_address" ||
    normalized === "destination_address" ||
    normalized === "hub"
  ) {
    return normalized;
  }
  return null;
};

const normalizeTransportLegNodeRef = (value: unknown) => {
  if (!isObject(value)) return undefined;

  const type = normalizeTransportLegNodeType(value.type ?? value.node_type ?? value.kind);
  if (!type) return undefined;

  const hubId = asNonEmptyString(value.hubId ?? value.hub_id ?? value.id);

  return {
    type,
    hubId: type === "hub" ? hubId || undefined : undefined
  } satisfies NonNullable<TransportLeg["fromNode"]>;
};

const isTransportLegGeometryCoordinate = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1]);

const normalizeTransportLegGeometry = (value: unknown) => {
  const coordinates = asArray(value).filter(isTransportLegGeometryCoordinate);
  return coordinates.length >= 2 ? coordinates : undefined;
};

const normalizeTransportLegDistanceSource = (value: unknown): TransportLeg["distanceSource"] => {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "road_route" ||
    normalized === "air_gc" ||
    normalized === "sea_graph" ||
    normalized === "rail_graph" ||
    normalized === "manual"
  ) {
    return normalized;
  }
  return undefined;
};

const normalizeTransportLegDistanceStatus = (value: unknown): TransportLeg["distanceStatus"] => {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "resolved" ||
    normalized === "pending" ||
    normalized === "estimated" ||
    normalized === "manual"
  ) {
    return normalized;
  }
  return undefined;
};

const normalizeTransportLegSegmentKind = (value: unknown): TransportLeg["segmentKind"] => {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "feeder" ||
    normalized === "line_haul" ||
    normalized === "transfer"
  ) {
    return normalized;
  }
  return undefined;
};

const DESTINATION_MARKET_ALIASES: Record<string, string> = {
  eu: "eu",
  europeanunion: "eu",
  europe: "eu",
  us: "usa",
  usa: "usa",
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  america: "usa",
  jp: "japan",
  japan: "japan",
  kr: "korea",
  korea: "korea",
  southkorea: "korea",
  republicofkorea: "korea",
  cn: "china",
  china: "china",
  vn: "vietnam",
  vietnam: "vietnam",
  domestic: "vietnam",
  noidiavietnam: "vietnam",
  other: "other"
};

const normalizeDestinationMarket = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const raw = String(value).trim();
    if (!raw) {
      return "";
    }

    const compactKey = raw.toLowerCase().replace(/[_\-\s]+/g, "");
    return DESTINATION_MARKET_ALIASES[compactKey] || raw.toLowerCase();
  }

  if (Array.isArray(value)) {
    const selected = value.find(
      (entry) =>
      isObject(entry) &&
      Boolean(
        entry.selected ??
        entry.isSelected ??
        entry.default ??
        entry.current ??
        entry.active ?? (
        typeof entry.status === "string" && entry.status.toLowerCase() === "selected")
      )
    );
    if (selected) {
      return normalizeDestinationMarket(selected);
    }

    const normalizedValues = value.
    map((entry) => normalizeDestinationMarket(entry)).
    filter((entry) => entry.length > 0);
    if (normalizedValues.length === 1) {
      return normalizedValues[0];
    }

    return "";
  }

  if (isObject(value)) {
    const explicitCode = normalizeDestinationMarket(
      value.selectedCode ??
      value.selected_code ??
      value.currentCode ??
      value.current_code ??
      value.defaultCode ??
      value.default_code ??
      value.marketCode ??
      value.market_code
    );
    if (explicitCode) {
      return explicitCode;
    }

    const explicitSelection = normalizeDestinationMarket(
      value.selected ??
      value.current ??
      value.default ??
      value.value ??
      value.choice
    );
    if (explicitSelection) {
      return explicitSelection;
    }

    const fromCode = normalizeDestinationMarket(
      value.code ??
      value.marketCode ??
      value.market_code ??
      value.value ??
      value.id
    );
    if (fromCode) {
      return fromCode;
    }

    const fromName = normalizeDestinationMarket(
      value.name ??
      value.label ??
      value.marketName ??
      value.market_name
    );
    if (fromName) {
      return fromName;
    }

    const fromOptions = normalizeDestinationMarket(
      value.options ??
      value.items ??
      value.list ??
      value.values ??
      value.markets ??
      value.destinationMarkets ??
      value.destination_markets
    );
    if (fromOptions) {
      return fromOptions;
    }
  }

  return "";
};

const toSafePage = (value: unknown, fallback = 1) => {
  const page = asNumber(value, fallback);
  if (!Number.isFinite(page)) return fallback;
  return Math.max(1, Math.trunc(page));
};

const toSafePageSize = (value: unknown, fallback = 20) => {
  const pageSize = asNumber(value, fallback);
  if (!Number.isFinite(pageSize)) return fallback;
  return Math.min(100, Math.max(1, Math.trunc(pageSize)));
};

const toIsoString = (value: unknown) => {
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return value;
  }
  return new Date().toISOString();
};

const normalizeProductStatusToken = (value: unknown) =>
asString(value).trim().toLowerCase();

export const isPublishedProductStatus = (value: unknown) => {
  const normalized = normalizeProductStatusToken(value);
  return (
    normalized === "published" ||
    normalized === "active" ||
    normalized === "publish"
  );
};

const toProductStatus = (value: unknown): ProductStatus => {
  const normalized = normalizeProductStatusToken(value);
  if (isPublishedProductStatus(normalized)) {
    return "published";
  }
  return "draft";
};

const toProductCategory = (value: unknown): ProductCategory => {
  void value; // single-industry product: always textile
  return "textile";
};

const normalizeAddress = (value: unknown): AddressInput => {
  if (!isObject(value)) {
    return { ...emptyAddress };
  }

  const latValue = value.lat ?? value.latitude;
  const lngValue = value.lng ?? value.longitude;

  const next: AddressInput = {
    aptSuite: asString(
      value.aptSuite ??
        value.apt_suite ??
        value.addressLine2 ??
        value.address_line_2 ??
        value.unitDetails ??
        value.unit_details ??
        value.apartment ??
        value.suite ??
        value.unit
    ),
    streetNumber: asString(value.streetNumber ?? value.street_number),
    street: asString(value.street ?? value.address),
    ward: asString(value.ward ?? value.commune),
    district: asString(value.district ?? value.county),
    city: asString(value.city ?? value.province ?? value.state ?? value.region),
    stateRegion: asString(
      value.stateRegion ??
      value.state_region ??
      value.state ??
      value.province ??
      value.region
    ),
    country: asString(value.country),
    postalCode: asString(
      value.postalCode ??
      value.postal_code ??
      value.zip ??
      value.zipcode
    )
  };

  if (latValue !== undefined && latValue !== null && latValue !== "") {
    next.lat = asNumber(latValue);
  }
  if (lngValue !== undefined && lngValue !== null && lngValue !== "") {
    next.lng = asNumber(lngValue);
  }

  return next;
};

const toCompactKey = (value: unknown) =>
asString(value).
trim().
toLowerCase().
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
replace(/[^a-z0-9]+/g, "");

const WASTE_RECOVERY_ALIASES: Record<string, "none" | "partial" | "full" | "circular"> = {
  none: "none",
  no: "none",
  khong: "none",
  norecovery: "none",
  partial: "partial",
  partly: "partial",
  motphan: "partial",
  full: "full",
  complete: "full",
  toanphan: "full",
  circular: "circular",
  circularity: "circular",
  closedloop: "circular",
  tuanhoan: "circular"
};

const normalizeWasteRecoveryValue = (value: unknown): string => {
  const raw = asString(value).trim();
  if (!raw) return "";

  const mapped = WASTE_RECOVERY_ALIASES[toCompactKey(raw)];
  if (mapped) return mapped;

  const percentMatch = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!percentMatch) return raw;

  const parsed = Number(percentMatch[0].replace(",", "."));
  if (!Number.isFinite(parsed)) return raw;
  if (parsed <= 0) return "none";
  if (parsed >= 80) return "full";
  return "partial";
};

const LEGACY_MATERIAL_TO_CATALOG_ID: Record<string, string> = {
  cotton: "cat-cotton-100",
  organiccotton: "cat-cotton-organic",
  recycledcotton: "cat-cotton-recycled",
  polyester: "cat-polyester-100",
  recycledpolyester: "cat-polyester-recycled",
  wool: "cat-wool-100",
  silk: "cat-silk-100",
  linen: "cat-linen-100",
  nylon: "cat-nylon-100",
  bamboo: "cat-bamboo",
  hemp: "cat-hemp",
  tencel: "cat-tencel",
  viscose: "cat-viscose",
  blend: "cat-blend-cotton-poly"
};

const resolveCatalogMaterialId = (value: unknown): string => {
  const raw = asString(value).trim();
  if (!raw) return "";

  if (raw.startsWith("cat-")) {
    return raw;
  }

  return LEGACY_MATERIAL_TO_CATALOG_ID[toCompactKey(raw)] || "";
};

const ACCESSORY_TYPE_ALIASES: Record<string, AccessoryInput["type"]> = {
  button: "button",
  nut: "button",
  zipper: "zipper",
  khoakeo: "zipper",
  thread: "thread",
  chimay: "thread",
  label: "label",
  nhanhmac: "label",
  elastic: "elastic",
  thun: "elastic",
  lining: "lining",
  vailot: "lining",
  padding: "padding",
  dem: "padding",
  mut: "padding",
  other: "other",
  khac: "other"
};

const resolveAccessoryType = (value: unknown): AccessoryInput["type"] => {
  const key = toCompactKey(value);
  if (!key) return "other";
  return ACCESSORY_TYPE_ALIASES[key] || "other";
};

const normalizeMaterials = (value: unknown): MaterialInput[] =>
asArray(value).
filter(isObject).
map((item, index) => {
  const rawMaterialType = asString(
    item.materialType ??
    item.material_type ??
    item.material ??
    item.materialCode ??
    item.material_code ??
    item.materialName ??
    item.material_name ??
    item.name
  ).trim();
  const catalogMaterialId =
  resolveCatalogMaterialId(item.catalogMaterialId ?? item.catalog_material_id) ||
  resolveCatalogMaterialId(rawMaterialType);

  const normalizedMaterialType = catalogMaterialId || rawMaterialType;

  return {
    id: asString(item.id, `material-${index + 1}`),
    materialType: normalizedMaterialType,
    percentage: asNumber(item.percentage),
    source: (() => {
      const source = asString(item.source).toLowerCase();
      if (source === "domestic" || source === "imported" || source === "unknown") {
        return source as MaterialInput["source"];
      }
      return "unknown" as MaterialInput["source"];
    })(),
    certifications: asArray(item.certifications).map((cert) => asString(cert)),
    ...(catalogMaterialId ? { catalogMaterialId } : {})
  };
}).
filter((item) => item.materialType.length > 0);

const normalizeAccessories = (value: unknown): AccessoryInput[] =>
asArray(value).
map((item, index) => {
  if (!isObject(item)) {
    const rawText = asString(item).trim();
    if (!rawText) {
      return {
        id: `accessory-${index + 1}`,
        name: "",
        type: "other" as AccessoryInput["type"],
        weight: undefined
      };
    }

    return {
      id: `accessory-${index + 1}`,
      name: rawText,
      type: resolveAccessoryType(rawText),
      weight: undefined
    };
  }

  const name = asString(
    item.name ??
    item.accessoryName ??
    item.accessory_name ??
    item.label ??
    item.description
  ).trim();
  const type = resolveAccessoryType(
    item.type ??
    item.accessoryType ??
    item.accessory_type ??
    item.category ??
    name
  );
  const weightValue = item.weight ?? item.weightGram ?? item.weight_gram;

  return {
    id: asString(item.id, `accessory-${index + 1}`),
    name: name || asString(item.type ?? item.accessoryType).trim(),
    type,
    weight:
    weightValue === undefined || weightValue === null ?
    undefined :
    asNumber(weightValue)
  };
}).
filter((item) => item.name.length > 0 || item.type.length > 0);

const PRODUCTION_PROCESS_ALIASES: Record<string, string> = {
  knitting: "knitting",
  detkim: "knitting",
  knit: "knitting",
  weaving: "weaving",
  detthoi: "weaving",
  weave: "weaving",
  cuttingsewing: "cutting_sewing",
  cutsew: "cutting_sewing",
  catmay: "cutting_sewing",
  sewing: "cutting_sewing",
  dyeing: "dyeing",
  dye: "dyeing",
  nhuom: "dyeing",
  printing: "printing",
  print: "printing",
  in: "printing",
  finishing: "finishing",
  finish: "finishing",
  hoantat: "finishing"
};

const ENERGY_SOURCE_ALIASES: Record<string, string> = {
  grid: "grid",
  dienluoi: "grid",
  electricitygrid: "grid",
  solar: "solar",
  dienmattroi: "solar",
  solarpower: "solar",
  wind: "wind",
  diengio: "wind",
  windpower: "wind",
  coal: "coal",
  thanda: "coal",
  gas: "gas",
  khidot: "gas",
  mixed: "mixed",
  honhop: "mixed"
};

const normalizeProductionProcesses = (value: unknown): string[] => {
  const normalized = asArray(value).
  map((item) => PRODUCTION_PROCESS_ALIASES[toCompactKey(item)]).
  filter((item): item is string => Boolean(item));

  return Array.from(new Set(normalized));
};

const TRANSPORT_MODE_ALIASES: Record<string, TransportLeg["mode"]> = {
  road: "road",
  truck: "road",
  trucklight: "road",
  truckheavy: "road",
  xetainhe: "road",
  xetainang: "road",
  sea: "sea",
  ship: "sea",
  ocean: "sea",
  taubien: "sea",
  air: "air",
  airplane: "air",
  aviation: "air",
  hangkhong: "air",
  rail: "rail",
  train: "rail",
  duongsat: "rail"
};

const normalizeEnergySources = (value: unknown): EnergySourceInput[] =>
asArray(value).
filter(isObject).
map((item, index) => {
  const source = ENERGY_SOURCE_ALIASES[
  toCompactKey(item.source ?? item.energySource ?? item.energy_source ?? item.type ?? item.name)];
  return {
    id: asString(item.id, `energy-${index + 1}`),
    source: source || "",
    percentage: asNumber(item.percentage ?? item.ratio ?? item.share ?? item.percent),
    recsSold: Boolean(item.recsSold ?? item.recs_sold)
  };
}).
filter((item) => item.source.length > 0);

const resolveTransportLegArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isObject(value)) {
    return [];
  }

  return asArray(
    value.legs ??
    value.transportLegs ??
    value.transport_legs ??
    value.routeLegs ??
    value.route_legs ??
    value.routes
  );
};

const normalizeTransportLegs = (value: unknown): TransportLeg[] =>
resolveTransportLegArray(value).
map((item, index) => {
  if (!isObject(item)) {
    const mode =
    TRANSPORT_MODE_ALIASES[toCompactKey(item)] ??
    "road";
    return {
      id: `leg-${index + 1}`,
      mode,
      estimatedDistance: undefined,
      routeResolved: mode === "road" ? false : undefined
    } as TransportLeg;
  }

  const mode =
  TRANSPORT_MODE_ALIASES[
  toCompactKey(
    item.mode ??
    item.transport_mode ??
    item.transportMode ??
    item.route_type ??
    item.routeType ??
    item.method ??
    item.type)
  ] ??
  "road";

  const estimatedDistanceRaw =
  item.estimatedDistance ??
  item.estimated_distance ??
  item.distanceKm ??
  item.distance_km ??
  item.distance ??
  item.km;
  const normalizedDistance =
  estimatedDistanceRaw === undefined || estimatedDistanceRaw === null ?
  undefined :
  asNumber(estimatedDistanceRaw);
  const emissionFactorRaw =
  item.emissionFactor ??
  item.emission_factor ??
  item.emission_factor_used ??
  item.co2Factor ??
  item.co2_factor ??
  item.factor;
  const normalizedEmissionFactor =
  emissionFactorRaw === undefined || emissionFactorRaw === null ?
  undefined :
  asNumber(emissionFactorRaw);
  const co2KgRaw =
  item.co2Kg ??
  item.co2_kg ??
  item.co2e ??
  item.co2 ??
  item.emission_kg;
  const normalizedCo2Kg =
  co2KgRaw === undefined || co2KgRaw === null ?
  undefined :
  asNumber(co2KgRaw);
  const normalizedRouteResolved =
  item.routeResolved ??
  item.route_resolved ??
  item.is_route_resolved ??
  item.isRouteResolved;
  const normalizedFromNode = normalizeTransportLegNodeRef(
    item.fromNode ??
    item.from_node ??
    item.originNode ??
    item.origin_node ??
    item.startNode ??
    item.start_node
  );
  const normalizedToNode = normalizeTransportLegNodeRef(
    item.toNode ??
    item.to_node ??
    item.destinationNode ??
    item.destination_node ??
    item.endNode ??
    item.end_node
  );
  const normalizedAutoSuggested =
    item.autoSuggested ??
    item.auto_suggested ??
    item.is_auto_suggested ??
    item.isAutoSuggested;
  const normalizedGeometry = normalizeTransportLegGeometry(
    item.geometry ??
    item.routeGeometry ??
    item.route_geometry ??
    item.coordinates
  );
  const normalizedDistanceSource = normalizeTransportLegDistanceSource(
    item.distanceSource ??
    item.distance_source ??
    item.routeDistanceSource ??
    item.route_distance_source
  );
  const normalizedDistanceStatus = normalizeTransportLegDistanceStatus(
    item.distanceStatus ??
    item.distance_status ??
    item.routeDistanceStatus ??
    item.route_distance_status
  );
  const normalizedSegmentKind = normalizeTransportLegSegmentKind(
    item.segmentKind ??
    item.segment_kind ??
    item.legKind ??
    item.leg_kind
  );

  return {
    id: asString(item.id ?? item.leg_id ?? item.legId, `leg-${index + 1}`),
    mode,
    estimatedDistance:
    normalizedDistance !== undefined && Number.isFinite(normalizedDistance) ?
    normalizedDistance :
    undefined,
    emissionFactor:
    normalizedEmissionFactor !== undefined && Number.isFinite(normalizedEmissionFactor) ?
    Math.max(0, normalizedEmissionFactor) :
    undefined,
    co2Kg:
    normalizedCo2Kg !== undefined && Number.isFinite(normalizedCo2Kg) ?
    Math.max(0, normalizedCo2Kg) :
    undefined,
    routeResolved:
    mode === "road" ?
    asBoolean(normalizedRouteResolved, false) :
    undefined,
    fromNode: normalizedFromNode,
    toNode: normalizedToNode,
    autoSuggested: asBoolean(normalizedAutoSuggested, false),
    geometry: normalizedGeometry,
    distanceSource: normalizedDistanceSource,
    distanceStatus: normalizedDistanceStatus,
    segmentKind: normalizedSegmentKind
  } as TransportLeg;
});

const normalizeCarbonResults = (
value: unknown,
fallbackSource?: Record<string, unknown>,
quantityFallback = 1)
: CarbonAssessmentResult | undefined => {
  const structured = isObject(value) ? value : null;
  const source = isObject(fallbackSource) ? fallbackSource : {};

  const perProductCandidate = structured ? structured.perProduct ?? structured.per_product : undefined;
  const totalBatchCandidate = structured ? structured.totalBatch ?? structured.total_batch : undefined;
  const perProductRaw: Record<string, unknown> = isObject(perProductCandidate) ?
  perProductCandidate :
  {};
  const totalBatchRaw: Record<string, unknown> = isObject(totalBatchCandidate) ?
  totalBatchCandidate :
  {};

  const sourceMaterials = firstFiniteNumber(
    source.materials_co2e,
    source.materialsCO2e,
    source.materials_co2,
    source.materialsCO2
  );
  const sourceProduction = firstFiniteNumber(
    source.production_co2e,
    source.productionCO2e,
    source.production_co2,
    source.productionCO2
  );
  const sourceEnergy = firstFiniteNumber(
    source.energy_co2e,
    source.energyCO2e,
    source.energy_co2,
    source.energyCO2
  );
  const sourceTransport = firstFiniteNumber(
    source.transport_co2e,
    source.transportCO2e,
    source.transport_co2,
    source.transportCO2
  );
  const sourcePackaging = firstFiniteNumber(
    source.packaging_co2e,
    source.packagingCO2e,
    source.packaging_co2,
    source.packagingCO2
  );
  const sourceTotal = firstFiniteNumber(
    source.total_co2e,
    source.totalCO2e,
    source.co2_per_unit,
    source.co2PerUnit,
    source.unit_co2e
  );
  const hasSourceMetrics =
  sourceMaterials !== undefined ||
  sourceProduction !== undefined ||
  sourceEnergy !== undefined ||
  sourceTransport !== undefined ||
  sourcePackaging !== undefined ||
  sourceTotal !== undefined;

  if (!structured && !hasSourceMetrics) {
    return undefined;
  }

  const perProductMaterials = resolveMetricValue(
    firstFiniteNumber(
      perProductRaw.materials,
      perProductRaw.materials_co2e,
      perProductRaw.materials_co2
    ),
    sourceMaterials
  );
  const perProductProduction = resolveMetricValue(
    firstFiniteNumber(
      perProductRaw.production,
      perProductRaw.production_co2e,
      perProductRaw.production_co2
    ),
    sourceProduction
  );
  const perProductEnergy = resolveMetricValue(
    firstFiniteNumber(
      perProductRaw.energy,
      perProductRaw.energy_co2e,
      perProductRaw.energy_co2
    ),
    sourceEnergy
  );
  const perProductTransport = resolveMetricValue(
    firstFiniteNumber(
      perProductRaw.transport,
      perProductRaw.transport_co2e,
      perProductRaw.transport_co2
    ),
    sourceTransport
  );
  const perProductPackaging = resolveMetricValue(
    firstFiniteNumber(
      perProductRaw.packaging,
      perProductRaw.packaging_co2e,
      perProductRaw.packaging_co2
    ),
    sourcePackaging
  );
  const inferredPerProductTotal =
  perProductMaterials +
  perProductProduction +
  perProductEnergy +
  perProductTransport +
  perProductPackaging;
  const perProductTotal = (() => {
    const explicitTotal = resolveMetricValue(
      firstFiniteNumber(
        perProductRaw.total,
        perProductRaw.total_co2e,
        perProductRaw.total_co2
      ),
      sourceTotal
    );
    return explicitTotal > 0 ? explicitTotal : inferredPerProductTotal;
  })();

  const safeQuantity =
  typeof quantityFallback === "number" && Number.isFinite(quantityFallback) && quantityFallback > 0 ?
  quantityFallback :
  1;

  const totalBatchMaterials = resolveMetricValue(
    firstFiniteNumber(totalBatchRaw.materials, totalBatchRaw.materials_co2e, totalBatchRaw.materials_co2),
    perProductMaterials * safeQuantity
  );
  const totalBatchProduction = resolveMetricValue(
    firstFiniteNumber(totalBatchRaw.production, totalBatchRaw.production_co2e, totalBatchRaw.production_co2),
    perProductProduction * safeQuantity
  );
  const totalBatchEnergy = resolveMetricValue(
    firstFiniteNumber(totalBatchRaw.energy, totalBatchRaw.energy_co2e, totalBatchRaw.energy_co2),
    perProductEnergy * safeQuantity
  );
  const totalBatchTransport = resolveMetricValue(
    firstFiniteNumber(totalBatchRaw.transport, totalBatchRaw.transport_co2e, totalBatchRaw.transport_co2),
    perProductTransport * safeQuantity
  );
  const totalBatchPackaging = resolveMetricValue(
    firstFiniteNumber(totalBatchRaw.packaging, totalBatchRaw.packaging_co2e, totalBatchRaw.packaging_co2),
    perProductPackaging * safeQuantity
  );
  const inferredTotalBatch =
  totalBatchMaterials +
  totalBatchProduction +
  totalBatchEnergy +
  totalBatchTransport +
  totalBatchPackaging;
  const totalBatchTotal = (() => {
    const explicitTotal = resolveMetricValue(
      firstFiniteNumber(totalBatchRaw.total, totalBatchRaw.total_co2e, totalBatchRaw.total_co2),
      perProductTotal * safeQuantity
    );
    return explicitTotal > 0 ? explicitTotal : inferredTotalBatch;
  })();

  const confidence = asString(
    structured?.confidenceLevel ??
    structured?.confidence_level ??
    source.confidenceLevel ??
    source.confidence_level
  ).toLowerCase();
  const confidenceLevel: CarbonAssessmentResult["confidenceLevel"] =
  confidence === "high" || confidence === "medium" || confidence === "low" ?
  confidence :
  "medium";
  const confidenceScoreFromPayload = firstFiniteNumber(
    structured?.confidenceScore,
    structured?.confidence_score,
    source.confidenceScore,
    source.confidence_score,
    source.dataConfidenceScore,
    source.data_confidence_score
  );
  const fallbackConfidenceScore =
    confidenceLevel === "high" ? 90 :
    confidenceLevel === "medium" ? 70 :
    50;
  const confidenceScore = (() => {
    const value =
      typeof confidenceScoreFromPayload === "number" && Number.isFinite(confidenceScoreFromPayload) ?
      confidenceScoreFromPayload :
      fallbackConfidenceScore;
    return Math.max(0, Math.min(100, value));
  })();

  return {
    perProduct: {
      materials: perProductMaterials,
      production: perProductProduction,
      energy: perProductEnergy,
      transport: perProductTransport,
      packaging: perProductPackaging,
      total: perProductTotal
    },
    totalBatch: {
      materials: totalBatchMaterials,
      production: totalBatchProduction,
      energy: totalBatchEnergy,
      transport: totalBatchTransport,
      packaging: totalBatchPackaging,
      total: totalBatchTotal
    },
    confidenceLevel,
    confidenceScore,
    proxyUsed: Boolean(
      structured?.proxyUsed ??
      structured?.proxy_used ??
      source.proxyUsed ??
      source.proxy_used
    ),
    proxyNotes: asArray(
      structured?.proxyNotes ??
      structured?.proxy_notes ??
      source.proxyNotes ??
      source.proxy_notes
    ).map((note) => asString(note)),
    scope1: asNullableNumber(structured?.scope1 ?? source.scope1),
    scope2: asNullableNumber(structured?.scope2 ?? source.scope2),
    scope3: asNullableNumber(structured?.scope3 ?? source.scope3),
    co2eRange: (() => {
      const raw =
        structured?.co2eRange ??
        structured?.co2e_range ??
        source.co2eRange ??
        source.co2e_range;
      if (!isObject(raw)) return undefined;
      const min = asNullableNumber(raw.min);
      const max = asNullableNumber(raw.max);
      if (typeof min === "number" && typeof max === "number") {
        return { min, max };
      }
      return undefined;
    })(),
    biogenicCarbon: (() => {
      const raw =
        structured?.biogenicCarbon ??
        structured?.biogenic_carbon ??
        source.biogenicCarbon ??
        source.biogenic_carbon;
      if (!isObject(raw)) return undefined;
      const removed = asNullableNumber(raw.removedKgCO2e ?? raw.removed_kg_co2e);
      if (typeof removed !== "number") return undefined;
      return { removedKgCO2e: removed, note: asString(raw.note) };
    })(),
    gwpBreakdown: (() => {
      const raw =
        structured?.gwpBreakdown ??
        structured?.gwp_breakdown ??
        source.gwpBreakdown ??
        source.gwp_breakdown;
      if (!isObject(raw)) return undefined;
      return {
        fossilKgCO2e: asNumber(raw.fossilKgCO2e ?? raw.fossil_kg_co2e),
        biogenicRemovedKgCO2e: asNumber(raw.biogenicRemovedKgCO2e ?? raw.biogenic_removed_kg_co2e),
        lulucKgCO2e: asNullableNumber(raw.lulucKgCO2e ?? raw.luluc_kg_co2e) ?? null,
        note: asString(raw.note)
      };
    })(),
    methodologyVersion: asNonEmptyString(
      structured?.methodologyVersion ??
      structured?.methodology_version ??
      source.methodologyVersion ??
      source.methodology_version
    ) ?? undefined,
    assumptionsUsed: asArray(
      structured?.assumptionsUsed ??
      structured?.assumptions_used ??
      source.assumptionsUsed ??
      source.assumptions_used
    )
      .map((item) => asString(item))
      .filter(Boolean),
    factorSourceSummary: asArray(
      structured?.factorSourceSummary ??
      structured?.factor_source_summary ??
      source.factorSourceSummary ??
      source.factor_source_summary
    )
      .filter(isObject)
      .map((item) => ({
        factorId: asString(item.factorId ?? item.factor_id),
        factorVersionId: asString(
          item.factorVersionId ??
          item.factor_version_id ??
          `${asString(item.factorId ?? item.factor_id)}:legacy`
        ),
        label: asString(item.label),
        stage: asString(item.stage) as NonNullable<CarbonAssessmentResult["factorSourceSummary"]>[number]["stage"],
        unit: asString(item.unit),
        value: asNumber(item.value),
        source: asString(item.source),
        sourceUrl: asString(item.sourceUrl ?? item.source_url),
        geography: asNonEmptyString(item.geography) ?? undefined,
        year: asNullableNumber(item.year) ?? undefined,
        quality: asString(item.quality) as NonNullable<CarbonAssessmentResult["factorSourceSummary"]>[number]["quality"],
        factorClass: asString(
          item.factorClass ??
          item.factor_class ??
          (asBoolean(item.isProxy ?? item.is_proxy) ? "internal_proxy" : "documented_secondary")
        ) as NonNullable<CarbonAssessmentResult["factorSourceSummary"]>[number]["factorClass"],
        boundaryType: asString(
          item.boundaryType ??
          item.boundary_type ??
          "unknown"
        ) as NonNullable<CarbonAssessmentResult["factorSourceSummary"]>[number]["boundaryType"],
        gwpBasis: asString(item.gwpBasis ?? item.gwp_basis, "IPCC_AR5_100y"),
        uncertaintyCv: asNumber(item.uncertaintyCv ?? item.uncertainty_cv, 0.5),
        qualityScores: (() => {
          const qualityScores = item.qualityScores ?? item.quality_scores;
          if (!isObject(qualityScores)) {
            return {
              technologicalRepresentativeness: 5,
              temporalRepresentativeness: 5,
              geographicalRepresentativeness: 5,
              completeness: 5,
              reliability: 5
            };
          }
          return {
            technologicalRepresentativeness: asNumber(
              qualityScores.technologicalRepresentativeness ??
              qualityScores.technological_representativeness,
              5
            ),
            temporalRepresentativeness: asNumber(
              qualityScores.temporalRepresentativeness ?? qualityScores.temporal_representativeness,
              5
            ),
            geographicalRepresentativeness: asNumber(
              qualityScores.geographicalRepresentativeness ??
              qualityScores.geographical_representativeness,
              5
            ),
            completeness: asNumber(qualityScores.completeness, 5),
            reliability: asNumber(qualityScores.reliability, 5)
          };
        })(),
        isProxy: asBoolean(item.isProxy ?? item.is_proxy)
      })),
    dataQualityBreakdown: (() => {
      const raw =
        structured?.dataQualityBreakdown ??
        structured?.data_quality_breakdown ??
        source.dataQualityBreakdown ??
        source.data_quality_breakdown;
      if (!isObject(raw)) return undefined;
      const normalizeAxis = (value: unknown, maxScore: number) => {
        if (!isObject(value)) {
          return { score: 0, maxScore };
        }
        return {
          score: asNumber(value.score),
          maxScore: asNumber(value.maxScore ?? value.max_score, maxScore)
        };
      };
      return {
        completeness: normalizeAxis(raw.completeness, 30),
        specificity: normalizeAxis(raw.specificity, 25),
        geographicRelevance: normalizeAxis(
          raw.geographicRelevance ?? raw.geographic_relevance,
          15
        ),
        transportSpecificity: normalizeAxis(
          raw.transportSpecificity ?? raw.transport_specificity,
          15
        ),
        proxyShare: normalizeAxis(raw.proxyShare ?? raw.proxy_share, 15)
      };
    })()
  };
};

export const normalizeProductFromUnknown = (value: unknown): ProductRecord | null => {
  if (!isObject(value)) return null;

  const payload = isObject(value.payload) ? value.payload : {};
  const source: Record<string, unknown> = { ...payload, ...value };
  const payloadShipment = isObject(payload.shipment) ? payload.shipment : {};
  const sourceShipment = isObject(source.shipment) ? source.shipment : {};
  const payloadDestination = isObject(payload.destination) ? payload.destination : {};
  const sourceDestination = isObject(source.destination) ? source.destination : {};

  const idCandidates = [
  value.id,
  value.productId,
  value.product_id,
  value.productUuid,
  value.product_uuid,
  source.id,
  source.productId,
  source.product_id,
  source.productUuid,
  source.product_uuid,
  payload.id,
  payload.productId,
  payload.product_id,
  payload.productUuid,
  payload.product_uuid].

  map((candidate) => asNonEmptyString(candidate)).
  filter((candidate): candidate is string => Boolean(candidate));

  const id =
  idCandidates.find((candidate) => isValidProductId(candidate)) ||
  idCandidates[0] ||
  "";

  if (!id) return null;

  const createdAt = toIsoString(source.createdAt ?? source.created_at);
  const updatedAt = toIsoString(source.updatedAt ?? source.updated_at);

  const explicitStatusToken = normalizeProductStatusToken(
    source.status ?? source.product_status ?? source.state
  );
  const hasPublishedTimestamp = Boolean(
    asNonEmptyString(source.publishedAt ?? source.published_at)
  );
  const booleanPublishFlag = [
    source.isPublished,
    source.is_published,
    source.active,
    source.is_active
  ].find((candidate) => typeof candidate === "boolean") as boolean | undefined;

  const status: ProductStatus =
    isPublishedProductStatus(explicitStatusToken) ?
      "published" :
    explicitStatusToken === "draft" ?
      "draft" :
    hasPublishedTimestamp ?
      "published" :
    booleanPublishFlag === true ?
      "published" :
      "draft";
  const rawStatus = normalizeProductStatusToken(
    source.status ?? source.product_status ?? source.state
  );
  if (rawStatus === "archived") {
    return null;
  }
  const weightPerUnit =
  source.weightPerUnit !== undefined ?
  asNumber(source.weightPerUnit) :
  source.weight_per_unit !== undefined ?
  asNumber(source.weight_per_unit) :
  source.weight_kg !== undefined ?
  asNumber(source.weight_kg) * 1000 :
  0;

  const destinationMarket = normalizeDestinationMarket(
    payload.destinationMarketCode ??
    payload.destination_market_code ??
    payload.marketCode ??
    payload.market_code ??
    payload.destinationMarket ??
    payload.destination_market ??
    payload.targetMarket ??
    payload.target_market ??
    payload.market ??
    payload.destinationMarkets ??
    payload.destination_markets ??
    payload.destinationCountry ??
    payload.destination_country ??
    payloadDestination.market ??
    payloadDestination.country ??
    payloadShipment.destination_market ??
    (isObject(payloadShipment.destination) ? payloadShipment.destination.country : undefined) ??
    source.destinationMarketCode ??
    source.destination_market_code ??
    source.marketCode ??
    source.market_code ??
    source.destinationMarket ??
    source.destination_market ??
    source.targetMarket ??
    source.target_market ??
    source.market ??
    source.destinationMarkets ??
    source.destination_markets ??
    source.destinationCountry ??
    source.destination_country ??
    sourceDestination.market ??
    sourceDestination.country ??
    sourceShipment.destination_market ??
    (isObject(sourceShipment.destination) ? sourceShipment.destination.country : undefined)
  );

  const estimatedTotalDistance = asNumber(
    payload.estimatedTotalDistance ??
    payload.estimated_total_distance ??
    payload.totalDistanceKm ??
    payload.total_distance_km ??
    payload.distance_km ??
    payloadShipment.total_distance_km ??
    source.estimatedTotalDistance ??
    source.estimated_total_distance ??
    source.totalDistanceKm ??
    source.total_distance_km ??
    source.distance_km ??
    sourceShipment.total_distance_km
  );

  const transportLegs = normalizeTransportLegs(
    payload.transportLegs ??
    payload.transport_legs ??
    payload.legs ??
    payload.routeLegs ??
    payload.route_legs ??
    payload.routes ??
    payloadShipment.legs ??
    source.transportLegs ??
    source.transport_legs ??
    source.legs ??
    source.routeLegs ??
    source.route_legs ??
    source.routes ??
    sourceShipment.legs
  );

  if (transportLegs.length === 0) {
    const fallbackMode =
    TRANSPORT_MODE_ALIASES[
    toCompactKey(
      payload.transportMode ??
      payload.transport_mode ??
      payload.shippingMode ??
      payload.shipping_mode ??
      payload.mode ??
      payloadShipment.transport_mode ??
      source.transportMode ??
      source.transport_mode ??
      source.shippingMode ??
      source.shipping_mode ??
      source.mode ??
      sourceShipment.transport_mode)
    ];

    if (fallbackMode || estimatedTotalDistance > 0) {
      transportLegs.push({
        id: "leg-1",
        mode: fallbackMode ?? "road",
        estimatedDistance: estimatedTotalDistance > 0 ? estimatedTotalDistance : undefined,
        routeResolved: (fallbackMode ?? "road") === "road" ? false : undefined
      });
    }
  }

  return {
    id,
    productCode: asString(source.productCode ?? source.product_code ?? source.sku),
    productName: asString(source.productName ?? source.product_name ?? source.name),
    productType: asString(source.productType ?? source.product_type ?? source.category),
    productCategory: toProductCategory(
      payload.productCategory ?? payload.product_category ?? source.productCategory ?? source.product_category
    ),
    hsCode: asString(payload.hsCode ?? payload.hs_code ?? source.hsCode ?? source.hs_code),
    cnCode: asString(
      payload.cnCode ??
      payload.cn_code ??
      payload.hsCode ??
      payload.hs_code ??
      source.cnCode ??
      source.cn_code ??
      source.hsCode ??
      source.hs_code
    ),
    facility: asString(payload.facility ?? source.facility),
    evidenceLookupCode: asString(
      payload.evidenceLookupCode ??
      payload.evidence_lookup_code ??
      source.evidenceLookupCode ??
      source.evidence_lookup_code
    ),
    supplierCountry: asString(
      payload.supplierCountry ??
      payload.supplier_country ??
      source.supplierCountry ??
      source.supplier_country
    ),
    supplyGap: Boolean(
      payload.supplyGap ??
      payload.supply_gap ??
      source.supplyGap ??
      source.supply_gap ??
      false
    ),
    customsDeclarationNo: asString(
      payload.customsDeclarationNo ??
      payload.customs_declaration_no ??
      source.customsDeclarationNo ??
      source.customs_declaration_no
    ),
    poContractId: asString(
      payload.poContractId ??
      payload.po_contract_id ??
      source.poContractId ??
      source.po_contract_id
    ),
    billOfLadingNo: asString(
      payload.billOfLadingNo ??
      payload.bill_of_lading_no ??
      source.billOfLadingNo ??
      source.bill_of_lading_no
    ),
    containerNo: asString(
      payload.containerNo ??
      payload.container_no ??
      source.containerNo ??
      source.container_no
    ),
    weightPerUnit,
    quantity: asNumber(source.quantity),
    materials: normalizeMaterials(payload.materials ?? source.materials),
    accessories: normalizeAccessories(payload.accessories ?? source.accessories),
    productionProcesses: normalizeProductionProcesses(
      payload.productionProcesses ??
      payload.production_processes ??
      payload.processes ??
      source.productionProcesses ??
      source.production_processes ??
      source.processes
    ),
    energySources: normalizeEnergySources(
      payload.energySources ??
      payload.energy_sources ??
      source.energySources ??
      source.energy_sources
    ),
    manufacturingLocation: asString(
      payload.manufacturingLocation ??
      payload.manufacturing_location ??
      source.manufacturingLocation ??
      source.manufacturing_location
    ),
    wasteRecovery: normalizeWasteRecoveryValue(
      payload.wasteRecovery ??
      payload.waste_recovery ??
      source.wasteRecovery ??
      source.waste_recovery
    ),
    destinationMarket,
    originAddress: normalizeAddress(
      payload.originAddress ??
      payload.origin_address ??
      payload.origin ??
      payload.originLocation ??
      payload.origin_location ??
      payloadShipment.origin ??
      source.originAddress ??
      source.origin_address ??
      source.origin ??
      source.originLocation ??
      source.origin_location ??
      sourceShipment.origin
    ),
    destinationAddress: normalizeAddress(
      payload.destinationAddress ??
      payload.destination_address ??
      payload.destination ??
      payload.destinationLocation ??
      payload.destination_location ??
      payloadShipment.destination ??
      source.destinationAddress ??
      source.destination_address ??
      source.destination ??
      source.destinationLocation ??
      source.destination_location ??
      sourceShipment.destination
    ),
    transportLegs,
    estimatedTotalDistance,
    carbonResults: normalizeCarbonResults(
      payload.carbonResults ??
      payload.carbon_results ??
      source.carbonResults ??
      source.carbon_results,
      source,
      asNumber(source.quantity, 1)
    ),
    status,
    shipmentId: asNonEmptyString(source.shipmentId ?? source.shipment_id),
    version: Math.max(1, asNumber(source.version, 1)),
    createdAt,
    updatedAt
  };
};

const defaultPagination = (count: number): Pagination => ({
  page: 1,
  page_size: count,
  total: count,
  total_pages: count > 0 ? 1 : 0
});

const normalizePagination = (
value: unknown,
fallbackCount: number)
: Pagination => {
  if (!isObject(value)) {
    return defaultPagination(fallbackCount);
  }

  const page = Math.max(1, asNumber(value.page, 1));
  const pageSize = Math.max(1, asNumber(value.page_size ?? value.pageSize, 20));
  const total = Math.max(0, asNumber(value.total, fallbackCount));
  const totalPages = Math.max(
    0,
    asNumber(value.total_pages ?? value.totalPages, total > 0 ? Math.ceil(total / pageSize) : 0)
  );

  return {
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages
  };
};

const normalizeProductListPayload = (payload: unknown): ProductListResult => {
  let rawItems: unknown[] = [];
  let rawPagination: unknown = undefined;

  if (Array.isArray(payload)) {
    rawItems = payload;
  } else if (isObject(payload)) {
    if (Array.isArray(payload.items)) {
      rawItems = payload.items;
      rawPagination = payload.pagination;
    } else if (Array.isArray(payload.products)) {
      rawItems = payload.products;
      rawPagination = payload.pagination;
    } else if (Array.isArray(payload.data)) {
      rawItems = payload.data;
      rawPagination = payload.pagination;
    }
  }

  const items = rawItems.
  map((item) => normalizeProductFromUnknown(item)).
  filter((item): item is ProductRecord => item !== null);

  return {
    items,
    pagination: normalizePagination(rawPagination, items.length)
  };
};

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string" && value.trim().length === 0) return;
    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
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
      : {})
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

const resolvePublishedStatusForApi = () => "published";

const isEmptyProductListResult = (result: ProductListResult) =>
result.items.length === 0 && result.pagination.total === 0;

export const fetchProducts = async (
query: ProductListQuery = {})
: Promise<ProductListResult> => {
  const safePage = toSafePage(query.page, 1);
  const safePageSize = toSafePageSize(query.page_size, 20);
  const requestedStatus = query.status;
  const effectiveStatus =
  requestedStatus === "published" ? resolvePublishedStatusForApi() : requestedStatus;
  const buildQueryString = (statusOverride?: string) =>
  toQueryString({
    search: query.search,
    status: statusOverride ?? effectiveStatus,
    category: query.category,
    page: safePage,
    page_size: safePageSize,
    sort_by: query.sort_by,
    sort_order: query.sort_order,
    view: query.view
  });

  const queryString = buildQueryString();

  const requestKey = `products${queryString}`;
  const existingRequest = inflightProductListRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const payload = await api.get<unknown>(`/products${queryString}`, {
        disableResponseCache: true
      });
      const normalizedPayload = normalizeProductListPayload(payload);

      if (requestedStatus === "published" && !isEmptyProductListResult(normalizedPayload)) {
        writePublishStatusApiMode("published");
      }

      return normalizedPayload;
    } catch (error) {
      throw error;
    }
  })();

  inflightProductListRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    inflightProductListRequests.delete(requestKey);
  }
};

export const fetchAllProducts = async (
query: Omit<ProductListQuery, "page" | "page_size"> = {})
: Promise<ProductRecord[]> => {
  const aggregated: ProductRecord[] = [];
  let page = 1;

  while (true) {
    const result = await fetchProducts({ ...query, page, page_size: 100 });
    aggregated.push(...result.items);

    if (page >= result.pagination.total_pages || result.items.length === 0) {
      break;
    }

    page += 1;
  }

  return aggregated;
};

export const fetchProductById = async (productId: string): Promise<ProductRecord> => {
  if (!isValidProductId(productId)) {
    throw new Error("Invalid product ID format.");
  }

  const payload = await api.get<unknown>(`/products/${productId}`, {
    disableResponseCache: true
  });
  const product = normalizeProductFromUnknown(payload);

  if (!product) {
    throw new Error("Product not found.");
  }

  return product;
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
  invalidateProductCaches("products-bulk-imported");
  return normalizeBulkImportPayload(payload);
};

const toBatchStatus = (value: unknown): ProductBatchStatus => {
  const normalized = asString(value).toLowerCase();
  if (normalized === "published") return "published";
  if (normalized === "archived") return "archived";
  return "draft";
};

const normalizeBatchItem = (value: unknown): ProductBatchItem | null => {
  if (!isObject(value)) return null;

  const productId = asString(value.productId ?? value.product_id);
  const explicitId = asString(value.id);
  const fallbackId =
  productId ||
  asString(value.product_code ?? value.productCode ?? value.sku) ||
  asString(value.added_at ?? value.addedAt);
  const id = explicitId || fallbackId;
  if (!id) return null;

  return {
    id,
    productId,
    productCode: asString(value.productCode ?? value.product_code ?? value.sku),
    productName: asString(value.productName ?? value.product_name ?? value.name),
    productType: asString(value.productType ?? value.product_type ?? value.category),
    quantity: asNumber(value.quantity, 0),
    weightKg: asNumber(value.weightKg ?? value.weight_kg, 0),
    co2PerUnit: asNumber(value.co2PerUnit ?? value.co2_per_unit ?? value.unit_co2e, 0)
  };
};

const normalizeBatchSummary = (value: unknown): ProductBatchSummary | null => {
  if (!isObject(value)) return null;

  const id = asString(value.id);
  if (!id) return null;

  return {
    id,
    name: asString(value.name ?? value.batch_name),
    description: asString(value.description),
    status: toBatchStatus(value.status),
    originAddress: isObject(value.originAddress ?? value.origin_address) ?
    normalizeAddress(value.originAddress ?? value.origin_address) :
    undefined,
    destinationAddress: isObject(value.destinationAddress ?? value.destination_address) ?
    normalizeAddress(value.destinationAddress ?? value.destination_address) :
    undefined,
    destinationMarket: normalizeDestinationMarket(
      value.destinationMarketCode ??
      value.destination_market_code ??
      value.marketCode ??
      value.market_code ??
      value.destinationMarket ??
      value.destination_market ??
      value.destinationMarkets ??
      value.destination_markets
    ),
    transportModes: asArray(value.transportModes ?? value.transport_modes).map((mode) =>
    asString(mode)
    ),
    shipmentId: (() => {
      const shipmentId = asString(value.shipmentId ?? value.shipment_id);
      return shipmentId || null;
    })(),
    totalProducts: asNumber(
      value.totalProducts ??
      value.total_products ??
      value.itemCount ??
      value.item_count,
      0
    ),
    totalQuantity: asNumber(value.totalQuantity ?? value.total_quantity, 0),
    totalWeight: asNumber(value.totalWeight ?? value.total_weight_kg ?? value.total_weight, 0),
    totalCO2: asNumber(value.totalCO2 ?? value.total_co2e, 0),
    publishedAt: (() => {
      const publishedAt = value.publishedAt ?? value.published_at;
      return publishedAt ? toIsoString(publishedAt) : undefined;
    })(),
    createdAt: toIsoString(value.createdAt ?? value.created_at),
    updatedAt: toIsoString(value.updatedAt ?? value.updated_at)
  };
};

const normalizeBatchDetail = (value: unknown): ProductBatchDetail | null => {
  const summary = normalizeBatchSummary(value);
  if (!summary || !isObject(value)) return null;

  const items = asArray(value.items).
  map((item) => normalizeBatchItem(item)).
  filter((item): item is ProductBatchItem => item !== null);

  return {
    ...summary,
    items
  };
};

const normalizeBatchListPayload = (payload: unknown): ProductBatchListResult => {
  let rawItems: unknown[] = [];
  let rawPagination: unknown = undefined;

  if (Array.isArray(payload)) {
    rawItems = payload;
  } else if (isObject(payload)) {
    if (Array.isArray(payload.items)) {
      rawItems = payload.items;
      rawPagination = payload.pagination;
    } else if (Array.isArray(payload.batches)) {
      rawItems = payload.batches;
      rawPagination = payload.pagination;
    }
  }

  const items = rawItems.
  map((item) => normalizeBatchSummary(item)).
  filter((item): item is ProductBatchSummary => item !== null);

  return {
    items,
    pagination: normalizePagination(rawPagination, items.length)
  };
};

export const listProductBatches = async (
query: ProductBatchListQuery = {})
: Promise<ProductBatchListResult> => {
  const queryString = toQueryString({
    search: query.search,
    status: query.status,
    page: query.page,
    page_size: query.page_size
  });

  const payload = await api.get<unknown>(`/product-batches${queryString}`);
  return normalizeBatchListPayload(payload);
};

export const getProductBatchById = async (
batchId: string)
: Promise<ProductBatchDetail> => {
  const normalizedBatchId = batchId.trim();
  if (!normalizedBatchId) {
    throw new Error("Batch ID is required.");
  }

  const payload = await api.get<unknown>(
    `/product-batches/${encodeURIComponent(normalizedBatchId)}`
  );
  const normalized = normalizeBatchDetail(payload);

  if (!normalized) {
    throw new Error("Batch not found.");
  }

  return normalized;
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
