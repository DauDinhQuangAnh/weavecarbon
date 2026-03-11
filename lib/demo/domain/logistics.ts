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
      shipmentIdsByProductId.set(product.product_id, shipment.id);
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
  const totalDistance = shipment.legs.reduce((sum, leg) => sum + Math.max(0, leg.distance_km), 0);
  const totalCo2e = shipment.legs.reduce((sum, leg) => sum + Math.max(0, leg.co2e), 0);
  const totalWeight = shipment.products.reduce((sum, product) => sum + Math.max(0, product.weight_kg), 0);
  return {
    ...shipment,
    total_distance_km: totalDistance,
    total_co2e: totalCo2e,
    total_weight_kg: totalWeight,
    legs_count: shipment.legs.length,
    products_count: shipment.products.length,
    updated_at: new Date().toISOString(),
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
      product_id: product.product_id,
      quantity: product.quantity,
      weight_kg: product.weight_kg,
      allocated_co2e: product.allocated_co2e,
      sku: String(matchedProduct?.productCode || matchedProduct?.product_code || ""),
      product_name: String(matchedProduct?.productName || matchedProduct?.product_name || ""),
    };
  });

  const detail: LogisticsShipmentDetail = {
    id: shipmentId,
    reference_number:
      payload.reference_number?.trim() || existing?.reference_number || `SHIP-${Date.now().toString().slice(-6)}`,
    status: existing?.status || "pending",
    origin: normalizeLocation(payload.origin),
    destination: normalizeLocation(payload.destination),
    total_weight_kg: 0,
    total_distance_km: 0,
    total_co2e: 0,
    pending_until: null,
    estimated_arrival: payload.estimated_arrival || existing?.estimated_arrival || null,
    estimated_arrival_at: existing?.estimated_arrival_at || null,
    actual_arrival: existing?.actual_arrival || null,
    actual_arrival_at: existing?.actual_arrival_at || null,
    simulation_enabled: false,
    legs_count: 0,
    products_count: 0,
    created_at: existing?.created_at || now,
    updated_at: now,
    company_id: dataset.company.id,
    legs: payload.legs.map((leg) => ({
      id: createId(),
      leg_order: leg.leg_order,
      transport_mode: leg.transport_mode,
      origin_location: leg.origin_location,
      destination_location: leg.destination_location,
      distance_km: leg.distance_km,
      duration_hours: leg.duration_hours || null,
      co2e: leg.co2e,
      emission_factor_used: leg.emission_factor_used || null,
      carrier_name: leg.carrier_name || "",
      vehicle_type: leg.vehicle_type || "",
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
    if (query.transport_mode && !shipment.legs.some((leg) => leg.transport_mode === query.transport_mode)) {
      return false;
    }
    if (!search) return true;
    return (
      shipment.reference_number.toLowerCase().includes(search) ||
      shipment.origin.city.toLowerCase().includes(search) ||
      shipment.destination.city.toLowerCase().includes(search) ||
      shipment.products.some(
        (product) =>
          product.sku.toLowerCase().includes(search) ||
          product.product_name.toLowerCase().includes(search)
      )
    );
  });

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(safePage, totalPages);
  const slice = items.slice((page - 1) * pageSize, page * pageSize).map((shipment) => ({
    id: shipment.id,
    reference_number: shipment.reference_number,
    status: shipment.status,
    origin: shipment.origin,
    destination: shipment.destination,
    total_weight_kg: shipment.total_weight_kg,
    total_distance_km: shipment.total_distance_km,
    total_co2e: shipment.total_co2e,
    pending_until: shipment.pending_until,
    estimated_arrival: shipment.estimated_arrival,
    estimated_arrival_at: shipment.estimated_arrival_at,
    actual_arrival: shipment.actual_arrival,
    actual_arrival_at: shipment.actual_arrival_at,
    simulation_enabled: shipment.simulation_enabled,
    legs_count: shipment.legs_count,
    products_count: shipment.products_count,
    created_at: shipment.created_at,
    updated_at: shipment.updated_at,
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
    created_at: shipment.created_at,
    updated_at: shipment.updated_at,
    pending_until: shipment.pending_until,
    estimated_arrival: shipment.estimated_arrival,
    estimated_arrival_at: shipment.estimated_arrival_at,
    actual_arrival: shipment.actual_arrival,
    actual_arrival_at: shipment.actual_arrival_at,
    simulation_enabled: shipment.simulation_enabled,
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
      reference_number: payload.reference_number || shipment.reference_number,
      origin: payload.origin ? normalizeLocation(payload.origin) : shipment.origin,
      destination: payload.destination ? normalizeLocation(payload.destination) : shipment.destination,
      estimated_arrival: payload.estimated_arrival || shipment.estimated_arrival,
    });
  }) as unknown as DemoDataset["shipments"];
  syncProductShipmentLinks(dataset);
  const shipment = getDemoShipmentById(dataset, shipmentId);
  return {
    id: shipment.id,
    status: shipment.status,
    updated_at: shipment.updated_at,
    pending_until: shipment.pending_until,
    estimated_arrival: shipment.estimated_arrival,
    estimated_arrival_at: shipment.estimated_arrival_at,
    actual_arrival: shipment.actual_arrival,
    actual_arrival_at: shipment.actual_arrival_at,
    simulation_enabled: shipment.simulation_enabled,
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
      actual_arrival: actualArrival || shipment.actual_arrival,
      actual_arrival_at: actualArrival || shipment.actual_arrival_at,
      updated_at: new Date().toISOString(),
    };
  }) as unknown as DemoDataset["shipments"];
  const shipment = getDemoShipmentById(dataset, shipmentId);
  return {
    id: shipment.id,
    status: shipment.status,
    updated_at: shipment.updated_at,
    pending_until: shipment.pending_until,
    estimated_arrival: shipment.estimated_arrival,
    estimated_arrival_at: shipment.estimated_arrival_at,
    actual_arrival: shipment.actual_arrival,
    actual_arrival_at: shipment.actual_arrival_at,
    simulation_enabled: shipment.simulation_enabled,
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
        leg_order: leg.leg_order,
        transport_mode: leg.transport_mode,
        origin_location: leg.origin_location,
        destination_location: leg.destination_location,
        distance_km: leg.distance_km,
        duration_hours: leg.duration_hours || null,
        co2e: leg.co2e,
        emission_factor_used: leg.emission_factor_used || null,
        carrier_name: leg.carrier_name || "",
        vehicle_type: leg.vehicle_type || "",
      })),
    });
  }) as unknown as DemoDataset["shipments"];
  const shipment = getDemoShipmentById(dataset, shipmentId);
  return {
    id: shipment.id,
    status: shipment.status,
    updated_at: shipment.updated_at,
    pending_until: shipment.pending_until,
    estimated_arrival: shipment.estimated_arrival,
    estimated_arrival_at: shipment.estimated_arrival_at,
    actual_arrival: shipment.actual_arrival,
    actual_arrival_at: shipment.actual_arrival_at,
    simulation_enabled: shipment.simulation_enabled,
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
          product_id: product.product_id,
          quantity: product.quantity,
          weight_kg: product.weight_kg,
          allocated_co2e: product.allocated_co2e,
          sku: String(matchedProduct?.productCode || matchedProduct?.product_code || ""),
          product_name: String(matchedProduct?.productName || matchedProduct?.product_name || ""),
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
    updated_at: shipment.updated_at,
    pending_until: shipment.pending_until,
    estimated_arrival: shipment.estimated_arrival,
    estimated_arrival_at: shipment.estimated_arrival_at,
    actual_arrival: shipment.actual_arrival,
    actual_arrival_at: shipment.actual_arrival_at,
    simulation_enabled: shipment.simulation_enabled,
  };
};

export const cascadeProductRemovalFromShipments = (dataset: DemoDataset, productId: string) => {
  dataset.shipments = asShipmentArray(dataset.shipments)
    .map((rawShipment) => {
      const shipment = asDetail(rawShipment);
      const nextProducts = shipment.products.filter((product) => product.product_id !== productId);
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
    total_shipments: shipments.length,
    pending: shipments.filter((shipment) => shipment.status === "pending").length,
    in_transit: shipments.filter((shipment) => shipment.status === "in_transit").length,
    delivered: shipments.filter((shipment) => shipment.status === "delivered").length,
    cancelled: shipments.filter((shipment) => shipment.status === "cancelled").length,
    total_co2e: shipments.reduce((sum, shipment) => sum + shipment.total_co2e, 0),
  };
};
