"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw } from
"lucide-react";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import TransportScopeSelector from "./TransportScopeSelector";
import TransportLegCard from "./TransportLegCard";
import TransportResultsSidebar from "./TransportResultsSidebar";
import PermissionDialog from "@/components/ui/PermissionDialog";
import TransportMap from "@/components/ui/TransportMap";
import type { TransportLeg } from "@/types/transport";
import {
  fetchAllLogisticsShipmentDetails,
  fetchLogisticsShipmentById,
  fetchLogisticsShipments,
  isValidUuid,
  type LogisticsLocation,
  toTransportLegs,
  type LogisticsShipmentDetail } from
"@/lib/logisticsApi";
import { toast } from "sonner";
import {
  fetchProductById,
  formatApiErrorMessage,
  updateProduct,
  type ProductRecord } from
"@/lib/productsApi";
import type { ProductAssessmentData } from "@/components/dashboard/assessment/steps/types";
import {
  fetchRoadRoute,
  isRoadTransportMode,
  type RoadRouteFailureReason
} from "@/lib/roadRouting";export interface AddressData {
  streetAddress: string;
  aptSuite: string;
  city: string;
  state: string;
  zipPostcode: string;
  country: string;
  lat?: string;
  lng?: string;
}

export interface LegInput {
  id: string;
  type: "domestic" | "international";
  mode: "truck_light" | "truck_heavy" | "ship" | "air" | "rail";
  origin: AddressData;
  destination: AddressData;
  distanceKm: string;
  co2Kg?: number;
  co2PerTonKg?: number;
}

type ShipmentLoadState = "idle" | "loading" | "ready" | "not_found" | "error";

const createEmptyAddress = (): AddressData => ({
  streetAddress: "",
  aptSuite: "",
  city: "",
  state: "",
  zipPostcode: "",
  country: "Vietnam",
  lat: "",
  lng: ""
});

const createDraftLeg = (
type: LegInput["type"] = "international",
id = `draft-leg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`)
: LegInput => ({
  id,
  type,
  mode: type === "domestic" ? "truck_light" : "ship",
  origin: createEmptyAddress(),
  destination: createEmptyAddress(),
  distanceKm: ""
});

const createInitialLeg = () => createDraftLeg("international", "draft-leg-1");

const EMISSION_FACTORS: Record<string, number> = {
  truck_light: 0.089,
  truck_heavy: 0.105,
  ship: 0.016,
  air: 0.602,
  rail: 0.028
};

const parseCoordinate = (value?: string) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatRouteDistanceKm = (value: number) =>
  String(Math.round((Math.max(0, value) + Number.EPSILON) * 10) / 10);

const buildRoadRouteKey = (
  mode: LegInput["mode"],
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number
) =>
  [
    mode,
    originLat.toFixed(6),
    originLng.toFixed(6),
    destinationLat.toFixed(6),
    destinationLng.toFixed(6)
  ].join(":");

const toRouteType = (mode: LegInput["mode"]): TransportLeg["routeType"] => {
  if (mode === "ship") return "sea";
  if (mode === "air") return "air";
  return "road";
};

const toProductTransportMode = (
mode: LegInput["mode"])
: "road" | "sea" | "air" | "rail" => {
  if (mode === "ship") return "sea";
  if (mode === "air") return "air";
  if (mode === "rail") return "rail";
  return "road";
};

const parseOptionalCoordinate = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const hasUsefulAddressInput = (address: AddressData) =>
[
address.streetAddress,
address.aptSuite,
address.city,
address.state,
address.zipPostcode,
address.country]
.
some((value) => value.trim().length > 0);

const toAddressInput = (address: AddressData) => {
  const normalizedAptSuite = address.aptSuite.trim();
  const aptSuiteParts = address.aptSuite.
  split(",").
  map((part) => part.trim()).
  filter(Boolean);
  const [ward, ...districtParts] = aptSuiteParts;

  return {
    aptSuite: normalizedAptSuite,
    streetNumber: "",
    street: address.streetAddress.trim(),
    ward: ward || "",
    district: districtParts.join(", "),
    city: address.city.trim(),
    stateRegion: address.state.trim(),
    country: address.country.trim(),
    postalCode: address.zipPostcode.trim(),
    lat: parseOptionalCoordinate(address.lat),
    lng: parseOptionalCoordinate(address.lng)
  };
};

const toProductPayload = (
product: ProductRecord,
updates: Partial<ProductAssessmentData>)
: ProductAssessmentData => ({
  productCode: product.productCode,
  productName: product.productName,
  productType: product.productType,
  weightPerUnit: product.weightPerUnit,
  quantity: product.quantity,
  materials: product.materials,
  accessories: product.accessories,
  productionProcesses: product.productionProcesses,
  energySources: product.energySources,
  manufacturingLocation: product.manufacturingLocation,
  wasteRecovery: product.wasteRecovery,
  destinationMarket: product.destinationMarket,
  originAddress: product.originAddress,
  destinationAddress: product.destinationAddress,
  transportLegs: product.transportLegs,
  estimatedTotalDistance: product.estimatedTotalDistance,
  carbonResults: product.carbonResults,
  status: product.status === "published" ? "published" : "draft",
  version: Math.max(1, product.version || 1),
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  ...updates
});

const addressToLabel = (address: AddressData) => {
  const parts = [address.city, address.state, address.country].
  map((part) => part.trim()).
  filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
};

const locationToAddress = (
location: TransportLeg["origin"] | TransportLeg["destination"])
: AddressData => {
  const parts = location.name.
  split(",").
  map((part) => part.trim()).
  filter(Boolean);

  const city = parts[0] || "";
  const country = parts.length > 1 ? parts[parts.length - 1] : "Vietnam";

  return {
    ...createEmptyAddress(),
    city,
    country,
    lat: Number.isFinite(location.lat) ? String(location.lat) : "",
    lng: Number.isFinite(location.lng) ? String(location.lng) : ""
  };
};

const toLegInput = (leg: TransportLeg): LegInput => ({
  id: leg.id,
  type: leg.type,
  mode: leg.mode,
  origin: locationToAddress(leg.origin),
  destination: locationToAddress(leg.destination),
  distanceKm:
  leg.distanceKm > 0 ?
  String(Math.round((leg.distanceKm + Number.EPSILON) * 100) / 100) :
  "",
  co2Kg: leg.co2Kg,
  co2PerTonKg: leg.co2PerTonKg
});

const mapProductTransportMode = (
mode: "road" | "sea" | "air" | "rail" | undefined)
: LegInput["mode"] => {
  if (mode === "sea") return "ship";
  if (mode === "air") return "air";
  if (mode === "rail") return "rail";
  return "truck_heavy";
};

const toProductAddress = (address?: ProductRecord["originAddress"]): AddressData => {
  const streetAddress = [address?.streetNumber, address?.street].
  map((value) => (value || "").trim()).
  filter(Boolean).
  join(" ");
  const aptSuite =
    (address?.aptSuite || "").trim() ||
    [address?.ward, address?.district].
      map((value) => (value || "").trim()).
      filter(Boolean).
      join(", ");

  return {
    streetAddress,
    aptSuite,
    city: (address?.city || "").trim(),
    state: (address?.stateRegion || "").trim(),
    zipPostcode: (address?.postalCode || "").trim(),
    country: (address?.country || "Vietnam").trim() || "Vietnam",
    lat:
    typeof address?.lat === "number" && Number.isFinite(address.lat) ?
    String(address.lat) :
    "",
    lng:
    typeof address?.lng === "number" && Number.isFinite(address.lng) ?
    String(address.lng) :
    ""
  };
};

const toShipmentLocationAddress = (location: LogisticsLocation): AddressData => ({
  ...createEmptyAddress(),
  streetAddress: location.address.trim(),
  city: location.city.trim(),
  country: location.country.trim() || "Vietnam",
  lat:
  typeof location.lat === "number" && Number.isFinite(location.lat) ?
  String(location.lat) :
  "",
  lng:
  typeof location.lng === "number" && Number.isFinite(location.lng) ?
  String(location.lng) :
  ""
});

const mergeAddressData = (
current: AddressData,
fallback: AddressData)
: AddressData => {
  const pick = (value: string | undefined, fallbackValue: string | undefined) => {
    const normalized = (value || "").trim();
    if (normalized.length > 0) return normalized;
    return (fallbackValue || "").trim();
  };

  return {
    streetAddress: pick(current.streetAddress, fallback.streetAddress),
    aptSuite: pick(current.aptSuite, fallback.aptSuite),
    city: pick(current.city, fallback.city),
    state: pick(current.state, fallback.state),
    zipPostcode: pick(current.zipPostcode, fallback.zipPostcode),
    country: pick(current.country, fallback.country) || "Vietnam",
    lat: pick(current.lat, fallback.lat),
    lng: pick(current.lng, fallback.lng)
  };
};

const buildFallbackLegFromProduct = (product: ProductRecord): LegInput | null => {
  const origin = toProductAddress(product.originAddress);
  const destination = toProductAddress(product.destinationAddress);

  const hasUsefulOrigin =
  origin.city.trim().length > 0 ||
  origin.country.trim().length > 0 ||
  origin.lat?.trim().length !== 0;
  const hasUsefulDestination =
  destination.city.trim().length > 0 ||
  destination.country.trim().length > 0 ||
  destination.lat?.trim().length !== 0;

  if (!hasUsefulOrigin && !hasUsefulDestination) return null;

  const firstTransportLeg = product.transportLegs[0];
  const normalizedOriginCountry = origin.country.trim().toLowerCase();
  const normalizedDestinationCountry = destination.country.trim().toLowerCase();
  const type: LegInput["type"] =
  normalizedOriginCountry &&
  normalizedDestinationCountry &&
  normalizedOriginCountry === normalizedDestinationCountry ?
  "domestic" :
  "international";

  const distance =
  product.estimatedTotalDistance > 0 ?
  product.estimatedTotalDistance :
  firstTransportLeg?.estimatedDistance || 0;
  const transportCo2 = product.carbonResults?.perProduct.transport || undefined;

  return {
    id: `product-fallback-${product.id}`,
    type,
    mode: mapProductTransportMode(firstTransportLeg?.mode),
    origin,
    destination,
    distanceKm: distance > 0 ? String(distance) : "",
    co2Kg: transportCo2,
    co2PerTonKg: firstTransportLeg?.co2PerTonKg
  };
};

const hydrateLegInputsFromShipmentAndProduct = (
legs: LegInput[],
shipment: LogisticsShipmentDetail,
product: ProductRecord | null) =>
{
  if (!legs.length) return legs;

  const originFallback = mergeAddressData(
    toShipmentLocationAddress(shipment.origin),
    product ? toProductAddress(product.originAddress) : createEmptyAddress()
  );
  const destinationFallback = mergeAddressData(
    toShipmentLocationAddress(shipment.destination),
    product ? toProductAddress(product.destinationAddress) : createEmptyAddress()
  );

  return legs.map((leg, index) => {
    const isFirst = index === 0;
    const isLast = index === legs.length - 1;
    return {
      ...leg,
      origin: isFirst ? mergeAddressData(leg.origin, originFallback) : leg.origin,
      destination: isLast ?
      mergeAddressData(leg.destination, destinationFallback) :
      leg.destination
    };
  });
};

interface ShipmentLookupInput {
  shipmentId?: string;
  productId?: string;
  productCode?: string;
  productName?: string;
}

const normalizeLookupValue = (value?: string | null) =>
(value || "").trim().toLowerCase();

const toLookupTokens = (values: Array<string | undefined>) => {
  const seen = new Set<string>();
  const tokens: string[] = [];
  values.forEach((value) => {
    const normalized = (value || "").trim();
    if (normalized.length < 2) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    tokens.push(normalized);
  });
  return tokens;
};

const shipmentMatchesLookup = (
shipment: LogisticsShipmentDetail,
lookup: ShipmentLookupInput) =>
{
  const targetProductId = normalizeLookupValue(lookup.productId);
  const targetSku = normalizeLookupValue(lookup.productCode);
  const targetName = normalizeLookupValue(lookup.productName);

  if (!targetProductId && !targetSku && !targetName) {
    return true;
  }

  const matchesProduct = shipment.products.some((product) => {
    const productId = normalizeLookupValue(product.product_id);
    const sku = normalizeLookupValue(product.sku);
    const name = normalizeLookupValue(product.product_name);

    if (targetProductId && productId === targetProductId) return true;
    if (targetSku && sku) {
      if (sku === targetSku || sku.includes(targetSku) || targetSku.includes(sku)) {
        return true;
      }
    }
    if (targetName && name && name.includes(targetName)) return true;
    return false;
  });

  if (matchesProduct) return true;

  const reference = normalizeLookupValue(shipment.reference_number);
  if (targetSku && reference && reference.includes(targetSku)) {
    return true;
  }

  return false;
};

const resolveShipmentForProduct = async (
lookup: ShipmentLookupInput,
prefetchedProduct?: ProductRecord | null)
: Promise<LogisticsShipmentDetail | null> => {
  const normalizedShipmentId = (lookup.shipmentId || "").trim();
  const normalizedProductId = (lookup.productId || "").trim();
  const inspectedIds = new Set<string>();
  let productDetail = prefetchedProduct || null;

  const inspectShipmentById = async (
  shipmentId: string,
  enforceMatch = true)
  : Promise<LogisticsShipmentDetail | null> => {
    const normalizedId = shipmentId.trim();
    if (!normalizedId || !isValidUuid(normalizedId) || inspectedIds.has(normalizedId)) {
      return null;
    }
    inspectedIds.add(normalizedId);

    try {
      const detail = await fetchLogisticsShipmentById(normalizedId);
      if (!enforceMatch || shipmentMatchesLookup(detail, lookup)) {
        return detail;
      }
    } catch {
      return null;
    }
    return null;
  };

  const directShipmentMatch = await inspectShipmentById(normalizedShipmentId, false);
  if (directShipmentMatch) return directShipmentMatch;

  if (normalizedProductId) {
    try {
      if (!productDetail) {
        productDetail = await fetchProductById(normalizedProductId);
      }
      const linkedShipmentId = (productDetail?.shipmentId || "").trim();
      const linkedShipment = await inspectShipmentById(linkedShipmentId, false);
      if (linkedShipment) return linkedShipment;
    } catch {

    }
  }

  const productAsShipment = await inspectShipmentById(normalizedProductId, true);
  if (productAsShipment) return productAsShipment;

  const candidateIds: string[] = [];
  const addCandidateId = (id: string) => {
    const normalizedId = id.trim();
    if (!normalizedId || !isValidUuid(normalizedId)) return;
    if (candidateIds.includes(normalizedId)) return;
    candidateIds.push(normalizedId);
  };

  const lookupTokens = toLookupTokens([
  normalizedProductId,
  lookup.productCode,
  lookup.productName]
  );

  for (const token of lookupTokens) {
    try {
      const result = await fetchLogisticsShipments({
        search: token,
        page: 1,
        page_size: 10
      });
      result.items.forEach((summary) => addCandidateId(summary.id));
    } catch {

    }
  }

  for (const candidateId of candidateIds) {
    const matched = await inspectShipmentById(candidateId, true);
    if (matched) return matched;
  }

  try {
    const recentShipments = await fetchLogisticsShipments({
      page: 1,
      page_size: 30
    });
    for (const summary of recentShipments.items) {
      const matched = await inspectShipmentById(summary.id, true);
      if (matched) return matched;
    }
  } catch {

  }

  try {
    const allShipmentDetails = await fetchAllLogisticsShipmentDetails();
    const matched = allShipmentDetails.find((shipment) =>
    shipmentMatchesLookup(shipment, lookup)
    );
    if (matched) return matched;
  } catch {

  }

  return null;
};

interface TransportClientProps {
  shipmentId?: string;
  productId?: string;
  productName?: string;
  productCode?: string;
}

const TransportClient: React.FC<TransportClientProps> = ({
  shipmentId,
  productId,
  productName,
  productCode
}) => {
  const t = useTranslations("transport");
  const router = useRouter();
  const { setPageTitle } = useDashboardTitle();
  const hasLookupInput = Boolean(shipmentId || productId || productCode || productName);
  const [transportScope, setTransportScope] = useState<
    "domestic" | "international">(
    "international");
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [legs, setLegs] = useState<LegInput[]>([createInitialLeg()]);
  const [loadedProduct, setLoadedProduct] = useState<ProductRecord | null>(null);
  const [shipmentLoadState, setShipmentLoadState] = useState<ShipmentLoadState>(
    hasLookupInput ? "loading" : "idle"
  );
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [roadRouteFailureByLegId, setRoadRouteFailureByLegId] = useState<
    Record<string, RoadRouteFailureReason>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isResolvingRoadRoutes, setIsResolvingRoadRoutes] = useState(false);
  const autoRoadRouteSyncRef = React.useRef<
    Record<string, {routeKey: string;distanceKm: string;}>
  >({});
  const trackedRoadRouteKeysRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    setPageTitle(t("title"), t("subtitle"));
  }, [setPageTitle, t]);

  useEffect(() => {
    let isCancelled = false;

    const hydrateFromShipment = async () => {
        if (!hasLookupInput) {
          if (isCancelled) return;
          setShipmentLoadState("idle");
          setShipmentError(null);
          setLoadedProduct(null);
          setLegs([createInitialLeg()]);
          return;
        }

      setShipmentLoadState("loading");
      setShipmentError(null);

      try {
        let productDetail: ProductRecord | null = null;
        if (productId) {
          try {
            productDetail = await fetchProductById(productId);
          } catch {
            productDetail = null;
          }
        }
        setLoadedProduct(productDetail);

        const matchedShipment = await resolveShipmentForProduct({
          shipmentId,
          productId,
          productCode,
          productName
        }, productDetail);
        if (isCancelled) return;

        if (!matchedShipment) {
          const productFallbackLeg =
          productDetail ? buildFallbackLegFromProduct(productDetail) : null;
          if (productFallbackLeg) {
            setLegs([productFallbackLeg]);
            setTransportScope(productFallbackLeg.type === "international" ? "international" : "domestic");
            setShipmentLoadState("ready");
            return;
          }
          setShipmentLoadState("not_found");
          setLegs([createInitialLeg()]);
          return;
        }

        const hydratedLegs = hydrateLegInputsFromShipmentAndProduct(
          toTransportLegs(matchedShipment).map(toLegInput),
          matchedShipment,
          productDetail
        );
        if (!hydratedLegs.length) {
          const productFallbackLeg =
          productDetail ? buildFallbackLegFromProduct(productDetail) : null;
          if (productFallbackLeg) {
            setLegs([productFallbackLeg]);
            setTransportScope(productFallbackLeg.type === "international" ? "international" : "domestic");
            setShipmentLoadState("ready");
            return;
          }
          setShipmentLoadState("not_found");
          setLegs([createInitialLeg()]);
          return;
        }

        setLegs(hydratedLegs);
        setTransportScope(
          hydratedLegs.some((leg) => leg.type === "international") ?
          "international" :
          "domestic"
        );
        setShipmentLoadState("ready");
      } catch (error) {
        if (isCancelled) return;
        const message =
        error instanceof Error && error.message.trim().length > 0 ?
        error.message :
        t("errors.loadLogisticsFailed");
        setShipmentError(message);
        setShipmentLoadState("error");
        setLoadedProduct(null);
        setLegs([createInitialLeg()]);
      }
    };

    void hydrateFromShipment();

    return () => {
      isCancelled = true;
    };
  }, [hasLookupInput, shipmentId, productId, productCode, productName, reloadCounter, t]);

  useEffect(() => {
    let isCancelled = false;
    const cachedUpdates: Array<{id: string;distanceKm: string;}> = [];
    const pendingLegs: Array<{
      id: string;
      routeKey: string;
      originLat: number;
      originLng: number;
      destinationLat: number;
      destinationLng: number;
    }> = [];

    legs.forEach((leg) => {
      if (!isRoadTransportMode(leg.mode)) {
        delete autoRoadRouteSyncRef.current[leg.id];
        return;
      }

      const originLat = parseCoordinate(leg.origin.lat);
      const originLng = parseCoordinate(leg.origin.lng);
      const destinationLat = parseCoordinate(leg.destination.lat);
      const destinationLng = parseCoordinate(leg.destination.lng);
      if (
        originLat === null ||
        originLng === null ||
        destinationLat === null ||
        destinationLng === null
      ) {
        return;
      }

      const routeKey = buildRoadRouteKey(
        leg.mode,
        originLat,
        originLng,
        destinationLat,
        destinationLng
      );
      const cached = autoRoadRouteSyncRef.current[leg.id];

      if (cached && cached.routeKey === routeKey) {
        if (!leg.distanceKm.trim() && cached.distanceKm !== leg.distanceKm) {
          cachedUpdates.push({
            id: leg.id,
            distanceKm: cached.distanceKm
          });
        }
        return;
      }

      pendingLegs.push({
        id: leg.id,
        routeKey,
        originLat,
        originLng,
        destinationLat,
        destinationLng
      });
    });

    if (cachedUpdates.length > 0) {
      setLegs((current) =>
        current.map((leg) => {
          const cachedUpdate = cachedUpdates.find((item) => item.id === leg.id);
          if (!cachedUpdate || leg.distanceKm === cachedUpdate.distanceKm) {
            return leg;
          }
          return {
            ...leg,
            distanceKm: cachedUpdate.distanceKm,
            co2Kg: undefined,
            co2PerTonKg: undefined
          };
        })
      );
    }

    if (pendingLegs.length === 0) {
      setRoadRouteFailureByLegId((current) => {
        const next = { ...current };
        Object.keys(next).forEach((legId) => {
          const matchedLeg = legs.find((leg) => leg.id === legId);
          if (!matchedLeg || !isRoadTransportMode(matchedLeg.mode)) {
            delete next[legId];
          }
        });
        return next;
      });
      setIsResolvingRoadRoutes(false);
      return;
    }

    setIsResolvingRoadRoutes(true);

    const syncRoadLegDistances = async () => {
      const resolvedUpdates = await Promise.all(
        pendingLegs.map(async (candidate) => {
          const routeResolution = await fetchRoadRoute(
            {
              lat: candidate.originLat,
              lng: candidate.originLng
            },
            {
              lat: candidate.destinationLat,
              lng: candidate.destinationLng
            }
          );

          if (!routeResolution.ok) {
            return {
              failureReason: routeResolution.failureReason,
              id: candidate.id,
              routeKey: candidate.routeKey
            };
          }

          return {
            id: candidate.id,
            routeKey: candidate.routeKey,
            distanceKm: formatRouteDistanceKm(routeResolution.route.distanceKm)
          };
        })
      );

      if (isCancelled) return;

      const nextUpdates = resolvedUpdates.filter(
        (item): item is {id: string;routeKey: string;distanceKm: string;} =>
          Boolean(item && "distanceKm" in item)
      );
      const nextFailures = resolvedUpdates.filter(
        (item): item is {failureReason: RoadRouteFailureReason;id: string;routeKey: string;} =>
          Boolean(item && "failureReason" in item)
      );

      nextUpdates.forEach((update) => {
        autoRoadRouteSyncRef.current[update.id] = {
          routeKey: update.routeKey,
          distanceKm: update.distanceKm
        };
      });

      const hasNewTrackedRoadRoute = nextUpdates.some((update) => {
        if (trackedRoadRouteKeysRef.current.has(update.routeKey)) {
          return false;
        }
        trackedRoadRouteKeysRef.current.add(update.routeKey);
        return true;
      });

      if (hasNewTrackedRoadRoute) {
        }

      setRoadRouteFailureByLegId((current) => {
        const next = { ...current };

        legs.forEach((leg) => {
          if (!isRoadTransportMode(leg.mode)) {
            delete next[leg.id];
          }
        });

        nextUpdates.forEach((update) => {
          delete next[update.id];
        });

        nextFailures.forEach((failure) => {
          next[failure.id] = failure.failureReason;
        });

        return next;
      });

      if (nextUpdates.length > 0) {
        setLegs((current) =>
          current.map((leg) => {
            const nextUpdate = nextUpdates.find((item) => item.id === leg.id);
            if (!nextUpdate || leg.distanceKm === nextUpdate.distanceKm) {
              return leg;
            }
            return {
              ...leg,
              distanceKm: nextUpdate.distanceKm,
              co2Kg: undefined,
              co2PerTonKg: undefined
            };
          })
        );
      }

      setIsResolvingRoadRoutes(false);
    };

    void syncRoadLegDistances();

    return () => {
      isCancelled = true;
    };
  }, [legs]);

  const handleAddLeg = () => {
    setLegs((current) => [...current, createDraftLeg(transportScope)]);
  };

  const handleRemoveLeg = (id: string) => {
    setRoadRouteFailureByLegId((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLegs((current) =>
    current.length > 1 ? current.filter((leg) => leg.id !== id) : current
    );
  };

const updateLeg = (
  id: string,
  field: keyof LegInput,
  value: string | AddressData) =>
  {
    setRoadRouteFailureByLegId((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLegs((current) =>
    current.map((leg) => {
      if (leg.id !== id) return leg;
      return {
        ...leg,
        [field]: value,
        co2Kg: undefined,
        co2PerTonKg: undefined
      };
    })
    );
  };

  const batchMassTonne = useMemo(() => {
    if (!loadedProduct) return 0;
    return ((Math.max(0, Number(loadedProduct.weightPerUnit) || 0) / 1000) *
      Math.max(1, Number(loadedProduct.quantity) || 1)) /
      1000;
  }, [loadedProduct]);

  const calculateLegCo2PerTon = useCallback((leg: LegInput): number => {
    if (typeof leg.co2PerTonKg === "number" && Number.isFinite(leg.co2PerTonKg)) {
      return Math.max(0, leg.co2PerTonKg);
    }
    if (
      batchMassTonne > 0 &&
      typeof leg.co2Kg === "number" &&
      Number.isFinite(leg.co2Kg)
    ) {
      return Math.max(0, leg.co2Kg / batchMassTonne);
    }
    const distance = parseFloat(leg.distanceKm) || 0;
    const factor = EMISSION_FACTORS[leg.mode] || 0;
    return distance * factor;
  }, [batchMassTonne]);

  const calculateLegCO2 = useCallback((leg: LegInput): number => {
    if (
      batchMassTonne > 0 &&
      typeof leg.co2PerTonKg === "number" &&
      Number.isFinite(leg.co2PerTonKg)
    ) {
      return Math.max(0, leg.co2PerTonKg * batchMassTonne);
    }
    if (typeof leg.co2Kg === "number" && Number.isFinite(leg.co2Kg)) {
      return Math.max(0, leg.co2Kg);
    }
    const perTonValue = calculateLegCo2PerTon(leg);
    return batchMassTonne > 0 ? perTonValue * batchMassTonne : perTonValue;
  }, [batchMassTonne, calculateLegCo2PerTon]);

  const totalDistance = useMemo(
    () =>
    legs.reduce(
      (sum, leg) => sum + (parseFloat(leg.distanceKm) || 0),
      0
    ),
    [legs]
  );

  const totalCO2 = useMemo(
    () => legs.reduce((sum, leg) => sum + calculateLegCO2(leg), 0),
    [calculateLegCO2, legs]
  );

  const displayLegs = useMemo(
    () =>
    legs.
    map((leg, index) => {
      const originLat = parseCoordinate(leg.origin.lat);
      const originLng = parseCoordinate(leg.origin.lng);
      const destinationLat = parseCoordinate(leg.destination.lat);
      const destinationLng = parseCoordinate(leg.destination.lng);
      if (
      originLat === null ||
      originLng === null ||
      destinationLat === null ||
      destinationLng === null)
      {
        return null;
      }

      const distance = parseFloat(leg.distanceKm) || 0;
      const co2Kg = calculateLegCO2(leg);
      const emissionFactor =
      distance > 0 && co2Kg > 0 ?
      co2Kg / distance :
      EMISSION_FACTORS[leg.mode] || 0;

      return {
        id: leg.id,
        legNumber: index + 1,
        type: leg.type,
        mode: leg.mode,
        origin: {
          name: addressToLabel(leg.origin) || t("unknownLocation"),
          lat: originLat,
          lng: originLng,
          type: "address"
        },
        destination: {
          name: addressToLabel(leg.destination) || t("unknownLocation"),
          lat: destinationLat,
          lng: destinationLng,
          type: "address"
        },
        distanceKm: distance,
        emissionFactor,
        co2Kg,
        routeType: toRouteType(leg.mode)
      } as TransportLeg;
    }).
    filter((leg): leg is TransportLeg => leg !== null),
    [calculateLegCO2, legs, t]
  );

  const handleSubmit = async () => {
    if (!productId) {
      router.push("/calculation-history");
      return;
    }

    setIsSaving(true);

    try {
      const product = await fetchProductById(productId);
      const quantity = Math.max(1, Number(product.quantity) || 1);
      const batchMassTonne =
        ((Math.max(0, Number(product.weightPerUnit) || 0) / 1000) * quantity) / 1000;
      const totalCo2PerTonKg = Math.max(
        0,
        legs.reduce((sum, leg) => sum + calculateLegCo2PerTon(leg), 0)
      );
      const nextTransportLegs = legs.map((leg) => {
        const distance = Number.parseFloat(leg.distanceKm);
        const normalizedDistance =
        Number.isFinite(distance) && distance > 0 ? distance : undefined;
        const inferredPerTonFromDistance =
          normalizedDistance && normalizedDistance > 0 ?
            normalizedDistance * (EMISSION_FACTORS[leg.mode] || 0) :
            0;
        const co2PerTonKg = Math.max(
          0,
          typeof leg.co2PerTonKg === "number" && Number.isFinite(leg.co2PerTonKg) ?
            leg.co2PerTonKg :
            batchMassTonne > 0 && typeof leg.co2Kg === "number" && Number.isFinite(leg.co2Kg) ?
              leg.co2Kg / batchMassTonne :
              inferredPerTonFromDistance
        );
        const emissionFactor =
        normalizedDistance && normalizedDistance > 0 ?
        co2PerTonKg / normalizedDistance :
        EMISSION_FACTORS[leg.mode];
        const allocatedCo2Kg =
          batchMassTonne > 0 ? co2PerTonKg * batchMassTonne : co2PerTonKg;

        return {
          id: leg.id,
          mode: toProductTransportMode(leg.mode),
          estimatedDistance: normalizedDistance,
          emissionFactor: Number.isFinite(emissionFactor) ? emissionFactor : undefined,
          co2PerTonKg: co2PerTonKg > 0 ? co2PerTonKg : undefined,
          allocatedCo2Kg: allocatedCo2Kg > 0 ? allocatedCo2Kg : undefined,
          co2Kg: allocatedCo2Kg > 0 ? allocatedCo2Kg : undefined
        };
      });

      const currentPerProduct = product.carbonResults?.perProduct as {
        materials?: number;
        production?: number;
        energy?: number;
        transport?: number;
        packaging?: number;
        total?: number;
      } | undefined;
      const currentTotalBatch = product.carbonResults?.totalBatch as {
        materials?: number;
        production?: number;
        energy?: number;
        transport?: number;
        packaging?: number;
        total?: number;
      } | undefined;

      const materials = Number(currentPerProduct?.materials) || 0;
      const production = Number(currentPerProduct?.production) || 0;
      const energy = Number(currentPerProduct?.energy) || 0;
      const packaging = Number(currentPerProduct?.packaging) || (
      Number(currentTotalBatch?.packaging) > 0 ?
      Number(currentTotalBatch?.packaging) / quantity :
      0);
      const batchTransport =
        batchMassTonne > 0 ? totalCo2PerTonKg * batchMassTonne : totalCo2PerTonKg;
      const transport = quantity > 0 ? batchTransport / quantity : batchTransport;
      const perProductTotal =
      materials +
      production +
      energy +
      transport +
      packaging;

      const batchMaterials =
      Number(currentTotalBatch?.materials) > 0 ?
      Number(currentTotalBatch?.materials) :
      materials * quantity;
      const batchProduction =
      Number(currentTotalBatch?.production) > 0 ?
      Number(currentTotalBatch?.production) :
      production * quantity;
      const batchEnergy =
      Number(currentTotalBatch?.energy) > 0 ?
      Number(currentTotalBatch?.energy) :
      energy * quantity;
      const batchPackaging =
      Number(currentTotalBatch?.packaging) > 0 ?
      Number(currentTotalBatch?.packaging) :
      packaging * quantity;

      const nextCarbonResults = {
        ...product.carbonResults,
        confidenceLevel: product.carbonResults?.confidenceLevel || "medium",
        confidenceScore: product.carbonResults?.confidenceScore,
        proxyUsed: Boolean(product.carbonResults?.proxyUsed),
        proxyNotes: product.carbonResults?.proxyNotes || [],
        scope1: product.carbonResults?.scope1 ?? null,
        scope2: product.carbonResults?.scope2 ?? null,
        scope3: product.carbonResults?.scope3 ?? null,
        perProduct: {
          materials,
          production,
          energy,
          transport,
          packaging,
          total: perProductTotal
        },
        totalBatch: {
          materials: batchMaterials,
          production: batchProduction,
          energy: batchEnergy,
          transport: batchTransport,
          packaging: batchPackaging,
          total: batchMaterials + batchProduction + batchEnergy + batchTransport + batchPackaging
        }
      };

      const firstLegOrigin = legs[0]?.origin;
      const lastLegDestination = legs[legs.length - 1]?.destination;
      const payload = toProductPayload(product, {
        transportLegs: nextTransportLegs,
        estimatedTotalDistance:
        totalDistance > 0 ? totalDistance : product.estimatedTotalDistance,
        originAddress:
        firstLegOrigin && hasUsefulAddressInput(firstLegOrigin) ?
        toAddressInput(firstLegOrigin) :
        product.originAddress,
        destinationAddress:
        lastLegDestination && hasUsefulAddressInput(lastLegDestination) ?
        toAddressInput(lastLegDestination) :
        product.destinationAddress,
        carbonResults: nextCarbonResults,
        updatedAt: new Date().toISOString()
      });

      await updateProduct(productId, payload);
      router.push(`/calculation-history?productId=${encodeURIComponent(productId)}`);
    } catch (error) {
      toast.error(formatApiErrorMessage(error, t("errors.loadLogisticsFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocationPermission = async () => {
    setHasLocationPermission(true);
    setShowLocationDialog(false);
  };

  const isShipmentLoading = hasLookupInput && shipmentLoadState === "loading";
  const isBusy = isShipmentLoading || isSaving || isResolvingRoadRoutes;
  const canRetryShipment =
  hasLookupInput && (
  shipmentLoadState === "error" || shipmentLoadState === "not_found");
  const mapSubject = useMemo(() => {
    const name = (productName || "").trim();
    const code = (productCode || "").trim();
    const shipment = (shipmentId || "").trim();
    const product = (productId || "").trim();

    if (name) return name;
    if (code) return code;
    if (shipment) return t("mapSubject.shipment", { id: shipment.slice(0, 8) });
    if (product) return t("mapSubject.product", { id: product.slice(0, 8) });
    return undefined;
  }, [productName, productCode, shipmentId, productId, t]);
  const mapSubjectMeta = useMemo(() => {
    const name = (productName || "").trim();
    const code = (productCode || "").trim();
    if (name && code) return `SKU: ${code}`;
    return undefined;
  }, [productName, productCode]);

  return (
    <>
      <PermissionDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
        type="location"
        onAllow={handleLocationPermission}
        onDeny={() => setShowLocationDialog(false)} />


      <div className="space-y-6">
        {hasLookupInput && shipmentLoadState !== "ready" && shipmentLoadState !== "idle" &&
        <Card>
            <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                {shipmentLoadState === "loading" &&
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t("status.loadingLogisticsData")}
                  </p>
              }

                {shipmentLoadState === "not_found" &&
              <p className="text-xs text-amber-700 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t("status.notFoundShipment")}
                  </p>
              }

                {shipmentLoadState === "error" &&
              <p className="text-xs text-destructive inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t("status.loadErrorPrefix")} {shipmentError || t("status.unknownError")}
                  </p>
              }
              </div>

              {canRetryShipment &&
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadCounter((current) => current + 1)}>

                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t("status.retryLoadData")}
                </Button>
            }
            </CardContent>
          </Card>
        }

        {isShipmentLoading && displayLegs.length === 0 &&
        <Card className="border-dashed">
            <CardContent className="p-6 text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("status.loadingRoute")}
            </CardContent>
          </Card>
        }

        {displayLegs.length > 0 &&
        <TransportMap
          legs={displayLegs}
          mapSubject={mapSubject}
          mapSubjectMeta={mapSubjectMeta} />

        }

        {Object.keys(roadRouteFailureByLegId).length > 0 &&
        <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4 text-sm text-amber-800">
              <div className="inline-flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("status.roadRouteUnconfirmed")}</span>
              </div>
            </CardContent>
          </Card>
        }

        {hasLookupInput && !isShipmentLoading && displayLegs.length === 0 &&
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
            <CardContent className="p-4 text-sm text-amber-700">
              {t("status.noMapDataHint")}
            </CardContent>
          </Card>
        }

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <TransportScopeSelector
              value={transportScope}
              onChange={setTransportScope} />


            {legs.map((leg, index) =>
            <TransportLegCard
              key={leg.id}
              leg={leg}
              index={index}
              canRemove={legs.length > 1}
              hasLocationPermission={hasLocationPermission}
              onUpdate={updateLeg}
              onRemove={handleRemoveLeg}
              roadRouteIssue={roadRouteFailureByLegId[leg.id] ? t("status.roadRouteUnconfirmed") : null}
              calculateCO2={calculateLegCO2}
              emissionUnitLabel={
                batchMassTonne > 0 ?
                  t("units.kgCO2e") :
                  (t.has("units.kgCO2ePerTonne") ? t("units.kgCO2ePerTonne") : "kg CO2e/t shipped")
              }
              emissionFactorUnitLabel={
                t.has("units.kgCO2PerTonneKm") ?
                  t("units.kgCO2PerTonneKm") :
                  "kg CO2e/tonne.km"
              } />

            )}

            <Button
              variant="outline"
              onClick={handleAddLeg}
              className="w-full"
              disabled={isBusy}>

              <Plus className="w-4 h-4 mr-2" />
              {t("addLeg")}
            </Button>
          </div>

          <TransportResultsSidebar
            legs={legs}
            totalDistance={totalDistance}
            totalCO2={totalCO2}
            hasLocationPermission={hasLocationPermission}
            calculateLegCO2={calculateLegCO2}
            onSubmit={handleSubmit}
            isLoading={isBusy}
            emissionUnitLabel={
              batchMassTonne > 0 ?
                t("units.kgCO2e") :
                (t.has("units.kgCO2ePerTonne") ? t("units.kgCO2ePerTonne") : "kg CO2e/t shipped")
            } />

        </div>
      </div>
    </>);

};

export default TransportClient;
