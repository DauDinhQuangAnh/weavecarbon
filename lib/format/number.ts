/**
 * Number formatting for UI copy. The dashboard formats numbers with the
 * Vietnamese convention everywhere (dot thousands, comma decimals), so values
 * such as "4.77" next to "0,01612" can no longer appear side by side.
 */
export const DISPLAY_NUMBER_LOCALE = "vi-VN";

export const formatNumber = (
  value: number | null | undefined,
  maximumFractionDigits = 2,
  minimumFractionDigits = 0
): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString(DISPLAY_NUMBER_LOCALE, {
    minimumFractionDigits: Math.min(minimumFractionDigits, maximumFractionDigits),
    maximumFractionDigits
  });
};

/** Fixed decimals, e.g. formatFixed(4.765, 2) -> "4,77". */
export const formatFixed = (value: number | null | undefined, digits = 2): string =>
  formatNumber(value, digits, digits);

/**
 * Label for "CO2e per unit" values. Industrial demo products use 1 tonne as the
 * declared unit (weightPerUnit = 1,000,000 g); say so instead of "đơn vị".
 */
export const co2PerUnitLabel = (weightPerUnitGrams: number | null | undefined): string | null => {
  if (typeof weightPerUnitGrams !== "number" || !Number.isFinite(weightPerUnitGrams)) return null;
  if (weightPerUnitGrams === 1_000_000) return "kg CO₂e / tấn sản phẩm";
  return null;
};
