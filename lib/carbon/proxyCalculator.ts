import { getCarbonFactor, resolveCategoryMethodology } from "@/lib/carbon/factorRegistry";
import type { ProductCategory } from "@/lib/carbon/types";

export interface ProxyMaterialShare {
  materialId: string;
  percentage: number;
}

export type ProxyTransportMode = "road" | "sea" | "air" | "rail" | "multimodal";

export interface ProxyEmissionBreakdown {
  material: number;
  manufacturing: number;
  transport: number;
  packaging: number;
  total: number;
  biogenic: number;
}

export const TRANSPORT_FACTOR_ID_BY_MODE: Record<ProxyTransportMode, string> = {
  road: "transport-road-defra-2025",
  sea: "transport-sea-defra-2025",
  air: "transport-air-defra-2025",
  rail: "transport-rail-defra-2025",
  multimodal: "transport-multimodal-proxy"
};

const GRID_FACTOR_ID = "energy-grid-vn-2023";
const PACKAGING_FACTOR_ID = "packaging-minimal-proxy";

export const roundMaterialPercentage = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export const materialPercentageTotal = (shares: ProxyMaterialShare[]) =>
  roundMaterialPercentage(
    shares.reduce((total, share) => total + (Number.isFinite(share.percentage) ? share.percentage : 0), 0)
  );

export const materialSharesAreComplete = (shares: ProxyMaterialShare[]) => {
  if (shares.length === 0 || materialPercentageTotal(shares) !== 100) return false;
  const materialIds = shares.map((share) => share.materialId.trim());
  return materialIds.every(Boolean)
    && new Set(materialIds).size === materialIds.length
    && shares.every((share) => Number.isFinite(share.percentage) && share.percentage > 0 && share.percentage <= 100);
};

export const getProxyTransportFactor = (mode: ProxyTransportMode) =>
  getCarbonFactor(TRANSPORT_FACTOR_ID_BY_MODE[mode]);

export const getProxyManufacturingFactor = (category: ProductCategory) => {
  const processFactor = getCarbonFactor(resolveCategoryMethodology(category).defaultProcessFactorId)?.value ?? 0;
  const gridFactor = getCarbonFactor(GRID_FACTOR_ID)?.value ?? 0;
  return processFactor * gridFactor;
};

export const getProxyPackagingFactor = () =>
  getCarbonFactor(PACKAGING_FACTOR_ID)?.value ?? 0;

export const calculateProxyEmissions = (input: {
  category: ProductCategory;
  weightKg: number;
  materials: ProxyMaterialShare[];
  transportMode: ProxyTransportMode;
  transportDistanceKm: number;
}): ProxyEmissionBreakdown => {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new Error("INVALID_PRODUCT_WEIGHT");
  }
  if (!Number.isFinite(input.transportDistanceKm) || input.transportDistanceKm <= 0) {
    throw new Error("INVALID_TRANSPORT_DISTANCE");
  }
  if (!materialSharesAreComplete(input.materials)) {
    throw new Error("INVALID_MATERIAL_MIX");
  }

  const material = input.materials.reduce((total, share) => {
    const factor = getCarbonFactor(share.materialId);
    if (!factor) throw new Error(`UNKNOWN_MATERIAL_FACTOR:${share.materialId}`);
    return total + input.weightKg * (share.percentage / 100) * factor.value;
  }, 0);

  const biogenic = input.materials.reduce((total, share) => {
    const factor = getCarbonFactor(share.materialId);
    return total + input.weightKg * (share.percentage / 100) * (factor?.biogenicCarbonKgPerKg ?? 0);
  }, 0);

  const manufacturing = input.weightKg * getProxyManufacturingFactor(input.category);
  const transportFactor = getProxyTransportFactor(input.transportMode)?.value;
  if (!Number.isFinite(transportFactor)) throw new Error("UNKNOWN_TRANSPORT_FACTOR");
  // Freight factors are kg CO2e / tonne.km; convert product kg to tonnes first.
  const transport = (input.weightKg / 1000) * input.transportDistanceKm * Number(transportFactor);
  const packaging = input.weightKg * getProxyPackagingFactor();

  return {
    material,
    manufacturing,
    transport,
    packaging,
    total: material + manufacturing + transport + packaging,
    biogenic
  };
};

