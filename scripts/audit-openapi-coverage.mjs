import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.resolve(
  process.env.BACKEND_REPO_PATH || path.join(frontendRoot, "..", "BE_weavecarbon")
);

if (!fs.existsSync(path.join(backendRoot, "src", "config", "swagger.js"))) {
  throw new Error(
    `Backend OpenAPI module not found under ${backendRoot}. Set BACKEND_REPO_PATH to the backend repository.`
  );
}

process.env.JWT_SECRET ||= "frontend-contract-audit-only";
process.env.JWT_REFRESH_SECRET ||= "frontend-contract-audit-refresh-only";

const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const swaggerSpec = backendRequire(path.join(backendRoot, "src", "config", "swagger.js"));
const sourceRoots = ["app", "components", "contexts", "hooks", "lib"];
const httpMethods = ["get", "post", "put", "patch", "delete"];

const documentedOperations = new Set();
for (const [contractPath, pathItem] of Object.entries(swaggerSpec.paths || {})) {
  for (const method of httpMethods) {
    if (pathItem[method]) {
      documentedOperations.add(
        `${method.toUpperCase()} ${contractPath.replace(/\{[^}]+\}/g, "{}")}`
      );
    }
  }
}

const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\./.test(entry.name)
    ) {
      files.push(entryPath);
    }
  }
}

for (const root of sourceRoots) {
  walk(path.join(frontendRoot, root));
}

function sourceLocation(sourceFile, node) {
  const relativeFile = path.relative(frontendRoot, sourceFile.fileName);
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  return `${relativeFile}:${line}`;
}

function normalizeContractPath(rawValue) {
  let value = rawValue;
  const apiMarker = value.indexOf("/api/");
  if (apiMarker >= 0) {
    value = value.slice(apiMarker + 4);
  } else if (/^\{param\}\//.test(value)) {
    value = value.slice("{param}".length);
  }

  value = value
    .split("?")[0]
    .replace(/\{param\}/g, "{}")
    .replace(/\/+/g, "/");

  // A template expression appended directly to the base path is a query-string
  // helper, while /{param} is a real path parameter.
  if (value.endsWith("{}") && !value.slice(0, -2).endsWith("/")) {
    value = value.slice(0, -2);
  }

  return value;
}

const discovered = [];
const dynamicHelpers = [];

for (const file of files) {
  const sourceFile = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const variables = new Map();

  function indexVariables(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      variables.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, indexVariables);
  }
  indexVariables(sourceFile);

  function staticValue(node, seen = new Set()) {
    if (!node) return null;
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text;
    }
    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans) {
        result += `${staticValue(span.expression, new Set(seen)) || "{param}"}${span.literal.text}`;
      }
      return result;
    }
    if (ts.isIdentifier(node) && variables.has(node.text) && !seen.has(node.text)) {
      seen.add(node.text);
      return staticValue(variables.get(node.text), seen);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "resolveApiUrl"
    ) {
      return staticValue(node.arguments[0], seen);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "encodeURIComponent"
    ) {
      return "{param}";
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "withEncodedMarketPath"
    ) {
      return `${staticValue(variables.get("EXPORT_MARKETS_ENDPOINT"), seen) || "/export/markets"}/{param}`;
    }
    return null;
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      let method = null;
      let pathArgument = null;

      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(sourceFile) === "api" &&
        httpMethods.includes(node.expression.name.text)
      ) {
        method = node.expression.name.text.toUpperCase();
        pathArgument = node.arguments[0];
      } else if (ts.isIdentifier(node.expression) && node.expression.text === "apiRequest") {
        method = "GET";
        pathArgument = node.arguments[0];
        const options = node.arguments[1];
        if (options && ts.isObjectLiteralExpression(options)) {
          const methodProperty = options.properties.find(
            (property) =>
              ts.isPropertyAssignment(property) &&
              property.name.getText(sourceFile).replace(/["']/g, "") === "method"
          );
          const explicitMethod = methodProperty && staticValue(methodProperty.initializer);
          if (explicitMethod) method = explicitMethod.toUpperCase();
        }
      } else if (ts.isIdentifier(node.expression) && node.expression.text === "fetch") {
        pathArgument = node.arguments[0];
        const raw = staticValue(pathArgument);
        const isBackendFetch = raw && (
          raw.includes("/api/") ||
          raw.startsWith("{param}/reports/") ||
          (ts.isIdentifier(pathArgument) && variables.has(pathArgument.text))
        );
        if (isBackendFetch) {
          method = "GET";
          const options = node.arguments[1];
          if (options && ts.isObjectLiteralExpression(options)) {
            const methodProperty = options.properties.find(
              (property) =>
                ts.isPropertyAssignment(property) &&
                property.name.getText(sourceFile).replace(/["']/g, "") === "method"
            );
            const explicitMethod = methodProperty && staticValue(methodProperty.initializer);
            if (explicitMethod) method = explicitMethod.toUpperCase();
          }
        } else {
          pathArgument = null;
        }
      }

      if (method && pathArgument) {
        const rawPath = staticValue(pathArgument);
        if (rawPath) {
          const contractPath = normalizeContractPath(rawPath);
          if (contractPath.startsWith("/")) {
            discovered.push({
              method,
              path: contractPath,
              location: sourceLocation(sourceFile, node)
            });
          }
        } else {
          dynamicHelpers.push({
            method,
            expression: pathArgument.getText(sourceFile),
            location: sourceLocation(sourceFile, node)
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const uniqueOperations = [...new Map(
  discovered.map((operation) => [`${operation.method} ${operation.path}`, operation])
).values()];
const missing = uniqueOperations.filter(
  (operation) => !documentedOperations.has(`${operation.method} ${operation.path}`)
);

// These loops dispatch only to the primary current routes shown below. The
// secondary values are legacy 404 fallbacks and are intentionally not invented
// as backend/OpenAPI routes.
const expectedDynamicPrimaryOperations = [
  "POST /auth/signout",
  "GET /logistics/shipments",
  "GET /logistics/shipments/{}"
];
for (const operation of expectedDynamicPrimaryOperations) {
  if (!documentedOperations.has(operation)) {
    missing.push({ method: operation.split(" ")[0], path: operation.slice(operation.indexOf(" ") + 1), location: "dynamic helper" });
  }
}

console.log(
  `Frontend contract audit: ${files.length} files; ${uniqueOperations.length} static operations; ` +
  `${dynamicHelpers.length} dynamic helper dispatches; ${missing.length} missing operations.`
);

if (dynamicHelpers.length > 0) {
  console.log("Dynamic helper dispatches reviewed:");
  for (const helper of dynamicHelpers) {
    console.log(`- ${helper.method} ${helper.expression} (${helper.location})`);
  }
}

if (missing.length > 0) {
  console.error("Frontend operations missing from OpenAPI:");
  for (const operation of missing) {
    console.error(`- ${operation.method} ${operation.path} (${operation.location})`);
  }
  process.exitCode = 1;
}
