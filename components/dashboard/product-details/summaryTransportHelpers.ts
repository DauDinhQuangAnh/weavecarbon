import { MATERIAL_TYPES } from "@/components/dashboard/assessment/steps/types";
import type { ProductRecord } from "@/lib/productsApi";
import {
  fetchAllLogisticsShipments,
  fetchLogisticsShipmentById,
  isValidUuid,
  type LogisticsShipmentDetail,
  type LogisticsShipmentProduct
} from "@/lib/logisticsApi";
import {
  MARKET_REGULATIONS,
  type MarketCode
} from "@/components/dashboard/export/types";
import { normalizeDomesticMarketCode } from "@/lib/targetMarkets";
import { readSummaryProduct } from "@/lib/summaryProductCache";

export const normalizePlanId = (plan: string | null | undefined) => {
  const value = (plan || "").trim().toLowerCase();
  if (!value) return "";
  if (value.includes("trial")) return "trial";
  if (value.includes("standard")) return "standard";
  if (value.includes("export")) return "export";
  return value;
};

export const TARGET_MARKET_TO_DESTINATION_MARKET: Record<string, string> = {
  VN: "vietnam",
  US: "usa",
  KR: "korea",
  JP: "japan",
  EU: "eu",
  CN: "china",
  AU: "australia",
  ASEAN: "asean",
  TH: "thailand",
  SG: "singapore",
  MY: "malaysia",
  ID: "indonesia",
  PH: "philippines",
  CA: "canada",
  UK: "uk",
  IN: "india"
};

export const resolveStarterDomesticMarket = (domesticMarket: unknown, targetMarkets: unknown): string => {
  const marketCode = normalizeDomesticMarketCode(domesticMarket, targetMarkets);
  return TARGET_MARKET_TO_DESTINATION_MARKET[marketCode] || "vietnam";
};

export interface ShipmentTransportSnapshot {
  shipmentId: string;
  legCount: number;
  shipmentLegTotalCo2Kg: number;
  shipmentTotalCo2Kg: number;
  productAllocatedCo2Kg: number | null;
  productQuantity: number | null;
  productWeightKg: number | null;
  totalAllocatedCo2Kg: number;
  totalQuantity: number;
  totalWeightKg: number;
  productCount: number;
}

export interface TransportComputation {
  perUnitCo2Kg: number | null;
  totalBatchCo2Kg: number | null;
  legCount: number;
  hasData: boolean;
  source: "shipment" | "assessment" | "inferred" | "none";
}

export const TRANSPORT_FACTOR_BY_MODE: Record<"road" | "sea" | "air" | "rail", number> = {
  road: 0.105,
  sea: 0.016,
  air: 0.602,
  rail: 0.028
};

export const DESTINATION_MARKET_TO_CODE: Record<string, MarketCode> = {
  vn: "VN",
  vietnam: "VN",
  domestic: "VN",
  eu: "EU",
  europe: "EU",
  us: "US",
  usa: "US",
  unitedstates: "US",
  jp: "JP",
  japan: "JP",
  kr: "KR",
  korea: "KR",
  southkorea: "KR",
  au: "AU",
  australia: "AU",
  asean: "ASEAN",
  th: "TH",
  thailand: "TH",
  sg: "SG",
  singapore: "SG",
  my: "MY",
  malaysia: "MY",
  id: "ID",
  indonesia: "ID",
  ph: "PH",
  philippines: "PH",
  ca: "CA",
  canada: "CA",
  uk: "UK",
  unitedkingdom: "UK",
  cn: "CN",
  china: "CN",
  in: "IN",
  india: "IN"
};

export const normalizeMarketToken = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

export const readSummaryPrefetchedProduct = (slug: string): ProductRecord | null => {
  return readSummaryProduct(slug);
};

export const resolveMarketCodeFromDestination = (destinationMarket: unknown): MarketCode | null => {
  const normalized = normalizeMarketToken(destinationMarket);
  if (!normalized) return null;
  return DESTINATION_MARKET_TO_CODE[normalized] || null;
};

export const buildMarketComplianceCriterion = (destinationMarket: unknown): string | null => {
  const marketCode = resolveMarketCodeFromDestination(destinationMarket);
  if (!marketCode) return null;

  const regulation = MARKET_REGULATIONS[marketCode];
  if (!regulation) return null;

  return `${regulation.name} (${regulation.code})`;
};

export const normalizeComplianceDocumentKey = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

export const normalizeLookupValue = (value: string) => value.trim().toLowerCase();

export const sanitizeFilenamePart = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const sumEstimatedDistance = (legs: Array<{ estimatedDistance?: number }>) =>
  legs.reduce((sum, leg) => {
    const distance = leg.estimatedDistance;
    if (typeof distance !== "number" || !Number.isFinite(distance) || distance <= 0) {
      return sum;
    }
    return sum + distance;
  }, 0);

export const findShipmentProductMatch = (
  shipment: LogisticsShipmentDetail,
  product: ProductRecord
): LogisticsShipmentProduct | null => {
  const productIdLookup = normalizeLookupValue(product.id);
  const codeLookup = normalizeLookupValue(product.productCode);
  const nameLookup = normalizeLookupValue(product.productName);

  const byId = shipment.products.find(
    (item) => normalizeLookupValue(item.productId) === productIdLookup
  );
  if (byId) return byId;

  const bySku = shipment.products.find((item) => {
    const skuLookup = normalizeLookupValue(item.sku || "");
    if (!skuLookup || !codeLookup) {
      return false;
    }
    return (
      skuLookup === codeLookup ||
      skuLookup.includes(codeLookup) ||
      codeLookup.includes(skuLookup)
    );
  });
  if (bySku) return bySku;

  const byName = shipment.products.find(
    (item) =>
      normalizeLookupValue(item.productName) === nameLookup &&
      nameLookup.length > 0
  );
  return byName || null;
};

export const findShipmentByProduct = async (
  product: ProductRecord
): Promise<LogisticsShipmentDetail | null> => {
  const productIdLookup = normalizeLookupValue(product.id);
  const codeLookup = normalizeLookupValue(product.productCode);
  const nameLookup = normalizeLookupValue(product.productName);
  const candidateMap = new Map<string, string>();
  const searchTerms = [
    product.id,
    product.productCode,
    product.productName
  ]
    .map((term) => term?.trim())
    .filter((term): term is string => Boolean(term));

  const scoreShipment = (shipment: LogisticsShipmentDetail) => {
    let bestScore = 0;

    for (const shipmentProduct of shipment.products) {
      const shipmentProductId = normalizeLookupValue(shipmentProduct.productId);
      const shipmentSku = normalizeLookupValue(shipmentProduct.sku || "");
      const shipmentName = normalizeLookupValue(shipmentProduct.productName || "");

      if (shipmentProductId && shipmentProductId === productIdLookup) {
        bestScore = Math.max(bestScore, 300);
      }
      if (codeLookup.length > 0 && shipmentSku.length > 0) {
        if (shipmentSku === codeLookup) {
          bestScore = Math.max(bestScore, 220);
        } else if (shipmentSku.includes(codeLookup) || codeLookup.includes(shipmentSku)) {
          bestScore = Math.max(bestScore, 150);
        }
      }
      if (nameLookup.length > 0 && shipmentName.length > 0 && shipmentName === nameLookup) {
        bestScore = Math.max(bestScore, shipment.products.length === 1 ? 90 : 60);
      }
    }

    return bestScore;
  };

  for (const term of searchTerms) {
    try {
      const summaries = await fetchAllLogisticsShipments({
        search: term,
        page_size: 20
      });
      for (const summary of summaries) {
        if (isValidUuid(summary.id)) {
          candidateMap.set(summary.id, summary.updatedAt);
        }
      }
    } catch {
      // ignore search failures
    }
  }

  if (candidateMap.size === 0) {
    try {
      const summaries = await fetchAllLogisticsShipments({ page_size: 50 });
      for (const summary of summaries) {
        if (isValidUuid(summary.id)) {
          candidateMap.set(summary.id, summary.updatedAt);
        }
      }
    } catch {
      // ignore
    }
  }

  let bestMatch: { detail: LogisticsShipmentDetail; score: number } | null = null;
  const sortedCandidateIds = Array.from(candidateMap.entries())
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
    .map(([id]) => id);

  const DETAIL_SCAN_CONCURRENCY = 6;
  const scanIds = sortedCandidateIds.slice(0, 80);
  for (let i = 0; i < scanIds.length; i += DETAIL_SCAN_CONCURRENCY) {
    const details = await Promise.all(
      scanIds.slice(i, i + DETAIL_SCAN_CONCURRENCY).map(async (shipmentId) => {
        try {
          return await fetchLogisticsShipmentById(shipmentId);
        } catch {
          return null;
        }
      })
    );
    for (const detail of details) {
      if (!detail) continue;
      const score = scoreShipment(detail);
      if (score <= 0) continue;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { detail, score };
      }

      if (score >= 220) {
        return detail;
      }
    }
  }

  return bestMatch?.detail ?? null;
};

export const calculateInferredTransportPerUnit = (product: ProductRecord): number => {
  const weightTonnes = Math.max(0, product.weightPerUnit || 0) / 1_000_000;
  if (weightTonnes <= 0) {
    return 0;
  }

  if (product.transportLegs.length > 0) {
    return product.transportLegs.reduce((sum, leg) => {
      const distance = leg.estimatedDistance;
      if (typeof distance !== "number" || !Number.isFinite(distance) || distance <= 0) {
        return sum;
      }
      const factor =
        typeof leg.emissionFactor === "number" && Number.isFinite(leg.emissionFactor) && leg.emissionFactor > 0
          ? leg.emissionFactor
          : TRANSPORT_FACTOR_BY_MODE[leg.mode] ?? TRANSPORT_FACTOR_BY_MODE.road;
      return sum + weightTonnes * distance * factor;
    }, 0);
  }

  if (product.estimatedTotalDistance > 0) {
    const fallbackMode = product.transportLegs[0]?.mode ?? "sea";
    const fallbackFactor =
      TRANSPORT_FACTOR_BY_MODE[fallbackMode] ?? TRANSPORT_FACTOR_BY_MODE.sea;
    return weightTonnes * product.estimatedTotalDistance * fallbackFactor;
  }

  return 0;
};

export const normalizeStagePercentages = (values: number[]): number[] => {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const safeValues = values.map((value) =>
    Number.isFinite(value) && value > 0 ? value : 0
  );
  const total = safeValues.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return safeValues.map(() => 0);
  }

  const raw = safeValues.map((value) => (value / total) * 100);
  const floors = raw.map((value) => Math.floor(value));
  const remainder = 100 - floors.reduce((sum, value) => sum + value, 0);

  if (remainder > 0) {
    const ranked = raw
      .map((value, index) => ({ index, fraction: value - floors[index] }))
      .sort((a, b) => b.fraction - a.fraction);

    for (let i = 0; i < remainder; i += 1) {
      floors[ranked[i % ranked.length].index] += 1;
    }
  }

  return floors;
};

export function getMaterialEmissionFactor(materialType: string): number {
  const material = MATERIAL_TYPES.find((m) => m.value === materialType);
  return material?.co2Factor || 6.0;
}

export function getMaterialLabel(materialType: string): string {
  const material = MATERIAL_TYPES.find((m) => m.value === materialType);
  return material?.label || materialType;
}
