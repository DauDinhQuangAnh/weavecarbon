import { resolveRailRouteGeometry } from "@/lib/railRouting";
import { resolveSeaRouteGeometry } from "@/lib/seaRouting";
import type { TransportLeg } from "@/types/transport";

export type RouteGeometryCoordinate = [number, number];

type RoutePoint = {
  lat: number;
  lng: number;
};

type RouteInput = {
  mode?: string;
  routeType?: string;
  origin: RoutePoint;
  destination: RoutePoint;
  geometry?: RouteGeometryCoordinate[];
  originType?: string;
  destinationType?: string;
};

type SupplyChainRouteLike = {
  mode?: string;
  from: RoutePoint;
  to: RoutePoint;
  geometry?: RouteGeometryCoordinate[];
};

const roundCoordinate = (value: number) =>
  Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

const normalizeLongitude = (value: number) => {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
};

const isFiniteCoordinate = (value: unknown): value is RouteGeometryCoordinate =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1]);

const isFinitePoint = (value: RoutePoint | null | undefined): value is RoutePoint =>
  !!value &&
  typeof value.lat === "number" &&
  Number.isFinite(value.lat) &&
  typeof value.lng === "number" &&
  Number.isFinite(value.lng);

const dedupeCoordinates = (coordinates: RouteGeometryCoordinate[]) => {
  const result: RouteGeometryCoordinate[] = [];

  for (const coordinate of coordinates) {
    const previous = result[result.length - 1];
    if (previous && previous[0] === coordinate[0] && previous[1] === coordinate[1]) {
      continue;
    }
    result.push(coordinate);
  }

  return result;
};

const unwrapCoordinateSequence = (coordinates: RouteGeometryCoordinate[]) => {
  if (coordinates.length === 0) {
    return [];
  }

  const [firstLng, firstLat] = coordinates[0];
  const result: RouteGeometryCoordinate[] = [[
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

const sanitizeGeometry = (geometry?: RouteGeometryCoordinate[]) => {
  if (!Array.isArray(geometry)) {
    return null;
  }

  const coordinates = unwrapCoordinateSequence(geometry.filter(isFiniteCoordinate));
  return coordinates.length >= 2 ? dedupeCoordinates(coordinates) : null;
};

const toCoordinate = (point: RoutePoint): RouteGeometryCoordinate => [
  roundCoordinate(point.lng),
  roundCoordinate(point.lat)
];

export const buildTransportRouteGeometry = ({
  mode,
  routeType,
  origin,
  destination,
  geometry,
  originType,
  destinationType
}: RouteInput): RouteGeometryCoordinate[] => {
  const explicitGeometry = sanitizeGeometry(geometry);
  if (explicitGeometry) {
    return explicitGeometry;
  }

  if (!isFinitePoint(origin) || !isFinitePoint(destination)) {
    return [];
  }

  const normalizedMode = String(mode || routeType || "").trim().toLowerCase();
  if (normalizedMode === "ship" || normalizedMode === "sea") {
    const resolved = resolveSeaRouteGeometry({
      origin,
      destination,
      originType,
      destinationType
    });

    if (resolved && resolved.geometry.length >= 2) {
      return resolved.geometry;
    }
  }

  if (normalizedMode === "rail") {
    const resolved = resolveRailRouteGeometry({
      origin,
      destination,
      originType,
      destinationType
    });

    if (resolved && resolved.geometry.length >= 2) {
      return resolved.geometry;
    }
  }

  return [toCoordinate(origin), toCoordinate(destination)];
};

export const buildTransportLegGeometry = (
  leg: Pick<TransportLeg, "mode" | "routeType" | "origin" | "destination" | "geometry">
) =>
  buildTransportRouteGeometry({
    mode: leg.mode,
    routeType: leg.routeType,
    origin: leg.origin,
    destination: leg.destination,
    geometry: leg.geometry,
    originType: leg.origin.type,
    destinationType: leg.destination.type
  });

export const buildSupplyChainRouteGeometry = (route: SupplyChainRouteLike) =>
  buildTransportRouteGeometry({
    mode: route.mode,
    origin: route.from,
    destination: route.to,
    geometry: route.geometry
  });
