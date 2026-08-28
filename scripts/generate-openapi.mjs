import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(frontendRoot, "contracts", "backend.openapi.json");
const generatedPath = path.join(frontendRoot, "lib", "api", "generated", "backend.ts");
const backendArtifactPath = path.resolve(
  process.env.BACKEND_OPENAPI_PATH ||
    path.join(frontendRoot, "..", "BE_weavecarbon", "openapi", "openapi.json")
);
const checkOnly = process.argv.includes("--check");
const syncBackend = process.argv.includes("--sync");

let stale = false;

function reportStale(message) {
  stale = true;
  console.error(message);
}

if (syncBackend) {
  if (!fs.existsSync(backendArtifactPath)) {
    throw new Error(
      `Backend OpenAPI artifact not found at ${backendArtifactPath}. ` +
        "Run the backend `npm run openapi:export` or set BACKEND_OPENAPI_PATH."
    );
  }

  const backendArtifact = fs.readFileSync(backendArtifactPath, "utf8");
  const currentSnapshot = fs.existsSync(snapshotPath)
    ? fs.readFileSync(snapshotPath, "utf8")
    : null;

  if (checkOnly) {
    if (currentSnapshot !== backendArtifact) {
      reportStale(
        "Frontend OpenAPI snapshot differs from the backend artifact. " +
          "Run `npm run contract:sync` and commit the result."
      );
    }
  } else {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, backendArtifact, "utf8");
    console.log(`Synced ${path.relative(frontendRoot, snapshotPath)}`);
  }
}

if (!fs.existsSync(snapshotPath)) {
  throw new Error(
    `OpenAPI snapshot not found at ${snapshotPath}. Run \`npm run contract:sync\` first.`
  );
}

const schema = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const ast = await openapiTS(schema, { alphabetize: true });
const generated = `${COMMENT_HEADER}${astToString(ast)}`;

if (checkOnly) {
  const currentGenerated = fs.existsSync(generatedPath)
    ? fs.readFileSync(generatedPath, "utf8")
    : null;
  if (currentGenerated !== generated) {
    reportStale(
      "Generated OpenAPI types are stale. Run `npm run contract:generate` and commit the result."
    );
  }
} else {
  fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
  fs.writeFileSync(generatedPath, generated, "utf8");
  console.log(`Generated ${path.relative(frontendRoot, generatedPath)}`);
}

if (stale) {
  process.exitCode = 1;
} else if (checkOnly) {
  console.log("OpenAPI snapshot and generated types are current.");
}
