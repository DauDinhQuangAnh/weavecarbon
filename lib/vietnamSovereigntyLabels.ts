import type mapboxgl from "mapbox-gl";

interface SovereigntyLabelSpec {
  lng: number;
  lat: number;
  label: string;
}

// Neither Mapbox's default styles nor the OpenStreetMap raster fallback used
// in this app label sovereignty over these archipelagos — both render them
// neutrally or omit labels entirely at world/regional zoom. Vietnamese law
// requires maps shown to Vietnamese users to represent Hoàng Sa (Paracel) and
// Trường Sa (Spratly) as Vietnamese territory, so every map in this app must
// render them explicitly rather than relying on the base tile provider.
const SOVEREIGNTY_LABELS: SovereigntyLabelSpec[] = [
  { lng: 112.0, lat: 16.5, label: "Hoàng Sa (Việt Nam)" },
  { lng: 111.92, lat: 8.63, label: "Trường Sa (Việt Nam)" }
];

const createLabelElement = (text: string) => {
  const el = document.createElement("div");
  el.style.cssText = [
    "padding: 2px 6px",
    "background: rgba(255,255,255,0.92)",
    "border: 1px solid #b91c1c",
    "border-radius: 4px",
    "color: #b91c1c",
    "font-size: 10px",
    "font-weight: 700",
    "line-height: 1.2",
    "white-space: nowrap",
    "pointer-events: none",
    "box-shadow: 0 1px 3px rgba(0,0,0,0.25)"
  ].join("; ");
  el.textContent = text;
  return el;
};

/**
 * Adds "Hoàng Sa (Việt Nam)" / "Trường Sa (Việt Nam)" markers to a Mapbox GL
 * map instance. Uses DOM markers (not a GL symbol layer) so it renders
 * correctly regardless of whether the active style has glyphs configured
 * (the OSM raster fallback style used when no Mapbox token is set does not).
 * Caller is responsible for removing the returned markers on cleanup.
 */
export const addVietnamSovereigntyLabels = (
  mapboxRuntime: typeof mapboxgl,
  map: mapboxgl.Map
): mapboxgl.Marker[] =>
  SOVEREIGNTY_LABELS.map(({ lng, lat, label }) =>
    new mapboxRuntime.Marker({ element: createLabelElement(label), anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map)
  );
