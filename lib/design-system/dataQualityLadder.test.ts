import { describe, it, expect } from "vitest";
import {
  DATA_QUALITY_LADDER,
  normalizeDataQualityTier,
  calculateDatasetDqi,
} from "./dataQualityLadder";

describe("dataQualityLadder engine", () => {
  it("defines all 6 tiers from L0 to L5 with complete metadata", () => {
    const tiers = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
    tiers.forEach((t) => {
      const def = DATA_QUALITY_LADDER[t];
      expect(def).toBeDefined();
      expect(def.tier).toBe(t);
      expect(def.trustScore).toBeGreaterThanOrEqual(0);
      expect(def.trustScore).toBeLessThanOrEqual(100);
      expect(def.nextActionVi).toBeTruthy();
    });

    expect(DATA_QUALITY_LADDER.L0.trustScore).toBe(0);
    expect(DATA_QUALITY_LADDER.L5.trustScore).toBe(100);
    expect(DATA_QUALITY_LADDER.L5.isAudited).toBe(true);
    expect(DATA_QUALITY_LADDER.L2.isAudited).toBe(false);
  });

  it("normalizes diverse string representations into valid tiers", () => {
    expect(normalizeDataQualityTier("L1")).toBe("L1");
    expect(normalizeDataQualityTier("l3")).toBe("L3");
    expect(normalizeDataQualityTier("proxy")).toBe("L1");
    expect(normalizeDataQualityTier("third_party_verified")).toBe("L5");
    expect(normalizeDataQualityTier("missing")).toBe("L0");
    expect(normalizeDataQualityTier(null)).toBe("L2");
  });

  it("computes weighted Data Quality Index (DQI)", () => {
    const dataset = [
      { dataQualityLevel: "L5", quantity: 100 },
      { dataQualityLevel: "L3", quantity: 100 },
      { dataQualityLevel: "L1", quantity: 100 },
    ];

    const result = calculateDatasetDqi(dataset);
    expect(result.totalCount).toBe(3);
    expect(result.verifiedCount).toBe(1);
    expect(result.tierDistribution.L5).toBe(1);
    expect(result.tierDistribution.L3).toBe(1);
    expect(result.tierDistribution.L1).toBe(1);
    // (100*100 + 78*100 + 35*100) / 300 = 21300 / 300 = 71
    expect(result.overallDqi).toBe(71);
  });
});
