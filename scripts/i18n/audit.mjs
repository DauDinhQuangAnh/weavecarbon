import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const LOCALE_FILES = {
  en: path.join(ROOT, "locales/en/common.json"),
  vi: path.join(ROOT, "locales/vi/common.json")
};

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mjs"]);
const EXCLUDED_SEGMENTS = new Set(["node_modules", ".next"]);
const EXCLUDED_FILES = new Set(["package-lock.json"]);
const IDENTICAL_ALLOWLIST = new Set([
  "AI",
  "API",
  "CSV",
  "Demo B2B",
  "Demo B2C",
  "Email",
  "Export",
  "Google",
  "MRV",
  "PDF",
  "QR",
  "SKU",
  "Standard",
  "Trial",
  "WeaveCarbon",
  "Weavey",
  "XLSX"
]);
const IDENTICAL_ALLOWED_PATTERNS = [
  /^Scope [123]$/,
  /^[A-Z0-9/ .()+_-]+$/,
  /^(?:CBAM|GHG|CO2|CO₂|CO2e|CO₂e)$/,
  /^(?:GOTS|RCS|GRS|OEKO-TEX|OEKO TEX).*$/
];
const mojibake = (...codes) => String.fromCodePoint(...codes);
const CRITICAL_MOJIBAKE_PATTERNS = [
  {
    label: 'mojibake token "\\u00C3\\u00AF\\u00C2\\u00BF\\u00C2\\u00BD"',
    regex: new RegExp(mojibake(0x00C3, 0x00AF, 0x00C2, 0x00BF, 0x00C2, 0x00BD), "u")
  },
  {
    label: 'mojibake sequence "\\u00C3\\u0192..."',
    regex: new RegExp(`${mojibake(0x00C3, 0x0192)}[\\u00A0-\\u024F]`, "u")
  },
  {
    label: 'mojibake sequence "\\u00C3\\u0082 "',
    regex: new RegExp(`${mojibake(0x00C3, 0x0082)}[\\s.,;:!?)\\/\\\\-]`, "u")
  },
  {
    label: 'mojibake sequence "\\u00C3\\u00A2..."',
    regex: new RegExp(
      `${mojibake(0x00C3, 0x00A2)}(?:` +
        [
          mojibake(0x00E2, 0x201A, 0x00AC, 0x00E2, 0x201E, 0x00A2),
          mojibake(0x00E2, 0x201A, 0x00AC, 0x00C5, 0x201C),
          mojibake(0x00E2, 0x201A, 0x00AC, 0x00C2, 0x00A2),
          mojibake(0x00E2, 0x201A, 0x00AC, 0x00C2, 0x00A6),
          mojibake(0x00E2, 0x201A, 0x00AC, 0x00E2, 0x20AC, 0x009D),
          mojibake(0x00E2, 0x20AC, 0x00A0, 0x00E2, 0x20AC, 0x2122)
        ].join("|") +
        ")",
      "u"
    )
  }
]

const criticals = [];
const warnings = [];

const addIssue = (collection, message) => collection.push(message);

const toPosixPath = (value) => value.split(path.sep).join("/");

const getTrackedFiles = () => {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  return output
    .split("\0")
    .filter(Boolean)
    .map((filePath) => toPosixPath(filePath))
    .filter((filePath) => {
      if (EXCLUDED_FILES.has(path.posix.basename(filePath))) {
        return false;
      }

      const segments = filePath.split("/");
      if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
        return false;
      }

      return TEXT_EXTENSIONS.has(path.posix.extname(filePath));
    });
};

const flattenObject = (value, prefix = "", result = {}) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenObject(nestedValue, nextPrefix, result);
    }
    return result;
  }

  result[prefix] = value;
  return result;
};

const extractPlaceholders = (value) => {
  if (typeof value !== "string") {
    return [];
  }

  return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();
};

const isAllowedIdenticalString = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return true;
  }

  if (!normalized.includes(" ")) {
    return true;
  }

  if (IDENTICAL_ALLOWLIST.has(normalized)) {
    return true;
  }

  return IDENTICAL_ALLOWED_PATTERNS.some((pattern) => pattern.test(normalized));
};

const readUtf8 = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const auditTrackedFiles = (files) => {
  for (const relativePath of files) {
    const content = readUtf8(relativePath);

    if (content.includes("\uFFFD")) {
      addIssue(criticals, `${relativePath}: contains replacement character U+FFFD`);
    }

    for (const pattern of CRITICAL_MOJIBAKE_PATTERNS) {
      if (pattern.regex.test(content)) {
        addIssue(criticals, `${relativePath}: contains ${pattern.label}`);
        break;
      }
    }
  }
};

const auditLocales = () => {
  const en = JSON.parse(fs.readFileSync(LOCALE_FILES.en, "utf8"));
  const vi = JSON.parse(fs.readFileSync(LOCALE_FILES.vi, "utf8"));
  const flattenedEn = flattenObject(en);
  const flattenedVi = flattenObject(vi);
  const enKeys = new Set(Object.keys(flattenedEn));
  const viKeys = new Set(Object.keys(flattenedVi));

  for (const key of [...enKeys].filter((entry) => !viKeys.has(entry)).sort()) {
    addIssue(criticals, `locales: missing in vi -> ${key}`);
  }

  for (const key of [...viKeys].filter((entry) => !enKeys.has(entry)).sort()) {
    addIssue(criticals, `locales: missing in en -> ${key}`);
  }

  for (const key of [...enKeys].filter((entry) => viKeys.has(entry)).sort()) {
    const enValue = flattenedEn[key];
    const viValue = flattenedVi[key];

    if (typeof enValue === "string" && typeof viValue === "string") {
      const enPlaceholders = extractPlaceholders(enValue);
      const viPlaceholders = extractPlaceholders(viValue);
      if (enPlaceholders.join(",") !== viPlaceholders.join(",")) {
        addIssue(
          criticals,
          `locales: placeholder mismatch -> ${key} (${enPlaceholders.join("|")} vs ${viPlaceholders.join("|")})`
        );
      }

      if (enValue === viValue && !isAllowedIdenticalString(enValue)) {
        addIssue(warnings, `locales: identical EN/VI copy -> ${key} = "${enValue}"`);
      }

      if (enValue.includes(" ? ") || viValue.includes(" ? ")) {
        addIssue(warnings, `locales: separator looks incorrect -> ${key}`);
      }
    }
  }
};

const auditTargetComponents = () => {
  const componentChecks = [
    {
      path: "components/onboarding/PlanInfo.tsx",
      patterns: [/locale === "vi"/, /\bisVi\s*\?/]
    },
    {
      path: "components/dashboard/export/ComplianceRecommendations.tsx",
      patterns: [/locale === "vi"/, /toast\.(?:error|info|success|warning)\(\s*["'`]/]
    },
    {
      path: "components/dashboard/reports/ReportClient.tsx",
      patterns: [/locale === "vi"\s*\?/, /toast\.(?:error|info|success|warning)\(\s*["'`]/]
    },
    {
      path: "components/dashboard/assessment/AssessmentClient.tsx",
      patterns: [/toast\.(?:error|info|success|warning)\(\s*["'`]/, /Unknown location/]
    }
  ];

  for (const check of componentChecks) {
    const content = readUtf8(check.path);
    for (const pattern of check.patterns) {
      if (pattern.test(content)) {
        addIssue(warnings, `${check.path}: possible hardcoded user-facing copy (${pattern})`);
      }
    }
  }
};

const printIssues = (label, issues) => {
  if (issues.length === 0) {
    console.log(`${label}: 0`);
    return;
  }

  console.log(`${label}: ${issues.length}`);
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
};

const trackedFiles = getTrackedFiles();
auditTrackedFiles(trackedFiles);
auditLocales();
auditTargetComponents();

console.log(`Scanned ${trackedFiles.length} tracked text files.`);
printIssues("Critical", criticals);
printIssues("Warnings", warnings);

process.exit(criticals.length > 0 ? 1 : 0);
