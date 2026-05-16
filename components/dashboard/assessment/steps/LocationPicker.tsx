"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, Navigation, Search, X } from "lucide-react";
import {
  buildMapboxForwardGeocodingUrl,
  buildMapboxReverseGeocodingUrl,
  configureMapboxRuntime
} from "@/lib/mapbox";
import { type RoadRoutePointSource } from "@/lib/roadRouting";
import { AddressInput } from "./types";

export interface LocationPickerChangeMeta {
  source: RoadRoutePointSource;
}

type ReverseGeocodeHandler = (
  lng: number,
  lat: number,
  source?: RoadRoutePointSource
) => Promise<void>;

interface LocationPickerProps {
  address: AddressInput;
  onChange: (address: AddressInput, meta?: LocationPickerChangeMeta) => void;
  label: string;
  defaultCenter?: [number, number];
  showCurrentLocationButton?: boolean;
  autoLocateOnMount?: boolean;
  lockedCountry?: string;
  onInvalidCountrySelection?: (country: string | null) => void;
}

interface GeocodingResult {
  id?: string;
  place_name: string;
  center: [number, number];
  place_type?: string[];
  context?: Array<{
    id: string;
    text: string;
  }>;
  address?: string;
  text?: string;
  properties?: {
    address?: string;
  };
}

const REVERSE_GEOCODING_TYPES = [
  "address",
  "neighborhood",
  "locality",
  "place",
  "district",
  "region",
  "postcode",
  "country"
] as const;

const REVERSE_GEOCODING_TYPE_PRIORITY: Record<string, number> = {
  address: 0,
  street: 1,
  neighborhood: 2,
  locality: 3,
  place: 4,
  district: 5,
  region: 6,
  postcode: 7,
  country: 8
};

const FORWARD_GEOCODING_TYPE_PRIORITY: Record<string, number> = {
  address: 0,
  poi: 1,
  neighborhood: 2,
  locality: 3,
  place: 4,
  district: 5,
  region: 6,
  country: 7
};

const MARKER_SYNC_EPSILON = 0.00001;
const TARGET_MAP_ZOOM = 14;

const EMPTY_ADDRESS_PARTS: Omit<
  AddressInput,
  "lat" | "lng"
> = {
  aptSuite: "",
  streetNumber: "",
  street: "",
  ward: "",
  district: "",
  city: "",
  stateRegion: "",
  country: "",
  postalCode: ""
};

const isFiniteCoordinate = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const hasCoordinatePair = (
  lat: number | undefined,
  lng: number | undefined
) => isFiniteCoordinate(lat) && isFiniteCoordinate(lng);

const normalizeCountryToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const MAPBOX_COUNTRY_FILTER_BY_NAME: Record<string, string> = {
  vietnam: "vn",
  unitedstates: "us",
  usa: "us",
  southkorea: "kr",
  korea: "kr",
  japan: "jp",
  germany: "de",
  china: "cn"
};

const resolveMapboxCountryFilter = (value: string | null | undefined) => {
  const normalized = normalizeCountryToken(value);
  return MAPBOX_COUNTRY_FILTER_BY_NAME[normalized] || null;
};

const hasAddressContent = (address: AddressInput) =>
  Boolean(
    address.streetNumber.trim() ||
      address.street.trim() ||
      address.ward.trim() ||
      address.district.trim() ||
      address.city.trim() ||
      address.stateRegion.trim() ||
      address.country.trim() ||
      address.postalCode.trim() ||
      hasCoordinatePair(address.lat, address.lng)
  );

const LocationPicker: React.FC<LocationPickerProps> = ({
  address,
  onChange,
  label,
  defaultCenter = [106.6297, 10.8231],
  showCurrentLocationButton = true,
  autoLocateOnMount = false,
  lockedCountry,
  onInvalidCountrySelection
}) => {
  const t = useTranslations("assessment.locationPicker");
  const tAddress = useTranslations("addressSelection");
  const locale = useLocale();
  const mapLanguage = locale === "vi" ? "vi" : "en";

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const reverseGeocodeAbortRef = useRef<AbortController | null>(null);
  const reverseGeocodeRequestSeqRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestSeqRef = useRef(0);
  const skipNextSearchRef = useRef(false);
  const autoLocateAttemptedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const addressRef = useRef(address);
  addressRef.current = address;

  const reverseGeocodeRef = useRef<ReverseGeocodeHandler>(async () => {});
  const normalizedLockedCountry = normalizeCountryToken(lockedCountry);
  const mapboxCountryFilter = resolveMapboxCountryFilter(lockedCountry);

  const resetMapToDefaultCenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const [defaultLng, defaultLat] = defaultCenter;
    const currentCenter = map.getCenter();
    const centerChanged =
      Math.abs(currentCenter.lng - defaultLng) >= MARKER_SYNC_EPSILON ||
      Math.abs(currentCenter.lat - defaultLat) >= MARKER_SYNC_EPSILON ||
      Math.abs(map.getZoom() - 10) >= 0.1;

    if (centerChanged) {
      map.flyTo({
        center: defaultCenter,
        zoom: 10,
        duration: 500,
        essential: true
      });
    }
  }, [defaultCenter]);

  const applyLocationPart = useCallback(
    (result: Partial<AddressInput>, partId: string | undefined, partText: string | undefined) => {
      const normalizedPartId = String(partId || "").trim().toLowerCase();
      const normalizedPartText = String(partText || "").trim();
      if (!normalizedPartId || !normalizedPartText) {
        return;
      }

      if (normalizedPartId.startsWith("locality") || normalizedPartId.startsWith("neighborhood")) {
        result.ward = normalizedPartText;
        return;
      }

      if (normalizedPartId.startsWith("district")) {
        result.district = normalizedPartText;
        return;
      }

      if (normalizedPartId.startsWith("place")) {
        result.city = normalizedPartText;
        return;
      }

      if (normalizedPartId.startsWith("region")) {
        result.stateRegion = normalizedPartText;
        return;
      }

      if (normalizedPartId.startsWith("country")) {
        result.country = normalizedPartText;
        return;
      }

      if (normalizedPartId.startsWith("postcode")) {
        result.postalCode = normalizedPartText;
      }
    },
    []
  );

  const parseGeocodingResult = useCallback(
    (feature: GeocodingResult): Partial<AddressInput> => {
      const result: Partial<AddressInput> = {};
      const topLevelType = feature.place_type?.[0] || feature.id?.split(".")[0] || "";
      const featureAddress = feature.address || feature.properties?.address;

      if (featureAddress && (topLevelType === "address" || topLevelType === "street")) {
        result.streetNumber = featureAddress;
      }
      if (feature.text && (topLevelType === "address" || topLevelType === "street")) {
        result.street = feature.text;
      }

      applyLocationPart(result, topLevelType, feature.text);

      if (feature.context) {
        feature.context.forEach((ctx) => {
          applyLocationPart(result, ctx.id, ctx.text);
        });
      }

      if (!result.stateRegion && result.city) {
        result.stateRegion = result.city;
      }

      if (!result.city && result.stateRegion) {
        result.city = result.stateRegion;
      }

      return result;
    },
    [applyLocationPart]
  );

  const buildGeocodedAddress = useCallback(
    (lat: number, lng: number, addressParts: Partial<AddressInput>) => ({
      ...addressRef.current,
      ...EMPTY_ADDRESS_PARTS,
      ...addressParts,
      lat,
      lng
    }),
    []
  );

  const isCountryAllowed = useCallback(
    (country: string | null | undefined) => {
      if (!normalizedLockedCountry) return true;
      const normalizedCountry = normalizeCountryToken(country);
      return !normalizedCountry || normalizedCountry === normalizedLockedCountry;
    },
    [normalizedLockedCountry]
  );

  const pickBestReverseGeocodingFeature = useCallback((features: GeocodingResult[]) => {
    return features.reduce<GeocodingResult | null>((bestFeature, feature) => {
      if (!bestFeature) {
        return feature;
      }

      const bestType = bestFeature.place_type?.[0] || bestFeature.id?.split(".")[0] || "";
      const currentType = feature.place_type?.[0] || feature.id?.split(".")[0] || "";
      const bestPriority = REVERSE_GEOCODING_TYPE_PRIORITY[bestType] ?? Number.MAX_SAFE_INTEGER;
      const currentPriority =
        REVERSE_GEOCODING_TYPE_PRIORITY[currentType] ?? Number.MAX_SAFE_INTEGER;

      if (currentPriority < bestPriority) {
        return feature;
      }

      if (currentPriority > bestPriority) {
        return bestFeature;
      }

      const bestHasAddress = Boolean(bestFeature.address || bestFeature.properties?.address);
      const currentHasAddress = Boolean(feature.address || feature.properties?.address);

      if (currentHasAddress && !bestHasAddress) {
        return feature;
      }

      return bestFeature;
    }, null);
  }, []);

  const sortForwardGeocodingResults = useCallback((features: GeocodingResult[]) => {
    return [...features].sort((left, right) => {
      const leftType = left.place_type?.[0] || left.id?.split(".")[0] || "";
      const rightType = right.place_type?.[0] || right.id?.split(".")[0] || "";
      const leftPriority =
        FORWARD_GEOCODING_TYPE_PRIORITY[leftType] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority =
        FORWARD_GEOCODING_TYPE_PRIORITY[rightType] ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.place_name.length - right.place_name.length;
    });
  }, []);

  const syncMarker = useCallback(
    (lng: number, lat: number, options?: { flyTo?: boolean }) => {
      const map = mapRef.current;
      if (!map) return;

      if (!markerRef.current) {
        const marker = new mapboxgl.Marker({
          color: "#10b981",
          draggable: true
        })
          .setLngLat([lng, lat])
          .addTo(map);

        marker.on("dragend", () => {
          const currentMarker = markerRef.current;
          if (!currentMarker) return;
          const lngLat = currentMarker.getLngLat();
          void reverseGeocodeRef.current(lngLat.lng, lngLat.lat, "manual");
        });

        markerRef.current = marker;
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }

      if (options?.flyTo !== false) {
        const currentCenter = map.getCenter();
        const centerChanged =
          Math.abs(currentCenter.lng - lng) >= MARKER_SYNC_EPSILON ||
          Math.abs(currentCenter.lat - lat) >= MARKER_SYNC_EPSILON ||
          Math.abs(map.getZoom() - TARGET_MAP_ZOOM) >= 0.1;

        if (centerChanged) {
          map.flyTo({
            center: [lng, lat],
            zoom: TARGET_MAP_ZOOM,
            duration: 800,
            essential: true
          });
        }
      }
    },
    []
  );

  const restoreMarkerToCurrentAddress = useCallback(() => {
    const currentAddress = addressRef.current;
    if (hasCoordinatePair(currentAddress.lat, currentAddress.lng)) {
      syncMarker(currentAddress.lng as number, currentAddress.lat as number, {
        flyTo: false
      });
      return;
    }

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    resetMapToDefaultCenter();
  }, [resetMapToDefaultCenter, syncMarker]);

  const commitAddressChange = useCallback(
    (nextAddress: AddressInput, source: RoadRoutePointSource) => {
      const detectedCountry = nextAddress.country?.trim() || null;
      if (!isCountryAllowed(detectedCountry)) {
        onInvalidCountrySelection?.(detectedCountry);
        restoreMarkerToCurrentAddress();
        setShowResults(false);
        setSearchResults([]);
        return false;
      }

      const normalizedAddress =
        lockedCountry && detectedCountry ?
          {
            ...nextAddress,
            country: lockedCountry
          } :
          nextAddress;

      addressRef.current = normalizedAddress;
      onChangeRef.current(normalizedAddress, { source });
      return true;
    },
    [isCountryAllowed, lockedCountry, onInvalidCountrySelection, restoreMarkerToCurrentAddress]
  );

  const reverseGeocode = useCallback(
    async (lng: number, lat: number, source: RoadRoutePointSource = "manual") => {
      const requestSeq = reverseGeocodeRequestSeqRef.current + 1;
      reverseGeocodeRequestSeqRef.current = requestSeq;
      reverseGeocodeAbortRef.current?.abort();
      const controller = new AbortController();
      reverseGeocodeAbortRef.current = controller;

      try {
        const reverseGeocodingUrl = buildMapboxReverseGeocodingUrl(lng, lat, {
          language: mapLanguage,
          types: [...REVERSE_GEOCODING_TYPES]
        });
        if (!reverseGeocodingUrl) {
          if (
            controller.signal.aborted ||
            requestSeq !== reverseGeocodeRequestSeqRef.current
          ) {
            return;
          }
          if (normalizedLockedCountry) {
            onInvalidCountrySelection?.(null);
            restoreMarkerToCurrentAddress();
            return;
          }
          commitAddressChange(
            {
              ...addressRef.current,
              lat,
              lng
            },
            source
          );
          return;
        }

        const response = await fetch(reverseGeocodingUrl, {
          signal: controller.signal
        });
        const data = await response.json();
        if (
          controller.signal.aborted ||
          requestSeq !== reverseGeocodeRequestSeqRef.current
        ) {
          return;
        }

        if (data.features && data.features.length > 0) {
          const feature = pickBestReverseGeocodingFeature(data.features) || data.features[0];
          const addressParts = parseGeocodingResult(feature);
          const nextAddress = buildGeocodedAddress(lat, lng, addressParts);
          commitAddressChange(nextAddress, source);
          return;
        }

        if (normalizedLockedCountry) {
          onInvalidCountrySelection?.(null);
          restoreMarkerToCurrentAddress();
          return;
        }

        commitAddressChange(
          {
            ...addressRef.current,
            lat,
            lng
          },
          source
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Reverse geocoding error:", error);
        if (requestSeq !== reverseGeocodeRequestSeqRef.current) {
          return;
        }
        if (normalizedLockedCountry) {
          onInvalidCountrySelection?.(null);
          restoreMarkerToCurrentAddress();
          return;
        }
        commitAddressChange(
          {
            ...addressRef.current,
            lat,
            lng
          },
          source
        );
      } finally {
        if (reverseGeocodeAbortRef.current === controller) {
          reverseGeocodeAbortRef.current = null;
        }
      }
    },
    [
      buildGeocodedAddress,
      commitAddressChange,
      mapLanguage,
      normalizedLockedCountry,
      onInvalidCountrySelection,
      parseGeocodingResult,
      pickBestReverseGeocodingFeature,
      restoreMarkerToCurrentAddress
    ]
  );
  reverseGeocodeRef.current = reverseGeocode;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      configureMapboxRuntime(mapboxgl);

      const initialLat = address.lat;
      const initialLng = address.lng;
      const hasInitialCoordinates = hasCoordinatePair(initialLat, initialLng);
      const initialCenter: [number, number] =
        hasInitialCoordinates ?
          [initialLng as number, initialLat as number] :
          defaultCenter;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: initialCenter,
        zoom: hasInitialCoordinates ? TARGET_MAP_ZOOM : 10,
        attributionControl: false
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (hasInitialCoordinates) {
          syncMarker(initialLng as number, initialLat as number, { flyTo: false });
        }
      });

      map.on("click", async (event) => {
        const { lng, lat } = event.lngLat;
        syncMarker(lng, lat);
        setShowResults(false);
        setSearchResults([]);
        await reverseGeocodeRef.current(lng, lat, "map_click");
      });

      return () => {
        reverseGeocodeAbortRef.current?.abort();
        searchAbortRef.current?.abort();
        markerRef.current?.remove();
        markerRef.current = null;
        map.remove();
        mapRef.current = null;
      };
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  }, [address.lat, address.lng, defaultCenter, syncMarker]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (hasCoordinatePair(address.lat, address.lng)) {
      const nextLat = address.lat as number;
      const nextLng = address.lng as number;
      const currentMarkerPosition = markerRef.current?.getLngLat();
      const needsMarkerSync =
        !currentMarkerPosition ||
        Math.abs(currentMarkerPosition.lat - nextLat) >= MARKER_SYNC_EPSILON ||
          Math.abs(currentMarkerPosition.lng - nextLng) >= MARKER_SYNC_EPSILON;

      if (needsMarkerSync) {
        syncMarker(nextLng, nextLat, { flyTo: false });
      }

      return;
    }

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    resetMapToDefaultCenter();
  }, [address.lat, address.lng, resetMapToDefaultCenter, syncMarker]);

  const applyManualAddressChange = useCallback(
    (
      nextAddress: AddressInput,
      options?: {
        preserveCoordinates?: boolean;
      }
    ) => {
      const preserveCoordinates = options?.preserveCoordinates === true;
      const updatedAddress: AddressInput =
        preserveCoordinates ?
          nextAddress :
          {
            ...nextAddress,
            lat: undefined,
            lng: undefined
          };

      addressRef.current = updatedAddress;

      if (!preserveCoordinates && markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      setShowResults(false);
      setSearchResults([]);
      onChangeRef.current(updatedAddress, { source: "manual" });

      if (!preserveCoordinates) {
        resetMapToDefaultCenter();
      }
    },
    [resetMapToDefaultCenter]
  );

  const searchLocation = useCallback(
    async (query: string) => {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        searchAbortRef.current?.abort();
        setSearchResults([]);
        return;
      }

      const requestSeq = searchRequestSeqRef.current + 1;
      searchRequestSeqRef.current = requestSeq;
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const forwardGeocodingUrl = buildMapboxForwardGeocodingUrl(normalizedQuery, {
          country: mapboxCountryFilter || undefined,
          limit: 5,
          language: mapLanguage,
          types: ["address", "poi", "neighborhood", "locality", "place", "district", "region"]
        });
        if (!forwardGeocodingUrl) {
          if (
            !controller.signal.aborted &&
            requestSeq === searchRequestSeqRef.current
          ) {
            setSearchResults([]);
          }
          setSearchResults([]);
          return;
        }

        const response = await fetch(forwardGeocodingUrl, {
          signal: controller.signal
        });
        const data = await response.json();
        if (
          controller.signal.aborted ||
          requestSeq !== searchRequestSeqRef.current
        ) {
          return;
        }
        const nextResults =
          Array.isArray(data.features) ?
            sortForwardGeocodingResults(data.features).filter((feature) =>
              isCountryAllowed(parseGeocodingResult(feature).country)
            ) :
            [];
        setSearchResults(nextResults);
        setShowResults(true);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Search error:", error);
        if (requestSeq !== searchRequestSeqRef.current) {
          return;
        }
        setSearchResults([]);
      } finally {
        if (searchAbortRef.current === controller) {
          searchAbortRef.current = null;
        }
      }
    },
    [isCountryAllowed, mapLanguage, mapboxCountryFilter, parseGeocodingResult, sortForwardGeocodingResults]
  );

  const selectLocation = (result: GeocodingResult) => {
    const addressParts = parseGeocodingResult(result);
    const detectedCountry = addressParts.country || null;
    if (!isCountryAllowed(detectedCountry)) {
      onInvalidCountrySelection?.(detectedCountry);
      setShowResults(false);
      setSearchResults([]);
      return;
    }

    const [lng, lat] = result.center;
    syncMarker(lng, lat);
    const nextAddress = buildGeocodedAddress(lat, lng, addressParts);
    void commitAddressChange(nextAddress, "search");

    skipNextSearchRef.current = true;
    setSearchQuery(result.place_name);
    setShowResults(false);
    setSearchResults([]);
  };

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < 3) {
      searchAbortRef.current?.abort();
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(() => {
      void searchLocation(normalizedQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchLocation, searchQuery]);

  const getCurrentLocation = useCallback((options?: { silent?: boolean }) => {
    if (!navigator.geolocation) {
      if (!options?.silent) {
        window.alert(t("browserNotSupported"));
      }
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { longitude, latitude } = position.coords;
          syncMarker(longitude, latitude);
          setShowResults(false);
          setSearchResults([]);
          await reverseGeocode(longitude, latitude, "current_location");
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        if (!options?.silent) {
          window.alert(t("cannotGetLocation"));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, [reverseGeocode, syncMarker, t]);

  useEffect(() => {
    if (!autoLocateOnMount || autoLocateAttemptedRef.current) {
      return;
    }

    if (hasAddressContent(addressRef.current)) {
      return;
    }

    autoLocateAttemptedRef.current = true;
    getCurrentLocation({ silent: true });
  }, [autoLocateOnMount, getCurrentLocation]);

  const streetAddressInputValue = [address.streetNumber, address.street]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const districtWardFallback = (() => {
    const normalizedDistrict = (address.district || "").trim();
    if (normalizedDistrict) return normalizedDistrict;

    const normalizedCity = (address.city || "").trim();
    const normalizedStateRegion = (address.stateRegion || "").trim();
    if (
      normalizedCity &&
      normalizedCity.toLowerCase() !== normalizedStateRegion.toLowerCase()
    ) {
      return normalizedCity;
    }

    return "";
  })();
  const districtWardInputValue = [address.ward, districtWardFallback]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  const selectedLocationSummary = [
    streetAddressInputValue,
    address.ward,
    districtWardFallback,
    address.city || address.stateRegion,
    address.country
  ]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="w-4 h-4 text-primary" />
          {label}
        </div>

        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9 pr-8"
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
              />

              {searchQuery ? (
                <button
                  onClick={() => {
                    searchAbortRef.current?.abort();
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {showCurrentLocationButton ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => getCurrentLocation()}
                title={isLocating ? t("locating") : t("currentLocation")}
                aria-label={isLocating ? t("locating") : t("currentLocation")}
                disabled={isLocating}
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </Button>
            ) : null}
          </div>

          {isLocating ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t("locating")}</span>
            </div>
          ) : null}

          {showResults && searchResults.length > 0 ? (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.place_name}-${index}`}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-start gap-2"
                  onClick={() => selectLocation(result)}
                >
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{result.place_name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div
          ref={mapContainerRef}
          className="w-full rounded-lg overflow-hidden border"
          style={{ height: "250px" }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              {tAddress("streetAddressLabel")}
            </Label>
            <Input
              value={streetAddressInputValue}
              placeholder={tAddress("streetAddressPlaceholder")}
              onChange={(event) =>
                applyManualAddressChange(
                  {
                    ...address,
                    streetNumber: "",
                    street: event.target.value
                  },
                  { preserveCoordinates: true }
                )
              }
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {tAddress("districtWardLabel")}
            </Label>
            <Input
              value={districtWardInputValue}
              placeholder={tAddress("districtWardPlaceholder")}
              onChange={(event) => {
                const nextValue = event.target.value.trim();
                if (!nextValue) {
                  applyManualAddressChange(
                    {
                      ...address,
                      ward: "",
                      district: ""
                    },
                    { preserveCoordinates: true }
                  );
                  return;
                }

                const [ward, ...districtParts] = nextValue
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean);

                applyManualAddressChange(
                  {
                    ...address,
                    ward: ward || "",
                    district: districtParts.join(", ")
                  },
                  { preserveCoordinates: true }
                );
              }}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {tAddress("provinceLabel")}
            </Label>
            <Input
              value={address.stateRegion || address.city || ""}
              placeholder={tAddress("stateProvincePlaceholder")}
              onChange={(event) =>
                applyManualAddressChange({
                  ...address,
                  stateRegion: event.target.value
                })
              }
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              {tAddress("countryLabel")}
            </Label>
            <Input
              value={lockedCountry || address.country || ""}
              placeholder={tAddress("countryPlaceholder")}
              disabled={Boolean(lockedCountry)}
              onChange={(event) =>
                applyManualAddressChange({
                  ...address,
                  country: event.target.value
                })
              }
            />
          </div>
        </div>

        {hasCoordinatePair(address.lat, address.lng) ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
            <MapPin className="w-3 h-3" />
            <span>
              {(address.lat as number).toFixed(6)}, {(address.lng as number).toFixed(6)}
            </span>
            {selectedLocationSummary ? (
              <>
                <span className="mx-1">|</span>
                <span className="line-clamp-1">
                  {selectedLocationSummary}
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">{t("mapHint")}</p>
      </CardContent>
    </Card>
  );
};

export default React.memo(LocationPicker);
