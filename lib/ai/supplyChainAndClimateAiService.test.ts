import { describe, it, expect } from "vitest";
import {
  screenSupplierEsgAndCarbon,
  generateSupplierScope3Questionnaire,
  simulateHotspotMaccAndStressTest,
  simulateClimatePhysicalHazards,
} from "./supplyChainAndClimateAiService";

describe("supplyChainAndClimateAiService", () => {
  describe("screenSupplierEsgAndCarbon", () => {
    it("identifies high-risk wet processing dyeing supplier", () => {
      const result = screenSupplierEsgAndCarbon({
        id: "sup-1",
        name: "Nhà máy Nhuộm Hóa chất Delta",
        materialSupplied: "Nhuộm hoạt tính vải cotton",
        tier: 2,
        hasCertifiedEvidence: false,
      });

      expect(result.esgRiskLevel).toBe("high");
      expect(result.scope3EstimatedIntensityKgCo2e).toBeGreaterThan(8);
      expect(result.riskFlags.some((f) => f.includes("Wet processing"))).toBe(true);
      expect(result.priorityEngagement).toBe("immediate");
    });

    it("identifies green certified organic cotton supplier", () => {
      const result = screenSupplierEsgAndCarbon({
        id: "sup-2",
        name: "Công ty Cổ phần Eco Cotton Organic",
        materialSupplied: "Sợi Organic Cotton GOTS",
        tier: 1,
        hasCertifiedEvidence: true,
      });

      expect(result.esgRiskLevel).toBe("low");
      expect(result.esgScore).toBeGreaterThanOrEqual(75);
      expect(result.certificationsDetected.length).toBeGreaterThan(0);
      expect(result.emissionTier).toBe("Tier 1 (High Primary Data)");
    });
  });

  describe("generateSupplierScope3Questionnaire", () => {
    it("generates questionnaire tailored to wet processing", () => {
      const q = generateSupplierScope3Questionnaire("Nhuộm và in hoa");
      expect(q.sections.length).toBeGreaterThanOrEqual(3);
      expect(q.estimatedCompletionMinutes).toBe(25);
      const qIds = q.sections.flatMap((s) => s.questions.map((item) => item.id));
      expect(qIds).toContain("q_elec_kwh");
      expect(qIds).toContain("q_boiler_fuel_type");
    });

    it("handles general sector", () => {
      const q = generateSupplierScope3Questionnaire("May mặc tổng hợp");
      expect(q.estimatedCompletionMinutes).toBe(15);
      expect(q.sections[0].questions.length).toBeGreaterThan(0);
    });
  });

  describe("simulateHotspotMaccAndStressTest", () => {
    it("computes Pareto index and MACC levers for industrial emission sources", () => {
      const mockHotspots = [
        { label: "Lò hơi đốt than cơ sở 1", kg: 850000 },
        { label: "Điện lưới xưởng may Sài Gòn", kg: 420000 },
        { label: "Vận tải đường bộ Scope 3", kg: 150000 },
        { label: "Máy nén khí & lò dầu phụ", kg: 80000 },
      ];

      const result = simulateHotspotMaccAndStressTest(mockHotspots, 3000, 85);
      expect(result.totalInventoryCo2eTons).toBe(1500);
      expect(result.topHotspotSharePercent).toBeGreaterThan(50);
      expect(result.paretoIndex8020.cumulativeSharePercent).toBeGreaterThan(50);
      expect(result.interventions.length).toBe(5);
      expect(result.totalPotentialReductionTons).toBeGreaterThan(500);
      expect(result.carbonTaxStressTest.euCbamExposureUsd).toBe(1500 * 85);
    });

    it("handles empty hotspots gracefully with default projection", () => {
      const result = simulateHotspotMaccAndStressTest([], 2500, 85);
      expect(result.totalInventoryCo2eTons).toBe(1250);
      expect(result.interventions.length).toBe(5);
    });
  });

  describe("simulateClimatePhysicalHazards", () => {
    it("simulates Southern Vietnam facility under SSP2-4.5 scenario", () => {
      const facility = {
        id: "fac-sg-1",
        name: "Nhà máy Dệt Sài Gòn",
        latitude: 10.8231,
        longitude: 106.6297,
      };

      const result = simulateClimatePhysicalHazards(facility, "SSP2-4.5");
      expect(result.hazardMetrics.extremeHeatDaysPerYear).toBeGreaterThan(45);
      expect(result.hazardMetrics.coastalInundationRiskDepthMeters).toBeGreaterThan(0.5);
      expect(result.adaptationMeasures.length).toBe(4);
      expect(result.resilienceScore).toBeGreaterThan(0);
    });

    it("evaluates high climate exposure under SSP5-8.5 extreme scenario", () => {
      const facility = {
        id: "fac-dn-1",
        name: "Nhà máy Nhuộm Miền Trung",
        latitude: 16.0544,
        longitude: 108.2022,
      };

      const result = simulateClimatePhysicalHazards(facility, "SSP5-8.5");
      expect(result.scenario).toBe("SSP5-8.5");
      expect(result.hazardMetrics.max1DayRainfallMm).toBeGreaterThan(350);
      expect(result.exposureRating).toBeGreaterThanOrEqual(4);
    });
  });
});
