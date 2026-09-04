import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["app", "components", "contexts", "hooks", "lib"];
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const ALLOWED_FETCH_MODULES = new Set([
  path.normalize("lib/http/requestPolicy.ts")
]);

const violations = [];

const walk = async (relativeDirectory) => {
  const absoluteDirectory = path.join(ROOT, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      await walk(relativePath);
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (/\.(?:test|spec)\.[jt]sx?$/.test(entry.name)) continue;
    if (ALLOWED_FETCH_MODULES.has(path.normalize(relativePath))) continue;

    const source = await readFile(path.join(ROOT, relativePath), "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/\bfetch\s*\(/.test(line)) {
        violations.push(`${relativePath}:${index + 1}: direct fetch()`);
      }
    });
  }
};

for (const sourceRoot of SOURCE_ROOTS) {
  await walk(sourceRoot);
}

if (violations.length > 0) {
  console.error("Network boundary violations found:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  console.error("Use api/openApiClient for backend calls or fetchWithPolicy for external HTTP.");
  process.exit(1);
}

console.log("Network boundary check passed: all HTTP uses the shared bounded transport.");
