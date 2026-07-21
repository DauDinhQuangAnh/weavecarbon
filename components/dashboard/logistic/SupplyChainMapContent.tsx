"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildSupplyChainRouteGeometry } from "@/lib/transportRouteGeometry";
import {
  addVietnamSovereigntyLayers,
  hideBaseSeaNameLayers,
  VIETNAM_SOVEREIGNTY_BASE_LAYER_ID
} from "@/lib/vietnamSovereigntyMapLayers";
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

// OpenFreeMap serves OSM-based vector tiles with no API key, no usage cap and
// commercial use allowed — unlike the raw OSM raster tile server (which blocks
// production traffic and left this map blank) and unlike Mapbox (which needs a
// token configured per environment).
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const MODE_FALLBACK_COLORS: Record<string, string> = {
  ship: "#3b82f6",
  air: "#8b5cf6",
  rail: "#14b8a6",
  truck: "#f59e0b"
};

const STATUS_COLORS = {
  completed: "#22c55e",
  pending: "#eab308",
  active: "#3b82f6"
} as const;

const getRouteColor = (mode: string, status: string, color?: string) => {
  if (status === "pending") return color ? `${color}88` : "#9ca3af";
  if (status === "completed") return color ?? STATUS_COLORS.completed;
  return color ?? MODE_FALLBACK_COLORS[mode] ?? "#6b7280";
};

const getRouteWeight = (mode: string, status: string) => {
  const base = mode === "ship" ? 4 : mode === "air" ? 3.5 : mode === "rail" ? 3 : 2.5;
  if (status === "in_transit") return base;
  if (status === "completed") return base * 0.85;
  return base * 0.65;
};

const getTypeLetter = (type: string) => {
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ROUTE_SOURCE_ID = "shipment-routes";
const ROUTE_CASING_LAYER_ID = "shipment-routes-casing";
const ROUTE_SOLID_LAYER_ID = "shipment-routes-solid";
const ROUTE_AIR_LAYER_ID = "shipment-routes-air";
const ROUTE_FLOW_LAYER_ID = "shipment-routes-flow";

const NODES_SOURCE_ID = "shipment-nodes";
const CLUSTER_CIRCLE_LAYER_ID = "shipment-nodes-cluster";
const CLUSTER_COUNT_LAYER_ID = "shipment-nodes-cluster-count";
const NODE_CIRCLE_LAYER_ID = "shipment-nodes-point";
const NODE_LETTER_LAYER_ID = "shipment-nodes-letter";

// Classic "marching ants" cycle: successive dash phases of the same pattern.
// Stepping through them makes dashes appear to travel along in-transit routes.
const FLOW_DASH_PHASES: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0]
];
const FLOW_STEP_MS = 90;

const removeShipmentLayers = (map: maplibregl.Map) => {
  try {
    for (const layerId of [
      ROUTE_FLOW_LAYER_ID,
      ROUTE_AIR_LAYER_ID,
      ROUTE_SOLID_LAYER_ID,
      ROUTE_CASING_LAYER_ID
    ]) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
  } catch {
    // Layer teardown racing a style reload is harmless.
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const lastFitBoundsKeyRef = useRef<string | null>(null);
  // Transient init failures (offline, style CDN hiccup) trigger a couple of
  // automatic re-creations before the error screen with a manual retry button.
  const autoRetriesLeftRef = useRef(2);
  const [mapEpoch, setMapEpoch] = useState(0);
  // The map is created exactly once per epoch. center/zoom are only the
  // initial viewport (fitBounds takes over once data arrives), so they are
  // captured at mount time instead of being effect dependencies — otherwise
  // parents passing inline `center={[a, b]}` arrays would tear the whole map
  // down on every render.
  const initialViewRef = useRef({ center, zoom });
  const tRef = useRef(t);
  tRef.current = t;
  // Route/marker effects must run only against a fully loaded style, so the
  // instance is published to state from the map's "load" event.
  const [readyMap, setReadyMap] = useState<maplibregl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getNodeTypeLabel = useCallback(
    (nodeType: SupplyChainNode["type"]) =>
      t.has(`popup.nodeTypes.${nodeType}`) ? t(`popup.nodeTypes.${nodeType}`) : nodeType,
    [t]
  );

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const resizeMap = () => {
      mapRef.current?.resize();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeMap) : null;

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
    let errorStateTimer: ReturnType<typeof setTimeout> | undefined;
    let autoRetryTimer: ReturnType<typeof setTimeout> | undefined;

    let map: maplibregl.Map;
    try {
      const { center: initialCenter, zoom: initialZoom } = initialViewRef.current;
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE_URL,
        center: [initialCenter[1], initialCenter[0]], // callers pass [lat, lng]; MapLibre needs [lng, lat]
        zoom: initialZoom,
        attributionControl: { compact: true }
      });
    } catch (err) {
      // e.g. WebGL unavailable — surface the error screen instead of crashing.
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

    // Watchdog: if the style or every initial tile request fails, "load"
    // never fires and the map would sit blank forever. Recreating the map is
    // the only reliable recovery, so a stalled initial load counts as failure.
    let didLoad = false;
    const loadTimeout = setTimeout(() => {
      if (!isMounted || mapRef.current !== map || didLoad) {
        return;
      }
      failInitialLoad();
    }, 12000);

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const handleLoad = () => {
      didLoad = true;
      clearTimeout(loadTimeout);
      autoRetriesLeftRef.current = 2;
      hideBaseSeaNameLayers(map);
      addVietnamSovereigntyLayers(map);
      if (isMounted) {
        setIsLoading(false);
        setError(null);
        setReadyMap(map);
      }
    };

    const handleError = (event: { error: Error }) => {
      // MapLibre fires "error" for per-tile fetch failures as well as fatal
      // style/init errors. A single failed tile shouldn't tear down a map
      // that already rendered — only surface the fatal error screen when the
      // map never got past its initial load.
      const sourceScoped = Boolean((event as { sourceId?: string }).sourceId);
      if (didLoad || sourceScoped || map.loaded()) {
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
      if (autoRetryTimer) clearTimeout(autoRetryTimer);
      popupRef.current?.remove();
      popupRef.current = null;
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.remove();
      mapRef.current = null;
      setReadyMap(null);
    };
  }, [mapEpoch]);

  /* Routes: one GeoJSON source, casing + solid + dashed-air line layers, and
     an animated "flow" overlay on in-transit routes. */
  useEffect(() => {
    const map = readyMap;
    if (!map) return;

    let flowFrame: number | undefined;
    let routeClickHandler: ((event: MapLayerMouseEvent) => void) | null = null;
    const setPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = "";
    };
    const interactiveRouteLayers = [ROUTE_SOLID_LAYER_ID, ROUTE_AIR_LAYER_ID];

    try {
      removeShipmentLayers(map);

      const routeFeatures = routes.flatMap((route) => {
        const routeCoordinates = buildSupplyChainRouteGeometry(route);
        if (!routeCoordinates || routeCoordinates.length < 2) {
          return [];
        }

        return [
          {
            type: "Feature" as const,
            properties: {
              routeId: route.id,
              mode: route.mode,
              status: route.status,
              color: getRouteColor(route.mode, route.status, route.color),
              width: getRouteWeight(route.mode, route.status),
              opacity: route.status === "pending" ? 0.55 : 0.9
            },
            geometry: {
              type: "LineString" as const,
              coordinates: routeCoordinates
            }
          }
        ];
      });

      if (routeFeatures.length > 0) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: routeFeatures }
        });

        // Keep data layers under the sovereignty labels so Hoàng Sa /
        // Trường Sa stay readable even when a route crosses them.
        const beforeId = map.getLayer(VIETNAM_SOVEREIGNTY_BASE_LAYER_ID)
          ? VIETNAM_SOVEREIGNTY_BASE_LAYER_ID
          : undefined;

        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": ["+", ["get", "width"], 4],
            "line-opacity": 0.75
          }
        }, beforeId);

        map.addLayer({
          id: ROUTE_SOLID_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          filter: ["!=", ["get", "mode"], "air"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": ["get", "opacity"]
          }
        }, beforeId);

        // line-dasharray is not data-driven, so air routes get their own
        // dashed layer instead of a per-feature dash property.
        map.addLayer({
          id: ROUTE_AIR_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          filter: ["==", ["get", "mode"], "air"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": ["get", "opacity"],
            "line-dasharray": [2, 2]
          }
        }, beforeId);

        const hasInTransit = routes.some((route) => route.status === "in_transit");
        if (hasInTransit) {
          map.addLayer({
            id: ROUTE_FLOW_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            filter: ["==", ["get", "status"], "in_transit"],
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "rgba(255,255,255,0.9)",
              "line-width": ["max", ["-", ["get", "width"], 2], 1.5],
              "line-dasharray": FLOW_DASH_PHASES[0]
            }
          }, beforeId);

          let phase = 0;
          let lastStep = 0;
          const stepFlow = (timestamp: number) => {
            if (timestamp - lastStep >= FLOW_STEP_MS) {
              lastStep = timestamp;
              phase = (phase + 1) % FLOW_DASH_PHASES.length;
              if (map.getLayer(ROUTE_FLOW_LAYER_ID)) {
                map.setPaintProperty(
                  ROUTE_FLOW_LAYER_ID,
                  "line-dasharray",
                  FLOW_DASH_PHASES[phase]
                );
              }
            }
            flowFrame = window.requestAnimationFrame(stepFlow);
          };
          flowFrame = window.requestAnimationFrame(stepFlow);
        }

        routeClickHandler = (event) => {
          if (!onRouteClick) return;
          const routeId = event.features?.[0]?.properties?.routeId;
          const hit = routes.find((route) => route.id === routeId);
          if (hit) onRouteClick(hit);
        };
        for (const layerId of interactiveRouteLayers) {
          map.on("click", layerId, routeClickHandler);
          map.on("mouseenter", layerId, setPointer);
          map.on("mouseleave", layerId, clearPointer);
        }
      }
    } catch {
      // A failed data refresh must not take down an already rendered map.
    }

    return () => {
      if (flowFrame !== undefined) window.cancelAnimationFrame(flowFrame);
      try {
        for (const layerId of interactiveRouteLayers) {
          if (routeClickHandler) map.off("click", layerId, routeClickHandler);
          map.off("mouseenter", layerId, setPointer);
          map.off("mouseleave", layerId, clearPointer);
        }
        removeShipmentLayers(map);
      } catch {
        // Map may already be destroyed during teardown.
      }
    };
  }, [readyMap, routes, onRouteClick]);

  /* Nodes: GL-native clustering instead of hand-rolled DOM-marker grids —
     crisper rendering and clusters split/merge continuously while zooming. */
  useEffect(() => {
    const map = readyMap;
    if (!map) return;

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const setPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleClusterClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const clusterId = feature.properties?.cluster_id;
      const source = map.getSource(NODES_SOURCE_ID) as GeoJSONSource | undefined;
      if (clusterId === undefined || !source) return;
      if (feature.geometry.type !== "Point") return;
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      source
        .getClusterExpansionZoom(clusterId)
        .then((targetZoom) => {
          map.easeTo({ center: [lng, lat], zoom: targetZoom + 0.5 });
        })
        .catch(() => {});
    };

    const handleNodeClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const nodeId = feature?.properties?.nodeId;
      const node = nodeId !== undefined ? nodeById.get(String(nodeId)) : undefined;
      if (!node) return;

      const nodeTypeLabel = getNodeTypeLabel(node.type);
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ offset: 18 })
        .setLngLat([node.lng, node.lat])
        .setHTML(`
          <div style="padding: 6px; min-width: 200px; font-family: inherit;">
            <div style="font-weight: bold; margin-bottom: 6px;">${escapeHtml(node.name)}</div>
            <div style="font-size: 13px; line-height: 1.5;">
              <p><strong>${escapeHtml(t("popup.type"))}:</strong> ${escapeHtml(nodeTypeLabel)}</p>
              <p><strong>${escapeHtml(t("popup.country"))}:</strong> ${escapeHtml(node.country)}</p>
              ${node.co2 !== undefined ? `<p><strong>${escapeHtml(t("popup.co2"))}:</strong> ${node.co2} tCO2</p>` : ""}
            </div>
          </div>
        `)
        .addTo(map);

      onNodeClick?.(node);
    };

    try {
      map.addSource(NODES_SOURCE_ID, {
        type: "geojson",
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 12,
        data: {
          type: "FeatureCollection",
          features: nodes.map((node) => ({
            type: "Feature" as const,
            properties: {
              nodeId: node.id,
              letter: getTypeLetter(node.type),
              color:
                node.status === "completed"
                  ? STATUS_COLORS.completed
                  : node.status === "pending"
                  ? STATUS_COLORS.pending
                  : STATUS_COLORS.active
            },
            geometry: { type: "Point" as const, coordinates: [node.lng, node.lat] }
          }))
        }
      });

      // Keep marker layers under the sovereignty labels as well (see the
      // matching comment in the routes effect).
      const beforeId = map.getLayer(VIETNAM_SOVEREIGNTY_BASE_LAYER_ID)
        ? VIETNAM_SOVEREIGNTY_BASE_LAYER_ID
        : undefined;

      map.addLayer({
        id: CLUSTER_CIRCLE_LAYER_ID,
        type: "circle",
        source: NODES_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#334155",
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 10, 24],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5
        }
      }, beforeId);

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: NODES_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
          "text-allow-overlap": true
        },
        paint: { "text-color": "#ffffff" }
      }, beforeId);

      map.addLayer({
        id: NODE_CIRCLE_LAYER_ID,
        type: "circle",
        source: NODES_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 13,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5
        }
      }, beforeId);

      map.addLayer({
        id: NODE_LETTER_LAYER_ID,
        type: "symbol",
        source: NODES_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "letter"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-allow-overlap": true,
          "text-ignore-placement": true
        },
        paint: { "text-color": "#ffffff" }
      }, beforeId);

      map.on("click", CLUSTER_CIRCLE_LAYER_ID, handleClusterClick);
      map.on("click", NODE_CIRCLE_LAYER_ID, handleNodeClick);
      for (const layerId of [CLUSTER_CIRCLE_LAYER_ID, NODE_CIRCLE_LAYER_ID]) {
        map.on("mouseenter", layerId, setPointer);
        map.on("mouseleave", layerId, clearPointer);
      }
    } catch {
      // A failed data refresh must not take down an already rendered map.
    }

    return () => {
      try {
        map.off("click", CLUSTER_CIRCLE_LAYER_ID, handleClusterClick);
        map.off("click", NODE_CIRCLE_LAYER_ID, handleNodeClick);
        for (const layerId of [CLUSTER_CIRCLE_LAYER_ID, NODE_CIRCLE_LAYER_ID]) {
          map.off("mouseenter", layerId, setPointer);
          map.off("mouseleave", layerId, clearPointer);
        }
        for (const layerId of [
          NODE_LETTER_LAYER_ID,
          NODE_CIRCLE_LAYER_ID,
          CLUSTER_COUNT_LAYER_ID,
          CLUSTER_CIRCLE_LAYER_ID
        ]) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        }
        if (map.getSource(NODES_SOURCE_ID)) map.removeSource(NODES_SOURCE_ID);
      } catch {
        // Map may already be destroyed during teardown.
      }
    };
  }, [readyMap, nodes, onNodeClick, t, getNodeTypeLabel]);

  /* Viewport: fit to the data, but only when its extent actually changes —
     otherwise a re-render would yank the viewport away from wherever the
     user panned/zoomed. */
  useEffect(() => {
    const map = readyMap;
    if (!map) return;

    const bounds = new maplibregl.LngLatBounds();
    let hasBounds = false;

    for (const route of routes) {
      const coordinates = buildSupplyChainRouteGeometry(route);
      if (coordinates && coordinates.length >= 2) {
        for (const coordinate of coordinates) {
          bounds.extend(coordinate);
        }
        hasBounds = true;
      }
    }
    if (!hasBounds) {
      for (const node of nodes) {
        bounds.extend([node.lng, node.lat]);
        hasBounds = true;
      }
    }
    if (!hasBounds) return;

    const fitKey = [
      bounds.getWest().toFixed(3),
      bounds.getSouth().toFixed(3),
      bounds.getEast().toFixed(3),
      bounds.getNorth().toFixed(3)
    ].join(",");

    if (fitKey !== lastFitBoundsKeyRef.current) {
      lastFitBoundsKeyRef.current = fitKey;
      map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 0 });
    }
  }, [readyMap, routes, nodes]);

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-muted rounded-lg border"
      >
        <div className="text-center">
          <p className="text-sm text-destructive font-semibold mb-2">{t("errorTitle")}</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">{t("networkHint")}</p>
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
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative isolate w-full max-w-full overflow-hidden rounded-lg border border-border"
      style={{ height, contain: "layout paint" }}
    >
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full overflow-hidden" />

      {isLoading && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        </div>
      )}

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
            <span>{t("legend.railRoute")}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{t("legend.roadRoute")}</span>
          </div>
          <div className="border-t border-border mt-1.5 pt-1.5 text-muted-foreground">
            <span>{t("legend.perShipment")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplyChainMapContent;
