import {
  fetchRoadRoute,
  type FetchRoadRouteOptions,
  type RoadRouteFailureReason,
  type RoutePoint
} from "@/lib/roadRouting";
import { type RouteHub, type RouteHubKind, VIETNAM_TRANSFER_HUBS } from "./routeHubs";
import { type AddressInput, TRANSPORT_MODES, type TransportLeg } from "./types";

export type SuggestedRoute = {
  longHaulMode: TransportLeg["mode"];
  legs: Array<{
    mode: TransportLeg["mode"];
    estimatedDistance?: number;
    routeResolved?: boolean;
  }>;
};

export type SuggestedRoadLegFailure = {
  legIndex: number;
  reason: RoadRouteFailureReason;
};

export type SuggestedRouteResolution = {
  roadFailures: SuggestedRoadLegFailure[];
  route: SuggestedRoute;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
};

export interface DomesticRouteContext {
  origin: AddressInput;
  destination: AddressInput;
}

interface DomesticRouteMetrics {
  carbonKg: number;
  etaHours: number;
  totalDistanceKm: number;
}

type RoadDistanceResolution = {
  distanceKm?: number;
  failureReason?: RoadRouteFailureReason;
  resolvedDestination?: RoutePoint;
  resolvedOrigin?: RoutePoint;
};

interface DomesticRouteCandidate extends DomesticRouteMetrics {
  longHaulMode: TransportLeg["mode"];
  legs: SuggestedRoute["legs"];
  legCount: number;
  roadFailures: SuggestedRoadLegFailure[];
  score: number;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
}

interface DomesticRouteScore {
  carbonRatio: number;
  distanceRatio: number;
  timeRatio: number;
  transferRatio: number;
  total: number;
}

type DomesticIntermodalMode = Exclude<TransportLeg["mode"], "road">;

type IntermodalModeConfig = {
  kind: RouteHubKind;
  maxFeederKm: number;
  minDirectRoadKm: number;
  minLineHaulKm: number;
  linehaulMultiplier: number;
  handlingHours: number;
  speedKmPerHour: number;
};

type RankedHub = {
  distanceKm: number;
  hub: RouteHub;
};

type RankedHubPair = {
  heuristicTotalKm: number;
  lineHaulDistanceKm: number;
  destinationHub: RouteHub;
  originHub: RouteHub;
};

const ROAD_FALLBACK_DISTANCE_KM = 500;
const ROAD_LOCALITY_FALLBACK_DISTANCE_KM = 80;
const ROAD_FALLBACK_MULTIPLIER = 1.18;
const ROAD_SPEED_KM_PER_HOUR = 45;

const DOMESTIC_INTERMODAL_MODE_CONFIG: Record<DomesticIntermodalMode, IntermodalModeConfig> = {
  rail: {
    kind: "rail_terminal",
    maxFeederKm: 120,
    minDirectRoadKm: 300,
    minLineHaulKm: 120,
    linehaulMultiplier: 1.12,
    handlingHours: 6,
    speedKmPerHour: 60
  },
  sea: {
    kind: "port",
    maxFeederKm: 150,
    minDirectRoadKm: 700,
    minLineHaulKm: 300,
    linehaulMultiplier: 1.3,
    handlingHours: 12,
    speedKmPerHour: 28
  },
  air: {
    kind: "airport",
    maxFeederKm: 100,
    minDirectRoadKm: 900,
    minLineHaulKm: 350,
    linehaulMultiplier: 1.05,
    handlingHours: 8,
    speedKmPerHour: 700
  }
};

const TRANSPORT_MODE_FACTORS = TRANSPORT_MODES.reduce<Record<TransportLeg["mode"], number>>(
  (accumulator, mode) => {
    accumulator[mode.value as TransportLeg["mode"]] = mode.co2Factor;
    return accumulator;
  },
  {
    air: 0,
    rail: 0,
    road: 0,
    sea: 0
  }
);

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

const normalizeToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const roundDistanceKm = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 10) / 10;

const clampDistanceKm = (value: number, minimum = 10) =>
  roundDistanceKm(Math.max(minimum, value));

const isResolvedRoadLeg = (leg: SuggestedRoute["legs"][number]) =>
  leg.mode !== "road" || (leg.routeResolved === true && hasPositiveDistance(leg.estimatedDistance));

const mapHubKindToRoadPointSource = (
  kind: RouteHubKind
): FetchRoadRouteOptions["originSource"] => {
  switch (kind) {
    case "airport":
      return "hub_airport";
    case "port":
      return "hub_port";
    case "rail_terminal":
      return "hub_rail_terminal";
    default:
      return undefined;
  }
};

const toRoutePoint = (address: AddressInput): RoutePoint | null =>
  isFiniteNumber(address.lat) && isFiniteNumber(address.lng) ?
    {
      lat: address.lat,
      lng: address.lng
    } :
    null;

const calculatePointDistanceKm = (origin: RoutePoint, destination: RoutePoint) =>
  calculateGreatCircleDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);

const applyRoadFallbackDistance = (distanceKm: number) =>
  clampDistanceKm(distanceKm * ROAD_FALLBACK_MULTIPLIER);

const resolveLocalityToken = (address: AddressInput) =>
  normalizeToken(address.stateRegion || address.city);

const hasMatchingLocality = (origin: AddressInput, destination: AddressInput) => {
  const originLocality = resolveLocalityToken(origin);
  const destinationLocality = resolveLocalityToken(destination);
  return Boolean(originLocality) && originLocality === destinationLocality;
};

const estimateFallbackRoadDistanceKm = (
  origin: AddressInput,
  destination: AddressInput
) => {
  const originPoint = toRoutePoint(origin);
  const destinationPoint = toRoutePoint(destination);
  if (originPoint && destinationPoint) {
    return applyRoadFallbackDistance(calculatePointDistanceKm(originPoint, destinationPoint));
  }

  return hasMatchingLocality(origin, destination) ?
    ROAD_LOCALITY_FALLBACK_DISTANCE_KM :
    ROAD_FALLBACK_DISTANCE_KM;
};

const resolveRoadDistanceKm = async (
  origin: RoutePoint,
  destination: RoutePoint,
  options: FetchRoadRouteOptions = {}
): Promise<RoadDistanceResolution> => {
  const routeResolution = await fetchRoadRoute(origin, destination, options);
  if (routeResolution.ok) {
    return {
      distanceKm: clampDistanceKm(routeResolution.route.distanceKm),
      resolvedDestination: routeResolution.route.resolvedDestination,
      resolvedOrigin: routeResolution.route.resolvedOrigin
    };
  }

  return {
    failureReason: routeResolution.failureReason
  };
};

const findNearestHubs = (
  point: RoutePoint,
  kind: RouteHubKind,
  limit = 2
): RankedHub[] =>
  VIETNAM_TRANSFER_HUBS
    .filter((hub) => hub.kind === kind)
    .map((hub) => ({
      hub,
      distanceKm: calculateGreatCircleDistanceKm(point.lat, point.lng, hub.lat, hub.lng)
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, limit);

const buildRouteMetrics = (
  legs: SuggestedRoute["legs"],
  longHaulMode: TransportLeg["mode"]
): DomesticRouteMetrics => {
  let carbonKg = 0;
  let etaHours = 0;

  for (const leg of legs) {
    const distanceKm = hasPositiveDistance(leg.estimatedDistance) ? leg.estimatedDistance : 0;
    const speedKmPerHour = leg.mode === "road" ?
      ROAD_SPEED_KM_PER_HOUR :
      DOMESTIC_INTERMODAL_MODE_CONFIG[leg.mode].speedKmPerHour;
    carbonKg += distanceKm * (TRANSPORT_MODE_FACTORS[leg.mode] || 0);
    etaHours += distanceKm / speedKmPerHour;
  }

  if (longHaulMode !== "road") {
    etaHours += DOMESTIC_INTERMODAL_MODE_CONFIG[longHaulMode].handlingHours;
  }

  return {
    carbonKg,
    etaHours,
    totalDistanceKm: legs.reduce(
      (sum, leg) => sum + (hasPositiveDistance(leg.estimatedDistance) ? leg.estimatedDistance : 0),
      0
    )
  };
};

const buildCandidate = (
  longHaulMode: TransportLeg["mode"],
  legs: SuggestedRoute["legs"],
  options: {
    roadFailures?: SuggestedRoadLegFailure[];
    snappedDestination?: RoutePoint;
    snappedOrigin?: RoutePoint;
  } = {}
): DomesticRouteCandidate => {
  const normalizedLegs = legs.map((leg) => ({
    mode: leg.mode,
    estimatedDistance:
      hasPositiveDistance(leg.estimatedDistance) ?
        clampDistanceKm(leg.estimatedDistance) :
        undefined,
    routeResolved: leg.mode === "road" ? leg.routeResolved === true : undefined
  }));
  const metrics = buildRouteMetrics(normalizedLegs, longHaulMode);

  return {
    ...metrics,
    longHaulMode,
    legs: normalizedLegs,
    legCount: normalizedLegs.length,
    roadFailures: options.roadFailures || [],
    score: Number.POSITIVE_INFINITY,
    snappedDestination: options.snappedDestination,
    snappedOrigin: options.snappedOrigin
  };
};

const candidateToSuggestedRouteResolution = (
  candidate: DomesticRouteCandidate
): SuggestedRouteResolution => ({
  roadFailures: candidate.roadFailures,
  route: {
    longHaulMode: candidate.longHaulMode,
    legs: candidate.legs
  },
  snappedDestination: candidate.snappedDestination,
  snappedOrigin: candidate.snappedOrigin
});

const scoreCandidate = (
  candidate: DomesticRouteCandidate,
  roadBaseline: DomesticRouteCandidate
) => {
  if (candidate.legs.some((leg) => !isResolvedRoadLeg(leg))) {
    candidate.score = Number.POSITIVE_INFINITY;

    return {
      carbonRatio: Number.POSITIVE_INFINITY,
      distanceRatio: Number.POSITIVE_INFINITY,
      timeRatio: Number.POSITIVE_INFINITY,
      transferRatio: Number.POSITIVE_INFINITY,
      total: Number.POSITIVE_INFINITY
    };
  }

  const baselineCarbon = Math.max(roadBaseline.carbonKg, 0.001);
  const baselineDistance = Math.max(roadBaseline.totalDistanceKm, 1);
  const baselineEta = Math.max(roadBaseline.etaHours, 0.001);
  const transferRatio = Math.max(0, (candidate.legCount - 1) / 2);
  const score: DomesticRouteScore = {
    carbonRatio: candidate.carbonKg / baselineCarbon,
    distanceRatio: candidate.totalDistanceKm / baselineDistance,
    timeRatio: candidate.etaHours / baselineEta,
    transferRatio,
    total:
      0.45 * (candidate.carbonKg / baselineCarbon) +
      0.25 * (candidate.etaHours / baselineEta) +
      0.2 * (candidate.totalDistanceKm / baselineDistance) +
      0.1 * transferRatio
  };

  candidate.score = score.total;

  return score;
};

const compareCandidates = (left: DomesticRouteCandidate, right: DomesticRouteCandidate) => {
  const leftHasUnresolvedRoadLeg = left.legs.some((leg) => !isResolvedRoadLeg(leg));
  const rightHasUnresolvedRoadLeg = right.legs.some((leg) => !isResolvedRoadLeg(leg));

  if (leftHasUnresolvedRoadLeg !== rightHasUnresolvedRoadLeg) {
    return leftHasUnresolvedRoadLeg ? 1 : -1;
  }
  if (left.score !== right.score) {
    return left.score - right.score;
  }
  if (left.carbonKg !== right.carbonKg) {
    return left.carbonKg - right.carbonKg;
  }
  if (left.legCount !== right.legCount) {
    return left.legCount - right.legCount;
  }
  return left.totalDistanceKm - right.totalDistanceKm;
};

const buildRoadOnlyCandidate = async (
  context: DomesticRouteContext,
  options: FetchRoadRouteOptions = {}
) => {
  const originPoint = toRoutePoint(context.origin);
  const destinationPoint = toRoutePoint(context.destination);

  if (!originPoint || !destinationPoint) {
    return buildCandidate("road", [
      {
        mode: "road",
        estimatedDistance: undefined,
        routeResolved: false
      }
    ], {
      roadFailures: [{ legIndex: 0, reason: "invalid_coordinates" }]
    });
  }

  const roadResolution = await resolveRoadDistanceKm(originPoint, destinationPoint, options);

  return buildCandidate(
    "road",
    [
      {
        mode: "road",
        estimatedDistance: roadResolution.distanceKm,
        routeResolved: hasPositiveDistance(roadResolution.distanceKm)
      }
    ],
    {
      roadFailures: roadResolution.failureReason ?
        [{ legIndex: 0, reason: roadResolution.failureReason }] :
        [],
      snappedDestination: roadResolution.resolvedDestination,
      snappedOrigin: roadResolution.resolvedOrigin
    }
  );
};

const findBestHubPair = (
  mode: DomesticIntermodalMode,
  originPoint: RoutePoint,
  destinationPoint: RoutePoint
): RankedHubPair | null => {
  const config = DOMESTIC_INTERMODAL_MODE_CONFIG[mode];
  const originHubs = findNearestHubs(originPoint, config.kind, 2);
  const destinationHubs = findNearestHubs(destinationPoint, config.kind, 2);

  let bestPair: RankedHubPair | null = null;

  for (const originHub of originHubs) {
    if (originHub.distanceKm > config.maxFeederKm) continue;

    for (const destinationHub of destinationHubs) {
      if (destinationHub.distanceKm > config.maxFeederKm) continue;
      if (originHub.hub.id === destinationHub.hub.id) continue;

      const lineHaulGreatCircleKm = calculateGreatCircleDistanceKm(
        originHub.hub.lat,
        originHub.hub.lng,
        destinationHub.hub.lat,
        destinationHub.hub.lng
      );

      if (lineHaulGreatCircleKm < config.minLineHaulKm) continue;

      const lineHaulDistanceKm = clampDistanceKm(
        lineHaulGreatCircleKm * config.linehaulMultiplier
      );
      const heuristicTotalKm =
        originHub.distanceKm + lineHaulDistanceKm + destinationHub.distanceKm;

      if (!bestPair || heuristicTotalKm < bestPair.heuristicTotalKm) {
        bestPair = {
          heuristicTotalKm,
          lineHaulDistanceKm,
          destinationHub: destinationHub.hub,
          originHub: originHub.hub
        };
      }
    }
  }

  return bestPair;
};

const buildIntermodalCandidate = async (
  context: DomesticRouteContext,
  mode: DomesticIntermodalMode,
  directRoadDistanceKm: number,
  options: FetchRoadRouteOptions = {}
) => {
  const config = DOMESTIC_INTERMODAL_MODE_CONFIG[mode];
  if (directRoadDistanceKm < config.minDirectRoadKm) {
    return null;
  }

  const originPoint = toRoutePoint(context.origin);
  const destinationPoint = toRoutePoint(context.destination);

  if (!originPoint || !destinationPoint) {
    return null;
  }

  const bestPair = findBestHubPair(mode, originPoint, destinationPoint);
  if (!bestPair) {
    return null;
  }

  const [firstFeederResolution, lastFeederResolution] = await Promise.all([
    resolveRoadDistanceKm(
      originPoint,
      {
        lat: bestPair.originHub.lat,
        lng: bestPair.originHub.lng
      },
      {
        originSource: options.originSource
        ,
        destinationSource: mapHubKindToRoadPointSource(bestPair.originHub.kind)
      }
    ),
    resolveRoadDistanceKm(
      {
        lat: bestPair.destinationHub.lat,
        lng: bestPair.destinationHub.lng
      },
      destinationPoint,
      {
        originSource: mapHubKindToRoadPointSource(bestPair.destinationHub.kind),
        destinationSource: options.destinationSource
      }
    )
  ]);

  if (
    !hasPositiveDistance(firstFeederResolution.distanceKm) ||
    !hasPositiveDistance(lastFeederResolution.distanceKm) ||
    firstFeederResolution.distanceKm > config.maxFeederKm ||
    lastFeederResolution.distanceKm > config.maxFeederKm
  ) {
    return null;
  }

  return buildCandidate(
    mode,
    [
      {
        mode: "road",
        estimatedDistance: firstFeederResolution.distanceKm,
        routeResolved: true
      },
      {
        mode,
        estimatedDistance: bestPair.lineHaulDistanceKm
      },
      {
        mode: "road",
        estimatedDistance: lastFeederResolution.distanceKm,
        routeResolved: true
      }
    ],
    {
      roadFailures: [
        firstFeederResolution.failureReason ?
          { legIndex: 0, reason: firstFeederResolution.failureReason } :
          null,
        lastFeederResolution.failureReason ?
          { legIndex: 2, reason: lastFeederResolution.failureReason } :
          null
      ].filter((failure): failure is SuggestedRoadLegFailure => Boolean(failure)),
      snappedDestination: lastFeederResolution.resolvedDestination,
      snappedOrigin: firstFeederResolution.resolvedOrigin
    }
  );
};

export const buildDomesticFallbackRoute = (
  context: DomesticRouteContext
): SuggestedRoute => {
  void context;

  return {
    longHaulMode: "road",
    legs: [
      {
        mode: "road",
        estimatedDistance: undefined,
        routeResolved: false
      }
    ]
  };
};

export const resolveDomesticSuggestedRoute = async (
  context: DomesticRouteContext,
  options: FetchRoadRouteOptions = {}
): Promise<SuggestedRouteResolution> => {
  const roadCandidate = await buildRoadOnlyCandidate(context, options);
  const directRoadDistanceForSelection =
    roadCandidate.totalDistanceKm > 0 ?
      roadCandidate.totalDistanceKm :
      estimateFallbackRoadDistanceKm(context.origin, context.destination);
  const roadBaselineForScoring =
    roadCandidate.totalDistanceKm > 0 ?
      roadCandidate :
      buildCandidate("road", [
        {
          mode: "road",
          estimatedDistance: estimateFallbackRoadDistanceKm(context.origin, context.destination),
          routeResolved: false
        }
      ]);

  if (hasMatchingLocality(context.origin, context.destination)) {
    return candidateToSuggestedRouteResolution(roadCandidate);
  }

  if (roadCandidate.totalDistanceKm < 250) {
    return candidateToSuggestedRouteResolution(roadCandidate);
  }

  const [railCandidate, seaCandidate, airCandidate] = await Promise.all([
    buildIntermodalCandidate(context, "rail", directRoadDistanceForSelection, options),
    buildIntermodalCandidate(context, "sea", directRoadDistanceForSelection, options),
    buildIntermodalCandidate(context, "air", directRoadDistanceForSelection, options)
  ]);

  const scoredCandidates = [roadCandidate, railCandidate, seaCandidate, airCandidate]
    .filter((candidate): candidate is DomesticRouteCandidate => Boolean(candidate));

  scoreCandidate(roadCandidate, roadBaselineForScoring);
  let bestCandidate = roadCandidate;

  for (const candidate of scoredCandidates.slice(1)) {
    scoreCandidate(candidate, roadBaselineForScoring);

    if (compareCandidates(candidate, bestCandidate) < 0) {
      bestCandidate = candidate;
    }
  }

  return candidateToSuggestedRouteResolution(bestCandidate);
};
