import {
  fetchRoadRoute,
  type FetchRoadRouteOptions,
  type RoadRouteFailureReason,
  type RoutePoint
} from "@/lib/roadRouting";
import { resolveRailRouteGeometry } from "@/lib/railRouting";
import { resolveSeaRouteGeometry } from "@/lib/seaRouting";
import {
  EXPORT_CORRIDORS,
  GLOBAL_TRANSSHIPMENT_HUBS,
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

export type SuggestedRouteResolution = {
  roadFailures: SuggestedRoadLegFailure[];
  route: SuggestedRoute;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
  status: "fallback" | "resolved";
};

export interface IntermodalPlanContext {
  destination: AddressInput;
  destinationMarket: string;
  origin: AddressInput;
}

export interface IntermodalPlanConstraints {
  autoSuggested?: boolean;
  requiredLongHaulMode?: TransportLeg["mode"];
}

type PlannerNode =
  | {
      id: "origin_address";
      kind: "address";
      nodeRef: NonNullable<TransportLeg["fromNode"]>;
      point: RoutePoint;
    }
  | {
      id: "destination_address";
      kind: "address";
      nodeRef: NonNullable<TransportLeg["toNode"]>;
      point: RoutePoint;
    }
  | {
      id: `hub:${string}`;
      kind: "hub";
      hub: RouteHub;
      nodeRef: NonNullable<TransportLeg["fromNode"]>;
      point: RoutePoint;
    };

type PlannerEdge = {
  carbonKg: number;
  co2Kg?: number;
  distanceSource: NonNullable<TransportLeg["distanceSource"]>;
  distanceStatus: NonNullable<TransportLeg["distanceStatus"]>;
  emissionFactor?: number;
  estimatedDistance: number;
  etaHours: number;
  fromNode: NonNullable<TransportLeg["fromNode"]>;
  fromNodeId: PlannerNode["id"];
  geometry?: TransportLeg["geometry"];
  id: string;
  mode: TransportLeg["mode"];
  roadFailureReason?: RoadRouteFailureReason;
  routeResolved?: boolean;
  segmentKind: NonNullable<TransportLeg["segmentKind"]>;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
  toNode: NonNullable<TransportLeg["toNode"]>;
  toNodeId: PlannerNode["id"];
};

type PlannerCandidate = {
  carbonKg: number;
  edges: PlannerEdge[];
  estimatedSegmentCount: number;
  etaHours: number;
  feederTransferDistanceKm: number;
  roadFailures: SuggestedRoadLegFailure[];
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
  totalDistanceKm: number;
  transferCount: number;
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

const MODE_SPEED_KM_PER_HOUR: Record<TransportLeg["mode"], number> = {
  air: 700,
  rail: 60,
  road: 45,
  sea: 28
};

const MODE_HANDLING_HOURS: Record<TransportLeg["mode"], number> = {
  air: 8,
  rail: 12,
  road: 0,
  sea: 16
};

const AIR_DISTANCE_MULTIPLIER = 1.05;
const ROAD_FALLBACK_DISTANCE_MULTIPLIER = 1.18;
const DIRECT_AIR_MIN_DISTANCE_KM = 180;
const DIRECT_SEA_MIN_DISTANCE_KM = 120;
const DIRECT_RAIL_MIN_DISTANCE_KM = 120;
const MAX_LEG_COUNT = 5;
const MAX_ACCESS_HUBS_PER_KIND = 2;
const MAX_CLUSTER_TRANSFER_DISTANCE_KM = 80;
const ACCESS_HUB_KINDS = ["airport", "port", "rail_terminal"] as const;

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

const clampDistanceKm = (value: number, minimum = 20) =>
  roundDistanceKm(Math.max(minimum, value));

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

const getHubNodeId = (hubId: string) => `hub:${hubId}` as const;

const buildUniqueHubList = (...groups: RouteHub[][]) => {
  const seen = new Set<string>();
  const result: RouteHub[] = [];

  for (const group of groups) {
    for (const hub of group) {
      if (seen.has(hub.id)) continue;
      seen.add(hub.id);
      result.push(hub);
    }
  }

  return result;
};

const sortHubsByDistance = (point: RoutePoint | null, hubs: RouteHub[]) =>
  [...hubs].sort((left, right) => {
    if (!point) {
      return left.id.localeCompare(right.id);
    }

    const leftDistance = calculateGreatCircleDistanceKm(
      point.lat,
      point.lng,
      left.lat,
      left.lng
    );
    const rightDistance = calculateGreatCircleDistanceKm(
      point.lat,
      point.lng,
      right.lat,
      right.lng
    );

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return left.id.localeCompare(right.id);
  });

const pickAccessHubsByKind = (
  point: RoutePoint | null,
  hubs: RouteHub[],
  limitPerKind = MAX_ACCESS_HUBS_PER_KIND
) => {
  const hubsByKind = new Map<RouteHub["kind"], RouteHub[]>();

  for (const hub of hubs) {
    const current = hubsByKind.get(hub.kind) || [];
    current.push(hub);
    hubsByKind.set(hub.kind, current);
  }

  return buildUniqueHubList(
    ...ACCESS_HUB_KINDS.map((kind) =>
      sortHubsByDistance(point, hubsByKind.get(kind) || []).slice(0, limitPerKind)
    )
  );
};

const findNearestHub = (point: RoutePoint | null, hubs: RouteHub[]) => {
  if (!point || hubs.length === 0) {
    return hubs[0] || null;
  }

  let bestHub = hubs[0];
  let bestDistance = calculateGreatCircleDistanceKm(point.lat, point.lng, bestHub.lat, bestHub.lng);

  for (const candidate of hubs.slice(1)) {
    const nextDistance = calculateGreatCircleDistanceKm(
      point.lat,
      point.lng,
      candidate.lat,
      candidate.lng
    );
    if (nextDistance < bestDistance) {
      bestHub = candidate;
      bestDistance = nextDistance;
    }
  }

  return bestHub;
};

const corridorMatchesMarket = (corridor: ExportCorridor, market: RouteMarketScope) =>
  corridor.marketScope.includes("global") ||
  corridor.marketScope.includes(market) ||
  (market === "vietnam" && corridor.marketScope.includes("vietnam"));

const getFallbackLongHaulMode = (
  destinationMarket: RouteMarketScope,
  totalDistanceKm: number
): TransportLeg["mode"] => {
  if (destinationMarket === "vietnam") {
    return totalDistanceKm >= 900 ? "air" : totalDistanceKm >= 650 ? "rail" : "road";
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

const estimateFallbackRoadDistanceKm = (
  origin: AddressInput,
  destination: AddressInput
) => {
  const originPoint = toRoutePoint(origin);
  const destinationPoint = toRoutePoint(destination);

  if (originPoint && destinationPoint) {
    return clampDistanceKm(
      calculateGreatCircleDistanceKm(
        originPoint.lat,
        originPoint.lng,
        destinationPoint.lat,
        destinationPoint.lng
      ) * ROAD_FALLBACK_DISTANCE_MULTIPLIER
    );
  }

  return 500;
};

const getDestinationHubPool = (destinationMarket: RouteMarketScope) =>
  destinationMarket === "vietnam" ?
    VIETNAM_TRANSFER_HUBS :
    getDestinationRouteHubsByMarket(destinationMarket);

const buildPlannerGraphContext = (context: IntermodalPlanContext) => {
  const destinationMarket = normalizeMarketScope(context.destinationMarket);
  const originPoint = toRoutePoint(context.origin);
  const destinationPoint = toRoutePoint(context.destination);
  const destinationHubs = getDestinationHubPool(destinationMarket);
  const corridorHubIds = new Set<string>();

  for (const corridor of EXPORT_CORRIDORS) {
    if (!corridorMatchesMarket(corridor, destinationMarket)) {
      continue;
    }

    corridorHubIds.add(corridor.fromHubId);
    corridorHubIds.add(corridor.toHubId);
  }

  const corridorHubs = Array.from(corridorHubIds)
    .map((hubId) => getRouteHubById(hubId))
    .filter((hub): hub is RouteHub => Boolean(hub));

  const originAccessHubs = pickAccessHubsByKind(originPoint, VIETNAM_TRANSFER_HUBS);
  const destinationAccessHubs = pickAccessHubsByKind(destinationPoint, destinationHubs);
  const allHubs =
    destinationMarket === "vietnam" ?
      buildUniqueHubList(VIETNAM_TRANSFER_HUBS) :
      buildUniqueHubList(
        originAccessHubs,
        destinationAccessHubs,
        GLOBAL_TRANSSHIPMENT_HUBS,
        corridorHubs
      );

  const nodes = new Map<PlannerNode["id"], PlannerNode>();

  if (originPoint) {
    nodes.set("origin_address", {
      id: "origin_address",
      kind: "address",
      nodeRef: { type: "origin_address" },
      point: originPoint
    });
  }

  if (destinationPoint) {
    nodes.set("destination_address", {
      id: "destination_address",
      kind: "address",
      nodeRef: { type: "destination_address" },
      point: destinationPoint
    });
  }

  for (const hub of allHubs) {
    nodes.set(getHubNodeId(hub.id), {
      id: getHubNodeId(hub.id),
      kind: "hub",
      hub,
      nodeRef: createHubNodeRef(hub.id),
      point: {
        lat: hub.lat,
        lng: hub.lng
      }
    });
  }

  return {
    destinationAccessHubs,
    destinationHubs,
    destinationMarket,
    destinationPoint,
    nodes,
    originAccessHubs,
    originPoint
  };
};

const buildRoadEdge = async (
  id: string,
  fromNode: PlannerNode,
  toNode: PlannerNode,
  segmentKind: NonNullable<TransportLeg["segmentKind"]>,
  options: FetchRoadRouteOptions = {}
): Promise<PlannerEdge | null> => {
  const routeResolution = await fetchRoadRoute(fromNode.point, toNode.point, options);

  if (routeResolution.ok) {
    const estimatedDistance = clampDistanceKm(routeResolution.route.distanceKm);
    const emissionFactor = TRANSPORT_MODE_FACTORS.road || 0;
    return {
      id,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      mode: "road",
      estimatedDistance,
      fromNode: fromNode.nodeRef,
      toNode: toNode.nodeRef,
      geometry: routeResolution.route.geometry,
      distanceSource: "road_route",
      distanceStatus: "resolved",
      routeResolved: true,
      segmentKind,
      emissionFactor,
      co2Kg: estimatedDistance * emissionFactor,
      carbonKg: estimatedDistance * emissionFactor,
      etaHours: estimatedDistance / MODE_SPEED_KM_PER_HOUR.road,
      snappedDestination:
        toNode.id === "destination_address" ? routeResolution.route.resolvedDestination : undefined,
      snappedOrigin:
        fromNode.id === "origin_address" ? routeResolution.route.resolvedOrigin : undefined
    };
  }

  const estimatedDistance = clampDistanceKm(
    calculateGreatCircleDistanceKm(
      fromNode.point.lat,
      fromNode.point.lng,
      toNode.point.lat,
      toNode.point.lng
    ) * ROAD_FALLBACK_DISTANCE_MULTIPLIER
  );
  const emissionFactor = TRANSPORT_MODE_FACTORS.road || 0;

  return {
    id,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    mode: "road",
    estimatedDistance,
    fromNode: fromNode.nodeRef,
    toNode: toNode.nodeRef,
    distanceSource: "road_route",
    distanceStatus: "estimated",
    routeResolved: false,
    segmentKind,
    roadFailureReason: routeResolution.failureReason,
    emissionFactor,
    co2Kg: estimatedDistance * emissionFactor,
    carbonKg: estimatedDistance * emissionFactor,
    etaHours: estimatedDistance / MODE_SPEED_KM_PER_HOUR.road
  };
};

const buildAirEdge = (
  fromNode: Extract<PlannerNode, { kind: "hub" }>,
  toNode: Extract<PlannerNode, { kind: "hub" }>
): PlannerEdge | null => {
  if (fromNode.hub.kind !== "airport" || toNode.hub.kind !== "airport") {
    return null;
  }

  const greatCircleDistanceKm = calculateGreatCircleDistanceKm(
    fromNode.hub.lat,
    fromNode.hub.lng,
    toNode.hub.lat,
    toNode.hub.lng
  );

  if (greatCircleDistanceKm < DIRECT_AIR_MIN_DISTANCE_KM) {
    return null;
  }

  const estimatedDistance = clampDistanceKm(greatCircleDistanceKm * AIR_DISTANCE_MULTIPLIER, 40);
  const emissionFactor = TRANSPORT_MODE_FACTORS.air || 0;

  return {
    id: `air:${fromNode.hub.id}:${toNode.hub.id}`,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    mode: "air",
    estimatedDistance,
    fromNode: fromNode.nodeRef,
    toNode: toNode.nodeRef,
    geometry: [
      [fromNode.hub.lng, fromNode.hub.lat],
      [toNode.hub.lng, toNode.hub.lat]
    ],
    distanceSource: "air_gc",
    distanceStatus: "resolved",
    segmentKind: "line_haul",
    emissionFactor,
    co2Kg: estimatedDistance * emissionFactor,
    carbonKg: estimatedDistance * emissionFactor,
    etaHours: estimatedDistance / MODE_SPEED_KM_PER_HOUR.air + MODE_HANDLING_HOURS.air
  };
};

const buildSeaEdge = (
  fromNode: Extract<PlannerNode, { kind: "hub" }>,
  toNode: Extract<PlannerNode, { kind: "hub" }>
): PlannerEdge | null => {
  if (fromNode.hub.kind !== "port" || toNode.hub.kind !== "port") {
    return null;
  }

  const routeResolution = resolveSeaRouteGeometry({
    origin: fromNode.point,
    destination: toNode.point,
    originType: fromNode.hub.kind,
    destinationType: toNode.hub.kind
  });

  if (!routeResolution || routeResolution.distanceKm < DIRECT_SEA_MIN_DISTANCE_KM) {
    return null;
  }

  const emissionFactor = TRANSPORT_MODE_FACTORS.sea || 0;

  return {
    id: `sea:${fromNode.hub.id}:${toNode.hub.id}`,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    mode: "sea",
    estimatedDistance: routeResolution.distanceKm,
    fromNode: fromNode.nodeRef,
    toNode: toNode.nodeRef,
    geometry: routeResolution.geometry,
    distanceSource: "sea_graph",
    distanceStatus: "resolved",
    segmentKind: "line_haul",
    emissionFactor,
    co2Kg: routeResolution.distanceKm * emissionFactor,
    carbonKg: routeResolution.distanceKm * emissionFactor,
    etaHours: routeResolution.distanceKm / MODE_SPEED_KM_PER_HOUR.sea + MODE_HANDLING_HOURS.sea
  };
};

const buildRailEdge = (
  fromNode: Extract<PlannerNode, { kind: "hub" }>,
  toNode: Extract<PlannerNode, { kind: "hub" }>
): PlannerEdge | null => {
  if (fromNode.hub.kind !== "rail_terminal" || toNode.hub.kind !== "rail_terminal") {
    return null;
  }

  const routeResolution = resolveRailRouteGeometry({
    origin: fromNode.point,
    destination: toNode.point,
    originType: fromNode.hub.kind,
    destinationType: toNode.hub.kind
  });

  if (!routeResolution || routeResolution.distanceKm < DIRECT_RAIL_MIN_DISTANCE_KM) {
    return null;
  }

  const emissionFactor = TRANSPORT_MODE_FACTORS.rail || 0;

  return {
    id: `rail:${fromNode.hub.id}:${toNode.hub.id}`,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    mode: "rail",
    estimatedDistance: routeResolution.distanceKm,
    fromNode: fromNode.nodeRef,
    toNode: toNode.nodeRef,
    geometry: routeResolution.geometry,
    distanceSource: "rail_graph",
    distanceStatus: "resolved",
    segmentKind: "line_haul",
    emissionFactor,
    co2Kg: routeResolution.distanceKm * emissionFactor,
    carbonKg: routeResolution.distanceKm * emissionFactor,
    etaHours: routeResolution.distanceKm / MODE_SPEED_KM_PER_HOUR.rail + MODE_HANDLING_HOURS.rail
  };
};

const isClusterTransferCandidate = (left: RouteHub, right: RouteHub) =>
  left.id !== right.id &&
  left.clusterId === right.clusterId &&
  left.kind !== right.kind &&
  calculateGreatCircleDistanceKm(left.lat, left.lng, right.lat, right.lng) <=
    MAX_CLUSTER_TRANSFER_DISTANCE_KM;

const buildGraphEdges = async (
  context: IntermodalPlanContext,
  options: FetchRoadRouteOptions = {}
) => {
  const {
    destinationAccessHubs,
    nodes,
    originAccessHubs,
    originPoint,
    destinationPoint
  } = buildPlannerGraphContext(context);
  const edges: PlannerEdge[] = [];
  const roadEdgePromises: Array<Promise<PlannerEdge | null>> = [];

  const originNode = nodes.get("origin_address");
  const destinationNode = nodes.get("destination_address");

  if (originNode && destinationNode) {
    roadEdgePromises.push(
      buildRoadEdge("road:origin:destination", originNode, destinationNode, "line_haul", {
        originSource: options.originSource,
        destinationSource: options.destinationSource
      })
    );
  }

  if (originNode && originPoint) {
    for (const hub of originAccessHubs) {
      const hubNode = nodes.get(getHubNodeId(hub.id));
      if (!hubNode || hubNode.kind !== "hub") continue;

      roadEdgePromises.push(
        buildRoadEdge(`road:origin:${hub.id}`, originNode, hubNode, "feeder", {
          originSource: options.originSource,
          destinationSource:
            hub.kind === "airport" ? "hub_airport" :
            hub.kind === "port" ? "hub_port" :
              "hub_rail_terminal"
        })
      );
    }
  }

  if (destinationNode && destinationPoint) {
    for (const hub of destinationAccessHubs) {
      const hubNode = nodes.get(getHubNodeId(hub.id));
      if (!hubNode || hubNode.kind !== "hub") continue;

      roadEdgePromises.push(
        buildRoadEdge(`road:${hub.id}:destination`, hubNode, destinationNode, "feeder", {
          originSource:
            hub.kind === "airport" ? "hub_airport" :
            hub.kind === "port" ? "hub_port" :
              "hub_rail_terminal",
          destinationSource: options.destinationSource
        })
      );
    }
  }

  const hubNodes = [...nodes.values()].filter(
    (node): node is Extract<PlannerNode, { kind: "hub" }> => node.kind === "hub"
  );

  for (let index = 0; index < hubNodes.length; index += 1) {
    const left = hubNodes[index];

    for (let secondIndex = index + 1; secondIndex < hubNodes.length; secondIndex += 1) {
      const right = hubNodes[secondIndex];
      if (!isClusterTransferCandidate(left.hub, right.hub)) {
        continue;
      }

      roadEdgePromises.push(
        buildRoadEdge(`road:${left.hub.id}:${right.hub.id}`, left, right, "transfer", {
          originSource:
            left.hub.kind === "airport" ? "hub_airport" :
            left.hub.kind === "port" ? "hub_port" :
              "hub_rail_terminal",
          destinationSource:
            right.hub.kind === "airport" ? "hub_airport" :
            right.hub.kind === "port" ? "hub_port" :
              "hub_rail_terminal"
        })
      );
      roadEdgePromises.push(
        buildRoadEdge(`road:${right.hub.id}:${left.hub.id}`, right, left, "transfer", {
          originSource:
            right.hub.kind === "airport" ? "hub_airport" :
            right.hub.kind === "port" ? "hub_port" :
              "hub_rail_terminal",
          destinationSource:
            left.hub.kind === "airport" ? "hub_airport" :
            left.hub.kind === "port" ? "hub_port" :
              "hub_rail_terminal"
        })
      );
    }
  }

  const roadEdges = await Promise.all(roadEdgePromises);
  edges.push(...roadEdges.filter((edge): edge is PlannerEdge => Boolean(edge)));

  for (let index = 0; index < hubNodes.length; index += 1) {
    const fromNode = hubNodes[index];

    for (let secondIndex = 0; secondIndex < hubNodes.length; secondIndex += 1) {
      if (index === secondIndex) continue;

      const toNode = hubNodes[secondIndex];
      const lineHaulEdge =
        buildAirEdge(fromNode, toNode) ||
        buildSeaEdge(fromNode, toNode) ||
        buildRailEdge(fromNode, toNode);

      if (lineHaulEdge) {
        edges.push(lineHaulEdge);
      }
    }
  }

  return { edges, nodes };
};

const countTransfers = (edges: PlannerEdge[]) => {
  let count = 0;

  for (const edge of edges) {
    if (edge.segmentKind === "transfer") {
      count += 1;
    }
  }

  return count;
};

const buildCandidate = (edges: PlannerEdge[]): PlannerCandidate => {
  let carbonKg = 0;
  let etaHours = 0;
  let totalDistanceKm = 0;
  let estimatedSegmentCount = 0;
  let feederTransferDistanceKm = 0;
  let snappedOrigin: RoutePoint | undefined;
  let snappedDestination: RoutePoint | undefined;

  edges.forEach((edge) => {
    carbonKg += edge.carbonKg;
    etaHours += edge.etaHours;
    totalDistanceKm += edge.estimatedDistance;
    snappedOrigin ||= edge.snappedOrigin;
    snappedDestination ||= edge.snappedDestination;

    if (edge.distanceStatus === "estimated") {
      estimatedSegmentCount += 1;
    }
    if (edge.segmentKind === "feeder" || edge.segmentKind === "transfer") {
      feederTransferDistanceKm += edge.estimatedDistance;
    }
  });

  const roadFailures = edges.flatMap((edge, index) =>
    edge.roadFailureReason ? [{ legIndex: index, reason: edge.roadFailureReason }] : []
  );

  return {
    edges: edges.map((edge) => ({ ...edge })),
    carbonKg,
    etaHours,
    totalDistanceKm,
    estimatedSegmentCount,
    feederTransferDistanceKm,
    transferCount: countTransfers(edges),
    roadFailures,
    snappedDestination,
    snappedOrigin
  };
};

const compareCandidates = (left: PlannerCandidate, right: PlannerCandidate) => {
  if (left.estimatedSegmentCount !== right.estimatedSegmentCount) {
    return left.estimatedSegmentCount - right.estimatedSegmentCount;
  }
  if (left.feederTransferDistanceKm !== right.feederTransferDistanceKm) {
    return left.feederTransferDistanceKm - right.feederTransferDistanceKm;
  }
  if (left.transferCount !== right.transferCount) {
    return left.transferCount - right.transferCount;
  }
  if (left.totalDistanceKm !== right.totalDistanceKm) {
    return left.totalDistanceKm - right.totalDistanceKm;
  }
  if (left.carbonKg !== right.carbonKg) {
    return left.carbonKg - right.carbonKg;
  }
  if (left.etaHours !== right.etaHours) {
    return left.etaHours - right.etaHours;
  }
  return left.edges.length - right.edges.length;
};

const satisfiesConstraints = (
  candidate: PlannerCandidate,
  constraints: IntermodalPlanConstraints | undefined
) => {
  const requiredLongHaulMode = constraints?.requiredLongHaulMode;
  if (!requiredLongHaulMode) {
    return true;
  }

  const nonRoadModes = candidate.edges
    .filter((edge) => edge.mode !== "road")
    .map((edge) => edge.mode);

  if (requiredLongHaulMode === "road") {
    return nonRoadModes.length === 0;
  }

  return nonRoadModes.includes(requiredLongHaulMode);
};

const collectCandidates = (
  nodes: Map<PlannerNode["id"], PlannerNode>,
  edges: PlannerEdge[],
  constraints?: IntermodalPlanConstraints
) => {
  if (!nodes.has("origin_address") || !nodes.has("destination_address")) {
    return [];
  }

  const adjacency = new Map<PlannerNode["id"], PlannerEdge[]>();

  for (const edge of edges) {
    const current = adjacency.get(edge.fromNodeId) || [];
    current.push(edge);
    adjacency.set(edge.fromNodeId, current);
  }

  const candidates: PlannerCandidate[] = [];
  const visited = new Set<PlannerNode["id"]>(["origin_address"]);
  const path: PlannerEdge[] = [];

  const walk = (currentNodeId: PlannerNode["id"]) => {
    if (path.length > MAX_LEG_COUNT) {
      return;
    }

    if (currentNodeId === "destination_address") {
      const candidate = buildCandidate(path);
      if (satisfiesConstraints(candidate, constraints)) {
        candidates.push(candidate);
      }
      return;
    }

    for (const edge of adjacency.get(currentNodeId) || []) {
      if (visited.has(edge.toNodeId)) {
        continue;
      }

      const previousEdge = path[path.length - 1];
      if (previousEdge) {
        if (previousEdge.mode === "road" && edge.mode === "road") {
          continue;
        }
        if (previousEdge.mode !== "road" && edge.mode !== "road" && previousEdge.mode === edge.mode) {
          continue;
        }
      }

      path.push(edge);
      visited.add(edge.toNodeId);
      walk(edge.toNodeId);
      visited.delete(edge.toNodeId);
      path.pop();
    }
  };

  walk("origin_address");
  return candidates;
};

const candidateToSuggestedRouteResolution = (
  candidate: PlannerCandidate,
  autoSuggested = true
): SuggestedRouteResolution => ({
  roadFailures: candidate.roadFailures,
  route: {
    longHaulMode: candidate.edges.find((edge) => edge.mode !== "road")?.mode || "road",
    legs: candidate.edges.map((edge) => ({
      mode: edge.mode,
      estimatedDistance: edge.estimatedDistance,
      routeResolved: edge.routeResolved,
      fromNode: edge.fromNode,
      toNode: edge.toNode,
      autoSuggested,
      geometry: edge.geometry,
      distanceSource: edge.distanceSource,
      distanceStatus: edge.distanceStatus,
      segmentKind: edge.segmentKind,
      emissionFactor: edge.emissionFactor,
      co2Kg: edge.co2Kg
    }))
  },
  snappedDestination: candidate.snappedDestination,
  snappedOrigin: candidate.snappedOrigin,
  status: "resolved"
});

const buildPendingRoadLeg = (
  fromNode: NonNullable<TransportLeg["fromNode"]>,
  toNode: NonNullable<TransportLeg["toNode"]>,
  segmentKind: NonNullable<TransportLeg["segmentKind"]>,
  autoSuggested: boolean
) => ({
  mode: "road" as const,
  fromNode,
  toNode,
  autoSuggested,
  distanceSource: "road_route" as const,
  distanceStatus: "pending" as const,
  routeResolved: false,
  segmentKind
});

const buildFallbackLineHaulLeg = (
  mode: TransportLeg["mode"],
  originHub: RouteHub,
  destinationHub: RouteHub,
  autoSuggested: boolean
): SuggestedRoute["legs"][number] | null => {
  if (mode === "air" && originHub.kind === "airport" && destinationHub.kind === "airport") {
    const distanceKm = clampDistanceKm(
      calculateGreatCircleDistanceKm(
        originHub.lat,
        originHub.lng,
        destinationHub.lat,
        destinationHub.lng
      ) * AIR_DISTANCE_MULTIPLIER,
      40
    );
    return {
      mode,
      estimatedDistance: distanceKm,
      autoSuggested,
      fromNode: createHubNodeRef(originHub.id),
      toNode: createHubNodeRef(destinationHub.id),
      geometry: [
        [originHub.lng, originHub.lat],
        [destinationHub.lng, destinationHub.lat]
      ],
      distanceSource: "air_gc",
      distanceStatus: "resolved",
      segmentKind: "line_haul",
      emissionFactor: TRANSPORT_MODE_FACTORS.air,
      co2Kg: distanceKm * (TRANSPORT_MODE_FACTORS.air || 0)
    };
  }

  if (mode === "sea" && originHub.kind === "port" && destinationHub.kind === "port") {
    const routeResolution = resolveSeaRouteGeometry({
      origin: { lat: originHub.lat, lng: originHub.lng },
      destination: { lat: destinationHub.lat, lng: destinationHub.lng },
      originType: originHub.kind,
      destinationType: destinationHub.kind
    });

    if (routeResolution) {
      return {
        mode,
        estimatedDistance: routeResolution.distanceKm,
        autoSuggested,
        fromNode: createHubNodeRef(originHub.id),
        toNode: createHubNodeRef(destinationHub.id),
        geometry: routeResolution.geometry,
        distanceSource: "sea_graph",
        distanceStatus: "resolved",
        segmentKind: "line_haul",
        emissionFactor: TRANSPORT_MODE_FACTORS.sea,
        co2Kg: routeResolution.distanceKm * (TRANSPORT_MODE_FACTORS.sea || 0)
      };
    }
  }

  if (
    mode === "rail" &&
    originHub.kind === "rail_terminal" &&
    destinationHub.kind === "rail_terminal"
  ) {
    const routeResolution = resolveRailRouteGeometry({
      origin: { lat: originHub.lat, lng: originHub.lng },
      destination: { lat: destinationHub.lat, lng: destinationHub.lng },
      originType: originHub.kind,
      destinationType: destinationHub.kind
    });

    if (routeResolution) {
      return {
        mode,
        estimatedDistance: routeResolution.distanceKm,
        autoSuggested,
        fromNode: createHubNodeRef(originHub.id),
        toNode: createHubNodeRef(destinationHub.id),
        geometry: routeResolution.geometry,
        distanceSource: "rail_graph",
        distanceStatus: "resolved",
        segmentKind: "line_haul",
        emissionFactor: TRANSPORT_MODE_FACTORS.rail,
        co2Kg: routeResolution.distanceKm * (TRANSPORT_MODE_FACTORS.rail || 0)
      };
    }
  }

  return null;
};

export const buildIntermodalFallbackRoute = (
  context: IntermodalPlanContext,
  constraints: IntermodalPlanConstraints = {}
): SuggestedRoute => {
  const destinationMarket = normalizeMarketScope(context.destinationMarket);
  const autoSuggested = constraints.autoSuggested ?? true;

  if (destinationMarket === "vietnam") {
    return {
      longHaulMode: "road",
      legs: [
        {
          mode: "road",
          autoSuggested,
          distanceSource: "road_route",
          distanceStatus: "pending",
          routeResolved: false,
          segmentKind: "line_haul",
          fromNode: { type: "origin_address" },
          toNode: { type: "destination_address" }
        }
      ]
    };
  }

  const totalDistanceKm = estimateFallbackRoadDistanceKm(context.origin, context.destination);
  const longHaulMode =
    constraints.requiredLongHaulMode ||
    getFallbackLongHaulMode(destinationMarket, totalDistanceKm);
  const originPoint = toRoutePoint(context.origin);
  const destinationPoint = toRoutePoint(context.destination);
  const requiredHubKind =
    longHaulMode === "road" ? null :
    longHaulMode === "air" ? "airport" :
    longHaulMode === "sea" ? "port" :
      "rail_terminal";
  const originHub = findNearestHub(
    originPoint,
    requiredHubKind ?
      VIETNAM_TRANSFER_HUBS.filter((hub) => hub.kind === requiredHubKind) :
      VIETNAM_TRANSFER_HUBS
  );
  const destinationHub = findNearestHub(
    destinationPoint,
    requiredHubKind ?
      getDestinationHubPool(destinationMarket).filter((hub) => hub.kind === requiredHubKind) :
      getDestinationHubPool(destinationMarket)
  );

  const fallbackLineHaul =
    longHaulMode !== "road" && originHub && destinationHub ?
      buildFallbackLineHaulLeg(longHaulMode, originHub, destinationHub, autoSuggested) :
      null;

  if (longHaulMode === "road" || !originHub || !destinationHub || !fallbackLineHaul) {
    return {
      longHaulMode: "road",
      legs: [
        {
          mode: "road",
          autoSuggested,
          distanceSource: "road_route",
          distanceStatus: "pending",
          routeResolved: false,
          segmentKind: "line_haul",
          fromNode: { type: "origin_address" },
          toNode: { type: "destination_address" }
        }
      ]
    };
  }

  return {
    longHaulMode,
    legs: [
      buildPendingRoadLeg(
        { type: "origin_address" },
        createHubNodeRef(originHub.id),
        "feeder",
        autoSuggested
      ),
      fallbackLineHaul,
      buildPendingRoadLeg(
        createHubNodeRef(destinationHub.id),
        { type: "destination_address" },
        "feeder",
        autoSuggested
      )
    ]
  };
};

export const resolveIntermodalPlan = async (
  context: IntermodalPlanContext,
  options: FetchRoadRouteOptions = {},
  constraints: IntermodalPlanConstraints = {}
): Promise<SuggestedRouteResolution> => {
  const graph = await buildGraphEdges(context, options);
  const destinationMarket = normalizeMarketScope(context.destinationMarket);
  const fallbackDistanceKm = estimateFallbackRoadDistanceKm(context.origin, context.destination);
  const preferredLongHaulMode =
    constraints.requiredLongHaulMode ||
    getFallbackLongHaulMode(destinationMarket, fallbackDistanceKm);
  const candidates = collectCandidates(graph.nodes, graph.edges, constraints);
  const autoSuggested = constraints.autoSuggested ?? true;

  if (candidates.length === 0) {
    return {
      roadFailures: [],
      route: buildIntermodalFallbackRoute(context, constraints),
      status: "fallback"
    };
  }

  const preferredCandidates =
    preferredLongHaulMode === "road" ?
      candidates.filter((candidate) => candidate.edges.every((edge) => edge.mode === "road")) :
      candidates.filter((candidate) =>
        candidate.edges.some((edge) => edge.mode === preferredLongHaulMode)
      );
  const rankedCandidates =
    preferredCandidates.length > 0 ? preferredCandidates : candidates;
  let bestCandidate = rankedCandidates[0];

  for (const candidate of rankedCandidates.slice(1)) {
    if (compareCandidates(candidate, bestCandidate) < 0) {
      bestCandidate = candidate;
    }
  }

  return candidateToSuggestedRouteResolution(bestCandidate, autoSuggested);
};
