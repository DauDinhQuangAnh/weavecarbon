import { buildMapboxDrivingDirectionsUrl } from "@/lib/mapbox";

export type RoutePoint = {
  lat: number;
  lng: number;
};

export type RouteCoordinate = [number, number];

export interface RoadRouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: RouteCoordinate[];
}

type MapboxDirectionsResponse = {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: unknown;
    };
  }>;
};

const roadRouteCache = new Map<string, Promise<RoadRouteResult | null>>();

const normalizeCoordinate = (value: number) => value.toFixed(6);

const buildRoadRouteCacheKey = (origin: RoutePoint, destination: RoutePoint) =>
  [
    normalizeCoordinate(origin.lng),
    normalizeCoordinate(origin.lat),
    normalizeCoordinate(destination.lng),
    normalizeCoordinate(destination.lat)
  ].join(":");

const isRouteCoordinate = (value: unknown): value is RouteCoordinate =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1]);

const roundDistanceKm = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 10) / 10;

const roundDurationMinutes = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 10) / 10;

export const isRoadTransportMode = (mode: string) =>
  mode === "road" || mode === "truck_light" || mode === "truck_heavy";

export const fetchRoadRoute = async (
  origin: RoutePoint,
  destination: RoutePoint
): Promise<RoadRouteResult | null> => {
  if (
    !Number.isFinite(origin.lat) ||
    !Number.isFinite(origin.lng) ||
    !Number.isFinite(destination.lat) ||
    !Number.isFinite(destination.lng)
  ) {
    return null;
  }

  const cacheKey = buildRoadRouteCacheKey(origin, destination);
  const cached = roadRouteCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const requestUrl = buildMapboxDrivingDirectionsUrl([
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    ]);

    if (!requestUrl) {
      return null;
    }

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json() as MapboxDirectionsResponse;
      const firstRoute = payload.routes?.[0];
      if (!firstRoute) {
        return null;
      }

      const coordinates = Array.isArray(firstRoute.geometry?.coordinates) ?
        firstRoute.geometry.coordinates.filter(isRouteCoordinate) :
        [];

      if (coordinates.length < 2) {
        return null;
      }

      return {
        distanceKm: roundDistanceKm((firstRoute.distance || 0) / 1000),
        durationMinutes: roundDurationMinutes((firstRoute.duration || 0) / 60),
        geometry: coordinates
      };
    } catch {
      return null;
    }
  })();

  roadRouteCache.set(cacheKey, request);
  return request;
};
