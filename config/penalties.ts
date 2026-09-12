/**
 * Weave Carbon — internal scenario constants
 * Sources:
 * - ILLUSTRATIVE_CARBON_PRICE_PER_TON: fixed scenario input, not a tariff or liability
 * - DEFAULT_VALUE_MULTIPLIER: internal proxy sensitivity assumption
 */

export const ILLUSTRATIVE_CARBON_PRICE_PER_TON = 85;
/** @deprecated Compatibility alias. Never present this value as an actual CBAM price or charge. */
export const CBAM_PRICE_PER_TON = ILLUSTRATIVE_CARBON_PRICE_PER_TON;
export const DEFAULT_VALUE_MULTIPLIER = 1.45;
export const ECOINVENT_VERSION = "v3.10";
export const DEFRA_VERSION = "2024";
export const ISO_STANDARD = "ISO 14067:2018";
export const AUDIT_TOKEN_TTL_DAYS = 7;

export const METHODOLOGY_DISCLAIMER_EN =
  `Internal climate-only calculation referencing selected ${ISO_STANDARD} and GHG Protocol principles. Factor references include Ecoinvent ${ECOINVENT_VERSION}, DEFRA ${DEFRA_VERSION}, and Vietnam MoNRE; verify source rights, scope and versions before use. This is not ISO conformity or independent assurance.`;

export const METHODOLOGY_DISCLAIMER_VI =
  `Phép tính climate-only nội bộ có tham chiếu một số nguyên tắc của ${ISO_STANDARD} và GHG Protocol. Nguồn tham chiếu hệ số gồm Ecoinvent ${ECOINVENT_VERSION}, DEFRA ${DEFRA_VERSION} và Bộ TN&MT Việt Nam; phải kiểm tra quyền sử dụng, phạm vi và phiên bản trước khi dùng. Đây không phải kết luận phù hợp ISO hay đảm bảo độc lập.`;

export function computeCbamPenalty(defaultCo2Tons: number, bestCaseCo2Tons: number): number {
  const excess = Math.max(0, defaultCo2Tons - bestCaseCo2Tons);
  return Math.round(excess * ILLUSTRATIVE_CARBON_PRICE_PER_TON * 100) / 100;
}
