// Runtime bản đồ dùng chung: toàn bộ bản đồ trong app chạy trên MapLibre GL (mã nguồn mở),
// nền bản đồ từ OpenFreeMap — không cần access token.
import * as maplibregl from "maplibre-gl";

// Worker được copy vào public/ bởi scripts/copy-maplibre-worker.mjs (predev/prebuild).
export const MAPLIBRE_WORKER_URL = "/vendor/maplibre/maplibre-gl-worker.mjs";

export const OPENFREEMAP_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

/** Dự phòng khi không tải được style vector: nền raster OpenStreetMap. */
export const OSM_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};

export function ensureMaplibreWorker() {
  if (maplibregl.getWorkerUrl() !== MAPLIBRE_WORKER_URL) {
    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
  }
}
