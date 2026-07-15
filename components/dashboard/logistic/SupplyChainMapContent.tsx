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

const ROUTE_SOURCE_ID = "shipment-routes";
const ROUTE_CASING_LAYER_ID = "shipment-routes-casing";
const ROUTE_LINE_LAYER_ID = "shipment-routes-line";

interface NodeCluster {
  key: string;
  lat: number;
  lng: number;
  nodes: SupplyChainNode[];
}

// Grid cell shrinks as the user zooms in so nearby markers separate again
// instead of staying merged once you've zoomed past the region they're in.
// Kept small enough that cities a few hundred km apart (e.g. within Vietnam)
// don't collapse into one cluster bubble at the map's default overview zoom.
const CLUSTER_GRID_BASE_DEGREES = 16;
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

const removeRouteLayers = (map: mapboxgl.Map) => {
  try {
    if (map.getLayer(ROUTE_LINE_LAYER_ID)) {
      map.removeLayer(ROUTE_LINE_LAYER_ID);
    }
    if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
      map.removeLayer(ROUTE_CASING_LAYER_ID);
    }
    if (map.getSource(ROUTE_SOURCE_ID)) {
      map.removeSource(ROUTE_SOURCE_ID);
    }
  } catch {

  }
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
  const lastFitBoundsKeyRef = useRef<string | null>(null);
  // OSM's free tile server (the no-token fallback) intermittently rejects
  // requests, which used to surface as a permanent error screen. Transient
  // init failures now trigger a couple of automatic re-creations before the
  // error screen (with a manual retry button) is shown.
  const autoRetriesLeftRef = useRef(2);
  const [mapEpoch, setMapEpoch] = useState(0);
  // The map is created exactly once for the component's lifetime. center/zoom
  // are only the initial viewport (fitBounds takes over once data arrives), so
  // they are captured at mount time instead of being effect dependencies —
  // otherwise parents passing inline `center={[a, b]}` arrays would tear the
  // whole map down on every render.
  const initialViewRef = useRef({ center, zoom });
  const tRef = useRef(t);
  tRef.current = t;
  // Route/marker effects must run only against a fully loaded style, so the
  // instance is published to state from the map's "load" event.
  const [readyMap, setReadyMap] = useState<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const usedToken = hasMapboxPublicToken();
  const getNodeTypeLabel = useCallback((nodeType: SupplyChainNode["type"]) =>
  t.has(`popup.nodeTypes.${nodeType}`) ?
  t(`popup.nodeTypes.${nodeType}`) :
  nodeType, [t]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const resizeMap = () => {
      mapRef.current?.resize();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ?
      new ResizeObserver(resizeMap) :
      null;

    resizeObserver?.observe(container);
    const animationFrame = window.requestAnimationFrame(resizeMap);
    window.addEventListener("resize", resizeMap);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeMap);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    let isMounted = true;
    let loadTimeout: ReturnType<typeof setTimeout> | undefined;
    let errorStateTimer: ReturnType<typeof setTimeout> | undefined;
    let autoRetryTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      if (usedToken) {
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

      const { center: initialCenter, zoom: initialZoom } = initialViewRef.current;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: usedToken ? "mapbox://styles/mapbox/streets-v12" : OSM_RASTER_STYLE,
        center: [initialCenter[1], initialCenter[0]], // callers pass [lat, lng]; Mapbox needs [lng, lat]
        zoom: initialZoom,
        antialias: true,
        pitch: 0,
        bearing: 0,
        maxPitch: 0,
        projection: "mercator",
        attributionControl: !usedToken
      });

      const failInitialLoad = () => {
        if (autoRetriesLeftRef.current > 0) {
          autoRetriesLeftRef.current -= 1;
          autoRetryTimer = setTimeout(() => {
            if (isMounted) {
              setMapEpoch((epoch) => epoch + 1);
            }
          }, 1500);
          return;
        }

        setError(tRef.current("errors.loadFailed"));
        setIsLoading(false);
      };

      // Watchdog: if every initial tile request fails (offline, OSM rate
      // limiting), mapbox-gl never fires "load" and never re-requests the
      // failed tiles — the map would sit blank forever. Recreating it is the
      // only way to recover, so treat a stalled initial load as a failure.
      // Note: map.loaded() can report true here (errored tiles count as
      // "finished"), so only the actual "load" event counts.
      let didLoad = false;
      loadTimeout = setTimeout(() => {
        if (!isMounted || mapRef.current !== map || didLoad) {
          return;
        }
        failInitialLoad();
      }, 12000);

      map.addControl(new mapboxgl.NavigationControl());

      const handleLoad = () => {
        didLoad = true;
        clearTimeout(loadTimeout);
        autoRetriesLeftRef.current = 2;
        if (isMounted) {
          setIsLoading(false);
          setError(null);
          setReadyMap(map);
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
        if (!isMounted) return;
        failInitialLoad();
      };

      map.on("load", handleLoad);
      map.on("error", handleError);
      mapRef.current = map;

      return () => {
        isMounted = false;
        if (loadTimeout) clearTimeout(loadTimeout);
        if (errorStateTimer) clearTimeout(errorStateTimer);
        if (autoRetryTimer) clearTimeout(autoRetryTimer);
        sovereigntyMarkersRef.current.forEach((marker) => marker.remove());
        sovereigntyMarkersRef.current = [];
        map.off("load", handleLoad);
        map.off("error", handleError);
        map.remove();
        mapRef.current = null;
        setReadyMap(null);
      };
    } catch (err) {
      if (loadTimeout) clearTimeout(loadTimeout);
      errorStateTimer = setTimeout(() => {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : tRef.current("errors.unknown");
        setError(message);
        setIsLoading(false);
      }, 0);
      return () => {
        isMounted = false;
        if (errorStateTimer) clearTimeout(errorStateTimer);
      };
    }
  }, [usedToken, mapEpoch]);

  useEffect(() => {
    const map = readyMap;
    if (!map) return;

    let routeClickHandler: ((
      event: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }
    ) => void) | null = null;
    let routeMouseEnterHandler: (() => void) | null = null;
    let routeMouseLeaveHandler: (() => void) | null = null;

    try {
      const routeBounds = new mapboxgl.LngLatBounds();
      let hasRouteBounds = false;

      removeRouteLayers(map);

      const routeFeatures = routes.flatMap((route) => {
        const routeCoordinates = buildSupplyChainRouteGeometry(route);
        if (!routeCoordinates || routeCoordinates.length < 2) {
          return [];
        }

        routeCoordinates.forEach((coordinate) => {
          routeBounds.extend(coordinate);
        });
        hasRouteBounds = true;

        return [{
          type: "Feature" as const,
          properties: {
            routeId: route.id,
            color: getRouteColor(route.mode, route.status, route.color),
            width: getRouteWeight(route.mode, route.status),
            opacity: route.status === "pending" ? 0.55 : 0.9
          },
          geometry: {
            type: "LineString" as const,
            coordinates: routeCoordinates
          }
        }];
      });

      if (routeFeatures.length > 0) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: routeFeatures
          }
        });

        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": "#ffffff",
            "line-width": ["+", ["get", "width"], 4],
            "line-opacity": 0.75
          }
        });

        map.addLayer({
          id: ROUTE_LINE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": ["get", "opacity"]
          }
        });

        routeClickHandler = (event) => {
          if (!onRouteClick) return;
          const routeId = event.features?.[0]?.properties?.routeId;
          const hit = routes.find((route) => route.id === routeId);
          if (hit) onRouteClick(hit);
        };
        routeMouseEnterHandler = () => {
          map.getCanvas().style.cursor = "pointer";
        };
        routeMouseLeaveHandler = () => {
          map.getCanvas().style.cursor = "";
        };

        map.on("click", ROUTE_LINE_LAYER_ID, routeClickHandler);
        map.on("mouseenter", ROUTE_LINE_LAYER_ID, routeMouseEnterHandler);
        map.on("mouseleave", ROUTE_LINE_LAYER_ID, routeMouseLeaveHandler);
      }

      if (hasRouteBounds || nodes.length > 0) {
        const bounds = hasRouteBounds ? routeBounds : new mapboxgl.LngLatBounds();
        if (!hasRouteBounds) {
          nodes.forEach((node) => bounds.extend([node.lng, node.lat]));
        }

        if (!bounds.isEmpty()) {
          // Refit only when the data's extent actually changes; otherwise a
          // re-render (e.g. new callback identity from the parent) would
          // yank the viewport away from wherever the user panned/zoomed.
          const fitKey = [
            bounds.getWest().toFixed(3),
            bounds.getSouth().toFixed(3),
            bounds.getEast().toFixed(3),
            bounds.getNorth().toFixed(3)
          ].join(",");

          if (fitKey !== lastFitBoundsKeyRef.current) {
            lastFitBoundsKeyRef.current = fitKey;
            map.fitBounds(bounds, { padding: 50, maxZoom: 10, duration: 0 });
          }
        }
      }
    } catch {

    }

    return () => {
      try {
        if (routeClickHandler) {
          map.off("click", ROUTE_LINE_LAYER_ID, routeClickHandler);
        }
        if (routeMouseEnterHandler) {
          map.off("mouseenter", ROUTE_LINE_LAYER_ID, routeMouseEnterHandler);
        }
        if (routeMouseLeaveHandler) {
          map.off("mouseleave", ROUTE_LINE_LAYER_ID, routeMouseLeaveHandler);
        }
      } catch {

      }
    };
  }, [readyMap, routes, nodes, onRouteClick]);

  useEffect(() => {
    const map = readyMap;
    if (!map) return;

    const renderMarkers = () => {
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

    renderMarkers();

    const onZoomEnd = () => renderMarkers();
    map.on("zoomend", onZoomEnd);

    return () => {
      map.off("zoomend", onZoomEnd);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [readyMap, nodes, onNodeClick, t, getNodeTypeLabel]);

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
            {usedToken ? t("addTokenHint") : t("networkHint")}
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
            onClick={() => {
              autoRetriesLeftRef.current = 2;
              setError(null);
              setIsLoading(true);
              setMapEpoch((epoch) => epoch + 1);
            }}
          >
            {t.has("retry") ? t("retry") : "Thử lại"}
          </button>
        </div>
      </div>);

  }

  return (
    <div
      className="relative isolate w-full max-w-full overflow-hidden rounded-lg border border-border"
      style={{ height, contain: "layout paint" }}
    >
      <div
        ref={mapContainerRef}
        className="absolute inset-0 z-0 h-full w-full overflow-hidden" />

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
