import type { ProductRecord } from "@/lib/productsApi";
import type { EvidenceDocumentV2 } from "./evidenceV2Api";
import { DEMO_FACILITY_V2, type DemoSkuV2 } from "./demoPackV2";
import { buildReportPayloadV2, computeSkuCarbonV2, type ReportPayloadV2 } from "./reportBuilder";

const asPositive = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
};

const normalizeHsCode = (product: ProductRecord) =>
  String(product.cnCode || product.hsCode || "62000000").trim() || "62000000";

const normalizeConfidence = (product: ProductRecord) => {
  const score = product.carbonResults?.confidenceScore;
  if (typeof score === "number" && Number.isFinite(score)) {
    return score > 1 ? Math.min(score / 100, 1) : Math.max(score, 0);
  }
  if (product.carbonResults?.confidenceLevel === "high") return 0.9;
  if (product.carbonResults?.confidenceLevel === "medium") return 0.75;
  return 0.6;
};

const mapEvidence = (product: ProductRecord, evidence: EvidenceDocumentV2[] = []): DemoSkuV2["evidence"] => {
  if (evidence.length > 0) {
    return evidence.map((item) => ({
      kind: item.evidenceType || "Evidence",
      fileName: item.documentName || item.originalFilename || item.lookupCode || "evidence",
      lookupCode: item.lookupCode || item.id,
      sha256: item.checksumSha256 || item.id
    }));
  }

  return product.evidenceLookupCode ? [
    {
      kind: "Linked evidence",
      fileName: product.evidenceLookupCode,
      lookupCode: product.evidenceLookupCode,
      sha256: "pending-evidence-lock"
    }
  ] : [];
};

export const productToDemoSkuV2 = (product: ProductRecord, evidence: EvidenceDocumentV2[] = []): DemoSkuV2 => {
  const materials = Array.isArray(product.materials) ? product.materials : [];
  const energySources = Array.isArray(product.energySources) ? product.energySources : [];
  const transportLegs = Array.isArray(product.transportLegs) ? product.transportLegs : [];
  const quantity = Math.max(1, Math.trunc(asPositive(product.quantity, 1)));
  const perProduct = product.carbonResults?.perProduct || {
    materials: 0,
    energy: 0,
    production: 0,
    transport: 0,
    total: 0
  };
  const materialsKg = asPositive(perProduct.materials, 0);
  const energyKg = asPositive(perProduct.energy, 0);
  const productionKg = asPositive(perProduct.production, 0);
  const transportKg = asPositive(perProduct.transport, 0);
  const hasSupplyGap = Boolean(product.supplyGap || materials.some((item) => item.source === "unknown"));
  const materialLabel =
    materials[0]?.materialType ||
    product.productType ||
    "material";

  return {
    id: product.id,
    sku: product.productCode,
    name: product.productName,
    cnCode: normalizeHsCode(product),
    routeCode: product.poContractId || "PRODUCT-ROUTE",
    units: quantity,
    weightKgPerUnit: asPositive(product.weightPerUnit, 0) / 1000,
    factory: product.facility || product.manufacturingLocation || DEMO_FACILITY_V2.name,
    factoryAddress: product.manufacturingLocation || DEMO_FACILITY_V2.address,
    unLocode: DEMO_FACILITY_V2.unLocode,
    materials: [
      {
        key: materialLabel,
        name: materialLabel,
        kgPerUnit: 1,
        co2ePerKg: materialsKg,
        source: hasSupplyGap ? "Ecoinvent v3.10 Default Value" : "Assessment factor registry",
        isDefault: hasSupplyGap,
        color: hasSupplyGap ? "#EF4444" : "#06C167"
      }
    ].filter((item) => item.co2ePerKg > 0),
    energy: energyKg > 0 ? [
      {
        source: energySources[0]?.source || "Energy allocation",
        kwhPerUnit: 1,
        factor: energyKg,
        citation: "Assessment energy factor"
      }
    ] : [],
    transport: transportKg > 0 ? [
      {
        mode: transportLegs[0]?.mode || "road",
        route: `${product.originAddress?.city || "Origin"} -> ${product.destinationAddress?.city || "Destination"}`,
        distanceKm: 1,
        weightTonnes: 1,
        defraKey: "assessment_transport_total",
        defraFactor: transportKg
      }
    ] : [],
    scope1KgCo2eBatch: productionKg * quantity,
    cbamPenaltyEurPerUnit: hasSupplyGap ? 0.05 : 0,
    evidence: mapEvidence(product, evidence),
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: normalizeConfidence(product)
  };
};

export const buildReportPayloadFromProductV2 = (product: ProductRecord): ReportPayloadV2 => {
  const sku = productToDemoSkuV2(product);
  const payload = buildReportPayloadV2(sku);
  const computed = computeSkuCarbonV2(sku);
  return {
    ...payload,
    totals: {
      ...payload.totals,
      pcfKgPerUnit: Number(computed.total.toFixed(3)),
      batchTonnes: Number(computed.batchTonnes.toFixed(4))
    }
  };
};

export const buildReportPayloadFromProductWithEvidenceV2 = (
  product: ProductRecord,
  evidence: EvidenceDocumentV2[]
): ReportPayloadV2 => {
  const sku = productToDemoSkuV2(product, evidence);
  const payload = buildReportPayloadV2(sku);
  const computed = computeSkuCarbonV2(sku);
  return {
    ...payload,
    totals: {
      ...payload.totals,
      pcfKgPerUnit: Number(computed.total.toFixed(3)),
      batchTonnes: Number(computed.batchTonnes.toFixed(4))
    }
  };
};

export const getProductEmbeddedBreakdownV2 = (product: ProductRecord, evidence: EvidenceDocumentV2[] = []) => {
  const sku = productToDemoSkuV2(product, evidence);
  const computed = computeSkuCarbonV2(sku);
  return {
    sku,
    materialKgPerUnit: computed.materials,
    energyKgPerUnit: computed.energy,
    transportKgPerUnit: computed.transport,
    embeddedKgPerUnit: computed.total,
    embeddedTonnesBatch: computed.batchTonnes,
    productId: product.id
  };
};
