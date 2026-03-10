const DEFAULT_MAPBOX_GEOCODING_BASE_URL =
  "https://api.mapbox.com/geocoding/v5/mapbox.places";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const MAPBOX_PUBLIC_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();

const rawMapboxGeocodingBaseUrl = (
  process.env.NEXT_PUBLIC_MAPBOX_GEOCODING_BASE_URL ||
  DEFAULT_MAPBOX_GEOCODING_BASE_URL
).trim();

export const MAPBOX_GEOCODING_BASE_URL = trimTrailingSlash(rawMapboxGeocodingBaseUrl);

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

  if (options.types && options.types.length > 0) {
    params.set("types", options.types.join(","));
  }

  return `${base}?${params.toString()}`;
};
