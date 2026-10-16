/**
 * Products Carbon Authority Service
 * Handles calculation snapshot verification, canonical input hashing, and authority reference metadata.
 */
import type { CarbonAuthorityReference } from "./types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const asNonEmptyString = (value: unknown) => {
  const normalized = asString(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const normalizeCarbonAuthority = (value: unknown): CarbonAuthorityReference | undefined => {
  if (!isObject(value) || value.authoritative !== true) return undefined;
  const calculationId = asString(value.calculationId ?? value.calculation_id).trim();
  const source = asString(value.source).trim();
  if (!calculationId || source !== "product_assessment_snapshot") return undefined;
  return {
    authoritative: true,
    source: "product_assessment_snapshot",
    calculationId,
    calculationVersion: Math.max(
      1,
      Math.trunc(asNumber(value.calculationVersion ?? value.calculation_version, 1))
    ),
    calculatedAt: asNonEmptyString(value.calculatedAt ?? value.calculated_at),
    engineVersion: asNonEmptyString(value.engineVersion ?? value.engine_version)
      || "legacy-unversioned",
    methodologyVersion: asNonEmptyString(
      value.methodologyVersion ?? value.methodology_version
    ) || "legacy-unversioned",
    factorRegistryVersion: asNonEmptyString(
      value.factorRegistryVersion ?? value.factor_registry_version
    ) || "legacy-unversioned",
    gwpBasis: asNonEmptyString(value.gwpBasis ?? value.gwp_basis)
      || "legacy-unversioned",
    canonicalInputHash: asNonEmptyString(
      value.canonicalInputHash ?? value.canonical_input_hash
    ) || `legacy:${calculationId}`,
    legacy: typeof value.legacy === "boolean" ? value.legacy : true
  };
};
