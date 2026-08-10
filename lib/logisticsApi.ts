import { api, invalidateApiResponseCache, isApiError } from "@/lib/apiClient";
import { runWithConcurrency } from "@/lib/concurrency";
import { buildTransportRouteGeometry } from "@/lib/transportRouteGeometry";
import type { TransportLeg } from "@/types/transport";
import {
  DESTINATION_HUBS_BY_MARKET,
  VIETNAM_TRANSFER_HUBS,
  type RouteHub,
  type RouteHubKind
} from "@/components/dashboard/assessment/steps/routeHubs";

export type LogisticsShipmentStatus =
"pending" |
"in_transit" |
"delivered" |
"cancelled";

export type LogisticsTransportMode = "road" | "sea" | "air" | "rail";

export interface LogisticsLocation {
  country: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface LogisticsShipmentLeg {
  id: string;
  legOrder: number;
  transportMode: LogisticsTransportMode;
  originLocation: string;
  destinationLocation: string;
  distanceKm: number;
  durationHours: number | null;
  co2e: number;
  emissionFactorUsed: number | null;
  carrierName: string;
  vehicleType: string;
}

export interface LogisticsShipmentProduct {
  id: string;
  productId: string;
  quantity: number;
  weightKg: number;
  allocatedCo2e: number;
  sku: string;
  productName: string;
}

export interface LogisticsShipmentSummary {
  id: string;
  referenceNumber: string;
  status: LogisticsShipmentStatus;
  origin: LogisticsLocation;
  destination: LogisticsLocation;
  totalWeightKg: number;
  totalDistanceKm: number;
  totalCo2e: number;
  pendingUntil: string | null;
  estimatedArrival: string | null;
  estimatedArrivalAt: string | null;
  actualArrival: string | null;
  actualArrivalAt: string | null;
  simulationEnabled: boolean;
  legsCount: number;
  productsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LogisticsShipmentDetail extends LogisticsShipmentSummary {
  companyId: string;
  legs: LogisticsShipmentLeg[];
  products: LogisticsShipmentProduct[];
}

export interface LogisticsPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface LogisticsShipmentListResult {
  items: LogisticsShipmentSummary[];
  pagination: LogisticsPagination;
}

export interface LogisticsShipmentListQuery {
  search?: string;
  status?: LogisticsShipmentStatus | "all";
  transport_mode?: LogisticsTransportMode;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  sort_by?: "created_at" | "updated_at" | "estimated_arrival" | "total_co2e";
  sort_order?: "asc" | "desc";
}

type ShipmentListRequestQuery = Omit<LogisticsShipmentListQuery, "page_size"> & {
  page_size?: number;
};

export interface LogisticsOverview {
  totalShipments: number;
  pending: number;
  inTransit: number;
  delivered: number;
  cancelled: number;
  totalCo2e: number;
}

export interface ShipmentMutationResult {
  id: string;
  status?: LogisticsShipmentStatus;
  updatedAt?: string;
  createdAt?: string;
  pendingUntil?: string | null;
  estimatedArrival?: string | null;
  estimatedArrivalAt?: string | null;
  actualArrival?: string | null;
  actualArrivalAt?: string | null;
  simulationEnabled?: boolean;
}

export interface ShipmentLocationInput {
  country: string;
  city: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface ShipmentLegInput {
  leg_order: number;
  transport_mode: LogisticsTransportMode;
  origin_location: string;
  destination_location: string;
  distance_km: number;
  duration_hours?: number;
  co2e: number;
  emission_factor_used?: number;
  carrier_name?: string;
  vehicle_type?: string;
}

export interface ShipmentProductInput {
  product_id: string;
  quantity: number;
  weight_kg: number;
  allocated_co2e: number;
}

export interface CreateShipmentPayload {
  reference_number?: string;
  origin: ShipmentLocationInput;
  destination: ShipmentLocationInput;
  estimated_arrival?: string;
  legs: ShipmentLegInput[];
  products: ShipmentProductInput[];
}

export interface UpdateShipmentPayload {
  reference_number?: string;
  origin?: ShipmentLocationInput;
  destination?: ShipmentLocationInput;
  estimated_arrival?: string;
}

const UUID_REGEX =
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const isValidUuid = (value: string) => UUID_REGEX.test(value.trim());

type ApiListPayload = {
  items?: unknown[];
  shipments?: unknown[];
  data?: unknown[];
  pagination?: unknown;
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

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const asArray = <T = unknown,>(value: unknown): T[] =>
Array.isArray(value) ? value as T[] : [];

const asNullableString = (value: unknown) => {
  const normalized = asString(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const toIsoDatetime = (value: unknown) => {
  const raw = asString(value);
  if (!raw) {
    return new Date().toISOString();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toISOString();
};

const toIsoDate = (value: unknown) => {
  const raw = asString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toISOString().slice(0, 10);
};

const normalizeTemporalValue = (value: unknown) => {
  const raw = asString(value).trim();
  if (!raw) return null;
  if (ISO_DATE_ONLY_REGEX.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toISOString();
};

const toComparableTime = (value: string | null | undefined) => {
  if (!value) return NaN;
  if (ISO_DATE_ONLY_REGEX.test(value)) {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    return Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  }

  return new Date(value).getTime();
};

const toShipmentStatus = (value: unknown): LogisticsShipmentStatus => {
  const status = asString(value).toLowerCase();
  if (status === "in_transit") return "in_transit";
  if (status === "delivered") return "delivered";
  if (status === "cancelled") return "cancelled";
  return "pending";
};

const toTransportMode = (value: unknown): LogisticsTransportMode => {
  const mode = asString(value).toLowerCase();
  if (mode === "road" || mode === "sea" || mode === "air" || mode === "rail") {
    return mode;
  }
  return "road";
};

const normalizeLocation = (value: unknown): LogisticsLocation => {
  if (!isObject(value)) {
    return {
      country: "",
      city: "",
      address: "",
      lat: null,
      lng: null
    };
  }

  const latCandidate = value.lat ?? value.latitude;
  const lngCandidate = value.lng ?? value.longitude;
  const lat = latCandidate === null || latCandidate === undefined ?
  null :
  asNumber(latCandidate, NaN);
  const lng = lngCandidate === null || lngCandidate === undefined ?
  null :
  asNumber(lngCandidate, NaN);

  return {
    country: asString(value.country),
    city: asString(value.city),
    address: asString(value.address),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
};

const normalizeShipmentLeg = (
value: unknown,
index: number)
: LogisticsShipmentLeg | null => {
  if (!isObject(value)) return null;

  return {
    id: asString(value.id, `leg-${index + 1}`),
    legOrder: Math.max(1, Math.trunc(asNumber(value.legOrder ?? value.leg_order, index + 1))),
    transportMode: toTransportMode(value.transportMode ?? value.transport_mode),
    originLocation: asString(value.originLocation ?? value.origin_location),
    destinationLocation: asString(value.destinationLocation ?? value.destination_location),
    distanceKm: Math.max(0, asNumber(value.distanceKm ?? value.distance_km)),
    durationHours: (() => {
      const raw = value.durationHours ?? value.duration_hours;
      if (raw === null || raw === undefined) return null;
      const duration = asNumber(raw, NaN);
      return Number.isFinite(duration) ? duration : null;
    })(),
    co2e: Math.max(0, asNumber(value.co2e)),
    emissionFactorUsed: (() => {
      const raw = value.emissionFactorUsed ?? value.emission_factor_used;
      if (raw === null || raw === undefined) return null;
      const factor = asNumber(raw, NaN);
      return Number.isFinite(factor) ? factor : null;
    })(),
    carrierName: asString(value.carrierName ?? value.carrier_name),
    vehicleType: asString(value.vehicleType ?? value.vehicle_type)
  };
};

const normalizeShipmentProduct = (
value: unknown,
index: number)
: LogisticsShipmentProduct | null => {
  if (!isObject(value)) return null;

  const productId = asString(value.productId ?? value.product_id);
  if (!productId) return null;

  return {
    id: asString(value.id, `shipment-product-${index + 1}`),
    productId,
    quantity: Math.max(0, Math.trunc(asNumber(value.quantity))),
    weightKg: Math.max(0, asNumber(value.weightKg ?? value.weight_kg)),
    allocatedCo2e: Math.max(0, asNumber(value.allocatedCo2e ?? value.allocated_co2e)),
    sku: asString(value.sku),
    productName: asString(value.productName ?? value.product_name)
  };
};

const normalizeShipmentSummary = (
value: unknown)
: LogisticsShipmentSummary | null => {
  if (!isObject(value)) return null;

  const id = asString(value.id);
  if (!id) return null;

  return {
    id,
    referenceNumber: asString(value.referenceNumber ?? value.reference_number, id),
    status: toShipmentStatus(value.status),
    origin: normalizeLocation(value.origin),
    destination: normalizeLocation(value.destination),
    totalWeightKg: Math.max(0, asNumber(value.totalWeightKg ?? value.total_weight_kg)),
    totalDistanceKm: Math.max(0, asNumber(value.totalDistanceKm ?? value.total_distance_km)),
    totalCo2e: Math.max(0, asNumber(value.totalCo2e ?? value.total_co2e)),
    pendingUntil: normalizeTemporalValue(value.pendingUntil ?? value.pending_until),
    estimatedArrival: toIsoDate(value.estimatedArrival ?? value.estimated_arrival),
    estimatedArrivalAt: normalizeTemporalValue(
      value.estimatedArrivalAt ?? value.estimated_arrival_at ?? value.estimatedArrival ?? value.estimated_arrival
    ),
    actualArrival: toIsoDate(value.actualArrival ?? value.actual_arrival),
    actualArrivalAt: normalizeTemporalValue(
      value.actualArrivalAt ?? value.actual_arrival_at ?? value.actualArrival ?? value.actual_arrival
    ),
    simulationEnabled: value.simulationEnabled === true || value.simulation_enabled === true,
    legsCount: Math.max(0, Math.trunc(asNumber(value.legsCount ?? value.legs_count))),
    productsCount: Math.max(0, Math.trunc(asNumber(value.productsCount ?? value.products_count))),
    createdAt: toIsoDatetime(value.createdAt ?? value.created_at),
    updatedAt: toIsoDatetime(value.updatedAt ?? value.updated_at)
  };
};

const normalizeShipmentDetail = (value: unknown): LogisticsShipmentDetail | null => {
  const summary = normalizeShipmentSummary(value);
  if (!summary || !isObject(value)) return null;

  const legs = asArray(value.legs).
  map((leg, index) => normalizeShipmentLeg(leg, index)).
  filter((leg): leg is LogisticsShipmentLeg => leg !== null).
  sort((a, b) => a.legOrder - b.legOrder);

  const products = asArray(value.products).
  map((product, index) => normalizeShipmentProduct(product, index)).
  filter((product): product is LogisticsShipmentProduct => product !== null);

  return {
    ...summary,
    companyId: asString(value.companyId ?? value.company_id),
    legs,
    products
  };
};

const defaultPagination = (count: number): LogisticsPagination => ({
  page: 1,
  page_size: count,
  total: count,
  total_pages: count > 0 ? 1 : 0
});

const normalizePagination = (
value: unknown,
fallbackCount: number)
: LogisticsPagination => {
  if (!isObject(value)) return defaultPagination(fallbackCount);

  const page = Math.max(1, Math.trunc(asNumber(value.page, 1)));
  const pageSize = Math.max(
    1,
    Math.trunc(asNumber(value.page_size ?? value.pageSize, 20))
  );
  const total = Math.max(
    0,
    Math.trunc(asNumber(value.total ?? value.total_items, fallbackCount))
  );
  const totalPages = Math.max(
    0,
    Math.trunc(
      asNumber(
        value.total_pages ?? value.totalPages,
        total > 0 ? Math.ceil(total / pageSize) : 0
      )
    )
  );

  return {
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages
  };
};

const normalizeShipmentsListPayload = (
payload: unknown)
: LogisticsShipmentListResult => {
  let rawItems: unknown[] = [];
  let rawPagination: unknown;

  if (Array.isArray(payload)) {
    rawItems = payload;
  } else if (isObject(payload)) {
    const listPayload = payload as ApiListPayload;
    if (Array.isArray(listPayload.items)) {
      rawItems = listPayload.items;
      rawPagination = listPayload.pagination;
    } else if (Array.isArray(listPayload.shipments)) {
      rawItems = listPayload.shipments;
      rawPagination = listPayload.pagination;
    } else if (Array.isArray(listPayload.data)) {
      rawItems = listPayload.data;
      rawPagination = listPayload.pagination;
    }
  }

  const items = rawItems.
  map((item) => normalizeShipmentSummary(item)).
  filter((item): item is LogisticsShipmentSummary => item !== null);

  return {
    items,
    pagination: normalizePagination(rawPagination, items.length)
  };
};

const normalizeMutationPayload = (payload: unknown): ShipmentMutationResult => {
  if (!isObject(payload)) {
    throw new Error("Invalid shipment response from server.");
  }

  const id = asString(payload.id);
  if (!id) {
    throw new Error("Shipment id was not returned by server.");
  }

  return {
    id,
    status:
    payload.status === undefined ?
    undefined :
    toShipmentStatus(payload.status),
    updatedAt:
    (payload.updatedAt ?? payload.updated_at) === undefined ?
    undefined :
    toIsoDatetime(payload.updatedAt ?? payload.updated_at),
    createdAt:
    (payload.createdAt ?? payload.created_at) === undefined ?
    undefined :
    toIsoDatetime(payload.createdAt ?? payload.created_at),
    pendingUntil: normalizeTemporalValue(payload.pendingUntil ?? payload.pending_until),
    estimatedArrival: toIsoDate(payload.estimatedArrival ?? payload.estimated_arrival),
    estimatedArrivalAt: normalizeTemporalValue(
      payload.estimatedArrivalAt ?? payload.estimated_arrival_at ?? payload.estimatedArrival ?? payload.estimated_arrival
    ),
    actualArrival: toIsoDate(payload.actualArrival ?? payload.actual_arrival),
    actualArrivalAt: normalizeTemporalValue(
      payload.actualArrivalAt ?? payload.actual_arrival_at ?? payload.actualArrival ?? payload.actual_arrival
    ),
    simulationEnabled:
    (payload.simulationEnabled ?? payload.simulation_enabled) === undefined ?
    undefined :
    (payload.simulationEnabled ?? payload.simulation_enabled) === true
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

const toSafePage = (value: unknown, fallback = 1) => {
  const page = Math.trunc(asNumber(value, fallback));
  return Math.max(1, page);
};

const toSafePageSize = (value: unknown, fallback = 20) => {
  const pageSize = Math.trunc(asNumber(value, fallback));
  return Math.min(100, Math.max(1, pageSize));
};

const LOCATION_COORDINATES: Record<string, {lat: number;lng: number;}> = {
  vietnam: { lat: 14.0583, lng: 108.2772 },
  "viet nam": { lat: 14.0583, lng: 108.2772 },
  "ho chi minh": { lat: 10.8231, lng: 106.6297 },
  "ho chi minh city": { lat: 10.8231, lng: 106.6297 },
  "thanh pho ho chi minh": { lat: 10.8231, lng: 106.6297 },
  "tp ho chi minh": { lat: 10.8231, lng: 106.6297 },
  "hcm city": { lat: 10.8231, lng: 106.6297 },
  hanoi: { lat: 21.0285, lng: 105.8542 },
  "ha noi": { lat: 21.0285, lng: 105.8542 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  japan: { lat: 36.2048, lng: 138.2529 },
  seoul: { lat: 37.5665, lng: 126.978 },
  korea: { lat: 35.9078, lng: 127.7669 },
  "han quoc": { lat: 35.9078, lng: 127.7669 },
  "south korea": { lat: 35.9078, lng: 127.7669 },
  "republic of korea": { lat: 35.9078, lng: 127.7669 },
  goyang: { lat: 37.6584, lng: 126.832 },
  china: { lat: 35.8617, lng: 104.1954 },
  usa: { lat: 37.0902, lng: -95.7129 },
  "united states": { lat: 37.0902, lng: -95.7129 },
  "hoa ky": { lat: 37.0902, lng: -95.7129 },
  "los angeles": { lat: 34.0522, lng: -118.2437 },
  eu: { lat: 50.1109, lng: 8.6821 },
  europe: { lat: 50.1109, lng: 8.6821 },
  netherlands: { lat: 52.1326, lng: 5.2913 },
  rotterdam: { lat: 51.9244, lng: 4.4777 },
  germany: { lat: 51.1657, lng: 10.4515 },
  singapore: { lat: 1.3521, lng: 103.8198 }
};

const normalizeLocationKey = (value: string) =>
value.
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
toLowerCase().
replace(/[^a-z0-9\s]/g, " ").
replace(/\s+/g, " ").
trim();

const resolveCoordinateByKey = (key: string) => {
  if (!key) return null;
  if (LOCATION_COORDINATES[key]) {
    return LOCATION_COORDINATES[key];
  }

  for (const [candidate, coordinate] of Object.entries(LOCATION_COORDINATES)) {
    if (key.includes(candidate)) {
      return coordinate;
    }
  }

  return null;
};

const interpolate = (
origin: {lat: number;lng: number;},
destination: {lat: number;lng: number;},
progress: number) => (
{
  lat: origin.lat + (destination.lat - origin.lat) * progress,
  lng: origin.lng + (destination.lng - origin.lng) * progress
});

const resolveCoordinates = (location: LogisticsLocation) => {
  if (location.lat !== null && location.lng !== null) {
    return { lat: location.lat, lng: location.lng };
  }

  const cityKey = normalizeLocationKey(location.city);
  const cityCoordinates = resolveCoordinateByKey(cityKey);
  if (cityCoordinates) {
    return cityCoordinates;
  }

  const countryKey = normalizeLocationKey(location.country);
  const countryCoordinates = resolveCoordinateByKey(countryKey);
  if (countryCoordinates) {
    return countryCoordinates;
  }

  const addressKey = normalizeLocationKey(location.address);
  const addressCoordinates = resolveCoordinateByKey(addressKey);
  if (addressCoordinates) {
    return addressCoordinates;
  }

  return { lat: 10.8231, lng: 106.6297 };
};

const modeToTransportLegMode = (mode: LogisticsTransportMode): TransportLeg["mode"] => {
  if (mode === "sea") return "ship";
  if (mode === "air") return "air";
  if (mode === "rail") return "rail";
  return "truck_heavy";
};

const modeToRouteType = (
mode: LogisticsTransportMode)
: TransportLeg["routeType"] => {
  if (mode === "sea") return "sea";
  if (mode === "air") return "air";
  if (mode === "rail") return "rail";
  return "road";
};

const DEFAULT_EMISSION_FACTOR_BY_MODE: Record<LogisticsTransportMode, number> = {
  road: 0.12226,
  sea: 0.01612,
  air: 0.89939,
  rail: 0.02779
};

const toRadians = (value: number) => value * Math.PI / 180;

const haversineDistanceKm = (
origin: {lat: number;lng: number;},
destination: {lat: number;lng: number;}) =>
{
  const earthRadiusKm = 6371;
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const a =
  Math.sin(latDelta / 2) ** 2 +
  Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadiusKm * c;
  return Number.isFinite(distance) ? Math.max(0, distance) : 0;
};

const resolveLegEmissionFactor = (leg: LogisticsShipmentLeg) => {
  if (leg.emissionFactorUsed !== null && leg.emissionFactorUsed > 0) {
    return leg.emissionFactorUsed;
  }
  return DEFAULT_EMISSION_FACTOR_BY_MODE[leg.transportMode];
};

const resolveLegDistanceKm = (
leg: LogisticsShipmentLeg,
fallbackDistanceKm: number,
fallbackOrigin: {lat: number;lng: number;},
fallbackDestination: {lat: number;lng: number;}) =>
{
  if (leg.distanceKm > 0) {
    return leg.distanceKm;
  }

  const geoDistanceKm = haversineDistanceKm(fallbackOrigin, fallbackDestination);
  if (fallbackDistanceKm > 0 && geoDistanceKm > 0) {
    return Math.max(fallbackDistanceKm, geoDistanceKm);
  }
  if (fallbackDistanceKm > 0) {
    return fallbackDistanceKm;
  }
  if (geoDistanceKm > 0) {
    return geoDistanceKm;
  }

  const factor = resolveLegEmissionFactor(leg);
  if (leg.co2e > 0 && factor > 0) {
    return leg.co2e / factor;
  }

  return 0;
};

const resolveLegCo2Kg = (
leg: LogisticsShipmentLeg,
distanceKm: number,
emissionFactor: number) =>
{
  if (leg.co2e > 0) {
    return leg.co2e;
  }
  if (distanceKm > 0 && emissionFactor > 0) {
    return distanceKm * emissionFactor;
  }
  return 0;
};

const locationLabel = (location: LogisticsLocation) => {
  const city = location.city.trim();
  const country = location.country.trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return "Unknown";
};

const locationLabelMatches = (
  candidate: string | null,
  location: LogisticsLocation) =>
{
  if (!candidate) return false;

  const candidateKey = normalizeLocationKey(candidate);
  if (!candidateKey) return false;

  const cityKey = normalizeLocationKey(location.city);
  const countryKey = normalizeLocationKey(location.country);
  const fullKey = normalizeLocationKey(locationLabel(location));

  if (fullKey && candidateKey === fullKey) return true;
  if (cityKey && (candidateKey === cityKey || candidateKey.includes(cityKey) || cityKey.includes(candidateKey))) {
    return true;
  }
  if (
  countryKey &&
  (candidateKey === countryKey || candidateKey.includes(countryKey) || countryKey.includes(candidateKey)))
  {
    return true;
  }

  return false;
};

const TRANSIT_LABEL_PATTERN = /^transit\s*\d+$/i;

const toHubKindByTransportMode = (
  mode: LogisticsTransportMode)
: RouteHubKind | null => {
  if (mode === "air") return "airport";
  if (mode === "sea") return "port";
  if (mode === "rail") return "rail_terminal";
  return null;
};

type DestinationMarketKey = keyof typeof DESTINATION_HUBS_BY_MARKET;

const inferDestinationMarketKey = (destination: LogisticsLocation): DestinationMarketKey => {
  const normalized = normalizeLocationKey(
    `${destination.country || ""} ${destination.city || ""}`
  );

  if (
    normalized.includes("hoa ky") ||
    normalized.includes("united states") ||
    normalized.includes("usa")
  ) {
    return "usa";
  }
  if (
    normalized.includes("han quoc") ||
    normalized.includes("south korea") ||
    normalized.includes("korea")
  ) {
    return "korea";
  }
  if (
    normalized.includes("nhat ban") ||
    normalized.includes("japan")
  ) {
    return "japan";
  }
  if (
    normalized.includes("trung quoc") ||
    normalized.includes("china")
  ) {
    return "china";
  }
  if (
    normalized.includes("chau au") ||
    normalized.includes("europe") ||
    normalized.includes("eu") ||
    normalized.includes("germany") ||
    normalized.includes("duc") ||
    normalized.includes("france") ||
    normalized.includes("netherlands") ||
    normalized.includes("belgium") ||
    normalized.includes("italy") ||
    normalized.includes("spain")
  ) {
    return "eu";
  }

  return "other";
};

const resolveNearestHub = (
  coordinates: {lat: number;lng: number;},
  hubs: RouteHub[]) => {
  if (!hubs.length) return null as RouteHub | null;

  let nearest = hubs[0];
  let nearestDistance = haversineDistanceKm(coordinates, {
    lat: nearest.lat,
    lng: nearest.lng
  });

  for (let index = 1; index < hubs.length; index += 1) {
    const candidate = hubs[index];
    const distance = haversineDistanceKm(coordinates, {
      lat: candidate.lat,
      lng: candidate.lng
    });
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
};

const buildBoundaryHubs = (shipment: LogisticsShipmentDetail) => {
  if (shipment.legs.length <= 1) return [] as Array<RouteHub | null>;

  const originCoordinates = resolveCoordinates(shipment.origin);
  const destinationCoordinates = resolveCoordinates(shipment.destination);
  const destinationMarket = inferDestinationMarketKey(shipment.destination);
  const destinationHubs =
    DESTINATION_HUBS_BY_MARKET[destinationMarket] ||
    DESTINATION_HUBS_BY_MARKET.other ||
    [];

  const hubs: Array<RouteHub | null> = [];

  for (let boundaryIndex = 1; boundaryIndex < shipment.legs.length; boundaryIndex += 1) {
    const previousLeg = shipment.legs[boundaryIndex - 1];
    const nextLeg = shipment.legs[boundaryIndex];
    const previousMode = previousLeg.transportMode;
    const nextMode = nextLeg.transportMode;

    let modeForHub: LogisticsTransportMode | null = null;
    let useOriginSideHub = false;

    if (previousMode === "road" && nextMode !== "road") {
      modeForHub = nextMode;
      useOriginSideHub = true;
    } else if (previousMode !== "road" && nextMode === "road") {
      modeForHub = previousMode;
      useOriginSideHub = false;
    } else if (previousMode !== "road") {
      modeForHub = previousMode;
      useOriginSideHub = false;
    } else if (nextMode !== "road") {
      modeForHub = nextMode;
      useOriginSideHub = true;
    }

    if (!modeForHub) {
      hubs.push(null);
      continue;
    }

    const hubKind = toHubKindByTransportMode(modeForHub);
    if (!hubKind) {
      hubs.push(null);
      continue;
    }

    const candidateHubs = (
      useOriginSideHub ? VIETNAM_TRANSFER_HUBS : destinationHubs
    ).filter((hub) => hub.kind === hubKind);

    const nearestHub = resolveNearestHub(
      useOriginSideHub ? originCoordinates : destinationCoordinates,
      candidateHubs
    );

    hubs.push(nearestHub);
  }

  return hubs;
};

const hubKindToTransportLocationType = (
  kind: RouteHubKind
): TransportLeg["origin"]["type"] => {
  switch (kind) {
    case "airport":
      return "airport";
    case "port":
      return "port";
    case "rail_terminal":
      return "rail_terminal";
    default:
      return "warehouse";
  }
};

const sanitizeTransitPlaceholder = (
  label: string | null,
  replacement: string) => {
  if (!label) return null;
  const trimmed = label.trim();
  if (TRANSIT_LABEL_PATTERN.test(trimmed)) {
    return replacement;
  }
  return trimmed;
};

const resolveLegProgressDistances = (shipment: LogisticsShipmentDetail) => {
  const rawDistances = shipment.legs.map((leg) => Math.max(0, leg.distanceKm));
  const knownDistance = rawDistances.reduce((sum, distance) => sum + distance, 0);
  const unknownCount = rawDistances.filter((distance) => distance <= 0).length;

  if (unknownCount === 0) {
    return rawDistances;
  }

  const remainingDistance = Math.max(0, shipment.totalDistanceKm - knownDistance);
  const fallbackDistancePerUnknown =
  remainingDistance > 0 ?
  remainingDistance / unknownCount :
  knownDistance > 0 ?
  knownDistance / shipment.legs.length :
  shipment.totalDistanceKm > 0 ?
  shipment.totalDistanceKm / shipment.legs.length :
  1;

  return rawDistances.map((distance) =>
  distance > 0 ? distance : fallbackDistancePerUnknown
  );
};

const estimateProgress = (
status: LogisticsShipmentStatus,
createdAt: string,
pendingUntil: string | null,
estimatedArrivalAt: string | null,
estimatedArrival: string | null) =>
{
  if (status === "pending" || status === "cancelled") {
    return 0;
  }
  if (status === "delivered") {
    return 100;
  }

  const transitStart = pendingUntil || createdAt;
  const eta = estimatedArrivalAt || estimatedArrival;

  if (!eta) {
    return 50;
  }

  const created = toComparableTime(transitStart);
  const etaTime = toComparableTime(eta);
  const now = Date.now();
  if (!Number.isFinite(created) || !Number.isFinite(etaTime) || etaTime <= created) {
    return 50;
  }

  const progress = (now - created) / (etaTime - created) * 100;
  return Math.max(5, Math.min(99, Math.round(progress)));
};

const defaultLegType = (
origin: LogisticsLocation,
destination: LogisticsLocation)
: TransportLeg["type"] => {
  const sameCountry =
  origin.country.trim().toLowerCase() === destination.country.trim().toLowerCase() &&
  origin.country.trim().length > 0;
  return sameCountry ? "domestic" : "international";
};

export const formatShipmentLocation = locationLabel;

export const toTrackShipmentStatus = (status: LogisticsShipmentStatus) => status;

export const toTransportLegs = (shipment: LogisticsShipmentDetail): TransportLeg[] => {
  const originCoordinates = resolveCoordinates(shipment.origin);
  const destinationCoordinates = resolveCoordinates(shipment.destination);
  const shipmentType = defaultLegType(shipment.origin, shipment.destination);
  const fallbackRoadFactor = DEFAULT_EMISSION_FACTOR_BY_MODE.road;
  const directRouteDistanceKm = haversineDistanceKm(
    originCoordinates,
    destinationCoordinates
  );

  if (!shipment.legs.length) {
    const inferredDistanceKm =
    shipment.totalDistanceKm > 0 && directRouteDistanceKm > 0 ?
    Math.max(shipment.totalDistanceKm, directRouteDistanceKm) :
    shipment.totalDistanceKm > 0 ?
    shipment.totalDistanceKm :
    directRouteDistanceKm > 0 ?
    directRouteDistanceKm :
    shipment.totalCo2e > 0 ?
    shipment.totalCo2e / fallbackRoadFactor :
    0;
    const emissionFactor =
    shipment.totalDistanceKm > 0 ?
    shipment.totalCo2e / shipment.totalDistanceKm :
    fallbackRoadFactor;
    const co2Kg =
    shipment.totalCo2e > 0 ?
    shipment.totalCo2e :
    inferredDistanceKm * emissionFactor;

    return [
    {
      id: `${shipment.id}-leg-1`,
      legNumber: 1,
      type: shipmentType,
      mode: "truck_heavy",
      origin: {
        name: formatShipmentLocation(shipment.origin),
        lat: originCoordinates.lat,
        lng: originCoordinates.lng,
        type: "address"
      },
      destination: {
        name: formatShipmentLocation(shipment.destination),
        lat: destinationCoordinates.lat,
        lng: destinationCoordinates.lng,
        type: "warehouse"
      },
      distanceKm: inferredDistanceKm,
      emissionFactor,
      co2Kg,
      routeType: "road",
      geometry: buildTransportRouteGeometry({
        mode: "truck_heavy",
        routeType: "road",
        origin: {
          lat: originCoordinates.lat,
          lng: originCoordinates.lng
        },
        destination: {
          lat: destinationCoordinates.lat,
          lng: destinationCoordinates.lng
        },
        originType: "address",
        destinationType: "warehouse"
      })
    }];

  }

  const progressDistances = resolveLegProgressDistances(shipment);
  const totalProgressDistance = progressDistances.reduce((sum, distance) => sum + distance, 0);
  const boundaryHubs = buildBoundaryHubs(shipment);
  const shouldSynthesizeLegLabels =
  shipment.legs.length > 1 &&
  shipment.legs.every((leg) => {
    const origin = asNullableString(leg.originLocation);
    const destination = asNullableString(leg.destinationLocation);
    if (!origin || !destination) return false;
    return (
    locationLabelMatches(origin, shipment.origin) &&
    locationLabelMatches(destination, shipment.destination)
    );
  });

  let traversedDistance = 0;

  return shipment.legs.map((leg, index) => {
    const totalLegs = shipment.legs.length;
    const legProgressDistance = progressDistances[index] || 0;
    const startProgress = totalLegs > 1 ?
    totalProgressDistance > 0 ?
    Math.max(0, Math.min(1, traversedDistance / totalProgressDistance)) :
    index / totalLegs :
    0;
    const endProgress = totalLegs > 1 ?
    totalProgressDistance > 0 ?
    Math.max(0, Math.min(1, (traversedDistance + legProgressDistance) / totalProgressDistance)) :
    (index + 1) / totalLegs :
    1;
    const interpolatedOriginPoint = interpolate(
      originCoordinates,
      destinationCoordinates,
      startProgress
    );
    const interpolatedDestinationPoint = interpolate(
      originCoordinates,
      destinationCoordinates,
      endProgress
    );
    traversedDistance += legProgressDistance;

    const boundaryHubBefore = index > 0 ? boundaryHubs[index - 1] : null;
    const boundaryHubAfter = index < totalLegs - 1 ? boundaryHubs[index] : null;
    const boundaryLabelBefore = boundaryHubBefore?.label || null;
    const boundaryLabelAfter = boundaryHubAfter?.label || null;

    const fallbackOriginPoint =
    index === 0 ?
    originCoordinates :
    boundaryHubBefore ?
    { lat: boundaryHubBefore.lat, lng: boundaryHubBefore.lng } :
    interpolatedOriginPoint;
    const fallbackDestinationPoint =
    index === totalLegs - 1 ?
    destinationCoordinates :
    boundaryHubAfter ?
    { lat: boundaryHubAfter.lat, lng: boundaryHubAfter.lng } :
    interpolatedDestinationPoint;

    const fallbackOriginName =
    index === 0 ?
    formatShipmentLocation(shipment.origin) :
    boundaryLabelBefore || `Transit ${index}`;
    const fallbackDestinationName =
    index === totalLegs - 1 ?
    formatShipmentLocation(shipment.destination) :
    boundaryLabelAfter || `Transit ${index + 1}`;

    const originCandidate =
    shouldSynthesizeLegLabels ?
    fallbackOriginName :
    asNullableString(leg.originLocation) || fallbackOriginName;
    const destinationCandidate =
    shouldSynthesizeLegLabels ?
    fallbackDestinationName :
    asNullableString(leg.destinationLocation) || fallbackDestinationName;

    const originName =
    sanitizeTransitPlaceholder(originCandidate, fallbackOriginName) || fallbackOriginName;
    const destinationName =
    sanitizeTransitPlaceholder(destinationCandidate, fallbackDestinationName) || fallbackDestinationName;

    const mode = modeToTransportLegMode(leg.transportMode);
    const routeType = modeToRouteType(leg.transportMode);
    const fallbackDistancePerLeg =
    shipment.totalDistanceKm > 0 ? shipment.totalDistanceKm / totalLegs : 0;
    const emissionFactor = resolveLegEmissionFactor(leg);
    const distanceKm = resolveLegDistanceKm(
      leg,
      fallbackDistancePerLeg,
      fallbackOriginPoint,
      fallbackDestinationPoint
    );
    const co2Kg = resolveLegCo2Kg(leg, distanceKm, emissionFactor);

    const originLocation = {
      name: originName,
      lat: fallbackOriginPoint.lat,
      lng: fallbackOriginPoint.lng,
      type:
      boundaryHubBefore ?
      hubKindToTransportLocationType(boundaryHubBefore.kind) :
      mode === "ship" ?
      "port" :
      mode === "air" ?
      "airport" :
      "address"
    } satisfies TransportLeg["origin"];

    const destinationLocation = {
      name: destinationName,
      lat: fallbackDestinationPoint.lat,
      lng: fallbackDestinationPoint.lng,
      type:
      boundaryHubAfter ?
      hubKindToTransportLocationType(boundaryHubAfter.kind) :
      mode === "ship" ?
      "port" :
      mode === "air" ?
      "airport" :
      "warehouse"
    } satisfies TransportLeg["destination"];

    return {
      id: leg.id || `${shipment.id}-leg-${index + 1}`,
      legNumber: Math.max(1, leg.legOrder || index + 1),
      type: shipmentType,
      mode,
      origin: originLocation,
      destination: destinationLocation,
      distanceKm,
      emissionFactor,
      co2Kg,
      routeType,
      geometry: buildTransportRouteGeometry({
        mode,
        routeType,
        origin: {
          lat: originLocation.lat,
          lng: originLocation.lng
        },
        destination: {
          lat: destinationLocation.lat,
          lng: destinationLocation.lng
        },
        originType: originLocation.type,
        destinationType: destinationLocation.type
      })
    };
  });
};

export const inferShipmentProgress = (
shipment: LogisticsShipmentSummary | LogisticsShipmentDetail) =>
estimateProgress(
  shipment.status,
  shipment.createdAt,
  shipment.pendingUntil,
  shipment.estimatedArrivalAt,
  shipment.estimatedArrival
);

export const resolveShipmentEta = (
shipment: LogisticsShipmentSummary | LogisticsShipmentDetail) =>
shipment.actualArrivalAt ||
shipment.estimatedArrivalAt ||
shipment.actualArrival ||
shipment.estimatedArrival;

export const fetchLogisticsShipments = async (
query: LogisticsShipmentListQuery = {})
: Promise<LogisticsShipmentListResult> => {
  const safePageSize = toSafePageSize(query.page_size, 20);
  const queryString = toQueryString({
    search: query.search,
    status: query.status,
    transport_mode: query.transport_mode,
    date_from: query.date_from,
    date_to: query.date_to,
    page: toSafePage(query.page, 1),
    page_size: safePageSize,
    sort_by: query.sort_by,
    sort_order: query.sort_order
  });

  const requestPaths = [
  `/logistics/shipments${queryString}`,
  `/shipments${queryString}`];


  let lastError: unknown;
  for (const path of requestPaths) {
    try {
      const payload = await api.get<unknown>(path, {
        disableResponseCache: true
      });
      return normalizeShipmentsListPayload(payload);
    } catch (error) {
      const notFound = isApiError(error) && error.status === 404;
      if (notFound && path !== requestPaths[requestPaths.length - 1]) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Unable to load shipments.");
};

export const fetchAllLogisticsShipments = async (
query: Omit<ShipmentListRequestQuery, "page"> = {})
: Promise<LogisticsShipmentSummary[]> => {
  const allShipments: LogisticsShipmentSummary[] = [];
  let page = 1;
  // Default to the max page size (100) for the aggregate "fetch all" loop so a
  // full listing is 1 round-trip per 100 shipments instead of per 20. Callers can
  // still pass a smaller page_size explicitly; the sort-fallback path below resets
  // to a conservative 20 only when the server rejects the sort clause.
  let pageSize = toSafePageSize(query.page_size, 100);
  let disableSort = false;

  while (true) {
    let response: LogisticsShipmentListResult;
    try {
      response = await fetchLogisticsShipments({
        ...query,
        page,
        page_size: pageSize,
        sort_by: disableSort ? undefined : query.sort_by,
        sort_order: disableSort ? undefined : query.sort_order
      });
    } catch (error) {

      if (!disableSort && isApiError(error) && error.status === 400) {
        disableSort = true;
        pageSize = 20;
        response = await fetchLogisticsShipments({
          ...query,
          page,
          page_size: pageSize
        });
      } else {
        throw error;
      }
    }

    allShipments.push(...response.items);
    if (page >= response.pagination.total_pages || response.items.length === 0) {
      break;
    }
    page += 1;
  }

  return allShipments;
};

export const fetchLogisticsShipmentById = async (
shipmentId: string)
: Promise<LogisticsShipmentDetail> => {
  const requestPaths = [
  `/logistics/shipments/${shipmentId}`,
  `/shipments/${shipmentId}`];


  let lastError: unknown;
  for (const path of requestPaths) {
    try {
      const payload = await api.get<unknown>(path, {
        disableResponseCache: true
      });
      const normalized = normalizeShipmentDetail(payload);
      if (!normalized) {
        throw new Error("Shipment not found.");
      }
      return normalized;
    } catch (error) {
      const notFound = isApiError(error) && error.status === 404;
      if (notFound && path !== requestPaths[requestPaths.length - 1]) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Shipment not found.");
};

export const fetchAllLogisticsShipmentDetails = async (
query: Omit<LogisticsShipmentListQuery, "page" | "page_size"> = {})
: Promise<LogisticsShipmentDetail[]> => {
  const summaries = await fetchAllLogisticsShipments(query);
  const tasks = summaries.map((summary) => async () => {
    if (!isValidUuid(summary.id)) {
      return {
        ...summary,
        companyId: "",
        legs: [],
        products: []
      } as LogisticsShipmentDetail;
    }
    try {
      return await fetchLogisticsShipmentById(summary.id);
    } catch {
      return {
        ...summary,
        companyId: "",
        legs: [],
        products: []
      } as LogisticsShipmentDetail;
    }
  });
  return runWithConcurrency(tasks, 5);
};

export const createLogisticsShipment = async (
payload: CreateShipmentPayload)
: Promise<ShipmentMutationResult> => {
  const response = await api.post<unknown>("/logistics/shipments", payload);
  invalidateApiResponseCache("shipment-created");
  return normalizeMutationPayload(response);
};

export const updateLogisticsShipment = async (
shipmentId: string,
payload: UpdateShipmentPayload)
: Promise<ShipmentMutationResult> => {
  const response = await api.patch<unknown>(`/logistics/shipments/${shipmentId}`, payload);
  invalidateApiResponseCache("shipment-updated");
  return normalizeMutationPayload(response);
};

export const updateLogisticsShipmentStatus = async (
shipmentId: string,
status: LogisticsShipmentStatus,
actualArrival?: string)
: Promise<ShipmentMutationResult> => {
  const response = await api.patch<unknown>(
    `/logistics/shipments/${shipmentId}/status`,
    {
      status,
      actual_arrival: actualArrival
    }
  );
  invalidateApiResponseCache("shipment-status-updated");
  return normalizeMutationPayload(response);
};

export const replaceLogisticsShipmentLegs = async (
shipmentId: string,
legs: ShipmentLegInput[])
: Promise<ShipmentMutationResult> => {
  const response = await api.put<unknown>(
    `/logistics/shipments/${shipmentId}/legs`,
    { legs }
  );
  invalidateApiResponseCache("shipment-legs-replaced");
  return normalizeMutationPayload(response);
};

export const replaceLogisticsShipmentProducts = async (
shipmentId: string,
products: ShipmentProductInput[])
: Promise<ShipmentMutationResult> => {
  const response = await api.put<unknown>(
    `/logistics/shipments/${shipmentId}/products`,
    { products }
  );
  invalidateApiResponseCache("shipment-products-replaced");
  return normalizeMutationPayload(response);
};

export const fetchLogisticsOverview = async (): Promise<LogisticsOverview> => {
  const payload = await api.get<unknown>("/logistics/overview", {
    disableResponseCache: true
  });
  if (!isObject(payload)) {
    return {
      totalShipments: 0,
      pending: 0,
      inTransit: 0,
      delivered: 0,
      cancelled: 0,
      totalCo2e: 0
    };
  }

  return {
    totalShipments: Math.max(0, Math.trunc(asNumber(payload.totalShipments ?? payload.total_shipments))),
    pending: Math.max(0, Math.trunc(asNumber(payload.pending))),
    inTransit: Math.max(0, Math.trunc(asNumber(payload.inTransit ?? payload.in_transit))),
    delivered: Math.max(0, Math.trunc(asNumber(payload.delivered))),
    cancelled: Math.max(0, Math.trunc(asNumber(payload.cancelled))),
    totalCo2e: Math.max(0, asNumber(payload.totalCo2e ?? payload.total_co2e))
  };
};
