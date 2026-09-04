import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROUTES = [
  "overview",
  "products",
  "assessment",
  "reports",
  "logistics",
  "transport",
  "summary/[slug]",
  "settings"
];

const ROUTE_BUDGETS = {
  overview: 900_000,
  products: 900_000,
  assessment: 1_200_000,
  reports: 850_000,
  logistics: 1_000_000,
  transport: 1_000_000,
  "summary/[slug]": 1_100_000,
  settings: 900_000
};

const MAX_TOTAL_CLIENT_JS_BYTES = 13_500_000;
const checkMode = process.argv.includes("--check");
const nextDirectory = path.resolve(".next");

if (!existsSync(nextDirectory)) {
  console.error("Missing .next output. Run `npm run build` before measuring bundles.");
  process.exit(1);
}

const routeMeasurements = ROUTES.map((route) => {
  const manifestPath = path.join(
    nextDirectory,
    "server",
    "app",
    "(dashboard)",
    route,
    "page_client-reference-manifest.js"
  );
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing route client manifest: ${manifestPath}`);
  }

  const sandbox = { globalThis: {} };
  vm.runInNewContext(readFileSync(manifestPath, "utf8"), sandbox);
  const manifestKey = `/(dashboard)/${route}/page`;
  const manifest = sandbox.globalThis.__RSC_MANIFEST?.[manifestKey];
  if (!manifest) throw new Error(`Missing route manifest key: ${manifestKey}`);

  const files = new Set(Object.values(manifest.entryJSFiles || {}).flat());
  const bytes = [...files].reduce((total, file) => {
    const fullPath = path.join(nextDirectory, file);
    return total + (existsSync(fullPath) ? statSync(fullPath).size : 0);
  }, 0);

  return {
    route: `/${route}`,
    chunks: files.size,
    bytes,
    budgetBytes: ROUTE_BUDGETS[route]
  };
});

const collectJavaScript = (directory) => {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(absolutePath);
    return entry.name.endsWith(".js") ? [absolutePath] : [];
  });
};

const clientChunkDirectory = path.join(nextDirectory, "static", "chunks");
const clientFiles = collectJavaScript(clientChunkDirectory);
const totalClientJsBytes = clientFiles.reduce(
  (total, file) => total + statSync(file).size,
  0
);

console.table(routeMeasurements.map((measurement) => ({
  route: measurement.route,
  chunks: measurement.chunks,
  KiB: Number((measurement.bytes / 1024).toFixed(1)),
  budgetKiB: Number((measurement.budgetBytes / 1024).toFixed(1))
})));
console.log(JSON.stringify({
  clientChunkCount: clientFiles.length,
  totalClientJsBytes,
  totalClientJsMiB: Number((totalClientJsBytes / 1024 / 1024).toFixed(2))
}));

if (checkMode) {
  const violations = routeMeasurements
    .filter((measurement) => measurement.bytes > measurement.budgetBytes)
    .map((measurement) =>
      `${measurement.route}: ${measurement.bytes} > ${measurement.budgetBytes}`
    );
  if (totalClientJsBytes > MAX_TOTAL_CLIENT_JS_BYTES) {
    violations.push(
      `total client JS: ${totalClientJsBytes} > ${MAX_TOTAL_CLIENT_JS_BYTES}`
    );
  }

  if (violations.length > 0) {
    console.error("Client bundle budget exceeded:");
    violations.forEach((violation) => console.error(`- ${violation}`));
    process.exit(1);
  }

  console.log("Client bundle budgets passed.");
}
