import { describe, expect, it } from "vitest";
import { co2PerUnitLabel, formatFixed, formatNumber } from "@/lib/format/number";

describe("number formatting", () => {
  it("uses Vietnamese separators consistently", () => {
    expect(formatFixed(4.7653, 2)).toBe("4,77");
    expect(formatNumber(615695, 0)).toBe("615.695");
    expect(formatNumber(10905, 0)).toBe("10.905");
    expect(formatFixed(1944.2, 2)).toBe("1.944,20");
  });

  it("returns a dash for missing values", () => {
    expect(formatNumber(undefined)).toBe("-");
    expect(formatNumber(Number.NaN)).toBe("-");
  });

  it("labels tonne-based units explicitly", () => {
    expect(co2PerUnitLabel(1_000_000)).toBe("kg CO₂e / tấn sản phẩm");
    expect(co2PerUnitLabel(250)).toBeNull();
  });
});
