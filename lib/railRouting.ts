import {
  RAIL_ROUTE_EDGES,
  RAIL_ROUTE_NODE_BY_ID,
  RAIL_ROUTE_TERMINALS,
  type RailRouteCoordinate,
  type RailRouteEdge,
  type RailRouteNode
} from "@/lib/railRouteGraph";

type RoutePoint = {
  lat: number;
  lng: number;
};

type RailRouteResolution = {
  distanceKm: number;
  geometry: RailRouteCoordinate[];
  pathTerminalIds: string[];
};

type RailPathState = {
  cost: number;
  edges: RailRouteEdge[];
};

const TERMINAL_MATCH_DISTANCE_KM = 120;
const TERMINAL_STRICT_MATCH_DISTANCE_KM = 40;
const TERMINAL_SNAP_DISTANCE_KM = 900;
const MAX_TERMINAL_CANDIDATES = 4;
const ROUTE_CACHE = new Map<string, RailRouteResolution | null>();
const ADJACENT_EDGES_BY_NODE_ID = RAIL_ROUTE_EDGES.reduce<Record<string, RailRouteEdge[]>>(
  (accumulator, edge) => {
    accumulator[edge.fromId] ||= [];
    accumulator[edge.fromId].push(edge);
    return accumulator;
  },
  {}
);

const toRadians = (value: number) => (value * Math.PI) / 180;

const roundCoordinate = (value: number) =>
  Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

const roundDistanceKm = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 10) / 10;

const haversineDistanceKm = (from: RoutePoint, to: RoutePoint) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const dedupeCoordinates = (coordinates: RailRouteCoordinate[]) => {
  const result: RailRouteCoordinate[] = [];

  for (const coordinate of coordinates) {
    const previous = result[result.length - 1];
    if (previous && previous[0] === coordinate[0] && previous[1] === coordinate[1]) {
      continue;
    }
    result.push(coordinate);
  }

  return result;
};

const polylineDistanceKm = (coordinates: RailRouteCoordinate[]) => {
  let total = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const [fromLng, fromLat] = coordinates[index - 1];
    const [toLng, toLat] = coordinates[index];
    total += haversineDistanceKm(
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng }
    );
  }

  return total;
};

const buildCacheKey = (
  origin: RoutePoint,
  destination: RoutePoint,
  originType?: string,
  destinationType?: string
) =>
  [
    origin.lat.toFixed(4),
    origin.lng.toFixed(4),
    destination.lat.toFixed(4),
    destination.lng.toFixed(4),
    originType || "",
    destinationType || ""
  ].join(":");

const toCoordinate = (point: RoutePoint): RailRouteCoordinate => [
  roundCoordinate(point.lng),
  roundCoordinate(point.lat)
];

const getNearestTerminalCandidates = (point: RoutePoint, pointType?: string) => {
  const maxSnapDistanceKm =
    pointType === "rail_terminal" ? TERMINAL_SNAP_DISTANCE_KM : TERMINAL_SNAP_DISTANCE_KM * 1.15;

  const candidates = RAIL_ROUTE_TERMINALS
    .map((terminal) => ({
      distanceKm: haversineDistanceKm(point, { lat: terminal.lat, lng: terminal.lng }),
      terminal
    }))
    .filter((candidate) => candidate.distanceKm <= maxSnapDistanceKm)
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, MAX_TERMINAL_CANDIDATES);

  if (pointType === "rail_terminal") {
    const strictCandidates = candidates.filter(
      (candidate) => candidate.distanceKm <= TERMINAL_STRICT_MATCH_DISTANCE_KM
    );
    if (strictCandidates.length > 0) {
      return strictCandidates;
    }
  }

  return candidates;
};

const findShortestRailPath = (
  startNodeId: string,
  endNodeId: string
): RailPathState | null => {
  const distances = new Map<string, RailPathState>([
    [startNodeId, { cost: 0, edges: [] }]
  ]);
  const queue = new Set<string>([startNodeId]);

  while (queue.size > 0) {
    let currentNodeId: string | null = null;
    let currentState: RailPathState | null = null;

    for (const candidateNodeId of queue) {
      const candidateState = distances.get(candidateNodeId) || null;
      if (!candidateState) continue;
      if (!currentState || candidateState.cost < currentState.cost) {
        currentNodeId = candidateNodeId;
        currentState = candidateState;
      }
    }

    if (!currentNodeId || !currentState) {
      break;
    }

    queue.delete(currentNodeId);
    if (currentNodeId === endNodeId) {
      return currentState;
    }

    for (const edge of ADJACENT_EDGES_BY_NODE_ID[currentNodeId] || []) {
      const nextCost = currentState.cost + polylineDistanceKm(edge.geometry) * edge.costMultiplier;
      const previousBest = distances.get(edge.toId);
      if (previousBest && previousBest.cost <= nextCost) {
        continue;
      }

      distances.set(edge.toId, {
        cost: nextCost,
        edges: [...currentState.edges, edge]
      });
      queue.add(edge.toId);
    }
  }

  return null;
};

const concatEdgeGeometry = (edges: RailRouteEdge[]) => {
  const coordinates: RailRouteCoordinate[] = [];

  edges.forEach((edge, index) => {
    const edgeGeometry = index === 0 ? edge.geometry : edge.geometry.slice(1);
    coordinates.push(...edgeGeometry);
  });

  return dedupeCoordinates(coordinates);
};

const buildResolvedGeometry = (
  origin: RoutePoint,
  destination: RoutePoint,
  originTerminal: RailRouteNode,
  destinationTerminal: RailRouteNode,
  pathGeometry: RailRouteCoordinate[],
  originType?: string,
  destinationType?: string
) => {
  const coordinates: RailRouteCoordinate[] = [];
  const originCoordinate = toCoordinate(origin);
  const destinationCoordinate = toCoordinate(destination);
  const originTerminalCoordinate = toCoordinate({
    lat: originTerminal.lat,
    lng: originTerminal.lng
  });
  const destinationTerminalCoordinate = toCoordinate({
    lat: destinationTerminal.lat,
    lng: destinationTerminal.lng
  });
  const originTerminalDistanceKm = haversineDistanceKm(origin, {
    lat: originTerminal.lat,
    lng: originTerminal.lng
  });
  const destinationTerminalDistanceKm = haversineDistanceKm(destination, {
    lat: destinationTerminal.lat,
    lng: destinationTerminal.lng
  });
  const shouldUseOriginCoordinate =
    originType === "rail_terminal" && originTerminalDistanceKm <= TERMINAL_STRICT_MATCH_DISTANCE_KM;
  const shouldUseDestinationCoordinate =
    destinationType === "rail_terminal" &&
    destinationTerminalDistanceKm <= TERMINAL_STRICT_MATCH_DISTANCE_KM;

  coordinates.push(shouldUseOriginCoordinate ? originCoordinate : originTerminalCoordinate);
  if (originTerminalDistanceKm > TERMINAL_MATCH_DISTANCE_KM) {
    coordinates.push(originTerminalCoordinate);
  }

  coordinates.push(...pathGeometry);

  if (destinationTerminalDistanceKm > TERMINAL_MATCH_DISTANCE_KM) {
    coordinates.push(destinationTerminalCoordinate);
  }

  coordinates.push(
    shouldUseDestinationCoordinate ? destinationCoordinate : destinationTerminalCoordinate
  );

  return dedupeCoordinates(coordinates);
};

export const resolveRailRouteGeometry = ({
  origin,
  destination,
  originType,
  destinationType
}: {
  destination: RoutePoint;
  destinationType?: string;
  origin: RoutePoint;
  originType?: string;
}): RailRouteResolution | null => {
  const cacheKey = buildCacheKey(origin, destination, originType, destinationType);
  if (ROUTE_CACHE.has(cacheKey)) {
    return ROUTE_CACHE.get(cacheKey) || null;
  }

  const originCandidates = getNearestTerminalCandidates(origin, originType);
  const destinationCandidates = getNearestTerminalCandidates(destination, destinationType);

  if (originCandidates.length === 0 || destinationCandidates.length === 0) {
    ROUTE_CACHE.set(cacheKey, null);
    return null;
  }

  let bestResolution: RailRouteResolution | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const originCandidate of originCandidates) {
    for (const destinationCandidate of destinationCandidates) {
      const path = findShortestRailPath(originCandidate.terminal.id, destinationCandidate.terminal.id);
      if (!path || path.edges.length === 0) {
        if (originCandidate.terminal.id !== destinationCandidate.terminal.id) {
          continue;
        }

        const directGeometry = buildResolvedGeometry(
          origin,
          destination,
          originCandidate.terminal,
          destinationCandidate.terminal,
          [toCoordinate({ lat: originCandidate.terminal.lat, lng: originCandidate.terminal.lng })],
          originType,
          destinationType
        );
        const directDistanceKm = roundDistanceKm(
          originCandidate.distanceKm + destinationCandidate.distanceKm
        );
        if (directDistanceKm < bestScore) {
          bestScore = directDistanceKm;
          bestResolution = {
            distanceKm: directDistanceKm,
            geometry: directGeometry,
            pathTerminalIds: [originCandidate.terminal.id]
          };
        }
        continue;
      }

      const pathGeometry = concatEdgeGeometry(path.edges);
      const distanceKm = roundDistanceKm(polylineDistanceKm(pathGeometry));
      const score =
        path.cost +
        originCandidate.distanceKm * 1.15 +
        destinationCandidate.distanceKm * 1.15 +
        path.edges.length * 12;

      if (score >= bestScore) {
        continue;
      }

      bestScore = score;
      bestResolution = {
        distanceKm,
        geometry: buildResolvedGeometry(
          origin,
          destination,
          originCandidate.terminal,
          destinationCandidate.terminal,
          pathGeometry,
          originType,
          destinationType
        ),
        pathTerminalIds: [
          originCandidate.terminal.id,
          ...path.edges
            .map((edge) => edge.toId)
            .filter((nodeId) => Boolean(RAIL_ROUTE_NODE_BY_ID[nodeId]))
        ]
      };
    }
  }

  ROUTE_CACHE.set(cacheKey, bestResolution);
  return bestResolution;
};
