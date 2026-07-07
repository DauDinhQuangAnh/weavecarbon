"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { configureMapboxRuntime, hasMapboxPublicToken } from "@/lib/mapbox";
import { buildSupplyChainRouteGeometry } from "@/lib/transportRouteGeometry";
import { addVietnamSovereigntyLabels } from "@/lib/vietnamSovereigntyLabels";
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

interface NodeCluster {
  key: string;
  lat: number;
  lng: number;
  nodes: SupplyChainNode[];
}

// Grid cell shrinks as the user zooms in so nearby markers separate again
// instead of staying merged once you've zoomed past the region they're in.
const CLUSTER_GRID_BASE_DEGREES = 45;
const CLUSTER_MIN_GRID_DEGREES = 0.05;

const clusterNodesByZoom = (nodes: SupplyChainNode[], zoom: number): NodeCluster[] => {
  const cellSize = Math.max(
    CLUSTER_GRID_BASE_DEGREES / Math.pow(2, zoom),
    CLUSTER_MIN_GRID_DEGREES
  );
  const groups = new Map<string, SupplyChainNode[]>();

  nodes.forEach((node) => {
    const cellKey = `${Math.round(node.lat / cellSize)}:${Math.round(node.lng / cellSize)}`;
    const bucket = groups.get(cellKey);
    if (bucket) {
      bucket.push(node);
    } else {
      groups.set(cellKey, [node]);
    }
  });

  return Array.from(groups.entries()).map(([key, members]) => ({
    key,
    lat: members.reduce((sum, n) => sum + n.lat, 0) / members.length,
    lng: members.reduce((sum, n) => sum + n.lng, 0) / members.length,
    nodes: members
  }));
};

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
  const sovereigntyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const usedTokenRef = useRef(false);
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
      const hasToken = hasMapboxPublicToken();
      usedTokenRef.current = hasToken;
      if (hasToken) {
        configureMapboxRuntime(mapboxgl);
      } else {
        mapboxgl.accessToken = "pk.placeholder";
        if (typeof (mapboxgl as unknown as { setTelemetryEnabled?: (enabled: boolean) => void }).setTelemetryEnabled === "function") {
          (mapboxgl as unknown as { setTelemetryEnabled: (enabled: boolean) => void }).setTelemetryEnabled(false);
        }
      }
      // Prevent worker init errors in Turbopack/Next.js builds
      if (typeof mapboxgl.workerCount === "number" && mapboxgl.workerCount > 2) {
        mapboxgl.workerCount = 1;
      }

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: hasToken ? "mapbox://styles/mapbox/streets-v12" : OSM_RASTER_STYLE,
        center: [center[1], center[0]], // callers pass [lat, lng]; Mapbox needs [lng, lat]
        zoom,
        antialias: true,
        pitch: 0,
        bearing: 0,
        maxPitch: 0,
        projection: "mercator",
        attributionControl: !hasToken
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
        if (sovereigntyMarkersRef.current.length === 0) {
          sovereigntyMarkersRef.current = addVietnamSovereigntyLabels(mapboxgl, map);
        }
      };

      const handleError = (event: mapboxgl.ErrorEvent) => {
        // Mapbox GL fires "error" for per-tile fetch failures (rate limits,
        // transient network blips on the OSM raster fallback) as well as for
        // genuinely fatal style/init errors. A single failed tile shouldn't
        // tear down a map that already rendered — only surface the fatal
        // error screen when the map never got past its initial style load.
        const sourceScoped = Boolean((event as unknown as { sourceId?: string }).sourceId);
        if (sourceScoped || map.loaded()) {
          console.warn("Map tile error (non-fatal):", event.error);
          return;
        }

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
        sovereigntyMarkersRef.current.forEach((marker) => marker.remove());
        sovereigntyMarkersRef.current = [];
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

    const addRoutes = () => {
      if (!mapRef.current || mapRef.current !== map) {
        return;
      }

      if (!map.loaded() || !map.getCanvas()) {
        retryTimer = setTimeout(addRoutes, 100);
        return;
      }

      try {
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
      addRoutes();
    } else {
      const onMapLoad = () => {
        addRoutes();
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
  }, [nodes, routes, onNodeClick, onRouteClick, t]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const renderMarkers = () => {
      if (!mapRef.current || mapRef.current !== map) {
        return;
      }

      if (!map.loaded() || !map.getCanvas()) {
        retryTimer = setTimeout(renderMarkers, 100);
        return;
      }

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      const clusters = clusterNodesByZoom(nodes, map.getZoom());

      clusters.forEach((cluster) => {
        try {
          if (cluster.nodes.length === 1) {
            const node = cluster.nodes[0];
            const nodeTypeLabel = getNodeTypeLabel(node.type);
            const el = document.createElement("div");
            // Apply styles directly to el so Mapbox anchors at the true visual center
            el.style.cssText = [
              `background-color: ${getMarkerColor(node.status)}`,
              "color: white",
              "border-radius: 50%",
              "width: 36px",
              "height: 36px",
              "box-sizing: border-box",
              "display: flex",
              "align-items: center",
              "justify-content: center",
              "font-size: 15px",
              "font-weight: 700",
              "border: 3px solid white",
              "box-shadow: 0 2px 8px rgba(0,0,0,0.3)",
              "cursor: pointer",
              "user-select: none"
            ].join("; ");
            el.textContent = getTypeEmoji(node.type);

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

            const marker = new mapboxgl.Marker(el)
              .setLngLat([node.lng, node.lat])
              .setPopup(popup)
              .addTo(map);

            if (onNodeClick) {
              el.addEventListener("click", () => onNodeClick(node));
            }

            markersRef.current.push(marker);
          } else {
            const count = cluster.nodes.length;
            const size = Math.min(52, 34 + Math.round(Math.sqrt(count) * 6));
            const el = document.createElement("div");
            el.style.cssText = [
              "background-color: #334155",
              "color: white",
              "border-radius: 50%",
              `width: ${size}px`,
              `height: ${size}px`,
              "box-sizing: border-box",
              "display: flex",
              "align-items: center",
              "justify-content: center",
              "font-size: 14px",
              "font-weight: 700",
              "border: 3px solid white",
              "box-shadow: 0 2px 8px rgba(0,0,0,0.35)",
              "cursor: pointer",
              "user-select: none"
            ].join("; ");
            el.textContent = String(count);
            el.title = t.has("cluster.expandHint")
              ? t("cluster.expandHint")
              : "Click to zoom in";

            el.addEventListener("click", () => {
              const currentZoom = map.getZoom();
              map.easeTo({
                center: [cluster.lng, cluster.lat],
                zoom: Math.min(currentZoom + 3, 12)
              });
            });

            const marker = new mapboxgl.Marker(el)
              .setLngLat([cluster.lng, cluster.lat])
              .addTo(map);

            markersRef.current.push(marker);
          }
        } catch {

        }
      });
    };

    const onZoomEnd = () => renderMarkers();

    if (map.loaded()) {
      renderMarkers();
    } else {
      map.once("load", renderMarkers);
    }
    map.on("zoomend", onZoomEnd);

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      map.off("zoomend", onZoomEnd);
    };
  }, [nodes, onNodeClick, t, getNodeTypeLabel]);

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
            {usedTokenRef.current ? t("addTokenHint") : t("networkHint")}
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
              <line x1="0" y1="3" x2="20" y2="3" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span>{t("legend.seaRoute")}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 4" />
            </svg>
            <span>{t("legend.airRoute")}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="10 4 2 4" />
            </svg>
            <span>{t.has("legend.railRoute") ? t("legend.railRoute") : "Rail route"}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
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

