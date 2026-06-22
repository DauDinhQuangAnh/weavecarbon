/**
 * Weave Carbon — Regulatory penalty constants
 * Sources:
 * - CBAM_PRICE_PER_TON: EU ETS 2024 average (~85 EUR/tCO2e)
 * - DEFAULT_VALUE_MULTIPLIER: Ecoinvent worst-case proxy uplift
 */

export const CBAM_PRICE_PER_TON = 85; // EUR per tCO2e
export const DEFAULT_VALUE_MULTIPLIER = 1.45; // +45% uplift
export const ECOINVENT_VERSION = "v3.10";
export const DEFRA_VERSION = "2024";
export const ISO_STANDARD = "ISO 14067:2018";
export const AUDIT_TOKEN_TTL_DAYS = 7;

export const METHODOLOGY_DISCLAIMER_EN =
  `Methodology: 100% ${ISO_STANDARD}. Emission factors synchronised from Ecoinvent ${ECOINVENT_VERSION}, DEFRA ${DEFRA_VERSION}, and Vietnam MoNRE Grid Emission Factor.`;

export const METHODOLOGY_DISCLAIMER_VI =
  `Phương pháp toán: 100% ${ISO_STANDARD}. Hệ số phát thải đồng bộ từ Ecoinvent ${ECOINVENT_VERSION}, DEFRA ${DEFRA_VERSION} và Niên giám Hệ số phát thải của Bộ TN&MT Việt Nam.`;

export function computeCbamPenalty(defaultCo2Tons: number, bestCaseCo2Tons: number): number {
  const excess = Math.max(0, defaultCo2Tons - bestCaseCo2Tons);
  return Math.round(excess * CBAM_PRICE_PER_TON * 100) / 100;
}
