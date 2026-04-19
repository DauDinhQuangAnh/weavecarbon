import { describe, expect, it } from "vitest";
import type { ProductAssessmentData } from "@/components/dashboard/assessment/steps/types";
import type { BulkProductRow } from "@/components/dashboard/products/types";
import {
  buildCarbonEngineInputFromAssessment,
  buildCarbonEngineInputFromBulkRow,
  buildCarbonEngineInputFromProductOverview,
  calculateAssessmentCarbon,
  calculateBulkRowCarbon,
  calculateProductOverviewCarbon,
  type ProductOverviewAdapterInput
} from "@/lib/carbon/adapters";
import { calculateCarbonFootprint } from "@/lib/carbon/engine";
import type { CarbonEngineInput } from "@/lib/carbon/types";

const buildBaseInput = (overrides: Partial<CarbonEngineInput> = {}): CarbonEngineInput => ({
  unitMassKg: 0.2,
  quantity: 100,
  materials: [
    {
      id: "material-1",
      type: "cotton",
      factorId: "cat-cotton-100",
      percentage: 100,
      source: "domestic",
      name: "Cotton"
    }
  ],
  accessories: [],
  packaging: null,
  processFactorIds: ["process-cutting-sewing"],
  energyMix: [
    {
      factorId: "energy-grid-vn-2023",
      percentage: 100,
      geography: "Vietnam"
    }
  ],
  manufacturingGeography: "Vietnam",
  originGeography: "Vietnam",
  destinationMarket: "vietnam",
  transport: [
    {
      mode: "road",
      factorId: "transport-road-defra-2025",
      distanceKm: 500,
      defaultDistanceKey: "vietnam"
    }
  ],
  ...overrides
});

describe("carbon engine", () => {
  it("returns consistent totals across bulk, assessment, and overview adapters", () => {
    const bulkRow: BulkProductRow = {
      sku: "TEE-001",
      productName: "Cotton Tee",
      productType: "tshirt",
      quantity: 1,
      weightPerUnit: 200,
      primaryMaterial: "cotton",
      primaryMaterialPercentage: 100,
      materialSource: "domestic",
      processes: ["cutting_sewing"],
      energySource: "grid",
      marketType: "domestic",
      transportMode: "road",
      transportDistanceKm: 500,
      manufacturingLocation: "Vietnam"
    };

    const assessmentData: ProductAssessmentData = {
      productCode: "TEE-001",
      productName: "Cotton Tee",
      productType: "tshirt",
      weightPerUnit: 200,
      quantity: 1,
      materials: [
        {
          id: "material-1",
          materialType: "cat-cotton-100",
          percentage: 100,
          source: "domestic",
          certifications: []
        }
      ],
      accessories: [],
      productionProcesses: ["cutting_sewing"],
      energySources: [
        {
          id: "energy-1",
          source: "grid",
          percentage: 100
        }
      ],
      manufacturingLocation: "Vietnam",
      wasteRecovery: "",
      destinationMarket: "vietnam",
      originAddress: {
        streetNumber: "",
        street: "",
        ward: "",
        district: "",
        city: "Ho Chi Minh City",
        stateRegion: "",
        country: "Vietnam",
        postalCode: ""
      },
      destinationAddress: {
        streetNumber: "",
        street: "",
        ward: "",
        district: "",
        city: "Ha Noi",
        stateRegion: "",
        country: "Vietnam",
        postalCode: ""
      },
      transportLegs: [
        {
          id: "leg-1",
          mode: "road",
          estimatedDistance: 500
        }
      ],
      estimatedTotalDistance: 500,
      status: "draft",
      version: 1
    };

    const overviewData: ProductOverviewAdapterInput = {
      productName: "Cotton Tee",
      productCode: "TEE-001",
      category: "tshirt",
      description: "",
      weight: "200",
      unit: "g",
      primaryMaterial: "cotton",
      materialPercentage: "100",
      secondaryMaterial: "",
      secondaryPercentage: "0",
      recycledContent: "0",
      certifications: [],
      manufacturingLocation: "Vietnam",
      energySource: "grid",
      processType: "cutting_sewing",
      wasteRecovery: "",
      originCountry: "Vietnam",
      destinationMarket: "vietnam",
      transportMode: "road",
      packagingType: "",
      packagingWeight: "0"
    };

    const bulkResult = calculateBulkRowCarbon(bulkRow);
    const assessmentResult = calculateAssessmentCarbon(assessmentData, "vietnam");
    const overviewResult = calculateProductOverviewCarbon(overviewData);

    expect(bulkResult.perProduct.total).toBeCloseTo(assessmentResult.perProduct.total, 3);
    expect(bulkResult.perProduct.total).toBeCloseTo(overviewResult.perProduct.total, 3);
    expect(buildCarbonEngineInputFromBulkRow(bulkRow).transport[0]?.distanceKm).toBe(500);
    expect(buildCarbonEngineInputFromAssessment(assessmentData, "vietnam").transport[0]?.distanceKm).toBe(500);
    expect(buildCarbonEngineInputFromProductOverview(overviewData).transport[0]?.defaultDistanceKey).toBe("vietnam");
    expect(
      assessmentResult.proxyNotes.includes(
        "Packaging is excluded because packaging weight/type was not provided."
      )
    ).toBe(false);
  });

  it("maps operational energy to scope 1 or 2 and value-chain stages to scope 3", () => {
    const gridPowered = calculateCarbonFootprint(buildBaseInput({ quantity: 1 }));
    const fuelPowered = calculateCarbonFootprint(
      buildBaseInput({
        quantity: 1,
        energyMix: [
          {
            factorId: "energy-gas-generic",
            percentage: 100,
            geography: "Vietnam"
          }
        ]
      })
    );

    expect(gridPowered.scope1).toBeCloseTo(0, 3);
    expect(gridPowered.scope2).toBeCloseTo(gridPowered.perProduct.production, 3);
    expect(gridPowered.scope3).toBeCloseTo(
      gridPowered.perProduct.materials +
        gridPowered.perProduct.transport +
        (gridPowered.perProduct.packaging || 0),
      3
    );

    expect(fuelPowered.scope1).toBeCloseTo(fuelPowered.perProduct.production, 3);
    expect(fuelPowered.scope2).toBeCloseTo(0, 3);
  });

  it("scales transport linearly with product mass and distance", () => {
    const base = calculateCarbonFootprint(
      buildBaseInput({
        unitMassKg: 0.2,
        quantity: 1,
        materials: [],
        processFactorIds: [],
        energyMix: [],
        transport: [
          {
            mode: "sea",
            factorId: "transport-sea-defra-2025",
            distanceKm: 1000
          }
        ]
      })
    );
    const doubledMass = calculateCarbonFootprint(
      buildBaseInput({
        unitMassKg: 0.4,
        quantity: 1,
        materials: [],
        processFactorIds: [],
        energyMix: [],
        transport: [
          {
            mode: "sea",
            factorId: "transport-sea-defra-2025",
            distanceKm: 1000
          }
        ]
      })
    );
    const doubledDistance = calculateCarbonFootprint(
      buildBaseInput({
        unitMassKg: 0.2,
        quantity: 1,
        materials: [],
        processFactorIds: [],
        energyMix: [],
        transport: [
          {
            mode: "sea",
            factorId: "transport-sea-defra-2025",
            distanceKm: 2000
          }
        ]
      })
    );

    expect(base.perProduct.transport).toBeCloseTo(0.003, 3);
    expect(doubledMass.perProduct.transport).toBeCloseTo(base.perProduct.transport * 2, 3);
    expect(doubledDistance.perProduct.transport).toBeCloseTo(base.perProduct.transport * 2, 3);
  });

  it("orders transport modes by emission intensity for equal mass and distance", () => {
    const commonOverrides = {
      unitMassKg: 10,
      quantity: 1,
      materials: [],
      processFactorIds: [],
      energyMix: []
    } satisfies Partial<CarbonEngineInput>;

    const sea = calculateCarbonFootprint(
      buildBaseInput({
        ...commonOverrides,
        transport: [{ mode: "sea", factorId: "transport-sea-defra-2025", distanceKm: 1000 }]
      })
    );
    const rail = calculateCarbonFootprint(
      buildBaseInput({
        ...commonOverrides,
        transport: [{ mode: "rail", factorId: "transport-rail-defra-2025", distanceKm: 1000 }]
      })
    );
    const road = calculateCarbonFootprint(
      buildBaseInput({
        ...commonOverrides,
        transport: [{ mode: "road", factorId: "transport-road-defra-2025", distanceKm: 1000 }]
      })
    );
    const air = calculateCarbonFootprint(
      buildBaseInput({
        ...commonOverrides,
        transport: [{ mode: "air", factorId: "transport-air-defra-2025", distanceKm: 1000 }]
      })
    );

    expect(air.perProduct.transport).toBeGreaterThan(road.perProduct.transport);
    expect(road.perProduct.transport).toBeGreaterThan(rail.perProduct.transport);
    expect(rail.perProduct.transport).toBeGreaterThan(sea.perProduct.transport);
  });

  it("uses default market distance when transport distance is missing", () => {
    const result = calculateCarbonFootprint(
      buildBaseInput({
        unitMassKg: 1,
        quantity: 1,
        materials: [],
        processFactorIds: [],
        energyMix: [],
        destinationMarket: "eu",
        transport: [
          {
            mode: "sea",
            factorId: "transport-sea-defra-2025",
            defaultDistanceKey: "eu"
          }
        ]
      })
    );

    expect(result.perProduct.transport).toBeCloseTo(0.161, 3);
    expect(result.proxyNotes.some((note) => note.includes("market default"))).toBe(true);
  });

  it("includes accessory mass in the materials stage when weight is provided", () => {
    const withoutAccessory = calculateCarbonFootprint(buildBaseInput({ quantity: 1 }));
    const withAccessory = calculateCarbonFootprint(
      buildBaseInput({
        quantity: 1,
        accessories: [
          {
            id: "acc-1",
            type: "button",
            name: "Button",
            weightKg: 0.01
          }
        ]
      })
    );

    expect(withAccessory.perProduct.materials).not.toBe(withoutAccessory.perProduct.materials);
    expect(
      withAccessory.factorSourceSummary.some((factor) => factor.factorId === "cat-button-plastic")
    ).toBe(true);
  });

  it("keeps totals stable while lowering confidence for unknown material origin", () => {
    const imported = calculateCarbonFootprint(
      buildBaseInput({
        quantity: 1,
        materials: [
          {
            id: "material-1",
            type: "cotton",
            factorId: "cat-cotton-100",
            percentage: 100,
            source: "imported",
            name: "Cotton"
          }
        ]
      })
    );
    const unknown = calculateCarbonFootprint(
      buildBaseInput({
        quantity: 1,
        materials: [
          {
            id: "material-1",
            type: "cotton",
            factorId: "cat-cotton-100",
            percentage: 100,
            source: "unknown",
            name: "Cotton"
          }
        ]
      })
    );

    expect(unknown.perProduct.total).toBeCloseTo(imported.perProduct.total, 3);
    expect(unknown.confidenceScore).toBeLessThan(imported.confidenceScore);
  });

  it("reduces confidence and widens uncertainty for proxy-heavy inputs", () => {
    const highQuality = calculateCarbonFootprint(buildBaseInput({ quantity: 1 }));
    const proxyHeavy = calculateCarbonFootprint(
      buildBaseInput({
        quantity: 1,
        materials: [
          {
            id: "material-1",
            type: "mystery-fabric",
            percentage: 80,
            source: "unknown",
            name: "Mystery Fabric"
          }
        ],
        accessories: [
          {
            id: "acc-1",
            type: "unknown-trim",
            name: "Unknown Trim"
          }
        ],
        processFactorIds: [],
        energyMix: [],
        destinationMarket: "eu",
        transport: [
          {
            mode: "air",
            factorId: "transport-air-defra-2025",
            defaultDistanceKey: "eu"
          }
        ]
      })
    );

    const highQualityRangeWidth = highQuality.co2eRange.max - highQuality.co2eRange.min;
    const proxyHeavyRangeWidth = proxyHeavy.co2eRange.max - proxyHeavy.co2eRange.min;

    expect(proxyHeavy.confidenceScore).toBeLessThan(highQuality.confidenceScore);
    expect(proxyHeavyRangeWidth).toBeGreaterThan(highQualityRangeWidth);
    expect(proxyHeavy.proxyUsed).toBe(true);
  });
});
