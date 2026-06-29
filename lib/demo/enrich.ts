"use client";

import type { DemoDataset } from "@/lib/demo/schema";

type DemoRecord = Record<string, unknown>;

const asRecord = (value: unknown): DemoRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value as DemoRecord : {};

const asArray = (value: unknown): DemoRecord[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const seedDate = (day: number, hour = 8) =>
  `2026-03-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;

const seedDateOnly = (day: number) => `2026-03-${String(day).padStart(2, "0")}`;

const marketCountry: Record<string, string> = {
  vietnam: "Vietnam",
  eu: "Germany",
  usa: "United States",
  japan: "Japan",
  korea: "South Korea",
};

const destinationAddressByMarket: Record<string, DemoRecord> = {
  vietnam: {
    street: "District 7 Distribution Center",
    city: "Ho Chi Minh City",
    stateRegion: "Ho Chi Minh City",
    country: "Vietnam",
    lat: 10.72,
    lng: 106.72,
  },
  eu: {
    street: "Hamburg Buyer Consolidation Hub",
    city: "Hamburg",
    stateRegion: "Hamburg",
    country: "Germany",
    lat: 53.55,
    lng: 9.99,
  },
  usa: {
    street: "Port of Los Angeles",
    city: "Los Angeles",
    stateRegion: "California",
    country: "United States",
    lat: 33.74,
    lng: -118.26,
  },
  japan: {
    street: "Yokohama Port",
    city: "Yokohama",
    stateRegion: "Kanagawa",
    country: "Japan",
    lat: 35.44,
    lng: 139.64,
  },
  korea: {
    street: "Busan Port",
    city: "Busan",
    stateRegion: "Busan",
    country: "South Korea",
    lat: 35.1,
    lng: 129.04,
  },
};

const extraProductSpecs = [
  {
    id: "00000000-0000-4000-8000-000000000108",
    productCode: "WC-HDY-009",
    productName: "Recycled Fleece Hoodie",
    productType: "jacket",
    weightPerUnit: 520,
    quantity: 760,
    destinationMarket: "eu",
    manufacturingLocation: "Binh Duong",
    materials: [
      { id: "mat-8-0", materialType: "recycled_polyester", percentage: 82, source: "imported", certifications: ["grs", "rcs"] },
      { id: "mat-8-1", materialType: "organic_cotton", percentage: 18, source: "domestic", certifications: ["gots"] },
    ],
    energySources: [{ id: "ene-8", source: "mixed", percentage: 100 }],
    co2: { materials: 3.35, production: 1.08, energy: 0.52, transport: 0.74, packaging: 0.12 },
    confidenceScore: 84,
    status: "published",
  },
  {
    id: "00000000-0000-4000-8000-000000000109",
    productCode: "WC-SNK-010",
    productName: "Recycled Knit Sneaker",
    productType: "shoes",
    weightPerUnit: 690,
    quantity: 420,
    destinationMarket: "usa",
    manufacturingLocation: "Dong Nai",
    materials: [
      { id: "mat-9-0", materialType: "recycled_polyester", percentage: 60, source: "imported", certifications: ["grs"] },
      { id: "mat-9-1", materialType: "rubber", percentage: 40, source: "domestic", certifications: [] },
    ],
    energySources: [{ id: "ene-9", source: "grid", percentage: 70 }, { id: "ene-9b", source: "solar", percentage: 30 }],
    co2: { materials: 4.1, production: 1.32, energy: 0.62, transport: 1.85, packaging: 0.2 },
    confidenceScore: 73,
    status: "published",
  },
  {
    id: "00000000-0000-4000-8000-000000000110",
    productCode: "WC-LIN-011",
    productName: "Traceable Linen Overshirt",
    productType: "shirt",
    weightPerUnit: 330,
    quantity: 510,
    destinationMarket: "japan",
    manufacturingLocation: "Da Nang",
    materials: [
      { id: "mat-10-0", materialType: "linen", percentage: 100, source: "domestic", certifications: ["oeko_tex"] },
    ],
    energySources: [{ id: "ene-10", source: "solar", percentage: 55 }, { id: "ene-10b", source: "grid", percentage: 45 }],
    co2: { materials: 1.72, production: 0.64, energy: 0.22, transport: 0.58, packaging: 0.08 },
    confidenceScore: 80,
    status: "published",
  },
  {
    id: "00000000-0000-4000-8000-000000000111",
    productCode: "WC-KID-012",
    productName: "BCI Kids Pajama Set",
    productType: "pants",
    weightPerUnit: 260,
    quantity: 980,
    destinationMarket: "korea",
    manufacturingLocation: "Ho Chi Minh City",
    materials: [
      { id: "mat-11-0", materialType: "cotton", percentage: 95, source: "domestic", certifications: ["bci"] },
      { id: "mat-11-1", materialType: "elastane", percentage: 5, source: "imported", certifications: [] },
    ],
    energySources: [{ id: "ene-11", source: "mixed", percentage: 100 }],
    co2: { materials: 2.12, production: 0.51, energy: 0.2, transport: 0.46, packaging: 0.07 },
    confidenceScore: 76,
    status: "published",
  },
];

const createCarbonResults = (spec: typeof extraProductSpecs[number]) => {
  const total = round(
    spec.co2.materials + spec.co2.production + spec.co2.energy + spec.co2.transport + spec.co2.packaging,
    2
  );
  return {
    perProduct: { ...spec.co2, total },
    totalBatch: {
      materials: round(spec.co2.materials * spec.quantity, 2),
      production: round(spec.co2.production * spec.quantity, 2),
      energy: round(spec.co2.energy * spec.quantity, 2),
      transport: round(spec.co2.transport * spec.quantity, 2),
      packaging: round(spec.co2.packaging * spec.quantity, 2),
      total: round(total * spec.quantity, 2),
    },
    confidenceLevel: spec.confidenceScore >= 85 ? "high" : spec.confidenceScore >= 70 ? "medium" : "low",
    confidenceScore: spec.confidenceScore,
    proxyUsed: spec.confidenceScore < 80,
    proxyNotes: spec.confidenceScore < 80 ? ["Awaiting supplier primary activity data in demo workflow."] : [],
    scope1: round(spec.co2.production * 0.22, 2),
    scope2: round(spec.co2.energy, 2),
    scope3: round(spec.co2.materials + spec.co2.transport + spec.co2.packaging, 2),
  };
};

const buildProduct = (spec: typeof extraProductSpecs[number], index: number) => {
  const destination = destinationAddressByMarket[spec.destinationMarket] || destinationAddressByMarket.vietnam;
  return {
    id: spec.id,
    productCode: spec.productCode,
    productName: spec.productName,
    productType: spec.productType,
    weightPerUnit: spec.weightPerUnit,
    quantity: spec.quantity,
    materials: spec.materials,
    accessories: [],
    productionProcesses: ["weaving", "cutting_sewing", "finishing"],
    energySources: spec.energySources,
    manufacturingLocation: spec.manufacturingLocation,
    wasteRecovery: "partial",
    destinationMarket: spec.destinationMarket,
    originAddress: {
      street: "Weave Demo Garment Factory",
      city: spec.manufacturingLocation,
      stateRegion: spec.manufacturingLocation,
      country: "Vietnam",
      lat: 10.93,
      lng: 106.71,
    },
    destinationAddress: destination,
    transportLegs: [],
    estimatedTotalDistance: spec.destinationMarket === "vietnam" ? 45 : 11800 + index * 350,
    carbonResults: createCarbonResults(spec),
    status: spec.status,
    version: 1,
    shipmentId: null,
    createdAt: seedDate(4 + index, 3),
    updatedAt: seedDate(10 + index, 8),
  };
};

const ensureProducts = (dataset: DemoDataset) => {
  const existingIds = new Set(dataset.products.map((item) => String(asRecord(item).id || "")));
  const additions = extraProductSpecs
    .filter((spec) => !existingIds.has(spec.id))
    .map((spec, index) => buildProduct(spec, index));

  if (additions.length > 0) {
    dataset.products = [...dataset.products, ...additions] as DemoDataset["products"];
  }
};

const buildShipmentLegs = (market: string, originCity: string, destinationCity: string, co2e: number) => {
  if (market === "vietnam") {
    return [
      {
        id: "leg-road-domestic",
        leg_order: 1,
        transport_mode: "road",
        origin_location: `${originCity} Factory`,
        destination_location: destinationCity,
        distance_km: 68,
        duration_hours: 2,
        co2e,
        emission_factor_used: 0.089,
        carrier_name: "Saigon Green Trucking",
        vehicle_type: "EV truck",
      },
    ];
  }

  return [
    {
      id: "leg-road-port",
      leg_order: 1,
      transport_mode: "road",
      origin_location: `${originCity} Factory`,
      destination_location: "Cat Lai Port",
      distance_km: 92,
      duration_hours: 3,
      co2e: round(co2e * 0.08, 2),
      emission_factor_used: 0.12226,
      carrier_name: "VietTrans Logistics",
      vehicle_type: "Truck 16t",
    },
    {
      id: "leg-sea-export",
      leg_order: 2,
      transport_mode: market === "usa" ? "sea" : "sea",
      origin_location: "Cat Lai Port",
      destination_location: destinationCity,
      distance_km: market === "usa" ? 13280 : market === "japan" ? 4300 : 11870,
      duration_hours: market === "usa" ? 442 : market === "japan" ? 146 : 396,
      co2e: round(co2e * 0.92, 2),
      emission_factor_used: 0.01612,
      carrier_name: market === "usa" ? "Pacific Shipping Lines" : "Ocean Network Express",
      vehicle_type: "Container vessel",
    },
  ];
};

const createShipmentForProduct = (product: DemoRecord, index: number) => {
  const productId = String(product.id || "");
  const code = String(product.productCode || `WC-${index}`);
  const name = String(product.productName || "Demo Product");
  const market = String(product.destinationMarket || "vietnam").toLowerCase();
  const origin = asRecord(product.originAddress);
  const destination = asRecord(product.destinationAddress);
  const totalBatch = asRecord(asRecord(product.carbonResults).totalBatch);
  const transportCo2e = Math.max(1, toNumber(totalBatch.transport, 80));
  const weightKg = round((toNumber(product.weightPerUnit, 250) / 1000) * toNumber(product.quantity, 1), 2);
  const legs = buildShipmentLegs(
    market,
    String(origin.city || "Binh Duong"),
    String(destination.city || marketCountry[market] || "Destination"),
    transportCo2e
  ).map((leg, legIndex) => ({
    ...leg,
    id: `leg-${productId.slice(-3)}-${legIndex + 1}`,
  }));
  const distance = legs.reduce((sum, leg) => sum + toNumber(leg.distance_km), 0);
  const status = index % 3 === 0 ? "delivered" : index % 3 === 1 ? "in_transit" : "pending";

  return {
    id: `00000000-0000-4000-8000-0000000004${String(index).padStart(2, "0")}`,
    company_id: "00000000-0000-4000-8000-000000000001",
    reference_number: `SHIP-${market.toUpperCase()}-${2400 + index}`,
    status,
    origin: {
      country: String(origin.country || "Vietnam"),
      city: String(origin.city || "Binh Duong"),
      address: String(origin.street || origin.address || "Weave Demo Garment Factory"),
      lat: toNumber(origin.lat, 10.93),
      lng: toNumber(origin.lng, 106.71),
    },
    destination: {
      country: String(destination.country || marketCountry[market] || "Vietnam"),
      city: String(destination.city || "Destination"),
      address: String(destination.street || destination.address || "Buyer distribution hub"),
      lat: toNumber(destination.lat, 10.72),
      lng: toNumber(destination.lng, 106.72),
    },
    total_weight_kg: weightKg,
    total_distance_km: distance,
    total_co2e: round(transportCo2e, 2),
    pending_until: status === "pending" ? seedDate(18 + index, 10) : null,
    estimated_arrival: seedDateOnly(Math.min(28, 16 + index)),
    estimated_arrival_at: seedDate(Math.min(28, 16 + index), 10),
    actual_arrival: status === "delivered" ? seedDateOnly(Math.min(28, 14 + index)) : null,
    actual_arrival_at: status === "delivered" ? seedDate(Math.min(28, 14 + index), 11) : null,
    simulation_enabled: false,
    legs_count: legs.length,
    products_count: 1,
    created_at: seedDate(8 + index, 2),
    updated_at: seedDate(10 + index, 5),
    legs,
    products: [
      {
        id: `sp-${productId.slice(-3)}`,
        product_id: productId,
        quantity: toNumber(product.quantity, 1),
        weight_kg: weightKg,
        allocated_co2e: round(transportCo2e, 2),
        sku: code,
        product_name: name,
      },
    ],
  };
};

const ensureShipments = (dataset: DemoDataset) => {
  const shippedProductIds = new Set(
    dataset.shipments.flatMap((shipment) =>
      asArray(asRecord(shipment).products).map((item) => String(item.product_id || item.productId || ""))
    )
  );
  const publishedProducts = dataset.products
    .map(asRecord)
    .filter((product) => String(product.status || "") === "published");

  const additions = publishedProducts
    .filter((product) => !shippedProductIds.has(String(product.id || "")))
    .map((product, index) => createShipmentForProduct(product, 40 + index));

  if (additions.length > 0) {
    dataset.shipments = [...dataset.shipments, ...additions] as DemoDataset["shipments"];
  }

  const shipmentIdsByProductId = new Map<string, string>();
  dataset.shipments.forEach((shipment) => {
    const shipmentRecord = asRecord(shipment);
    asArray(shipmentRecord.products).forEach((item) => {
      const productId = String(item.product_id || item.productId || "");
      const shipmentId = String(shipmentRecord.id || "");
      if (productId && shipmentId) {
        shipmentIdsByProductId.set(productId, shipmentId);
      }
    });
  });

  dataset.products = dataset.products.map((rawProduct) => {
    const product = asRecord(rawProduct);
    const productId = String(product.id || "");
    const shipmentId = shipmentIdsByProductId.get(productId);
    if (!shipmentId) {
      return rawProduct;
    }
    return {
      ...product,
      shipmentId,
      status: product.status === "published" ? "published" : product.status,
    };
  }) as DemoDataset["products"];
};

const ensureAnalytics = (dataset: DemoDataset) => {
  const products = dataset.products.map(asRecord);
  const published = products.filter((product) => String(product.status || "") === "published").length;
  const totalProducts = products.length;
  const totalCo2 = products.reduce(
    (sum, product) => sum + toNumber(asRecord(asRecord(product.carbonResults).totalBatch).total),
    0
  );
  const rows = Array.from({ length: 6 }, (_, index) => {
    const month = index + 1;
    const factor = 0.72 + index * 0.065;
    const actual = round(totalCo2 * factor, 2);
    return {
      id: `ana-2026-${String(month).padStart(2, "0")}`,
      month: `2026-${String(month).padStart(2, "0")}`,
      period: `2026-${String(month).padStart(2, "0")}`,
      label: `T${month}`,
      total_products: totalProducts,
      published_products: Math.max(1, Math.min(published, published - 2 + index)),
      total_co2e: actual,
      actual_emissions: actual,
      target_emissions: round(actual * (index < 2 ? 1.03 : 0.94), 2),
      avg_co2e_per_unit: round(actual / Math.max(1, products.reduce((sum, p) => sum + toNumber(p.quantity), 0)), 4),
      export_ready_markets: index < 2 ? 1 : index < 4 ? 2 : 3,
    };
  });

  dataset.analytics = {
    ...asRecord(dataset.analytics),
    rows,
  } as DemoDataset["analytics"];
};

const ensureUsersAndHistory = (dataset: DemoDataset) => {
  dataset.users = [
    dataset.user,
    {
      id: "00000000-0000-4000-8000-000000000021",
      email: "qa.lead@weavecarbon.demo",
      full_name: "Linh Tran - QA Lead",
      role: "member",
      status: "active",
      last_login: seedDate(18, 9),
      created_at: seedDate(2, 8),
    },
    {
      id: "00000000-0000-4000-8000-000000000022",
      email: "logistics@weavecarbon.demo",
      full_name: "Minh Pham - Logistics",
      role: "member",
      status: "active",
      last_login: seedDate(17, 15),
      created_at: seedDate(3, 8),
    },
    {
      id: "00000000-0000-4000-8000-000000000023",
      email: "supplier.audit@weavecarbon.demo",
      full_name: "Hanh Nguyen - Supplier Audit",
      role: "viewer",
      status: "active",
      last_login: seedDate(16, 11),
      created_at: seedDate(4, 8),
    },
  ] as DemoDataset["users"];

  dataset.history = [
    { id: "hist-1", action: "demo.seeded", actor: dataset.user.email, entity: "workspace", created_at: seedDate(1, 8), note: "Loaded B2B judging dataset" },
    { id: "hist-2", action: "product.published", actor: dataset.user.email, entity: "WC-TEE-001", created_at: seedDate(3, 9), note: "Published domestic cotton tee" },
    { id: "hist-3", action: "shipment.created", actor: "logistics@weavecarbon.demo", entity: "SHIP-EU-2304", created_at: seedDate(5, 11), note: "Linked denim and tote export shipment" },
    { id: "hist-4", action: "evidence.uploaded", actor: "qa.lead@weavecarbon.demo", entity: "EVN-Invoice-Mar2026.pdf", created_at: seedDate(6, 10), note: "Scope 2 invoice uploaded" },
    { id: "hist-5", action: "supplier_request.sent", actor: "supplier.audit@weavecarbon.demo", entity: "Viet Thang Textile Co.", created_at: seedDate(8, 14), note: "Requested yarn origin data" },
    { id: "hist-6", action: "data_gap.updated", actor: "qa.lead@weavecarbon.demo", entity: "Sea freight document", created_at: seedDate(11, 16), note: "Marked BOL as high-risk gap" },
    { id: "hist-7", action: "report.generate", actor: dataset.user.email, entity: "EU export readiness pack", created_at: seedDate(14, 9), note: "Generated compliance report" },
    { id: "hist-8", action: "evidence.verified", actor: "qa.lead@weavecarbon.demo", entity: "GRS-Certificate.pdf", created_at: seedDate(15, 11), note: "Verified material certification" },
  ] as DemoDataset["history"];
};

const ensureReports = (dataset: DemoDataset) => {
  const reportIds = new Set(dataset.reports.map((report) => report.id));
  const rows = dataset.products.map((product) => {
    const item = asRecord(product);
    return {
      productCode: String(item.productCode || ""),
      productName: String(item.productName || ""),
      status: String(item.status || "draft"),
      destinationMarket: String(item.destinationMarket || ""),
      totalCo2e: toNumber(asRecord(asRecord(item.carbonResults).totalBatch).total),
      confidenceScore: toNumber(asRecord(item.carbonResults).confidenceScore),
    };
  });
  const additions = [
    {
      id: "00000000-0000-4000-8000-000000000553",
      title: "EU export readiness pack",
      type: "compliance",
      format: "XLSX",
      status: "completed",
      createdAt: seedDate(15, 8),
      date: seedDateOnly(15),
      size: "31.4 KB",
      records: 18,
      co2e: null,
      downloadUrl: "demo://report/00000000-0000-4000-8000-000000000553",
      snapshot: {
        datasetType: "company",
        columns: ["market", "score", "documentsUploaded", "requiredMissing", "productScope"],
        rows: Object.values(dataset.exportCompliance).map((market) => {
          const item = asRecord(market);
          return {
            market: item.marketName || item.market,
            score: item.score,
            documentsUploaded: item.documentsUploadedCount,
            requiredMissing: item.requiredDocumentsMissingCount,
            productScope: Array.isArray(item.productScope) ? item.productScope.length : 0,
          };
        }),
      },
    },
    {
      id: "00000000-0000-4000-8000-000000000554",
      title: "Supplier Scope 3 follow-up log",
      type: "dataset_export",
      format: "CSV",
      status: "completed",
      createdAt: seedDate(16, 8),
      date: seedDateOnly(16),
      size: "12.8 KB",
      records: dataset.history.length,
      co2e: null,
      downloadUrl: "demo://report/00000000-0000-4000-8000-000000000554",
      snapshot: {
        datasetType: "history",
        columns: ["id", "action", "actor", "entity", "created_at", "note"],
        rows: dataset.history as DemoRecord[],
      },
    },
    {
      id: "00000000-0000-4000-8000-000000000555",
      title: "Product carbon register - judging demo",
      type: "carbon_audit",
      format: "XLSX",
      status: "completed",
      createdAt: seedDate(17, 8),
      date: seedDateOnly(17),
      size: "42.6 KB",
      records: rows.length,
      co2e: round(rows.reduce((sum, row) => sum + toNumber(row.totalCo2e), 0), 2),
      downloadUrl: "demo://report/00000000-0000-4000-8000-000000000555",
      snapshot: {
        datasetType: "products",
        columns: ["productCode", "productName", "status", "destinationMarket", "totalCo2e", "confidenceScore"],
        rows,
      },
    },
  ].filter((report) => !reportIds.has(report.id));

  if (additions.length > 0) {
    dataset.reports = [...dataset.reports, ...additions] as DemoDataset["reports"];
  }
};

export const enrichDemoDataset = (dataset: DemoDataset): DemoDataset => {
  ensureProducts(dataset);
  ensureShipments(dataset);
  ensureAnalytics(dataset);
  ensureUsersAndHistory(dataset);
  ensureReports(dataset);
  return dataset;
};
