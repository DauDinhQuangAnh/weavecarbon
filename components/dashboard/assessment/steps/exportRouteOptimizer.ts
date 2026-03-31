import {
  fetchRoadRoute,
  type FetchRoadRouteOptions,
  type RoutePoint
} from "@/lib/roadRouting";
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
import {
  type SuggestedRoute,
  type SuggestedRouteResolution
} from "./domesticRouteSuggestion";

export interface ExportRouteContext {
  origin: AddressInput;
  destination: AddressInput;
  destinationMarket: string;
}

type ExportGraphNode =
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

interface ExportGraphEdge {
  id: string;
  fromNodeId: ExportGraphNode["id"];
  toNodeId: ExportGraphNode["id"];
  mode: TransportLeg["mode"];
  estimatedDistance: number;
  routeResolved?: boolean;
  fromNode: NonNullable<TransportLeg["fromNode"]>;
  toNode: NonNullable<TransportLeg["toNode"]>;
  carbonKg: number;
  etaHours: number;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
}

interface ExportRouteCandidate {
  edges: ExportGraphEdge[];
  carbonKg: number;
  etaHours: number;
  totalDistanceKm: number;
  transferPenalty: number;
  detourDistanceKm: number;
  score: number;
  snappedDestination?: RoutePoint;
  snappedOrigin?: RoutePoint;
}

const MODE_FACTORS = TRANSPORT_MODES.reduce<Record<TransportLeg["mode"], number>>(
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

const DEFAULT_EXPORT_DISTANCE_KM = 5000;
const MAX_PATH_DISTANCE_MULTIPLIER = 4;
const MAX_ACCESS_HUBS_PER_KIND = 2;
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

const normalizeMarketScope = (value: string | null | undefined): RouteMarketScope => {
  const normalized = String(value || "").trim().toLowerCase();
  if (
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

const getHubNodeId = (hubId: string) => `hub:${hubId}` as const;

const createHubNodeRef = (hubId: string) =>
  ({
    type: "hub",
    hubId
  }) satisfies NonNullable<TransportLeg["fromNode"]>;

const isClusterTransferCandidate = (left: RouteHub, right: RouteHub) =>
  left.id !== right.id &&
  left.clusterId === right.clusterId &&
  left.kind !== right.kind &&
  calculateGreatCircleDistanceKm(left.lat, left.lng, right.lat, right.lng) <= 80;

const getLongHaulFallbackMode = (
  destinationMarket: RouteMarketScope,
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

const getHubKindByMode = (mode: TransportLeg["mode"]) =>
  mode === "air" ? "airport" : mode === "rail" ? "rail_terminal" : "port";

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

const buildFallbackDistanceKm = (context: ExportRouteContext) => {
  const originPoint = toRoutePoint(context.origin);
  const destinationPoint = toRoutePoint(context.destination);

  if (originPoint && destinationPoint) {
    return Math.max(
      100,
      roundDistanceKm(
        calculateGreatCircleDistanceKm(
          originPoint.lat,
          originPoint.lng,
          destinationPoint.lat,
          destinationPoint.lng
        )
      )
    );
  }

  return DEFAULT_EXPORT_DISTANCE_KM;
};

const expandCorridorDirections = (corridor: ExportCorridor): ExportCorridor[] =>
  corridor.bidirectional ?
    [
      corridor,
      {
        ...corridor,
        id: `${corridor.id}__reverse`,
        fromHubId: corridor.toHubId,
        toHubId: corridor.fromHubId,
        bidirectional: false
      }
    ] :
    [corridor];

const corridorMatchesMarket = (corridor: ExportCorridor, market: RouteMarketScope) =>
  corridor.marketScope.includes("global") || corridor.marketScope.includes(market);

const buildNodeMap = (context: ExportRouteContext) => {
  const destinationMarket = normalizeMarketScope(context.destinationMarket);
  const originPoint = toRoutePoint(context.origin);
  const destinationPoint = toRoutePoint(context.destination);
  const destinationHubs = getDestinationRouteHubsByMarket(destinationMarket);
  const corridors = EXPORT_CORRIDORS
    .flatMap(expandCorridorDirections)
    .filter((corridor) => corridorMatchesMarket(corridor, destinationMarket));
  const corridorHubIds = new Set<string>();

  for (const corridor of corridors) {
    corridorHubIds.add(corridor.fromHubId);
    corridorHubIds.add(corridor.toHubId);
  }

  const corridorHubs = Array.from(corridorHubIds)
    .map((hubId) => getRouteHubById(hubId))
    .filter((hub): hub is RouteHub => Boolean(hub));
  const originCorridorHubs = VIETNAM_TRANSFER_HUBS.filter((hub) =>
    corridorHubIds.has(hub.id)
  );
  const destinationCorridorHubs = destinationHubs.filter((hub) =>
    corridorHubIds.has(hub.id)
  );
  const originAccessHubs = pickAccessHubsByKind(
    originPoint,
    originCorridorHubs.length > 0 ? originCorridorHubs : VIETNAM_TRANSFER_HUBS
  );
  const destinationAccessHubs = pickAccessHubsByKind(
    destinationPoint,
    destinationCorridorHubs.length > 0 ? destinationCorridorHubs : destinationHubs
  );
  const allHubs = buildUniqueHubList(
    originAccessHubs,
    destinationAccessHubs,
    corridorHubs
  );
  const nodes = new Map<ExportGraphNode["id"], ExportGraphNode>();

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
    corridors,
    destinationAccessHubs,
    destinationMarket,
    nodes,
    originAccessHubs,
    originPoint,
    destinationPoint
  };
};

const buildRoadEdge = async (
  id: string,
  fromNode: ExportGraphNode,
  toNode: ExportGraphNode,
  options: FetchRoadRouteOptions
): Promise<ExportGraphEdge | null> => {
  const routeResolution = await fetchRoadRoute(fromNode.point, toNode.point, options);
  if (!routeResolution.ok) {
    return null;
  }

  const estimatedDistance = roundDistanceKm(routeResolution.route.distanceKm);

  return {
    id,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    mode: "road",
    estimatedDistance,
    routeResolved: true,
    fromNode: fromNode.nodeRef,
    toNode: toNode.nodeRef,
    carbonKg: estimatedDistance * (MODE_FACTORS.road || 0),
    etaHours: estimatedDistance / MODE_SPEED_KM_PER_HOUR.road,
    snappedDestination:
      toNode.id === "destination_address" ? routeResolution.route.resolvedDestination : undefined,
    snappedOrigin:
      fromNode.id === "origin_address" ? routeResolution.route.resolvedOrigin : undefined
  };
};

const buildLineHaulEdge = (
  corridor: ExportCorridor,
  fromNode: Extract<ExportGraphNode, { kind: "hub" }>,
  toNode: Extract<ExportGraphNode, { kind: "hub" }>
): ExportGraphEdge => {
  const estimatedDistance = Math.max(
    40,
    roundDistanceKm(
      calculateGreatCircleDistanceKm(
        fromNode.hub.lat,
        fromNode.hub.lng,
        toNode.hub.lat,
        toNode.hub.lng
      ) * corridor.distanceMultiplier
    )
  );

  return {
    id: corridor.id,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    mode: corridor.mode,
    estimatedDistance,
    fromNode: fromNode.nodeRef,
    toNode: toNode.nodeRef,
    carbonKg: estimatedDistance * (MODE_FACTORS[corridor.mode] || 0),
    etaHours: estimatedDistance / MODE_SPEED_KM_PER_HOUR[corridor.mode] + corridor.handlingHours
  };
};

const buildGraphEdges = async (
  context: ExportRouteContext,
  options: FetchRoadRouteOptions = {}
) => {
  const {
    corridors,
    destinationAccessHubs,
    destinationMarket,
    nodes,
    originAccessHubs,
    originPoint,
    destinationPoint
  } = buildNodeMap(context);
  const edges: ExportGraphEdge[] = [];
  const roadEdgePromises: Array<Promise<ExportGraphEdge | null>> = [];

  const originNode = nodes.get("origin_address");
  const destinationNode = nodes.get("destination_address");

  if (originNode && destinationNode) {
    roadEdgePromises.push(
      buildRoadEdge("road:origin:destination", originNode, destinationNode, {
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
        buildRoadEdge(`road:origin:${hub.id}`, originNode, hubNode, {
          originSource: options.originSource,
          destinationSource:
            hub.kind === "airport" ?
              "hub_airport" :
            hub.kind === "port" ?
              "hub_port" :
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
        buildRoadEdge(`road:${hub.id}:destination`, hubNode, destinationNode, {
          originSource:
            hub.kind === "airport" ?
              "hub_airport" :
            hub.kind === "port" ?
              "hub_port" :
              "hub_rail_terminal",
          destinationSource: options.destinationSource
        })
      );
    }
  }

  const hubNodes = [...nodes.values()].filter(
    (node): node is Extract<ExportGraphNode, { kind: "hub" }> => node.kind === "hub"
  );

  for (let index = 0; index < hubNodes.length; index += 1) {
    const left = hubNodes[index];

    for (let secondIndex = index + 1; secondIndex < hubNodes.length; secondIndex += 1) {
      const right = hubNodes[secondIndex];
      if (!isClusterTransferCandidate(left.hub, right.hub)) continue;

      roadEdgePromises.push(
        buildRoadEdge(`road:${left.hub.id}:${right.hub.id}`, left, right, {
          originSource:
            left.hub.kind === "airport" ?
              "hub_airport" :
            left.hub.kind === "port" ?
              "hub_port" :
              "hub_rail_terminal",
          destinationSource:
            right.hub.kind === "airport" ?
              "hub_airport" :
            right.hub.kind === "port" ?
              "hub_port" :
              "hub_rail_terminal"
        })
      );
      roadEdgePromises.push(
        buildRoadEdge(`road:${right.hub.id}:${left.hub.id}`, right, left, {
          originSource:
            right.hub.kind === "airport" ?
              "hub_airport" :
            right.hub.kind === "port" ?
              "hub_port" :
              "hub_rail_terminal",
          destinationSource:
            left.hub.kind === "airport" ?
              "hub_airport" :
            left.hub.kind === "port" ?
              "hub_port" :
              "hub_rail_terminal"
        })
      );
    }
  }

  const roadEdges = await Promise.all(roadEdgePromises);
  edges.push(...roadEdges.filter((edge): edge is ExportGraphEdge => Boolean(edge)));

  for (const corridor of corridors) {
    const fromNode = nodes.get(getHubNodeId(corridor.fromHubId));
    const toNode = nodes.get(getHubNodeId(corridor.toHubId));
    if (!fromNode || !toNode || fromNode.kind !== "hub" || toNode.kind !== "hub") continue;

    edges.push(buildLineHaulEdge(corridor, fromNode, toNode));
  }

  return {
    destinationMarket,
    nodes,
    edges
  };
};

const collectCandidates = (
  nodes: Map<ExportGraphNode["id"], ExportGraphNode>,
  edges: ExportGraphEdge[],
  directDistanceKm: number
) => {
  const adjacency = new Map<ExportGraphNode["id"], ExportGraphEdge[]>();
  const candidates: ExportRouteCandidate[] = [];

  for (const edge of edges) {
    const current = adjacency.get(edge.fromNodeId) || [];
    current.push(edge);
    adjacency.set(edge.fromNodeId, current);
  }

  const visited = new Set<ExportGraphNode["id"]>(["origin_address"]);
  const path: ExportGraphEdge[] = [];

  const walk = (currentNodeId: ExportGraphNode["id"], currentDistanceKm: number) => {
    if (currentNodeId === "destination_address") {
      candidates.push(buildCandidate(nodes, path, directDistanceKm));
      return;
    }

    const nextEdges = adjacency.get(currentNodeId) || [];

    for (const edge of nextEdges) {
      if (visited.has(edge.toNodeId)) continue;

      const nextDistanceKm = currentDistanceKm + edge.estimatedDistance;
      if (directDistanceKm > 0 && nextDistanceKm > directDistanceKm * MAX_PATH_DISTANCE_MULTIPLIER) {
        continue;
      }

      visited.add(edge.toNodeId);
      path.push(edge);
      walk(edge.toNodeId, nextDistanceKm);
      path.pop();
      visited.delete(edge.toNodeId);
    }
  };

  if (!nodes.has("origin_address") || !nodes.has("destination_address")) {
    return candidates;
  }

  walk("origin_address", 0);
  return candidates;
};

const buildCandidate = (
  nodes: Map<ExportGraphNode["id"], ExportGraphNode>,
  edges: ExportGraphEdge[],
  directDistanceKm: number
): ExportRouteCandidate => {
  let carbonKg = 0;
  let etaHours = 0;
  let totalDistanceKm = 0;
  let transferPenalty = 0;
  let snappedOrigin: RoutePoint | undefined;
  let snappedDestination: RoutePoint | undefined;

  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    carbonKg += edge.carbonKg;
    etaHours += edge.etaHours;
    totalDistanceKm += edge.estimatedDistance;
    snappedOrigin ||= edge.snappedOrigin;
    snappedDestination ||= edge.snappedDestination;

    if (index > 0 && edges[index - 1].mode !== edge.mode) {
      transferPenalty += 1;
    }

    const intermediateNode = nodes.get(edge.toNodeId);
    if (
      intermediateNode &&
      intermediateNode.kind === "hub" &&
      edge.toNodeId !== "destination_address" &&
      intermediateNode.hub.marketScope.includes("global")
    ) {
      transferPenalty += 1;
    }
  }

  return {
    edges: edges.map((edge) => ({ ...edge })),
    carbonKg,
    etaHours,
    totalDistanceKm,
    transferPenalty,
    detourDistanceKm:
      directDistanceKm > 0 ?
        Math.max(0, (totalDistanceKm - directDistanceKm) / directDistanceKm) :
        0,
    score: Number.POSITIVE_INFINITY,
    snappedDestination,
    snappedOrigin
  };
};

const normalizeMetric = (value: number, baseline: number) => {
  if (baseline <= 0) {
    return value;
  }
  return value / baseline;
};

const selectBestCandidate = (candidates: ExportRouteCandidate[]) => {
  const baselineCarbon = Math.min(...candidates.map((candidate) => candidate.carbonKg));
  const baselineEta = Math.min(...candidates.map((candidate) => candidate.etaHours));
  const baselineDetour = Math.min(...candidates.map((candidate) => candidate.detourDistanceKm));
  const baselineTransfer = Math.min(...candidates.map((candidate) => candidate.transferPenalty));

  let bestCandidate = candidates[0];

  for (const candidate of candidates) {
    candidate.score =
      0.45 * normalizeMetric(candidate.carbonKg, baselineCarbon) +
      0.25 * normalizeMetric(candidate.etaHours, baselineEta) +
      0.15 * normalizeMetric(candidate.detourDistanceKm, baselineDetour) +
      0.15 * normalizeMetric(candidate.transferPenalty, baselineTransfer);

    if (
      candidate.score < bestCandidate.score ||
      (candidate.score === bestCandidate.score &&
        (candidate.carbonKg < bestCandidate.carbonKg ||
          (candidate.carbonKg === bestCandidate.carbonKg &&
            candidate.totalDistanceKm < bestCandidate.totalDistanceKm)))
    ) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
};

const candidateToSuggestedRouteResolution = (
  candidate: ExportRouteCandidate
): SuggestedRouteResolution => ({
  roadFailures: [],
  route: {
    longHaulMode: candidate.edges.find((edge) => edge.mode !== "road")?.mode || "road",
    legs: candidate.edges.map((edge) => ({
      mode: edge.mode,
      estimatedDistance: edge.estimatedDistance,
      routeResolved: edge.routeResolved,
      fromNode: edge.fromNode,
      toNode: edge.toNode,
      autoSuggested: true
    }))
  },
  snappedDestination: candidate.snappedDestination,
  snappedOrigin: candidate.snappedOrigin
});

export const buildExportFallbackRoute = (context: ExportRouteContext): SuggestedRoute => {
  const destinationMarket = normalizeMarketScope(context.destinationMarket);
  const totalDistanceKm = buildFallbackDistanceKm(context);
  const longHaulMode = getLongHaulFallbackMode(destinationMarket, totalDistanceKm);
  const requiredHubKind = getHubKindByMode(longHaulMode);
  const originPoint = toRoutePoint(context.origin);
  const destinationPoint = toRoutePoint(context.destination);
  const originHub = findNearestHub(
    originPoint,
    VIETNAM_TRANSFER_HUBS.filter((hub) => hub.kind === requiredHubKind)
  );
  const destinationHub = findNearestHub(
    destinationPoint,
    getDestinationRouteHubsByMarket(destinationMarket).filter((hub) => hub.kind === requiredHubKind)
  );

  if (!originHub || !destinationHub) {
    return {
      longHaulMode: "road",
      legs: [
        {
          mode: "road",
          estimatedDistance: undefined,
          routeResolved: false,
          fromNode: { type: "origin_address" },
          toNode: { type: "destination_address" },
          autoSuggested: true
        }
      ]
    };
  }

  return {
    longHaulMode,
    legs: [
      {
        mode: "road",
        estimatedDistance: undefined,
        routeResolved: false,
        fromNode: { type: "origin_address" },
        toNode: createHubNodeRef(originHub.id),
        autoSuggested: true
      },
      {
        mode: longHaulMode,
        estimatedDistance: Math.max(
          50,
          roundDistanceKm(
            calculateGreatCircleDistanceKm(
              originHub.lat,
              originHub.lng,
              destinationHub.lat,
              destinationHub.lng
            )
          )
        ),
        fromNode: createHubNodeRef(originHub.id),
        toNode: createHubNodeRef(destinationHub.id),
        autoSuggested: true
      },
      {
        mode: "road",
        estimatedDistance: undefined,
        routeResolved: false,
        fromNode: createHubNodeRef(destinationHub.id),
        toNode: { type: "destination_address" },
        autoSuggested: true
      }
    ]
  };
};

export const resolveExportSuggestedRoute = async (
  context: ExportRouteContext,
  options: FetchRoadRouteOptions = {}
): Promise<SuggestedRouteResolution> => {
  const directDistanceKm = buildFallbackDistanceKm(context);
  const graph = await buildGraphEdges(context, options);
  const candidates = collectCandidates(graph.nodes, graph.edges, directDistanceKm);

  if (candidates.length === 0) {
    return {
      roadFailures: [],
      route: buildExportFallbackRoute(context)
    };
  }

  return candidateToSuggestedRouteResolution(selectBestCandidate(candidates));
};

export const getRouteHubByNodeRef = (
  nodeRef: TransportLeg["fromNode"] | TransportLeg["toNode"] | undefined
) => {
  if (nodeRef?.type !== "hub" || !nodeRef.hubId) {
    return null;
  }

  return getRouteHubById(nodeRef.hubId);
};
