import { describe, expect, it } from "vitest";
import {
  calculateProxyEmissions,
  getProxyTransportFactor,
  materialPercentageTotal,
  materialSharesAreComplete
} from "@/lib/carbon/proxyCalculator";

describe("proxy carbon calculator", () => {
  it("requires unique material shares to total exactly 100 percent", () => {
    expect(materialPercentageTotal([
      { materialId: "cat-cotton-100", percentage: 60 },
      { materialId: "cat-polyester-recycled", percentage: 40 }
    ])).toBe(100);
    expect(materialSharesAreComplete([
      { materialId: "cat-cotton-100", percentage: 60 },
      { materialId: "cat-polyester-recycled", percentage: 40 }
    ])).toBe(true);
    expect(materialSharesAreComplete([
      { materialId: "cat-cotton-100", percentage: 60 },
      { materialId: "cat-polyester-recycled", percentage: 39.99 }
    ])).toBe(false);
    expect(materialSharesAreComplete([
      { materialId: "cat-cotton-100", percentage: 50 },
      { materialId: "cat-cotton-100", percentage: 50 }
    ])).toBe(false);
  });

  it("weights material factors by composition percentage", () => {
    const result = calculateProxyEmissions({
      category: "textile",
      weightKg: 10,
      materials: [
        { materialId: "cat-cotton-100", percentage: 25 },
        { materialId: "cat-polyester-recycled", percentage: 75 }
      ],
      transportMode: "sea",
      transportDistanceKm: 1000
    });

    expect(result.material).toBeCloseTo(10 * (8 * 0.25 + 2.5 * 0.75), 8);
    expect(result.total).toBeCloseTo(
      result.material + result.manufacturing + result.transport + result.packaging,
      8
    );
  });

  it("uses the selected freight factor and converts kg to tonnes", () => {
    const result = calculateProxyEmissions({
      category: "textile",
      weightKg: 1000,
      materials: [{ materialId: "cat-cotton-100", percentage: 100 }],
      transportMode: "road",
      transportDistanceKm: 100
    });

    expect(result.transport).toBeCloseTo((1000 / 1000) * 100 * (getProxyTransportFactor("road")?.value ?? 0), 8);
  });

  it("rejects incomplete material mixes and invalid distances", () => {
    expect(() => calculateProxyEmissions({
      category: "textile",
      weightKg: 1,
      materials: [{ materialId: "cat-cotton-100", percentage: 90 }],
      transportMode: "sea",
      transportDistanceKm: 100
    })).toThrow("INVALID_MATERIAL_MIX");

    expect(() => calculateProxyEmissions({
      category: "textile",
      weightKg: 1,
      materials: [{ materialId: "cat-cotton-100", percentage: 100 }],
      transportMode: "sea",
      transportDistanceKm: 0
    })).toThrow("INVALID_TRANSPORT_DISTANCE");
  });
});
