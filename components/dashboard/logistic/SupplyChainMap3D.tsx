"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Badge } from "@/components/ui/badge";
import { buildSupplyChainRouteGeometry } from "@/lib/transportRouteGeometry";
import type { SupplyChainNode, SupplyChainRoute } from "./SupplyChainMap";
import { configureMapboxRuntime, hasMapboxPublicToken } from "@/lib/mapbox";
import { addVietnamSovereigntyLabels } from "@/lib/vietnamSovereigntyLabels";

interface SupplyChainMap3DProps {
  nodes: SupplyChainNode[];
  routes: SupplyChainRoute[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onNodeClick?: (node: SupplyChainNode) => void;
  onRouteClick?: (route: SupplyChainRoute) => void;
}

const getRouteColor = (mode: string, status: string) => {
  if (status === "completed") return "#22c55e";
  if (status === "pending") return "#9ca3af";

  switch (mode) {
    case "ship":
      return "#3b82f6";
    case "air":
      return "#8b5cf6";
    case "rail":
      return "#14b8a6";
    case "truck":
      return "#f59e0b";
    default:
      return "#6b7280";
  }
};

const getTypeEmoji = (type: string) => {
  switch (type) {
    case "factory":
      return "F";
    case "warehouse":
      return "W";
    case "port":
      return "P";
    case "airport":
      return "A";
    case "destination":
      return "D";
    default:
      return "N";
  }
};

const getMarkerColor = (status?: string) => {
  if (status === "completed") return "#22c55e";
  if (status === "pending") return "#eab308";
  return "#3b82f6";
};

const getRenderableRouteCoordinates = (route: SupplyChainRoute) =>
  buildSupplyChainRouteGeometry(route);

const OSM_RASTER_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster" as const,
      source: "osm"
    }
  ]
};

const SupplyChainMap3D: React.FC<SupplyChainMap3DProps> = ({
  nodes,
  routes,
  center = [14.0583, 108.2772],
  zoom = 4,
  height = "500px",
  onNodeClick,
  onRouteClick
}) => {
  const t = useTranslations("logistics.supplyChainMap3D");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const sovereigntyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const getNodeTypeLabel = useCallback((nodeType: SupplyChainNode["type"]) =>
  t.has(`popup.nodeTypes.${nodeType}`) ?
  t(`popup.nodeTypes.${nodeType}`) :
  nodeType, [t]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let isMounted = true;

    // Fail-safe: if map hasn't loaded in 10s (token missing/invalid/network), show error.
    const loadTimeout = setTimeout(() => {
      if (isMounted && !mapRef.current) {
        setError(t("errors.loadFailed"));
        setIsLoading(false);
      }
    }, 10000);

    try {
      const hasToken = hasMapboxPublicToken();
      if (hasToken) {
        configureMapboxRuntime(mapboxgl);
      } else {
        mapboxgl.accessToken = "pk.placeholder";
        if (typeof (mapboxgl as unknown as { setTelemetryEnabled?: (enabled: boolean) => void }).setTelemetryEnabled === "function") {
          (mapboxgl as unknown as { setTelemetryEnabled: (enabled: boolean) => void }).setTelemetryEnabled(false);
        }
      }

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: hasToken ? "mapbox://styles/mapbox/streets-v12" : OSM_RASTER_STYLE,
        center: [center[1], center[0]], // callers pass [lat, lng]; Mapbox needs [lng, lat]
        zoom,
        pitch: 45,
        bearing: -17.6,
        antialias: true,
        attributionControl: !hasToken
      });

      map.addControl(new mapboxgl.NavigationControl());
      map.addControl(new mapboxgl.FullscreenControl());

      map.on("load", () => {
        clearTimeout(loadTimeout);
        if (isMounted) {
          mapRef.current = map;
          setIsLoading(false);
        }
        if (sovereigntyMarkersRef.current.length === 0) {
          sovereigntyMarkersRef.current = addVietnamSovereigntyLabels(mapboxgl, map);
        }
      });

      map.on("error", () => {
        clearTimeout(loadTimeout);
        if (isMounted) {
          setError(t("errors.loadFailed"));
          setIsLoading(false);
        }
      });

      return () => {
        clearTimeout(loadTimeout);
        isMounted = false;
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];
        sovereigntyMarkersRef.current.forEach((marker) => marker.remove());
        sovereigntyMarkersRef.current = [];
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch {
      clearTimeout(loadTimeout);
      if (isMounted) {
        setError(t("errors.loadFailed"));
        setIsLoading(false);
      }
    }
  }, [center, zoom, t]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const addRoutesAndMarkers = () => {
      if (!mapRef.current || mapRef.current !== map) {
        return;
      }

      if (!map.loaded() || !map.isStyleLoaded()) {
        retryTimer = setTimeout(addRoutesAndMarkers, 100);
        return;
      }

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      const routeBounds = new mapboxgl.LngLatBounds();
      let hasRouteBounds = false;

      routes.forEach((_, idx) => {
        const lineId = `route-line-${idx}`;
        const sourceId = `route-source-${idx}`;
        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });

      routes.forEach((route, idx) => {
        const sourceId = `route-source-${idx}`;
        const lineId = `route-line-${idx}`;
        const routeCoordinates = getRenderableRouteCoordinates(route);
        if (!routeCoordinates || routeCoordinates.length < 2) {
          return;
        }

        routeCoordinates.forEach((coordinate) => {
          routeBounds.extend(coordinate);
        });
        hasRouteBounds = true;

        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: routeCoordinates

            }
          } as GeoJSON.Feature
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
            "line-color": getRouteColor(route.mode, route.status),
            "line-width": route.status === "in_transit" ? 4 : 2,
            "line-opacity": route.status === "pending" ? 0.5 : 0.8,
            ...(route.status === "pending" && { "line-dasharray": [2, 2] })
          }
        });

        map.on("click", lineId, () => {
          if (onRouteClick) onRouteClick(route);
        });

        map.on("mouseenter", lineId, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", lineId, () => {
          map.getCanvas().style.cursor = "";
        });
      });

      nodes.forEach((node) => {
        const nodeTypeLabel = getNodeTypeLabel(node.type);
        const el = document.createElement("div");
        el.className = "custom-3d-marker";
        el.innerHTML = `
          <div style="
            background-color: ${getMarkerColor(node.status)};
            color: white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            cursor: pointer;
          ">
            ${getTypeEmoji(node.type)}
          </div>
        `;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: true
        }).setHTML(`
          <div style="padding: 12px; min-width: 220px; font-family: system-ui;">
            <h3 style="font-weight: bold; margin-bottom: 8px;">${node.name}</h3>
            <p style="margin: 4px 0;"><strong>${t("popup.type")}:</strong> ${nodeTypeLabel}</p>
            <p style="margin: 4px 0;"><strong>${t("popup.country")}:</strong> ${node.country}</p>
            ${node.co2 !== undefined ? `<p style="margin: 4px 0;"><strong>${t("popup.co2")}:</strong> ${node.co2} tCO2</p>` : ""}
          </div>
        `);

        const marker = new mapboxgl.Marker(el).
        setLngLat([node.lng, node.lat]).
        setPopup(popup).
        addTo(map);

        if (onNodeClick) {
          el.addEventListener("click", () => onNodeClick(node));
        }

        markersRef.current.push(marker);
      });

      if (hasRouteBounds || nodes.length > 1) {
        const bounds = hasRouteBounds ? routeBounds : new mapboxgl.LngLatBounds();
        if (!hasRouteBounds) {
          nodes.forEach((node) => bounds.extend([node.lng, node.lat]));
        }
        map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 10
        });
      }
    };

    if (map.loaded()) {
      addRoutesAndMarkers();
    } else {
      const handleLoad = () => {
        addRoutesAndMarkers();
        map.off("load", handleLoad);
      };
      map.once("load", handleLoad);

      return () => {
        if (retryTimer) {
          clearTimeout(retryTimer);
        }
        map.off("load", handleLoad);
      };
    }

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [nodes, routes, onNodeClick, onRouteClick, t, getNodeTypeLabel]);

  if (isLoading) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-muted rounded-lg border">

        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>);

  }

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-muted rounded-lg border">

        <div className="text-center">
          <p className="text-destructive mb-2">{error}</p>
          <Badge variant="secondary">{t("replaceTokenHint")}</Badge>
        </div>
      </div>);

  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-border">
      <div ref={mapContainerRef} style={{ height, width: "100%" }} />

      <div className="absolute top-4 left-4 z-10">
        <Badge variant="secondary" className="bg-background/90 backdrop-blur">
          {t("titleBadge")}
        </Badge>
      </div>

      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg border z-10">
        <p className="text-xs font-semibold mb-2">{t("legend.title")}</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-blue-500 rounded" />
            <span>{t("legend.seaRoute")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 bg-purple-500 rounded"
              style={{ borderStyle: "dashed" }} />

            <span>{t("legend.airRoute")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 bg-teal-500 rounded"
              style={{ borderStyle: "dashed" }} />

            <span>{t.has("legend.railRoute") ? t("legend.railRoute") : "Rail route"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-amber-500 rounded" />
            <span>{t("legend.roadRoute")}</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur rounded-lg p-2 shadow-lg border z-10">
        <p className="text-xs text-muted-foreground">
          {t("controlsHint")}
        </p>
      </div>
    </div>);

};

export default SupplyChainMap3D;

