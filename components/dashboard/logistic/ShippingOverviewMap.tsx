"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SHIPMENT_COLORS = [
  "#3b82f6",
  "#f97316",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#f59e0b",
  "#14b8a6",
  "#6366f1",
  "#a855f7",
];
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LazyMountOnView from "@/components/ui/LazyMountOnView";
import {
  Globe,
  SlidersHorizontal,
  Ship,
  MapPin,
  Clock,
  CheckCircle2,
  QrCode,
  X,
  XCircle } from
"lucide-react";
import SupplyChainMap, {
  SupplyChainNode,
  SupplyChainRoute } from
"./SupplyChainMap";
import ShipmentMiniMap from "./ShipmentMiniMap";
import type { TransportLeg } from "@/types/transport";
import ProductQRCode from "../ProductQRCode";
import ShipmentDetails from "../track-shipment/ShipmentDetails";
import type { TrackShipment } from "../track-shipment/types";
import {
  fetchAllLogisticsShipments,
  fetchLogisticsShipmentById,
  formatShipmentLocation,
  inferShipmentProgress,
  isValidUuid,
  resolveShipmentEta,
  toTrackShipmentStatus,
  toTransportLegs,
  type LogisticsShipmentSummary,
  type LogisticsShipmentDetail } from
"@/lib/logisticsApi";
import { useResolvedRoadRouteGeometry } from "@/hooks/useResolvedRoadRouteGeometry";
import { PRODUCT_USAGE_UPDATED_EVENT } from "@/lib/productUsageEvents";
import { fetchProductById, type ProductRecord } from "@/lib/productsApi";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";


interface Shipment {
  shipmentId: string;
  id: string;
  productId: string | null;
  productName: string;
  sku: string;
  status: "in_transit" | "delivered" | "pending" | "cancelled";
  simulationEnabled: boolean;
  progress: number;
  origin: string;
  destination: string;
  estimatedArrival: string;
  createdAt: string;
  currentLocation: {
    lat: number;
    lng: number;
    name: string;
  };
  legs: TransportLeg[];
  legsHydrated: boolean;
  totalCO2: number;
  carrier: string;
}

type ShipmentIdentity = Pick<Shipment, "shipmentId" | "id"> | Pick<TrackShipment, "shipmentId" | "id">;

const getShipmentIdentityKey = (
  shipment: ShipmentIdentity | null | undefined
) => {
  if (!shipment) return "";

  const shipmentId = String(shipment.shipmentId || "").trim();
  if (shipmentId) {
    return `shipment:${shipmentId}`;
  }

  const displayId = String(shipment.id || "").trim();
  return displayId ? `display:${displayId}` : "";
};

const isSameShipment = (
  left: ShipmentIdentity | null | undefined,
  right: ShipmentIdentity | null | undefined
) => {
  if (!left || !right) return false;
  if (left.shipmentId && right.shipmentId && left.shipmentId === right.shipmentId) {
    return true;
  }
  if (left.shipmentId && left.shipmentId === right.id) {
    return true;
  }
  if (right.shipmentId && right.shipmentId === left.id) {
    return true;
  }
  return left.id === right.id;
};

const findMatchingShipment = (
  shipments: Shipment[],
  target: ShipmentIdentity | null | undefined
) => shipments.find((shipment) => isSameShipment(shipment, target)) || null;

const scoreShipmentCompleteness = (shipment: Shipment) =>
  (shipment.legsHydrated ? 4 : 0) +
  (shipment.productId ? 2 : 0) +
  (shipment.legs.length > 0 ? 1 : 0) +
  (shipment.totalCO2 > 0 ? 1 : 0);

const pickPreferredShipment = (current: Shipment, candidate: Shipment) =>
  scoreShipmentCompleteness(candidate) > scoreShipmentCompleteness(current) ?
    candidate :
    current;

const dedupeShipments = (shipments: Shipment[]) => {
  const dedupedByIdentity = new Map<string, Shipment>();
  const fallbackShipments: Shipment[] = [];

  shipments.forEach((shipment) => {
    const identityKey = getShipmentIdentityKey(shipment);
    if (!identityKey) {
      fallbackShipments.push(shipment);
      return;
    }

    const current = dedupedByIdentity.get(identityKey);
    dedupedByIdentity.set(
      identityKey,
      current ? pickPreferredShipment(current, shipment) : shipment
    );
  });

  return [...dedupedByIdentity.values(), ...fallbackShipments];
};

const buildContainerNo = (referenceNumber: string, fallbackId: string) => {
  const normalizedReference = referenceNumber.replace(/[^a-zA-Z0-9]/g, "");
  if (normalizedReference) {
    return `WC-${normalizedReference.slice(-10).toUpperCase()}`;
  }
  return `WC-${fallbackId.slice(0, 8).toUpperCase()}`;
};

const hasHydratedShipmentDetail = (
  shipment: LogisticsShipmentSummary | LogisticsShipmentDetail
): shipment is LogisticsShipmentDetail => "legs" in shipment && "products" in shipment;

const toShipmentDetailLike = (
shipment: LogisticsShipmentSummary | LogisticsShipmentDetail)
: LogisticsShipmentDetail => {
  if (hasHydratedShipmentDetail(shipment)) {
    return shipment;
  }
  return {
    ...shipment,
    company_id: "",
    legs: [],
    products: []
  };
};

const mapShipmentToOverview = (
shipment: LogisticsShipmentSummary | LogisticsShipmentDetail,
fallbacks: {shipmentName: string;unknownCarrier: string;})
: Shipment => {
  const detailLike = toShipmentDetailLike(shipment);
  const firstProduct = detailLike.products[0];
  const status = toTrackShipmentStatus(detailLike.status);
  const progress =
  detailLike.status === "cancelled" ? 0 : inferShipmentProgress(detailLike);
  const legs = toTransportLegs(detailLike);
  const originLabel = formatShipmentLocation(detailLike.origin);
  const destinationLabel = formatShipmentLocation(detailLike.destination);
  const currentPoint =
  status === "delivered" ?
  legs[legs.length - 1]?.destination || legs[0]?.destination :
  legs[0]?.origin;

  const fallbackLocation = currentPoint || {
    lat: 10.8231,
    lng: 106.6297,
    name: originLabel
  };

  return {
    shipmentId: detailLike.id,
    id: detailLike.reference_number || detailLike.id,
    productId: firstProduct?.product_id || null,
    productName:
    firstProduct?.product_name ||
    detailLike.reference_number ||
    fallbacks.shipmentName,
    sku: firstProduct?.sku || detailLike.reference_number || detailLike.id,
    status,
    simulationEnabled: detailLike.simulation_enabled,
    progress,
    origin: originLabel,
    destination: destinationLabel,
    estimatedArrival: resolveShipmentEta(detailLike) || detailLike.updated_at,
    createdAt: detailLike.created_at,
    currentLocation: {
      lat: fallbackLocation.lat,
      lng: fallbackLocation.lng,
      name: fallbackLocation.name
    },
    legs,
    legsHydrated: hasHydratedShipmentDetail(shipment),
    totalCO2: detailLike.total_co2e,
    carrier:
    detailLike.legs.find((leg) => leg.carrier_name.trim().length > 0)?.carrier_name ||
    fallbacks.unknownCarrier
  };
};

const PRODUCT_LEG_DISTANCE_EPSILON_KM = 0.5;

const isPositiveNumber = (value: unknown): value is number =>
typeof value === "number" && Number.isFinite(value) && value > 0;

const isNonNegativeNumber = (value: unknown): value is number =>
typeof value === "number" && Number.isFinite(value) && value >= 0;

const toTransportModeFromProduct = (
mode: ProductRecord["transportLegs"][number]["mode"])
: TransportLeg["mode"] => {
  if (mode === "sea") return "ship";
  if (mode === "air") return "air";
  if (mode === "rail") return "rail";
  return "truck_heavy";
};

const toRouteTypeFromProduct = (
mode: ProductRecord["transportLegs"][number]["mode"])
: TransportLeg["routeType"] => {
  if (mode === "sea") return "sea";
  if (mode === "air") return "air";
  if (mode === "rail") return "rail";
  return "road";
};

const legsMatchProductTransport = (
shipmentLegs: TransportLeg[],
productLegs: ProductRecord["transportLegs"]) => {
  if (shipmentLegs.length !== productLegs.length) {
    return false;
  }

  return productLegs.every((productLeg, index) => {
    const shipmentLeg = shipmentLegs[index];
    if (!shipmentLeg) return false;

    const expectedMode = toTransportModeFromProduct(productLeg.mode);
    if (shipmentLeg.mode !== expectedMode) {
      return false;
    }

    if (!isPositiveNumber(productLeg.estimatedDistance)) {
      return true;
    }

    return (
    Math.abs(shipmentLeg.distanceKm - productLeg.estimatedDistance) <=
    PRODUCT_LEG_DISTANCE_EPSILON_KM
    );
  });
};

const overlayShipmentLegsFromProduct = (
shipmentLegs: TransportLeg[],
productLegs: ProductRecord["transportLegs"]) =>
{
  if (!shipmentLegs.length || !productLegs.length) {
    return shipmentLegs;
  }

  return productLegs.map((productLeg, index) => {
    const fallbackLeg = shipmentLegs[Math.min(index, shipmentLegs.length - 1)];

    return {
      ...fallbackLeg,
      legNumber: index + 1,
      mode: toTransportModeFromProduct(productLeg.mode),
      routeType: toRouteTypeFromProduct(productLeg.mode),
      distanceKm:
      isPositiveNumber(productLeg.estimatedDistance) ?
      productLeg.estimatedDistance :
      fallbackLeg.distanceKm,
      emissionFactor:
      isPositiveNumber(productLeg.emissionFactor) ?
      productLeg.emissionFactor :
      fallbackLeg.emissionFactor,
      co2Kg:
      isNonNegativeNumber(productLeg.co2Kg) ?
      productLeg.co2Kg :
      fallbackLeg.co2Kg
    };
  });
};

const reconcileShipmentWithProductTransport = (
shipment: Shipment,
product: ProductRecord | null) => {
  if (!product || !product.transportLegs.length) {
    return shipment;
  }

  if (legsMatchProductTransport(shipment.legs, product.transportLegs)) {
    return shipment;
  }

  const reconciledLegs = overlayShipmentLegsFromProduct(
    shipment.legs,
    product.transportLegs
  );
  if (!reconciledLegs.length) {
    return shipment;
  }

  const currentPoint =
  shipment.status === "delivered" ?
  reconciledLegs[reconciledLegs.length - 1]?.destination || reconciledLegs[0]?.destination :
  reconciledLegs[0]?.origin;

  return {
    ...shipment,
    legs: reconciledLegs,
    currentLocation:
    currentPoint ?
    {
      lat: currentPoint.lat,
      lng: currentPoint.lng,
      name: currentPoint.name
    } :
    shipment.currentLocation
  };
};

const toDetailShipment = (shipment: Shipment): TrackShipment => ({
  id: shipment.id,
  shipmentId: shipment.shipmentId,
  productId: shipment.productId,
  productName: shipment.productName,
  sku: shipment.sku,
  status: shipment.status,
  simulationEnabled: shipment.simulationEnabled,
  progress: shipment.progress,
  origin: shipment.origin,
  destination: shipment.destination,
  estimatedArrival: shipment.estimatedArrival,
  departureDate: shipment.createdAt,
  currentLocation: shipment.currentLocation?.name || shipment.origin,
  legs: shipment.legs,
  totalCO2: shipment.totalCO2,
  carrier: shipment.carrier,
  containerNo: buildContainerNo(shipment.id, shipment.shipmentId || shipment.id)
});

const mergeSummaryIntoDetailShipment = (
  current: TrackShipment,
  shipment: Shipment
): TrackShipment => {
  const summaryDetail = toDetailShipment(shipment);
  return {
    ...current,
    id: summaryDetail.id,
    shipmentId: summaryDetail.shipmentId,
    productId: summaryDetail.productId,
    productName: summaryDetail.productName,
    sku: summaryDetail.sku,
    status: summaryDetail.status,
    simulationEnabled: summaryDetail.simulationEnabled,
    progress: summaryDetail.progress,
    origin: summaryDetail.origin,
    destination: summaryDetail.destination,
    estimatedArrival: summaryDetail.estimatedArrival,
    departureDate: summaryDetail.departureDate,
    currentLocation: summaryDetail.currentLocation || current.currentLocation,
    totalCO2: summaryDetail.totalCO2
  };
};

const STATUS_PALETTE: Record<
  Shipment["status"],
  {
    badge: string;
    statCard: string;
    statValue: string;
    filterActive: string;
    cardAccent: string;
    headerTone: string;
  }> =
{
  in_transit: {
    badge:
    "border border-sky-300 bg-sky-100 text-sky-800",
    statCard: "border-sky-300 bg-sky-100/75",
    statValue: "text-sky-700",
    filterActive: "border-sky-400 bg-sky-100 text-sky-800 hover:bg-sky-200",
    cardAccent: "border-t-sky-400",
    headerTone: "bg-sky-100/60"
  },
  delivered: {
    badge:
    "border border-emerald-300 bg-emerald-100 text-emerald-800",
    statCard: "border-emerald-300 bg-emerald-100/75",
    statValue: "text-emerald-700",
    filterActive:
    "border-emerald-400 bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
    cardAccent: "border-t-emerald-400",
    headerTone: "bg-emerald-100/60"
  },
  pending: {
    badge:
    "border border-amber-300 bg-amber-100 text-amber-800",
    statCard: "border-amber-300 bg-amber-100/75",
    statValue: "text-amber-700",
    filterActive: "border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200",
    cardAccent: "border-t-amber-400",
    headerTone: "bg-amber-100/60"
  },
  cancelled: {
    badge:
    "border border-rose-300 bg-rose-100 text-rose-800",
    statCard: "border-rose-300 bg-rose-100/75",
    statValue: "text-rose-700",
    filterActive: "border-rose-400 bg-rose-100 text-rose-800 hover:bg-rose-200",
    cardAccent: "border-t-rose-400",
    headerTone: "bg-rose-100/60"
  }
};

const ShippingOverviewMap: React.FC = () => {
  const t = useTranslations("logistics");
  const tTrack = useTranslations("trackShipment");
  const { isMobile } = useBreakpoint();
  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailShipment, setDetailShipment] = useState<TrackShipment | null>(null);
  const [detailLoadingShipment, setDetailLoadingShipment] = useState<Shipment | null>(null);
  const [qrShipment, setQrShipment] = useState<Shipment | null>(null);
  const detailRequestSeqRef = useRef(0);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "in_transit" | "pending" | "delivered" | "cancelled">(
    "all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const mapHeight = isMobile ? "min(62dvh, 420px)" : "520px";
  const filterToggleLabel = "Bộ lọc";
  const shipmentFallbacks = useMemo(
    () => ({
      shipmentName: t("fallbacks.shipment"),
      unknownCarrier: t("fallbacks.unknownCarrier")
    }),
    [t]
  );

  const closeDetailDialog = useCallback(() => {
    detailRequestSeqRef.current += 1;
    setDetailShipment(null);
    setDetailLoadingShipment(null);
  }, []);

  const syncShipmentState = useCallback((shipment: Shipment) => {
    setAllShipments((current) => {
      let didUpdate = false;
      const next = current.map((candidate) => {
        if (!isSameShipment(candidate, shipment)) {
          return candidate;
        }
        didUpdate = true;
        return shipment;
      });
      return didUpdate ? dedupeShipments(next) : current;
    });
    setDetailShipment((current) =>
      current && isSameShipment(current, shipment) ? toDetailShipment(shipment) : current
    );
    setQrShipment((current) =>
      current && isSameShipment(current, shipment) ? shipment : current
    );
  }, []);

  const loadShipmentDetail = useCallback(
    async (shipmentId: string, requestSeq?: number): Promise<Shipment | null> => {
      const isStale = () =>
        typeof requestSeq === "number" && requestSeq !== detailRequestSeqRef.current;

      const detail = await fetchLogisticsShipmentById(shipmentId);
      if (isStale()) {
        return null;
      }

      let mappedShipment = mapShipmentToOverview(detail, shipmentFallbacks);

      if (mappedShipment.productId && isValidUuid(mappedShipment.productId)) {
        try {
          const product = await fetchProductById(mappedShipment.productId);
          if (isStale()) {
            return null;
          }
          mappedShipment = reconcileShipmentWithProductTransport(
            mappedShipment,
            product
          );
        } catch {

        }
      }

      return mappedShipment;
    },
    [shipmentFallbacks]
  );

  const refreshDetailShipment = useCallback(async () => {
    if (!detailShipment?.shipmentId || !isValidUuid(detailShipment.shipmentId)) {
      return;
    }

    const requestSeq = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestSeq;

    try {
      const refreshedShipment = await loadShipmentDetail(detailShipment.shipmentId, requestSeq);
      if (!refreshedShipment) {
        return;
      }
      syncShipmentState(refreshedShipment);
    } catch {

    }
  }, [detailShipment, loadShipmentDetail, syncShipmentState]);

  const openDetails = async (shipment: Shipment) => {
    const requestSeq = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestSeq;
    setDetailLoadingShipment(shipment);

    if (shipment.legsHydrated) {
      setDetailShipment(toDetailShipment(shipment));
    } else {
      setDetailShipment(null);
    }

    if (!isValidUuid(shipment.shipmentId)) {
      setDetailShipment(toDetailShipment(shipment));
      setDetailLoadingShipment(null);
      return;
    }

    try {
      const detailedShipment = await loadShipmentDetail(shipment.shipmentId, requestSeq);
      if (!detailedShipment) {
        return;
      }
      syncShipmentState(detailedShipment);
      setDetailShipment(toDetailShipment(detailedShipment));
    } catch {
      setDetailShipment((current) => current);
    } finally {
      if (requestSeq === detailRequestSeqRef.current) {
        setDetailLoadingShipment(null);
      }
    }
  };

  const openQr = async (shipment: Shipment) => {
    if (shipment.productId && isValidUuid(shipment.productId)) {
      setQrShipment(shipment);
      return;
    }

    if (!isValidUuid(shipment.shipmentId)) {
      return;
    }

    try {
      const resolved = await loadShipmentDetail(shipment.shipmentId);
      if (!resolved) {
        return;
      }

      if (resolved.productId && isValidUuid(resolved.productId)) {
        syncShipmentState(resolved);
        setQrShipment(resolved);
      }
    } catch {

    }
  };


  const loadUserShipments = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      const shipmentSummaries = await fetchAllLogisticsShipments();
      const userShipments = dedupeShipments(shipmentSummaries.map((shipment) =>
      mapShipmentToOverview(shipment, shipmentFallbacks)
      ));
      setAllShipments(userShipments);
      setDetailShipment((current) => {
        if (!current) return null;
        const matchedShipment = findMatchingShipment(userShipments, current);
        if (!matchedShipment) {
          return null;
        }
        return matchedShipment.legsHydrated ?
          toDetailShipment(matchedShipment) :
          mergeSummaryIntoDetailShipment(current, matchedShipment);
      });
      setQrShipment((current) => {
        if (!current) return null;
        return findMatchingShipment(userShipments, current);
      });
    } catch {
      setAllShipments([]);
      setQrShipment(null);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  }, [shipmentFallbacks]);

  useEffect(() => {
    void loadUserShipments(true);
  }, [loadUserShipments]);

  useEffect(() => {
    const handleProductUsageUpdated = () => {
      void loadUserShipments(false);
    };

    window.addEventListener(PRODUCT_USAGE_UPDATED_EVENT, handleProductUsageUpdated);
    window.addEventListener("focus", handleProductUsageUpdated);

    return () => {
      window.removeEventListener(PRODUCT_USAGE_UPDATED_EVENT, handleProductUsageUpdated);
      window.removeEventListener("focus", handleProductUsageUpdated);
    };
  }, [loadUserShipments]);

  useEffect(() => {
    if (!isMobile) {
      setShowMobileFilters(false);
    }
  }, [isMobile]);

  const getStatusBadge = (status: Shipment["status"]) => {
    const palette = STATUS_PALETTE[status];
    switch (status) {
      case "delivered":
        return (
          <Badge className={palette.badge}>
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t("statuses.delivered")}
          </Badge>);

      case "in_transit":
        return (
          <Badge className={palette.badge}>
            <Ship className="w-3 h-3 mr-1" />
            {t("statuses.inTransit")}
          </Badge>);

      case "pending":
        return (
          <Badge className={palette.badge}>
            <Clock className="w-3 h-3 mr-1" />
            {t("statuses.pending")}
          </Badge>);

      case "cancelled":
        return (
          <Badge className={palette.badge}>
            <XCircle className="w-3 h-3 mr-1" />
            {t("statuses.cancelled")}
          </Badge>);

      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };


  const stats = useMemo(
    () => ({
      total: allShipments.length,
      inTransit: allShipments.filter((s) => s.status === "in_transit").length,
      delivered: allShipments.filter((s) => s.status === "delivered").length,
      pending: allShipments.filter((s) => s.status === "pending").length,
      cancelled: allShipments.filter((s) => s.status === "cancelled").length,
      totalCO2: allShipments.reduce((sum, s) => sum + s.totalCO2, 0)
    }),
    [allShipments]
  );

  const filteredShipments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return allShipments.filter((shipment) => {
      if (statusFilter !== "all" && shipment.status !== statusFilter) {
        return false;
      }
      if (!query) return true;
      return [
      shipment.productName,
      shipment.sku,
      shipment.id,
      shipment.origin,
      shipment.destination,
      shipment.productId,
      shipment.carrier].

      filter((value): value is string => typeof value === "string" && value.length > 0).
      some((value) => value.toLowerCase().includes(query));
    });
  }, [allShipments, searchTerm, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredShipments.length / ITEMS_PER_PAGE)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedShipments = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredShipments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredShipments, safeCurrentPage]);


  const allNodes = useMemo((): SupplyChainNode[] => {
    const nodes: SupplyChainNode[] = [];
    const addedLocations = new Set<string>();

    paginatedShipments.forEach((shipment) => {
      const shipmentNodeKey = getShipmentIdentityKey(shipment) || shipment.id;
      shipment.legs.forEach((leg, legIndex) => {
        const originKey = `${leg.origin.lat.toFixed(2)}-${leg.origin.lng.toFixed(2)}`;
        if (!addedLocations.has(originKey)) {
          addedLocations.add(originKey);
            nodes.push({
            id: `${shipmentNodeKey}-${leg.id}-origin`,
            name: leg.origin.name,
            lat: leg.origin.lat,
            lng: leg.origin.lng,
            type:
            leg.origin.type === "port" ?
            "port" :
            leg.origin.type === "airport" ?
            "airport" :
            "factory",
            country: t("shipmentContext.defaults.vietnam"),
            co2: shipment.totalCO2,
            status:
            shipment.status === "delivered" ?
            "completed" :
            shipment.status === "pending" || shipment.status === "cancelled" ?
            "pending" :
            "active"
          });
        }

        if (legIndex === shipment.legs.length - 1) {
          const destKey = `${leg.destination.lat.toFixed(2)}-${leg.destination.lng.toFixed(2)}`;
          if (!addedLocations.has(destKey)) {
            addedLocations.add(destKey);
            nodes.push({
              id: `${shipmentNodeKey}-${leg.id}-dest`,
              name: leg.destination.name,
              lat: leg.destination.lat,
              lng: leg.destination.lng,
              type: "destination",
              country: shipment.destination.split(", ").pop() || t("fallbacks.international"),
              status:
              shipment.status === "delivered" ?
              "completed" :
              "pending"
            });
          }
        }
      });
    });

    return nodes;
  }, [paginatedShipments, t]);

  const allRoutes = useMemo(
    (): SupplyChainRoute[] =>
    paginatedShipments.flatMap((shipment, shipmentIndex) =>
    shipment.legs.map((leg) => ({
      id: `${getShipmentIdentityKey(shipment) || shipment.id}-${leg.id}`,
      from: {
        lat: leg.origin.lat,
        lng: leg.origin.lng,
        name: leg.origin.name
      },
      to: {
        lat: leg.destination.lat,
        lng: leg.destination.lng,
        name: leg.destination.name
      },
      mode:
      leg.mode === "ship" ?
      "ship" as const :
      leg.mode === "air" ?
      "air" as const :
      leg.mode === "rail" ?
      "rail" as const :
      "truck" as const,
      status:
      shipment.status === "delivered" ?
      "completed" as const :
      shipment.status === "pending" || shipment.status === "cancelled" ?
      "pending" as const :
      "in_transit" as const,
      co2Kg: leg.co2Kg,
      distanceKm: leg.distanceKm,
      geometry: leg.geometry,
      color: SHIPMENT_COLORS[shipmentIndex % SHIPMENT_COLORS.length],
    }))
    ),
    [paginatedShipments]
  );

  const { geometryById: resolvedOverviewRoadGeometryById } = useResolvedRoadRouteGeometry(
    allRoutes,
    {
      getDestination: (route) => ({
        lat: route.to.lat,
        lng: route.to.lng
      }),
      getExistingGeometry: (route) =>
        route.mode !== "truck" || (route.geometry?.length || 0) > 2 ? route.geometry : null,
      getId: (route) => route.id,
      getOrigin: (route) => ({
        lat: route.from.lat,
        lng: route.from.lng
      }),
      isRoadRoute: (route) => route.mode === "truck"
    }
  );

  const renderableRoutes = useMemo(
    () =>
      allRoutes.map((route) => ({
        ...route,
        geometry: resolvedOverviewRoadGeometryById[route.id] || route.geometry
      })),
    [allRoutes, resolvedOverviewRoadGeometryById]
  );

  const filterButtonClass = (
  filter: "all" | "in_transit" | "pending" | "delivered" | "cancelled") =>
  {
    const base =
    "h-9 shrink-0 border px-3 text-sm font-medium leading-none transition-colors";
    if (statusFilter !== filter) {
      return `${base} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;
    }
    if (filter === "all") {
      return `${base} border-slate-400 bg-slate-200 text-slate-900 hover:bg-slate-300`;
    }
    return `${base} ${STATUS_PALETTE[filter].filterActive}`;
  };

  const shipmentCardClass = (status: Shipment["status"]) =>
  `group cursor-pointer overflow-hidden border border-slate-300 bg-white shadow transition-all hover:border-slate-400 hover:shadow-lg border-t-2 ${STATUS_PALETTE[status].cardAccent}`;

  const shipmentHeaderClass = (status: Shipment["status"]) =>
    `border-b border-slate-300/90 pt-2 pb-2 ${STATUS_PALETTE[status].headerTone}`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) =>
          <div
            key={`shipment-loading-${index}`}
            className="h-16 rounded-lg border border-slate-200 bg-slate-100/70 animate-pulse" />

          )}
        </div>
        <div className="h-72 rounded-lg border border-slate-200 bg-slate-100/70 animate-pulse" />
      </div>);

  }


  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border border-slate-300 bg-white shadow">
          <CardContent className="px-2 py-2.5 text-center sm:py-3">
            <p className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{stats.total}</p>
            <p className="text-[11px] leading-4 text-slate-600">{t("statuses.totalShipments")}</p>
          </CardContent>
        </Card>
        <Card className={`border shadow ${STATUS_PALETTE.in_transit.statCard}`}>
          <CardContent className="px-2 py-2.5 text-center sm:py-3">
            <p className={`text-xl font-bold leading-tight sm:text-2xl ${STATUS_PALETTE.in_transit.statValue}`}>
              {stats.inTransit}
            </p>
            <p className="text-[11px] leading-4 text-slate-600">{t("statuses.inTransit")}</p>
          </CardContent>
        </Card>
        <Card className={`border shadow ${STATUS_PALETTE.delivered.statCard}`}>
          <CardContent className="px-2 py-2.5 text-center sm:py-3">
            <p className={`text-xl font-bold leading-tight sm:text-2xl ${STATUS_PALETTE.delivered.statValue}`}>
              {stats.delivered}
            </p>
            <p className="text-[11px] leading-4 text-slate-600">{t("statuses.delivered")}</p>
          </CardContent>
        </Card>
        <Card className={`border shadow ${STATUS_PALETTE.pending.statCard}`}>
          <CardContent className="px-2 py-2.5 text-center sm:py-3">
            <p className={`text-xl font-bold leading-tight sm:text-2xl ${STATUS_PALETTE.pending.statValue}`}>
              {stats.pending}
            </p>
            <p className="text-[11px] leading-4 text-slate-600">{t("statuses.pending")}</p>
          </CardContent>
        </Card>
        <Card className={`border shadow ${STATUS_PALETTE.cancelled.statCard}`}>
          <CardContent className="px-2 py-2.5 text-center sm:py-3">
            <p className={`text-xl font-bold leading-tight sm:text-2xl ${STATUS_PALETTE.cancelled.statValue}`}>
              {stats.cancelled}
            </p>
            <p className="text-[11px] leading-4 text-slate-600">{t("statuses.cancelled")}</p>
          </CardContent>
        </Card>
        <Card className="border border-orange-300 bg-orange-100/70 shadow">
          <CardContent className="px-2 py-2.5 text-center sm:py-3">
            <p className="text-xl font-bold leading-tight text-orange-700 sm:text-2xl">
              {stats.totalCO2.toFixed(0)}
            </p>
            <p className="text-[11px] leading-4 text-slate-600">{t("statuses.totalCO2")}</p>
          </CardContent>
        </Card>
      </div>

      
      <div className="space-y-3">
        <div className="space-y-2 sm:flex sm:items-center sm:gap-2 sm:space-y-0">
          <div className={cn("flex items-center gap-2", !isMobile && "min-w-0 flex-1")}>
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              placeholder={tTrack("searchPlaceholder")}
              className="h-10 min-w-0 flex-1 border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 shadow-sm focus-visible:ring-primary/30" />

            {isMobile &&
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 shrink-0 gap-2 border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
              onClick={() => setShowMobileFilters((prev) => !prev)}>
                <SlidersHorizontal className="h-4 w-4" />
                <span>{filterToggleLabel}</span>
              </Button>
            }
          </div>

          <div
            className={cn(
              "flex shrink-0 gap-2 whitespace-nowrap",
              isMobile ? "w-full items-stretch overflow-x-auto pb-1" : "ml-auto items-center",
              isMobile && !showMobileFilters && "hidden"
            )}>
            <Button
              size="sm"
              variant="outline"
              className={filterButtonClass("all")}
              onClick={() => {
                setStatusFilter("all");
                setCurrentPage(1);
              }}>

              {tTrack("filterAll")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={filterButtonClass("in_transit")}
              onClick={() => {
                setStatusFilter("in_transit");
                setCurrentPage(1);
              }}>

              {tTrack("filterInTransit")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={filterButtonClass("pending")}
              onClick={() => {
                setStatusFilter("pending");
                setCurrentPage(1);
              }}>

              {tTrack("filterPending")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={filterButtonClass("delivered")}
              onClick={() => {
                setStatusFilter("delivered");
                setCurrentPage(1);
              }}>

              {tTrack("filterDelivered")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={filterButtonClass("cancelled")}
              onClick={() => {
                setStatusFilter("cancelled");
                setCurrentPage(1);
              }}>

              {tTrack("filterCancelled")}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {paginatedShipments.map((shipment) =>
          <Card
            key={getShipmentIdentityKey(shipment) || shipment.id}
            className={shipmentCardClass(shipment.status)}
            onClick={() => {
              void openDetails(shipment);
            }}>

              <CardHeader className={shipmentHeaderClass(shipment.status)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {shipment.productName}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {shipment.sku}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(shipment.status)}
                    <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openQr(shipment);
                    }}
                    title={t("qrCodeTitle")}>
                    
                      <QrCode className="w-4 h-4 text-green-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                
                <div className="mt-1 overflow-hidden rounded-md border border-slate-300">
                  <LazyMountOnView
                  className="h-[120px]"
                  rootMargin="280px 0px"
                  placeholder={
                  <div className="h-[120px] w-full animate-pulse bg-slate-100">
                        <div className="flex h-full items-end justify-center p-2">
                          <p className="w-full truncate rounded bg-white/70 px-2 py-1 text-center text-xs text-slate-500">
                            {shipment.currentLocation.name}
                          </p>
                        </div>
                      </div>
                  }>
                    <ShipmentMiniMap
                    currentLocation={shipment.currentLocation}
                    height="120px"
                    status={shipment.status} />
                  </LazyMountOnView>

                </div>

                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5">
                    <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                    <span
                    className="truncate"
                    title={`${shipment.origin} -> ${shipment.destination}`}>

                      <span className="text-emerald-700">{shipment.origin}</span>
                      <span className="text-slate-500">{" -> "}</span>
                      <span className="text-rose-700">{shipment.destination}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-300 pt-2">
                    <span className="text-xs font-medium text-slate-700">
                      {shipment.totalCO2.toFixed(1)} {tTrack("units.kgCo2e")}
                    </span>
                    <span className="text-xs text-slate-500">
                      {shipment.carrier}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {paginatedShipments.length === 0 &&
          <Card className="border border-slate-300 bg-slate-50/60 shadow sm:col-span-2 xl:col-span-4">
              <CardContent className="py-6 text-center">
                <p className="text-sm font-medium text-slate-800">
                  {allShipments.length === 0 ?
                t("empty.noShipments") :
                t("empty.noFilteredShipments")}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {allShipments.length === 0 ?
                t("empty.createAndPublishHint") :
                t("empty.changeFilterHint")}
                </p>
              </CardContent>
            </Card>
          }
        </div>
        {filteredShipments.length > 0 && totalPages > 1 &&
        <div className="flex items-center justify-center gap-2">
              <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={safeCurrentPage === 1}>

                {t("pagination.prev")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("pagination.page", {
              current: safeCurrentPage,
              total: totalPages
            })}
              </span>
              <Button
            variant="outline"
            size="sm"
            onClick={() =>
            setCurrentPage((prev) =>
            Math.min(totalPages, Math.max(1, prev) + 1)
            )
            }
            disabled={safeCurrentPage === totalPages}>

                {t("pagination.next")}
              </Button>
          </div>
        }
      </div>

      
      {!isMobile && (
        <Card className="overflow-hidden border border-slate-300 shadow">
          <CardHeader className="border-b border-slate-300 bg-slate-100/70 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-primary" />
              {t("mapTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <LazyMountOnView
              className="w-full"
              rootMargin="320px 0px"
              placeholder={
                <div
                  className="w-full animate-pulse rounded-md border border-slate-300 bg-slate-100"
                  style={{ height: mapHeight }}
                />
              }
            >
              <SupplyChainMap
                nodes={allNodes}
                routes={renderableRoutes}
                center={[20, 80]}
                zoom={2}
                height={mapHeight}
              />
            </LazyMountOnView>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!detailShipment || !!detailLoadingShipment}
        onOpenChange={(open) => {
          if (!open) {
            closeDetailDialog();
          }
        }}>

        {(detailShipment || detailLoadingShipment) &&
        <DialogContent
          hideCloseButton
          className="h-dvh w-screen max-w-[100vw] overflow-hidden rounded-none p-0 md:h-[min(92dvh,56rem)] md:w-[min(96vw,68rem)] md:max-w-none md:rounded-xl"
        >
            <DialogHeader className="sr-only">
              <DialogTitle>
                {t("routeDetails")}: {(detailShipment || detailLoadingShipment)?.productName}
              </DialogTitle>
            </DialogHeader>
            <DialogClose className="absolute right-2 top-2 z-30 rounded-sm bg-background/95 p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:right-3 md:top-3">
              <X className="h-5 w-5 md:h-4 md:w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <div className="h-full overflow-y-auto overflow-x-hidden p-0 md:p-4">
              {detailShipment ?
                <ShipmentDetails
                  shipment={detailShipment}
                  onRefresh={() => {
                    void refreshDetailShipment();
                  }} /> :
                <div className="flex h-full min-h-[320px] items-center justify-center p-6">
                  <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="animate-pulse space-y-4">
                      <div className="h-6 w-2/3 rounded bg-slate-200" />
                      <div className="h-56 rounded-lg bg-slate-100" />
                      <div className="grid grid-cols-3 gap-3">
                        <div className="h-20 rounded-lg bg-slate-100" />
                        <div className="h-20 rounded-lg bg-slate-100" />
                        <div className="h-20 rounded-lg bg-slate-100" />
                      </div>
                    </div>
                  </div>
                </div>}
            </div>
          </DialogContent>
        }
      </Dialog>

      
      {qrShipment?.productId &&
      <ProductQRCode
        productId={qrShipment.productId!}
        shipmentId={qrShipment.shipmentId}
        productName={qrShipment.productName}
        sku={qrShipment.sku}
        isOpen={!!qrShipment}
        onClose={() => setQrShipment(null)} />

      }
    </div>);

};

export default ShippingOverviewMap;
