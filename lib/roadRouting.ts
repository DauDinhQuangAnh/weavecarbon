import {
  buildMapboxDrivingDirectionsUrl,
  hasMapboxPublicToken
} from "@/lib/mapbox";

export type RoutePoint = {
  lat: number;
  lng: number;
};

export type RouteCoordinate = [number, number];

export type RoadRoutePointSource =
  | "search"
  | "map_click"
  | "current_location"
  | "manual"
  | "hub_airport"
  | "hub_port"
  | "hub_rail_terminal"
  | "warehouse";

export type RoadRouteFailureReason =
  | "http_error"
  | "invalid_coordinates"
  | "invalid_geometry"
  | "missing_token"
  | "network_error"
  | "no_route"
  | "no_segment";

export interface FetchRoadRouteOptions {
  destinationSource?: RoadRoutePointSource;
  originSource?: RoadRoutePointSource;
}

export interface RoadRouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: RouteCoordinate[];
  resolvedDestination: RoutePoint;
  resolvedOrigin: RoutePoint;
}

export type RoadRouteResolution =
  | {
      attemptedRadiuses: Array<[SnapRadius, SnapRadius]>;
      ok: true;
      route: RoadRouteResult;
    }
  | {
      attemptedRadiuses: Array<[SnapRadius, SnapRadius]>;
      failureReason: RoadRouteFailureReason;
      ok: false;
    };

type MapboxDirectionsResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: unknown;
    };
  }>;
  waypoints?: Array<{
    distance?: number;
    location?: unknown;
    name?: string;
  }>;
};

type SnapRadius = number | "unlimited";

const DEFAULT_SNAP_PROFILE_METERS =
  [150, 400, 1000, 2500, "unlimited"] as const satisfies readonly SnapRadius[];
const SEARCH_SNAP_PROFILE_METERS =
  [300, 800, 2000, 5000, "unlimited"] as const satisfies readonly SnapRadius[];
const MAP_CLICK_SNAP_PROFILE_METERS =
  [150, 400, 1000, 2500, "unlimited"] as const satisfies readonly SnapRadius[];
const MANUAL_SNAP_PROFILE_METERS =
  [150, 400, 1000, 2500, "unlimited"] as const satisfies readonly SnapRadius[];
const CURRENT_LOCATION_SNAP_PROFILE_METERS =
  [300, 800, 2000, 5000, "unlimited"] as const satisfies readonly SnapRadius[];
const WAREHOUSE_SNAP_PROFILE_METERS =
  [300, 800, 2000, 5000, "unlimited"] as const satisfies readonly SnapRadius[];
const AIRPORT_HUB_SNAP_PROFILE_METERS =
  [800, 2000, 5000, "unlimited"] as const satisfies readonly SnapRadius[];
const PORT_HUB_SNAP_PROFILE_METERS =
  [500, 1500, 4000, "unlimited"] as const satisfies readonly SnapRadius[];
const RAIL_HUB_SNAP_PROFILE_METERS =
  [300, 800, 2000, "unlimited"] as const satisfies readonly SnapRadius[];

const roadRouteCache = new Map<string, Promise<RoadRouteResolution>>();

const normalizeCoordinate = (value: number) => value.toFixed(6);

const normalizeRadiusValue = (value: SnapRadius) =>
  value === "unlimited" ?
    value :
    Math.max(0, Math.round(value * 10) / 10).toFixed(1);

const buildRoadRouteCacheKey = (
  origin: RoutePoint,
  destination: RoutePoint,
  attempts: Array<[SnapRadius, SnapRadius]>
) =>
  [
    normalizeCoordinate(origin.lng),
    normalizeCoordinate(origin.lat),
    normalizeCoordinate(destination.lng),
    normalizeCoordinate(destination.lat),
    ...attempts.flatMap(([originRadius, destinationRadius]) => [
      normalizeRadiusValue(originRadius),
      normalizeRadiusValue(destinationRadius)
    ])
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

const toRoutePoint = (value: unknown): RoutePoint | null => {
  if (!isRouteCoordinate(value)) {
    return null;
  }

  return {
    lat: value[1],
    lng: value[0]
  };
};

const resolveSnapProfile = (
  source: RoadRoutePointSource | undefined
): readonly SnapRadius[] => {
  switch (source) {
    case "search":
      return SEARCH_SNAP_PROFILE_METERS;
    case "map_click":
      return MAP_CLICK_SNAP_PROFILE_METERS;
    case "manual":
      return MANUAL_SNAP_PROFILE_METERS;
    case "current_location":
      return CURRENT_LOCATION_SNAP_PROFILE_METERS;
    case "hub_airport":
      return AIRPORT_HUB_SNAP_PROFILE_METERS;
    case "hub_port":
      return PORT_HUB_SNAP_PROFILE_METERS;
    case "hub_rail_terminal":
      return RAIL_HUB_SNAP_PROFILE_METERS;
    case "warehouse":
      return WAREHOUSE_SNAP_PROFILE_METERS;
    default:
      return DEFAULT_SNAP_PROFILE_METERS;
  }
};

const buildRadiusAttempts = (
  originSource: RoadRoutePointSource | undefined,
  destinationSource: RoadRoutePointSource | undefined
) => {
  const originProfile = resolveSnapProfile(originSource);
  const destinationProfile = resolveSnapProfile(destinationSource);
  const maxLength = Math.max(originProfile.length, destinationProfile.length);

  return Array.from({ length: maxLength }, (_, index) => [
    originProfile[Math.min(index, originProfile.length - 1)],
    destinationProfile[Math.min(index, destinationProfile.length - 1)]
  ] satisfies [SnapRadius, SnapRadius]);
};

const mapDirectionsFailureReason = (
  payload: Partial<MapboxDirectionsResponse> | null | undefined,
  fallback: RoadRouteFailureReason
): RoadRouteFailureReason => {
  const normalizedCode = String(payload?.code || "").trim().toLowerCase();

  if (normalizedCode === "nosegment") {
    return "no_segment";
  }

  if (normalizedCode === "noroute") {
    return "no_route";
  }

  return fallback;
};

const shouldRetry = (reason: RoadRouteFailureReason) =>
  reason === "invalid_geometry" || reason === "no_route" || reason === "no_segment";

const executeRouteAttempt = async (
  origin: RoutePoint,
  destination: RoutePoint,
  attemptRadiuses: [SnapRadius, SnapRadius]
): Promise<
  | {
      ok: true;
      route: RoadRouteResult;
    }
  | {
      failureReason: RoadRouteFailureReason;
      ok: false;
    }
> => {
  const requestUrl = buildMapboxDrivingDirectionsUrl(
    [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    ],
    {
      radiuses: attemptRadiuses
    }
  );

  if (!requestUrl) {
    return {
      failureReason: hasMapboxPublicToken() ? "invalid_coordinates" : "missing_token",
      ok: false
    };
  }

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    let payload: MapboxDirectionsResponse | null = null;
    try {
      payload = (await response.json()) as MapboxDirectionsResponse;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        failureReason: mapDirectionsFailureReason(payload, "http_error"),
        ok: false
      };
    }

    if (payload?.code && payload.code !== "Ok") {
      return {
        failureReason: mapDirectionsFailureReason(payload, "no_route"),
        ok: false
      };
    }

    const firstRoute = payload?.routes?.[0];
    if (!firstRoute) {
      return {
        failureReason: mapDirectionsFailureReason(payload, "no_route"),
        ok: false
      };
    }

    const coordinates = Array.isArray(firstRoute.geometry?.coordinates) ?
      firstRoute.geometry.coordinates.filter(isRouteCoordinate) :
      [];

    if (coordinates.length < 2) {
      return {
        failureReason: "invalid_geometry",
        ok: false
      };
    }

    const resolvedOrigin = toRoutePoint(payload?.waypoints?.[0]?.location) || origin;
    const resolvedDestination = toRoutePoint(payload?.waypoints?.[1]?.location) || destination;

    return {
      ok: true,
      route: {
        distanceKm: roundDistanceKm((firstRoute.distance || 0) / 1000),
        durationMinutes: roundDurationMinutes((firstRoute.duration || 0) / 60),
        geometry: coordinates,
        resolvedDestination,
        resolvedOrigin
      }
    };
  } catch {
    return {
      failureReason: "network_error",
      ok: false
    };
  }
};

export const isRoadTransportMode = (mode: string) =>
  mode === "road" || mode === "truck_light" || mode === "truck_heavy";

export const fetchRoadRoute = async (
  origin: RoutePoint,
  destination: RoutePoint,
  options: FetchRoadRouteOptions = {}
): Promise<RoadRouteResolution> => {
  if (
    !Number.isFinite(origin.lat) ||
    !Number.isFinite(origin.lng) ||
    !Number.isFinite(destination.lat) ||
    !Number.isFinite(destination.lng)
  ) {
    return {
      attemptedRadiuses: [],
      failureReason: "invalid_coordinates",
      ok: false
    };
  }

  if (!hasMapboxPublicToken()) {
    return {
      attemptedRadiuses: [],
      failureReason: "missing_token",
      ok: false
    };
  }

  const radiusAttempts = buildRadiusAttempts(options.originSource, options.destinationSource);
  const cacheKey = buildRoadRouteCacheKey(origin, destination, radiusAttempts);
  const cached = roadRouteCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const attemptedRadiuses: Array<[SnapRadius, SnapRadius]> = [];
    let lastFailureReason: RoadRouteFailureReason = "no_route";

    for (const radiuses of radiusAttempts) {
      attemptedRadiuses.push(radiuses);
      const attemptResult = await executeRouteAttempt(origin, destination, radiuses);

      if (attemptResult.ok) {
        return {
          attemptedRadiuses,
          ok: true,
          route: attemptResult.route
        } satisfies RoadRouteResolution;
      }

      lastFailureReason = attemptResult.failureReason;
      if (!shouldRetry(attemptResult.failureReason)) {
        break;
      }
    }

    return {
      attemptedRadiuses,
      failureReason: lastFailureReason,
      ok: false
    } satisfies RoadRouteResolution;
  })();

  roadRouteCache.set(cacheKey, request);
  return request;
};
