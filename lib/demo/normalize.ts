"use client";

import type { DemoDataset } from "@/lib/demo/schema";

type DemoRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is DemoRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): DemoRecord => (isRecord(value) ? value : {});

const asString = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const roundNumber = (value: number, fractionDigits = 3) =>
  Number(value.toFixed(fractionDigits));

const getProductId = (value: unknown) => asString(asRecord(value).id).trim();

const getShipmentProductId = (value: unknown) =>
  asString(asRecord(value).product_id ?? asRecord(value).productId).trim();

const getBatchItemProductId = (value: unknown) =>
  asString(asRecord(value).productId ?? asRecord(value).product_id).trim();

// Seed JSON ships shipment sub-records (products/legs) in snake_case, but every
// consumer (domain/logistics.ts, domain/products.ts, the LogisticsShipmentDetail
// type) reads them as camelCase. Without canonicalizing here, functions like
// syncProductShipmentLinks silently treat every seeded shipment's product link
// as missing (product.productId is undefined), which wipes shipmentId off all
// pre-seeded published products the moment any shipment is created or updated
// (e.g. publishing a new product) — a real desync between /demo/products and
// /demo/logistics, not just a display issue.
const normalizeShipmentProductEntry = (rawProduct: unknown): DemoRecord => {
  const product = asRecord(rawProduct);
  const productId = getShipmentProductId(product);
  return {
    ...product,
    id: asString(product.id) || (productId ? `sp-${productId}` : ""),
    productId,
    quantity: asNumber(product.quantity),
    weightKg: asNumber(product.weightKg ?? product.weight_kg),
    allocatedCo2e: asNumber(product.allocatedCo2e ?? product.allocated_co2e),
    sku: asString(product.sku),
    productName: asString(product.productName ?? product.product_name),
  };
};

const normalizeShipmentLegEntry = (rawLeg: unknown, index: number): DemoRecord => {
  const leg = asRecord(rawLeg);
  return {
    ...leg,
    id: asString(leg.id, `leg-${index + 1}`),
    legOrder: asNumber(leg.legOrder ?? leg.leg_order, index + 1),
    transportMode: asString(leg.transportMode ?? leg.transport_mode, "road"),
    originLocation: asString(leg.originLocation ?? leg.origin_location),
    destinationLocation: asString(leg.destinationLocation ?? leg.destination_location),
    distanceKm: asNumber(leg.distanceKm ?? leg.distance_km),
    durationHours: leg.durationHours ?? leg.duration_hours ?? null,
    co2e: asNumber(leg.co2e),
    emissionFactorUsed: leg.emissionFactorUsed ?? leg.emission_factor_used ?? null,
    carrierName: asString(leg.carrierName ?? leg.carrier_name),
    vehicleType: asString(leg.vehicleType ?? leg.vehicle_type),
  };
};

const normalizeShipmentFields = (rawShipment: unknown): DemoRecord => {
  const shipment = asRecord(rawShipment);
  return {
    ...shipment,
    referenceNumber: asString(shipment.referenceNumber ?? shipment.reference_number),
    companyId: asString(shipment.companyId ?? shipment.company_id),
    createdAt: asString(shipment.createdAt ?? shipment.created_at),
    updatedAt: asString(shipment.updatedAt ?? shipment.updated_at),
    estimatedArrival: shipment.estimatedArrival ?? shipment.estimated_arrival ?? null,
    actualArrival: shipment.actualArrival ?? shipment.actual_arrival ?? null,
  };
};

const syncBatchSummary = (batch: DemoRecord) => {
  const items = Array.isArray(batch.items) ? batch.items.map(asRecord) : [];
  const totalQuantity = items.reduce((sum, item) => sum + asNumber(item.quantity), 0);
  const totalWeight = items.reduce(
    (sum, item) => sum + asNumber(item.weightKg ?? item.weight_kg) * asNumber(item.quantity, 1),
    0
  );
  const totalCO2 = items.reduce(
    (sum, item) => sum + asNumber(item.co2PerUnit ?? item.co2_per_unit) * asNumber(item.quantity, 1),
    0
  );

  return {
    ...batch,
    items,
    totalProducts: items.length,
    total_products: items.length,
    totalQuantity,
    total_quantity: totalQuantity,
    totalWeight: roundNumber(totalWeight, 3),
    total_weight: roundNumber(totalWeight, 3),
    totalCO2: roundNumber(totalCO2, 3),
    total_co2e: roundNumber(totalCO2, 3),
  };
};

const syncShipmentSummary = (rawShipment: DemoRecord) => {
  const shipment = normalizeShipmentFields(rawShipment);
  const products = Array.isArray(shipment.products)
    ? shipment.products.map(normalizeShipmentProductEntry)
    : [];
  const totalWeight = products.reduce((sum, product) => sum + asNumber(product.weightKg), 0);
  const totalAllocatedCo2e = products.reduce(
    (sum, product) => sum + asNumber(product.allocatedCo2e),
    0
  );
  const previousTotalCo2e = asNumber(shipment.totalCo2e ?? shipment.total_co2e, totalAllocatedCo2e);
  const co2Ratio =
    previousTotalCo2e > 0 && totalAllocatedCo2e > 0 ? totalAllocatedCo2e / previousTotalCo2e : 1;
  const rawLegs = Array.isArray(shipment.legs) ? shipment.legs.map(normalizeShipmentLegEntry) : [];
  const legs = rawLegs.map((leg) => ({
    ...leg,
    co2e: roundNumber(asNumber(leg.co2e) * co2Ratio, 3),
  }));
  const totalDistance = rawLegs.reduce((sum, leg) => sum + asNumber(leg.distanceKm), 0);
  const totalCo2e = roundNumber(
    legs.reduce((sum, leg) => sum + asNumber(leg.co2e), 0) || totalAllocatedCo2e,
    3
  );

  return {
    ...shipment,
    legs,
    products,
    totalWeightKg: roundNumber(totalWeight, 3),
    totalDistanceKm: roundNumber(totalDistance, 3),
    totalCo2e: totalCo2e,
    productsCount: products.length,
    legsCount: legs.length,
  };
};

const normalizeAnalyticsRows = (dataset: DemoDataset) => {
  const products = dataset.products.map(asRecord);
  const publishedCount = products.filter((product) => asString(product.status) === "published").length;

  const rows = Array.isArray(dataset.analytics?.rows) ? dataset.analytics.rows.map(asRecord) : [];
  dataset.analytics = {
    ...asRecord(dataset.analytics),
    rows: rows.map((row, index) => {
      const period = asString(row.period || row.month || row.label, "N/A");
      const actualEmissions = asNumber(row.actual_emissions ?? row.total_co2e, 0);
      const fallbackTargetFactor = index === 0 ? 1.02 : 0.985;
      const targetEmissions = asNumber(
        row.target_emissions ?? row.target_co2e,
        roundNumber(actualEmissions * fallbackTargetFactor, 2)
      );

      return {
        ...row,
        month: period,
        period,
        actual_emissions: actualEmissions,
        target_emissions: targetEmissions,
        published_products: Math.min(asNumber(row.published_products, publishedCount), publishedCount),
      };
    }),
  };
};

const normalizeReportSnapshots = (dataset: DemoDataset) => {
  const productSnapshotRows = dataset.products.map((rawProduct) => {
    const product = asRecord(rawProduct);
    return {
      productCode: asString(product.productCode ?? product.product_code),
      productName: asString(product.productName ?? product.product_name),
      status: asString(product.status, "draft"),
      destinationMarket: asString(product.destinationMarket ?? product.destination_market),
      totalCo2e: asNumber(
        asRecord(product.carbonResults).totalBatch
          ? asRecord(asRecord(product.carbonResults).totalBatch).total
          : undefined
      ),
    };
  });

  const analyticsRows = Array.isArray(dataset.analytics?.rows)
    ? dataset.analytics.rows.map((rawRow) => {
        const row = asRecord(rawRow);
        return {
          id: asString(row.id),
          period: asString(row.period || row.month),
          total_products: asNumber(row.total_products),
          published_products: asNumber(row.published_products),
          total_co2e: asNumber(row.total_co2e ?? row.actual_emissions),
          avg_co2e_per_unit: asNumber(row.avg_co2e_per_unit),
          export_ready_markets: asNumber(row.export_ready_markets),
        };
      })
    : [];

  dataset.reports = dataset.reports.map((rawReport) => {
    const report = asRecord(rawReport);
    const reportId = asString(report.id).trim();
    const normalizedDownloadUrl =
      asString(report.downloadUrl ?? report.download_url).trim() ||
      (reportId ? `demo://report/${reportId}` : "");
    const normalizedReport = normalizedDownloadUrl ?
      {
        ...report,
        downloadUrl: normalizedDownloadUrl
      } :
      report;
    const snapshot = asRecord(report.snapshot);
    const datasetType = asString(snapshot.datasetType);

    if (datasetType === "products") {
      return {
        ...normalizedReport,
        records: productSnapshotRows.length,
        snapshot: {
          ...snapshot,
          rows: productSnapshotRows,
        },
      };
    }

    if (datasetType === "analytics") {
      return {
        ...normalizedReport,
        records: analyticsRows.length,
        snapshot: {
          ...snapshot,
          rows: analyticsRows,
        },
      };
    }

    return normalizedReport;
  }) as DemoDataset["reports"];
};

export const normalizeSeedDemoDataset = (dataset: DemoDataset): DemoDataset => {
  const normalized = dataset;
  const products = normalized.products.map(asRecord);
  const publishedProductIds = new Set(
    products
      .filter((product) => asString(product.status) === "published" && asString(product.shipmentId).trim())
      .map((product) => getProductId(product))
      .filter(Boolean)
  );
  const shipmentIdsByProductId = new Map<string, string>();

  normalized.shipments = (
    normalized.shipments
      .map((rawShipment) => {
        const shipment = asRecord(rawShipment);
        const productsInShipment = Array.isArray(shipment.products) ? shipment.products.map(asRecord) : [];
        const filteredProducts = productsInShipment.filter((product) =>
          publishedProductIds.has(getShipmentProductId(product))
        );

        filteredProducts.forEach((product) => {
          const productId = getShipmentProductId(product);
          if (productId) {
            shipmentIdsByProductId.set(productId, asString(shipment.id));
          }
        });

        return syncShipmentSummary({
          ...shipment,
          products: filteredProducts,
        });
      })
      .filter(
        (shipment) => {
          const shipmentProducts = asRecord(shipment).products;
          return Array.isArray(shipmentProducts) && shipmentProducts.length > 0;
        }
      )
  ) as DemoDataset["shipments"];

  normalized.products = products.map((product) => {
    const productId = getProductId(product);
    const isPublished = publishedProductIds.has(productId) && shipmentIdsByProductId.has(productId);

    return {
      ...product,
      status: isPublished ? "published" : "draft",
      shipmentId: isPublished ? shipmentIdsByProductId.get(productId) || null : null,
    };
  }) as DemoDataset["products"];

  normalized.batches = normalized.batches
    .map((rawBatch) => {
      const batch = asRecord(rawBatch);
      const isPublishedBatch = asString(batch.status) === "published";
      const items = Array.isArray(batch.items) ? batch.items.map(asRecord) : [];
      const filteredItems = items.filter((item) => {
        const productId = getBatchItemProductId(item);
        if (!productId) return false;
        return isPublishedBatch ? publishedProductIds.has(productId) : !publishedProductIds.has(productId);
      });

      const nextShipmentId = isPublishedBatch ? asString(batch.shipmentId).trim() || null : null;

      return syncBatchSummary({
        ...batch,
        shipmentId: nextShipmentId,
        items: filteredItems,
      });
    }) as DemoDataset["batches"];

  normalizeAnalyticsRows(normalized);
  normalizeReportSnapshots(normalized);

  return normalized;
};
