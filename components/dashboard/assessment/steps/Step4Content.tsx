"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Plus,
  Trash2,
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
import dynamic from "next/dynamic";
import { fetchRoadRoute } from "@/lib/roadRouting";

interface LocationPickerProps {
  address: AddressInput;
  onChange: (address: AddressInput) => void;
  label: string;
  defaultCenter?: [number, number];
}

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

const roundDistanceKm = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 10) / 10;

const ROAD_DISTANCE_UPDATE_EPSILON_KM = 0.5;

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

type SuggestedRoute = {
  longHaulMode: TransportLeg["mode"];
  legs: Array<{
    mode: TransportLeg["mode"];
    estimatedDistance: number;
  }>;
};

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

  const updateOriginAddress = (address: AddressInput) => {
    onChange({ originAddress: address });
  };

  const updateDestinationAddress = (address: AddressInput) => {
    onChange({ destinationAddress: address });
  };

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

  const estimateInitialFeederRoadDistance = React.useCallback(
    (mode: TransportLeg["mode"]) => {
      const originLat = data.originAddress.lat;
      const originLng = data.originAddress.lng;
      const originHubs = resolveOriginHubsByMode(mode);
      if (!originHubs.length) return 30;

      if (isFiniteNumber(originLat) && isFiniteNumber(originLng)) {
        const nearest = findNearestHub(originLat, originLng, originHubs);
        if (nearest) return Math.max(10, Math.round(nearest.distanceKm));
      }

      return 30;
    },
    [data.originAddress.lat, data.originAddress.lng, resolveOriginHubsByMode]
  );

  const estimateTransferRoadDistance = React.useCallback(
    (previousLongHaulMode: TransportLeg["mode"], nextLongHaulMode: TransportLeg["mode"]) => {
      const previousHub = getNearestDestinationHub(previousLongHaulMode);
      const nextHub = getNearestDestinationHub(nextLongHaulMode);
      if (previousHub && nextHub) {
        return Math.max(
          10,
          Math.round(
            calculateGreatCircleDistanceKm(
              previousHub.lat,
              previousHub.lng,
              nextHub.lat,
              nextHub.lng
            )
          )
        );
      }
      return 30;
    },
    [getNearestDestinationHub]
  );

  const estimateFinalFeederRoadDistance = React.useCallback(
    (mode: TransportLeg["mode"]) => {
      const destinationLat = data.destinationAddress.lat;
      const destinationLng = data.destinationAddress.lng;
      const destinationHubs = resolveDestinationHubsByMode(mode);
      if (!destinationHubs.length) return 30;

      if (isFiniteNumber(destinationLat) && isFiniteNumber(destinationLng)) {
        const nearest = findNearestHub(destinationLat, destinationLng, destinationHubs);
        if (nearest) return Math.max(10, Math.round(nearest.distanceKm));
      }

      return 30;
    },
    [
      data.destinationAddress.lat,
      data.destinationAddress.lng,
      resolveDestinationHubsByMode
    ]
  );

  const resolveRoadLegEndpoints = React.useCallback(
    (legs: TransportLeg[], roadLegIndex: number) => {
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
            destination: destinationPoint
          } :
          null;
      }

      if (!previousLongHaulLeg && nextLongHaulLeg) {
        const nextOriginHub = getNearestOriginHub(nextLongHaulLeg.mode);
        if (!originPoint || !nextOriginHub) return null;

        return {
          origin: originPoint,
          destination: {
            lat: nextOriginHub.lat,
            lng: nextOriginHub.lng
          }
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
          destination: destinationPoint
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
          destination: {
            lat: nextDestinationHub.lat,
            lng: nextDestinationHub.lng
          }
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
      const nextLegs = await Promise.all(
        legs.map(async (leg, index) => {
          if (leg.mode !== "road") return leg;

          const endpoints = resolveRoadLegEndpoints(legs, index);
          if (!endpoints) return leg;

          const route = await fetchRoadRoute(endpoints.origin, endpoints.destination);
          if (!route) return leg;

          return {
            ...leg,
            estimatedDistance: roundDistanceKm(route.distanceKm)
          };
        })
      );

      return nextLegs;
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
          const previousLongHaulLeg = [...normalized]
            .reverse()
            .find((candidate) => isNonRoadMode(candidate.mode));
          const feederDistance = previousLongHaulLeg
            ? estimateTransferRoadDistance(previousLongHaulLeg.mode, leg.mode)
            : estimateInitialFeederRoadDistance(leg.mode);

          if (!previousLeg || previousLeg.mode !== "road") {
            autoCounter += 1;
            normalized.push({
              id: `auto-feeder-${timestamp}-${autoCounter}`,
              mode: "road",
              estimatedDistance: feederDistance
            });
          } else {
            normalized[normalized.length - 1] = {
              ...previousLeg,
              estimatedDistance: feederDistance
            };
          }
        }

        normalized.push(leg);
      }

      if (hasLongHaulLeg && latestLongHaulMode) {
        const finalFeederDistance = estimateFinalFeederRoadDistance(latestLongHaulMode);
        const lastLeg = normalized[normalized.length - 1];

        if (!lastLeg || lastLeg.mode !== "road") {
          autoCounter += 1;
          normalized.push({
            id: `auto-feeder-${timestamp}-${autoCounter}`,
            mode: "road",
            estimatedDistance: finalFeederDistance
          });
        } else {
          normalized[normalized.length - 1] = {
            ...lastLeg,
            estimatedDistance: finalFeederDistance
          };
        }
      }

      return normalized;
    },
    [
      estimateFinalFeederRoadDistance,
      estimateInitialFeederRoadDistance,
      estimateTransferRoadDistance
    ]
  );

  const addTransportLeg = () => {
    const newLeg: TransportLeg = {
      id: `leg-${Date.now()}`,
      mode: "road",
      estimatedDistance: undefined
    };

    onChange({ transportLegs: normalizeLegSequence([...data.transportLegs, newLeg]) });
  };

  const clearTransportLegs = () => {
    onChange({ transportLegs: [] });
  };

  const updateTransportLeg = (id: string, updates: Partial<TransportLeg>) => {
    const nextLegs = data.transportLegs.map((leg) =>
      leg.id === id ? { ...leg, ...updates } : leg
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

      const fallbackFirstLeg = Math.max(
        20,
        Math.min(150, Math.round(totalEstimatedKm * 0.08))
      );
      const fallbackLastLeg = Math.max(
        20,
        Math.min(150, Math.round(totalEstimatedKm * 0.08))
      );
      const firstLegKm = nearestOriginHub
        ? Math.max(10, Math.round(nearestOriginHub.distanceKm))
        : fallbackFirstLeg;
      const lastLegKm = nearestDestinationHub
        ? Math.max(10, Math.round(nearestDestinationHub.distanceKm))
        : fallbackLastLeg;

      let longHaulDistance = Math.max(50, totalEstimatedKm - firstLegKm - lastLegKm);
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
            estimatedDistance: firstLegKm
          },
          {
            mode: longHaulMode,
            estimatedDistance: secondLegKm
          },
          {
            mode: "road" as const,
            estimatedDistance: lastLegKm
          }
        ]
      };
    };

    if (isDomesticRoute) {
      if (totalEstimatedKm <= 500) {
        return {
          longHaulMode: "road" as const,
          legs: [
            {
              mode: "road" as const,
              estimatedDistance: totalEstimatedKm
            }
          ]
        };
      }

      const domesticAirportHubs = VIETNAM_TRANSFER_HUBS.filter(
        (hub) => hub.kind === "airport"
      );
      return buildHubBridgeRoute("air", domesticAirportHubs, domesticAirportHubs);
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
            estimatedDistance: totalEstimatedKm
          }
        ]
      };
    }
    return buildHubBridgeRoute(longHaulMode, originHubCandidates, destinationHubCandidates);
  }, [
    isDomesticRoute,
    data.destinationMarket,
    data.originAddress.lat,
    data.originAddress.lng,
    data.destinationAddress.lat,
    data.destinationAddress.lng
  ]);

  const [displaySuggestedRoute, setDisplaySuggestedRoute] = React.useState<SuggestedRoute>(
    suggestedRoute
  );

  React.useEffect(() => {
    let isCancelled = false;

    setDisplaySuggestedRoute(suggestedRoute);

    const hydrateSuggestedRoute = async () => {
      const hydratedLegs = await enrichRoadLegDistances(
        suggestedRoute.legs.map((leg, index) => ({
          id: `suggested-preview-${index + 1}`,
          mode: leg.mode,
          estimatedDistance: leg.estimatedDistance
        }))
      );

      if (isCancelled) return;

      setDisplaySuggestedRoute({
        ...suggestedRoute,
        legs: hydratedLegs.map((leg) => ({
          mode: leg.mode,
          estimatedDistance: leg.estimatedDistance || 0
        }))
      });
    };

    void hydrateSuggestedRoute();

    return () => {
      isCancelled = true;
    };
  }, [enrichRoadLegDistances, suggestedRoute]);

  React.useEffect(() => {
    let isCancelled = false;
    const autoFeederIndexes = data.transportLegs.reduce<number[]>((indexes, leg, index) => {
      if (leg.mode === "road" && isAutoFeederLeg(leg.id)) {
        indexes.push(index);
      }
      return indexes;
    }, []);

    if (autoFeederIndexes.length === 0) {
      return;
    }

    const syncAutoFeederRoadLegs = async () => {
      const nextLegs = [...data.transportLegs];
      let hasUpdates = false;

      for (const legIndex of autoFeederIndexes) {
        const endpoints = resolveRoadLegEndpoints(nextLegs, legIndex);
        if (!endpoints) continue;

        const route = await fetchRoadRoute(endpoints.origin, endpoints.destination);
        if (!route) continue;

        const nextDistance = roundDistanceKm(route.distanceKm);
        const currentDistance = nextLegs[legIndex]?.estimatedDistance;
        if (
          typeof currentDistance === "number" &&
          Math.abs(currentDistance - nextDistance) < ROAD_DISTANCE_UPDATE_EPSILON_KM
        ) {
          continue;
        }

        nextLegs[legIndex] = {
          ...nextLegs[legIndex],
          estimatedDistance: nextDistance
        };
        hasUpdates = true;
      }

      if (isCancelled || !hasUpdates) return;

      onChange({ transportLegs: nextLegs });
    };

    void syncAutoFeederRoadLegs();

    return () => {
      isCancelled = true;
    };
  }, [data.transportLegs, onChange, resolveRoadLegEndpoints]);

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

    onChange({
      destinationMarket: market,
      destinationAddress: {
        ...data.destinationAddress,
        country
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
                          <Input
                            type="number"
                            min="0"
                            value={leg.estimatedDistance || ""}
                            onChange={(event) =>
                              updateTransportLeg(leg.id, {
                                estimatedDistance: Number(event.target.value)
                              })
                            }
                            placeholder={t("transport.distancePlaceholder")}
                            className="min-w-[5rem] flex-1 md:w-32 md:flex-none"
                          />

                          <span className="shrink-0 text-sm text-muted-foreground">{t("transport.distanceUnit")}</span>
                          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground md:ml-2">
                            {t("transport.co2Factor", { value: modeInfo?.co2Factor || 0 })}
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className={data.transportLegs.length > 0 ? "flex flex-col gap-2 md:flex-row md:items-center" : ""}>
                <Button
                  variant="outline"
                  onClick={addTransportLeg}
                  className={
                    data.transportLegs.length > 0 ? "flex-1 border-dashed" : "w-full border-dashed"
                  }
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("transport.addLeg")}
                </Button>
                {data.transportLegs.length > 0 ? (
                  <Button
                    variant="outline"
                    onClick={clearTransportLegs}
                    className="flex-1 text-destructive border-destructive/30 hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("transport.clearAllLegs")}
                  </Button>
                ) : null}
              </div>

              {data.transportLegs.length === 0 ? (
                <div className="p-4 rounded-lg bg-muted/50 border border-dashed">
                  <p className="text-sm font-medium mb-2">{t("suggestedRoute.title")}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {displaySuggestedRoute.legs.map((leg, index) => (
                      <React.Fragment key={`suggested-leg-${index}`}>
                        {index > 0 ? <ArrowRight className="w-4 h-4" /> : null}
                        <TransportIcon mode={leg.mode} className="w-4 h-4" />
                        <span>
                          {t.has(`transportModes.${leg.mode}`)
                            ? t(`transportModes.${leg.mode}`)
                            : leg.mode === "road"
                              ? t("suggestedRoute.road")
                              : t("suggestedRoute.sea")}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto p-0"
                    onClick={() => {
                      const timestamp = Date.now();

                      onChange({
                        transportLegs: displaySuggestedRoute.legs.map((leg, index) => ({
                          id: `leg-${timestamp}-${index + 1}`,
                          mode: leg.mode,
                          estimatedDistance: leg.estimatedDistance
                        }))
                      });
                    }}
                  >
                    {t("suggestedRoute.apply")}
                  </Button>
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
