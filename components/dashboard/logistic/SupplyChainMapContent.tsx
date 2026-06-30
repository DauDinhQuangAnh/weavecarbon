"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { configureMapboxRuntime, hasMapboxPublicToken } from "@/lib/mapbox";
import { buildSupplyChainRouteGeometry } from "@/lib/transportRouteGeometry";
import type { SupplyChainNode, SupplyChainRoute } from "./SupplyChainMap";

interface SupplyChainMapContentProps {
  nodes: SupplyChainNode[];
  routes: SupplyChainRoute[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onNodeClick?: (node: SupplyChainNode) => void;
  onRouteClick?: (route: SupplyChainRoute) => void;
}

const MODE_FALLBACK_COLORS: Record<string, string> = {
  ship: "#3b82f6",
  air: "#8b5cf6",
  rail: "#14b8a6",
  truck: "#f59e0b",
};

const getRouteColor = (mode: string, status: string, color?: string) => {
  if (status === "pending") return color ? `${color}88` : "#9ca3af";
  if (status === "completed") return color ?? "#22c55e";
  return color ?? MODE_FALLBACK_COLORS[mode] ?? "#6b7280";
};

const getRouteWeight = (mode: string, status: string) => {
  const base = mode === "ship" ? 4 : mode === "air" ? 3.5 : mode === "rail" ? 3 : 2.5;
  if (status === "in_transit") return base;
  if (status === "completed") return base * 0.85;
  return base * 0.65;
};

const getRouteDashArray = (mode: string, status: string) => {
  if (status === "pending") return "6,6";
  if (mode === "air") return "8,5";
  if (mode === "rail") return "14,5,3,5";
  return undefined;
};

const getMarkerColor = (status?: string) => {
  if (status === "completed") return "#22c55e";
  if (status === "pending") return "#eab308";
  return "#3b82f6";
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

const getRenderableRouteCoordinates = (route: SupplyChainRoute) =>
  buildSupplyChainRouteGeometry(route);

const SupplyChainMapContent: React.FC<SupplyChainMapContentProps> = ({
  nodes,
  routes,
  center = [14.0583, 108.2772],
  zoom = 4,
  height = "500px",
  onNodeClick,
  onRouteClick
}) => {
  const t = useTranslations("logistics.supplyChainMapContent");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const getNodeTypeLabel = useCallback((nodeType: SupplyChainNode["type"]) =>
  t.has(`popup.nodeTypes.${nodeType}`) ?
  t(`popup.nodeTypes.${nodeType}`) :
  nodeType, [t]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    let isMounted = true;
    let loadTimeout: NodeJS.Timeout | undefined;

    try {
      if (!hasMapboxPublicToken()) {
        throw new Error(t("errors.missingToken"));
      }

      configureMapboxRuntime(mapboxgl);

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [center[1], center[0]], // callers pass [lat, lng]; Mapbox needs [lng, lat]
        zoom,
        antialias: true,
        pitch: 0,
        bearing: 0,
        maxPitch: 0,
        projection: "mercator"
      });

      loadTimeout = setTimeout(() => {
        if (isMounted && mapRef.current) {
          setIsLoading(false);
        }
      }, 8000);

      map.addControl(new mapboxgl.NavigationControl());

      const handleLoad = () => {
        clearTimeout(loadTimeout);
        if (isMounted) {
          setIsLoading(false);
          setError(null);
        }
      };

      const handleError = () => {
        if (loadTimeout) clearTimeout(loadTimeout);
        if (isMounted) {
          setError(t("errors.loadFailed"));
          setIsLoading(false);
        }
      };

      map.on("load", handleLoad);
      map.on("error", handleError);
      mapRef.current = map;

      return () => {
        isMounted = false;
        if (loadTimeout) clearTimeout(loadTimeout);
        if (map) {
          map.off("load", handleLoad);
          map.off("error", handleError);
          map.remove();
          mapRef.current = null;
        }
      };
    } catch (err) {
      if (loadTimeout) clearTimeout(loadTimeout);
      if (isMounted) {
        const message = err instanceof Error ? err.message : t("errors.unknown");
        setError(message);
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

      if (!map.loaded() || !map.getCanvas()) {
        retryTimer = setTimeout(addRoutesAndMarkers, 100);
        return;
      }

      try {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];
        const routeBounds = new mapboxgl.LngLatBounds();
        let hasRouteBounds = false;

        routes.forEach((_, idx) => {
          const lineId = `route-line-${idx}`;
          const sourceId = `route-source-${idx}`;
          try {
            if (map.getLayer(lineId)) map.removeLayer(lineId);
            if (map.getSource(sourceId)) map.removeSource(sourceId);
          } catch {

          }
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

          try {
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

            const color = getRouteColor(route.mode, route.status, route.color);
            const weight = getRouteWeight(route.mode, route.status);
            const dashArray = getRouteDashArray(route.mode, route.status);

            map.addLayer({
              id: lineId,
              type: "line",
              source: sourceId,
              layout: {
                "line-join": "round",
                "line-cap": "round"
              },
              paint: {
                "line-color": color,
                "line-width": weight,
                "line-opacity": route.status === "pending" ? 0.5 : 0.8,
                ...(dashArray && {
                  "line-dasharray": dashArray.
                  split(",").
                  map((v) => parseInt(v))
                })
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
          } catch {

          }
        });

        nodes.forEach((node) => {
          try {
            const nodeTypeLabel = getNodeTypeLabel(node.type);
            const el = document.createElement("div");
            el.className = "custom-marker";
            el.innerHTML = `
              <div style="
                background-color: ${getMarkerColor(node.status)};
                color: white;
                border-radius: 50%;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                cursor: pointer;
              ">
                ${getTypeEmoji(node.type)}
              </div>
            `;

            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 8px; min-width: 220px;">
                <div style="font-weight: bold; margin-bottom: 8px;">${node.name}</div>
                <div style="font-size: 14px; line-height: 1.5;">
                  <p><strong>${t("popup.type")}:</strong> ${nodeTypeLabel}</p>
                  <p><strong>${t("popup.country")}:</strong> ${node.country}</p>
                  ${node.co2 !== undefined ? `<p><strong>${t("popup.co2")}:</strong> ${node.co2} tCO2</p>` : ""}
                </div>
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
          } catch {

          }
        });

        if (hasRouteBounds || nodes.length > 1) {
          try {
            const bounds = hasRouteBounds ? routeBounds : new mapboxgl.LngLatBounds();
            if (!hasRouteBounds) {
              nodes.forEach((node) => bounds.extend([node.lng, node.lat]));
            }
            map.fitBounds(bounds, { padding: 50, maxZoom: 10 });
          } catch {

          }
        }
      } catch {

      }
    };

    if (map.loaded()) {
      addRoutesAndMarkers();
    } else {
      const onMapLoad = () => {
        addRoutesAndMarkers();
        map.off("load", onMapLoad);
      };
      map.once("load", onMapLoad);

      return () => {
        if (retryTimer) {
          clearTimeout(retryTimer);
        }
        map.off("load", onMapLoad);
      };
    }

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [nodes, routes, onNodeClick, onRouteClick, t, getNodeTypeLabel]);

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-muted rounded-lg border">

        <div className="text-center">
          <p className="text-sm text-destructive font-semibold mb-2">
            {t("errorTitle")}
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {t("addTokenHint")}
          </p>
        </div>
      </div>);

  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-border">
      <div
        ref={mapContainerRef}
        style={{ height, width: "100%" }}
        className="z-0" />

      {isLoading &&
      <div className="absolute inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        </div>
      }

      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg border z-10">
        <p className="text-xs font-semibold mb-2">{t("legend.title")}</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span>{t("legend.seaRoute")}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 4" />
            </svg>
            <span>{t("legend.airRoute")}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="10 4 2 4" />
            </svg>
            <span>{t.has("legend.railRoute") ? t("legend.railRoute") : "Rail route"}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{t("legend.roadRoute")}</span>
          </div>
          <div className="border-t border-slate-200 mt-1.5 pt-1.5 text-muted-foreground">
            <span>Mỗi màu = 1 lô hàng</span>
          </div>
        </div>
      </div>
    </div>);

};

export default SupplyChainMapContent;

