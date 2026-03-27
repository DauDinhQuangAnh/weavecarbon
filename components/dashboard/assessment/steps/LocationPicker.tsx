"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Search, X, Navigation } from "lucide-react";
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

interface LocationPickerProps {
  address: AddressInput;
  onChange: (address: AddressInput, meta?: LocationPickerChangeMeta) => void;
  label: string;
  defaultCenter?: [number, number];
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

const LocationPicker: React.FC<LocationPickerProps> = ({
  address,
  onChange,
  label,
  defaultCenter = [106.6297, 10.8231]
}) => {
  const t = useTranslations("assessment.locationPicker");
  const tAddress = useTranslations("addressSelection");
  const locale = useLocale();
  const mapLanguage = locale === "vi" ? "vi" : "en";

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const initialAddressRef = useRef({ lat: address.lat, lng: address.lng });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const addressRef = useRef(address);
  addressRef.current = address;

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

  const reverseGeocode = useCallback(
    async (lng: number, lat: number, source: RoadRoutePointSource = "manual") => {
      try {
        const reverseGeocodingUrl = buildMapboxReverseGeocodingUrl(lng, lat, {
          language: mapLanguage,
          types: [...REVERSE_GEOCODING_TYPES]
        });
        if (!reverseGeocodingUrl) {
          onChangeRef.current({
            ...addressRef.current,
            lat,
            lng
          }, { source });
          return;
        }

        const response = await fetch(reverseGeocodingUrl);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const feature = pickBestReverseGeocodingFeature(data.features) || data.features[0];
          const addressParts = parseGeocodingResult(feature);

          onChangeRef.current({
            ...addressRef.current,
            ...addressParts,
            lat,
            lng
          }, { source });
          return;
        }

        onChangeRef.current({
          ...addressRef.current,
          lat,
          lng
        }, { source });
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        onChangeRef.current({
          ...addressRef.current,
          lat,
          lng
        }, { source });
      }
    },
    [mapLanguage, parseGeocodingResult, pickBestReverseGeocodingFeature]
  );

  const addMarker = useCallback(
    (lng: number, lat: number) => {
      if (!mapRef.current) return;

      if (markerRef.current) {
        markerRef.current.remove();
      }

      const marker = new mapboxgl.Marker({
        color: "#10b981",
        draggable: true
      })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

      marker.on("dragend", async () => {
        const lngLat = marker.getLngLat();
        await reverseGeocode(lngLat.lng, lngLat.lat, "manual");
      });

      markerRef.current = marker;

      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 1000
      });
    },
    [reverseGeocode]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      configureMapboxRuntime(mapboxgl);

      const initialLat = initialAddressRef.current.lat;
      const initialLng = initialAddressRef.current.lng;
      const initialCenter: [number, number] =
        initialLng && initialLat ? [initialLng, initialLat] : defaultCenter;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: initialCenter,
        zoom: initialLat && initialLng ? 14 : 10,
        attributionControl: false
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (initialLat && initialLng) {
          const marker = new mapboxgl.Marker({
            color: "#10b981",
            draggable: true
          })
            .setLngLat([initialLng, initialLat])
            .addTo(map);

          marker.on("dragend", async () => {
            const lngLat = marker.getLngLat();
            await reverseGeocode(lngLat.lng, lngLat.lat, "manual");
          });

          markerRef.current = marker;
        }
      });

      map.on("click", async (event) => {
        const { lng, lat } = event.lngLat;
        addMarker(lng, lat);
        await reverseGeocode(lng, lat, "map_click");
      });

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  }, [addMarker, defaultCenter, reverseGeocode]);

  const searchLocation = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const forwardGeocodingUrl = buildMapboxForwardGeocodingUrl(query, {
          limit: 5,
          language: mapLanguage,
          types: ["address", "poi", "neighborhood", "locality", "place", "district", "region"]
        });
        if (!forwardGeocodingUrl) {
          setSearchResults([]);
          return;
        }

        const response = await fetch(forwardGeocodingUrl);
        const data = await response.json();
        setSearchResults(
          Array.isArray(data.features) ?
            sortForwardGeocodingResults(data.features) :
            []
        );
        setShowResults(true);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      }
    },
    [mapLanguage, sortForwardGeocodingResults]
  );

  const selectLocation = (result: GeocodingResult) => {
    const [lng, lat] = result.center;
    addMarker(lng, lat);

    const addressParts = parseGeocodingResult(result);
    onChange({
      ...address,
      ...addressParts,
      lat,
      lng
    }, { source: "search" });

    setSearchQuery(result.place_name);
    setShowResults(false);
    setSearchResults([]);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 3) {
        searchLocation(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchLocation, searchQuery]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      window.alert(t("browserNotSupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { longitude, latitude } = position.coords;
        addMarker(longitude, latitude);
        setShowResults(false);
        setSearchResults([]);
        await reverseGeocode(longitude, latitude, "current_location");
      },
      () => {
        window.alert(t("cannotGetLocation"));
      }
    );
  };

  const aptSuiteValue = [address.ward, address.district]
    .map((part) => part.trim())
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

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={getCurrentLocation}
              title={t("currentLocation")}
            >
              <Navigation className="w-4 h-4" />
            </Button>
          </div>

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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {tAddress("aptSuiteLabel")}
            </Label>
            <Input
              value={aptSuiteValue}
              placeholder={tAddress("aptSuitePlaceholder")}
              onChange={(event) => {
                const nextValue = event.target.value.trim();
                if (!nextValue) {
                  onChange({
                    ...address,
                    ward: "",
                    district: ""
                  });
                  return;
                }

                const [ward, ...districtParts] = nextValue
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean);

                onChange({
                  ...address,
                  ward: ward || "",
                  district: districtParts.join(", ")
                });
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
                onChange({
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
              value={address.country || ""}
              placeholder={tAddress("countryPlaceholder")}
              onChange={(event) =>
                onChange({
                  ...address,
                  country: event.target.value
                })
              }
            />
          </div>
        </div>

        {address.lat && address.lng ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
            <MapPin className="w-3 h-3" />
            <span>
              {address.lat.toFixed(6)}, {address.lng.toFixed(6)}
            </span>
            {address.city || address.stateRegion ? (
              <>
                <span className="mx-1">|</span>
                <span>
                  {address.city || address.stateRegion}, {address.country}
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

export default LocationPicker;
