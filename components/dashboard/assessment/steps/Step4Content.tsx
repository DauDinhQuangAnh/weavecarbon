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
  type RouteHub,
  type RouteHubKind
} from "./routeHubs";
import {
  buildDomesticFallbackRoute,
  resolveDomesticSuggestedRoute,
  type SuggestedRoute
} from "./domesticRouteSuggestion";
import dynamic from "next/dynamic";
import {
  fetchRoadRoute,
  type RoadRouteFailureReason,
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

type RoadLegHydrationFailure = {
  legId: string;
  legIndex: number;
  reason: RoadRouteFailureReason;
};

type RoadLegHydrationOutcome = {
  failures: RoadLegHydrationFailure[];
  legs: TransportLeg[];
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
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

const resolveSuggestedLongHaulMode = (
  destinationMarket: string,
  totalDistanceKm: number
): TransportLeg["mode"] => {
  if (destinationMarket === "usa" || destinationMarket === "eu") {
    if (destinationMarket === "eu" && totalDistanceKm <= 12000) {
      return "rail";
    }
    return "sea";
  }
  if (destinationMarket === "korea" || destinationMarket === "japan") {
    return "air";
  }
  if (destinationMarket === "china") {
    return "rail";
  }
  return totalDistanceKm <= 4500 ? "air" : "sea";
};

const isAutoFeederLeg = (legId: string) => legId.startsWith("auto-feeder-");
const SUGGESTED_TRANSPORT_LEG_ID_PREFIX = "suggested-leg-";
const isSuggestedTransportLeg = (legId: string) =>
  legId.startsWith(SUGGESTED_TRANSPORT_LEG_ID_PREFIX);

const isResolvedRoadTransportLeg = (leg: TransportLeg) =>
  leg.mode !== "road" || (leg.routeResolved === true && hasPositiveDistance(leg.estimatedDistance));

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
  const [roadFailureByLegId, setRoadFailureByLegId] = React.useState<
    Record<string, RoadRouteFailureReason>
  >({});

  const updateOriginAddress = (
    address: AddressInput,
    meta?: {
      source: RoadRoutePointSource;
    }
  ) => {
    addressSourceRef.current.origin = meta?.source || addressSourceRef.current.origin;
    onChange({ originAddress: address });
  };

  const updateDestinationAddress = (
    address: AddressInput,
    meta?: {
      source: RoadRoutePointSource;
    }
  ) => {
    addressSourceRef.current.destination = meta?.source || addressSourceRef.current.destination;
    onChange({ destinationAddress: address });
  };

  const maybeBuildSnappedAddressUpdates = React.useCallback(
    (nextPoints: { destination?: RoutePoint; origin?: RoutePoint }) => {
      const updates: Partial<ProductAssessmentData> = {};

      if (
        nextPoints.origin &&
        shouldPersistSnappedAddressForSource(addressSourceRef.current.origin) &&
        (!isFiniteNumber(data.originAddress.lat) ||
          !isFiniteNumber(data.originAddress.lng) ||
          Math.abs(data.originAddress.lat - nextPoints.origin.lat) >= ROAD_SNAP_UPDATE_EPSILON ||
          Math.abs(data.originAddress.lng - nextPoints.origin.lng) >= ROAD_SNAP_UPDATE_EPSILON)
      ) {
        updates.originAddress = {
          ...data.originAddress,
          lat: nextPoints.origin.lat,
          lng: nextPoints.origin.lng
        };
      }

      if (
        nextPoints.destination &&
        shouldPersistSnappedAddressForSource(addressSourceRef.current.destination) &&
        (!isFiniteNumber(data.destinationAddress.lat) ||
          !isFiniteNumber(data.destinationAddress.lng) ||
          Math.abs(data.destinationAddress.lat - nextPoints.destination.lat) >=
            ROAD_SNAP_UPDATE_EPSILON ||
          Math.abs(data.destinationAddress.lng - nextPoints.destination.lng) >=
            ROAD_SNAP_UPDATE_EPSILON)
      ) {
        updates.destinationAddress = {
          ...data.destinationAddress,
          lat: nextPoints.destination.lat,
          lng: nextPoints.destination.lng
        };
      }

      return Object.keys(updates).length > 0 ? updates : null;
    },
    [data.destinationAddress, data.originAddress]
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

      if (!previousLongHaulLeg && !nextLongHaulLeg) {
        return originPoint && destinationPoint ?
          {
            origin: originPoint,
            originRole: "origin_address",
            destination: destinationPoint,
            destinationRole: "destination_address"
          } :
          null;
      }

      if (!previousLongHaulLeg && nextLongHaulLeg) {
        const nextOriginHub = getNearestOriginHub(nextLongHaulLeg.mode);
        if (!originPoint || !nextOriginHub) return null;

        return {
          origin: originPoint,
          originRole: "origin_address",
          destination: {
            lat: nextOriginHub.lat,
            lng: nextOriginHub.lng
          },
          destinationRole: "hub",
          destinationSource: mapHubKindToRoadPointSource(nextOriginHub.kind)
        };
      }

      if (previousLongHaulLeg && !nextLongHaulLeg) {
        const previousDestinationHub = getNearestDestinationHub(previousLongHaulLeg.mode);
        if (!previousDestinationHub || !destinationPoint) return null;

        return {
          origin: {
            lat: previousDestinationHub.lat,
            lng: previousDestinationHub.lng
          },
          originRole: "hub",
          originSource: mapHubKindToRoadPointSource(previousDestinationHub.kind),
          destination: destinationPoint,
          destinationRole: "destination_address"
        };
      }

      if (previousLongHaulLeg && nextLongHaulLeg) {
        const previousDestinationHub = getNearestDestinationHub(previousLongHaulLeg.mode);
        const nextDestinationHub = getNearestDestinationHub(nextLongHaulLeg.mode);
        if (!previousDestinationHub || !nextDestinationHub) return null;

        return {
          origin: {
            lat: previousDestinationHub.lat,
            lng: previousDestinationHub.lng
          },
          originRole: "hub",
          originSource: mapHubKindToRoadPointSource(previousDestinationHub.kind),
          destination: {
            lat: nextDestinationHub.lat,
            lng: nextDestinationHub.lng
          },
          destinationRole: "hub",
          destinationSource: mapHubKindToRoadPointSource(nextDestinationHub.kind)
        };
      }

      return null;
    },
    [
      data.destinationAddress.lat,
      data.destinationAddress.lng,
      data.originAddress.lat,
      data.originAddress.lng,
      getNearestDestinationHub,
      getNearestOriginHub
    ]
  );

  const enrichRoadLegDistances = React.useCallback(
    async (legs: TransportLeg[]) => {
      const failures: RoadLegHydrationFailure[] = [];
      let snappedOrigin: RoutePoint | undefined;
      let snappedDestination: RoutePoint | undefined;

      const nextLegs = await Promise.all(
        legs.map(async (leg, index) => {
          if (leg.mode !== "road") return leg;

          const endpoints = resolveRoadLegEndpoints(legs, index);
          if (!endpoints) {
            failures.push({
              legId: leg.id,
              legIndex: index,
              reason: "invalid_coordinates"
            });
            return {
              ...leg,
              estimatedDistance: undefined,
              routeResolved: false
            };
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
            failures.push({
              legId: leg.id,
              legIndex: index,
              reason: routeResolution.failureReason
            });
            return {
              ...leg,
              estimatedDistance: undefined,
              routeResolved: false
            };
          }

          if (endpoints.originRole === "origin_address") {
            snappedOrigin = routeResolution.route.resolvedOrigin;
          }

          if (endpoints.destinationRole === "destination_address") {
            snappedDestination = routeResolution.route.resolvedDestination;
          }

          return {
            ...leg,
            estimatedDistance: roundDistanceKm(routeResolution.route.distanceKm),
            routeResolved: true
          };
        })
      );

      return {
        failures,
        legs: nextLegs,
        snappedDestination,
        snappedOrigin
      } satisfies RoadLegHydrationOutcome;
    },
    [resolveRoadLegEndpoints]
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
              routeResolved: false
            });
          } else {
            normalized[normalized.length - 1] = {
              ...previousLeg,
              estimatedDistance: undefined,
              routeResolved: false
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
            routeResolved: false
          });
        } else {
          normalized[normalized.length - 1] = {
            ...lastLeg,
            estimatedDistance: undefined,
            routeResolved: false
          };
        }
      }

      return normalized;
    },
    []
  );

  const updateTransportLeg = (id: string, updates: Partial<TransportLeg>) => {
    const timestamp = Date.now();
    setRoadFailureByLegId((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    const nextLegs = data.transportLegs.map((leg) =>
      leg.id === id ?
        (() => {
          const nextMode = updates.mode ?? leg.mode;

          return {
            ...leg,
            id:
              isSuggestedTransportLeg(leg.id) ?
                `leg-${timestamp}-${Math.random().toString(16).slice(2, 8)}` :
                leg.id,
            ...updates,
            estimatedDistance:
              nextMode === "road" && typeof updates.mode !== "undefined" ?
                undefined :
                updates.estimatedDistance ?? leg.estimatedDistance,
            routeResolved:
              nextMode === "road" ?
                typeof updates.mode !== "undefined" ?
                  false :
                  updates.routeResolved ?? leg.routeResolved :
                undefined
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
    const marketInfo = DESTINATION_MARKETS.find(
      (market) => market.value === data.destinationMarket
    );

    const originLat = data.originAddress.lat;
    const originLng = data.originAddress.lng;
    const destinationLat = data.destinationAddress.lat;
    const destinationLng = data.destinationAddress.lng;

    const coordinateDistance =
      isFiniteNumber(originLat) &&
      isFiniteNumber(originLng) &&
      isFiniteNumber(destinationLat) &&
      isFiniteNumber(destinationLng)
        ? calculateGreatCircleDistanceKm(
            originLat,
            originLng,
            destinationLat,
            destinationLng
          )
        : null;

    const fallbackDistance =
      marketInfo?.distance && marketInfo.distance > 0 ? marketInfo.distance : 5000;
    const rawEstimatedKm = Math.round(
      coordinateDistance && coordinateDistance > 0 ? coordinateDistance : fallbackDistance
    );
    const totalEstimatedKm = isDomesticRoute ?
      Math.max(1, rawEstimatedKm) :
      Math.max(100, rawEstimatedKm);

    const buildHubBridgeRoute = (
      longHaulMode: TransportLeg["mode"],
      originHubs: RouteHub[],
      destinationHubs: RouteHub[]
    ) => {
      const nearestOriginHub =
        isFiniteNumber(originLat) && isFiniteNumber(originLng)
          ? findNearestHub(originLat, originLng, originHubs)
          : null;
      const nearestDestinationHub =
        isFiniteNumber(destinationLat) && isFiniteNumber(destinationLng)
          ? findNearestHub(destinationLat, destinationLng, destinationHubs)
          : destinationHubs.length > 0
            ? { hub: destinationHubs[0], distanceKm: 0 }
            : null;

      let longHaulDistance = Math.max(50, totalEstimatedKm);
      if (nearestOriginHub && nearestDestinationHub) {
        longHaulDistance = calculateGreatCircleDistanceKm(
          nearestOriginHub.hub.lat,
          nearestOriginHub.hub.lng,
          nearestDestinationHub.hub.lat,
          nearestDestinationHub.hub.lng
        );
      } else if (
        nearestOriginHub &&
        isFiniteNumber(destinationLat) &&
        isFiniteNumber(destinationLng)
      ) {
        longHaulDistance = calculateGreatCircleDistanceKm(
          nearestOriginHub.hub.lat,
          nearestOriginHub.hub.lng,
          destinationLat,
          destinationLng
        );
      } else if (
        nearestDestinationHub &&
        isFiniteNumber(originLat) &&
        isFiniteNumber(originLng)
      ) {
        longHaulDistance = calculateGreatCircleDistanceKm(
          originLat,
          originLng,
          nearestDestinationHub.hub.lat,
          nearestDestinationHub.hub.lng
        );
      }

      const secondLegKm = Math.max(50, Math.round(longHaulDistance));

      return {
        longHaulMode,
        legs: [
          {
            mode: "road" as const,
            estimatedDistance: undefined,
            routeResolved: false
          },
          {
            mode: longHaulMode,
            estimatedDistance: secondLegKm
          },
          {
            mode: "road" as const,
            estimatedDistance: undefined,
            routeResolved: false
          }
        ]
      };
    };

    if (isDomesticRoute) {
      return buildDomesticFallbackRoute({
        destination: data.destinationAddress,
        origin: data.originAddress
      });
    }

    const longHaulMode = resolveSuggestedLongHaulMode(
      data.destinationMarket,
      totalEstimatedKm
    );
    const requiredHubKind = getHubKindByMode(longHaulMode);

    const originHubCandidates = VIETNAM_TRANSFER_HUBS.filter(
      (hub) => hub.kind === requiredHubKind
    );
    const destinationHubCandidates = (
      DESTINATION_HUBS_BY_MARKET[data.destinationMarket] ||
      DESTINATION_HUBS_BY_MARKET.other ||
      []
    ).filter((hub) => hub.kind === requiredHubKind);

    if (!originHubCandidates.length || !destinationHubCandidates.length) {
      return {
        longHaulMode: "road" as const,
        legs: [
          {
            mode: "road" as const,
            estimatedDistance: undefined,
            routeResolved: false
          }
        ]
      };
    }
    return buildHubBridgeRoute(longHaulMode, originHubCandidates, destinationHubCandidates);
  }, [
    isDomesticRoute,
    data.destinationMarket,
    data.destinationAddress,
    data.originAddress
  ]);

  const [displaySuggestedRoute, setDisplaySuggestedRoute] = React.useState<SuggestedRoute>(
    suggestedRoute
  );
  const [displaySuggestedRoadFailures, setDisplaySuggestedRoadFailures] = React.useState<
    RoadLegHydrationFailure[]
  >([]);

  const autoSuggestedTransportLegs = React.useMemo(
    () =>
    displaySuggestedRoute.legs.map((leg, index) => ({
      id: `${SUGGESTED_TRANSPORT_LEG_ID_PREFIX}${index + 1}`,
      mode: leg.mode,
      estimatedDistance: leg.estimatedDistance,
      routeResolved: leg.routeResolved
    })),
    [displaySuggestedRoute]
  );
  const autoSuggestedRoadFailureById = React.useMemo(
    () =>
      displaySuggestedRoadFailures.reduce<Record<string, RoadRouteFailureReason>>(
        (accumulator, failure) => {
          accumulator[`${SUGGESTED_TRANSPORT_LEG_ID_PREFIX}${failure.legIndex + 1}`] = failure.reason;
          return accumulator;
        },
        {}
      ),
    [displaySuggestedRoadFailures]
  );

  const currentRouteSignature = React.useMemo(
    () =>
    [
      data.destinationMarket,
      data.originAddress.city ?? "",
      data.originAddress.stateRegion ?? "",
      data.originAddress.lat ?? "",
      data.originAddress.lng ?? "",
      data.destinationAddress.city ?? "",
      data.destinationAddress.stateRegion ?? "",
      data.destinationAddress.lat ?? "",
      data.destinationAddress.lng ?? ""
    ].join("|"),
    [
      data.destinationMarket,
      data.originAddress.city,
      data.originAddress.stateRegion,
      data.originAddress.lat,
      data.originAddress.lng,
      data.destinationAddress.city,
      data.destinationAddress.stateRegion,
      data.destinationAddress.lat,
      data.destinationAddress.lng
    ]
  );
  const lastAutoRouteSignatureRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let isCancelled = false;

    setDisplaySuggestedRoute(suggestedRoute);
    setDisplaySuggestedRoadFailures([]);

    const hydrateSuggestedRoute = async () => {
      if (isDomesticRoute) {
        const resolvedRoute = await resolveDomesticSuggestedRoute({
          destination: data.destinationAddress,
          origin: data.originAddress
        }, {
          destinationSource: addressSourceRef.current.destination,
          originSource: addressSourceRef.current.origin
        });

        if (isCancelled) return;

        const snappedUpdates = maybeBuildSnappedAddressUpdates({
          destination: resolvedRoute.snappedDestination,
          origin: resolvedRoute.snappedOrigin
        });

        setDisplaySuggestedRoadFailures(
          resolvedRoute.roadFailures.map((failure) => ({
            legId: `suggested-preview-${failure.legIndex + 1}`,
            legIndex: failure.legIndex,
            reason: failure.reason
          }))
        );
        setDisplaySuggestedRoute(resolvedRoute.route);
        if (snappedUpdates) {
          onChange(snappedUpdates);
        }
        return;
      }

      const hydrationOutcome = await enrichRoadLegDistances(
        suggestedRoute.legs.map((leg, index) => ({
          id: `suggested-preview-${index + 1}`,
          mode: leg.mode,
          estimatedDistance: leg.estimatedDistance
        }))
      );

      if (isCancelled) return;

      const snappedUpdates = maybeBuildSnappedAddressUpdates({
        destination: hydrationOutcome.snappedDestination,
        origin: hydrationOutcome.snappedOrigin
      });

      setDisplaySuggestedRoadFailures(hydrationOutcome.failures);
      setDisplaySuggestedRoute({
        ...suggestedRoute,
        legs: hydrationOutcome.legs.map((leg) => ({
          mode: leg.mode,
          estimatedDistance: leg.estimatedDistance,
          routeResolved: leg.routeResolved
        }))
      });
      if (snappedUpdates) {
        onChange(snappedUpdates);
      }
    };

    void hydrateSuggestedRoute();

    return () => {
      isCancelled = true;
    };
  }, [
    data.destinationAddress,
    data.originAddress,
    enrichRoadLegDistances,
    isDomesticRoute,
    maybeBuildSnappedAddressUpdates,
    onChange,
    suggestedRoute
  ]);

  React.useEffect(() => {
    let isCancelled = false;
    const roadLegIndexes = data.transportLegs.reduce<number[]>((indexes, leg, index) => {
      if (leg.mode === "road") {
        indexes.push(index);
      }
      return indexes;
    }, []);

    if (roadLegIndexes.length === 0) {
      setRoadFailureByLegId((current) => {
        const next = { ...current };
        data.transportLegs.forEach((leg) => {
          if (leg.mode === "road") {
            delete next[leg.id];
          }
        });
        Object.keys(next).forEach((legId) => {
          const matchingLeg = data.transportLegs.find((leg) => leg.id === legId);
          if (!matchingLeg || matchingLeg.mode !== "road") {
            delete next[legId];
          }
        });
        return next;
      });
      return;
    }

    const syncRoadLegs = async () => {
      const nextLegs = [...data.transportLegs];
      const nextFailures: Record<string, RoadRouteFailureReason> = {};
      let hasUpdates = false;
      let snappedOrigin: RoutePoint | undefined;
      let snappedDestination: RoutePoint | undefined;

      for (const legIndex of roadLegIndexes) {
        const endpoints = resolveRoadLegEndpoints(nextLegs, legIndex);
        const currentLeg = nextLegs[legIndex];
        const legId = currentLeg?.id;
        if (!endpoints) {
          if (legId) {
            nextFailures[legId] = "invalid_coordinates";
          }
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
          if (legId) {
            nextFailures[legId] = routeResolution.failureReason;
          }
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

      setRoadFailureByLegId((current) => {
        const next = { ...current };
        Object.keys(next).forEach((legId) => {
          const matchingLeg = data.transportLegs.find((leg) => leg.id === legId);
          if (!matchingLeg || matchingLeg.mode !== "road") {
            delete next[legId];
          }
        });
        Object.assign(next, nextFailures);
        return next;
      });

      if (!hasUpdates && !shouldApplyAddressUpdates) return;

      onChange({
        ...(snappedUpdates || {}),
        ...(hasUpdates ? { transportLegs: nextLegs } : {})
      });
    };

    void syncRoadLegs();

    return () => {
      isCancelled = true;
    };
  }, [data.transportLegs, maybeBuildSnappedAddressUpdates, onChange, resolveRoadLegEndpoints]);

  React.useEffect(() => {
    const previousRouteSignature = lastAutoRouteSignatureRef.current;
    const routeSignatureChanged =
      previousRouteSignature !== null &&
      previousRouteSignature !== currentRouteSignature;
    const hasNoTransportLegs = data.transportLegs.length === 0;
    const currentLegsAreAutoSuggested =
      data.transportLegs.length > 0 &&
      data.transportLegs.every((leg) => isSuggestedTransportLeg(leg.id));

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
          Math.abs(currentDistance - suggestedDistance) < ROAD_DISTANCE_UPDATE_EPSILON_KM
        );
      });

    if (isEquivalentToSuggested) {
      setRoadFailureByLegId((current) => {
        const next = { ...current };
        Object.keys(next).forEach((legId) => {
          if (isSuggestedTransportLeg(legId)) {
            delete next[legId];
          }
        });
        Object.assign(next, autoSuggestedRoadFailureById);
        return next;
      });
      return;
    }

    setRoadFailureByLegId((current) => {
      const next = { ...current };
      Object.keys(next).forEach((legId) => {
        if (isSuggestedTransportLeg(legId)) {
          delete next[legId];
        }
      });
      Object.assign(next, autoSuggestedRoadFailureById);
      return next;
    });

    onChange({
      transportLegs: autoSuggestedTransportLegs
    });
  }, [
    autoSuggestedRoadFailureById,
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
    setRoadFailureByLegId({});

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
                defaultCenter={[106.6297, 10.8231]}
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
                defaultCenter={getDestinationDefaultCenter(data.destinationMarket)}
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{t("transport.title")}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("transport.subtitle")}
                  </p>
                </div>

                {totalDistance > 0 ? (
                  <Badge variant="outline" className="text-sm">
                    {t("transport.totalDistance", {
                      value: totalDistance.toLocaleString(displayLocale)
                    })}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {data.transportLegs.length > 0 ? (
                <div className="space-y-3">
                  {data.transportLegs.map((leg, index) => {
                    const modeInfo = TRANSPORT_MODES.find((mode) => mode.value === leg.mode);
                    const roadFailureReason = leg.mode === "road" ? roadFailureByLegId[leg.id] : undefined;
                    const isRoadLegPending =
                      leg.mode === "road" &&
                      !roadFailureReason &&
                      !isResolvedRoadTransportLeg(leg);
                    const isRoadLegResolved =
                      leg.mode === "road" &&
                      isResolvedRoadTransportLeg(leg);

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
                            {roadFailureReason ?
                            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{t("transport.routeUnconfirmed")}</span>
                              </div> :
                            isRoadLegPending ?
                            <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{t("transport.routeResolving")}</span>
                              </div> :
                            isRoadLegResolved ?
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                {t("transport.routeResolved")}
                              </div> :
                            null}
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
