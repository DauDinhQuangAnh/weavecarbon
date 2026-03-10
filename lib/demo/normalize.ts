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

const syncShipmentSummary = (shipment: DemoRecord) => {
  const products = Array.isArray(shipment.products) ? shipment.products.map(asRecord) : [];
  const totalWeight = products.reduce((sum, product) => sum + asNumber(product.weight_kg), 0);
  const totalAllocatedCo2e = products.reduce(
    (sum, product) => sum + asNumber(product.allocated_co2e),
    0
  );
  const previousTotalCo2e = asNumber(shipment.total_co2e, totalAllocatedCo2e);
  const co2Ratio =
    previousTotalCo2e > 0 && totalAllocatedCo2e > 0 ? totalAllocatedCo2e / previousTotalCo2e : 1;
  const legs = Array.isArray(shipment.legs)
    ? shipment.legs.map((rawLeg) => {
        const leg = asRecord(rawLeg);
        return {
          ...leg,
          co2e: roundNumber(asNumber(leg.co2e) * co2Ratio, 3),
        };
      })
    : [];
  const totalCo2e = roundNumber(
    legs.reduce((sum, leg) => sum + asNumber(leg.co2e), 0) || totalAllocatedCo2e,
    3
  );

  return {
    ...shipment,
    legs,
    products,
    total_weight_kg: roundNumber(totalWeight, 3),
    total_co2e: totalCo2e,
    products_count: products.length,
    legs_count: legs.length,
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
