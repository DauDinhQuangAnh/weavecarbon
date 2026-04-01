import {
  fetchRoadRoute,
  type FetchRoadRouteOptions,
  type RoadRouteFailureReason,
  type RoadRoutePointSource,
  type RoutePoint
} from "@/lib/roadRouting";
import { resolveRailRouteGeometry } from "@/lib/railRouting";
import { resolveSeaRouteGeometry } from "@/lib/seaRouting";
import {
  EXPORT_CORRIDORS,
  VIETNAM_TRANSFER_HUBS,
  getDestinationRouteHubsByMarket,
  getRouteHubById,
  type ExportCorridor,
  type RouteHub,
  type RouteMarketScope
} from "./routeHubs";
import { TRANSPORT_MODES, type AddressInput, type TransportLeg } from "./types";

export type SuggestedRoute = {
  longHaulMode: TransportLeg["mode"];
  legs: Array<{
    autoSuggested?: boolean;
    co2Kg?: number;
    distanceSource?: TransportLeg["distanceSource"];
    distanceStatus?: TransportLeg["distanceStatus"];
    emissionFactor?: number;
    estimatedDistance?: number;
    fromNode?: TransportLeg["fromNode"];
    geometry?: TransportLeg["geometry"];
    mode: TransportLeg["mode"];
    routeResolved?: boolean;
    segmentKind?: TransportLeg["segmentKind"];
    toNode?: TransportLeg["toNode"];
  }>;
};

export type SuggestedRoadLegFailure = {
  legIndex: number;
  reason: RoadRouteFailureReason;
};

export interface RouteCandidateMetrics {
  corridorIds: string[];
  etaHours: number;
  feederRoadKm: number;
  lineHaulDistanceKm: number;
  modeSwitchCount: number;
  reliabilityScore: number;
  totalCo2PerTonKg: number;
  totalDistanceKm: number;
  transferCount: number;
  unresolvedRoadSegments: number;
}

export interface RouteSuggestionExplanation {
  profile: "domestic" | "export";
  reasonCodes: string[];
  summary: string;
}

export interface RankedSuggestedRoute {
  explanation: RouteSuggestionExplanation;
  metrics: RouteCandidateMetrics;
  route: SuggestedRoute;
  score: number;
}

export interface RouteSuggestionResponse {
  alternatives: RankedSuggestedRoute[];
  recommended: RankedSuggestedRoute;
  roadFailures: SuggestedRoadLegFailure[];
  route: SuggestedRoute;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
  status: "fallback" | "resolved";
}

export type SuggestedRouteResolution = RouteSuggestionResponse;

export interface IntermodalPlanContext {
  destination: AddressInput;
  destinationMarket: string;
  origin: AddressInput;
}

export interface IntermodalPlanConstraints {
  autoSuggested?: boolean;
  requiredLongHaulMode?: TransportLeg["mode"];
}

export interface RouteSuggestionRequest {
  autoSuggested?: boolean;
  destination: AddressInput;
  destinationMarket: string;
  destinationSource?: RoadRoutePointSource;
  origin: AddressInput;
  originSource?: RoadRoutePointSource;
  requiredLongHaulMode?: TransportLeg["mode"];
}

type CandidateLeg = {
  co2Kg: number;
  corridorId?: string;
  distanceSource: NonNullable<TransportLeg["distanceSource"]>;
  distanceStatus: NonNullable<TransportLeg["distanceStatus"]>;
  emissionFactor: number;
  estimatedDistance: number;
  etaHours: number;
  feederSide?: "destination" | "origin";
  fromNode: NonNullable<TransportLeg["fromNode"]>;
  geometry?: TransportLeg["geometry"];
  id: string;
  mode: TransportLeg["mode"];
  roadFailureReason?: RoadRouteFailureReason;
  routeResolved: boolean;
  segmentKind: NonNullable<TransportLeg["segmentKind"]>;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
  toNode: NonNullable<TransportLeg["toNode"]>;
};

type RouteCandidate = {
  legs: CandidateLeg[];
  metrics: RouteCandidateMetrics;
  route: SuggestedRoute;
  routeKey: string;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
};

type AccessHubCandidate = {
  accessScore: number;
  hub: RouteHub;
  leg: CandidateLeg;
};

type DirectedCorridor = ExportCorridor & {
  directionKey: string;
  reverse: boolean;
  travelFromHubId: string;
  travelToHubId: string;
};

type CorridorTraversalStep = {
  corridor: DirectedCorridor;
  transferFromHubId?: string;
  transferToHubId?: string;
};

type DirectHubRole = "destination" | "origin";

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

const MODE_SPEED_KM_PER_HOUR: Record<TransportLeg["mode"], number> = {
  air: 700,
  rail: 60,
  road: 45,
  sea: 28
};

const DEFAULT_LINE_HAUL_HANDLING_HOURS: Record<TransportLeg["mode"], number> = {
  air: 8,
  rail: 12,
  road: 0,
  sea: 16
};

const DEFAULT_LINE_HAUL_DISTANCE_MULTIPLIER: Record<TransportLeg["mode"], number> = {
  air: 1.05,
  rail: 1.12,
  road: 1.18,
  sea: 1.18
};

const ROAD_FALLBACK_DISTANCE_MULTIPLIER = 1.18;
const DIRECT_AIR_MIN_DISTANCE_KM = 180;
const DIRECT_RAIL_MIN_DISTANCE_KM = 120;
const MAX_ACCESS_HUB_PREFILTER = 6;
const MAX_ACCESS_HUBS = 4;
const MAX_ACCESS_HUBS_PER_KIND = 2;
const MAX_CORRIDOR_COUNT = 3;
const MAX_ROUTE_LEG_COUNT = 6;
const MAX_CLUSTER_TRANSFER_DISTANCE_KM = 80;
const SNAP_FAR_DISTANCE_KM = 2;
const DOMESTIC_RAIL_MIN_DISTANCE_KM = 650;
const DOMESTIC_AIR_MIN_DISTANCE_KM = 900;
const DOMESTIC_MAX_RAIL_FEEDER_KM = 120;
const DOMESTIC_MAX_AIR_FEEDER_KM = 80;
const HUB_KIND_BY_MODE: Record<Exclude<TransportLeg["mode"], "road">, RouteHub["kind"]> = {
  air: "airport",
  rail: "rail_terminal",
  sea: "port"
};

const isFiniteNumber = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

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

const roundDistanceKm = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 10) / 10;

const roundMetric = (value: number) =>
  Math.round((value + Number.EPSILON) * 1000) / 1000;

const compareNumbers = (left: number, right: number, epsilon = 0.0001) => {
  if (Math.abs(left - right) <= epsilon) {
    return 0;
  }
  return left < right ? -1 : 1;
};

const normalizeMarketScope = (value: string | null | undefined): RouteMarketScope => {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "vietnam" ||
    normalized === "usa" ||
    normalized === "eu" ||
    normalized === "korea" ||
    normalized === "japan" ||
    normalized === "china" ||
    normalized === "other"
  ) {
    return normalized;
  }
  return "other";
};

const toRoutePoint = (address: AddressInput): RoutePoint | null =>
  isFiniteNumber(address.lat) && isFiniteNumber(address.lng) ?
    {
      lat: address.lat,
      lng: address.lng
    } :
    null;

const createHubNodeRef = (hubId: string) =>
  ({
    type: "hub",
    hubId
  }) satisfies NonNullable<TransportLeg["fromNode"]>;

const estimateRoadDistanceKm = (origin: RoutePoint, destination: RoutePoint) =>
  roundDistanceKm(
    Math.max(
      20,
      calculateGreatCircleDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng) *
        ROAD_FALLBACK_DISTANCE_MULTIPLIER
    )
  );

const buildRoadLegId = (
  fromNode: NonNullable<TransportLeg["fromNode"]>,
  toNode: NonNullable<TransportLeg["toNode"]>,
  segmentKind: NonNullable<TransportLeg["segmentKind"]>
) => `road:${segmentKind}:${fromNode.type}:${fromNode.hubId || ""}:${toNode.type}:${toNode.hubId || ""}`;

const buildLineHaulLegId = (mode: TransportLeg["mode"], corridorId: string) =>
  `${mode}:linehaul:${corridorId}`;

const buildRouteKey = (legs: CandidateLeg[]) =>
  legs
    .map((leg) =>
      [
        leg.mode,
        leg.segmentKind,
        leg.fromNode.type,
        leg.fromNode.hubId || "",
        leg.toNode.type,
        leg.toNode.hubId || "",
        leg.corridorId || "",
        leg.distanceStatus
      ].join(":")
    )
    .join("|");

const corridorMatchesMarket = (corridor: ExportCorridor, market: RouteMarketScope) =>
  corridor.marketScope.includes("global") ||
  corridor.marketScope.includes(market) ||
  (market === "vietnam" && corridor.marketScope.includes("vietnam"));

const buildDirectedCorridors = (market: RouteMarketScope) =>
  EXPORT_CORRIDORS.filter((corridor) => corridorMatchesMarket(corridor, market))
    .flatMap((corridor) => {
      const forward: DirectedCorridor = {
        ...corridor,
        directionKey: `${corridor.id}:forward`,
        reverse: false,
        travelFromHubId: corridor.fromHubId,
        travelToHubId: corridor.toHubId
      };

      if (!corridor.bidirectional) {
        return [forward];
      }

      const reverse: DirectedCorridor = {
        ...corridor,
        directionKey: `${corridor.id}:reverse`,
        reverse: true,
        travelFromHubId: corridor.toHubId,
        travelToHubId: corridor.fromHubId
      };

      return [forward, reverse];
    })
    .sort((left, right) => left.directionKey.localeCompare(right.directionKey));

const buildCorridorAdjacency = (corridors: DirectedCorridor[]) => {
  const adjacency = new Map<string, DirectedCorridor[]>();

  for (const corridor of corridors) {
    const current = adjacency.get(corridor.travelFromHubId) || [];
    current.push(corridor);
    adjacency.set(corridor.travelFromHubId, current);
  }

  for (const [hubId, items] of adjacency.entries()) {
    adjacency.set(
      hubId,
      [...items].sort((left, right) => left.directionKey.localeCompare(right.directionKey))
    );
  }

  return adjacency;
};

const sortHubsByDistance = (point: RoutePoint | null, hubs: RouteHub[]) =>
  [...hubs].sort((left, right) => {
    if (!point) {
      return left.id.localeCompare(right.id);
    }

    const leftDistance = calculateGreatCircleDistanceKm(point.lat, point.lng, left.lat, left.lng);
    const rightDistance = calculateGreatCircleDistanceKm(point.lat, point.lng, right.lat, right.lng);
    const byDistance = compareNumbers(leftDistance, rightDistance, 0.001);

    if (byDistance !== 0) {
      return byDistance;
    }

    return left.id.localeCompare(right.id);
  });

const isClusterTransferCandidate = (left: RouteHub, right: RouteHub) =>
  left.id !== right.id &&
  left.clusterId === right.clusterId &&
  calculateGreatCircleDistanceKm(left.lat, left.lng, right.lat, right.lng) <=
    MAX_CLUSTER_TRANSFER_DISTANCE_KM;

const countLongHaulModeSwitches = (modes: TransportLeg["mode"][]) => {
  let count = 0;

  for (let index = 1; index < modes.length; index += 1) {
    if (modes[index] !== modes[index - 1]) {
      count += 1;
    }
  }

  return count;
};

const routeMatchesRequiredLongHaulMode = (
  route: SuggestedRoute,
  requiredLongHaulMode: TransportLeg["mode"] | undefined
) => {
  if (!requiredLongHaulMode) {
    return true;
  }

  const nonRoadModes = route.legs.filter((leg) => leg.mode !== "road").map((leg) => leg.mode);
  if (requiredLongHaulMode === "road") {
    return nonRoadModes.length === 0;
  }

  return nonRoadModes.includes(requiredLongHaulMode);
};

const getFallbackLongHaulMode = (
  destinationMarket: RouteMarketScope,
  totalDistanceKm: number
): TransportLeg["mode"] => {
  if (destinationMarket === "vietnam") {
    return totalDistanceKm >= DOMESTIC_AIR_MIN_DISTANCE_KM ?
        "air" :
      totalDistanceKm >= DOMESTIC_RAIL_MIN_DISTANCE_KM ?
        "rail" :
        "road";
  }

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

const buildRoadLegFromResolution = (
  id: string,
  origin: RoutePoint,
  destination: RoutePoint,
  fromNode: NonNullable<TransportLeg["fromNode"]>,
  toNode: NonNullable<TransportLeg["toNode"]>,
  segmentKind: NonNullable<TransportLeg["segmentKind"]>,
  resolution:
    | Awaited<ReturnType<typeof fetchRoadRoute>>
    | {
        failureReason: RoadRouteFailureReason;
        ok: false;
      },
  feederSide?: "destination" | "origin"
): CandidateLeg => {
  const emissionFactor = TRANSPORT_MODE_FACTORS.road || 0;

  if ("ok" in resolution && resolution.ok) {
    const estimatedDistance = roundDistanceKm(resolution.route.distanceKm);
    return {
      id,
      mode: "road",
      segmentKind,
      fromNode,
      toNode,
      feederSide,
      estimatedDistance,
      geometry: resolution.route.geometry,
      distanceSource: "road_route",
      distanceStatus: "resolved",
      routeResolved: true,
      emissionFactor,
      co2Kg: roundMetric(estimatedDistance * emissionFactor),
      etaHours: roundMetric(resolution.route.durationMinutes / 60),
      snappedOrigin: resolution.route.resolvedOrigin,
      snappedDestination: resolution.route.resolvedDestination
    };
  }

  const estimatedDistance = estimateRoadDistanceKm(origin, destination);
  return {
    id,
    mode: "road",
    segmentKind,
    fromNode,
    toNode,
    feederSide,
    estimatedDistance,
    distanceSource: "road_route",
    distanceStatus: "estimated",
    routeResolved: false,
    emissionFactor,
    co2Kg: roundMetric(estimatedDistance * emissionFactor),
    etaHours: roundMetric(estimatedDistance / MODE_SPEED_KM_PER_HOUR.road),
    roadFailureReason: resolution.failureReason
  };
};

const buildPendingRoadLeg = (
  fromNode: NonNullable<TransportLeg["fromNode"]>,
  toNode: NonNullable<TransportLeg["toNode"]>,
  segmentKind: NonNullable<TransportLeg["segmentKind"]>,
  autoSuggested: boolean
): SuggestedRoute["legs"][number] => ({
  mode: "road",
  fromNode,
  toNode,
  autoSuggested,
  distanceSource: "road_route",
  distanceStatus: "pending",
  routeResolved: false,
  segmentKind
});

const resolveRoadLeg = async ({
  destination,
  destinationSource,
  feederSide,
  fromNode,
  id,
  origin,
  originSource,
  segmentKind,
  toNode
}: {
  destination: RoutePoint;
  destinationSource?: RoadRoutePointSource;
  feederSide?: "destination" | "origin";
  fromNode: NonNullable<TransportLeg["fromNode"]>;
  id: string;
  origin: RoutePoint;
  originSource?: RoadRoutePointSource;
  segmentKind: NonNullable<TransportLeg["segmentKind"]>;
  toNode: NonNullable<TransportLeg["toNode"]>;
}) => {
  const resolution = await fetchRoadRoute(origin, destination, {
    destinationSource,
    originSource
  });

  return buildRoadLegFromResolution(
    id,
    origin,
    destination,
    fromNode,
    toNode,
    segmentKind,
    resolution,
    feederSide
  );
};

const buildStraightAirGeometry = (origin: RoutePoint, destination: RoutePoint): TransportLeg["geometry"] => [
  [origin.lng, origin.lat],
  [destination.lng, destination.lat]
];

const buildCorridorLineHaulLeg = (
  corridor: DirectedCorridor,
  fromHub: RouteHub,
  toHub: RouteHub
): CandidateLeg | null => {
  const fromNode = createHubNodeRef(fromHub.id);
  const toNode = createHubNodeRef(toHub.id);
  const emissionFactor = TRANSPORT_MODE_FACTORS[corridor.mode] || 0;
  const distanceMultiplier =
    corridor.distanceMultiplier || DEFAULT_LINE_HAUL_DISTANCE_MULTIPLIER[corridor.mode];
  const handlingHours = corridor.handlingHours || DEFAULT_LINE_HAUL_HANDLING_HOURS[corridor.mode];

  if (corridor.mode === "air") {
    const baseDistanceKm = calculateGreatCircleDistanceKm(
      fromHub.lat,
      fromHub.lng,
      toHub.lat,
      toHub.lng
    );

    if (baseDistanceKm < DIRECT_AIR_MIN_DISTANCE_KM) {
      return null;
    }

    const estimatedDistance = roundDistanceKm(baseDistanceKm * distanceMultiplier);
    return {
      id: buildLineHaulLegId("air", corridor.directionKey),
      corridorId: corridor.id,
      mode: "air",
      segmentKind: "line_haul",
      fromNode,
      toNode,
      estimatedDistance,
      geometry: buildStraightAirGeometry(
        { lat: fromHub.lat, lng: fromHub.lng },
        { lat: toHub.lat, lng: toHub.lng }
      ),
      distanceSource: "air_gc",
      distanceStatus: "resolved",
      routeResolved: true,
      emissionFactor,
      co2Kg: roundMetric(estimatedDistance * emissionFactor),
      etaHours: roundMetric(estimatedDistance / MODE_SPEED_KM_PER_HOUR.air + handlingHours)
    };
  }

  if (corridor.mode === "sea") {
    const resolved = resolveSeaRouteGeometry({
      origin: { lat: fromHub.lat, lng: fromHub.lng },
      destination: { lat: toHub.lat, lng: toHub.lng },
      originType: fromHub.kind,
      destinationType: toHub.kind
    });

    if (!resolved) {
      return null;
    }

    const estimatedDistance = roundDistanceKm(resolved.distanceKm * distanceMultiplier);
    return {
      id: buildLineHaulLegId("sea", corridor.directionKey),
      corridorId: corridor.id,
      mode: "sea",
      segmentKind: "line_haul",
      fromNode,
      toNode,
      estimatedDistance,
      geometry: resolved.geometry,
      distanceSource: "sea_graph",
      distanceStatus: "resolved",
      routeResolved: true,
      emissionFactor,
      co2Kg: roundMetric(estimatedDistance * emissionFactor),
      etaHours: roundMetric(estimatedDistance / MODE_SPEED_KM_PER_HOUR.sea + handlingHours)
    };
  }

  if (corridor.mode === "rail") {
    const resolved = resolveRailRouteGeometry({
      origin: { lat: fromHub.lat, lng: fromHub.lng },
      destination: { lat: toHub.lat, lng: toHub.lng },
      originType: fromHub.kind,
      destinationType: toHub.kind
    });

    if (!resolved || resolved.distanceKm < DIRECT_RAIL_MIN_DISTANCE_KM) {
      return null;
    }

    const estimatedDistance = roundDistanceKm(resolved.distanceKm * distanceMultiplier);
    return {
      id: buildLineHaulLegId("rail", corridor.directionKey),
      corridorId: corridor.id,
      mode: "rail",
      segmentKind: "line_haul",
      fromNode,
      toNode,
      estimatedDistance,
      geometry: resolved.geometry,
      distanceSource: "rail_graph",
      distanceStatus: "resolved",
      routeResolved: true,
      emissionFactor,
      co2Kg: roundMetric(estimatedDistance * emissionFactor),
      etaHours: roundMetric(estimatedDistance / MODE_SPEED_KM_PER_HOUR.rail + handlingHours)
    };
  }

  return null;
};

const buildDomesticLineHaulLeg = (
  mode: Extract<TransportLeg["mode"], "air" | "rail">,
  originHub: RouteHub,
  destinationHub: RouteHub
): CandidateLeg | null => {
  const pseudoCorridor: DirectedCorridor = {
    id: `domestic-${mode}-${originHub.id}-${destinationHub.id}`,
    mode,
    fromHubId: originHub.id,
    toHubId: destinationHub.id,
    bidirectional: true,
    marketScope: ["vietnam"],
    distanceMultiplier: DEFAULT_LINE_HAUL_DISTANCE_MULTIPLIER[mode],
    handlingHours: DEFAULT_LINE_HAUL_HANDLING_HOURS[mode],
    directionKey: `domestic-${mode}-${originHub.id}-${destinationHub.id}:forward`,
    reverse: false,
    travelFromHubId: originHub.id,
    travelToHubId: destinationHub.id
  };

  return buildCorridorLineHaulLeg(pseudoCorridor, originHub, destinationHub);
};

const getSnappedFarPenalty = (sourcePoint: RoutePoint, snappedPoint: RoutePoint | undefined) =>
  snappedPoint &&
  compareNumbers(
    calculateGreatCircleDistanceKm(sourcePoint.lat, sourcePoint.lng, snappedPoint.lat, snappedPoint.lng),
    SNAP_FAR_DISTANCE_KM,
    0.01
  ) > 0;

const sortAndLimitAccessHubs = (candidates: AccessHubCandidate[]) => {
  const countsByKind = new Map<RouteHub["kind"], number>();
  const result: AccessHubCandidate[] = [];

  for (const candidate of [...candidates].sort((left, right) => {
    const byScore = compareNumbers(left.accessScore, right.accessScore, 0.001);
    if (byScore !== 0) {
      return byScore;
    }

    const byDistance = compareNumbers(left.leg.estimatedDistance, right.leg.estimatedDistance, 0.001);
    if (byDistance !== 0) {
      return byDistance;
    }

    return left.hub.id.localeCompare(right.hub.id);
  })) {
    const currentCount = countsByKind.get(candidate.hub.kind) || 0;
    if (currentCount >= MAX_ACCESS_HUBS_PER_KIND) {
      continue;
    }

    result.push(candidate);
    countsByKind.set(candidate.hub.kind, currentCount + 1);
    if (result.length >= MAX_ACCESS_HUBS) {
      break;
    }
  }

  return result;
};

const resolveAccessHubs = async ({
  directHubIds,
  hubPool,
  point,
  pointSource,
  role
}: {
  directHubIds: Set<string>;
  hubPool: RouteHub[];
  point: RoutePoint | null;
  pointSource?: RoadRoutePointSource;
  role: DirectHubRole;
}) => {
  if (!point || hubPool.length === 0) {
    return [];
  }

  const topHubs = sortHubsByDistance(point, hubPool).slice(0, MAX_ACCESS_HUB_PREFILTER);
  const candidates = await Promise.all(
    topHubs.map(async (hub) => {
      const hubPoint = { lat: hub.lat, lng: hub.lng };
      const leg =
        role === "origin" ?
          await resolveRoadLeg({
            id: buildRoadLegId({ type: "origin_address" }, createHubNodeRef(hub.id), "feeder"),
            origin: point,
            destination: hubPoint,
            originSource: pointSource,
            destinationSource:
              hub.kind === "airport" ? "hub_airport" :
              hub.kind === "port" ? "hub_port" :
                "hub_rail_terminal",
            fromNode: { type: "origin_address" },
            toNode: createHubNodeRef(hub.id),
            segmentKind: "feeder",
            feederSide: "origin"
          }) :
          await resolveRoadLeg({
            id: buildRoadLegId(createHubNodeRef(hub.id), { type: "destination_address" }, "feeder"),
            origin: hubPoint,
            destination: point,
            originSource:
              hub.kind === "airport" ? "hub_airport" :
              hub.kind === "port" ? "hub_port" :
                "hub_rail_terminal",
            destinationSource: pointSource,
            fromNode: createHubNodeRef(hub.id),
            toNode: { type: "destination_address" },
            segmentKind: "feeder",
            feederSide: "destination"
          });

      const snappedFar =
        role === "origin" ?
          getSnappedFarPenalty(point, leg.snappedOrigin) :
          getSnappedFarPenalty(point, leg.snappedDestination);
      const directPenalty = directHubIds.has(hub.id) ? 0 : 15;

      return {
        accessScore:
          leg.estimatedDistance +
          (leg.distanceStatus !== "resolved" ? 80 : 0) +
          (snappedFar ? 20 : 0) +
          directPenalty,
        hub,
        leg
      } satisfies AccessHubCandidate;
    })
  );

  return sortAndLimitAccessHubs(candidates);
};

const buildCandidateMetrics = (legs: CandidateLeg[]): RouteCandidateMetrics => {
  let totalDistanceKm = 0;
  let feederRoadKm = 0;
  let lineHaulDistanceKm = 0;
  let etaHours = 0;
  let totalCo2PerTonKg = 0;
  let transferCount = 0;
  let unresolvedRoadSegments = 0;
  let originFeederKm = 0;
  let destinationFeederKm = 0;
  const corridorIds: string[] = [];
  const lineHaulModes: TransportLeg["mode"][] = [];

  for (const leg of legs) {
    totalDistanceKm += leg.estimatedDistance;
    etaHours += leg.etaHours;
    totalCo2PerTonKg += leg.co2Kg;

    if (leg.segmentKind === "feeder") {
      feederRoadKm += leg.estimatedDistance;
      if (leg.feederSide === "origin") {
        originFeederKm += leg.estimatedDistance;
      }
      if (leg.feederSide === "destination") {
        destinationFeederKm += leg.estimatedDistance;
      }
    }

    if (leg.segmentKind === "line_haul") {
      lineHaulDistanceKm += leg.estimatedDistance;
      if (leg.mode !== "road") {
        lineHaulModes.push(leg.mode);
      }
      if (leg.corridorId && !corridorIds.includes(leg.corridorId)) {
        corridorIds.push(leg.corridorId);
      }
    }

    if (leg.segmentKind === "transfer") {
      transferCount += 1;
    }

    if (leg.mode === "road" && !leg.routeResolved) {
      unresolvedRoadSegments += 1;
    }
  }

  const modeSwitchCount = countLongHaulModeSwitches(lineHaulModes);
  const feederPenaltySides = [originFeederKm, destinationFeederKm].filter(
    (value) => compareNumbers(value, 150, 0.001) > 0
  ).length;
  const reliabilityScore = Math.max(
    0,
    1 -
      0.35 * unresolvedRoadSegments -
      0.1 * transferCount -
      0.08 * modeSwitchCount -
      0.05 * feederPenaltySides
  );

  return {
    corridorIds,
    etaHours: roundMetric(etaHours),
    feederRoadKm: roundDistanceKm(feederRoadKm),
    lineHaulDistanceKm: roundDistanceKm(lineHaulDistanceKm),
    modeSwitchCount,
    reliabilityScore: roundMetric(reliabilityScore),
    totalCo2PerTonKg: roundMetric(totalCo2PerTonKg),
    totalDistanceKm: roundDistanceKm(totalDistanceKm),
    transferCount,
    unresolvedRoadSegments
  };
};

const toSuggestedRoute = (legs: CandidateLeg[], autoSuggested: boolean): SuggestedRoute => {
  const firstNonRoadLeg = legs.find((leg) => leg.mode !== "road");
  return {
    longHaulMode: firstNonRoadLeg?.mode || "road",
    legs: legs.map((leg) => ({
      mode: leg.mode,
      estimatedDistance: leg.estimatedDistance,
      routeResolved: leg.routeResolved,
      fromNode: leg.fromNode,
      toNode: leg.toNode,
      autoSuggested,
      geometry: leg.geometry,
      distanceSource: leg.distanceSource,
      distanceStatus: leg.distanceStatus,
      segmentKind: leg.segmentKind,
      emissionFactor: leg.emissionFactor,
      co2Kg: leg.co2Kg
    }))
  };
};

const buildCandidate = (legs: CandidateLeg[], autoSuggested: boolean): RouteCandidate => {
  const metrics = buildCandidateMetrics(legs);
  const route = toSuggestedRoute(legs, autoSuggested);
  const snappedOrigin = legs.find((leg) => leg.snappedOrigin)?.snappedOrigin;
  const snappedDestination = legs.find((leg) => leg.snappedDestination)?.snappedDestination;

  return {
    legs,
    metrics,
    route,
    routeKey: buildRouteKey(legs),
    snappedDestination,
    snappedOrigin
  };
};

const buildReasonCodes = ({
  candidate,
  fastestEtaRouteKey,
  lowestCarbonRouteKey,
  profile,
  request
}: {
  candidate: RankedSuggestedRoute & { routeKey: string };
  fastestEtaRouteKey: string;
  lowestCarbonRouteKey: string;
  profile: "domestic" | "export";
  request: RouteSuggestionRequest;
}) => {
  const reasonCodes: string[] = [];
  const { metrics, route } = candidate;

  if (metrics.unresolvedRoadSegments === 0) {
    reasonCodes.push("resolved_all_road_legs");
  }
  if (candidate.route.legs.some((leg) => leg.segmentKind === "transfer")) {
    if (metrics.transferCount === 1) {
      reasonCodes.push("single_transshipment");
    }
  } else if (route.longHaulMode !== "road") {
    reasonCodes.push("direct_corridor");
  }
  if (compareNumbers(metrics.feederRoadKm, 150, 0.001) <= 0) {
    reasonCodes.push("short_feeder_access");
  }
  if (
    candidate.route.legs.filter((leg) => leg.segmentKind === "line_haul" && leg.mode !== "road").length > 0 &&
    metrics.modeSwitchCount === 0
  ) {
    reasonCodes.push("single_mode_linehaul");
  }
  if (lowestCarbonRouteKey === candidate.routeKey) {
    reasonCodes.push("lowest_carbon_on_frontier");
  }
  if (fastestEtaRouteKey === candidate.routeKey) {
    reasonCodes.push("fastest_eta_on_frontier");
  }
  if (request.requiredLongHaulMode && routeMatchesRequiredLongHaulMode(route, request.requiredLongHaulMode)) {
    reasonCodes.push(`forced_${request.requiredLongHaulMode}_mode`);
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push(profile === "domestic" ? "balanced_domestic_route" : "balanced_export_route");
  }

  return reasonCodes;
};

const buildExplanationSummary = (reasonCodes: string[]) => reasonCodes.join(", ");

const dominatesCandidate = (left: RouteCandidate, right: RouteCandidate) => {
  const leftValues = [
    left.metrics.unresolvedRoadSegments,
    left.metrics.totalCo2PerTonKg,
    left.metrics.etaHours,
    left.metrics.feederRoadKm,
    left.metrics.transferCount,
    left.metrics.modeSwitchCount
  ];
  const rightValues = [
    right.metrics.unresolvedRoadSegments,
    right.metrics.totalCo2PerTonKg,
    right.metrics.etaHours,
    right.metrics.feederRoadKm,
    right.metrics.transferCount,
    right.metrics.modeSwitchCount
  ];

  let strictlyBetter = false;

  for (let index = 0; index < leftValues.length; index += 1) {
    const comparison = compareNumbers(leftValues[index], rightValues[index], 0.001);
    if (comparison > 0) {
      return false;
    }
    if (comparison < 0) {
      strictlyBetter = true;
    }
  }

  return strictlyBetter;
};

const filterParetoFrontier = (candidates: RouteCandidate[]) =>
  candidates.filter((candidate, index) =>
    !candidates.some((other, otherIndex) => otherIndex !== index && dominatesCandidate(other, candidate))
  );

const normalizeMetricValue = (value: number, min: number, max: number) => {
  if (compareNumbers(max, min, 0.0001) === 0) {
    return 0;
  }
  return (value - min) / (max - min);
};

const rankCandidates = ({
  candidates,
  profile,
  request
}: {
  candidates: RouteCandidate[];
  profile: "domestic" | "export";
  request: RouteSuggestionRequest;
}) => {
  if (candidates.length === 0) {
    return [];
  }

  const winnerEligible =
    candidates.some((candidate) => candidate.metrics.unresolvedRoadSegments === 0) ?
      candidates.filter((candidate) => candidate.metrics.unresolvedRoadSegments === 0) :
      candidates;

  const frontier = filterParetoFrontier(winnerEligible);
  const scorePool = frontier.length > 0 ? frontier : winnerEligible;

  const metricRanges = {
    etaHours: {
      min: Math.min(...scorePool.map((candidate) => candidate.metrics.etaHours)),
      max: Math.max(...scorePool.map((candidate) => candidate.metrics.etaHours))
    },
    feederRoadKm: {
      min: Math.min(...scorePool.map((candidate) => candidate.metrics.feederRoadKm)),
      max: Math.max(...scorePool.map((candidate) => candidate.metrics.feederRoadKm))
    },
    totalCo2PerTonKg: {
      min: Math.min(...scorePool.map((candidate) => candidate.metrics.totalCo2PerTonKg)),
      max: Math.max(...scorePool.map((candidate) => candidate.metrics.totalCo2PerTonKg))
    },
    transferCount: {
      min: Math.min(...scorePool.map((candidate) => candidate.metrics.transferCount)),
      max: Math.max(...scorePool.map((candidate) => candidate.metrics.transferCount))
    },
    unreliability: {
      min: Math.min(...scorePool.map((candidate) => 1 - candidate.metrics.reliabilityScore)),
      max: Math.max(...scorePool.map((candidate) => 1 - candidate.metrics.reliabilityScore))
    }
  };

  const scored = scorePool.map((candidate) => {
    const normalizedCo2 = normalizeMetricValue(
      candidate.metrics.totalCo2PerTonKg,
      metricRanges.totalCo2PerTonKg.min,
      metricRanges.totalCo2PerTonKg.max
    );
    const normalizedEta = normalizeMetricValue(
      candidate.metrics.etaHours,
      metricRanges.etaHours.min,
      metricRanges.etaHours.max
    );
    const normalizedFeederRoadKm = normalizeMetricValue(
      candidate.metrics.feederRoadKm,
      metricRanges.feederRoadKm.min,
      metricRanges.feederRoadKm.max
    );
    const normalizedTransferCount = normalizeMetricValue(
      candidate.metrics.transferCount,
      metricRanges.transferCount.min,
      metricRanges.transferCount.max
    );
    const normalizedUnreliability = normalizeMetricValue(
      1 - candidate.metrics.reliabilityScore,
      metricRanges.unreliability.min,
      metricRanges.unreliability.max
    );

    const score =
      profile === "domestic" ?
        0.35 * normalizedEta +
        0.2 * normalizedCo2 +
        0.2 * normalizedFeederRoadKm +
        0.1 * normalizedTransferCount +
        0.15 * normalizedUnreliability +
        2 * candidate.metrics.unresolvedRoadSegments :
        0.3 * normalizedCo2 +
        0.2 * normalizedEta +
        0.2 * normalizedFeederRoadKm +
        0.15 * normalizedTransferCount +
        0.15 * normalizedUnreliability +
        2 * candidate.metrics.unresolvedRoadSegments;

    return {
      candidate,
      score: roundMetric(score)
    };
  });

  const lowestCarbonRouteKey = [...scored]
    .sort((left, right) => {
      const byCo2 = compareNumbers(left.candidate.metrics.totalCo2PerTonKg, right.candidate.metrics.totalCo2PerTonKg, 0.001);
      if (byCo2 !== 0) {
        return byCo2;
      }

      return left.candidate.routeKey.localeCompare(right.candidate.routeKey);
    })[0]?.candidate.routeKey || "";
  const fastestEtaRouteKey = [...scored]
    .sort((left, right) => {
      const byEta = compareNumbers(left.candidate.metrics.etaHours, right.candidate.metrics.etaHours, 0.001);
      if (byEta !== 0) {
        return byEta;
      }

      return left.candidate.routeKey.localeCompare(right.candidate.routeKey);
    })[0]?.candidate.routeKey || "";

  return scored
    .map(({ candidate, score }) => {
      const ranked: RankedSuggestedRoute & { routeKey: string } = {
        explanation: {
          profile,
          reasonCodes: [],
          summary: ""
        },
        metrics: candidate.metrics,
        route: candidate.route,
        routeKey: candidate.routeKey,
        score
      };

      const reasonCodes = buildReasonCodes({
        candidate: ranked,
        fastestEtaRouteKey,
        lowestCarbonRouteKey,
        profile,
        request
      });

      ranked.explanation = {
        profile,
        reasonCodes,
        summary: buildExplanationSummary(reasonCodes)
      };

      return ranked;
    })
    .sort((left, right) => {
      const byScore = compareNumbers(left.score, right.score, 0.001);
      if (byScore !== 0) {
        return byScore;
      }

      const byUnresolved = compareNumbers(left.metrics.unresolvedRoadSegments, right.metrics.unresolvedRoadSegments, 0.001);
      if (byUnresolved !== 0) {
        return byUnresolved;
      }

      const byCo2 = compareNumbers(left.metrics.totalCo2PerTonKg, right.metrics.totalCo2PerTonKg, 0.001);
      if (byCo2 !== 0) {
        return byCo2;
      }

      const byEta = compareNumbers(left.metrics.etaHours, right.metrics.etaHours, 0.001);
      if (byEta !== 0) {
        return byEta;
      }

      return left.routeKey.localeCompare(right.routeKey);
    });
};

const toResponseAlternatives = (
  rankedCandidates: Array<RankedSuggestedRoute & { routeKey: string }>
) => {
  if (rankedCandidates.length === 0) {
    return [];
  }

  const recommended = rankedCandidates[0];
  const alternatives: Array<RankedSuggestedRoute & { routeKey: string }> = [];
  const seen = new Set<string>([recommended.routeKey]);

  const pickDistinct = (items: Array<RankedSuggestedRoute & { routeKey: string }>) => {
    const next = items.find((candidate) => !seen.has(candidate.routeKey));
    if (!next) {
      return;
    }

    seen.add(next.routeKey);
    alternatives.push(next);
  };

  pickDistinct(
    [...rankedCandidates].sort((left, right) => {
      const byCo2 = compareNumbers(left.metrics.totalCo2PerTonKg, right.metrics.totalCo2PerTonKg, 0.001);
      if (byCo2 !== 0) {
        return byCo2;
      }
      return left.routeKey.localeCompare(right.routeKey);
    })
  );
  pickDistinct(
    [...rankedCandidates].sort((left, right) => {
      const byEta = compareNumbers(left.metrics.etaHours, right.metrics.etaHours, 0.001);
      if (byEta !== 0) {
        return byEta;
      }
      return left.routeKey.localeCompare(right.routeKey);
    })
  );

  return alternatives.map((candidate) => ({
    explanation: candidate.explanation,
    metrics: candidate.metrics,
    route: candidate.route,
    score: candidate.score
  }));
};

const buildRoadFailures = (legs: CandidateLeg[]) =>
  legs.flatMap((leg, index) =>
    leg.roadFailureReason ? [{ legIndex: index, reason: leg.roadFailureReason }] : []
  );

const buildFallbackRecommended = ({
  profile,
  reasonCodes,
  route
}: {
  profile: "domestic" | "export";
  reasonCodes: string[];
  route: SuggestedRoute;
}): RankedSuggestedRoute => ({
  explanation: {
    profile,
    reasonCodes,
    summary: buildExplanationSummary(reasonCodes)
  },
  metrics: {
    corridorIds: [],
    etaHours: roundMetric(
      route.legs.reduce(
        (sum, leg) =>
          sum +
          (isFiniteNumber(leg.estimatedDistance) ?
            leg.estimatedDistance / MODE_SPEED_KM_PER_HOUR[leg.mode] :
            0),
        0
      )
    ),
    feederRoadKm: roundDistanceKm(
      route.legs.reduce(
        (sum, leg) =>
          sum +
          (leg.segmentKind === "feeder" && isFiniteNumber(leg.estimatedDistance) ? leg.estimatedDistance : 0),
        0
      )
    ),
    lineHaulDistanceKm: roundDistanceKm(
      route.legs.reduce(
        (sum, leg) =>
          sum +
          (leg.segmentKind === "line_haul" && isFiniteNumber(leg.estimatedDistance) ? leg.estimatedDistance : 0),
        0
      )
    ),
    modeSwitchCount: 0,
    reliabilityScore: route.legs.some((leg) => leg.distanceStatus === "pending") ? 0.2 : 0.5,
    totalCo2PerTonKg: roundMetric(
      route.legs.reduce((sum, leg) => {
        const factor = TRANSPORT_MODE_FACTORS[leg.mode] || 0;
        return sum + (isFiniteNumber(leg.estimatedDistance) ? leg.estimatedDistance * factor : 0);
      }, 0)
    ),
    totalDistanceKm: roundDistanceKm(
      route.legs.reduce(
        (sum, leg) => sum + (isFiniteNumber(leg.estimatedDistance) ? leg.estimatedDistance : 0),
        0
      )
    ),
    transferCount: route.legs.filter((leg) => leg.segmentKind === "transfer").length,
    unresolvedRoadSegments: route.legs.filter(
      (leg) => leg.mode === "road" && leg.routeResolved !== true
    ).length
  },
  route,
  score: Number.POSITIVE_INFINITY
});

const buildFallbackRouteLineHaulLeg = ({
  corridor,
  destinationHub,
  originHub
}: {
  corridor: DirectedCorridor;
  destinationHub: RouteHub;
  originHub: RouteHub;
}) => {
  const resolved = buildCorridorLineHaulLeg(corridor, originHub, destinationHub);
  if (!resolved) {
    return null;
  }

  return {
    mode: resolved.mode,
    estimatedDistance: resolved.estimatedDistance,
    autoSuggested: true,
    fromNode: resolved.fromNode,
    toNode: resolved.toNode,
    geometry: resolved.geometry,
    distanceSource: resolved.distanceSource,
    distanceStatus: resolved.distanceStatus,
    routeResolved: resolved.routeResolved,
    segmentKind: resolved.segmentKind,
    emissionFactor: resolved.emissionFactor,
    co2Kg: resolved.co2Kg
  } satisfies SuggestedRoute["legs"][number];
};

const buildDomesticFallbackResponse = (
  request: RouteSuggestionRequest,
  reasonCodes: string[] = []
): RouteSuggestionResponse => {
  const autoSuggested = request.autoSuggested ?? true;
  const route: SuggestedRoute = {
    longHaulMode: "road",
    legs: [
      buildPendingRoadLeg(
        { type: "origin_address" },
        { type: "destination_address" },
        "line_haul",
        autoSuggested
      )
    ]
  };

  return {
    alternatives: [],
    recommended: buildFallbackRecommended({
      profile: "domestic",
      reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["fallback_domestic_route"],
      route
    }),
    roadFailures: [],
    route,
    status: "fallback"
  };
};

const buildExportFallbackResponse = (
  request: RouteSuggestionRequest,
  reasonCodes: string[] = []
): RouteSuggestionResponse => {
  const destinationMarket = normalizeMarketScope(request.destinationMarket);
  const autoSuggested = request.autoSuggested ?? true;
  const originPoint = toRoutePoint(request.origin);
  const destinationPoint = toRoutePoint(request.destination);
  const directDistanceKm =
    originPoint && destinationPoint ? estimateRoadDistanceKm(originPoint, destinationPoint) : 0;
  const preferredMode =
    request.requiredLongHaulMode || getFallbackLongHaulMode(destinationMarket, directDistanceKm);

  if (destinationMarket === "vietnam" || preferredMode === "road") {
    const route: SuggestedRoute = {
      longHaulMode: "road",
      legs: [
        buildPendingRoadLeg(
          { type: "origin_address" },
          { type: "destination_address" },
          "line_haul",
          autoSuggested
        )
      ]
    };

    return {
      alternatives: [],
      recommended: buildFallbackRecommended({
        profile: "export",
        reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["fallback_road_route"],
        route
      }),
      roadFailures: [],
      route,
      status: "fallback"
    };
  }

  const activeCorridors = buildDirectedCorridors(destinationMarket).filter(
    (corridor) => corridor.mode === preferredMode
  );
  const activeHubIds = new Set(activeCorridors.flatMap((corridor) => [
    corridor.travelFromHubId,
    corridor.travelToHubId
  ]));
  const requiredKind = HUB_KIND_BY_MODE[preferredMode as Exclude<TransportLeg["mode"], "road">];
  const originHub = sortHubsByDistance(
    originPoint,
    VIETNAM_TRANSFER_HUBS.filter((hub) => activeHubIds.has(hub.id) && hub.kind === requiredKind)
  )[0] || null;
  const destinationHub = sortHubsByDistance(
    destinationPoint,
    getDestinationRouteHubsByMarket(destinationMarket).filter(
      (hub) => activeHubIds.has(hub.id) && hub.kind === requiredKind
    )
  )[0] || null;
  const corridor =
    originHub && destinationHub ?
      activeCorridors.find(
        (candidate) =>
          candidate.travelFromHubId === originHub.id &&
          candidate.travelToHubId === destinationHub.id
      ) || null :
      null;
  const lineHaulLeg =
    corridor && originHub && destinationHub ?
      buildFallbackRouteLineHaulLeg({ corridor, destinationHub, originHub }) :
      null;

  if (!originHub || !destinationHub || !lineHaulLeg) {
    return buildExportFallbackResponse(
      {
        ...request,
        requiredLongHaulMode: "road"
      },
      reasonCodes.length > 0 ? reasonCodes : ["fallback_road_route"]
    );
  }

  const route: SuggestedRoute = {
    longHaulMode: preferredMode,
    legs: [
      buildPendingRoadLeg(
        { type: "origin_address" },
        createHubNodeRef(originHub.id),
        "feeder",
        autoSuggested
      ),
      {
        ...lineHaulLeg,
        autoSuggested
      },
      buildPendingRoadLeg(
        createHubNodeRef(destinationHub.id),
        { type: "destination_address" },
        "feeder",
        autoSuggested
      )
    ]
  };

  return {
    alternatives: [],
    recommended: buildFallbackRecommended({
      profile: "export",
      reasonCodes: reasonCodes.length > 0 ? reasonCodes : [`fallback_${preferredMode}_route`],
      route
    }),
    roadFailures: [],
    route,
    status: "fallback"
  };
};

const buildFallbackResponse = (
  request: RouteSuggestionRequest,
  reasonCodes: string[] = []
) =>
  normalizeMarketScope(request.destinationMarket) === "vietnam" ?
    buildDomesticFallbackResponse(request, reasonCodes) :
    buildExportFallbackResponse(request, reasonCodes);

const buildTransferLeg = async ({
  fromHub,
  toHub
}: {
  fromHub: RouteHub;
  toHub: RouteHub;
}) =>
  resolveRoadLeg({
    id: buildRoadLegId(createHubNodeRef(fromHub.id), createHubNodeRef(toHub.id), "transfer"),
    origin: { lat: fromHub.lat, lng: fromHub.lng },
    destination: { lat: toHub.lat, lng: toHub.lng },
    originSource:
      fromHub.kind === "airport" ? "hub_airport" :
      fromHub.kind === "port" ? "hub_port" :
        "hub_rail_terminal",
    destinationSource:
      toHub.kind === "airport" ? "hub_airport" :
      toHub.kind === "port" ? "hub_port" :
        "hub_rail_terminal",
    fromNode: createHubNodeRef(fromHub.id),
    toNode: createHubNodeRef(toHub.id),
    segmentKind: "transfer"
  });

const materializeExportCandidate = async ({
  autoSuggested,
  destinationAccess,
  originAccess,
  steps
}: {
  autoSuggested: boolean;
  destinationAccess: AccessHubCandidate;
  originAccess: AccessHubCandidate;
  steps: CorridorTraversalStep[];
}) => {
  if (steps.length === 0) {
    return null;
  }

  const legs: CandidateLeg[] = [originAccess.leg];
  let currentHub = originAccess.hub;

  for (const step of steps) {
    if (step.transferFromHubId && step.transferToHubId) {
      const transferFromHub = getRouteHubById(step.transferFromHubId);
      const transferToHub = getRouteHubById(step.transferToHubId);
      if (!transferFromHub || !transferToHub) {
        return null;
      }

      legs.push(await buildTransferLeg({ fromHub: transferFromHub, toHub: transferToHub }));
      currentHub = transferToHub;
    }

    const fromHub = getRouteHubById(step.corridor.travelFromHubId);
    const toHub = getRouteHubById(step.corridor.travelToHubId);
    if (!fromHub || !toHub || currentHub.id !== fromHub.id) {
      return null;
    }

    const lineHaulLeg = buildCorridorLineHaulLeg(step.corridor, fromHub, toHub);
    if (!lineHaulLeg) {
      return null;
    }

    legs.push(lineHaulLeg);
    currentHub = toHub;
  }

  if (currentHub.id !== destinationAccess.hub.id) {
    if (!isClusterTransferCandidate(currentHub, destinationAccess.hub)) {
      return null;
    }

    legs.push(await buildTransferLeg({ fromHub: currentHub, toHub: destinationAccess.hub }));
  }

  legs.push(destinationAccess.leg);
  if (legs.length > MAX_ROUTE_LEG_COUNT) {
    return null;
  }

  return buildCandidate(legs, autoSuggested);
};

const materializeDomesticCandidate = async ({
  autoSuggested,
  destinationAccess,
  lineHaulLeg,
  originAccess
}: {
  autoSuggested: boolean;
  destinationAccess: AccessHubCandidate;
  lineHaulLeg: CandidateLeg;
  originAccess: AccessHubCandidate;
}) => {
  const legs = [originAccess.leg, lineHaulLeg, destinationAccess.leg];
  if (legs.length > MAX_ROUTE_LEG_COUNT) {
    return null;
  }

  return buildCandidate(legs, autoSuggested);
};

const enumerateExportCorridorSteps = ({
  destinationAccessHubIds,
  directedCorridors,
  originAccessHubIds
}: {
  destinationAccessHubIds: Set<string>;
  directedCorridors: DirectedCorridor[];
  originAccessHubIds: Set<string>;
}) => {
  const adjacency = buildCorridorAdjacency(directedCorridors);
  const allHubIds = Array.from(
    new Set(
      directedCorridors.flatMap((corridor) => [corridor.travelFromHubId, corridor.travelToHubId])
    )
  ).sort((left, right) => left.localeCompare(right));
  const results: Array<{
    destinationHubId: string;
    originHubId: string;
    steps: CorridorTraversalStep[];
  }> = [];

  const walk = (
    originHubId: string,
    currentHubId: string,
    path: CorridorTraversalStep[],
    visitedHubIds: Set<string>,
    visitedDirectionKeys: Set<string>,
    transferCount: number
  ) => {
    if (path.length > 0 && destinationAccessHubIds.has(currentHubId)) {
      results.push({
        destinationHubId: currentHubId,
        originHubId,
        steps: path.map((step) => ({ ...step }))
      });
    }

    if (path.length >= MAX_CORRIDOR_COUNT) {
      return;
    }

    const transferStartHubIds = [currentHubId];
    if (transferCount < 2) {
      for (const nextHubId of allHubIds) {
        const currentHub = getRouteHubById(currentHubId);
        const nextHub = getRouteHubById(nextHubId);
        if (
          currentHub &&
          nextHub &&
          isClusterTransferCandidate(currentHub, nextHub) &&
          !visitedHubIds.has(nextHubId)
        ) {
          transferStartHubIds.push(nextHubId);
        }
      }
    }

    for (const transferStartHubId of transferStartHubIds.sort((left, right) => left.localeCompare(right))) {
      const outgoing = adjacency.get(transferStartHubId) || [];

      for (const corridor of outgoing) {
        if (visitedDirectionKeys.has(corridor.directionKey)) {
          continue;
        }
        if (visitedHubIds.has(corridor.travelToHubId)) {
          continue;
        }

        const nextPath = [
          ...path,
          {
            corridor,
            transferFromHubId: transferStartHubId !== currentHubId ? currentHubId : undefined,
            transferToHubId: transferStartHubId !== currentHubId ? transferStartHubId : undefined
          }
        ];
        const nextVisitedHubIds = new Set(visitedHubIds);
        nextVisitedHubIds.add(transferStartHubId);
        nextVisitedHubIds.add(corridor.travelToHubId);
        const nextVisitedDirectionKeys = new Set(visitedDirectionKeys);
        nextVisitedDirectionKeys.add(corridor.directionKey);

        walk(
          originHubId,
          corridor.travelToHubId,
          nextPath,
          nextVisitedHubIds,
          nextVisitedDirectionKeys,
          transferCount + (transferStartHubId !== currentHubId ? 1 : 0)
        );
      }
    }
  };

  for (const originHubId of [...originAccessHubIds].sort((left, right) => left.localeCompare(right))) {
    walk(originHubId, originHubId, [], new Set<string>([originHubId]), new Set<string>(), 0);
  }

  return results.sort((left, right) => {
    const leftKey = `${left.originHubId}:${left.destinationHubId}:${left.steps
      .map((step) => step.corridor.directionKey)
      .join("|")}`;
    const rightKey = `${right.originHubId}:${right.destinationHubId}:${right.steps
      .map((step) => step.corridor.directionKey)
      .join("|")}`;
    return leftKey.localeCompare(rightKey);
  });
};

const collectExportCandidates = async (request: RouteSuggestionRequest) => {
  const destinationMarket = normalizeMarketScope(request.destinationMarket);
  const originPoint = toRoutePoint(request.origin);
  const destinationPoint = toRoutePoint(request.destination);

  if (!originPoint || !destinationPoint) {
    return [];
  }

  const activeCorridors = buildDirectedCorridors(destinationMarket);
  if (activeCorridors.length === 0) {
    return [];
  }

  const activeHubIds = new Set(
    activeCorridors.flatMap((corridor) => [corridor.travelFromHubId, corridor.travelToHubId])
  );
  const originDirectHubIds = new Set(activeCorridors.map((corridor) => corridor.travelFromHubId));
  const destinationDirectHubIds = new Set(activeCorridors.map((corridor) => corridor.travelToHubId));
  const originHubPool = VIETNAM_TRANSFER_HUBS.filter((hub) => activeHubIds.has(hub.id));
  const destinationHubPool = getDestinationRouteHubsByMarket(destinationMarket).filter((hub) =>
    activeHubIds.has(hub.id)
  );

  const [originAccessHubs, destinationAccessHubs] = await Promise.all([
    resolveAccessHubs({
      directHubIds: originDirectHubIds,
      hubPool: originHubPool,
      point: originPoint,
      pointSource: request.originSource,
      role: "origin"
    }),
    resolveAccessHubs({
      directHubIds: destinationDirectHubIds,
      hubPool: destinationHubPool,
      point: destinationPoint,
      pointSource: request.destinationSource,
      role: "destination"
    })
  ]);

  if (originAccessHubs.length === 0 || destinationAccessHubs.length === 0) {
    return [];
  }

  const stepsByEndpoint = enumerateExportCorridorSteps({
    destinationAccessHubIds: new Set(destinationAccessHubs.map((candidate) => candidate.hub.id)),
    directedCorridors: activeCorridors,
    originAccessHubIds: new Set(originAccessHubs.map((candidate) => candidate.hub.id))
  });
  const originAccessByHubId = new Map(originAccessHubs.map((candidate) => [candidate.hub.id, candidate]));
  const destinationAccessByHubId = new Map(destinationAccessHubs.map((candidate) => [candidate.hub.id, candidate]));
  const candidates = await Promise.all(
    stepsByEndpoint.map(async (entry) => {
      const originAccess = originAccessByHubId.get(entry.originHubId);
      const destinationAccess = destinationAccessByHubId.get(entry.destinationHubId);
      if (!originAccess || !destinationAccess) {
        return null;
      }

      return materializeExportCandidate({
        autoSuggested: request.autoSuggested ?? true,
        destinationAccess,
        originAccess,
        steps: entry.steps
      });
    })
  );

  return candidates.filter((candidate): candidate is RouteCandidate => Boolean(candidate));
};

const collectDomesticCandidates = async (request: RouteSuggestionRequest) => {
  const originPoint = toRoutePoint(request.origin);
  const destinationPoint = toRoutePoint(request.destination);

  if (!originPoint || !destinationPoint) {
    return [];
  }

  const candidates: RouteCandidate[] = [];
  const autoSuggested = request.autoSuggested ?? true;

  const directRoadLeg = await resolveRoadLeg({
    id: buildRoadLegId({ type: "origin_address" }, { type: "destination_address" }, "line_haul"),
    origin: originPoint,
    destination: destinationPoint,
    originSource: request.originSource,
    destinationSource: request.destinationSource,
    fromNode: { type: "origin_address" },
    toNode: { type: "destination_address" },
    segmentKind: "line_haul"
  });
  candidates.push(buildCandidate([directRoadLeg], autoSuggested));

  const directRoadDistanceKm = directRoadLeg.estimatedDistance;
  const buildDomesticAccess = async (mode: Extract<TransportLeg["mode"], "air" | "rail">) => {
    const hubPool = VIETNAM_TRANSFER_HUBS.filter((hub) => hub.kind === HUB_KIND_BY_MODE[mode]);
    const directHubIds = new Set(hubPool.map((hub) => hub.id));

    return Promise.all([
      resolveAccessHubs({
        directHubIds,
        hubPool,
        point: originPoint,
        pointSource: request.originSource,
        role: "origin"
      }),
      resolveAccessHubs({
        directHubIds,
        hubPool,
        point: destinationPoint,
        pointSource: request.destinationSource,
        role: "destination"
      })
    ]);
  };

  if (compareNumbers(directRoadDistanceKm, DOMESTIC_RAIL_MIN_DISTANCE_KM, 0.001) > 0) {
    const [originRailAccessHubs, destinationRailAccessHubs] = await buildDomesticAccess("rail");
    const railCandidates = await Promise.all(
      originRailAccessHubs.slice(0, 2).flatMap((originAccess) =>
        destinationRailAccessHubs.slice(0, 2).map(async (destinationAccess) => {
          if (
            compareNumbers(originAccess.leg.estimatedDistance, DOMESTIC_MAX_RAIL_FEEDER_KM, 0.001) > 0 ||
            compareNumbers(destinationAccess.leg.estimatedDistance, DOMESTIC_MAX_RAIL_FEEDER_KM, 0.001) > 0 ||
            originAccess.hub.id === destinationAccess.hub.id
          ) {
            return null;
          }

          const lineHaulLeg = buildDomesticLineHaulLeg("rail", originAccess.hub, destinationAccess.hub);
          if (!lineHaulLeg) {
            return null;
          }

          return materializeDomesticCandidate({
            autoSuggested,
            destinationAccess,
            lineHaulLeg,
            originAccess
          });
        })
      )
    );

    candidates.push(...railCandidates.filter((candidate): candidate is RouteCandidate => Boolean(candidate)));
  }

  if (compareNumbers(directRoadDistanceKm, DOMESTIC_AIR_MIN_DISTANCE_KM, 0.001) > 0) {
    const [originAirAccessHubs, destinationAirAccessHubs] = await buildDomesticAccess("air");
    const airCandidates = await Promise.all(
      originAirAccessHubs.slice(0, 2).flatMap((originAccess) =>
        destinationAirAccessHubs.slice(0, 2).map(async (destinationAccess) => {
          if (
            compareNumbers(originAccess.leg.estimatedDistance, DOMESTIC_MAX_AIR_FEEDER_KM, 0.001) > 0 ||
            compareNumbers(destinationAccess.leg.estimatedDistance, DOMESTIC_MAX_AIR_FEEDER_KM, 0.001) > 0 ||
            originAccess.hub.id === destinationAccess.hub.id
          ) {
            return null;
          }

          const lineHaulLeg = buildDomesticLineHaulLeg("air", originAccess.hub, destinationAccess.hub);
          if (!lineHaulLeg) {
            return null;
          }

          return materializeDomesticCandidate({
            autoSuggested,
            destinationAccess,
            lineHaulLeg,
            originAccess
          });
        })
      )
    );

    candidates.push(...airCandidates.filter((candidate): candidate is RouteCandidate => Boolean(candidate)));
  }

  return candidates;
};

const selectCandidatesForRequest = async (request: RouteSuggestionRequest) => {
  const destinationMarket = normalizeMarketScope(request.destinationMarket);
  const rawCandidates =
    destinationMarket === "vietnam" ?
      await collectDomesticCandidates(request) :
      await collectExportCandidates(request);

  return rawCandidates.filter((candidate) =>
    routeMatchesRequiredLongHaulMode(candidate.route, request.requiredLongHaulMode)
  );
};

export const buildRouteSuggestionFallback = (
  request: RouteSuggestionRequest,
  reasonCodes: string[] = []
) => buildFallbackResponse(request, reasonCodes);

export const resolveRouteSuggestion = async (
  request: RouteSuggestionRequest
): Promise<RouteSuggestionResponse> => {
  const profile = normalizeMarketScope(request.destinationMarket) === "vietnam" ? "domestic" : "export";
  const candidates = await selectCandidatesForRequest(request);

  if (candidates.length === 0) {
    return buildFallbackResponse(
      request,
      request.requiredLongHaulMode ?
        ["forced_mode_unavailable", `forced_${request.requiredLongHaulMode}_mode`] :
        ["no_viable_candidate"]
    );
  }

  const rankedCandidates = rankCandidates({
    candidates,
    profile,
    request
  });

  if (rankedCandidates.length === 0) {
    return buildFallbackResponse(
      request,
      request.requiredLongHaulMode ?
        ["forced_mode_unavailable", `forced_${request.requiredLongHaulMode}_mode`] :
        ["no_viable_candidate"]
    );
  }

  const [recommendedWithKey] = rankedCandidates;
  const alternatives = toResponseAlternatives(rankedCandidates);
  const recommended = {
    explanation: recommendedWithKey.explanation,
    metrics: recommendedWithKey.metrics,
    route: recommendedWithKey.route,
    score: recommendedWithKey.score
  } satisfies RankedSuggestedRoute;
  const selectedCandidate = candidates.find(
    (candidate) => candidate.routeKey === recommendedWithKey.routeKey
  );

  return {
    alternatives,
    recommended,
    roadFailures: selectedCandidate ? buildRoadFailures(selectedCandidate.legs) : [],
    route: recommended.route,
    snappedDestination: selectedCandidate?.snappedDestination,
    snappedOrigin: selectedCandidate?.snappedOrigin,
    status: "resolved"
  };
};

export const buildIntermodalFallbackRoute = (
  context: IntermodalPlanContext,
  constraints: IntermodalPlanConstraints = {}
): SuggestedRoute =>
  buildRouteSuggestionFallback({
    autoSuggested: constraints.autoSuggested,
    destination: context.destination,
    destinationMarket: context.destinationMarket,
    origin: context.origin,
    requiredLongHaulMode: constraints.requiredLongHaulMode
  }).route;

export const resolveIntermodalPlan = async (
  context: IntermodalPlanContext,
  options: FetchRoadRouteOptions = {},
  constraints: IntermodalPlanConstraints = {}
): Promise<RouteSuggestionResponse> =>
  resolveRouteSuggestion({
    autoSuggested: constraints.autoSuggested,
    destination: context.destination,
    destinationMarket: context.destinationMarket,
    destinationSource: options.destinationSource,
    origin: context.origin,
    originSource: options.originSource,
    requiredLongHaulMode: constraints.requiredLongHaulMode
  });
