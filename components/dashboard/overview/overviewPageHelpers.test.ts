import { describe, expect, it } from "vitest";
import {
  clampReadiness,
  getCategoryColor,
  getImpactColor,
  normalizeEmissionKey,
  normalizeReadinessScore
} from "./overviewPageHelpers";

describe("normalizeEmissionKey", () => {
  it("strips Vietnamese diacritics and lowercases", () => {
    expect(normalizeEmissionKey("Nguyên liệu")).toBe("nguyen lieu");
    expect(normalizeEmissionKey("Vận chuyển")).toBe("van chuyen");
    expect(normalizeEmissionKey("Sản xuất")).toBe("san xuat");
  });

  it("collapses punctuation and trims", () => {
    expect(normalizeEmissionKey("  Materials & Packaging! ")).toBe("materials packaging");
  });
});

describe("getCategoryColor", () => {
  it("maps known Vietnamese and English category labels to a palette color", () => {
    expect(getCategoryColor("Nguyên liệu")).toBe("hsl(171 78% 33%)");
    expect(getCategoryColor("Materials")).toBe("hsl(171 78% 33%)");
    expect(getCategoryColor("Vận chuyển")).toBe("hsl(8 82% 56%)");
    expect(getCategoryColor("Transportation")).toBe("hsl(8 82% 56%)");
  });

  it("returns null for unrecognized labels", () => {
    expect(getCategoryColor("Unknown Category")).toBeNull();
  });
});

describe("clampReadiness / normalizeReadinessScore", () => {
  it("clamps to the 0-100 range", () => {
    expect(clampReadiness(150)).toBe(100);
    expect(clampReadiness(-10)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(normalizeReadinessScore(42.6789)).toBe(42.68);
  });
});

describe("getImpactColor", () => {
  it("returns the correct tone per impact level", () => {
    expect(getImpactColor("high")).toContain("emerald");
    expect(getImpactColor("medium")).toContain("amber");
    expect(getImpactColor("low")).toContain("sky");
  });
});
