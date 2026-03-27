"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronRight,
  Globe,
  Navigation,
  Plane,
  RefreshCw,
  Ship,
  Truck
} from "lucide-react";
import type { TransportLeg, TransportLocation } from "@/types/transport";
import { configureMapboxRuntime } from "@/lib/mapbox";
import {
  isRoadTransportMode,
  type RoadRoutePointSource
} from "@/lib/roadRouting";
import { useResolvedRoadRouteGeometry } from "@/hooks/useResolvedRoadRouteGeometry";

interface TransportMapProps {
  legs: TransportLeg[];
  onRefresh?: () => void;
  mapSubject?: string;
  mapSubjectMeta?: string;
  showSubjectMeta?: boolean;
  stackSubjectOnMobile?: boolean;
}

type RoutePoint = {
  name: string;
  lat: number;
  lng: number;
  isOrigin: boolean;
  isDestination: boolean;
};

type LineCoordinate = [number, number];

const SIMULATION_MIN_DURATION_MS = 6000;
const SIMULATION_MAX_DURATION_MS = 18000;
const SIMULATION_MS_PER_KM = 35;
const MAP_CAMERA_TRANSITION_MS = 1500;

const roundMetricValue = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 1000) / 1000;

const mapLocationTypeToRoadPointSource = (
  type: TransportLocation["type"]
): RoadRoutePointSource | undefined => {
  switch (type) {
    case "airport":
      return "hub_airport";
    case "port":
      return "hub_port";
    case "rail_terminal":
      return "hub_rail_terminal";
    case "warehouse":
      return "warehouse";
    default:
      return undefined;
  }
};

const buildStraightLineCoordinates = (leg: TransportLeg): LineCoordinate[] => [
  [leg.origin.lng, leg.origin.lat],
  [leg.destination.lng, leg.destination.lat]
];

const getPolylineDistance = (coordinates: LineCoordinate[]) => {
  if (coordinates.length < 2) return 0;

  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [previousLng, previousLat] = coordinates[index - 1];
    const [nextLng, nextLat] = coordinates[index];
    total += Math.hypot(nextLng - previousLng, nextLat - previousLat);
  }

  return total;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const interpolateAlongPolyline = (
  coordinates: LineCoordinate[],
  progress: number
): LineCoordinate => {
  if (coordinates.length === 0) return [0, 0];
  if (coordinates.length === 1) return coordinates[0];

  const totalDistance = getPolylineDistance(coordinates);
  if (totalDistance <= 0) {
    return coordinates[0];
  }

  let remainingDistance = Math.max(0, Math.min(1, progress)) * totalDistance;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previousPoint = coordinates[index - 1];
    const nextPoint = coordinates[index];
    const segmentDistance = Math.hypot(
      nextPoint[0] - previousPoint[0],
      nextPoint[1] - previousPoint[1]
    );

    if (remainingDistance <= segmentDistance) {
      const segmentProgress =
        segmentDistance > 0 ? remainingDistance / segmentDistance : 0;

      return [
        previousPoint[0] + (nextPoint[0] - previousPoint[0]) * segmentProgress,
        previousPoint[1] + (nextPoint[1] - previousPoint[1]) * segmentProgress
      ];
    }

    remainingDistance -= segmentDistance;
  }

  return coordinates[coordinates.length - 1];
};

const TransportMap: React.FC<TransportMapProps> = ({
  legs,
  onRefresh,
  mapSubject,
  mapSubjectMeta,
  showSubjectMeta = true,
  stackSubjectOnMobile = false
}) => {
  const tTrack = useTranslations("trackShipment");
  const tMap = useTranslations("trackShipment.map");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const animationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [selectedLeg, setSelectedLeg] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const {
    geometryById: resolvedRoadGeometryById,
    metricsById: resolvedRoadMetricsById
  } = useResolvedRoadRouteGeometry(legs, {
    getDestination: (leg) => ({
      lat: leg.destination.lat,
      lng: leg.destination.lng
    }),
    getDestinationSource: (leg) => mapLocationTypeToRoadPointSource(leg.destination.type),
    getId: (leg) => leg.id,
    getOrigin: (leg) => ({
      lat: leg.origin.lat,
      lng: leg.origin.lng
    }),
    getOriginSource: (leg) => mapLocationTypeToRoadPointSource(leg.origin.type),
    getResolvedMetrics: (leg, route) => ({
      co2Kg:
        leg.emissionFactor > 0 ?
          roundMetricValue(route.distanceKm * leg.emissionFactor) :
          leg.co2Kg,
      distanceKm: route.distanceKm
    }),
    isRoadRoute: (leg) => isRoadTransportMode(leg.mode)
  });
  const formatDistanceKm = (value: number) =>
  value.toLocaleString(displayLocale, { maximumFractionDigits: 3 });
  const formatExactValue = (value: number) =>
  value.toLocaleString(displayLocale, { maximumFractionDigits: 3 });

  const displayLegs = React.useMemo(
    () =>
      legs.map((leg) => {
        const resolvedRoadMetrics = resolvedRoadMetricsById[leg.id];
        if (!resolvedRoadMetrics) {
          return leg;
        }

        return {
          ...leg,
          distanceKm: resolvedRoadMetrics.distanceKm ?? leg.distanceKm,
          co2Kg: resolvedRoadMetrics.co2Kg ?? leg.co2Kg
        };
      }),
    [legs, resolvedRoadMetricsById]
  );

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "ship":
        return Ship;
      case "air":
        return Plane;
      default:
        return Truck;
    }
  };

  const getModeColor = useCallback((mode: string) => {
    switch (mode) {
      case "ship":
        return "#3b82f6";
      case "air":
        return "#8b5cf6";
      case "truck_heavy":
        return "#f59e0b";
      default:
        return "#22c55e";
    }
  }, []);

  const getModeEmoji = (mode: string) => {
    switch (mode) {
      case "ship":
        return "S";
      case "air":
        return "A";
      default:
        return "T";
    }
  };

  const getRouteTypeLabel = (routeType: string) => {
    switch (routeType) {
      case "sea":
        return tMap("routeType.sea");
      case "air":
        return tMap("routeType.air");
      default:
        return tMap("routeType.road");
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let isCancelled = false;
    let initTimer: ReturnType<typeof setTimeout> | null = null;
    let createdMap: mapboxgl.Map | null = null;

    const onMapLoad = () => {
      if (!isCancelled) {
        setIsLoading(false);
      }
    };

    const onMapError = () => {
      if (!isCancelled) {
        setIsLoading(false);
      }
    };

    initTimer = setTimeout(() => {
      if (isCancelled || !mapContainerRef.current || mapRef.current) {
        return;
      }

      try {
        configureMapboxRuntime(mapboxgl);

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [108.2772, 14.0583],
          zoom: 2,
          projection: "mercator",
          bearing: 0,
          pitch: 0,
          maxPitch: 0,
          performanceMetricsCollection: false
        });

        createdMap = map;
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl());
        map.on("load", onMapLoad);
        map.on("error", onMapError);

        if (isCancelled) {
          map.off("load", onMapLoad);
          map.off("error", onMapError);
          map.remove();
          if (mapRef.current === map) {
            mapRef.current = null;
          }
        }
      } catch {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 0);

    return () => {
      isCancelled = true;
      if (initTimer) {
        clearTimeout(initTimer);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (createdMap) {
        createdMap.off("load", onMapLoad);
        createdMap.off("error", onMapError);
        createdMap.remove();
      }
      if (mapRef.current === createdMap) {
        mapRef.current = null;
      }
    };
  }, []);

  const getDisplayGeometry = useCallback((leg: TransportLeg): LineCoordinate[] => {
    if (!isRoadTransportMode(leg.mode)) {
      return buildStraightLineCoordinates(leg);
    }

    const resolvedGeometry = resolvedRoadGeometryById[leg.id];
    if (resolvedGeometry && resolvedGeometry.length >= 2) {
      return resolvedGeometry;
    }

    return buildStraightLineCoordinates(leg);
  }, [resolvedRoadGeometryById]);

  const animateMarker = (leg: TransportLeg, legIndex: number) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const pathCoordinates = getDisplayGeometry(leg);
    if (!pathCoordinates || pathCoordinates.length < 2) {
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);

    if (animationMarkerRef.current) {
      animationMarkerRef.current.remove();
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const el = document.createElement("div");
    el.className = "animate-marker";
    el.innerHTML = `
      <div style="
        background-color: ${getModeColor(leg.mode)};
        color: white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        animation: pulse 2s infinite;
      ">
        ${getModeEmoji(leg.mode)}
      </div>
    `;

    const marker = new mapboxgl.Marker(el);
    animationMarkerRef.current = marker;

    const distance = getPolylineDistance(pathCoordinates);

    const bounds = new mapboxgl.LngLatBounds();
    pathCoordinates.forEach((coordinate) => bounds.extend(coordinate));

    let maxZoom;
    if (distance < 0.5) {
      maxZoom = 12;
    } else if (distance < 2) {
      maxZoom = 9;
    } else if (distance < 10) {
      maxZoom = 6;
    } else {
      maxZoom = 4;
    }

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 80, right: 80 },
      duration: MAP_CAMERA_TRANSITION_MS,
      maxZoom
    });

    const lineId = `route-line-${legIndex}`;
    const glowId = `route-glow-${legIndex}`;
    if (map.getLayer(lineId)) {
      map.setPaintProperty(lineId, "line-width", 5);
      map.setPaintProperty(lineId, "line-opacity", 1);
    }
    if (map.getLayer(glowId)) {
      map.setPaintProperty(glowId, "line-width", 12);
      map.setPaintProperty(glowId, "line-opacity", 0.5);
    }

    const animationDurationMs = clamp(
      Math.round(Math.max(0, leg.distanceKm) * SIMULATION_MS_PER_KM),
      SIMULATION_MIN_DURATION_MS,
      SIMULATION_MAX_DURATION_MS
    );
    let loopStartedAt: number | null = null;

    const animate = (timestamp: number) => {
      if (loopStartedAt === null) {
        loopStartedAt = timestamp;
      }

      const elapsedMs = timestamp - loopStartedAt;
      if (elapsedMs >= animationDurationMs) {
        loopStartedAt = timestamp;
      }

      const normalizedElapsedMs =
        loopStartedAt === null ? 0 : Math.max(0, timestamp - loopStartedAt);
      const progress = normalizedElapsedMs / animationDurationMs;
      const easeProgress =
      progress < 0.5 ?
      2 * progress * progress :
      1 - Math.pow(-2 * progress + 2, 2) / 2;

      const [currentLng, currentLat] = interpolateAlongPolyline(
        pathCoordinates,
        easeProgress
      );

      marker.setLngLat([currentLng, currentLat]).addTo(map);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handleLegClick = (legIndex: number) => {
    if (selectedLeg === legIndex) {
      setSelectedLeg(null);
      setIsAnimating(false);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (animationMarkerRef.current) {
        animationMarkerRef.current.remove();
        animationMarkerRef.current = null;
      }

      if (mapRef.current) {
        displayLegs.forEach((_, idx) => {
          const lineId = `route-line-${idx}`;
          const glowId = `route-glow-${idx}`;
          if (mapRef.current!.getLayer(lineId)) {
            mapRef.current!.setPaintProperty(lineId, "line-width", 3);
            mapRef.current!.setPaintProperty(lineId, "line-opacity", 0.8);
          }
          if (mapRef.current!.getLayer(glowId)) {
            mapRef.current!.setPaintProperty(glowId, "line-width", 8);
            mapRef.current!.setPaintProperty(glowId, "line-opacity", 0.3);
          }
        });
      }

      if (mapRef.current && displayLegs.length > 0) {
        const allPoints: RoutePoint[] = [];
        displayLegs.forEach((leg, index) => {
          if (index === 0) {
            allPoints.push({
              ...leg.origin,
              isOrigin: true,
              isDestination: false
            });
          }
          allPoints.push({
            ...leg.destination,
            isOrigin: false,
            isDestination: index === displayLegs.length - 1
          });
        });

        const bounds = new mapboxgl.LngLatBounds();
        allPoints.forEach((point) => bounds.extend([point.lng, point.lat]));
        mapRef.current.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 10,
          duration: MAP_CAMERA_TRANSITION_MS
        });
      }
    } else {
      setSelectedLeg(legIndex);
      const nextLeg = displayLegs[legIndex];
      const nextLegGeometry = getDisplayGeometry(nextLeg);
      if (!nextLegGeometry || nextLegGeometry.length < 2) {
        setSelectedLeg(legIndex);
        setIsAnimating(false);

        if (mapRef.current) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([nextLeg.origin.lng, nextLeg.origin.lat]);
          bounds.extend([nextLeg.destination.lng, nextLeg.destination.lat]);
          mapRef.current.fitBounds(bounds, {
            padding: { top: 80, bottom: 80, left: 80, right: 80 },
            maxZoom: 10,
            duration: MAP_CAMERA_TRANSITION_MS
          });
        }
        return;
      }

      animateMarker(nextLeg, legIndex);
    }
  };

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (animationMarkerRef.current) {
      animationMarkerRef.current.remove();
      animationMarkerRef.current = null;
    }

    setSelectedLeg(null);
    setIsAnimating(false);
  }, [displayLegs]);

  useEffect(() => {
    if (!mapRef.current || displayLegs.length === 0) return;

    const map = mapRef.current;

    const drawRoutes = () => {
      if (!map.loaded() || !map.isStyleLoaded()) return;

      try {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        displayLegs.forEach((_, idx) => {
          const lineId = `route-line-${idx}`;
          const glowId = `route-glow-${idx}`;
          const sourceId = `route-source-${idx}`;
          if (map.getLayer(lineId)) map.removeLayer(lineId);
          if (map.getLayer(glowId)) map.removeLayer(glowId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });

        displayLegs.forEach((leg, idx) => {
          const sourceId = `route-source-${idx}`;
          const lineId = `route-line-${idx}`;
          const glowId = `route-glow-${idx}`;
          const lineCoordinates = getDisplayGeometry(leg);
          if (!lineCoordinates || lineCoordinates.length < 2) {
            return;
          }

          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: lineCoordinates

              }
            } as GeoJSON.Feature
          });

          map.addLayer({
            id: glowId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round"
            },
            paint: {
              "line-color": getModeColor(leg.mode),
              "line-width": 8,
              "line-opacity": 0.3,
              "line-blur": 4
            }
          });

          map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round"
            },
            paint: {
              "line-color": getModeColor(leg.mode),
              "line-width": 3,
              "line-opacity": 0.8,
              ...(leg.mode === "air" && {
                "line-dasharray": [2, 2]
              })
            }
          });
        });

        const allPoints: RoutePoint[] = [];
        displayLegs.forEach((leg, index) => {
          if (index === 0) {
            allPoints.push({
              ...leg.origin,
              isOrigin: true,
              isDestination: false
            });
          }
          allPoints.push({
            ...leg.destination,
            isOrigin: false,
            isDestination: index === displayLegs.length - 1
          });
        });

        allPoints.forEach((point) => {
          const el = document.createElement("div");
          el.className = "custom-marker";
          el.innerHTML = `
            <div style="
              background-color: ${point.isOrigin ? "#22c55e" : point.isDestination ? "#ef4444" : "#3b82f6"};
              color: white;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              cursor: pointer;
            ">
              ${point.isOrigin ? "O" : point.isDestination ? "D" : "T"}
            </div>
          `;

          const pointTypeLabel = point.isOrigin ?
          tMap("point.origin") :
          point.isDestination ?
          tMap("point.destination") :
          tMap("point.transit");

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <p style="font-weight: bold; margin-bottom: 4px;">${point.name}</p>
              <p style="font-size: 12px; color: #666;">
                ${pointTypeLabel}
              </p>
            </div>
          `);

          const marker = new mapboxgl.Marker(el).
          setLngLat([point.lng, point.lat]).
          setPopup(popup).
          addTo(map);

          markersRef.current.push(marker);
        });

        if (allPoints.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          allPoints.forEach((point) => bounds.extend([point.lng, point.lat]));
          map.fitBounds(bounds, {
            padding: { top: 80, bottom: 80, left: 80, right: 80 },
            maxZoom: 10,
            duration: MAP_CAMERA_TRANSITION_MS
          });
        }
      } catch {

      }
    };

    if (map.loaded() && map.isStyleLoaded()) {
      drawRoutes();
    } else {
      const handleLoad = () => {
        drawRoutes();
      };
      map.once("load", handleLoad);

      return () => {
        map.off("load", handleLoad);
      };
    }
  }, [displayLegs, getDisplayGeometry, getModeColor, tMap]);

  const totalDistance = displayLegs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const totalCO2 = displayLegs.reduce((sum, leg) => sum + leg.co2Kg, 0);
  const estimatedDays = displayLegs.reduce((days, leg) => {
    const distanceKm = Math.max(0, leg.distanceKm);
    if (leg.mode === "air") return days + 1;
    if (leg.mode === "ship") {
      if (distanceKm > 0) return days + Math.max(1, Math.ceil(distanceKm / 500));
      return days + (leg.co2Kg > 0 ? 1 : 0);
    }
    if (distanceKm > 0) return days + Math.max(1, Math.ceil(distanceKm / 800));
    return days + (leg.co2Kg > 0 ? 1 : 0);
  }, 0);

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
          }
        }
      `}</style>
      <CardHeader
        className={`border-b border-slate-200 bg-slate-50/70 p-3 pb-2 sm:p-6 sm:pb-2 ${
          stackSubjectOnMobile ? "pt-8" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div className="min-w-0 space-y-1">
            {stackSubjectOnMobile && mapSubject ?
            <div className="flex items-start gap-2 sm:hidden">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-4 text-slate-700">
                    {tMap("title.default")}
                  </p>
                  <p className="truncate text-lg font-semibold leading-6 text-slate-900">
                    {mapSubject}
                  </p>
                </div>
              </div> :
            null}
            <CardTitle
              className={`items-center gap-2 text-lg ${stackSubjectOnMobile && mapSubject ? "hidden sm:flex" : "flex"}`}
            >
              <Globe className="w-5 h-5 text-primary" />
              {mapSubject ?
              tMap("title.withSubject", { subject: mapSubject }) :
              tMap("title.default")}
            </CardTitle>
            {showSubjectMeta && mapSubjectMeta &&
            <p className={`${stackSubjectOnMobile && mapSubject ? "pl-6 sm:pl-7" : "pl-7"} text-xs text-muted-foreground`}>
                {mapSubjectMeta}
              </p>
            }
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAnimating &&
            <Badge variant="outline" className="animate-pulse">
                {tMap("animating")}
              </Badge>
            }
              {onRefresh &&
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
              onClick={onRefresh}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                  {tTrack("refresh")}
                </Button>
            }
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-white p-0">
        <div className="relative h-96 border-b border-slate-200 bg-slate-100/60 md:h-100">
          {isLoading &&
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/90">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">
                  {tMap("loading")}
                </p>
              </div>
            </div>
          }
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        <div className="bg-white p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800">
                {formatDistanceKm(totalDistance)}
              </p>
              <p className="text-xs text-muted-foreground">
                {tMap("stats.totalDistance")}
              </p>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">
                {formatExactValue(totalCO2)}
              </p>
              <p className="text-xs text-muted-foreground">{tMap("stats.totalEmissions")}</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-center">
              <p className="text-2xl font-bold text-sky-600">{legs.length}</p>
              <p className="text-xs text-muted-foreground">{tMap("stats.totalLegs")}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                ~{estimatedDays}
              </p>
              <p className="text-xs text-muted-foreground">{tMap("stats.estimatedDays")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
              <Navigation className="w-4 h-4" />
              {tMap("routeDetails")}
              <span className="text-xs text-muted-foreground font-normal">
                {tMap("clickHint")}
              </span>
            </p>
            {displayLegs.map((leg, index) => {
              const Icon = getModeIcon(leg.mode);
              const legCardClass =
                selectedLeg === index ?
                  "border border-sky-300 bg-sky-50/70 shadow-sm" :
                  "border border-slate-200 bg-white hover:bg-slate-50";
              return (
                <div
                  key={leg.id}
                  className={`cursor-pointer rounded-lg p-3 transition-all ${legCardClass}`}
                  onClick={() => handleLegClick(index)}>

                  <div className="mb-0 sm:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: getModeColor(leg.mode) }}>

                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {leg.origin.name}
                          </p>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{leg.destination.name}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={leg.type === "international" ? "default" : "secondary"}
                        className="shrink-0 text-[10px]">

                        {leg.type === "international" ? tTrack("international") : tTrack("domestic")}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground">
                          {tMap("stats.totalDistance")}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-800">
                          {formatDistanceKm(leg.distanceKm)} {tTrack("units.km")}
                        </p>
                      </div>
                      <div className="rounded-md bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground">
                          {locale === "vi" ? "Loại" : "Mode"}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-800">
                          {getRouteTypeLabel(leg.routeType)}
                        </p>
                      </div>
                      <div className="col-span-2 rounded-md bg-orange-50 px-2 pt-1.5 pb-1">
                        <p className="text-xs font-semibold text-orange-600">
                          {formatExactValue(leg.co2Kg)} {tTrack("units.kgCo2")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="hidden items-center gap-3 sm:flex">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform hover:scale-110"
                    style={{ backgroundColor: getModeColor(leg.mode) }}>

                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">
                        {leg.origin.name}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {leg.destination.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{formatDistanceKm(leg.distanceKm)} {tTrack("units.km")}</span>
                      <span>•</span>
                      <span>{getRouteTypeLabel(leg.routeType)}</span>
                      <span>•</span>
                      <span className="text-orange-600">
                        {formatExactValue(leg.co2Kg)} {tTrack("units.kgCo2")}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                    leg.type === "international" ? "default" : "secondary"
                    }
                    className="text-xs">

                    {leg.type === "international" ? tTrack("international") : tTrack("domestic")}
                  </Badge>
                  </div>
                </div>);

            })}
          </div>
        </div>
      </CardContent>
    </Card>);

};

export default TransportMap;

