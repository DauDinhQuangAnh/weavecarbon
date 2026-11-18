#!/usr/bin/env node
// MapLibre GL v6 starts its Web Worker from a URL next to the library file
// (new URL('./maplibre-gl-worker.mjs', import.meta.url)). After Next.js bundles
// the library that URL points into /_next/static/chunks/, where the file does
// not exist, so the worker fails with "non-JavaScript MIME type" and the map
// never renders. We copy the worker (and the shared chunk it imports) into
// public/ and point MapLibre at it with setWorkerUrl().
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const distDir = path.dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const targetDir = path.join(root, "public", "vendor", "maplibre");
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

fs.mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  const source = path.join(distDir, file);
  if (!fs.existsSync(source)) {
    console.error(`[maplibre-worker] Missing ${source}; is maplibre-gl installed?`);
    process.exit(1);
  }
  fs.copyFileSync(source, path.join(targetDir, file));
}
console.log(`[maplibre-worker] Copied ${files.join(", ")} to public/vendor/maplibre`);
