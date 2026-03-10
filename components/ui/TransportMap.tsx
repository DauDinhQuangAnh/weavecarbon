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
import type { TransportLeg } from "@/types/transport";
import { configureMapboxRuntime } from "@/lib/mapbox";

interface TransportMapProps {
  legs: TransportLeg[];
  onRefresh?: () => void;
  mapSubject?: string;
  mapSubjectMeta?: string;
}

type RoutePoint = {
  name: string;
  lat: number;
  lng: number;
  isOrigin: boolean;
  isDestination: boolean;
};

const TransportMap: React.FC<TransportMapProps> = ({
  legs,
  onRefresh,
  mapSubject,
  mapSubjectMeta
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
  const formatDistanceKm = (value: number) =>
  value.toLocaleString(displayLocale, { maximumFractionDigits: 3 });
  const formatExactValue = (value: number) =>
  value.toLocaleString(displayLocale, { maximumFractionDigits: 3 });

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
        maxPitch: 0
      });

      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl());

      const onMapLoad = () => {
        setIsLoading(false);
      };

      map.on("load", onMapLoad);

      map.on("error", () => {
        setIsLoading(false);
      });

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (map) {
          map.remove();
          mapRef.current = null;
        }
      };
    } catch {
      setIsLoading(false);
    }
  }, []);

  const animateMarker = (leg: TransportLeg, legIndex: number) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
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

    const start = [leg.origin.lng, leg.origin.lat];
    const end = [leg.destination.lng, leg.destination.lat];

    const distance = Math.sqrt(
      Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
    );
    const totalSteps = Math.max(100, Math.min(300, distance * 20));
    let currentStep = 0;

    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([leg.origin.lng, leg.origin.lat]);
    bounds.extend([leg.destination.lng, leg.destination.lat]);

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
      duration: 1000,
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

    const animate = () => {
      if (currentStep >= totalSteps) {
        currentStep = 0;
      }

      const progress = currentStep / totalSteps;
      const easeProgress =
      progress < 0.5 ?
      2 * progress * progress :
      1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentLng = start[0] + (end[0] - start[0]) * easeProgress;
      const currentLat = start[1] + (end[1] - start[1]) * easeProgress;

      marker.setLngLat([currentLng, currentLat]).addTo(map);

      currentStep++;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
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
        legs.forEach((_, idx) => {
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

      if (mapRef.current && legs.length > 0) {
        const allPoints: RoutePoint[] = [];
        legs.forEach((leg, index) => {
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
            isDestination: index === legs.length - 1
          });
        });

        const bounds = new mapboxgl.LngLatBounds();
        allPoints.forEach((point) => bounds.extend([point.lng, point.lat]));
        mapRef.current.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 10,
          duration: 1000
        });
      }
    } else {
      setSelectedLeg(legIndex);
      animateMarker(legs[legIndex], legIndex);
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
  }, [legs]);

  useEffect(() => {
    if (!mapRef.current || legs.length === 0) return;

    const map = mapRef.current;

    const drawRoutes = () => {
      if (!map.loaded() || !map.isStyleLoaded()) return;

      try {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        legs.forEach((_, idx) => {
          const lineId = `route-line-${idx}`;
          const glowId = `route-glow-${idx}`;
          const sourceId = `route-source-${idx}`;
          if (map.getLayer(lineId)) map.removeLayer(lineId);
          if (map.getLayer(glowId)) map.removeLayer(glowId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });

        legs.forEach((leg, idx) => {
          const sourceId = `route-source-${idx}`;
          const lineId = `route-line-${idx}`;
          const glowId = `route-glow-${idx}`;

          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                [leg.origin.lng, leg.origin.lat],
                [leg.destination.lng, leg.destination.lat]]

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
        legs.forEach((leg, index) => {
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
            isDestination: index === legs.length - 1
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
            duration: 1000
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
  }, [legs, getModeColor, tMap]);

  const totalDistance = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const totalCO2 = legs.reduce((sum, leg) => sum + leg.co2Kg, 0);
  const estimatedDays = legs.reduce((days, leg) => {
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
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-primary" />
              {mapSubject ?
              tMap("title.withSubject", { subject: mapSubject }) :
              tMap("title.default")}
            </CardTitle>
            {mapSubjectMeta &&
            <p className="pl-7 text-xs text-muted-foreground">{mapSubjectMeta}</p>
            }
          </div>
          <div className="flex items-center gap-2">
            {isAnimating &&
            <Badge variant="outline" className="animate-pulse">
                {tMap("animating")}
              </Badge>
            }
              {onRefresh &&
            <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {tTrack("refresh")}
                </Button>
            }
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-white p-0">
        <div className="relative h-100 border-b border-slate-200 bg-slate-100/60">
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
            <p className="text-sm font-medium flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              {tMap("routeDetails")}
              <span className="text-xs text-muted-foreground font-normal">
                {tMap("clickHint")}
              </span>
            </p>
            {legs.map((leg, index) => {
              const Icon = getModeIcon(leg.mode);
              return (
                <div
                  key={leg.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer
                    ${selectedLeg === index ? "border border-sky-300 bg-sky-50/70 shadow-sm" : "border border-slate-200 bg-white hover:bg-slate-50"}`}
                  onClick={() => handleLegClick(index)}>

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
                </div>);

            })}
          </div>
        </div>
      </CardContent>
    </Card>);

};

export default TransportMap;

