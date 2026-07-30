"use client";

import type { DemoDataset } from "@/lib/demo/schema";
import type {
  AddBatchItemPayload,
  BulkImportResult,
  BulkValidationResult,
  CreateBatchPayload,
  Pagination,
  ProductBatchDetail,
  ProductBatchItem,
  ProductBatchListQuery,
  ProductBatchListResult,
  ProductMutationResult,
  ProductRecord,
  ProductSaveMode,
  ProductStatus,
  ProductListQuery,
  ProductListResult,
  PublishBatchResult,
  UpdateBatchItemPayload,
  UpdateBatchPayload,
} from "@/lib/productsApi";
import type { AddressInput, ProductAssessmentData } from "@/components/dashboard/assessment/steps/types";
import { createDemoShipment, cascadeProductRemovalFromShipments } from "@/lib/demo/domain/logistics";
import { syncDemoComplianceForPublishedProduct } from "@/lib/demo/domain/export";

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const nowIso = () => new Date().toISOString();

const asBatch = (value: unknown) => value as ProductBatchDetail;
const asProductArray = (value: DemoDataset["products"]) => value as unknown as ProductRecord[];
const asBatchArray = (value: DemoDataset["batches"]) => value as unknown as ProductBatchDetail[];

type SupportedTransportMode = "road" | "sea" | "air" | "rail";

const DEFAULT_TRANSPORT_FACTOR_BY_MODE: Record<SupportedTransportMode, number> = {
  road: 0.105,
  sea: 0.016,
  air: 0.602,
  rail: 0.028,
};

const MODE_DISTANCE_MULTIPLIER: Record<SupportedTransportMode, number> = {
  road: 1.18,
  sea: 1.05,
  air: 1,
  rail: 1.1,
};

const DESTINATION_MARKET_FALLBACK_DISTANCE_KM: Record<string, number> = {
  vietnam: 500,
  vn: 500,
  domestic: 500,
  usa: 14000,
  us: 14000,
  unitedstates: 14000,
  korea: 3200,
  kr: 3200,
  japan: 3500,
  jp: 3500,
  eu: 10000,
  europe: 10000,
  china: 2500,
  cn: 2500,
  other: 5000,
};

const UNKNOWN_ORIGIN_LABEL = "Factory";
const UNKNOWN_DESTINATION_LABEL = "Warehouse";

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceKm = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
) => {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const roundTo = (value: number, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const normalizeToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizeTransportMode = (value: unknown): SupportedTransportMode | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "road" ||
    normalized === "sea" ||
    normalized === "air" ||
    normalized === "rail"
  ) {
    return normalized;
  }
  return null;
};

const normalizeTransportModes = (input: unknown[]): SupportedTransportMode[] => {
  return input
    .map((mode) => normalizeTransportMode(mode))
    .filter((mode): mode is SupportedTransportMode => Boolean(mode));
};

const withFallbackTransportModes = (modes: SupportedTransportMode[]) =>
  modes.length > 0 ? modes : (["road"] as SupportedTransportMode[]);

const isAddressUseful = (address: AddressInput | null | undefined) => {
  if (!address) return false;
  if (typeof address.lat === "number" && Number.isFinite(address.lat)) return true;
  if (typeof address.lng === "number" && Number.isFinite(address.lng)) return true;
  return [
    address.aptSuite,
    address.streetNumber,
    address.street,
    address.ward,
    address.district,
    address.city,
    address.stateRegion,
    address.country,
    address.postalCode,
  ].some((part) => String(part || "").trim().length > 0);
};

const cloneAddress = (address: AddressInput): AddressInput => ({
  aptSuite: address.aptSuite || "",
  streetNumber: address.streetNumber || "",
  street: address.street || "",
  ward: address.ward || "",
  district: address.district || "",
  city: address.city || "",
  stateRegion: address.stateRegion || "",
  country: address.country || "",
  postalCode: address.postalCode || "",
  lat:
    typeof address.lat === "number" && Number.isFinite(address.lat) ?
      address.lat :
      undefined,
  lng:
    typeof address.lng === "number" && Number.isFinite(address.lng) ?
      address.lng :
      undefined,
});

const resolveAddressCountry = (address: AddressInput) =>
  (address.country || "").trim() || "Vietnam";

const resolveAddressCity = (address: AddressInput) =>
  (address.city || "").trim() ||
  (address.stateRegion || "").trim() ||
  (address.district || "").trim() ||
  resolveAddressCountry(address);

const toAddressLabel = (address: AddressInput, fallback: string) => {
  const parts = [
    address.aptSuite,
    address.streetNumber,
    address.street,
    address.ward,
    address.district,
    address.city,
    address.stateRegion,
    address.country,
  ]
    .map((part) => (part || "").trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : fallback;
};

const inferRouteDistanceKm = (
  originAddress: AddressInput,
  destinationAddress: AddressInput,
  destinationMarket?: string
) => {
  if (
    typeof originAddress.lat === "number" &&
    Number.isFinite(originAddress.lat) &&
    typeof originAddress.lng === "number" &&
    Number.isFinite(originAddress.lng) &&
    typeof destinationAddress.lat === "number" &&
    Number.isFinite(destinationAddress.lat) &&
    typeof destinationAddress.lng === "number" &&
    Number.isFinite(destinationAddress.lng)
  ) {
    const coordinateDistance = haversineDistanceKm(
      { lat: originAddress.lat, lng: originAddress.lng },
      { lat: destinationAddress.lat, lng: destinationAddress.lng }
    );
    if (coordinateDistance > 0) {
      return coordinateDistance;
    }
  }

  const marketKey = normalizeToken(destinationMarket);
  if (marketKey && DESTINATION_MARKET_FALLBACK_DISTANCE_KM[marketKey]) {
    return DESTINATION_MARKET_FALLBACK_DISTANCE_KM[marketKey];
  }

  const sameCountry =
    normalizeToken(originAddress.country) &&
    normalizeToken(originAddress.country) === normalizeToken(destinationAddress.country);
  if (sameCountry) {
    return 120;
  }

  return 5000;
};

const estimateLegDistancesByModes = (
  modes: SupportedTransportMode[],
  baseDistanceKm: number
) => {
  const safeModes = modes.length > 0 ? modes : (["road"] as SupportedTransportMode[]);
  const normalizedBaseDistance = Math.max(10, baseDistanceKm);
  if (safeModes.length === 1) {
    const mode = safeModes[0];
    return [Math.max(10, Math.round(normalizedBaseDistance * MODE_DISTANCE_MULTIPLIER[mode]))];
  }

  const hasLongHaul = safeModes.some((mode) => mode !== "road");
  const roadIndices = safeModes.reduce<number[]>((indices, mode, index) => {
    if (mode === "road") {
      indices.push(index);
    }
    return indices;
  }, []);
  const nonRoadIndices = safeModes.reduce<number[]>((indices, mode, index) => {
    if (mode !== "road") {
      indices.push(index);
    }
    return indices;
  }, []);

  const distances = Array.from({ length: safeModes.length }, () => 0);

  if (hasLongHaul && nonRoadIndices.length > 0) {
    const totalRouteDistance = Math.max(100, normalizedBaseDistance * 1.04);
    const feederDistanceKm = clamp(totalRouteDistance * 0.08, 10, 150);

    for (const index of roadIndices) {
      const previousMode = index > 0 ? safeModes[index - 1] : null;
      const nextMode = index < safeModes.length - 1 ? safeModes[index + 1] : null;
      const hasLongHaulNeighbor =
        previousMode !== null && previousMode !== "road" ||
        nextMode !== null && nextMode !== "road";
      distances[index] = hasLongHaulNeighbor ? feederDistanceKm : clamp(totalRouteDistance * 0.05, 10, 120);
    }

    const roadDistanceTotal = distances.reduce((sum, distance) => sum + distance, 0);
    const minimumLongHaulDistance = nonRoadIndices.length * 50;
    const distributableDistance = Math.max(
      minimumLongHaulDistance,
      totalRouteDistance - roadDistanceTotal
    );
    const totalLongHaulWeight = nonRoadIndices.reduce(
      (sum, index) => sum + MODE_DISTANCE_MULTIPLIER[safeModes[index]],
      0
    );

    for (const index of nonRoadIndices) {
      const mode = safeModes[index];
      const weightedDistance = distributableDistance * (
        MODE_DISTANCE_MULTIPLIER[mode] / totalLongHaulWeight
      );
      distances[index] = Math.max(50, weightedDistance);
    }

    return distances.map((distance) => Math.max(10, Math.round(distance)));
  }

  const weightedRouteDistance = Math.max(10 * safeModes.length, normalizedBaseDistance * 1.12);
  const totalWeight = safeModes.reduce(
    (sum, mode) => sum + MODE_DISTANCE_MULTIPLIER[mode],
    0
  );

  return safeModes.map((mode) =>
    Math.max(10, Math.round(weightedRouteDistance * (MODE_DISTANCE_MULTIPLIER[mode] / totalWeight)))
  );
};

const inferBatchTransportModesFromItems = (
  batch: ProductBatchDetail,
  productsById: Map<string, ProductRecord>
): SupportedTransportMode[] => {
  const explicitModes = withFallbackTransportModes(normalizeTransportModes(batch.transportModes || []));
  const inferredModeSequences = new Map<string, { modes: SupportedTransportMode[]; count: number }>();

  for (const item of batch.items) {
    const product = productsById.get(item.productId);
    if (!product) continue;
    const productModes = normalizeTransportModes((product.transportLegs || []).map((leg) => leg.mode));
    if (productModes.length === 0) continue;
    const key = productModes.join(">");
    const current = inferredModeSequences.get(key);
    if (current) {
      current.count += 1;
    } else {
      inferredModeSequences.set(key, { modes: productModes, count: 1 });
    }
  }

  let bestInferredModes: SupportedTransportMode[] = [];
  let bestInferredCount = 0;

  for (const candidate of inferredModeSequences.values()) {
    const shouldPromote =
      candidate.count > bestInferredCount ||
      candidate.count === bestInferredCount && candidate.modes.length > bestInferredModes.length;
    if (shouldPromote) {
      bestInferredModes = candidate.modes;
      bestInferredCount = candidate.count;
    }
  }

  const explicitRoadOnly = explicitModes.every((mode) => mode === "road");
  const inferredHasLongHaul = bestInferredModes.some((mode) => mode !== "road");
  if (explicitRoadOnly && inferredHasLongHaul) {
    return bestInferredModes;
  }
  if (explicitModes.length > 0) {
    return explicitModes;
  }
  if (bestInferredModes.length > 0) {
    return bestInferredModes;
  }
  return ["road"];
};

const resolveBatchRouteContext = (
  batch: ProductBatchDetail,
  productsById: Map<string, ProductRecord>
) => {
  const transportModes = inferBatchTransportModesFromItems(batch, productsById);

  let originAddress = isAddressUseful(batch.originAddress) && batch.originAddress ?
    cloneAddress(batch.originAddress) :
    null;
  let destinationAddress = isAddressUseful(batch.destinationAddress) && batch.destinationAddress ?
    cloneAddress(batch.destinationAddress) :
    null;
  let destinationMarket = (batch.destinationMarket || "").trim();

  for (const item of batch.items) {
    const product = productsById.get(item.productId);
    if (!product) continue;
    if (!originAddress && isAddressUseful(product.originAddress)) {
      originAddress = cloneAddress(product.originAddress);
    }
    if (!destinationAddress && isAddressUseful(product.destinationAddress)) {
      destinationAddress = cloneAddress(product.destinationAddress);
    }
    const productDestinationMarket = (product.destinationMarket || "").trim();
    const currentDestinationToken = normalizeToken(destinationMarket);
    const currentIsDefaultDomestic =
      !currentDestinationToken ||
      currentDestinationToken === "vietnam" ||
      currentDestinationToken === "vn";
    if (
      productDestinationMarket &&
      (!destinationMarket ||
        currentIsDefaultDomestic &&
          normalizeToken(productDestinationMarket) !== "vietnam" &&
          normalizeToken(productDestinationMarket) !== "vn")
    ) {
      destinationMarket = productDestinationMarket;
    }
    if (originAddress && destinationAddress && destinationMarket) {
      break;
    }
  }

  if (!originAddress || !destinationAddress) {
    return null;
  }

  return {
    originAddress,
    destinationAddress,
    destinationMarket: destinationMarket || "vietnam",
    transportModes,
  };
};

const buildDemoShipmentLegs = (input: {
  originAddress: AddressInput;
  destinationAddress: AddressInput;
  destinationMarket: string;
  transportModes: SupportedTransportMode[];
}) => {
  const { originAddress, destinationAddress, destinationMarket, transportModes } = input;
  const estimatedBaseDistanceKm = inferRouteDistanceKm(
    originAddress,
    destinationAddress,
    destinationMarket
  );
  const distancesByLeg = estimateLegDistancesByModes(transportModes, estimatedBaseDistanceKm);
  const originLabel = toAddressLabel(originAddress, UNKNOWN_ORIGIN_LABEL);
  const destinationLabel = toAddressLabel(destinationAddress, UNKNOWN_DESTINATION_LABEL);

  return transportModes.map((mode, index) => {
    const distanceKm = Math.max(1, distancesByLeg[index] || 0);
    const emissionFactor = DEFAULT_TRANSPORT_FACTOR_BY_MODE[mode];
    return {
      leg_order: index + 1,
      transport_mode: mode,
      origin_location: index === 0 ? originLabel : `Transit ${index}`,
      destination_location:
        index === transportModes.length - 1 ? destinationLabel : `Transit ${index + 1}`,
      distance_km: distanceKm,
      duration_hours: undefined,
      co2e: roundTo(Math.max(0, distanceKm * emissionFactor), 3),
      emission_factor_used: emissionFactor,
      carrier_name: "",
      vehicle_type: "",
    };
  });
};

const hasPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const hasProductLogisticsInput = (product: Pick<ProductRecord, "transportLegs" | "estimatedTotalDistance">) =>
  (product.transportLegs || []).length > 0 || hasPositiveNumber(product.estimatedTotalDistance);

const inferProductLegDistanceKm = (
  product: Pick<
    ProductRecord,
    "originAddress" | "destinationAddress" | "destinationMarket" | "estimatedTotalDistance"
  >
) =>
  hasPositiveNumber(product.estimatedTotalDistance) ?
    product.estimatedTotalDistance :
    inferRouteDistanceKm(
      product.originAddress,
      product.destinationAddress,
      product.destinationMarket
    );

const buildDemoShipmentLegsFromProduct = (
  product: Pick<
    ProductRecord,
    "originAddress" | "destinationAddress" | "destinationMarket" | "transportLegs" | "estimatedTotalDistance"
  >
) => {
  const originLabel = toAddressLabel(product.originAddress, UNKNOWN_ORIGIN_LABEL);
  const destinationLabel = toAddressLabel(product.destinationAddress, UNKNOWN_DESTINATION_LABEL);
  const inferredTotalDistance = inferProductLegDistanceKm(product);
  const explicitLegs = (product.transportLegs || []).filter((leg) => {
    const hasDistance = hasPositiveNumber(leg.estimatedDistance);
    const hasMode = Boolean(normalizeTransportMode(leg.mode));
    return hasDistance || hasMode;
  });

  if (explicitLegs.length === 0) {
    if (!hasPositiveNumber(inferredTotalDistance)) {
      return [];
    }
    const emissionFactor = DEFAULT_TRANSPORT_FACTOR_BY_MODE.road;
    return [
      {
        leg_order: 1,
        transport_mode: "road" as const,
        origin_location: originLabel,
        destination_location: destinationLabel,
        distance_km: Math.max(1, Math.round(inferredTotalDistance)),
        duration_hours: undefined,
        co2e: roundTo(inferredTotalDistance * emissionFactor, 3),
        emission_factor_used: emissionFactor,
        carrier_name: "",
        vehicle_type: "",
      },
    ];
  }

  const fallbackDistancePerLeg =
    hasPositiveNumber(inferredTotalDistance) ?
      inferredTotalDistance / explicitLegs.length :
      0;

  return explicitLegs.map((leg, index) => {
    const mode = normalizeTransportMode(leg.mode) || "road";
    const distanceKm = hasPositiveNumber(leg.estimatedDistance) ?
      leg.estimatedDistance :
      Math.max(1, fallbackDistancePerLeg);
    const emissionFactor = hasPositiveNumber(leg.emissionFactor) ?
      leg.emissionFactor :
      DEFAULT_TRANSPORT_FACTOR_BY_MODE[mode];
    const co2e = hasPositiveNumber(leg.co2Kg) ?
      leg.co2Kg :
      Math.max(0, distanceKm * emissionFactor);

    return {
      leg_order: index + 1,
      transport_mode: mode,
      origin_location: index === 0 ? originLabel : `Transit ${index}`,
      destination_location:
        index === explicitLegs.length - 1 ? destinationLabel : `Transit ${index + 1}`,
      distance_km: roundTo(Math.max(0, distanceKm), 3),
      duration_hours: undefined,
      co2e: roundTo(Math.max(0, co2e), 3),
      emission_factor_used: emissionFactor,
      carrier_name: "",
      vehicle_type: "",
    };
  });
};

const ensureDemoShipmentForPublishedProduct = (
  dataset: DemoDataset,
  productId: string
): string | null => {
  const product = getDemoProductById(dataset, productId);
  if (product.status !== "published") {
    return product.shipmentId || null;
  }
  if (product.shipmentId) {
    return product.shipmentId;
  }
  if (!hasProductLogisticsInput(product)) {
    return null;
  }

  const shipmentLegs = buildDemoShipmentLegsFromProduct(product);
  if (shipmentLegs.length === 0) {
    return null;
  }

  const safeQuantity = hasPositiveNumber(product.quantity) ? Math.max(1, Math.trunc(product.quantity)) : 1;
  const perUnitWeightKg = hasPositiveNumber(product.weightPerUnit) ? product.weightPerUnit / 1000 : 0;
  const totalWeightKg = roundTo(Math.max(0, perUnitWeightKg * safeQuantity), 4);
  const transportCo2 =
    hasPositiveNumber(product.carbonResults?.totalBatch?.transport) ?
      product.carbonResults.totalBatch.transport :
      shipmentLegs.reduce((sum, leg) => sum + Math.max(0, leg.co2e), 0);

  const shipment = createDemoShipment(dataset, {
    reference_number: `PRD-${(product.productCode || product.id).slice(0, 18)}-${Date.now().toString().slice(-6)}`,
    origin: {
      country: resolveAddressCountry(product.originAddress),
      city: resolveAddressCity(product.originAddress),
      address: toAddressLabel(product.originAddress, UNKNOWN_ORIGIN_LABEL),
      lat: product.originAddress.lat,
      lng: product.originAddress.lng,
    },
    destination: {
      country: resolveAddressCountry(product.destinationAddress),
      city: resolveAddressCity(product.destinationAddress),
      address: toAddressLabel(product.destinationAddress, UNKNOWN_DESTINATION_LABEL),
      lat: product.destinationAddress.lat,
      lng: product.destinationAddress.lng,
    },
    legs: shipmentLegs,
    products: [
      {
        product_id: product.id,
        quantity: safeQuantity,
        weight_kg: totalWeightKg,
        allocated_co2e: roundTo(Math.max(0, transportCo2), 4),
      },
    ],
  });

  const syncedProduct = getDemoProductById(dataset, product.id);
  return syncedProduct.shipmentId || shipment.id || null;
};

const buildCarbonResults = (product: ProductAssessmentData) => {
  const materialImpact = product.materials.reduce(
    (sum, material) => sum + (product.weightPerUnit / 1000) * (material.percentage / 100) * 3.2,
    0
  );
  const productionImpact = product.productionProcesses.length * 0.24 + 0.12;
  const energyImpact = product.energySources.reduce(
    (sum, source) => sum + (source.percentage / 100) * (source.source === "solar" ? 0.05 : 0.22),
    0
  );
  const transportImpact = product.transportLegs.reduce(
    (sum, leg) => sum + ((leg.estimatedDistance || 0) * (leg.emissionFactor || 0.016) * (product.weightPerUnit / 1_000_000)),
    0
  );
  const perProductTotal = Number((materialImpact + productionImpact + energyImpact + transportImpact).toFixed(3));
  const totalBatch = Number((perProductTotal * Math.max(1, product.quantity)).toFixed(3));
  return {
    perProduct: {
      materials: Number(materialImpact.toFixed(3)),
      production: Number(productionImpact.toFixed(3)),
      energy: Number(energyImpact.toFixed(3)),
      transport: Number(transportImpact.toFixed(3)),
      total: perProductTotal,
    },
    totalBatch: {
      materials: Number((materialImpact * product.quantity).toFixed(3)),
      production: Number((productionImpact * product.quantity).toFixed(3)),
      energy: Number((energyImpact * product.quantity).toFixed(3)),
      transport: Number((transportImpact * product.quantity).toFixed(3)),
      total: totalBatch,
    },
    confidenceLevel: "high" as const,
    confidenceScore: 88,
    proxyUsed: false,
    proxyNotes: [],
    scope1: Number((productionImpact * 0.3).toFixed(3)),
    scope2: Number((energyImpact * 0.8).toFixed(3)),
    scope3: Number((materialImpact + transportImpact).toFixed(3)),
  };
};

const toProductRecord = (
  payload: ProductAssessmentData,
  status: ProductStatus,
  existing?: ProductRecord
): ProductRecord => {
  const createdAt = existing?.createdAt || payload.createdAt || nowIso();
  const carbonResults = payload.carbonResults || buildCarbonResults(payload);
  return {
    id: existing?.id || createId(),
    productCode: payload.productCode,
    productName: payload.productName,
    productType: payload.productType,
    productCategory: payload.productCategory || "textile",
    weightPerUnit: payload.weightPerUnit,
    quantity: payload.quantity,
    materials: payload.materials,
    accessories: payload.accessories,
    productionProcesses: payload.productionProcesses,
    energySources: payload.energySources,
    manufacturingLocation: payload.manufacturingLocation,
    wasteRecovery: payload.wasteRecovery,
    destinationMarket: payload.destinationMarket,
    originAddress: payload.originAddress,
    destinationAddress: payload.destinationAddress,
    transportLegs: payload.transportLegs,
    estimatedTotalDistance: payload.estimatedTotalDistance,
    carbonResults,
    status,
    version: Math.max(1, existing?.version || payload.version || 1),
    shipmentId: existing?.shipmentId || null,
    createdAt,
    updatedAt: payload.updatedAt || nowIso(),
  };
};

const getPagination = (page: number, pageSize: number, total: number): Pagination => ({
  page,
  page_size: pageSize,
  total,
  total_pages: Math.max(1, Math.ceil(total / pageSize)),
});

const syncBatchTotals = (batch: ProductBatchDetail): ProductBatchDetail => {
  const totalQuantity = batch.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalWeight = batch.items.reduce((sum, item) => sum + item.weightKg * item.quantity, 0);
  const totalCO2 = batch.items.reduce((sum, item) => sum + item.co2PerUnit * item.quantity, 0);
  return {
    ...batch,
    totalProducts: batch.items.length,
    totalQuantity,
    totalWeight,
    totalCO2,
    updatedAt: nowIso(),
  };
};

export const getDemoProducts = (dataset: DemoDataset) => asProductArray(dataset.products);

export const listDemoProducts = (
  dataset: DemoDataset,
  query: ProductListQuery = {}
): ProductListResult => {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.max(1, query.page_size || 20);
  const search = String(query.search || "").trim().toLowerCase();
  let items = getDemoProducts(dataset);
  if (query.status && query.status !== "all") {
    items = items.filter((item) => item.status === query.status);
  }
  if (search) {
    items = items.filter(
      (item) =>
        item.productName.toLowerCase().includes(search) ||
        item.productCode.toLowerCase().includes(search) ||
        item.productType.toLowerCase().includes(search)
    );
  }
  const total = items.length;
  const pagination = getPagination(page, pageSize, total);
  return {
    items: items.slice((pagination.page - 1) * pageSize, pagination.page * pageSize),
    pagination,
  };
};

export const getDemoProductById = (dataset: DemoDataset, productId: string) => {
  const product = getDemoProducts(dataset).find((item) => item.id === productId);
  if (!product) {
    throw new Error("Product not found.");
  }
  return product;
};

// AI product-level suggestions (served for the "Gợi ý cải thiện" button on the product
// summary page). Shapes into the payload lib/chatApi.ts `generateProductSuggestions`
// expects. Defensive: never throws if the product id can't be resolved.
export const getDemoProductSuggestions = (dataset: DemoDataset, productId: string) => {
  const product = getDemoProducts(dataset).find((item) => item.id === productId) as
    | Record<string, unknown>
    | undefined;
  const productName =
    (product?.productName as string) || (product?.product_name as string) || "sản phẩm";

  const suggestions = [
    {
      id: `${productId}-sug-1`,
      type: "material",
      title: "Chuyển sang vật liệu tái chế / hữu cơ",
      description: `Thay thế một phần vật liệu nguyên sinh của ${productName} bằng cotton hữu cơ hoặc polyester tái chế (GRS) để giảm hệ số phát thải đầu vào.`,
      potentialReduction: 32,
      difficulty: "medium",
    },
    {
      id: `${productId}-sug-2`,
      type: "energy",
      title: "Điện tái tạo cho công đoạn sản xuất",
      description: "Lắp đặt điện mặt trời áp mái hoặc mua chứng chỉ năng lượng tái tạo (REC) để giảm phát thải Scope 2 tại nhà máy.",
      potentialReduction: 18,
      difficulty: "hard",
    },
    {
      id: `${productId}-sug-3`,
      type: "logistics",
      title: "Tối ưu tỷ lệ lấp đầy container",
      description: "Gộp lô hàng và tăng fill-rate container theo tuyến để giảm phát thải vận chuyển trên mỗi sản phẩm.",
      potentialReduction: 9,
      difficulty: "easy",
    },
  ];

  return {
    product_id: productId,
    suggestions,
    config_source: "demo",
  };
};

export const createDemoProduct = (
  dataset: DemoDataset,
  payload: ProductAssessmentData & { save_mode?: ProductSaveMode; status?: ProductStatus }
): ProductMutationResult => {
  const status = payload.save_mode === "publish" || payload.status === "published" ? "published" : "draft";
  const product = toProductRecord(payload, status);
  asProductArray(dataset.products).unshift(product);
  let shipmentId = product.shipmentId || null;
  if (product.status === "published") {
    shipmentId = ensureDemoShipmentForPublishedProduct(dataset, product.id);
    const syncedProduct = getDemoProductById(dataset, product.id);
    syncDemoComplianceForPublishedProduct(dataset, {
      productId: syncedProduct.id,
      productName: syncedProduct.productName,
      productType: syncedProduct.productType,
      quantity: syncedProduct.quantity,
      manufacturingLocation: syncedProduct.manufacturingLocation,
      destinationMarket: syncedProduct.destinationMarket,
      materials: syncedProduct.materials,
    });
  }
  return {
    id: product.id,
    status: product.status,
    version: product.version,
    updatedAt: product.updatedAt,
    shipmentId,
  };
};

export const updateDemoProduct = (
  dataset: DemoDataset,
  productId: string,
  payload: ProductAssessmentData
): ProductMutationResult => {
  const existing = getDemoProductById(dataset, productId);
  const next = toProductRecord(payload, existing.status, {
    ...existing,
    version: Math.max(existing.version + 1, payload.version || 1),
  });
  dataset.products = asProductArray(dataset.products).map((product) =>
    product.id === productId ? next : product
  ) as unknown as DemoDataset["products"];
  let shipmentId = next.shipmentId || null;
  if (next.status === "published") {
    shipmentId = ensureDemoShipmentForPublishedProduct(dataset, next.id) || shipmentId;
    const syncedProduct = getDemoProductById(dataset, next.id);
    syncDemoComplianceForPublishedProduct(dataset, {
      productId: syncedProduct.id,
      productName: syncedProduct.productName,
      productType: syncedProduct.productType,
      quantity: syncedProduct.quantity,
      manufacturingLocation: syncedProduct.manufacturingLocation,
      destinationMarket: syncedProduct.destinationMarket,
      materials: syncedProduct.materials,
    });
  }
  const resolvedProduct = getDemoProductById(dataset, productId);
  return {
    id: resolvedProduct.id,
    status: resolvedProduct.status,
    version: resolvedProduct.version,
    updatedAt: resolvedProduct.updatedAt,
    shipmentId,
  };
};

export const updateDemoProductStatus = (
  dataset: DemoDataset,
  productId: string,
  status: ProductStatus
): ProductMutationResult => {
  let nextProduct: ProductRecord | null = null;
  dataset.products = asProductArray(dataset.products).map((current) => {
    if (current.id !== productId) return current;
    nextProduct = {
      ...current,
      status,
      version: current.version + 1,
      updatedAt: nowIso(),
    };
    return nextProduct;
  }) as unknown as DemoDataset["products"];
  if (!nextProduct) {
    throw new Error("Product not found.");
  }
  let resolvedProduct = nextProduct as ProductRecord;
  if (resolvedProduct.status === "published") {
    const shipmentId = ensureDemoShipmentForPublishedProduct(dataset, resolvedProduct.id);
    if (shipmentId) {
      resolvedProduct = getDemoProductById(dataset, resolvedProduct.id);
    }
    syncDemoComplianceForPublishedProduct(dataset, {
      productId: resolvedProduct.id,
      productName: resolvedProduct.productName,
      productType: resolvedProduct.productType,
      quantity: resolvedProduct.quantity,
      manufacturingLocation: resolvedProduct.manufacturingLocation,
      destinationMarket: resolvedProduct.destinationMarket,
      materials: resolvedProduct.materials,
    });
  }
  return {
    id: resolvedProduct.id,
    status: resolvedProduct.status,
    version: resolvedProduct.version,
    updatedAt: resolvedProduct.updatedAt,
    shipmentId: resolvedProduct.shipmentId,
  };
};

export const deleteDemoProduct = (dataset: DemoDataset, productId: string) => {
  dataset.products = asProductArray(dataset.products).filter((product) => product.id !== productId) as unknown as DemoDataset["products"];
  dataset.batches = asBatchArray(dataset.batches)
    .map((rawBatch) => {
      const batch = asBatch(rawBatch);
      return syncBatchTotals({
        ...batch,
        items: batch.items.filter((item) => item.productId !== productId),
      });
    })
    .filter((batch) => batch.items.length > 0) as unknown as DemoDataset["batches"];
  cascadeProductRemovalFromShipments(dataset, productId);
};

export const validateDemoBulkImport = (rows: Record<string, unknown>[]): BulkValidationResult => ({
  isValid: true,
  totalRows: rows.length,
  validCount: rows.length,
  errorCount: 0,
  warningCount: 0,
  validRows: rows,
  invalidRows: [],
  warnings: [],
});

export const importDemoBulkRows = (
  dataset: DemoDataset,
  rows: Record<string, unknown>[],
  saveMode: ProductSaveMode
): BulkImportResult => {
  const ids: string[] = [];
  rows.forEach((row, index) => {
    const productName = String(row.product_name || row.productName || `Demo Product ${index + 1}`);
    const productCode = String(row.product_code || row.productCode || `DEMO-${Date.now().toString().slice(-4)}-${index + 1}`);
    const productType = String(row.product_type || row.productType || "tshirt");
    const quantity = Number(row.quantity || 100);
    const weightPerUnit = Number(row.weight_per_unit || row.weightPerUnit || 220);
    const destinationMarket = String(row.destination_market || row.destinationMarket || "vietnam");
    const originAddress: AddressInput = {
      streetNumber: "",
      street: String(row.origin_address || "Tan Hiep Industrial Park"),
      ward: "",
      district: "",
      city: String(row.origin_city || "Bien Hoa"),
      stateRegion: "",
      country: "Vietnam",
      postalCode: "",
      lat: 10.957471,
      lng: 106.85961,
    };
    const destinationAddress: AddressInput = {
      streetNumber: "",
      street: String(row.destination_address || "Distribution Center"),
      ward: "",
      district: "",
      city: String(row.destination_city || "Ho Chi Minh City"),
      stateRegion: "",
      country: destinationMarket === "vietnam" ? "Vietnam" : "Germany",
      postalCode: "",
      lat: destinationMarket === "vietnam" ? 10.8231 : 52.52,
      lng: destinationMarket === "vietnam" ? 106.6297 : 13.405,
    };
    const importTransportMode: SupportedTransportMode =
      destinationMarket === "vietnam" ? "road" : "sea";
    const importDistanceKm = estimateLegDistancesByModes(
      [importTransportMode],
      inferRouteDistanceKm(originAddress, destinationAddress, destinationMarket)
    )[0];
    const importEmissionFactor = DEFAULT_TRANSPORT_FACTOR_BY_MODE[importTransportMode];
    const payload: ProductAssessmentData = {
      productCode,
      productName,
      productType,
      productCategory: "textile",
      weightPerUnit,
      quantity,
      materials: [
        {
          id: createId(),
          materialType: String(row.primary_material || "cotton"),
          percentage: 100,
          source: "domestic",
          certifications: [],
        },
      ],
      accessories: [],
      productionProcesses: [String(row.process_type || "cutting_sewing")],
      energySources: [{ id: createId(), source: String(row.energy_source || "grid"), percentage: 100 }],
      manufacturingLocation: String(row.manufacturing_location || "Ho Chi Minh City, Vietnam"),
      wasteRecovery: String(row.waste_recovery || "partial"),
      destinationMarket,
      originAddress,
      destinationAddress,
      transportLegs: [
        {
          id: createId(),
          mode: importTransportMode,
          estimatedDistance: importDistanceKm,
          emissionFactor: importEmissionFactor,
          co2Kg: roundTo(importDistanceKm * importEmissionFactor, 3),
        },
      ],
      estimatedTotalDistance: importDistanceKm,
      carbonResults: undefined,
      status: saveMode === "publish" ? "published" : "draft",
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const result = createDemoProduct(dataset, { ...payload, save_mode: saveMode });
    ids.push(result.id);
  });

  return {
    imported: rows.length,
    failed: 0,
    errors: [],
    ids,
  };
};

const getDemoBatches = (dataset: DemoDataset) => asBatchArray(dataset.batches);

export const listDemoBatches = (
  dataset: DemoDataset,
  query: ProductBatchListQuery = {}
): ProductBatchListResult => {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.max(1, query.page_size || 20);
  const search = String(query.search || "").trim().toLowerCase();
  let items = getDemoBatches(dataset);
  if (query.status && query.status !== "all") {
    items = items.filter((batch) => batch.status === query.status);
  }
  if (search) {
    items = items.filter(
      (batch) =>
        batch.name.toLowerCase().includes(search) ||
        batch.description.toLowerCase().includes(search)
    );
  }
  const total = items.length;
  const pagination = getPagination(page, pageSize, total);
  return {
    items: items
      .slice((pagination.page - 1) * pageSize, pagination.page * pageSize)
      .map((batch) => {
        const { items: batchItems, ...summary } = batch;
        void batchItems;
        return summary;
      }),
    pagination,
  };
};

export const getDemoBatchById = (dataset: DemoDataset, batchId: string) => {
  const batch = getDemoBatches(dataset).find((item) => item.id === batchId);
  if (!batch) {
    throw new Error("Batch not found.");
  }
  return batch;
};

export const createDemoBatch = (dataset: DemoDataset, input: CreateBatchPayload): ProductBatchDetail => {
  const batch: ProductBatchDetail = syncBatchTotals({
    id: createId(),
    name: input.name,
    description: input.description || "",
    status: "draft",
    originAddress: input.originAddress as ProductBatchDetail["originAddress"],
    destinationAddress: input.destinationAddress as ProductBatchDetail["destinationAddress"],
    destinationMarket: input.destinationMarket || "vietnam",
    transportModes: input.transportModes || ["road"],
    shipmentId: null,
    totalProducts: 0,
    totalQuantity: 0,
    totalWeight: 0,
    totalCO2: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    items: [],
  });
  asBatchArray(dataset.batches).unshift(batch);
  return batch;
};

export const updateDemoBatch = (dataset: DemoDataset, batchId: string, input: UpdateBatchPayload): ProductBatchDetail => {
  dataset.batches = asBatchArray(dataset.batches).map((rawBatch) => {
    const batch = asBatch(rawBatch);
    if (batch.id !== batchId) return batch;
    return syncBatchTotals({
      ...batch,
      name: input.name || batch.name,
      description: input.description ?? batch.description,
      originAddress: (input.originAddress as ProductBatchDetail["originAddress"]) || batch.originAddress,
      destinationAddress:
        (input.destinationAddress as ProductBatchDetail["destinationAddress"]) || batch.destinationAddress,
      destinationMarket: input.destinationMarket || batch.destinationMarket,
      transportModes: input.transportModes || batch.transportModes,
    });
  }) as unknown as DemoDataset["batches"];
  return getDemoBatchById(dataset, batchId);
};

export const deleteDemoBatch = (dataset: DemoDataset, batchId: string) => {
  dataset.batches = asBatchArray(dataset.batches).filter((batch) => batch.id !== batchId) as unknown as DemoDataset["batches"];
};

export const addDemoBatchItem = (dataset: DemoDataset, batchId: string, payload: AddBatchItemPayload) => {
  const product = getDemoProductById(dataset, payload.product_id);
  dataset.batches = asBatchArray(dataset.batches).map((rawBatch) => {
    const batch = asBatch(rawBatch);
    if (batch.id !== batchId) return batch;
    const item: ProductBatchItem = {
      id: payload.product_id,
      productId: payload.product_id,
      productCode: product.productCode,
      productName: product.productName,
      productType: product.productType,
      quantity: payload.quantity,
      weightKg: payload.weight_kg || (product.weightPerUnit / 1000),
      co2PerUnit: payload.co2_per_unit || product.carbonResults?.perProduct?.total || 0,
    };
    const nextItems = [...batch.items.filter((entry) => entry.productId !== payload.product_id), item];
    return syncBatchTotals({ ...batch, items: nextItems });
  }) as unknown as DemoDataset["batches"];
};

export const updateDemoBatchItem = (
  dataset: DemoDataset,
  batchId: string,
  productId: string,
  payload: UpdateBatchItemPayload
) => {
  dataset.batches = asBatchArray(dataset.batches).map((rawBatch) => {
    const batch = asBatch(rawBatch);
    if (batch.id !== batchId) return batch;
    return syncBatchTotals({
      ...batch,
      items: batch.items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: payload.quantity ?? item.quantity,
              weightKg: payload.weight_kg ?? item.weightKg,
              co2PerUnit: payload.co2_per_unit ?? item.co2PerUnit,
            }
          : item
      ),
    });
  }) as unknown as DemoDataset["batches"];
};

export const removeDemoBatchItem = (dataset: DemoDataset, batchId: string, productId: string) => {
  dataset.batches = asBatchArray(dataset.batches).map((rawBatch) => {
    const batch = asBatch(rawBatch);
    if (batch.id !== batchId) return batch;
    return syncBatchTotals({
      ...batch,
      items: batch.items.filter((item) => item.productId !== productId),
    });
  }) as unknown as DemoDataset["batches"];
};

export const publishDemoBatch = (dataset: DemoDataset, batchId: string): PublishBatchResult => {
  const batch = getDemoBatchById(dataset, batchId);
  const productsById = new Map(
    asProductArray(dataset.products).map((product) => [product.id, product] as const)
  );
  const routeContext = resolveBatchRouteContext(batch, productsById);
  let shipmentId = batch.shipmentId;
  const publishedAt = nowIso();
  if (!shipmentId && batch.items.length > 0 && routeContext) {
    const { originAddress, destinationAddress, destinationMarket, transportModes } = routeContext;
    const result = createDemoShipment(dataset, {
      reference_number: `BAT-${batch.name.slice(0, 12)}-${Date.now().toString().slice(-4)}`,
      origin: {
        country: resolveAddressCountry(originAddress),
        city: resolveAddressCity(originAddress),
        address: toAddressLabel(originAddress, UNKNOWN_ORIGIN_LABEL),
        lat: originAddress.lat,
        lng: originAddress.lng,
      },
      destination: {
        country: resolveAddressCountry(destinationAddress),
        city: resolveAddressCity(destinationAddress),
        address: toAddressLabel(destinationAddress, UNKNOWN_DESTINATION_LABEL),
        lat: destinationAddress.lat,
        lng: destinationAddress.lng,
      },
      legs: buildDemoShipmentLegs({
        originAddress,
        destinationAddress,
        destinationMarket,
        transportModes,
      }),
      products: batch.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        weight_kg: item.weightKg,
        allocated_co2e: item.co2PerUnit * item.quantity,
      })),
    });
    shipmentId = result.id;
  }

  const publishedProductIds = new Set(batch.items.map((item) => item.productId));

  dataset.products = asProductArray(dataset.products).map((product) =>
    publishedProductIds.has(product.id) ?
      {
        ...product,
        status: "published",
        shipmentId: shipmentId || product.shipmentId || null,
        version: product.status === "published" ? product.version : product.version + 1,
        updatedAt: publishedAt,
      } :
      product
  ) as unknown as DemoDataset["products"];

  for (const product of asProductArray(dataset.products)) {
    if (!publishedProductIds.has(product.id)) continue;
    syncDemoComplianceForPublishedProduct(dataset, {
      productId: product.id,
      productName: product.productName,
      productType: product.productType,
      quantity: product.quantity,
      manufacturingLocation: product.manufacturingLocation,
      destinationMarket: product.destinationMarket,
      materials: product.materials,
    });
  }

  dataset.batches = asBatchArray(dataset.batches).map((rawBatch) => {
    const current = asBatch(rawBatch);
    if (current.id !== batchId) return current;
    return syncBatchTotals({
      ...current,
      status: "published",
      shipmentId: shipmentId || null,
      originAddress: routeContext?.originAddress || current.originAddress,
      destinationAddress: routeContext?.destinationAddress || current.destinationAddress,
      destinationMarket: routeContext?.destinationMarket || current.destinationMarket,
      transportModes: routeContext?.transportModes || current.transportModes,
      publishedAt,
    });
  }) as unknown as DemoDataset["batches"];

  return {
    id: batchId,
    status: "published",
    shipmentId: shipmentId || null,
    shipmentCreationSkipped: !shipmentId,
    updatedAt: publishedAt,
    publishedAt,
  };
};
