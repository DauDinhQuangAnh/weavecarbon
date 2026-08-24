import type { ProductRecord } from "@/lib/productsApi";
import type { EvidenceDocumentV2 } from "./evidenceV2Api";
import { type DemoSkuV2 } from "./demoPackV2";
import { buildReportPayloadV2, computeSkuCarbonV2, type ReportPayloadV2 } from "./reportBuilder";

const asPositive = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
};

const normalizeHsCode = (product: ProductRecord) => String(product.cnCode || product.hsCode || "").trim();

export const getProductFacility = (product: ProductRecord) => ({
  name: product.facility || product.manufacturingLocation || "Nhà máy may mặc Việt Nam",
  address: product.originAddress?.city
    ? `${product.originAddress.street ? product.originAddress.street + ", " : ""}${product.originAddress.city}, ${product.originAddress.country || "Việt Nam"}`
    : product.manufacturingLocation || "Việt Nam",
  unLocode: (product.originAddress?.city || "").toLowerCase().includes("hanoi") || (product.originAddress?.city || "").toLowerCase().includes("hà nội") ? "VNHAN" : "VNSGN",
  naceCode: "14.13",
  customsOffice: (product.originAddress?.city || "").toLowerCase().includes("hanoi") || (product.originAddress?.city || "").toLowerCase().includes("hà nội") ? "VN HAN" : "VN SGN",
  verifier: "Chờ kiểm toán độc lập (SGS / Bureau Veritas)"
});

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
      kind: item.evidenceType || "Chứng từ kiểm toán",
      fileName: item.documentName || item.originalFilename || item.lookupCode || "evidence",
      lookupCode: item.lookupCode || item.id,
      sha256: item.checksumSha256 || item.id
    }));
  }

  return product.evidenceLookupCode ? [
    {
      kind: "Chứng từ đã liên kết",
      fileName: product.evidenceLookupCode,
      lookupCode: product.evidenceLookupCode,
      sha256: "SHA-256 Verified"
    }
  ] : [];
};

const formatMaterialLabel = (type: string) => {
  const map: Record<string, string> = {
    cotton: "Cotton (conventional)",
    conventional_cotton: "Cotton (conventional)",
    organic_cotton: "Organic Cotton",
    recycled_polyester: "Recycled Polyester",
    recycled_poly: "Recycled Polyester",
    polyester: "Polyester (virgin)",
    nylon: "Nylon / Polyamide",
    polyamide: "Polyamide",
    wool: "Len tự nhiên (Wool)",
    silk: "Lụa tơ tằm (Silk)",
    linen: "Vải lanh (Linen / Flax)",
    viscose: "Viscose / Rayon",
    tencel: "Tencel / Lyocell",
    spandex: "Spandex / Elastane",
    elastane: "Elastane",
    denim: "Vải Denim cotton",
  };
  const key = (type || "").toLowerCase().trim();
  return map[key] || (type ? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Nguyên liệu");
};

const formatEnergyLabel = (source: string) => {
  const map: Record<string, { label: string; factor: number; citation: string }> = {
    solar: { label: "Điện mặt trời áp mái (On-site Solar)", factor: 0.041, citation: "I-REC Standard / On-site Solar" },
    wind: { label: "Điện gió (Wind power)", factor: 0.015, citation: "I-REC Standard / Wind" },
    biomass: { label: "Năng lượng sinh khối (Biomass)", factor: 0.035, citation: "Niên giám Năng lượng VN" },
    hydro: { label: "Thủy điện (Hydro power)", factor: 0.024, citation: "I-REC Standard / Hydro" },
    grid: { label: "Điện lưới quốc gia Việt Nam (EVN Grid)", factor: 0.6766, citation: "Niên giám Bộ TN&MT VN 2024" },
  };
  const key = (source || "").toLowerCase().trim();
  return map[key] || { label: source || "Điện lưới quốc gia Việt Nam (EVN Grid)", factor: 0.6766, citation: "Niên giám Bộ TN&MT VN 2024" };
};

export const productToDemoSkuV2 = (product: ProductRecord, evidence: EvidenceDocumentV2[] = []): DemoSkuV2 => {
  const rawMaterials = Array.isArray(product.materials) ? product.materials : [];
  const rawEnergySources = Array.isArray(product.energySources) ? product.energySources : [];
  const rawTransportLegs = Array.isArray(product.transportLegs) ? product.transportLegs : [];
  const quantity = Math.max(1, Math.trunc(asPositive(product.quantity, 1)));
  const weightKgPerUnit = Math.max(0.001, asPositive(product.weightPerUnit, 200) / 1000);

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

  // Map real materials
  let mappedMaterials: DemoSkuV2["materials"] = [];
  if (rawMaterials.length > 0) {
    mappedMaterials = rawMaterials.map((mat, idx) => {
      const pct = Math.max(1, asPositive(mat.percentage, 100 / rawMaterials.length));
      const matWeightKg = Number(((weightKgPerUnit * pct) / 100).toFixed(4));
      const matCo2 = materialsKg > 0 ? (materialsKg * pct) / 100 : matWeightKg * 5.5;
      const co2ePerKg = matWeightKg > 0 ? Number((matCo2 / matWeightKg).toFixed(3)) : 5.5;
      const certSuffix = mat.certifications?.length ? ` (${mat.certifications.map((c) => c.toUpperCase()).join(", ")})` : "";
      const isDefault = Boolean(product.supplyGap || mat.source === "unknown");
      const name = `${formatMaterialLabel(mat.materialType)} (${pct}%)${certSuffix}`;

      return {
        key: `mat-${idx}-${mat.materialType || "raw"}`,
        name: isDefault ? `${name} - Khuyết dữ liệu gốc` : name,
        hsCode: product.hsCode || product.cnCode,
        kgPerUnit: matWeightKg,
        co2ePerKg,
        source: mat.certifications?.length
          ? `Higg MSI / Ecoinvent v3.10 ${certSuffix}`
          : mat.source === "imported"
          ? "Ecoinvent v3.10 (Imported)"
          : isDefault
          ? "Ecoinvent v3.10 Default +10%"
          : "Higg MSI; Ecoinvent v3.10",
        isDefault,
        color: isDefault ? "#EF4444" : idx === 0 ? "#06C167" : idx === 1 ? "#10B981" : "#0EA5E9"
      };
    });
  } else if (materialsKg > 0 || weightKgPerUnit > 0) {
    const isDefault = Boolean(product.supplyGap);
    mappedMaterials = [
      {
        key: "mat-primary",
        name: formatMaterialLabel(product.productType || "Nguyên liệu chính"),
        hsCode: product.hsCode || product.cnCode,
        kgPerUnit: weightKgPerUnit,
        co2ePerKg: weightKgPerUnit > 0 && materialsKg > 0 ? Number((materialsKg / weightKgPerUnit).toFixed(3)) : 5.5,
        source: isDefault ? "Ecoinvent v3.10 Default +10%" : "Higg MSI; Ecoinvent v3.10",
        isDefault,
        color: isDefault ? "#EF4444" : "#06C167"
      }
    ];
  }

  // Map real energy sources
  let mappedEnergy: DemoSkuV2["energy"] = [];
  if (rawEnergySources.length > 0) {
    mappedEnergy = rawEnergySources.map((ene) => {
      const { label, factor, citation } = formatEnergyLabel(ene.source);
      const pct = Math.max(1, asPositive(ene.percentage, 100 / rawEnergySources.length));
      const allocatedEnergyKg = energyKg > 0 ? (energyKg * pct) / 100 : 0;
      const kwhPerUnit = allocatedEnergyKg > 0 ? Number((allocatedEnergyKg / factor).toFixed(3)) : 0.85;

      return {
        source: label,
        kwhPerUnit,
        factor,
        citation
      };
    });
  } else if (energyKg > 0) {
    mappedEnergy = [
      {
        source: "Điện lưới quốc gia Việt Nam (EVN Grid)",
        kwhPerUnit: Number((energyKg / 0.6766).toFixed(3)),
        factor: 0.6766,
        citation: "Niên giám Bộ TN&MT VN 2024"
      }
    ];
  }

  // Map real transport legs
  let mappedTransport: DemoSkuV2["transport"] = [];
  if (rawTransportLegs.length > 0) {
    mappedTransport = rawTransportLegs.map((leg) => {
      const mode = leg.mode || "road";
      const distanceKm = Math.max(1, Math.round(asPositive(leg.estimatedDistance, product.estimatedTotalDistance || 120)));
      const weightTonnes = Number(((weightKgPerUnit * quantity) / 1000).toFixed(4));
      const defraFactor = mode === "sea" ? 0.01614 : mode === "air" ? 0.602 : mode === "rail" ? 0.028 : 0.0795;
      const defraKey = mode === "sea" ? "sea_freight_container_ship_average" : mode === "air" ? "freighting_goods_air_freight" : "freighting_goods_hgv_all_diesel_40t";
      const origin = product.originAddress?.city || "Việt Nam";
      const dest = product.destinationAddress?.city || product.destinationMarket || "Thị trường xuất khẩu";

      return {
        mode,
        route: `${origin} -> ${dest}`,
        distanceKm,
        weightTonnes,
        defraKey,
        defraFactor
      };
    });
  } else if (transportKg > 0) {
    const origin = product.originAddress?.city || "Việt Nam";
    const dest = product.destinationAddress?.city || product.destinationMarket || "Thị trường xuất khẩu";
    mappedTransport = [
      {
        mode: "road",
        route: `${origin} -> ${dest}`,
        distanceKm: Math.max(50, Math.round(transportKg / (0.0795 * Math.max(0.001, weightKgPerUnit)))),
        weightTonnes: Number(((weightKgPerUnit * quantity) / 1000).toFixed(4)),
        defraKey: "freighting_goods_hgv_all_diesel_40t",
        defraFactor: 0.0795
      }
    ];
  }

  const destLower = (product.destinationMarket || product.destinationAddress?.country || "").toLowerCase();
  const isEuTarget = destLower.includes("eu") || destLower.includes("châu âu") || destLower.includes("europe") || destLower.includes("germany") || destLower.includes("pháp") || destLower.includes("hà lan");
  const cbamPenaltyEurPerUnit = isEuTarget ? Number(((materialsKg + productionKg) * 0.01).toFixed(2)) : 0;

  return {
    id: product.id,
    sku: product.productCode || product.id,
    name: product.productName || "Sản phẩm dệt may",
    cnCode: normalizeHsCode(product) || "62052000",
    routeCode: product.poContractId || `TX-${(product.productCode || "01").slice(-6)}`,
    units: quantity,
    weightKgPerUnit,
    factory: product.facility || product.manufacturingLocation || "Nhà máy may mặc Việt Nam",
    factoryAddress: product.originAddress?.city
      ? `${product.originAddress.street ? product.originAddress.street + ", " : ""}${product.originAddress.city}, ${product.originAddress.country || "Việt Nam"}`
      : product.manufacturingLocation || "Việt Nam",
    unLocode: (product.originAddress?.city || "").toLowerCase().includes("hanoi") || (product.originAddress?.city || "").toLowerCase().includes("hà nội") ? "VNHAN" : "VNSGN",
    materials: mappedMaterials,
    energy: mappedEnergy,
    transport: mappedTransport,
    scope1KgCo2eBatch: Number((productionKg * quantity).toFixed(2)),
    cbamPenaltyEurPerUnit,
    evidence: mapEvidence(product, evidence),
    verifier: "Chờ kiểm toán độc lập (SGS / Bureau Veritas)",
    confidence: normalizeConfidence(product)
  };
};

export const buildReportPayloadFromProductV2 = (product: ProductRecord): ReportPayloadV2 => {
  const sku = productToDemoSkuV2(product);
  const facility = getProductFacility(product);
  const payload = buildReportPayloadV2(sku, facility);
  const computed = computeSkuCarbonV2(sku);
  return {
    ...payload,
    facility,
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
  const facility = getProductFacility(product);
  const payload = buildReportPayloadV2(sku, facility);
  const computed = computeSkuCarbonV2(sku);
  return {
    ...payload,
    facility,
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
