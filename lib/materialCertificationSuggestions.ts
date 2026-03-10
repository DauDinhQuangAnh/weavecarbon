import {
  MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE,
  normalizeMaterialCertificationValue
} from "@/lib/materialCertificationDefinitions";

const VALID_CERTIFICATION_VALUE_SET = new Set(
  Object.keys(MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE)
);

const normalizeMaterialToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const hasAny = (token: string, hints: string[]) =>
  hints.some((hint) => token.includes(hint));

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const toValidCertificationValue = (value: string) => {
  const normalized = normalizeMaterialCertificationValue(value);
  if (!normalized) return "";
  return VALID_CERTIFICATION_VALUE_SET.has(normalized) ? normalized : "";
};

const pushSuggestion = (collector: string[], value: string) => {
  const normalized = toValidCertificationValue(value);
  if (!normalized) return;
  if (!collector.includes(normalized)) {
    collector.push(normalized);
  }
};

const suggestFromToken = (rawToken: string): string[] => {
  const token = normalizeMaterialToken(rawToken);
  if (!token) return [];

  const suggestions: string[] = [];

  const isOrganic = hasAny(token, ["organic", "huuco"]);
  const isRecycled = hasAny(token, ["recycled", "taiche", "rpet", "recycle"]);
  const isCotton = hasAny(token, ["cotton", "bong"]);
  const isPolymer = hasAny(token, ["polyester", "nylon", "plastic", "acrylic", "pu"]);
  const isCellulosic = hasAny(token, [
    "viscose",
    "lyocell",
    "tencel",
    "modal",
    "bamboo",
    "rayon"
  ]);
  const isForest = isCellulosic || hasAny(token, ["paper", "wood", "forest"]);
  const isWool = hasAny(token, ["wool", "merino"]);
  const isDown = hasAny(token, ["down", "feather"]);
  const isMohair = hasAny(token, ["mohair"]);
  const isAlpaca = hasAny(token, ["alpaca"]);
  const isLeather = hasAny(token, ["leather", "da"]);
  const isBiobased = hasAny(token, ["biobased", "bio", "hemp", "bamboo"]);
  const isCircular = hasAny(token, ["c2c", "cradletocradle", "circular"]);
  const isTextileCore = hasAny(token, [
    "cotton",
    "polyester",
    "nylon",
    "wool",
    "silk",
    "linen",
    "viscose",
    "bamboo",
    "hemp",
    "canvas",
    "blend"
  ]);

  if (isOrganic) {
    pushSuggestion(suggestions, "gots");
    pushSuggestion(suggestions, "ocs");
    pushSuggestion(suggestions, "ccs");
  }

  if (isRecycled) {
    pushSuggestion(suggestions, "grs");
    pushSuggestion(suggestions, "rcs");
    if (isPolymer) {
      pushSuggestion(suggestions, "iscc_plus");
    }
  }

  if (isCotton) {
    pushSuggestion(suggestions, "bci");
  }

  if (isForest) {
    pushSuggestion(suggestions, "fsc");
    if (hasAny(token, ["paper", "wood"])) {
      pushSuggestion(suggestions, "pefc");
    }
  }

  if (isWool) {
    pushSuggestion(suggestions, "rws");
  }
  if (isDown) {
    pushSuggestion(suggestions, "rds");
  }
  if (isMohair) {
    pushSuggestion(suggestions, "rms");
  }
  if (isAlpaca) {
    pushSuggestion(suggestions, "ras");
  }
  if (isLeather) {
    pushSuggestion(suggestions, "lwg");
  }

  if (isTextileCore || isOrganic || isRecycled || isPolymer || isCellulosic) {
    pushSuggestion(suggestions, "oeko_tex");
  }
  if (isPolymer || isCellulosic) {
    pushSuggestion(suggestions, "bluesign");
    pushSuggestion(suggestions, "zdhc_mrsl_conformance");
  }

  if (isBiobased) {
    pushSuggestion(suggestions, "ok_biobased");
    pushSuggestion(suggestions, "en_16785_1_biobased");
  }

  if (isCircular) {
    pushSuggestion(suggestions, "c2c");
  }

  return suggestions;
};

export const suggestMaterialCertificationCodesForMaterial = (
  value: string | null | undefined
) => suggestFromToken(String(value || ""));

export const suggestMaterialCertificationCodes = (
  inputs: Array<string | null | undefined>
) => unique(inputs.flatMap((input) => suggestFromToken(String(input || ""))));
