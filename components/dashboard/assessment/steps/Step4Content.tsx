"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  MapPin,
  Loader2,
  Plane,
  Ship,
  Truck,
  Train,
  ArrowRight
} from "lucide-react";
import {
  ProductAssessmentData,
  AddressInput,
  MarketComplianceDocumentSummary,
  TransportLeg,
  DESTINATION_MARKETS,
  TRANSPORT_MODES
} from "./types";
import {
  DESTINATION_HUBS_BY_MARKET,
  VIETNAM_TRANSFER_HUBS,
  getRouteHubById,
  type RouteHub,
  type RouteHubKind
} from "./routeHubs";
import {
  buildDomesticFallbackRoute,
  resolveDomesticSuggestedRoute,
  type SuggestedRoute
} from "./domesticRouteSuggestion";
import {
  buildExportFallbackRoute,
  resolveExportSuggestedRoute
} from "./exportRouteOptimizer";
import dynamic from "next/dynamic";
import {
  fetchRoadRoute,
  type RoadRoutePointSource,
  type RoutePoint
} from "@/lib/roadRouting";

interface LocationPickerProps {
  address: AddressInput;
  onChange: (
    address: AddressInput,
    meta?: {
      source: RoadRoutePointSource;
    }
  ) => void;
  label: string;
  defaultCenter?: [number, number];
  showCurrentLocationButton?: boolean;
}

type AddressRole = "origin" | "destination";

type RoadLegEndpointRole = "destination_address" | "hub" | "origin_address";

type ResolvedRoadLegEndpoints = {
  destination: RoutePoint;
  destinationRole: RoadLegEndpointRole;
  destinationSource?: RoadRoutePointSource;
  origin: RoutePoint;
  originRole: RoadLegEndpointRole;
  originSource?: RoadRoutePointSource;
};

const TransportIcon: React.FC<{ mode: string; className?: string }> = ({
  mode,
  className = "w-4 h-4"
}) => {
  switch (mode) {
    case "road":
      return <Truck className={className} />;
    case "sea":
      return <Ship className={className} />;
    case "air":
      return <Plane className={className} />;
    case "rail":
      return <Train className={className} />;
    default:
      return <Truck className={className} />;
  }
};

const ORIGIN_DEFAULT_CENTER: [number, number] = [106.6297, 10.8231];

const getDestinationDefaultCenter = (market: string): [number, number] => {
  switch (market) {
    case "usa":
      return [-118.2437, 34.0522];
    case "korea":
      return [126.978, 37.5665];
    case "japan":
      return [139.6503, 35.6762];
    case "eu":
      return [4.4777, 51.9244];
    case "china":
      return [121.4737, 31.2304];
    case "vietnam":
    default:
      return [106.6297, 10.8231];
  }
};

const getExpectedCountryForMarket = (market: string): string => {
  switch (market) {
    case "usa":
      return "United States";
    case "korea":
      return "South Korea";
    case "japan":
      return "Japan";
    case "eu":
      return "Germany";
    case "china":
      return "China";
    case "vietnam":
    default:
      return "Vietnam";
  }
};

const normalizeCountryToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateGreatCircleDistanceKm = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const isFiniteNumber = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const hasPositiveDistance = (value: number | undefined): value is number =>
  isFiniteNumber(value) && value > 0;

const roundDistanceKm = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 10) / 10;

const ROAD_DISTANCE_UPDATE_EPSILON_KM = 0.5;
const ROAD_SNAP_UPDATE_EPSILON = 0.00001;
const ROAD_DISTANCE_SYNC_DEBOUNCE_MS = 250;
const ROUTE_SUGGESTION_DEBOUNCE_MS = 350;

const normalizeMarketToken = (value: string | null | undefined) =>
  (value || "").
    toLowerCase().
    normalize("NFD").
    replace(/[\u0300-\u036f]/g, "").
    replace(/[^a-z0-9]+/g, "");

const DESTINATION_MARKET_TO_COMPLIANCE_CODE: Record<string, string> = {
  vietnam: "VN",
  usa: "US",
  korea: "KR",
  japan: "JP",
  eu: "EU",
  china: "CN"
};

const resolveComplianceMarketCode = (destinationMarket: string | null | undefined) => {
  const token = normalizeMarketToken(destinationMarket);
  return DESTINATION_MARKET_TO_COMPLIANCE_CODE[token] || null;
};

const getHubKindByMode = (mode: TransportLeg["mode"]): RouteHubKind =>
  mode === "air" ? "airport" : mode === "rail" ? "rail_terminal" : "port";

const isNonRoadMode = (mode: TransportLeg["mode"]) => mode !== "road";

const findNearestHub = (
  originLat: number,
  originLng: number,
  hubs: RouteHub[]
): { hub: RouteHub; distanceKm: number } | null => {
  if (!hubs.length) return null;

  let nearestHub = hubs[0];
  let nearestDistance = calculateGreatCircleDistanceKm(
    originLat,
    originLng,
    nearestHub.lat,
    nearestHub.lng
  );

  for (let index = 1; index < hubs.length; index += 1) {
    const candidate = hubs[index];
    const candidateDistance = calculateGreatCircleDistanceKm(
      originLat,
      originLng,
      candidate.lat,
      candidate.lng
    );
    if (candidateDistance < nearestDistance) {
      nearestHub = candidate;
      nearestDistance = candidateDistance;
    }
  }

  return {
    hub: nearestHub,
    distanceKm: nearestDistance
  };
};

const isAutoFeederLeg = (legId: string) => legId.startsWith("auto-feeder-");
const SUGGESTED_TRANSPORT_LEG_ID_PREFIX = "suggested-leg-";
const isSuggestedTransportLeg = (legId: string) =>
  legId.startsWith(SUGGESTED_TRANSPORT_LEG_ID_PREFIX);
const isAutoSuggestedTransportLeg = (leg: TransportLeg) =>
  leg.autoSuggested === true || isSuggestedTransportLeg(leg.id);

const cloneTransportLegNodeRef = (
  nodeRef: TransportLeg["fromNode"] | TransportLeg["toNode"] | undefined
) => (nodeRef ? { ...nodeRef } : undefined);

const pickRouteRelevantAddress = (address: AddressInput): AddressInput => {
  const hasCoordinates = isFiniteNumber(address.lat) && isFiniteNumber(address.lng);

  return {
    streetNumber: "",
    street: "",
    ward: "",
    district: "",
    city: hasCoordinates ? "" : address.city,
    stateRegion: hasCoordinates ? "" : address.stateRegion,
    country: "",
    postalCode: "",
    lat: address.lat,
    lng: address.lng
  };
};

const formatRouteCoordinateToken = (value: number | undefined) =>
  isFiniteNumber(value) ? value.toFixed(5) : "";

const buildRouteSuggestionSignature = (context: {
  destinationMarket: string;
  destination: AddressInput;
  origin: AddressInput;
}) =>
  [
    context.destinationMarket || "",
    context.origin.city || "",
    context.origin.stateRegion || "",
    formatRouteCoordinateToken(context.origin.lat),
    formatRouteCoordinateToken(context.origin.lng),
    context.destination.city || "",
    context.destination.stateRegion || "",
    formatRouteCoordinateToken(context.destination.lat),
    formatRouteCoordinateToken(context.destination.lng)
  ].join("|");

const serializeTransportLegNodeRef = (
  nodeRef: TransportLeg["fromNode"] | TransportLeg["toNode"] | undefined
) => (nodeRef ? `${nodeRef.type}:${nodeRef.hubId || ""}` : "none");

const buildRoadResolutionSignature = (
  destinationMarket: string,
  legs: TransportLeg[],
  originAddress: AddressInput,
  destinationAddress: AddressInput
) =>
  [
    destinationMarket || "",
    formatRouteCoordinateToken(originAddress.lat),
    formatRouteCoordinateToken(originAddress.lng),
    formatRouteCoordinateToken(destinationAddress.lat),
    formatRouteCoordinateToken(destinationAddress.lng),
    ...legs.map((leg) =>
      [
        leg.id,
        leg.mode,
        serializeTransportLegNodeRef(leg.fromNode),
        serializeTransportLegNodeRef(leg.toNode)
      ].join(":")
    )
  ].join("|");

const areTransportLegNodeRefsEqual = (
  left: TransportLeg["fromNode"] | TransportLeg["toNode"] | undefined,
  right: TransportLeg["fromNode"] | TransportLeg["toNode"] | undefined
) =>
  (left?.type || null) === (right?.type || null) &&
  (left?.hubId || null) === (right?.hubId || null);

const mapHubKindToRoadPointSource = (
  kind: RouteHubKind
): RoadRoutePointSource => {
  switch (kind) {
    case "airport":
      return "hub_airport";
    case "port":
      return "hub_port";
    case "rail_terminal":
      return "hub_rail_terminal";
    default:
      return "manual";
  }
};

const shouldPersistSnappedAddressForSource = (
  source: RoadRoutePointSource | undefined
) =>
  source === "current_location" ||
  source === "search" ||
  source === "map_click" ||
  source === "manual";

const LocationPickerLoading = () => {
  const t = useTranslations("assessment.step4");

  return (
    <Card>
      <CardContent className="p-4 h-87.5 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4 animate-pulse" />
          <span>{t("loadingMap")}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const LocationPicker = dynamic<LocationPickerProps>(
  () => import("./LocationPicker"),
  {
    ssr: false,
    loading: () => <LocationPickerLoading />
  }
);

interface Step4LogisticsProps {
  data: ProductAssessmentData;
  onChange: (updates: Partial<ProductAssessmentData>) => void;
  companyDomesticMarket?: string | null;
  starterDomesticMarket?: string | null;
  isTrialPlan?: boolean;
  isComplianceDocumentsLoading?: boolean;
  complianceDocumentsByMarketCode?: Record<string, MarketComplianceDocumentSummary>;
}

const Step4Logistics: React.FC<Step4LogisticsProps> = ({
  data,
  onChange,
  companyDomesticMarket,
  starterDomesticMarket,
  isTrialPlan = false,
  isComplianceDocumentsLoading = false,
  complianceDocumentsByMarketCode = {}
}) => {
  const t = useTranslations("assessment.step4");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const destinationMarketToken = normalizeMarketToken(data.destinationMarket);
  const configuredDomesticMarketToken = normalizeMarketToken(companyDomesticMarket);
  const isDomesticRoute =
    destinationMarketToken === "vietnam" ||
    destinationMarketToken === "domestic" ||
    destinationMarketToken === "vn" ||
    (Boolean(configuredDomesticMarketToken) &&
      destinationMarketToken === configuredDomesticMarketToken);
  const availableDestinationMarkets = React.useMemo(
    () =>
    starterDomesticMarket ?
    DESTINATION_MARKETS.filter((market) => market.value === starterDomesticMarket) :
    DESTINATION_MARKETS,
    [starterDomesticMarket]
  );
  const selectedDestinationMarketLabel = React.useMemo(() => {
    const selectedMarket = availableDestinationMarkets.find(
      (market) => market.value === data.destinationMarket
    );
    if (!selectedMarket) return data.destinationMarket || "";
    return t.has(`markets.${selectedMarket.value}`) ?
    t(`markets.${selectedMarket.value}`) :
    selectedMarket.label;
  }, [availableDestinationMarkets, data.destinationMarket, t]);
  const selectedComplianceMarketCode = React.useMemo(
    () => resolveComplianceMarketCode(data.destinationMarket),
    [data.destinationMarket]
  );
  const selectedComplianceSummary = React.useMemo(() => {
    if (!selectedComplianceMarketCode) return null;
    return complianceDocumentsByMarketCode[selectedComplianceMarketCode] || null;
  }, [complianceDocumentsByMarketCode, selectedComplianceMarketCode]);

  const addressSourceRef = React.useRef<Record<AddressRole, RoadRoutePointSource>>({
    destination: "manual",
    origin: "manual"
  });
  const addressValueRef = React.useRef<{
    destination: AddressInput;
    origin: AddressInput;
  }>({
    destination: data.destinationAddress,
    origin: data.originAddress
  });
  const transportLegsRef = React.useRef(data.transportLegs);
  addressValueRef.current = {
    destination: data.destinationAddress,
    origin: data.originAddress
  };
  transportLegsRef.current = data.transportLegs;

  const updateOriginAddress = React.useCallback(
    (
      address: AddressInput,
      meta?: {
        source: RoadRoutePointSource;
      }
    ) => {
      addressSourceRef.current.origin = meta?.source || addressSourceRef.current.origin;
      addressValueRef.current.origin = address;
      onChange({ originAddress: address });
    },
    [onChange]
  );

  const updateDestinationAddress = React.useCallback(
    (
      address: AddressInput,
      meta?: {
        source: RoadRoutePointSource;
      }
    ) => {
      addressSourceRef.current.destination = meta?.source || addressSourceRef.current.destination;
      addressValueRef.current.destination = address;
      onChange({ destinationAddress: address });
    },
    [onChange]
  );

  const maybeBuildSnappedAddressUpdates = React.useCallback(
    (nextPoints: { destination?: RoutePoint; origin?: RoutePoint }) => {
      const updates: Partial<ProductAssessmentData> = {};
      const currentOriginAddress = addressValueRef.current.origin;
      const currentDestinationAddress = addressValueRef.current.destination;

      if (
        nextPoints.origin &&
        shouldPersistSnappedAddressForSource(addressSourceRef.current.origin) &&
        (!isFiniteNumber(currentOriginAddress.lat) ||
          !isFiniteNumber(currentOriginAddress.lng) ||
          Math.abs(currentOriginAddress.lat - nextPoints.origin.lat) >=
            ROAD_SNAP_UPDATE_EPSILON ||
          Math.abs(currentOriginAddress.lng - nextPoints.origin.lng) >=
            ROAD_SNAP_UPDATE_EPSILON)
      ) {
        updates.originAddress = {
          ...currentOriginAddress,
          lat: nextPoints.origin.lat,
          lng: nextPoints.origin.lng
        };
      }

      if (
        nextPoints.destination &&
        shouldPersistSnappedAddressForSource(addressSourceRef.current.destination) &&
        (!isFiniteNumber(currentDestinationAddress.lat) ||
          !isFiniteNumber(currentDestinationAddress.lng) ||
          Math.abs(currentDestinationAddress.lat - nextPoints.destination.lat) >=
            ROAD_SNAP_UPDATE_EPSILON ||
          Math.abs(currentDestinationAddress.lng - nextPoints.destination.lng) >=
            ROAD_SNAP_UPDATE_EPSILON)
      ) {
        updates.destinationAddress = {
          ...currentDestinationAddress,
          lat: nextPoints.destination.lat,
          lng: nextPoints.destination.lng
        };
      }

      return Object.keys(updates).length > 0 ? updates : null;
    },
    []
  );

  const originRouteCity = data.originAddress.city;
  const originRouteStateRegion = data.originAddress.stateRegion;
  const originRouteLat = data.originAddress.lat;
  const originRouteLng = data.originAddress.lng;
  const destinationRouteCity = data.destinationAddress.city;
  const destinationRouteStateRegion = data.destinationAddress.stateRegion;
  const destinationRouteLat = data.destinationAddress.lat;
  const destinationRouteLng = data.destinationAddress.lng;

  const routeRelevantOriginAddress = React.useMemo(
    () =>
      pickRouteRelevantAddress({
        streetNumber: "",
        street: "",
        ward: "",
        district: "",
        city: originRouteCity,
        stateRegion: originRouteStateRegion,
        country: "",
        postalCode: "",
        lat: originRouteLat,
        lng: originRouteLng
      }),
    [originRouteCity, originRouteStateRegion, originRouteLat, originRouteLng]
  );
  const routeRelevantDestinationAddress = React.useMemo(
    () =>
      pickRouteRelevantAddress({
        streetNumber: "",
        street: "",
        ward: "",
        district: "",
        city: destinationRouteCity,
        stateRegion: destinationRouteStateRegion,
        country: "",
        postalCode: "",
        lat: destinationRouteLat,
        lng: destinationRouteLng
      }),
    [
      destinationRouteCity,
      destinationRouteStateRegion,
      destinationRouteLat,
      destinationRouteLng
    ]
  );
  const routeSuggestionInput = React.useMemo(
    () => ({
      destinationMarket: data.destinationMarket,
      destination: routeRelevantDestinationAddress,
      origin: routeRelevantOriginAddress
    }),
    [
      data.destinationMarket,
      routeRelevantDestinationAddress,
      routeRelevantOriginAddress
    ]
  );
  const routeSuggestionInputSignature = React.useMemo(
    () => buildRouteSuggestionSignature(routeSuggestionInput),
    [routeSuggestionInput]
  );
  const [debouncedRouteSuggestionContext, setDebouncedRouteSuggestionContext] =
    React.useState(routeSuggestionInput);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedRouteSuggestionContext((current) =>
        buildRouteSuggestionSignature(current) === routeSuggestionInputSignature ?
          current :
          routeSuggestionInput
      );
    }, ROUTE_SUGGESTION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [routeSuggestionInput, routeSuggestionInputSignature]);

  const destinationDefaultCenter = React.useMemo(
    () => getDestinationDefaultCenter(data.destinationMarket),
    [data.destinationMarket]
  );

  const resolveDestinationHubsByMode = React.useCallback(
    (mode: TransportLeg["mode"]) => {
      const kind = getHubKindByMode(mode);
      if (isDomesticRoute) {
        return VIETNAM_TRANSFER_HUBS.filter((hub) => hub.kind === kind);
      }
      return (
        DESTINATION_HUBS_BY_MARKET[data.destinationMarket] ||
        DESTINATION_HUBS_BY_MARKET.other ||
        []
      ).filter((hub) => hub.kind === kind);
    },
    [data.destinationMarket, isDomesticRoute]
  );

  const resolveOriginHubsByMode = React.useCallback((mode: TransportLeg["mode"]) => {
    const kind = getHubKindByMode(mode);
    return VIETNAM_TRANSFER_HUBS.filter((hub) => hub.kind === kind);
  }, []);

  const getNearestDestinationHub = React.useCallback(
    (mode: TransportLeg["mode"]) => {
      const destinationLat = data.destinationAddress.lat;
      const destinationLng = data.destinationAddress.lng;
      const candidates = resolveDestinationHubsByMode(mode);
      if (!candidates.length) return null;

      if (isFiniteNumber(destinationLat) && isFiniteNumber(destinationLng)) {
        const nearest = findNearestHub(destinationLat, destinationLng, candidates);
        return nearest?.hub || null;
      }

      return candidates[0];
    },
    [
      data.destinationAddress.lat,
      data.destinationAddress.lng,
      resolveDestinationHubsByMode
    ]
  );

  const getNearestOriginHub = React.useCallback(
    (mode: TransportLeg["mode"]) => {
      const originLat = data.originAddress.lat;
      const originLng = data.originAddress.lng;
      const candidates = resolveOriginHubsByMode(mode);
      if (!candidates.length) return null;

      if (isFiniteNumber(originLat) && isFiniteNumber(originLng)) {
        const nearest = findNearestHub(originLat, originLng, candidates);
        return nearest?.hub || null;
      }

      return candidates[0];
    },
    [
      data.originAddress.lat,
      data.originAddress.lng,
      resolveOriginHubsByMode
    ]
  );

  const resolveExplicitRoadLegEndpoint = React.useCallback(
    (
      nodeRef: TransportLeg["fromNode"] | TransportLeg["toNode"] | undefined
    ): {
      point: RoutePoint;
      role: RoadLegEndpointRole;
      source?: RoadRoutePointSource;
    } | null => {
      if (!nodeRef) return null;

      if (nodeRef.type === "origin_address") {
        return isFiniteNumber(data.originAddress.lat) && isFiniteNumber(data.originAddress.lng) ?
            {
              point: {
                lat: data.originAddress.lat,
                lng: data.originAddress.lng
              },
              role: "origin_address"
            } :
            null;
      }

      if (nodeRef.type === "destination_address") {
        return isFiniteNumber(data.destinationAddress.lat) &&
            isFiniteNumber(data.destinationAddress.lng) ?
            {
              point: {
                lat: data.destinationAddress.lat,
                lng: data.destinationAddress.lng
              },
              role: "destination_address"
            } :
            null;
      }

      if (nodeRef.type === "hub" && nodeRef.hubId) {
        const hub = getRouteHubById(nodeRef.hubId);
        if (!hub) return null;

        return {
          point: {
            lat: hub.lat,
            lng: hub.lng
          },
          role: "hub",
          source: mapHubKindToRoadPointSource(hub.kind)
        };
      }

      return null;
    },
    [
      data.destinationAddress.lat,
      data.destinationAddress.lng,
      data.originAddress.lat,
      data.originAddress.lng
    ]
  );

  const resolveRoadLegEndpoints = React.useCallback(
    (legs: TransportLeg[], roadLegIndex: number): ResolvedRoadLegEndpoints | null => {
      const leg = legs[roadLegIndex];
      if (!leg || leg.mode !== "road") return null;

      const originPoint =
        isFiniteNumber(data.originAddress.lat) && isFiniteNumber(data.originAddress.lng) ?
          {
            lat: data.originAddress.lat,
            lng: data.originAddress.lng
          } :
          null;
      const destinationPoint =
        isFiniteNumber(data.destinationAddress.lat) &&
        isFiniteNumber(data.destinationAddress.lng) ?
          {
            lat: data.destinationAddress.lat,
            lng: data.destinationAddress.lng
          } :
          null;
      const previousLongHaulLeg = [...legs.slice(0, roadLegIndex)].
      reverse().
      find((candidate) => isNonRoadMode(candidate.mode));
      const nextLongHaulLeg = legs.slice(roadLegIndex + 1).find((candidate) =>
        isNonRoadMode(candidate.mode)
      );

      const explicitOrigin = resolveExplicitRoadLegEndpoint(leg.fromNode);
      const explicitDestination = resolveExplicitRoadLegEndpoint(leg.toNode);

      const withExplicitEndpoints = (fallback: ResolvedRoadLegEndpoints | null) => {
        if (!explicitOrigin && !explicitDestination) {
          return fallback;
        }

        if (!fallback && (!explicitOrigin || !explicitDestination)) {
          return null;
        }

        return {
          origin: explicitOrigin?.point || fallback!.origin,
          originRole: explicitOrigin?.role || fallback!.originRole,
          originSource: explicitOrigin?.source || fallback!.originSource,
          destination: explicitDestination?.point || fallback!.destination,
          destinationRole: explicitDestination?.role || fallback!.destinationRole,
          destinationSource: explicitDestination?.source || fallback!.destinationSource
        } satisfies ResolvedRoadLegEndpoints;
      };

      if (!previousLongHaulLeg && !nextLongHaulLeg) {
        return withExplicitEndpoints(
          originPoint && destinationPoint ?
            {
              origin: originPoint,
              originRole: "origin_address",
              destination: destinationPoint,
              destinationRole: "destination_address"
            } :
            null
        );
      }

      if (!previousLongHaulLeg && nextLongHaulLeg) {
        const nextOriginHub = getNearestOriginHub(nextLongHaulLeg.mode);
        return withExplicitEndpoints(
          originPoint && nextOriginHub ?
            {
              origin: originPoint,
              originRole: "origin_address",
              destination: {
                lat: nextOriginHub.lat,
                lng: nextOriginHub.lng
              },
              destinationRole: "hub",
              destinationSource: mapHubKindToRoadPointSource(nextOriginHub.kind)
            } :
            null
        );
      }

      if (previousLongHaulLeg && !nextLongHaulLeg) {
        const previousDestinationHub = getNearestDestinationHub(previousLongHaulLeg.mode);
        return withExplicitEndpoints(
          previousDestinationHub && destinationPoint ?
            {
              origin: {
                lat: previousDestinationHub.lat,
                lng: previousDestinationHub.lng
              },
              originRole: "hub",
              originSource: mapHubKindToRoadPointSource(previousDestinationHub.kind),
              destination: destinationPoint,
              destinationRole: "destination_address"
            } :
            null
        );
      }

      if (previousLongHaulLeg && nextLongHaulLeg) {
        const previousDestinationHub = getNearestDestinationHub(previousLongHaulLeg.mode);
        const nextOriginHub = getNearestOriginHub(nextLongHaulLeg.mode);
        return withExplicitEndpoints(
          previousDestinationHub && nextOriginHub ?
            {
              origin: {
                lat: previousDestinationHub.lat,
                lng: previousDestinationHub.lng
              },
              originRole: "hub",
              originSource: mapHubKindToRoadPointSource(previousDestinationHub.kind),
              destination: {
                lat: nextOriginHub.lat,
                lng: nextOriginHub.lng
              },
              destinationRole: "hub",
              destinationSource: mapHubKindToRoadPointSource(nextOriginHub.kind)
            } :
            null
        );
      }

      return withExplicitEndpoints(null);
    },
    [
      data.destinationAddress.lat,
      data.destinationAddress.lng,
      data.originAddress.lat,
      data.originAddress.lng,
      getNearestDestinationHub,
      getNearestOriginHub,
      resolveExplicitRoadLegEndpoint
    ]
  );

  const normalizeLegSequence = React.useCallback(
    (inputLegs: TransportLeg[]) => {
      const baseLegs = inputLegs.filter((leg) => !isAutoFeederLeg(leg.id));
      const timestamp = Date.now();
      let autoCounter = 0;
      const normalized: TransportLeg[] = [];
      let hasLongHaulLeg = false;
      let latestLongHaulMode: TransportLeg["mode"] | null = null;

      for (const leg of baseLegs) {
        if (isNonRoadMode(leg.mode)) {
          hasLongHaulLeg = true;
          latestLongHaulMode = leg.mode;
          const previousLeg = normalized[normalized.length - 1];

          if (!previousLeg || previousLeg.mode !== "road") {
            autoCounter += 1;
            normalized.push({
              id: `auto-feeder-${timestamp}-${autoCounter}`,
              mode: "road",
              estimatedDistance: undefined,
              routeResolved: false,
              autoSuggested: false,
              fromNode: undefined,
              toNode: undefined
            });
          } else {
            normalized[normalized.length - 1] = {
              ...previousLeg,
              estimatedDistance: undefined,
              routeResolved: false,
              autoSuggested: false,
              fromNode: undefined,
              toNode: undefined
            };
          }
        }

        normalized.push(leg);
      }

      if (hasLongHaulLeg && latestLongHaulMode) {
        const lastLeg = normalized[normalized.length - 1];

        if (!lastLeg || lastLeg.mode !== "road") {
          autoCounter += 1;
          normalized.push({
            id: `auto-feeder-${timestamp}-${autoCounter}`,
            mode: "road",
            estimatedDistance: undefined,
            routeResolved: false,
            autoSuggested: false,
            fromNode: undefined,
            toNode: undefined
          });
        } else {
          normalized[normalized.length - 1] = {
            ...lastLeg,
            estimatedDistance: undefined,
            routeResolved: false,
            autoSuggested: false,
            fromNode: undefined,
            toNode: undefined
          };
        }
      }

      return normalized;
    },
    []
  );

  const updateTransportLeg = (id: string, updates: Partial<TransportLeg>) => {
    const timestamp = Date.now();
    const nextLegs = data.transportLegs.map((leg) =>
      leg.id === id ?
        (() => {
          const nextMode = updates.mode ?? leg.mode;
          const modeChanged = typeof updates.mode !== "undefined" && updates.mode !== leg.mode;

          return {
            ...leg,
            id:
              isAutoSuggestedTransportLeg(leg) ?
                `leg-${timestamp}-${Math.random().toString(16).slice(2, 8)}` :
                leg.id,
            ...updates,
            autoSuggested: false,
            estimatedDistance:
              nextMode === "road" && typeof updates.mode !== "undefined" ?
                undefined :
                updates.estimatedDistance ?? leg.estimatedDistance,
            fromNode:
              modeChanged ?
                undefined :
                cloneTransportLegNodeRef(updates.fromNode ?? leg.fromNode),
            routeResolved:
              nextMode === "road" ?
                typeof updates.mode !== "undefined" ?
                  false :
                  updates.routeResolved ?? leg.routeResolved :
                undefined,
            toNode:
              modeChanged ?
                undefined :
                cloneTransportLegNodeRef(updates.toNode ?? leg.toNode)
          };
        })() :
        leg
    );

    if (typeof updates.mode !== "undefined") {
      onChange({ transportLegs: normalizeLegSequence(nextLegs) });
      return;
    }

    onChange({ transportLegs: nextLegs });
  };

  const totalDistance = data.transportLegs.reduce(
    (sum, leg) => sum + (leg.estimatedDistance || 0),
    0
  );

  const suggestedRoute = React.useMemo<SuggestedRoute>(() => {
    if (isDomesticRoute) {
      return buildDomesticFallbackRoute({
        destination: debouncedRouteSuggestionContext.destination,
        origin: debouncedRouteSuggestionContext.origin
      });
    }

    return buildExportFallbackRoute({
      destinationMarket: debouncedRouteSuggestionContext.destinationMarket,
      destination: debouncedRouteSuggestionContext.destination,
      origin: debouncedRouteSuggestionContext.origin
    });
  }, [debouncedRouteSuggestionContext, isDomesticRoute]);

  const [displaySuggestedRoute, setDisplaySuggestedRoute] = React.useState<SuggestedRoute>(
    suggestedRoute
  );
  const [isSuggestingRoute, setIsSuggestingRoute] = React.useState(false);
  const [resolvingRoadLegIds, setResolvingRoadLegIds] = React.useState<string[]>([]);
  const routeSuggestionRequestSeqRef = React.useRef(0);
  const roadDistanceRequestSeqRef = React.useRef(0);

  const autoSuggestedTransportLegs = React.useMemo(
    () =>
    displaySuggestedRoute.legs.map((leg, index) => ({
      id: `${SUGGESTED_TRANSPORT_LEG_ID_PREFIX}${index + 1}`,
      mode: leg.mode,
      estimatedDistance: leg.estimatedDistance,
      routeResolved: leg.routeResolved,
      fromNode: cloneTransportLegNodeRef(leg.fromNode),
      toNode: cloneTransportLegNodeRef(leg.toNode),
      autoSuggested: true
    })),
    [displaySuggestedRoute]
  );
  const resolvingRoadLegIdSet = React.useMemo(
    () => new Set(resolvingRoadLegIds),
    [resolvingRoadLegIds]
  );
  const isResolvingRoadDistances = resolvingRoadLegIds.length > 0;

  const currentRouteSignature = React.useMemo(
    () => buildRouteSuggestionSignature(debouncedRouteSuggestionContext),
    [debouncedRouteSuggestionContext]
  );
  const roadResolutionSignature = React.useMemo(
    () =>
      buildRoadResolutionSignature(
        data.destinationMarket,
        data.transportLegs,
        data.originAddress,
        data.destinationAddress
      ),
    [
      data.destinationAddress,
      data.destinationMarket,
      data.originAddress,
      data.transportLegs
    ]
  );
  const lastAutoRouteSignatureRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let isCancelled = false;
    const requestSeq = routeSuggestionRequestSeqRef.current + 1;
    routeSuggestionRequestSeqRef.current = requestSeq;

    setDisplaySuggestedRoute(suggestedRoute);
    setIsSuggestingRoute(true);

    const hydrateSuggestedRoute = async () => {
      try {
        if (isDomesticRoute) {
          const resolvedRoute = await resolveDomesticSuggestedRoute({
            destination: debouncedRouteSuggestionContext.destination,
            origin: debouncedRouteSuggestionContext.origin
          }, {
            destinationSource: addressSourceRef.current.destination,
            originSource: addressSourceRef.current.origin
          });

          if (isCancelled) return;

          const snappedUpdates = maybeBuildSnappedAddressUpdates({
            destination: resolvedRoute.snappedDestination,
            origin: resolvedRoute.snappedOrigin
          });

          setDisplaySuggestedRoute(resolvedRoute.route);
          if (snappedUpdates) {
            onChange(snappedUpdates);
          }
          return;
        }

        const resolvedRoute = await resolveExportSuggestedRoute(
          {
            destinationMarket: debouncedRouteSuggestionContext.destinationMarket,
            destination: debouncedRouteSuggestionContext.destination,
            origin: debouncedRouteSuggestionContext.origin
          },
          {
            destinationSource: addressSourceRef.current.destination,
            originSource: addressSourceRef.current.origin
          }
        );

        if (isCancelled) return;

        const snappedUpdates = maybeBuildSnappedAddressUpdates({
          destination: resolvedRoute.snappedDestination,
          origin: resolvedRoute.snappedOrigin
        });

        setDisplaySuggestedRoute(resolvedRoute.route);
        if (snappedUpdates) {
          onChange(snappedUpdates);
        }
      } finally {
        if (!isCancelled && routeSuggestionRequestSeqRef.current === requestSeq) {
          setIsSuggestingRoute(false);
        }
      }
    };

    void hydrateSuggestedRoute();

    return () => {
      isCancelled = true;
    };
  }, [
    debouncedRouteSuggestionContext,
    isDomesticRoute,
    maybeBuildSnappedAddressUpdates,
    onChange,
    suggestedRoute
  ]);

  React.useEffect(() => {
    let isCancelled = false;
    const transportLegs = transportLegsRef.current;
    const roadLegIndexes = transportLegs.reduce<number[]>((indexes, leg, index) => {
      if (leg.mode === "road") {
        indexes.push(index);
      }
      return indexes;
    }, []);

    if (roadLegIndexes.length === 0) {
      setResolvingRoadLegIds((current) => (current.length > 0 ? [] : current));
      return;
    }

    const requestSeq = roadDistanceRequestSeqRef.current + 1;
    roadDistanceRequestSeqRef.current = requestSeq;
    const nextResolvingIds = roadLegIndexes
      .map((index) => transportLegs[index]?.id)
      .filter((legId): legId is string => Boolean(legId));
    setResolvingRoadLegIds(nextResolvingIds);

    const syncRoadLegs = async () => {
      try {
        const nextLegs = [...transportLegs];
        let hasUpdates = false;
        let snappedOrigin: RoutePoint | undefined;
        let snappedDestination: RoutePoint | undefined;

        for (const legIndex of roadLegIndexes) {
          const endpoints = resolveRoadLegEndpoints(nextLegs, legIndex);
          const currentLeg = nextLegs[legIndex];
          if (!endpoints) {
            if (
              currentLeg &&
              (hasPositiveDistance(currentLeg.estimatedDistance) || currentLeg.routeResolved !== false)
            ) {
              nextLegs[legIndex] = {
                ...currentLeg,
                estimatedDistance: undefined,
                routeResolved: false
              };
              hasUpdates = true;
            }
            continue;
          }

          const routeResolution = await fetchRoadRoute(endpoints.origin, endpoints.destination, {
            destinationSource:
              endpoints.destinationRole === "destination_address" ?
                addressSourceRef.current.destination :
                endpoints.destinationSource || "manual",
            originSource:
              endpoints.originRole === "origin_address" ?
                addressSourceRef.current.origin :
                endpoints.originSource || "manual"
          });
          if (!routeResolution.ok) {
            if (
              currentLeg &&
              (hasPositiveDistance(currentLeg.estimatedDistance) || currentLeg.routeResolved !== false)
            ) {
              nextLegs[legIndex] = {
                ...currentLeg,
                estimatedDistance: undefined,
                routeResolved: false
              };
              hasUpdates = true;
            }
            continue;
          }

          if (endpoints.originRole === "origin_address") {
            snappedOrigin = routeResolution.route.resolvedOrigin;
          }
          if (endpoints.destinationRole === "destination_address") {
            snappedDestination = routeResolution.route.resolvedDestination;
          }

          const nextDistance = roundDistanceKm(routeResolution.route.distanceKm);
          const currentDistance = currentLeg?.estimatedDistance;
          if (
            currentLeg &&
            currentLeg.routeResolved === true &&
            hasPositiveDistance(currentDistance) &&
            Math.abs(currentDistance - nextDistance) < ROAD_DISTANCE_UPDATE_EPSILON_KM
          ) {
            continue;
          }

          nextLegs[legIndex] = {
            ...nextLegs[legIndex],
            estimatedDistance: nextDistance,
            routeResolved: true
          };
          hasUpdates = true;
        }

        if (isCancelled) return;

        const snappedUpdates = maybeBuildSnappedAddressUpdates({
          destination: snappedDestination,
          origin: snappedOrigin
        });
        const shouldApplyAddressUpdates = Boolean(snappedUpdates);

        if (!hasUpdates && !shouldApplyAddressUpdates) return;

        onChange({
          ...(snappedUpdates || {}),
          ...(hasUpdates ? { transportLegs: nextLegs } : {})
        });
      } finally {
        if (!isCancelled && roadDistanceRequestSeqRef.current === requestSeq) {
          setResolvingRoadLegIds([]);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (isCancelled) return;
      void syncRoadLegs();
    }, ROAD_DISTANCE_SYNC_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [maybeBuildSnappedAddressUpdates, onChange, resolveRoadLegEndpoints, roadResolutionSignature]);

  React.useEffect(() => {
    const previousRouteSignature = lastAutoRouteSignatureRef.current;
    const routeSignatureChanged =
      previousRouteSignature !== null &&
      previousRouteSignature !== currentRouteSignature;
    const hasNoTransportLegs = data.transportLegs.length === 0;
    const currentLegsAreAutoSuggested =
      data.transportLegs.length > 0 &&
      data.transportLegs.every((leg) => isAutoSuggestedTransportLeg(leg));

    lastAutoRouteSignatureRef.current = currentRouteSignature;

    if (!hasNoTransportLegs && !routeSignatureChanged && !currentLegsAreAutoSuggested) {
      return;
    }

    const isEquivalentToSuggested =
      data.transportLegs.length === autoSuggestedTransportLegs.length &&
      data.transportLegs.every((leg, index) => {
        const suggestedLeg = autoSuggestedTransportLegs[index];
        if (!suggestedLeg) return false;

        const currentDistance = leg.estimatedDistance || 0;
        const suggestedDistance = suggestedLeg.estimatedDistance || 0;
        return (
          leg.mode === suggestedLeg.mode &&
          leg.routeResolved === suggestedLeg.routeResolved &&
          areTransportLegNodeRefsEqual(leg.fromNode, suggestedLeg.fromNode) &&
          areTransportLegNodeRefsEqual(leg.toNode, suggestedLeg.toNode) &&
          Math.abs(currentDistance - suggestedDistance) < ROAD_DISTANCE_UPDATE_EPSILON_KM
        );
      });

    if (isEquivalentToSuggested) {
      return;
    }

    onChange({
      transportLegs: autoSuggestedTransportLegs
    });
  }, [
    autoSuggestedTransportLegs,
    currentRouteSignature,
    data.transportLegs,
    onChange
  ]);

  const handleMarketChange = React.useCallback((market: string) => {
    const marketInfo = DESTINATION_MARKETS.find((item) => item.value === market);
    let country = "Vietnam";

    switch (market) {
      case "usa":
        country = "United States";
        break;
      case "korea":
        country = "South Korea";
        break;
      case "japan":
        country = "Japan";
        break;
      case "eu":
        country = "Germany";
        break;
      case "china":
        country = "China";
        break;
      default:
        country = "Vietnam";
    }

    addressSourceRef.current.destination = "manual";

    onChange({
      destinationMarket: market,
      destinationAddress: {
        ...data.destinationAddress,
        streetNumber: "",
        street: "",
        ward: "",
        district: "",
        city: "",
        stateRegion: "",
        postalCode: "",
        country,
        lat: undefined,
        lng: undefined
      },
      estimatedTotalDistance: marketInfo?.distance || 500
    });
  }, [data.destinationAddress, onChange]);

  React.useEffect(() => {
    if (!starterDomesticMarket) return;
    if (data.destinationMarket === starterDomesticMarket) return;
    handleMarketChange(starterDomesticMarket);
  }, [data.destinationMarket, handleMarketChange, starterDomesticMarket]);

  const starterDomesticMarketLabel = React.useMemo(() => {
    if (!starterDomesticMarket) return "";
    const starterMarket = availableDestinationMarkets.find(
      (market) => market.value === starterDomesticMarket
    );
    if (!starterMarket) return starterDomesticMarket;
    return t.has(`markets.${starterMarket.value}`) ?
    t(`markets.${starterMarket.value}`) :
    starterMarket.label;
  }, [availableDestinationMarkets, starterDomesticMarket, t]);
  const expectedTrialCountry = React.useMemo(
    () => (starterDomesticMarket ? getExpectedCountryForMarket(starterDomesticMarket) : ""),
    [starterDomesticMarket]
  );
  const hasOriginOutsideTrialDomestic =
    Boolean(isTrialPlan && expectedTrialCountry) &&
    Boolean(data.originAddress.country?.trim()) &&
    normalizeCountryToken(data.originAddress.country) !==
      normalizeCountryToken(expectedTrialCountry);
  const hasDestinationOutsideTrialDomestic =
    Boolean(isTrialPlan && expectedTrialCountry) &&
    Boolean(data.destinationAddress.country?.trim()) &&
    normalizeCountryToken(data.destinationAddress.country) !==
      normalizeCountryToken(expectedTrialCountry);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("destinationMarket.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={data.destinationMarket} onValueChange={handleMarketChange}>
            <SelectTrigger
              className="w-full md:max-w-sm"
              disabled={Boolean(starterDomesticMarket)}>
              <SelectValue placeholder={t("destinationMarket.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {availableDestinationMarkets.map((market) => (
                <SelectItem key={market.value} value={market.value}>
                  {t.has(`markets.${market.value}`)
                    ? t(`markets.${market.value}`)
                    : market.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {starterDomesticMarket && starterDomesticMarketLabel ?
          <p className="mt-2 text-xs text-muted-foreground">
              {t("starterLockedHint", { market: starterDomesticMarketLabel })}
            </p> :
          null}
          {data.destinationMarket && !isTrialPlan ?
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {t("complianceDocuments.title", {
                    market: selectedDestinationMarketLabel || data.destinationMarket
                  })}
                </p>
                {selectedComplianceMarketCode ?
                <Badge variant="outline" className="text-xs">
                    {selectedComplianceMarketCode}
                  </Badge> :
                null}
              </div>

              {isComplianceDocumentsLoading ?
              <p className="mt-2 text-xs text-muted-foreground">
                  {t("complianceDocuments.loading")}
                </p> :
              selectedComplianceSummary ?
              <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-emerald-700">
                      {t("complianceDocuments.addedLabel", {
                        count: selectedComplianceSummary.addedDocumentNames.length
                      })}
                    </p>
                    {selectedComplianceSummary.addedDocumentNames.length > 0 ?
                  <div className="mt-2 flex flex-wrap gap-2">
                        {selectedComplianceSummary.addedDocumentNames.map((documentName, index) =>
                    <Badge
                      key={`added-${index}`}
                      className="h-auto max-w-full whitespace-normal break-words border border-emerald-200 bg-emerald-50 text-left text-emerald-700">

                            {documentName}
                          </Badge>
                    )}
                      </div> :
                  <p className="mt-1 text-xs text-muted-foreground">
                        {t("complianceDocuments.noneAdded")}
                      </p>
                  }
                  </div>

                  <div>
                    <p className="text-xs font-medium text-amber-700">
                      {t("complianceDocuments.requiredLabel", {
                        count: selectedComplianceSummary.missingRequiredDocumentNames.length
                      })}
                    </p>
                    {selectedComplianceSummary.missingRequiredDocumentNames.length > 0 ?
                  <div className="mt-2 flex flex-wrap gap-2">
                        {selectedComplianceSummary.missingRequiredDocumentNames.map((documentName, index) =>
                    <Badge
                      key={`required-${index}`}
                      className="h-auto max-w-full whitespace-normal break-words border border-amber-200 bg-amber-50 text-left text-amber-700">

                            {documentName}
                          </Badge>
                    )}
                      </div> :
                  <p className="mt-1 text-xs text-muted-foreground">
                        {t("complianceDocuments.allRequiredAdded")}
                      </p>
                  }
                  </div>
                </div> :
              <p className="mt-2 text-xs text-muted-foreground">
                  {t("complianceDocuments.unavailable")}
                </p>
              }
            </div> :
          null}
        </CardContent>
      </Card>

      {data.destinationMarket ? (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <LocationPicker
                label={t("address.origin")}
                address={data.originAddress}
                onChange={updateOriginAddress}
                defaultCenter={ORIGIN_DEFAULT_CENTER}
                showCurrentLocationButton
              />
              {hasOriginOutsideTrialDomestic ?
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t("trialDomesticAddressWarning", {
                      country: expectedTrialCountry,
                      currentCountry: data.originAddress.country.trim()
                    })}
                  </span>
                </div> :
              null}
            </div>
            <div className="space-y-2">
              <LocationPicker
                key={`destination-${data.destinationMarket}`}
                label={t("address.destination")}
                address={data.destinationAddress}
                onChange={updateDestinationAddress}
                defaultCenter={destinationDefaultCenter}
                showCurrentLocationButton={false}
              />
              {hasDestinationOutsideTrialDomestic ?
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t("trialDomesticAddressWarning", {
                      country: expectedTrialCountry,
                      currentCountry: data.destinationAddress.country.trim()
                    })}
                  </span>
                </div> :
              null}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-lg">{t("transport.title")}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("transport.subtitle")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isSuggestingRoute ? (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-slate-300 bg-slate-50 text-slate-700"
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("transport.recommendingRoute")}
                    </Badge>
                  ) : null}
                  {isResolvingRoadDistances ? (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-slate-300 bg-slate-50 text-slate-700"
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("transport.routeResolving")}
                    </Badge>
                  ) : null}
                  {totalDistance > 0 ? (
                    <Badge variant="outline" className="text-sm">
                      {t("transport.totalDistance", {
                        value: totalDistance.toLocaleString(displayLocale)
                      })}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {data.transportLegs.length > 0 ? (
                <div className="space-y-3">
                  {data.transportLegs.map((leg, index) => {
                    const modeInfo = TRANSPORT_MODES.find((mode) => mode.value === leg.mode);
                    const isRoadLegResolving =
                      leg.mode === "road" && resolvingRoadLegIdSet.has(leg.id);

                    return (
                      <div
                        key={leg.id}
                        className="flex flex-col gap-3 rounded-lg border bg-card p-3 md:flex-row md:items-center md:gap-4"
                      >
                        <div className="flex w-full items-center gap-2 md:w-auto md:min-w-[6.25rem]">
                          <span className="text-sm font-medium text-muted-foreground">
                            {t("transport.leg", { index: index + 1 })}
                          </span>
                          {index < data.transportLegs.length - 1 ? (
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          ) : null}
                        </div>

                        <Select
                          value={leg.mode}
                          onValueChange={(value: "road" | "sea" | "air" | "rail") =>
                            updateTransportLeg(leg.id, { mode: value })
                          }
                        >
                          <SelectTrigger className="w-full md:w-[11.25rem]">
                            <div className="flex items-center gap-2">
                              <TransportIcon mode={leg.mode} />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {TRANSPORT_MODES.map((mode) => (
                              <SelectItem key={mode.value} value={mode.value}>
                                <div className="flex items-center gap-2">
                                  <TransportIcon mode={mode.value} />
                                  <span>
                                    {t.has(`transportModes.${mode.value}`)
                                      ? t(`transportModes.${mode.value}`)
                                      : mode.label}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex w-full items-center gap-2 md:flex-1">
                          <div className="w-full space-y-2">
                            <div className="flex w-full items-center gap-2 md:flex-1">
                              <Input
                                type="number"
                                min="0"
                                value={leg.estimatedDistance ?? ""}
                                onChange={(event) => {
                                  if (leg.mode === "road") return;
                                  updateTransportLeg(leg.id, {
                                    estimatedDistance: Number(event.target.value)
                                  });
                                }}
                                placeholder={
                                  leg.mode === "road" ?
                                    t("transport.distancePlaceholderRoad") :
                                    t("transport.distancePlaceholder")
                                }
                                readOnly={leg.mode === "road"}
                                className="min-w-[5rem] flex-1 md:w-32 md:flex-none"
                              />

                              <span className="shrink-0 text-sm text-muted-foreground">{t("transport.distanceUnit")}</span>
                              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground md:ml-2">
                                {t("transport.co2Factor", { value: modeInfo?.co2Factor || 0 })}
                              </span>
                            </div>

                            {isRoadLegResolving ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>{t("transport.routeResolving")}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default Step4Logistics;
