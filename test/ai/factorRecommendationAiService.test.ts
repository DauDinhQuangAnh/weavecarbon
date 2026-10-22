import { describe, it, expect } from "vitest";
import {
  recommendEmissionFactor,
  checkUnitCompatibility,
  searchExtendedRagKnowledge,
  queryRagSemanticFactor,
  STANDARD_FACTORS,
} from "@/lib/ai/factorRecommendationAiService";

describe("factorRecommendationAiService", () => {
  describe("checkUnitCompatibility", () => {
    it("handles identical units with multiplier 1", () => {
      const res = checkUnitCompatibility("kgCO2e/kWh", "kWh");
      expect(res.isCompatible).toBe(true);
      expect(res.conversionMultiplier).toBe(1);
    });

    it("converts MWh to kWh with multiplier 1000", () => {
      const res = checkUnitCompatibility("kgCO2e/kWh", "MWh");
      expect(res.isCompatible).toBe(true);
      expect(res.conversionMultiplier).toBe(1000);
      expect(res.message).toContain("1 MWh = 1000 kWh");
    });

    it("converts ton/tonne to kg with multiplier 1000", () => {
      const resTon = checkUnitCompatibility("kgCO2e/kg", "ton");
      expect(resTon.isCompatible).toBe(true);
      expect(resTon.conversionMultiplier).toBe(1000);

      const resTonne = checkUnitCompatibility("kgCO2e/kg", "tonne");
      expect(resTonne.isCompatible).toBe(true);
      expect(resTonne.conversionMultiplier).toBe(1000);
    });

    it("flags incompatible units with clear warning message", () => {
      const res = checkUnitCompatibility("kgCO2e/kWh", "L");
      expect(res.isCompatible).toBe(false);
      expect(res.message).toContain("không tương thích");
    });
  });

  describe("recommendEmissionFactor", () => {
    it("recommends Vietnam Grid Factor 0.6592 kgCO2e/kWh for electricity in VN", () => {
      const result = recommendEmissionFactor({
        activityType: "electricity",
        quantity: 10000,
        canonicalUnit: "kWh",
        geography: "VN",
      });

      expect(result.primaryFactor.factorId).toBe("energy-grid-vn-2023");
      expect(result.primaryFactor.factorValue).toBe(0.6592);
      expect(result.primaryFactor.scope).toBe("Scope 2 (Location-based)");
      expect(result.primaryFactor.sourceName).toContain("Bộ TN&MT");
      expect(result.instantEstimate).toBeDefined();
      expect(result.instantEstimate?.emissionsKgCo2e).toBe(6592);
      expect(result.instantEstimate?.emissionsTco2e).toBe(6.592);
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it("recommends Solar PV factor when reference contains solar keywords", () => {
      const result = recommendEmissionFactor({
        activityType: "electricity",
        reference: "INV-SOLAR-ROOFTOP-01",
        quantity: 5000,
        canonicalUnit: "kWh",
      });

      expect(result.primaryFactor.factorId).toBe("energy-solar-generic");
      expect(result.primaryFactor.factorValue).toBe(0.045);
      expect(result.primaryFactor.scope).toBe("Scope 2 (Market-based)");
      expect(result.instantEstimate?.emissionsTco2e).toBe(0.225);
    });

    it("recommends Diesel Stationary 2.6865 kgCO2e/L for boiler diesel fuel", () => {
      const result = recommendEmissionFactor({
        activityType: "fuel_diesel",
        reference: "BOILER-DO-01",
        quantity: 1000,
        canonicalUnit: "L",
      });

      expect(result.primaryFactor.factorId).toBe("fuel-diesel-stationary-vn-2024");
      expect(result.primaryFactor.factorValue).toBe(2.6865);
      expect(result.primaryFactor.scope).toBe("Scope 1");
      expect(result.instantEstimate?.emissionsTco2e).toBe(2.6865);
    });

    it("recommends Mobile Diesel for forklift and mobile machinery", () => {
      const result = recommendEmissionFactor({
        activityType: "fuel_diesel",
        reference: "Xe nâng forklift kho vải",
        quantity: 500,
        canonicalUnit: "L",
      });

      expect(result.primaryFactor.factorId).toBe("fuel-diesel-mobile");
      expect(result.primaryFactor.factorValue).toBe(2.7055);
    });

    it("handles Biomass fuel with separate fossil GHG and biogenic carbon accounting", () => {
      const result = recommendEmissionFactor({
        activityType: "fuel_biomass",
        reference: "Lò hơi mùn cưa và trấu ép",
        quantity: 10000,
        canonicalUnit: "kg",
      });

      expect(result.primaryFactor.factorId).toBe("fuel-biomass-industrial-vn");
      expect(result.primaryFactor.factorValue).toBe(0.015);
      expect(result.primaryFactor.biogenicCarbonKgPerUnit).toBe(1.74);
      expect(result.instantEstimate?.emissionsTco2e).toBe(0.15);
      expect(result.instantEstimate?.biogenicTco2).toBe(17.4);
    });

    it("recommends Anthracite Coal 2.427 kgCO2e/kg for Vietnamese coal boilers", () => {
      const result = recommendEmissionFactor({
        activityType: "fuel_coal",
        quantity: 20000,
        canonicalUnit: "kg",
      });

      expect(result.primaryFactor.factorId).toBe("fuel-coal-anthracite-vn");
      expect(result.primaryFactor.factorValue).toBe(2.427);
      expect(result.instantEstimate?.emissionsTco2e).toBe(48.54);
    });

    it("recommends Purchased Steam 0.205 kgCO2e/kg for industrial steam", () => {
      const result = recommendEmissionFactor({
        activityType: "steam",
        quantity: 50000,
        canonicalUnit: "kg",
      });

      expect(result.primaryFactor.factorId).toBe("steam-industrial-purchased-vn");
      expect(result.primaryFactor.factorValue).toBe(0.205);
      expect(result.instantEstimate?.emissionsTco2e).toBe(10.25);
    });

    it("recommends DEFRA 2025 freight factors for logistics", () => {
      // Road
      const roadRes = recommendEmissionFactor({
        activityType: "freight",
        quantity: 1000,
        canonicalUnit: "tonne.km",
      });
      expect(roadRes.primaryFactor.factorId).toBe("transport-road-defra-2025");
      expect(roadRes.primaryFactor.factorValue).toBe(0.12226);

      // Sea
      const seaRes = recommendEmissionFactor({
        activityType: "freight",
        reference: "Vận chuyển đường biển cảng Cát Lái",
        quantity: 10000,
        canonicalUnit: "tonne.km",
      });
      expect(seaRes.primaryFactor.factorId).toBe("transport-sea-defra-2025");
      expect(seaRes.primaryFactor.factorValue).toBe(0.01612);

      // Air
      const airRes = recommendEmissionFactor({
        activityType: "freight",
        reference: "Giao mẫu gấp qua hàng không TSN",
        quantity: 200,
        canonicalUnit: "tonne.km",
      });
      expect(airRes.primaryFactor.factorId).toBe("transport-air-defra-2025");
      expect(airRes.primaryFactor.factorValue).toBe(0.89939);
    });

    it("automatically scales calculation when unit is MWh instead of kWh", () => {
      const result = recommendEmissionFactor({
        activityType: "electricity",
        quantity: 50, // 50 MWh = 50,000 kWh
        canonicalUnit: "MWh",
      });

      expect(result.instantEstimate).toBeDefined();
      expect(result.instantEstimate?.emissionsKgCo2e).toBe(32960);
      expect(result.instantEstimate?.emissionsTco2e).toBe(32.96);
      expect(result.instantEstimate?.formulaExplanation).toContain("50 MWh (= 50,000 kWh)");
    });
  });

  describe("RAG Extended Knowledge & Semantic Lookup", () => {
    it("searches extended RAG knowledge for textile dye chemicals", () => {
      const match = searchExtendedRagKnowledge("thuốc nhuộm hoạt tính màu xanh");
      expect(match).not.toBeNull();
      expect(match?.factor.factorId).toBe("rag-dye-reactive");
      expect(match?.factor.factorValue).toBe(4.8);
      expect(match?.citation).toContain("BREF Textiles");
    });

    it("searches extended RAG knowledge for eco fibers like linen and hemp", () => {
      const matchLinen = searchExtendedRagKnowledge("sợi lanh tự nhiên dệt may");
      expect(matchLinen?.factor.factorId).toBe("rag-fiber-linen");
      expect(matchLinen?.factor.factorValue).toBe(1.85);

      const matchHemp = searchExtendedRagKnowledge("vải sợi gai dầu hemp");
      expect(matchHemp?.factor.factorId).toBe("rag-fiber-hemp");
      expect(matchHemp?.factor.factorValue).toBe(2.1);
    });

    it("searches extended RAG knowledge for packaging materials", () => {
      const matchBox = searchExtendedRagKnowledge("thùng carton sóng đóng gói");
      expect(matchBox?.factor.factorId).toBe("rag-packaging-box-recycled");
      expect(matchBox?.factor.factorValue).toBe(0.75);
    });

    it("queries queryRagSemanticFactor seamlessly with citations and DQL", async () => {
      const result = await queryRagSemanticFactor("chất làm mềm silicone", {
        activityType: "material",
        canonicalUnit: "kg",
        demo: true,
      });

      expect(result.factor.label).toContain("Silicone");
      expect(result.factor.factorValue).toBe(2.4);
      expect(result.citation).toBeDefined();
      expect(result.factor.recommendedDql).toBe("L3");
    });
  });
});
