"use client";

import type { DemoDataset } from "@/lib/demo/schema";
import type {
  CreateShipmentPayload,
  LogisticsOverview,
  LogisticsShipmentDetail,
  LogisticsShipmentListResult,
  LogisticsShipmentListQuery,
  LogisticsShipmentStatus,
  ShipmentMutationResult,
  ShipmentProductInput,
  ShipmentLegInput,
  UpdateShipmentPayload,
} from "@/lib/logisticsApi";

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const asDetail = (value: unknown) => value as LogisticsShipmentDetail;
const asShipmentArray = (value: DemoDataset["shipments"]) =>
  value as unknown as LogisticsShipmentDetail[];

const normalizeLocation = (location: CreateShipmentPayload["origin"]) => ({
  country: location.country || "",
  city: location.city || "",
  address: location.address || "",
  lat: typeof location.lat === "number" ? location.lat : null,
  lng: typeof location.lng === "number" ? location.lng : null,
});

const syncProductShipmentLinks = (dataset: DemoDataset) => {
  const shipmentIdsByProductId = new Map<string, string>();
  for (const rawShipment of dataset.shipments) {
    const shipment = asDetail(rawShipment);
    for (const product of shipment.products) {
      shipmentIdsByProductId.set(product.productId, shipment.id);
    }
  }

  dataset.products = dataset.products.map((rawProduct) => {
    const product = rawProduct as Record<string, unknown>;
    const productId = String(product.id || "");
    return {
      ...product,
      shipmentId: shipmentIdsByProductId.get(productId) || null,
    };
  });
};

const recalculateShipment = (shipment: LogisticsShipmentDetail): LogisticsShipmentDetail => {
  const totalDistance = shipment.legs.reduce((sum, leg) => sum + Math.max(0, leg.distanceKm), 0);
  const totalCo2e = shipment.legs.reduce((sum, leg) => sum + Math.max(0, leg.co2e), 0);
  const totalWeight = shipment.products.reduce((sum, product) => sum + Math.max(0, product.weightKg), 0);
  return {
    ...shipment,
    totalDistanceKm: totalDistance,
    totalCo2e: totalCo2e,
    totalWeightKg: totalWeight,
    legsCount: shipment.legs.length,
    productsCount: shipment.products.length,
    updatedAt: new Date().toISOString(),
  };
};

const buildShipmentDetail = (
  dataset: DemoDataset,
  payload: CreateShipmentPayload,
  existing?: LogisticsShipmentDetail
): LogisticsShipmentDetail => {
  const shipmentId = existing?.id || createId();
  const now = new Date().toISOString();
  const products = payload.products.map((product) => {
    const matchedProduct = dataset.products.find(
      (entry) => String((entry as Record<string, unknown>).id || "") === product.product_id
    ) as Record<string, unknown> | undefined;
    return {
      id: createId(),
      productId: product.product_id,
      quantity: product.quantity,
      weightKg: product.weight_kg,
      allocatedCo2e: product.allocated_co2e,
      sku: String(matchedProduct?.productCode || matchedProduct?.product_code || ""),
      productName: String(matchedProduct?.productName || matchedProduct?.product_name || ""),
    };
  });

  const detail: LogisticsShipmentDetail = {
    id: shipmentId,
    referenceNumber:
      payload.reference_number?.trim() || existing?.referenceNumber || `SHIP-${Date.now().toString().slice(-6)}`,
    status: existing?.status || "pending",
    origin: normalizeLocation(payload.origin),
    destination: normalizeLocation(payload.destination),
    totalWeightKg: 0,
    totalDistanceKm: 0,
    totalCo2e: 0,
    pendingUntil: null,
    estimatedArrival: payload.estimated_arrival || existing?.estimatedArrival || null,
    estimatedArrivalAt: existing?.estimatedArrivalAt || null,
    actualArrival: existing?.actualArrival || null,
    actualArrivalAt: existing?.actualArrivalAt || null,
    simulationEnabled: false,
    legsCount: 0,
    productsCount: 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    companyId: dataset.company.id,
    legs: payload.legs.map((leg) => ({
      id: createId(),
      legOrder: leg.leg_order,
      transportMode: leg.transport_mode,
      originLocation: leg.origin_location,
      destinationLocation: leg.destination_location,
      distanceKm: leg.distance_km,
      durationHours: leg.duration_hours || null,
      co2e: leg.co2e,
      emissionFactorUsed: leg.emission_factor_used || null,
      carrierName: leg.carrier_name || "",
      vehicleType: leg.vehicle_type || "",
    })),
    products,
  };

  return recalculateShipment(detail);
};

export const getDemoShipmentDetails = (dataset: DemoDataset) =>
  asShipmentArray(dataset.shipments);

export const listDemoShipments = (
  dataset: DemoDataset,
  query: LogisticsShipmentListQuery = {}
): LogisticsShipmentListResult => {
  const safePage = Math.max(1, query.page || 1);
  const pageSize = Math.max(1, query.page_size || 20);
  const search = String(query.search || "").trim().toLowerCase();
  const items = getDemoShipmentDetails(dataset).filter((shipment) => {
    if (query.status && query.status !== "all" && shipment.status !== query.status) {
      return false;
    }
    if (query.transport_mode && !shipment.legs.some((leg) => leg.transportMode === query.transport_mode)) {
      return false;
    }
    if (!search) return true;
    return (
      shipment.referenceNumber.toLowerCase().includes(search) ||
      shipment.origin.city.toLowerCase().includes(search) ||
      shipment.destination.city.toLowerCase().includes(search) ||
      shipment.products.some(
        (product) =>
          product.sku.toLowerCase().includes(search) ||
          product.productName.toLowerCase().includes(search)
      )
    );
  });

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(safePage, totalPages);
  const slice = items.slice((page - 1) * pageSize, page * pageSize).map((shipment) => ({
    id: shipment.id,
    referenceNumber: shipment.referenceNumber,
    status: shipment.status,
    origin: shipment.origin,
    destination: shipment.destination,
    totalWeightKg: shipment.totalWeightKg,
    totalDistanceKm: shipment.totalDistanceKm,
    totalCo2e: shipment.totalCo2e,
    pendingUntil: shipment.pendingUntil,
    estimatedArrival: shipment.estimatedArrival,
    estimatedArrivalAt: shipment.estimatedArrivalAt,
    actualArrival: shipment.actualArrival,
    actualArrivalAt: shipment.actualArrivalAt,
    simulationEnabled: shipment.simulationEnabled,
    legsCount: shipment.legsCount,
    productsCount: shipment.productsCount,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  }));

  return {
    items: slice,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    },
  };
};

export const getDemoShipmentById = (dataset: DemoDataset, shipmentId: string) => {
  const shipment = getDemoShipmentDetails(dataset).find((item) => item.id === shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found.");
  }
  return shipment;
};

export const createDemoShipment = (
  dataset: DemoDataset,
  payload: CreateShipmentPayload
): ShipmentMutationResult => {
  const shipment = buildShipmentDetail(dataset, payload);
  asShipmentArray(dataset.shipments).unshift(shipment);
  syncProductShipmentLinks(dataset);
  return {
    id: shipment.id,
    status: shipment.status,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    pendingUntil: shipment.pendingUntil,
    estimatedArrival: shipment.estimatedArrival,
    estimatedArrivalAt: shipment.estimatedArrivalAt,
    actualArrival: shipment.actualArrival,
    actualArrivalAt: shipment.actualArrivalAt,
    simulationEnabled: shipment.simulationEnabled,
  };
};

export const updateDemoShipment = (
  dataset: DemoDataset,
  shipmentId: string,
  payload: UpdateShipmentPayload
): ShipmentMutationResult => {
  dataset.shipments = asShipmentArray(dataset.shipments).map((rawShipment) => {
    const shipment = asDetail(rawShipment);
    if (shipment.id !== shipmentId) return shipment;
    return recalculateShipment({
      ...shipment,
      referenceNumber: payload.reference_number || shipment.referenceNumber,
      origin: payload.origin ? normalizeLocation(payload.origin) : shipment.origin,
      destination: payload.destination ? normalizeLocation(payload.destination) : shipment.destination,
      estimatedArrival: payload.estimated_arrival || shipment.estimatedArrival,
    });
  }) as unknown as DemoDataset["shipments"];
  syncProductShipmentLinks(dataset);
  const shipment = getDemoShipmentById(dataset, shipmentId);
  return {
    id: shipment.id,
    status: shipment.status,
    updatedAt: shipment.updatedAt,
    pendingUntil: shipment.pendingUntil,
    estimatedArrival: shipment.estimatedArrival,
    estimatedArrivalAt: shipment.estimatedArrivalAt,
    actualArrival: shipment.actualArrival,
    actualArrivalAt: shipment.actualArrivalAt,
    simulationEnabled: shipment.simulationEnabled,
  };
};

export const updateDemoShipmentStatus = (
  dataset: DemoDataset,
  shipmentId: string,
  status: LogisticsShipmentStatus,
  actualArrival?: string
): ShipmentMutationResult => {
  dataset.shipments = asShipmentArray(dataset.shipments).map((rawShipment) => {
    const shipment = asDetail(rawShipment);
    if (shipment.id !== shipmentId) return shipment;
    return {
      ...shipment,
      status,
      actualArrival: actualArrival || shipment.actualArrival,
      actualArrivalAt: actualArrival || shipment.actualArrivalAt,
      updatedAt: new Date().toISOString(),
    };
  }) as unknown as DemoDataset["shipments"];
  const shipment = getDemoShipmentById(dataset, shipmentId);
  return {
    id: shipment.id,
    status: shipment.status,
    updatedAt: shipment.updatedAt,
    pendingUntil: shipment.pendingUntil,
    estimatedArrival: shipment.estimatedArrival,
    estimatedArrivalAt: shipment.estimatedArrivalAt,
    actualArrival: shipment.actualArrival,
    actualArrivalAt: shipment.actualArrivalAt,
    simulationEnabled: shipment.simulationEnabled,
  };
};

export const replaceDemoShipmentLegs = (
  dataset: DemoDataset,
  shipmentId: string,
  legs: ShipmentLegInput[]
): ShipmentMutationResult => {
  dataset.shipments = asShipmentArray(dataset.shipments).map((rawShipment) => {
    const shipment = asDetail(rawShipment);
    if (shipment.id !== shipmentId) return shipment;
    return recalculateShipment({
      ...shipment,
      legs: legs.map((leg) => ({
        id: createId(),
        legOrder: leg.leg_order,
        transportMode: leg.transport_mode,
        originLocation: leg.origin_location,
        destinationLocation: leg.destination_location,
        distanceKm: leg.distance_km,
        durationHours: leg.duration_hours || null,
        co2e: leg.co2e,
        emissionFactorUsed: leg.emission_factor_used || null,
        carrierName: leg.carrier_name || "",
        vehicleType: leg.vehicle_type || "",
      })),
    });
  }) as unknown as DemoDataset["shipments"];
  const shipment = getDemoShipmentById(dataset, shipmentId);
  return {
    id: shipment.id,
    status: shipment.status,
    updatedAt: shipment.updatedAt,
    pendingUntil: shipment.pendingUntil,
    estimatedArrival: shipment.estimatedArrival,
    estimatedArrivalAt: shipment.estimatedArrivalAt,
    actualArrival: shipment.actualArrival,
    actualArrivalAt: shipment.actualArrivalAt,
    simulationEnabled: shipment.simulationEnabled,
  };
};

export const replaceDemoShipmentProducts = (
  dataset: DemoDataset,
  shipmentId: string,
  products: ShipmentProductInput[]
): ShipmentMutationResult => {
  dataset.shipments = asShipmentArray(dataset.shipments).map((rawShipment) => {
    const shipment = asDetail(rawShipment);
    if (shipment.id !== shipmentId) return shipment;
    const next = {
      ...shipment,
      products: products.map((product) => {
        const matchedProduct = dataset.products.find(
          (entry) => String((entry as Record<string, unknown>).id || "") === product.product_id
        ) as Record<string, unknown> | undefined;
        return {
          id: createId(),
          productId: product.product_id,
          quantity: product.quantity,
          weightKg: product.weight_kg,
          allocatedCo2e: product.allocated_co2e,
          sku: String(matchedProduct?.productCode || matchedProduct?.product_code || ""),
          productName: String(matchedProduct?.productName || matchedProduct?.product_name || ""),
        };
      }),
    };
    return recalculateShipment(next);
  }) as unknown as DemoDataset["shipments"];
  syncProductShipmentLinks(dataset);
  const shipment = getDemoShipmentById(dataset, shipmentId);
  return {
    id: shipment.id,
    status: shipment.status,
    updatedAt: shipment.updatedAt,
    pendingUntil: shipment.pendingUntil,
    estimatedArrival: shipment.estimatedArrival,
    estimatedArrivalAt: shipment.estimatedArrivalAt,
    actualArrival: shipment.actualArrival,
    actualArrivalAt: shipment.actualArrivalAt,
    simulationEnabled: shipment.simulationEnabled,
  };
};

export const cascadeProductRemovalFromShipments = (dataset: DemoDataset, productId: string) => {
  dataset.shipments = asShipmentArray(dataset.shipments)
    .map((rawShipment) => {
      const shipment = asDetail(rawShipment);
      const nextProducts = shipment.products.filter((product) => product.productId !== productId);
      return recalculateShipment({
        ...shipment,
        products: nextProducts,
      });
    })
    .filter((shipment) => shipment.products.length > 0) as unknown as DemoDataset["shipments"];
  syncProductShipmentLinks(dataset);
};

export const getDemoLogisticsOverview = (dataset: DemoDataset): LogisticsOverview => {
  const shipments = getDemoShipmentDetails(dataset);
  return {
    totalShipments: shipments.length,
    pending: shipments.filter((shipment) => shipment.status === "pending").length,
    inTransit: shipments.filter((shipment) => shipment.status === "in_transit").length,
    delivered: shipments.filter((shipment) => shipment.status === "delivered").length,
    cancelled: shipments.filter((shipment) => shipment.status === "cancelled").length,
    totalCo2e: shipments.reduce((sum, shipment) => sum + shipment.totalCo2e, 0),
  };
};
