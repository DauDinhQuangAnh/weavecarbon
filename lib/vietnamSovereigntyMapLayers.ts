import type { Map as MapLibreMap } from "maplibre-gl";
import type { GeoJSON } from "geojson";

// Vietnamese law requires maps shown to Vietnamese users to represent Hoàng Sa
// (Paracel) and Trường Sa (Spratly) as Vietnamese territory. The base tile
// style renders these archipelagos neutrally (and may label the surrounding
// sea with a foreign name), so every map in this app must add its own
// sovereignty layers on top of the base style rather than relying on the tile
// provider. This module is the MapLibre GL implementation; the legacy Mapbox
// maps use lib/vietnamSovereigntyLabels.ts.

const SOURCE_ID = "vn-sovereignty";
const LAYER_IDS = {
  islandDots: "vn-sovereignty-island-dots",
  islandLabels: "vn-sovereignty-island-labels",
  archipelagoLabels: "vn-sovereignty-archipelago-labels",
  seaLabel: "vn-sovereignty-sea-label"
} as const;

// Bottom-most sovereignty layer. Data layers (routes, markers) should be
// inserted before this id so the sovereignty labels always stay on top.
export const VIETNAM_SOVEREIGNTY_BASE_LAYER_ID = LAYER_IDS.islandDots;

const SOVEREIGNTY_RED = "#b91c1c";
const SEA_LABEL_BLUE = "#4a7fb5";

// Liberty (OpenFreeMap) serves these Noto Sans stacks from its glyphs
// endpoint; Noto Sans covers Vietnamese diacritics.
const FONT_REGULAR = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const FONT_ITALIC = ["Noto Sans Italic"];

interface IslandSpec {
  name: string;
  lng: number;
  lat: number;
}

// A representative set of the best-known islands in each archipelago so the
// map visibly shows land there even at zooms where the base tiles render
// nothing but water.
const HOANG_SA_ISLANDS: IslandSpec[] = [
  { name: "Đảo Phú Lâm", lng: 112.3358, lat: 16.8339 },
  { name: "Đảo Hoàng Sa", lng: 111.607, lat: 16.535 },
  { name: "Đảo Linh Côn", lng: 112.732, lat: 16.665 },
  { name: "Đảo Tri Tôn", lng: 111.192, lat: 15.785 }
];

const TRUONG_SA_ISLANDS: IslandSpec[] = [
  { name: "Đảo Trường Sa", lng: 111.9203, lat: 8.6442 },
  { name: "Đảo Song Tử Tây", lng: 114.33, lat: 11.4258 },
  { name: "Đảo Nam Yết", lng: 114.3653, lat: 10.1769 },
  { name: "Đảo Sơn Ca", lng: 114.4796, lat: 10.3808 },
  { name: "Đảo Sinh Tồn", lng: 114.3242, lat: 9.8828 },
  { name: "Đảo An Bang", lng: 112.9161, lat: 7.8886 }
];

const buildSovereigntyGeoJson = (): GeoJSON => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { kind: "archipelago", name: "QĐ. Hoàng Sa\n(Việt Nam)" },
      geometry: { type: "Point", coordinates: [112.0, 16.45] }
    },
    {
      type: "Feature",
      properties: { kind: "archipelago", name: "QĐ. Trường Sa\n(Việt Nam)" },
      geometry: { type: "Point", coordinates: [113.6, 9.7] }
    },
    {
      type: "Feature",
      properties: { kind: "sea", name: "Biển Đông" },
      geometry: { type: "Point", coordinates: [112.2, 13.2] }
    },
    ...[...HOANG_SA_ISLANDS, ...TRUONG_SA_ISLANDS].map((island) => ({
      type: "Feature" as const,
      properties: { kind: "island", name: island.name },
      geometry: { type: "Point" as const, coordinates: [island.lng, island.lat] }
    }))
  ]
});

/**
 * The base style labels the sea between Vietnam and the archipelagos with a
 * foreign name. Which layer holds that label varies between style versions,
 * so instead of hunting for one feature, hide every sea/ocean name layer and
 * let addVietnamSovereigntyLayers draw "Biển Đông" itself. Deterministic —
 * the foreign label can never slip through on a style update.
 */
export const hideBaseSeaNameLayers = (map: MapLibreMap) => {
  try {
    const layers = map.getStyle()?.layers ?? [];
    for (const layer of layers) {
      if (layer.type !== "symbol") continue;
      const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
      if (sourceLayer === "water_name" || /water[-_]?name/i.test(layer.id)) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    }
  } catch {
    // Progressive enhancement only — never let label surgery break the map.
  }
};

/** Idempotent: safe to call again after a style reload. */
export const addVietnamSovereigntyLayers = (map: MapLibreMap) => {
  try {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: buildSovereigntyGeoJson() });
    }

    if (!map.getLayer(LAYER_IDS.islandDots)) {
      map.addLayer({
        id: LAYER_IDS.islandDots,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "island"],
        paint: {
          "circle-color": SOVEREIGNTY_RED,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.8, 7, 3.2, 10, 4.5],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1
        }
      });
    }

    if (!map.getLayer(LAYER_IDS.islandLabels)) {
      map.addLayer({
        id: LAYER_IDS.islandLabels,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "island"],
        minzoom: 6,
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT_REGULAR,
          "text-size": 11,
          "text-offset": [0, 0.9],
          "text-anchor": "top"
        },
        paint: {
          "text-color": SOVEREIGNTY_RED,
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 1.2
        }
      });
    }

    if (!map.getLayer(LAYER_IDS.seaLabel)) {
      map.addLayer({
        id: LAYER_IDS.seaLabel,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "sea"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT_ITALIC,
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 12, 7, 20],
          "text-letter-spacing": 0.35,
          "text-allow-overlap": true
        },
        paint: {
          "text-color": SEA_LABEL_BLUE,
          "text-halo-color": "rgba(255,255,255,0.7)",
          "text-halo-width": 1
        }
      });
    }

    if (!map.getLayer(LAYER_IDS.archipelagoLabels)) {
      map.addLayer({
        id: LAYER_IDS.archipelagoLabels,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "archipelago"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT_BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 10.5, 5, 13, 8, 15],
          "text-line-height": 1.25,
          "text-allow-overlap": true,
          "text-ignore-placement": true
        },
        paint: {
          "text-color": SOVEREIGNTY_RED,
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 1.6
        }
      });
    }
  } catch {
    // Sovereignty layers must never crash the map; the caller re-invokes on
    // the next style load if this attempt raced a style change.
  }
};
