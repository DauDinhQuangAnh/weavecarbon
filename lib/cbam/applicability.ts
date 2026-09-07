export const CBAM_RULESET = Object.freeze({
  version: "EU-CBAM-ANNEX-I-2026.01",
  effectiveFrom: "2026-01-01",
  // Conservative heading-level screening. A match still needs a customs reviewer
  // to confirm the full CN code and any Annex I exclusions.
  prefixes: Object.freeze([
    "2507", "2523", "27160000", "28041000", "2808", "2814", "28342100", "3102", "3105",
    "72", "7301", "7302", "7303", "7304", "7305", "7306", "7307", "7308", "7309", "7310",
    "7311", "7318", "7326", "7601", "7603", "7604", "7605", "7606", "7607", "7608",
    "7609", "7610", "7611", "7612", "7613", "7614", "7616",
  ]),
});

export type CbamApplicabilityStatus =
  | "CBAM_NOT_APPLICABLE"
  | "CBAM_CODE_MISSING"
  | "REVIEW_ANNEX_I_MATCH";

export const normalizeHsCode = (value: unknown): string =>
  String(value ?? "").replace(/[^0-9]/g, "");

export const evaluateCbamApplicability = (value: unknown): CbamApplicabilityStatus => {
  const code = normalizeHsCode(value);
  if (!code) return "CBAM_CODE_MISSING";
  return CBAM_RULESET.prefixes.some((prefix) => code.startsWith(prefix))
    ? "REVIEW_ANNEX_I_MATCH"
    : "CBAM_NOT_APPLICABLE";
};
