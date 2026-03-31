import {
  SEA_ROUTE_EDGES,
  SEA_ROUTE_NODE_BY_ID,
  SEA_ROUTE_PORTS,
  type SeaRouteCoordinate,
  type SeaRouteEdge,
  type SeaRouteNode
} from "@/lib/seaRouteGraph";

type RoutePoint = {
  lat: number;
  lng: number;
};

type SeaRouteResolution = {
  distanceKm: number;
  geometry: SeaRouteCoordinate[];
  pathPortIds: string[];
};

type SeaPathState = {
  cost: number;
  edges: SeaRouteEdge[];
};

const PORT_MATCH_DISTANCE_KM = 120;
const PORT_STRICT_MATCH_DISTANCE_KM = 30;
const PORT_SNAP_DISTANCE_KM = 700;
const MAX_PORT_CANDIDATES = 4;
const ROUTE_CACHE = new Map<string, SeaRouteResolution | null>();
const ADJACENT_EDGES_BY_NODE_ID = SEA_ROUTE_EDGES.reduce<Record<string, SeaRouteEdge[]>>(
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

const normalizeLongitude = (value: number) => {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
};

const normalizeLongitudeDelta = (value: number) => {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
};

const haversineDistanceKm = (from: RoutePoint, to: RoutePoint) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(normalizeLongitudeDelta(to.lng - from.lng));
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const unwrapCoordinateSequence = (coordinates: SeaRouteCoordinate[]) => {
  if (coordinates.length === 0) {
    return [];
  }

  const [firstLng, firstLat] = coordinates[0];
  const result: SeaRouteCoordinate[] = [[
    roundCoordinate(normalizeLongitude(firstLng)),
    roundCoordinate(firstLat)
  ]];

  for (const [rawLng, rawLat] of coordinates.slice(1)) {
    const previousLng = result[result.length - 1][0];
    let nextLng = normalizeLongitude(rawLng);
    let delta = nextLng - previousLng;

    while (delta > 180) {
      nextLng -= 360;
      delta = nextLng - previousLng;
    }

    while (delta < -180) {
      nextLng += 360;
      delta = nextLng - previousLng;
    }

    result.push([roundCoordinate(nextLng), roundCoordinate(rawLat)]);
  }

  return result;
};

const dedupeCoordinates = (coordinates: SeaRouteCoordinate[]) => {
  const result: SeaRouteCoordinate[] = [];

  for (const coordinate of coordinates) {
    const previous = result[result.length - 1];
    if (previous && previous[0] === coordinate[0] && previous[1] === coordinate[1]) {
      continue;
    }
    result.push(coordinate);
  }

  return result;
};

const polylineDistanceKm = (coordinates: SeaRouteCoordinate[]) => {
  const unwrapped = unwrapCoordinateSequence(coordinates);
  let total = 0;

  for (let index = 1; index < unwrapped.length; index += 1) {
    const [fromLng, fromLat] = unwrapped[index - 1];
    const [toLng, toLat] = unwrapped[index];
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

const toCoordinate = (point: RoutePoint): SeaRouteCoordinate => [
  roundCoordinate(point.lng),
  roundCoordinate(point.lat)
];

const getNearestPortCandidates = (point: RoutePoint, pointType?: string) => {
  const maxSnapDistanceKm =
    pointType === "port" ? PORT_SNAP_DISTANCE_KM : PORT_SNAP_DISTANCE_KM * 1.15;

  const candidates = SEA_ROUTE_PORTS
    .map((port) => ({
      distanceKm: haversineDistanceKm(point, { lat: port.lat, lng: port.lng }),
      port
    }))
    .filter((candidate) => candidate.distanceKm <= maxSnapDistanceKm)
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, MAX_PORT_CANDIDATES);

  if (pointType === "port") {
    const strictCandidates = candidates.filter(
      (candidate) => candidate.distanceKm <= PORT_STRICT_MATCH_DISTANCE_KM
    );
    if (strictCandidates.length > 0) {
      return strictCandidates;
    }
  }

  return candidates;
};

const findShortestSeaPath = (startNodeId: string, endNodeId: string): SeaPathState | null => {
  const distances = new Map<string, SeaPathState>([
    [startNodeId, { cost: 0, edges: [] }]
  ]);
  const queue = new Set<string>([startNodeId]);

  while (queue.size > 0) {
    let currentNodeId: string | null = null;
    let currentState: SeaPathState | null = null;

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

const concatEdgeGeometry = (edges: SeaRouteEdge[]) => {
  const coordinates: SeaRouteCoordinate[] = [];

  edges.forEach((edge, index) => {
    const edgeGeometry = index === 0 ? edge.geometry : edge.geometry.slice(1);
    coordinates.push(...edgeGeometry);
  });

  return dedupeCoordinates(unwrapCoordinateSequence(coordinates));
};

const buildResolvedGeometry = (
  origin: RoutePoint,
  destination: RoutePoint,
  originPort: SeaRouteNode,
  destinationPort: SeaRouteNode,
  pathGeometry: SeaRouteCoordinate[],
  originType?: string,
  destinationType?: string
) => {
  const coordinates: SeaRouteCoordinate[] = [];
  const originCoordinate = toCoordinate(origin);
  const destinationCoordinate = toCoordinate(destination);
  const originPortCoordinate = toCoordinate({ lat: originPort.lat, lng: originPort.lng });
  const destinationPortCoordinate = toCoordinate({
    lat: destinationPort.lat,
    lng: destinationPort.lng
  });
  const originPortDistanceKm = haversineDistanceKm(origin, {
    lat: originPort.lat,
    lng: originPort.lng
  });
  const destinationPortDistanceKm = haversineDistanceKm(destination, {
    lat: destinationPort.lat,
    lng: destinationPort.lng
  });
  const shouldUseOriginCoordinate =
    originType === "port" && originPortDistanceKm <= PORT_STRICT_MATCH_DISTANCE_KM;
  const shouldUseDestinationCoordinate =
    destinationType === "port" && destinationPortDistanceKm <= PORT_STRICT_MATCH_DISTANCE_KM;

  coordinates.push(shouldUseOriginCoordinate ? originCoordinate : originPortCoordinate);
  if (originPortDistanceKm > PORT_MATCH_DISTANCE_KM) {
    coordinates.push(originPortCoordinate);
  }

  coordinates.push(...pathGeometry);

  if (destinationPortDistanceKm > PORT_MATCH_DISTANCE_KM) {
    coordinates.push(destinationPortCoordinate);
  }
  coordinates.push(
    shouldUseDestinationCoordinate ? destinationCoordinate : destinationPortCoordinate
  );

  return dedupeCoordinates(unwrapCoordinateSequence(coordinates));
};

export const resolveSeaRouteGeometry = ({
  origin,
  destination,
  originType,
  destinationType
}: {
  destination: RoutePoint;
  destinationType?: string;
  origin: RoutePoint;
  originType?: string;
}): SeaRouteResolution | null => {
  const cacheKey = buildCacheKey(origin, destination, originType, destinationType);
  if (ROUTE_CACHE.has(cacheKey)) {
    return ROUTE_CACHE.get(cacheKey) || null;
  }

  const originCandidates = getNearestPortCandidates(origin, originType);
  const destinationCandidates = getNearestPortCandidates(destination, destinationType);

  if (originCandidates.length === 0 || destinationCandidates.length === 0) {
    ROUTE_CACHE.set(cacheKey, null);
    return null;
  }

  let bestResolution: SeaRouteResolution | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const originCandidate of originCandidates) {
    for (const destinationCandidate of destinationCandidates) {
      const path = findShortestSeaPath(originCandidate.port.id, destinationCandidate.port.id);
      if (!path || path.edges.length === 0) {
        if (originCandidate.port.id !== destinationCandidate.port.id) {
          continue;
        }

        const directGeometry = buildResolvedGeometry(
          origin,
          destination,
          originCandidate.port,
          destinationCandidate.port,
          [toCoordinate({ lat: originCandidate.port.lat, lng: originCandidate.port.lng })],
          originType,
          destinationType
        );
        const directScore = originCandidate.distanceKm + destinationCandidate.distanceKm;
        if (directScore < bestScore) {
          bestScore = directScore;
          bestResolution = {
            distanceKm: roundDistanceKm(polylineDistanceKm(directGeometry)),
            geometry: directGeometry,
            pathPortIds: [originCandidate.port.id]
          };
        }
        continue;
      }

      const pathGeometry = concatEdgeGeometry(path.edges);
      const score =
        path.cost +
        originCandidate.distanceKm * 1.2 +
        destinationCandidate.distanceKm * 1.2 +
        path.edges.length * 20;

      if (score >= bestScore) {
        continue;
      }

      bestScore = score;
      bestResolution = {
        distanceKm: roundDistanceKm(polylineDistanceKm(pathGeometry)),
        geometry: buildResolvedGeometry(
          origin,
          destination,
          originCandidate.port,
          destinationCandidate.port,
          pathGeometry,
          originType,
          destinationType
        ),
        pathPortIds: [
          originCandidate.port.id,
          ...path.edges.map((edge) => edge.toId).filter((nodeId) => SEA_ROUTE_NODE_BY_ID[nodeId]?.kind === "port")
        ]
      };
    }
  }

  ROUTE_CACHE.set(cacheKey, bestResolution);
  return bestResolution;
};
