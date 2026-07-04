"use client";

import type { DemoDataset } from "@/lib/demo/schema";

type DemoRecord = Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;

const asRecord = (value: unknown): DemoRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value as DemoRecord : {};

const asArray = (value: unknown): DemoRecord[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asString = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const fromSeed = (dataset: DemoDataset, offsetDays: number, hour = 8) => {
  const seed = new Date(dataset.seededAt);
  const base = Number.isNaN(seed.getTime()) ? new Date() : seed;
  const next = new Date(base.getTime() + offsetDays * DAY_MS);
  next.setHours(hour, 0, 0, 0);
  return next.toISOString();
};

const dateOnly = (dataset: DemoDataset, offsetDays: number) =>
  fromSeed(dataset, offsetDays).slice(0, 10);

const hashFor = (value: string) =>
  `${value.replace(/[^a-f0-9]/gi, "").padEnd(12, "0").slice(0, 12)}${"abcdef1234567890abcdef1234567890".slice(0, 52)}`;

const getProducts = (dataset: DemoDataset) => dataset.products.map(asRecord);
const getShipments = (dataset: DemoDataset) => dataset.shipments.map(asRecord);

const getProductBatchCo2 = (product: DemoRecord) =>
  asNumber(asRecord(asRecord(product.carbonResults).totalBatch).total);

const getProductPerCo2 = (product: DemoRecord, key: string) =>
  asNumber(asRecord(asRecord(product.carbonResults).perProduct)[key]);

const getSupplierNames = () => [
  {
    name: "Viet Thang Textile Co.",
    email: "scope3@vietthang.example",
    material: "Cotton yarn / greige fabric",
    data: ["Material origin", "Monthly kWh", "Dyeing process log"],
  },
  {
    name: "EcoSpin Cotton Yarn",
    email: "supply@ecospin.example",
    material: "Organic cotton yarn",
    data: ["GOTS certificate", "Yarn lot traceability", "Supplier emission factor"],
  },
  {
    name: "Green Dye House",
    email: "audit@greendye.example",
    material: "Dyeing and finishing",
    data: ["Electricity invoice", "Chemical inventory", "Wastewater evidence"],
  },
  {
    name: "RePoly Korea",
    email: "compliance@repoly.example",
    material: "Recycled polyester chips",
    data: ["GRS certificate", "PCR content declaration", "Chain of custody"],
  },
  {
    name: "Pacific Shipping Lines",
    email: "ops@pacificshipping.example",
    material: "Export freight",
    data: ["Bill of lading", "Carrier fuel factor", "Container allocation"],
  },
  {
    name: "Saigon Green Trucking",
    email: "fleet@sgt.example",
    material: "Domestic road leg",
    data: ["Vehicle class", "EV charging invoice", "Route distance log"],
  },
];

export const getDemoSuppliers = (dataset: DemoDataset) => {
  const suppliers = getSupplierNames();
  return suppliers.map((supplier, index) => ({
    id: `sup-demo-${index + 1}`,
    supplierName: supplier.name,
    supplierEmail: supplier.email,
    materialSupplied: supplier.material,
    requiredData: supplier.data,
    deadline: dateOnly(dataset, index % 2 === 0 ? 7 + index : -1 - index),
    status: (["received", "waiting", "sent", "overdue", "received", "waiting"] as const)[index],
    sentAt: fromSeed(dataset, -8 + index, 9),
    createdAt: fromSeed(dataset, -10 + index, 8),
    updatedAt: fromSeed(dataset, -4 + index, 11),
  }));
};

export const getDemoEvidenceDocuments = (dataset: DemoDataset) => {
  const products = getProducts(dataset);
  const shipments = getShipments(dataset);
  const firstProduct = products[0] || {};
  const exportShipment = shipments.find((shipment) => asString(shipment.referenceNumber).includes("EU")) || shipments[0] || {};
  const supplier = getDemoSuppliers(dataset)[0];

  // Returns camelCase to match BE formatEvidence() output
  return [
    {
      id: "ev-demo-electricity",
      kind: "electricity_bill",
      documentName: "EVN-Invoice-Factory-Monthly.pdf",
      fileName: "EVN-Invoice-Factory-Monthly.pdf",
      productId: asString(firstProduct.id),
      status: "source_matched",
      verificationLevel: 4,
      trustScore: 92,
      checksumSha256: hashFor("evn-electricity"),
      warnings: [] as string[],
      extractedJson: {
        supplier: "EVN HCMC",
        billing_period: dateOnly(dataset, -30).slice(0, 7),
        kwh: 48200,
        amount_vnd: 96400000,
        emission_factor: 0.44,
      },
      createdAt: fromSeed(dataset, -7, 10),
    },
    {
      id: "ev-demo-fuel",
      kind: "fuel_receipt",
      documentName: "Petrolimex-Diesel-Receipt.pdf",
      fileName: "Petrolimex-Diesel-Receipt.pdf",
      productId: asString(firstProduct.id),
      status: "verified",
      verificationLevel: 3,
      trustScore: 86,
      checksumSha256: hashFor("fuel-receipt"),
      warnings: ["Supplier total reconciled with monthly fuel log; no third-party verification yet."],
      extractedJson: {
        supplier: "Petrolimex",
        billing_period: dateOnly(dataset, -20).slice(0, 7),
        liters: 3200,
        emission_factor: 2.64,
      },
      createdAt: fromSeed(dataset, -6, 11),
    },
    {
      id: "ev-demo-bol",
      kind: "bill_of_lading",
      documentName: `${asString(exportShipment.referenceNumber, "SHIP-EU-DEMO")}-Bill-of-Lading.pdf`,
      fileName: `${asString(exportShipment.referenceNumber, "SHIP-EU-DEMO")}-Bill-of-Lading.pdf`,
      shipmentId: asString(exportShipment.id),
      status: "ocr_parsed",
      verificationLevel: 2,
      trustScore: 74,
      checksumSha256: hashFor("bill-of-lading"),
      warnings: ["Carrier emission factor still uses default sea freight factor."],
      extractedJson: {
        carrier: "Ocean Network Express",
        reference_number: asString(exportShipment.referenceNumber),
        destination: asString(asRecord(exportShipment.destination).city),
        distance_km: asNumber(exportShipment.totalDistanceKm),
      },
      createdAt: fromSeed(dataset, -5, 14),
    },
    {
      id: "ev-demo-grs",
      kind: "supplier_certificate",
      documentName: "GRS-Certificate-Recycled-Polyester.pdf",
      fileName: "GRS-Certificate-Recycled-Polyester.pdf",
      productId: asString(products.find((product) => asString(product.productName).toLowerCase().includes("recycled"))?.id),
      status: "third_party_verified",
      verificationLevel: 5,
      trustScore: 97,
      checksumSha256: hashFor("grs-certificate"),
      warnings: [] as string[],
      extractedJson: {
        supplier: "RePoly Korea",
        certificate: "GRS",
        valid_to: dateOnly(dataset, 320),
      },
      createdAt: fromSeed(dataset, -4, 9),
    },
    {
      id: "ev-demo-bom",
      kind: "bom",
      documentName: "BOM-WC-TEE-001-v2.xlsx",
      fileName: "BOM-WC-TEE-001-v2.xlsx",
      productId: asString(firstProduct.id),
      status: "locked",
      verificationLevel: 4,
      trustScore: 89,
      checksumSha256: hashFor("bom-tee"),
      warnings: [] as string[],
      extractedJson: {
        sku: asString(firstProduct.productCode),
        material_count: asArray(firstProduct.materials).length,
        quantity: asNumber(firstProduct.quantity),
      },
      createdAt: fromSeed(dataset, -3, 16),
    },
    {
      id: "ev-demo-supplier",
      kind: "supplier_declaration",
      documentName: "Supplier-Declaration-Viet-Thang.pdf",
      fileName: "Supplier-Declaration-Viet-Thang.pdf",
      status: "needs_review",
      verificationLevel: 2,
      trustScore: 68,
      checksumSha256: hashFor("supplier-declaration"),
      warnings: [`${supplier.supplierName} has not confirmed primary energy split yet.`],
      extractedJson: {
        supplier: supplier.supplierName,
        material: supplier.materialSupplied,
        requested_data: supplier.requiredData.join(", "),
      },
      createdAt: fromSeed(dataset, -2, 13),
    },
  ];
};

export const getDemoEvidenceFields = (dataset: DemoDataset, evidenceId: string) => {
  const doc = getDemoEvidenceDocuments(dataset).find((item) => item.id === evidenceId);
  if (!doc) return [];
  const extracted = asRecord(doc.extractedJson);
  return Object.entries(extracted).map(([fieldKey, value], index) => ({
    id: `${doc.id}-field-${index + 1}`,
    field_key: fieldKey,
    label: fieldKey,
    ai_value: String(value ?? ""),
    confirmed_value: String(value ?? ""),
    confidence: Math.max(0.72, Math.min(0.98, asNumber(doc.trustScore) / 100 - index * 0.015)),
  }));
};

export const getDemoDataGaps = (dataset: DemoDataset) => {
  const shipments = getShipments(dataset);
  const exportShipment = shipments.find((shipment) => asString(shipment.referenceNumber).includes("EU")) || shipments[0] || {};
  return [
    {
      id: "dg-demo-supplier-energy",
      dataGroup: "Supplier Scope 3 energy mix - Viet Thang Textile",
      requiredForAudit: true,
      currentStatus: "missing",
      riskLevel: "high",
      requiredAction: "Collect monthly kWh split and fuel records from Viet Thang Textile.",
      owner: "Supplier Audit",
      deadline: dateOnly(dataset, 7),
    },
    {
      id: "dg-demo-bol",
      dataGroup: `Sea freight BOL evidence - ${asString(exportShipment.referenceNumber, "SHIP-EU-2304")}`,
      requiredForAudit: true,
      currentStatus: "proxy",
      riskLevel: "high",
      requiredAction: "Replace route proxy with signed bill of lading and container allocation.",
      owner: "Logistics",
      deadline: dateOnly(dataset, 4),
    },
    {
      id: "dg-demo-grs",
      dataGroup: "GRS certificate for recycled polyester lots",
      requiredForAudit: true,
      currentStatus: "verified",
      riskLevel: "low",
      requiredAction: "Keep certificate linked to recycled SKUs.",
      owner: "QA Lead",
      deadline: dateOnly(dataset, 21),
    },
    {
      id: "dg-demo-evn",
      dataGroup: "Factory electricity invoice - Scope 2",
      requiredForAudit: true,
      currentStatus: "uploaded",
      riskLevel: "low",
      requiredAction: "Confirm OCR fields before report export.",
      owner: "Carbon Accounting",
      deadline: dateOnly(dataset, 12),
    },
    {
      id: "dg-demo-fuel",
      dataGroup: "Diesel receipt for boiler and forklifts - Scope 1",
      requiredForAudit: true,
      currentStatus: "self_declared",
      riskLevel: "medium",
      requiredAction: "Match Petrolimex invoice against monthly fuel log.",
      owner: "Factory Ops",
      deadline: dateOnly(dataset, 10),
    },
    {
      id: "dg-demo-bom",
      dataGroup: "BOM version alignment across product carbon register",
      requiredForAudit: true,
      currentStatus: "uploaded",
      riskLevel: "medium",
      requiredAction: "Freeze BOM v2 for published SKUs before buyer share.",
      owner: "Product Team",
      deadline: dateOnly(dataset, 14),
    },
    {
      id: "dg-demo-packaging",
      dataGroup: "Packaging recycled content declaration",
      requiredForAudit: false,
      currentStatus: "proxy",
      riskLevel: "medium",
      requiredAction: "Request packaging supplier declaration for recycled paper content.",
      owner: "Procurement",
      deadline: dateOnly(dataset, 18),
    },
    {
      id: "dg-demo-water",
      dataGroup: "Dye house wastewater treatment evidence",
      requiredForAudit: false,
      currentStatus: "missing",
      riskLevel: "medium",
      requiredAction: "Ask Green Dye House for latest wastewater monitoring record.",
      owner: "Compliance",
      deadline: dateOnly(dataset, 16),
    },
  ];
};

export const getDemoAuditTrail = (dataset: DemoDataset) => {
  const actor = dataset.user.id;
  const evidence = getDemoEvidenceDocuments(dataset);
  const products = getProducts(dataset);
  const shipments = getShipments(dataset);
  const rows = [
    ["demo.seeded", "Demo workspace", null, "12 SKU + linked evidence", "Seeded judging-ready B2B dataset", null],
    ["product.published", asString(products[0]?.productCode), "draft", "published", "Published first product with BOM and EVN evidence", null],
    ["supplier_request.sent", "Viet Thang Textile Co.", "draft", "waiting", "Requested energy mix and material origin", null],
    ["shipment.created", asString(shipments[0]?.referenceNumber), null, "in_transit", "Created linked logistics route for export shipment", null],
    ["evidence.uploaded", asString(evidence[0]?.fileName), null, "source_matched", "Uploaded and matched EVN invoice", asString(evidence[0]?.id)],
    ["evidence.uploaded", asString(evidence[2]?.fileName), null, "ocr_parsed", "OCR parsed bill of lading for shipment route", asString(evidence[2]?.id)],
    ["data_gap.updated", "Sea freight BOL evidence", "missing", "proxy", "Marked route as proxy pending carrier confirmation", null],
    ["product.updated", asString(products[4]?.productCode), "73 confidence", "80 confidence", "Linked GRS certificate to recycled material", null],
    ["report.generated", "EU export readiness pack", "processing", "completed", "Generated compliance report for buyer review", null],
    ["data_gap.verified", "Factory electricity invoice", "uploaded", "verified", "Confirmed Scope 2 invoice fields", asString(evidence[0]?.id)],
    ["product.published", asString(products[8]?.productCode), "draft", "published", "Published extra demo SKU after supplier declaration", null],
    ["report.generated", "Product carbon register", "processing", "completed", "Exported product carbon dataset with confidence scores", null],
  ];

  return rows.map(([changedField, dataGroup, oldValue, newValue, notes, evidenceId], index) => ({
    id: `at-demo-${index + 1}`,
    evidenceDocumentId: evidenceId || null,
    dataGroup,
    changedField,
    oldValue,
    newValue,
    reason: changedField === "demo.seeded" ? "demo.seed" : "demo.workflow",
    notes,
    changedBy: actor,
    createdAt: fromSeed(dataset, -10 + index, 8 + (index % 7)),
  }));
};

export const getDemoElectricityInvoices = (dataset: DemoDataset) => [
  {
    id: "elec-demo-1",
    billing_period: dateOnly(dataset, -30).slice(0, 7),
    facility_name: "Weave Demo Garment Factory - Binh Duong",
    kwh: 48200,
    emission_factor_kg_per_kwh: 0.44,
    emission_factor_source: "Vietnam grid EF 2024",
    scope2_co2e_kg: 21208,
    status: "source_matched",
    evidence_document_id: "ev-demo-electricity",
    created_at: fromSeed(dataset, -7, 10),
  },
  {
    id: "elec-demo-2",
    billing_period: dateOnly(dataset, -60).slice(0, 7),
    facility_name: "Weave Demo Garment Factory - Binh Duong",
    kwh: 45800,
    emission_factor_kg_per_kwh: 0.44,
    emission_factor_source: "Vietnam grid EF 2024",
    scope2_co2e_kg: 20152,
    status: "verified",
    evidence_document_id: "ev-demo-electricity",
    created_at: fromSeed(dataset, -38, 10),
  },
  {
    id: "elec-demo-3",
    billing_period: dateOnly(dataset, -90).slice(0, 7),
    facility_name: "Weave Demo Dye House - Dong Nai",
    kwh: 43100,
    emission_factor_kg_per_kwh: 0.44,
    emission_factor_source: "Vietnam grid EF 2024",
    scope2_co2e_kg: 18964,
    status: "ocr_parsed",
    evidence_document_id: "ev-demo-electricity",
    created_at: fromSeed(dataset, -70, 10),
  },
];

export const getDemoFuelInvoices = (dataset: DemoDataset) => [
  {
    id: "fuel-demo-1",
    billing_period: dateOnly(dataset, -30).slice(0, 7),
    fuel_type: "diesel",
    quantity_liters: 3200,
    emission_factor_kg_per_liter: 2.64,
    scope1_co2e_kg: 8448,
    status: "verified",
    evidence_document_id: "ev-demo-fuel",
    created_at: fromSeed(dataset, -6, 11),
  },
  {
    id: "fuel-demo-2",
    billing_period: dateOnly(dataset, -60).slice(0, 7),
    fuel_type: "diesel",
    quantity_liters: 2900,
    emission_factor_kg_per_liter: 2.64,
    scope1_co2e_kg: 7656,
    status: "uploaded",
    evidence_document_id: "ev-demo-fuel",
    created_at: fromSeed(dataset, -36, 11),
  },
];

export const getDemoCarbonCalculations = (dataset: DemoDataset) =>
  getProducts(dataset).map((product, index) => ({
    id: `calc-demo-${index + 1}`,
    // camelCase matching BE formatCalc() output
    productId: asString(product.id),
    totalCo2e: getProductBatchCo2(product),
    materialsCo2e: round(getProductPerCo2(product, "materials") * asNumber(product.quantity, 1), 2),
    productionCo2e: round(
      (getProductPerCo2(product, "production") + getProductPerCo2(product, "energy")) *
        asNumber(product.quantity, 1),
      2
    ),
    transportCo2e: round(getProductPerCo2(product, "transport") * asNumber(product.quantity, 1), 2),
    packagingCo2e: round(getProductPerCo2(product, "packaging") * asNumber(product.quantity, 1), 2),
    methodology: "ISO 14067 demo",
    createdAt: fromSeed(dataset, -5 + index, 9),
  }));

export const getDemoOperationalCounts = (dataset: DemoDataset) => ({
  activity: getDemoCarbonCalculations(dataset).length,
  audit: getDemoAuditTrail(dataset).length,
  evidence: getDemoEvidenceDocuments(dataset).length,
  suppliers: getDemoSuppliers(dataset).length,
  dataGaps: getDemoDataGaps(dataset).length,
});
