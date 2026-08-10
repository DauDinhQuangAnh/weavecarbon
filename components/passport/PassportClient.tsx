"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Leaf,
  MapPin,
  Truck,
  Ship,
  Plane,
  Train,
  Package,
  CheckCircle2,
  Shield,
  Clock,
  ArrowRight,
  Factory,
  Globe,
  Recycle,
  Award,
  Home } from
"lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ProductData,
  TransportData,
  CalculationHistory } from
"@/types/productData";
import type { TransportLeg } from "@/types/transport";
import {
  MATERIAL_LABELS,
  CERTIFICATION_LABELS,
  MARKET_LABELS } from
"@/lib/productLabels";
import {
  ProductAssessmentData,
  PRODUCT_TYPES,
  DESTINATION_MARKETS } from
"@/components/dashboard/assessment/steps/types";
import {
  fetchProductById,
  fetchProducts,
  isValidProductId,
  type ProductRecord } from
"@/lib/productsApi";
import {
  fetchAllLogisticsShipments,
  fetchLogisticsShipmentById,
  isValidUuid,
  toTransportLegs,
  type LogisticsShipmentDetail } from
"@/lib/logisticsApi";
import { fetchPublicPassportPayload } from "@/lib/b2cApi";


interface StoredProduct extends ProductAssessmentData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

type StoredCalculationHistory = Partial<CalculationHistory> & {
  productId?: string;
};

type TransportDataSource = "api" | "local" | "estimated" | null;

const readLocalStorageArray = <T,>(key: string): T[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const mapTransportMode = (
mode: string)
: "truck_light" | "truck_heavy" | "ship" | "air" | "rail" =>
{
  const normalizedMode = mode.trim().toLowerCase();
  if (normalizedMode === "truck_light") return "truck_light";
  if (normalizedMode === "truck_heavy") return "truck_heavy";
  if (normalizedMode === "ship" || normalizedMode === "sea") return "ship";
  if (normalizedMode === "air") return "air";
  if (normalizedMode === "rail") return "rail";
  if (normalizedMode === "road" || normalizedMode === "truck") return "truck_heavy";
  return "truck_heavy";
};

const mapRouteTypeFromMode = (
mode: "truck_light" | "truck_heavy" | "ship" | "air" | "rail")
: TransportLeg["routeType"] => {
  if (mode === "ship") return "sea";
  if (mode === "air") return "air";
  return "road";
};

const normalizeMarket = (market: string | null | undefined) => {
  const normalized = (typeof market === "string" ? market : "").trim().toLowerCase();
  if (normalized === "usa" || normalized === "united states") return "us";
  if (normalized === "japan") return "jp";
  if (normalized === "korea" || normalized === "south korea") return "kr";
  if (normalized === "europe") return "eu";
  return normalized;
};

const isDomesticMarket = (market: string | null | undefined) => {
  const normalized = normalizeMarket(market);
  return normalized === "vietnam" || normalized === "vn" || normalized === "domestic";
};

const normalizeLookupValue = (value: string) =>
value.
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
toLowerCase().
replace(/[^a-z0-9]/g, "");

const FALLBACK_EMISSION_FACTOR_BY_MODE: Record<
"truck_light" | "truck_heavy" | "ship" | "air" | "rail",
number> =
{
  truck_light: 0.105,
  truck_heavy: 0.105,
  ship: 0.016,
  air: 0.602,
  rail: 0.028
};

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

function normalizeProductData(product: ProductData): ProductData {
  return {
    ...product,
    productName: product.productName || "",
    productCode: product.productCode || "",
    category: product.category || "other",
    description: product.description || "",
    weight: product.weight || "0",
    unit: product.unit || "g",
    primaryMaterial: product.primaryMaterial || "",
    materialPercentage: product.materialPercentage || "0",
    secondaryMaterial: product.secondaryMaterial || "",
    secondaryPercentage: product.secondaryPercentage || "0",
    recycledContent: product.recycledContent || "0",
    certifications: Array.isArray(product.certifications) ? product.certifications : [],
    manufacturingLocation: product.manufacturingLocation || "",
    energySource: product.energySource || "",
    processType: product.processType || "",
    wasteRecovery: product.wasteRecovery || "",
    originCountry: product.originCountry || "",
    destinationMarket: product.destinationMarket || "vietnam",
    transportMode: product.transportMode || "road",
    packagingType: product.packagingType || "",
    packagingWeight: product.packagingWeight || "",
    sourceType: product.sourceType === "proxy" ? "proxy" : "documented",
    confidenceLevel:
    typeof product.confidenceLevel === "number" && Number.isFinite(product.confidenceLevel) ?
    product.confidenceLevel :
    70,
    createdAt: product.createdAt || new Date().toISOString(),
    createdBy: product.createdBy || "User",
    status: product.status || "draft",
    updatedAt: product.updatedAt || product.createdAt || new Date().toISOString()
  };
}


function convertToProductData(stored: StoredProduct): ProductData {
  const productTypeLabel = PRODUCT_TYPES.find((p) => p.value === stored.productType)?.label || stored.productType;

  return {
    id: stored.id,
    productName: stored.productName,
    productCode: stored.productCode,
    category: stored.productType || "other",
    description: `${productTypeLabel} - ${stored.quantity || 1} item(s)`,
    weight: String(stored.weightPerUnit || 0),
    unit: "g",
    primaryMaterial: stored.materials[0]?.materialType || "",
    materialPercentage: String(stored.materials[0]?.percentage || 0),
    secondaryMaterial: stored.materials[1]?.materialType || "",
    secondaryPercentage: String(stored.materials[1]?.percentage || 0),
    recycledContent: "0",
    certifications: stored.materials.flatMap((m) => m.certifications || []),
    manufacturingLocation: stored.manufacturingLocation || "Vietnam",
    energySource: stored.energySources[0]?.source || "grid",
    processType: stored.productionProcesses[0] || "",
    wasteRecovery: stored.wasteRecovery || "",
    originCountry: stored.originAddress?.country || "Vietnam",
    destinationMarket: stored.destinationMarket || "vietnam",
    transportMode: stored.transportLegs[0]?.mode || "road",
    packagingType: "",
    packagingWeight: "",
    sourceType: "documented",
    confidenceLevel: stored.carbonResults?.confidenceLevel === "high" ? 90 : stored.carbonResults?.confidenceLevel === "medium" ? 70 : 50,
    createdAt: stored.createdAt,
    createdBy: "User",
    status: stored.status,
    updatedAt: stored.updatedAt
  };
}


function generateCalculationFromProduct(stored: StoredProduct): CalculationHistory | null {
  if (!stored.carbonResults) return null;

  const perProduct = stored.carbonResults.perProduct;
  const packagingCO2 = Number((perProduct as {packaging?: number;}).packaging) || 0;
  return {
    id: `calc-${stored.id}`,
    productId: stored.id,
    productName: stored.productName,
    transportId: `transport-${stored.id}`,
    totalCO2: perProduct.total || 0,
    materialsCO2: perProduct.materials || 0,
    manufacturingCO2: perProduct.production || 0,
    transportCO2: perProduct.transport || 0,
    packagingCO2,
    carbonVersion: "WeaveCarbon v1.0",
    createdAt: stored.createdAt,
    createdBy: "User"
  };
}


function generateTransportFromProduct(stored: StoredProduct): TransportData | null {
  if (!stored.transportLegs || stored.transportLegs.length === 0) return null;

  const isDomestic = isDomesticMarket(stored.destinationMarket);
  const transportTotalCo2 = stored.carbonResults?.perProduct.transport || 0;
  const co2PerLeg = stored.transportLegs.length > 0 ?
  transportTotalCo2 / stored.transportLegs.length :
  0;
  const legs = stored.transportLegs.map((leg, index) => {
    const mode = mapTransportMode(leg.mode);
    const emissionFactor = FALLBACK_EMISSION_FACTOR_BY_MODE[mode] || 0;
    const rawDistanceKm = Number(leg.estimatedDistance) || 0;
    const derivedDistanceKm =
    rawDistanceKm > 0 ?
    rawDistanceKm :
    co2PerLeg > 0 && emissionFactor > 0 ?
    roundTo(co2PerLeg / emissionFactor, 1) :
    0;

    return {
    id: leg.id,
    legNumber: index + 1,
    type: isDomestic ? "domestic" as const : "international" as const,
    mode,
    origin: {
      name: index === 0 ? stored.originAddress?.city || "Origin" : `Transit ${index}`,
      lat: 0,
      lng: 0,
      type: "address" as const
    },
    destination: {
      name: index === stored.transportLegs.length - 1 ?
      stored.destinationAddress?.city || DESTINATION_MARKETS.find((m) => m.value === stored.destinationMarket)?.label || "Destination" :
      `Transit ${index + 1}`,
      lat: 0,
      lng: 0,
      type: "address" as const
    },
    distanceKm: derivedDistanceKm,
    emissionFactor,
    co2Kg: co2PerLeg,
    routeType: mapRouteTypeFromMode(mode)
  };
  });

  const inferredDistanceKm = legs.reduce((sum, leg) => sum + Math.max(0, leg.distanceKm), 0);
  const totalDistanceKm = stored.estimatedTotalDistance > 0 ? stored.estimatedTotalDistance : inferredDistanceKm;

  return {
    id: `transport-${stored.id}`,
    productId: stored.id,
    legs,
    totalDistanceKm,
    totalCO2Kg: transportTotalCo2,
    confidenceLevel: stored.carbonResults?.confidenceLevel === "high" ? 90 : 70,
    createdAt: stored.createdAt,
    createdBy: "User"
  };
}

function convertProductRecordToProductData(product: ProductRecord): ProductData {
  const productTypeLabel = PRODUCT_TYPES.find((p) => p.value === product.productType)?.label || product.productType;

  return {
    id: product.id,
    productName: product.productName,
    productCode: product.productCode,
    category: product.productType || "other",
    description: `${productTypeLabel || "Product"} - ${product.quantity || 1} items`,
    weight: String(product.weightPerUnit || 0),
    unit: "g",
    primaryMaterial: product.materials[0]?.materialType || "",
    materialPercentage: String(product.materials[0]?.percentage || 0),
    secondaryMaterial: product.materials[1]?.materialType || "",
    secondaryPercentage: String(product.materials[1]?.percentage || 0),
    recycledContent: "0",
    certifications: product.materials.flatMap((m) => m.certifications || []),
    manufacturingLocation: product.manufacturingLocation || "Vietnam",
    energySource: product.energySources[0]?.source || "grid",
    processType: product.productionProcesses[0] || "",
    wasteRecovery: product.wasteRecovery || "",
    originCountry: product.originAddress?.country || "Vietnam",
    destinationMarket: product.destinationMarket || "vietnam",
    transportMode: product.transportLegs[0]?.mode || "road",
    packagingType: "",
    packagingWeight: "",
    sourceType: product.carbonResults?.proxyUsed ? "proxy" : "documented",
    confidenceLevel:
    product.carbonResults?.confidenceLevel === "high" ?
    90 :
    product.carbonResults?.confidenceLevel === "medium" ?
    70 :
    50,
    createdAt: product.createdAt,
    createdBy: "User",
    status: product.status,
    updatedAt: product.updatedAt
  };
}

function generateTransportFromProductRecord(product: ProductRecord): TransportData | null {
  if (!product.transportLegs || product.transportLegs.length === 0) return null;

  const isDomestic = isDomesticMarket(product.destinationMarket);
  const transportTotalCo2 = product.carbonResults?.perProduct.transport || 0;
  const co2PerLeg = product.transportLegs.length > 0 ?
  transportTotalCo2 / product.transportLegs.length :
  0;
  const legs = product.transportLegs.map((leg, index) => {
    const mode = mapTransportMode(leg.mode);
    const emissionFactor = FALLBACK_EMISSION_FACTOR_BY_MODE[mode] || 0;
    const rawDistanceKm = Number(leg.estimatedDistance) || 0;
    const derivedDistanceKm =
    rawDistanceKm > 0 ?
    rawDistanceKm :
    co2PerLeg > 0 && emissionFactor > 0 ?
    roundTo(co2PerLeg / emissionFactor, 1) :
    0;

    return {
    id: leg.id,
    legNumber: index + 1,
    type: isDomestic ? "domestic" as const : "international" as const,
    mode,
    origin: {
      name: index === 0 ? product.originAddress?.city || "Origin" : `Transit ${index}`,
      lat: 0,
      lng: 0,
      type: "address" as const
    },
    destination: {
      name: index === product.transportLegs.length - 1 ?
      product.destinationAddress?.city || DESTINATION_MARKETS.find((m) => m.value === product.destinationMarket)?.label || "Destination" :
      `Transit ${index + 1}`,
      lat: 0,
      lng: 0,
      type: "address" as const
    },
    distanceKm: derivedDistanceKm,
    emissionFactor,
    co2Kg: co2PerLeg,
    routeType: mapRouteTypeFromMode(mode)
  };
  });

  const inferredDistanceKm = legs.reduce((sum, leg) => sum + Math.max(0, leg.distanceKm), 0);
  const totalDistanceKm = product.estimatedTotalDistance > 0 ? product.estimatedTotalDistance : inferredDistanceKm;

  return {
    id: `transport-${product.id}`,
    productId: product.id,
    legs,
    totalDistanceKm,
    totalCO2Kg: transportTotalCo2,
    confidenceLevel: product.carbonResults?.confidenceLevel === "high" ? 90 : 70,
    createdAt: product.createdAt,
    createdBy: "User"
  };
}

function generateCalculationFromProductRecord(product: ProductRecord): CalculationHistory | null {
  if (!product.carbonResults) return null;

  const perProduct = product.carbonResults.perProduct;
  const packagingCO2 = Number((perProduct as {packaging?: number;}).packaging) || 0;
  return {
    id: `calc-${product.id}`,
    productId: product.id,
    productName: product.productName,
    transportId: `transport-${product.id}`,
    totalCO2: perProduct.total || 0,
    materialsCO2: perProduct.materials || 0,
    manufacturingCO2: perProduct.production || 0,
    transportCO2: perProduct.transport || 0,
    packagingCO2,
    carbonVersion: "WeaveCarbon v1.0",
    createdAt: product.createdAt,
    createdBy: "User"
  };
}

function generateTransportFromShipmentDetail(
shipment: LogisticsShipmentDetail,
productId: string,
fallbackTotalCo2Kg: number | null,
fallbackCreatedAt: string)
: TransportData | null {
  const shipmentLegs = toTransportLegs(shipment);
  if (shipmentLegs.length === 0) return null;

  const matchedProduct = shipment.products.find(
    (item) => item.productId.trim() === productId.trim()
  );
  const allocatedCo2 = matchedProduct?.allocatedCo2e ?? 0;
  const matchedQuantity = matchedProduct?.quantity ?? 0;
  const shipmentLegCo2 = shipmentLegs.reduce(
    (sum, leg) => sum + Math.max(0, leg.co2Kg),
    0
  );
  const baseShipmentCo2 =
  shipment.totalCo2e > 0 ?
  shipment.totalCo2e :
  shipmentLegCo2;
  const totalAllocatedCo2 = shipment.products.reduce(
    (sum, item) => sum + Math.max(0, item.allocatedCo2e),
    0
  );
  const totalQuantity = shipment.products.reduce(
    (sum, item) => sum + Math.max(0, item.quantity),
    0
  );
  const hasExplicitProductTransport =
  typeof fallbackTotalCo2Kg === "number" && Number.isFinite(fallbackTotalCo2Kg);
  const explicitProductTransportCo2 =
  hasExplicitProductTransport ? Math.max(0, fallbackTotalCo2Kg as number) : 0;
  const allocatedLooksLikeTransport =
  allocatedCo2 > 0 &&
  baseShipmentCo2 > 0 &&
  allocatedCo2 <= baseShipmentCo2 * 1.25;
  const targetTotalCo2 =
  allocatedCo2 > 0 && totalAllocatedCo2 > 0 && baseShipmentCo2 > 0 ?
  baseShipmentCo2 * (allocatedCo2 / totalAllocatedCo2) :
  shipment.products.length === 1 && baseShipmentCo2 > 0 ?
  baseShipmentCo2 :
  matchedQuantity > 0 && totalQuantity > 0 && baseShipmentCo2 > 0 ?
  baseShipmentCo2 * (matchedQuantity / totalQuantity) :
  allocatedLooksLikeTransport ?
  allocatedCo2 :
  explicitProductTransportCo2;

  const scaledLegs =
  targetTotalCo2 > 0 && shipmentLegCo2 > 0 ?
  shipmentLegs.map((leg) => ({
    ...leg,
    co2Kg: leg.co2Kg / shipmentLegCo2 * targetTotalCo2
  })) :
  shipmentLegs;

  const totalDistanceKm =
  shipment.totalDistanceKm > 0 ?
  shipment.totalDistanceKm :
  scaledLegs.reduce((sum, leg) => sum + Math.max(0, leg.distanceKm), 0);

  return {
    id: `transport-${productId}`,
    productId,
    legs: scaledLegs,
    totalDistanceKm,
    totalCO2Kg: targetTotalCo2,
    confidenceLevel: 70,
    createdAt: fallbackCreatedAt || shipment.createdAt,
    createdBy: "System"
  };
}

function generateTransportFallbackFromCalculation(
product: ProductData,
calculation: CalculationHistory)
: TransportData | null {
  if (calculation.transportCO2 <= 0) return null;

  const modeRaw = (product.transportMode || "").trim().toLowerCase();
  const destinationKey = normalizeMarket(product.destinationMarket || "");
  const isDomesticMarket =
  destinationKey === "vietnam" || destinationKey === "vn" || destinationKey === "domestic";
  const modeFromProduct =
  modeRaw === "truck_light" ||
  modeRaw === "truck_heavy" ||
  modeRaw === "ship" ||
  modeRaw === "air" ||
  modeRaw === "rail" ?
  modeRaw :
  mapTransportMode(modeRaw);
  const mode =
  isDomesticMarket && modeFromProduct === "ship" ?
  "truck_heavy" :
  modeFromProduct;
  const routeType =
  mode === "ship" ? "sea" : mode === "air" ? "air" : "road";
  const destinationLabel =
  MARKET_LABELS[destinationKey] ||
  MARKET_LABELS[product.destinationMarket?.trim().toLowerCase()] ||
  product.destinationMarket ||
  "Destination";
  const originLabel =
  product.manufacturingLocation?.trim() ||
  product.originCountry?.trim() ||
  "Origin";
  const legId = `transport-fallback-${product.id}`;
  const emissionFactor = FALLBACK_EMISSION_FACTOR_BY_MODE[mode] || 0;
  const estimatedDistanceKm =
  emissionFactor > 0 ?
  Math.max(1, roundTo(calculation.transportCO2 / emissionFactor, 1)) :
  0;

  return {
    id: `transport-${product.id}`,
    productId: product.id,
    legs: [
    {
      id: legId,
      legNumber: 1,
      type: isDomesticMarket ? "domestic" : "international",
      mode,
      origin: {
        name: originLabel,
        lat: 0,
        lng: 0,
        type: "address"
      },
      destination: {
        name: destinationLabel,
        lat: 0,
        lng: 0,
        type: "warehouse"
      },
      distanceKm: estimatedDistanceKm,
      emissionFactor,
      co2Kg: calculation.transportCO2,
      routeType
    }],
    totalDistanceKm: estimatedDistanceKm,
    totalCO2Kg: calculation.transportCO2,
    confidenceLevel: product.confidenceLevel || 70,
    createdAt: calculation.createdAt || product.createdAt,
    createdBy: calculation.createdBy || "System"
  };
}

async function findShipmentByProductId(
product: ProductRecord)
: Promise<LogisticsShipmentDetail | null> {
  const productIdLookup = product.id.trim().toLowerCase();
  const productCodeLookup = normalizeLookupValue(product.productCode || "");
  const productNameLookup = normalizeLookupValue(product.productName || "");

  const collectCandidateSummaries = async () => {
    const candidateMap = new Map<string, Awaited<ReturnType<typeof fetchAllLogisticsShipments>>[number]>();
    const searchTerms = [
    product.id,
    product.productCode,
    product.productName].
    map((term) => term?.trim()).
    filter((term): term is string => Boolean(term));

    for (const term of searchTerms) {
      try {
        const summaries = await fetchAllLogisticsShipments({
          search: term,
          page_size: 20
        });
        for (const summary of summaries) {
          if (!isValidUuid(summary.id)) continue;
          candidateMap.set(summary.id, summary);
        }
      } catch {

      }
    }

    return Array.from(candidateMap.values()).
    sort(
      (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  };

  const collectAllSummaries = async () => {
    try {
      const summaries = await fetchAllLogisticsShipments({ page_size: 50 });
      return summaries.
      filter((summary) => isValidUuid(summary.id)).
      sort(
        (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch {
      return [];
    }
  };

  const scoreShipmentMatch = (detail: LogisticsShipmentDetail) => {
    let bestScore = 0;

    for (const shipmentProduct of detail.products) {
      const shipmentProductId = shipmentProduct.productId.trim().toLowerCase();
      const shipmentSku = normalizeLookupValue(shipmentProduct.sku || "");
      const shipmentName = normalizeLookupValue(shipmentProduct.productName || "");

      if (shipmentProductId && shipmentProductId === productIdLookup) {
        bestScore = Math.max(bestScore, 300);
      }
      if (productCodeLookup.length > 0 && shipmentSku.length > 0) {
        if (shipmentSku === productCodeLookup) {
          bestScore = Math.max(bestScore, 220);
        } else if (
        shipmentSku.includes(productCodeLookup) ||
        productCodeLookup.includes(shipmentSku))
        {
          bestScore = Math.max(bestScore, 150);
        }
      }
      if (
      productNameLookup.length > 0 &&
      shipmentName.length > 0 &&
      shipmentName === productNameLookup &&
      detail.products.length === 1)
      {
        bestScore = Math.max(bestScore, 90);
      }
    }

    return bestScore;
  };

  let candidates = await collectCandidateSummaries();
  if (candidates.length === 0) {
    candidates = await collectAllSummaries();
  }
  if (candidates.length === 0) return null;

  type ShipmentMatch = { detail: LogisticsShipmentDetail; score: number };
  const MAX_DETAILS_TO_SCAN = 120;
  const DETAIL_SCAN_CONCURRENCY = 6;

  // Scan candidate summaries for a matching shipment. Details are fetched in small
  // parallel chunks (instead of one-at-a-time) to cut the worst-case round-trips,
  // while preserving the original semantics: candidates are still evaluated in
  // priority order and the scan stops as soon as a strong (>=220) match is found.
  // Threads the running best match in/out so the caller keeps ordinary type flow.
  const scanForMatch = async (
    summaries: { id: string }[],
    current: ShipmentMatch | null
  ): Promise<{ found: LogisticsShipmentDetail | null; best: ShipmentMatch | null }> => {
    let best = current;
    const list = summaries.slice(0, MAX_DETAILS_TO_SCAN);
    for (let i = 0; i < list.length; i += DETAIL_SCAN_CONCURRENCY) {
      const details = await Promise.all(
        list.slice(i, i + DETAIL_SCAN_CONCURRENCY).map(async (summary) => {
          try {
            return await fetchLogisticsShipmentById(summary.id);
          } catch {
            return null;
          }
        })
      );
      for (const detail of details) {
        if (!detail) continue;
        const score = scoreShipmentMatch(detail);
        if (score <= 0) continue;

        if (!best || score > best.score) {
          best = { detail, score };
        }

        if (score >= 220) {
          return { found: detail, best };
        }
      }
    }
    return { found: null, best };
  };

  const primary = await scanForMatch(candidates, null);
  if (primary.found) return primary.found;
  let bestMatch = primary.best;

  if (!bestMatch) {
    const allCandidates = await collectAllSummaries();
    if (allCandidates.length > 0) {
      const fallback = await scanForMatch(allCandidates, bestMatch);
      if (fallback.found) return fallback.found;
      bestMatch = fallback.best;
    }
  }

  if (!bestMatch) return null;
  return bestMatch.score >= 120 ? bestMatch.detail : null;
}

async function resolveShipmentDetailByIdentifier(
identifier: string)
: Promise<LogisticsShipmentDetail | null> {
  const normalized = identifier.trim();
  if (!normalized) return null;

  try {
    return await fetchLogisticsShipmentById(normalized);
  } catch {

  }

  try {
    const summaries = await fetchAllLogisticsShipments({
      search: normalized,
      page_size: 20
    });
    const lookup = normalized.toLowerCase();
    const matched = summaries.find((summary) =>
    summary.id.trim().toLowerCase() === lookup ||
    summary.referenceNumber.trim().toLowerCase() === lookup
    );

    if (!matched) return null;
    return await fetchLogisticsShipmentById(matched.id);
  } catch {
    return null;
  }
}

const PassportClient: React.FC = () => {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const shipmentId = searchParams.get("shipmentId");
  const t = useTranslations("passport");
  const locale = "vi";
  const displayLocale = "vi-VN";
  const formatExactValue = (value: number) =>
  value.toLocaleString(displayLocale, { maximumFractionDigits: 20 });

  const [product, setProduct] = useState<ProductData | null>(null);
  const [transport, setTransport] = useState<TransportData | null>(null);
  const [transportDataSource, setTransportDataSource] = useState<TransportDataSource>(null);
  const [calculation, setCalculation] = useState<CalculationHistory | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);

      if (!productId && !shipmentId) {
        if (!cancelled) {
          setProduct(null);
          setTransport(null);
          setTransportDataSource(null);
          setCalculation(null);
          setLoading(false);
        }
        return;
      }

      const normalizedProductId = productId?.trim() || "";
      const normalizedShipmentId = shipmentId?.trim() || "";
      let foundProduct: ProductData | null = null;
      let foundTransport: TransportData | null = null;
      let foundCalc: CalculationHistory | null = null;
      let resolvedTransportDataSource: TransportDataSource = null;

      let apiProduct: ProductRecord | null = null;
      let apiShipment: LogisticsShipmentDetail | null = null;
      if (normalizedProductId) {
        try {
          const publicPayload = await fetchPublicPassportPayload(normalizedProductId);
          apiProduct = (publicPayload.product as ProductRecord | null) || null;
          apiShipment = (publicPayload.shipment as LogisticsShipmentDetail | null) || null;
        } catch {
          apiProduct = null;
          apiShipment = normalizedShipmentId ?
            await resolveShipmentDetailByIdentifier(normalizedShipmentId) :
            null;
        }
      }

      if (normalizedShipmentId) {
        apiShipment = await resolveShipmentDetailByIdentifier(normalizedShipmentId);
      }

      if (!apiProduct && isValidProductId(normalizedProductId)) {
        try {
          apiProduct = await fetchProductById(normalizedProductId);
        } catch {
          apiProduct = null;
        }

        if (!apiProduct) {
          try {
            const shipment = await fetchLogisticsShipmentById(normalizedProductId);
            apiShipment = shipment;
            const shipmentProductId = shipment.products[0]?.productId?.trim();
            if (shipmentProductId && isValidProductId(shipmentProductId)) {
              apiProduct = await fetchProductById(shipmentProductId);
            }
          } catch {
            apiProduct = null;
          }
        }
      } else if (!apiProduct) {
        try {
          const result = await fetchProducts({
            search: normalizedProductId,
            page: 1,
            page_size: 20
          });
          const lookup = normalizedProductId.toLowerCase();
          apiProduct =
          result.items.find((item) =>
          item.id.toLowerCase() === lookup ||
          item.productCode.trim().toLowerCase() === lookup ||
          item.productName.trim().toLowerCase() === lookup
          ) ||
          null;
        } catch {
          apiProduct = null;
        }
      }

      if (!apiProduct && apiShipment) {
        const shipmentProductId = apiShipment.products[0]?.productId?.trim();
        if (shipmentProductId && isValidProductId(shipmentProductId)) {
          try {
            apiProduct = await fetchProductById(shipmentProductId);
          } catch {
            apiProduct = null;
          }
        }
      }

      if (apiProduct) {
        foundProduct = convertProductRecordToProductData(apiProduct);
        foundTransport = generateTransportFromProductRecord(apiProduct);
        foundCalc = generateCalculationFromProductRecord(apiProduct);
        if (foundTransport && foundTransport.legs.length > 0) {
          resolvedTransportDataSource = "api";
        }

        if (!apiShipment && apiProduct.shipmentId) {
          apiShipment = await resolveShipmentDetailByIdentifier(apiProduct.shipmentId);
        }

        if (!apiShipment) {
          apiShipment = await findShipmentByProductId(apiProduct);
        }

        if (apiShipment) {
          const transportFromShipment = generateTransportFromShipmentDetail(
            apiShipment,
            apiProduct.id,
            foundCalc?.transportCO2 ?? null,
            apiProduct.createdAt
          );
          if (transportFromShipment) {
            foundTransport = transportFromShipment;
            resolvedTransportDataSource = "api";
          }
        }
      }

      const hasApiResolvedData = Boolean(apiProduct || apiShipment);

      if (!foundProduct && !hasApiResolvedData) {
        const userProducts = readLocalStorageArray<StoredProduct>("weavecarbonProducts");
        const storedProduct = userProducts.find((p) => p.id === normalizedProductId);
        if (storedProduct) {
          foundProduct = convertToProductData(storedProduct);
          foundTransport = generateTransportFromProduct(storedProduct);
          foundCalc = generateCalculationFromProduct(storedProduct);
          if (foundTransport && foundTransport.legs.length > 0) {
            resolvedTransportDataSource = "local";
          }
        }
      }

      if (!foundProduct && !hasApiResolvedData) {
        const oldProducts = readLocalStorageArray<ProductData>("weavecarbon_products");
        const legacyProduct = oldProducts.find((p) => p.id === normalizedProductId) || null;
        foundProduct = legacyProduct ? normalizeProductData(legacyProduct) : null;
      }

      if (!foundTransport && !hasApiResolvedData) {
        const userTransports = readLocalStorageArray<TransportData>("weavecarbon_transports");
        foundTransport =
        userTransports.find((item) => item.productId === normalizedProductId) ||
        null;
        if (foundTransport && foundTransport.legs.length > 0) {
          resolvedTransportDataSource = "local";
        }
      }

      if (!foundCalc && !hasApiResolvedData) {
        const histories = [
        ...readLocalStorageArray<StoredCalculationHistory>("weavecarbon_calculation_history"),
        ...readLocalStorageArray<StoredCalculationHistory>("weavecarbon_history")];
        const matched = histories.find(
          (history) => history.productId === normalizedProductId
        );

        if (matched) {
          foundCalc = {
            id:
            typeof matched.id === "string" && matched.id.length > 0 ?
            matched.id :
            `calc-${normalizedProductId}`,
            productId: normalizedProductId,
            productName:
            typeof matched.productName === "string" && matched.productName.length > 0 ?
            matched.productName :
            foundProduct?.productName || "",
            transportId:
            typeof matched.transportId === "string" && matched.transportId.length > 0 ?
            matched.transportId :
            `transport-${normalizedProductId}`,
            materialsCO2: Number(matched.materialsCO2) || 0,
            manufacturingCO2: Number(matched.manufacturingCO2) || 0,
            transportCO2: Number(matched.transportCO2) || 0,
            packagingCO2: Number(matched.packagingCO2) || 0,
            totalCO2: Number(matched.totalCO2) || 0,
            carbonVersion:
            typeof matched.carbonVersion === "string" && matched.carbonVersion.length > 0 ?
            matched.carbonVersion :
            "WeaveCarbon v1.0",
            createdAt:
            typeof matched.createdAt === "string" && matched.createdAt.length > 0 ?
            matched.createdAt :
            new Date().toISOString(),
            createdBy:
            typeof matched.createdBy === "string" && matched.createdBy.length > 0 ?
            matched.createdBy :
            "User"
          };
        }
      }

      if (
      (!foundTransport || foundTransport.legs.length === 0) &&
      foundProduct &&
      foundCalc)
      {
        const transportFallback = generateTransportFallbackFromCalculation(
          foundProduct,
          foundCalc
        );
        if (transportFallback) {
          foundTransport = transportFallback;
          resolvedTransportDataSource = "estimated";
        }
      }

      if (!cancelled) {
        setProduct(foundProduct ? normalizeProductData(foundProduct) : null);
        setTransport(foundTransport);
        setTransportDataSource(resolvedTransportDataSource);
        setCalculation(foundCalc);
        setLoading(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [productId, shipmentId]);

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "ship":
        return <Ship className="w-4 h-4" />;
      case "air":
        return <Plane className="w-4 h-4" />;
      case "rail":
        return <Train className="w-4 h-4" />;
      default:
        return <Truck className="w-4 h-4" />;
    }
  };

  const getModeLabel = (mode: string) => {
    if (locale === "vi") {
      switch (mode) {
        case "ship":
          return "Tàu biển";
        case "air":
          return "Hàng không";
        case "rail":
          return "Đường sắt";
        case "truck_light":
          return "Xe tải nhẹ";
        case "truck_heavy":
          return "Xe tải nặng";
        default:
          return mode;
      }
    }

    switch (mode) {
      case "ship":
        return "Sea freight";
      case "air":
        return "Air freight";
      case "rail":
        return "Rail";
      case "truck_light":
        return "Light truck";
      case "truck_heavy":
        return "Heavy truck";
      default:
        return mode;
    }
  };

  const getExportReadiness = () => {
    if (!product) return 0;
    let score = 50;
    if (product.certifications.length > 0) score += 15;
    if (product.sourceType === "documented") score += 15;
    if (product.recycledContent && parseInt(product.recycledContent) > 0)
    score += 10;
    if (calculation) score += 10;
    return Math.min(score, 100);
  };

  const getComplianceStatus = (market: string) => {
    if (!product) return { status: "pending", label: t("statusNotEvaluated") };

    const exportReadiness = getExportReadiness();
    if (normalizeMarket(market) === normalizeMarket(product.destinationMarket)) {
      if (exportReadiness >= 80)
      return { status: "compliant", label: t("statusCompliant") };
      if (exportReadiness >= 60)
      return { status: "partial", label: t("statusPartial") };
    }
    return { status: "pending", label: t("statusPending") };
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#dff1ea]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-700 border-t-transparent"></div>
      </div>);

  }

  if (!product) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#dff1ea] p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {t("notFoundTitle")}
            </h2>
            <p className="text-muted-foreground mb-4">
              {t("notFoundDescription")}
            </p>
            <Link href="/">
              <Button>
                <Home className="w-4 h-4 mr-2" />
                {t("backHome")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>);

  }

  const exportReadiness = getExportReadiness();
  const uiText = {
    legsLabel: "ch\u1eb7ng",
    estimated: "\u01af\u1edbc t\u00ednh",
    routeData: "Theo h\u00e0nh tr\u00ecnh",
    apiData: "API",
    localData: "Local",
    summaryDistance: "Qu\u00e3ng \u0111\u01b0\u1eddng",
    summaryCo2: "CO2e",
    summaryIntensity: "C\u01b0\u1eddng \u0111\u1ed9",
    summaryRoute: "Tuy\u1ebfn",
    routeDomestic: "N\u1ed9i \u0111\u1ecba",
    routeInternational: "Qu\u1ed1c t\u1ebf",
    routeMixed: "H\u1ed7n h\u1ee3p",
    legPrefix: "Ch\u1eb7ng"
  };
  const transportLegs = transport?.legs || [];
  const transportOrigin =
  transportLegs[0]?.origin.name ||
  product.manufacturingLocation ||
  product.originCountry;
  const transportDestination =
  transportLegs[transportLegs.length - 1]?.destination.name ||
  MARKET_LABELS[normalizeMarket(product.destinationMarket)] ||
  product.destinationMarket;
  const hasEstimatedTransportData = transportLegs.some(
    (leg) =>
    leg.id.startsWith("transport-fallback-") ||
    leg.distanceKm <= 0 ||
    leg.emissionFactor <= 0
  );
  const totalDistanceKm = Math.max(0, transport?.totalDistanceKm || 0);
  const totalCo2Kg = Math.max(0, transport?.totalCO2Kg || 0);
  const averageIntensity = totalDistanceKm > 0 ? totalCo2Kg / totalDistanceKm : 0;
  const hasDomesticLeg = transportLegs.some((leg) => leg.type === "domestic");
  const hasInternationalLeg = transportLegs.some((leg) => leg.type === "international");
  const routeTypeLabel =
  hasDomesticLeg && hasInternationalLeg ?
  uiText.routeMixed :
  hasInternationalLeg ?
  uiText.routeInternational :
  uiText.routeDomestic;
  const transportSourceLabel =
  hasEstimatedTransportData || transportDataSource === "estimated" ?
  uiText.estimated :
  transportDataSource === "api" ?
  uiText.apiData :
  transportDataSource === "local" ?
  uiText.localData :
  uiText.routeData;

  return (
    <div className="min-h-dvh bg-[#dff1ea]">
      <header className="border-b border-[#cde3d9] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Leaf className="h-4 w-4" />
            </div>
            <span className="text-xl font-semibold text-green-800">Green Passport</span>
          </div>
          <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t("statusCompliant")}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-safe">
        
        <Card className="overflow-hidden">
          <div className="bg-linear-to-r from-green-600 to-emerald-600 p-4 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-green-100 text-sm mb-1">{t("productLabel")}</p>
                <h1 className="text-xl font-bold">{product.productName}</h1>
                <p className="text-green-100 text-sm mt-1">
                  {t("skuLabel")} {product.productCode}
                </p>
              </div>
              <div className="text-right">
                <Badge className="bg-white/20 text-white border-white/30">
                  {product.sourceType === "documented" ?
                  t("documentedSource") :
                  t("estimatedSource")}
                </Badge>
              </div>
            </div>
          </div>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {product.description}
            </p>
          </CardContent>
        </Card>

        
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <div className="h-1 bg-linear-to-r from-emerald-500 via-green-400 to-cyan-400"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Leaf className="w-4 h-4 text-green-600" />
              {t("carbonFootprintTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {calculation ?
            <>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-green-600">
                    {calculation.totalCO2.toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("perProductUnit")}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Recycle className="w-4 h-4 text-blue-500" />
                      {t("materialsLabel")}
                    </span>
                    <span className="font-medium">
                      {calculation.materialsCO2.toFixed(2)} kg
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Factory className="w-4 h-4 text-orange-500" />
                      {t("productionLabel")}
                    </span>
                    <span className="font-medium">
                      {calculation.manufacturingCO2.toFixed(2)} kg
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-purple-500" />
                      {t("transportLabel")}
                    </span>
                    <span className="font-medium">
                      {calculation.transportCO2.toFixed(2)} kg
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-500" />
                      {t("packagingLabel")}
                    </span>
                    <span className="font-medium">
                      {calculation.packagingCO2.toFixed(2)} kg
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center pt-2">
                  {t("methodologyLabel")} {calculation.carbonVersion}
                </p>
              </> :

            <div className="text-center py-4 text-muted-foreground">
                <p>{t("noCalculationData")}</p>
              </div>
            }
          </CardContent>
        </Card>

        
        {transport && transport.legs.length > 0 &&
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <div className="h-1 bg-linear-to-r from-sky-500 via-cyan-400 to-emerald-400"></div>
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    {t("transportJourneyTitle")}
                  </CardTitle>
                  <div className="flex items-center gap-1 text-sm font-medium text-foreground/90">
                    <span>{transportOrigin}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{transportDestination}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="h-6">
                  {transportSourceLabel}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    {uiText.legsLabel}
                  </div>
                  <div className="text-base font-semibold text-slate-900">
                    {transport.legs.length}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    {uiText.summaryDistance}
                  </div>
                  <div className="text-base font-semibold text-slate-900">
                    {formatExactValue(totalDistanceKm)} km
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    {uiText.summaryCo2}
                  </div>
                  <div className="text-base font-semibold text-slate-900">
                    {formatExactValue(totalCo2Kg)} kg
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    {uiText.summaryIntensity}
                  </div>
                  <div className="text-base font-semibold text-slate-900">
                    {formatExactValue(averageIntensity)} kg/km
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span>{uiText.summaryRoute}</span>
                <span className="font-medium text-slate-800">{routeTypeLabel}</span>
              </div>
              <div className="space-y-2">
                {transport.legs.map((leg, index) =>
                <div key={leg.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                          {getModeIcon(leg.mode)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1 text-sm font-medium">
                            <span className="truncate">{leg.origin.name}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="truncate">{leg.destination.name}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{formatExactValue(leg.distanceKm)} km</span>
                            <span>{formatExactValue(leg.co2Kg)} kg CO2e</span>
                            {leg.emissionFactor > 0 &&
                            <span>{formatExactValue(leg.emissionFactor)} kg/km</span>
                            }
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="outline" className="h-6">
                          {uiText.legPrefix} {index + 1}/{transport.legs.length}
                        </Badge>
                        <Badge variant="outline" className="h-6">
                          {getModeLabel(leg.mode)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        }

        
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <div className="h-1 bg-linear-to-r from-emerald-500 via-teal-400 to-sky-400"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              {t("exportReadinessTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{t("evaluationScoreLabel")}</span>
                <span className="text-lg font-bold text-green-600">
                  {exportReadiness}%
                </span>
              </div>
              <Progress value={exportReadiness} className="h-2" />
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">{t("complianceByMarketLabel")}</p>
              {["eu", "us", "jp", "kr"].map((market) => {
                const compliance = getComplianceStatus(market);
                return (
                  <div
                    key={market}
                    className="flex items-center justify-between">
                    
                    <span className="text-sm">{MARKET_LABELS[market]}</span>
                    <Badge
                      variant="secondary"
                      className={
                      compliance.status === "compliant" ?
                      "bg-green-100 text-green-700" :
                      compliance.status === "partial" ?
                      "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                      }>
                      
                      {compliance.status === "compliant" &&
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      }
                      {compliance.label}
                    </Badge>
                  </div>);

              })}
            </div>
          </CardContent>
        </Card>

        
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <div className="h-1 bg-linear-to-r from-amber-500 via-orange-400 to-emerald-400"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              {t("originCertificationTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">{t("materialsSection")}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {MATERIAL_LABELS[product.primaryMaterial] ||
                  product.primaryMaterial}{" "}
                  {product.materialPercentage}%
                </Badge>
                {product.secondaryMaterial &&
                <Badge variant="outline">
                    {MATERIAL_LABELS[product.secondaryMaterial] ||
                  product.secondaryMaterial}{" "}
                    {product.secondaryPercentage}%
                  </Badge>
                }
              </div>
              {product.recycledContent &&
              parseInt(product.recycledContent) > 0 &&
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <Recycle className="w-3 h-3" />
                    {product.recycledContent}% {t("recycledContentLabel")}
                  </p>
              }
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium mb-2">{t("certificationsSection")}</p>
              <div className="flex flex-wrap gap-2">
                {product.certifications.length > 0 ?
                product.certifications.map((cert) =>
                <Badge key={cert} className="bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {CERTIFICATION_LABELS[cert] || cert}
                    </Badge>
                ) :

                <span className="text-sm text-muted-foreground">
                    {t("noCertifications")}
                  </span>
                }
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("manufacturingLocationLabel")}</p>
                <p className="font-medium flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {product.manufacturingLocation}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("marketLabel")}</p>
                <p className="font-medium mt-1">
                  {MARKET_LABELS[product.destinationMarket] ||
                  product.destinationMarket}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        
        <div className="text-center py-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              {t("updatedLabel")}{" "}
              {new Date(product.createdAt).toLocaleDateString(displayLocale)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("poweredBy")}{" "}
            <span className="font-semibold text-green-600">WeaveCarbon</span>
          </p>
        </div>
      </main>
    </div>);

};

export default PassportClient;
