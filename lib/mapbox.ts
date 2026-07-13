import { env } from "@/lib/env";

const DEFAULT_MAPBOX_GEOCODING_BASE_URL =
  "https://api.mapbox.com/geocoding/v5/mapbox.places";
const DEFAULT_MAPBOX_DIRECTIONS_BASE_URL =
  "https://api.mapbox.com/directions/v5/mapbox";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const MAPBOX_PUBLIC_TOKEN = (
  env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  ""
).trim();

const rawMapboxGeocodingBaseUrl = (
  env.NEXT_PUBLIC_MAPBOX_GEOCODING_BASE_URL ||
  DEFAULT_MAPBOX_GEOCODING_BASE_URL
).trim();
const rawMapboxDirectionsBaseUrl = (
  env.NEXT_PUBLIC_MAPBOX_DIRECTIONS_BASE_URL ||
  DEFAULT_MAPBOX_DIRECTIONS_BASE_URL
).trim();

export const MAPBOX_GEOCODING_BASE_URL = trimTrailingSlash(rawMapboxGeocodingBaseUrl);
export const MAPBOX_DIRECTIONS_BASE_URL = trimTrailingSlash(rawMapboxDirectionsBaseUrl);

export const hasMapboxPublicToken = () => MAPBOX_PUBLIC_TOKEN.startsWith("pk.");

type MapboxRuntimeLike = {
  accessToken: string | null | undefined;
  setTelemetryEnabled?: (enabled: boolean) => void;
};

export const configureMapboxRuntime = (mapbox: MapboxRuntimeLike) => {
  mapbox.accessToken = MAPBOX_PUBLIC_TOKEN;
  if (typeof mapbox.setTelemetryEnabled === "function") {
    mapbox.setTelemetryEnabled(false);
  }
};

const buildBaseSearchParams = (language?: string) => {
  const params = new URLSearchParams();
  params.set("access_token", MAPBOX_PUBLIC_TOKEN);
  if (language) {
    params.set("language", language);
  }
  return params;
};

export const buildMapboxReverseGeocodingUrl = (
  lng: number,
  lat: number,
  options: {
    language?: string;
    types?: string[];
  } = {}
) => {
  if (!MAPBOX_PUBLIC_TOKEN) return null;

  const base = `${MAPBOX_GEOCODING_BASE_URL}/${lng},${lat}.json`;
  const params = buildBaseSearchParams(options.language);

  if (options.types && options.types.length > 0) {
    params.set("types", options.types.join(","));
  }

  return `${base}?${params.toString()}`;
};

export const buildMapboxForwardGeocodingUrl = (
  query: string,
  options: {
    language?: string;
    limit?: number;
    country?: string | string[];
    types?: string[];
  } = {}
) => {
  if (!MAPBOX_PUBLIC_TOKEN) return null;

  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  const base = `${MAPBOX_GEOCODING_BASE_URL}/${encodeURIComponent(normalizedQuery)}.json`;
  const params = buildBaseSearchParams(options.language);

  if (typeof options.limit === "number" && Number.isFinite(options.limit)) {
    params.set("limit", String(Math.max(1, Math.trunc(options.limit))));
  }

  const countryFilter =
    Array.isArray(options.country) ?
      options.country.map((value) => String(value || "").trim()).filter(Boolean) :
    typeof options.country === "string" ?
      [options.country.trim()].filter(Boolean) :
      [];
  if (countryFilter.length > 0) {
    params.set("country", countryFilter.join(","));
  }

  if (options.types && options.types.length > 0) {
    params.set("types", options.types.join(","));
  }

  return `${base}?${params.toString()}`;
};

export const buildMapboxDrivingDirectionsUrl = (
  coordinates: Array<[number, number]>,
  options: {
    language?: string;
    overview?: "full" | "simplified" | "false";
    geometries?: "geojson" | "polyline" | "polyline6";
    radiuses?: Array<number | "unlimited" | null | undefined>;
    steps?: boolean;
  } = {}
) => {
  if (!MAPBOX_PUBLIC_TOKEN) return null;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const validCoordinates = coordinates.filter(
    (coordinate): coordinate is [number, number] =>
      Array.isArray(coordinate) &&
      coordinate.length === 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1])
  );

  if (validCoordinates.length < 2) return null;

  const coordinatePath = validCoordinates
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(";");
  const base = `${MAPBOX_DIRECTIONS_BASE_URL}/driving/${coordinatePath}`;
  const params = buildBaseSearchParams(options.language);

  params.set("alternatives", "false");
  params.set("overview", options.overview || "full");
  params.set("geometries", options.geometries || "geojson");
  params.set("steps", options.steps ? "true" : "false");

  if (Array.isArray(options.radiuses) && options.radiuses.length > 0) {
    const normalizedRadiuses = validCoordinates.map((_, index) => {
      const radius = options.radiuses?.[index];
      if (radius === "unlimited") {
        return radius;
      }
      if (typeof radius === "number" && Number.isFinite(radius) && radius >= 0) {
        return String(radius);
      }
      return "unlimited";
    });

    if (normalizedRadiuses.length >= 2) {
      params.set("radiuses", normalizedRadiuses.join(";"));
    }
  }

  return `${base}?${params.toString()}`;
};
