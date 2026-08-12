import type { ProductAssessmentData } from "@/components/dashboard/assessment/steps/types";
import type { BulkProductRow } from "@/components/dashboard/products/types";
import { calculateCarbonFootprint } from "@/lib/carbon/engine";
import { resolveCategoryMethodology } from "@/lib/carbon/factorRegistry";
import type {
  CarbonComputationResult,
  CarbonEngineInput,
  CarbonMaterialInput,
  CarbonTransportInput,
  ProductCategory
} from "@/lib/carbon/types";

const MATERIAL_FACTOR_BY_TYPE: Record<string, string> = {
  cotton: "cat-cotton-100",
  organic_cotton: "cat-cotton-organic",
  recycled_cotton: "cat-cotton-recycled",
  polyester: "cat-polyester-100",
  recycled_polyester: "cat-polyester-recycled",
  wool: "cat-wool-100",
  silk: "cat-silk-100",
  linen: "cat-linen-100",
  nylon: "cat-nylon-100",
  bamboo: "cat-bamboo",
  hemp: "cat-hemp",
  tencel: "cat-tencel",
  viscose: "cat-viscose",
  blend: "cat-blend-cotton-poly",
  mixed: "cat-blend-cotton-poly",
  wood: "cat-wood-softwood-new",
  recycled_wood: "cat-wood-recycled"
};

const PROCESS_FACTOR_BY_TYPE: Record<string, string> = {
  knitting: "process-knitting",
  weaving: "process-weaving",
  cutting: "process-cutting",
  cutting_sewing: "process-cutting-sewing",
  dyeing: "process-dyeing",
  printing: "process-printing",
  finishing: "process-finishing",
  sawing: "process-sawing",
  kiln_drying: "process-kiln-drying",
  assembly: "process-assembly"
};

const TRANSPORT_FACTOR_BY_MODE: Record<string, string> = {
  road: "transport-road-defra-2025",
  sea: "transport-sea-defra-2025",
  air: "transport-air-defra-2025",
  rail: "transport-rail-defra-2025",
  multimodal: "transport-multimodal-proxy"
};

const toNumber = (value: string | number | undefined | null) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/,/g, ".").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase();

const resolveEnergyFactorId = (
  source: string | undefined,
  geography: string | undefined
) => {
  const normalizedSource = normalizeText(source);
  const normalizedGeography = normalizeText(geography);

  if (normalizedSource === "grid") {
    if (normalizedGeography === "vietnam" || normalizedGeography === "vn") {
      return "energy-grid-vn-2023";
    }
    return "energy-grid-generic";
  }
  if (normalizedSource === "solar") return "energy-solar-generic";
  if (normalizedSource === "wind") return "energy-wind-generic";
  if (normalizedSource === "coal") return "energy-coal-generic";
  if (normalizedSource === "gas") return "energy-gas-generic";
  if (normalizedSource === "mixed") return "energy-mixed-generic";

  return undefined;
};

const parseAccessoryWeightListKg = (rawValue?: string) =>
  String(rawValue || "")
    .split(/[,;|]/)
    .map((value) => toNumber(value))
    .map((grams) => (grams > 0 ? grams / 1000 : undefined));

const parseAccessoryList = (rawValue?: string) =>
  String(rawValue || "")
    .split(/[,;|]/)
    .map((value) => value.trim())
    .filter(Boolean);

const buildTransportEntry = (
  mode: string | undefined,
  distanceKm: number | undefined,
  marketKey: string | undefined
): CarbonTransportInput | null => {
  if (!mode) return null;

  return {
    mode: mode as CarbonTransportInput["mode"],
    factorId: TRANSPORT_FACTOR_BY_MODE[mode] || "transport-multimodal-proxy",
    distanceKm,
    defaultDistanceKey: marketKey,
    boundaryType: "gate_to_market"
  };
};

const parseWeightToKg = (weight: string, unit: string) => {
  let weightKg = toNumber(weight);
  const normalizedUnit = normalizeText(unit);
  if (normalizedUnit === "g") weightKg /= 1000;
  if (normalizedUnit === "lb") weightKg *= 0.453592;
  return weightKg;
};

export interface ProductOverviewAdapterInput {
  productName: string;
  productCode: string;
  category: string;
  description: string;
  weight: string;
  unit: string;
  primaryMaterial: string;
  materialPercentage: string;
  secondaryMaterial: string;
  secondaryPercentage: string;
  recycledContent: string;
  certifications: string[];
  manufacturingLocation: string;
  energySource: string;
  processType: string;
  wasteRecovery: string;
  originCountry: string;
  destinationMarket: string;
  transportMode: string;
  packagingType: string;
  packagingWeight: string;
}

const buildBulkMaterials = (row: BulkProductRow): CarbonMaterialInput[] => {
  const materials: CarbonMaterialInput[] = [];

  if (row.primaryMaterialPercentage > 0) {
    materials.push({
      id: "material-1",
      type: row.primaryMaterial,
      factorId: MATERIAL_FACTOR_BY_TYPE[row.primaryMaterial],
      percentage: row.primaryMaterialPercentage,
      source: row.materialSource,
      name: row.primaryMaterial
    });
  }

  if (row.secondaryMaterial && (row.secondaryMaterialPercentage || 0) > 0) {
    materials.push({
      id: "material-2",
      type: row.secondaryMaterial,
      factorId: MATERIAL_FACTOR_BY_TYPE[row.secondaryMaterial],
      percentage: row.secondaryMaterialPercentage || 0,
      source: row.materialSource,
      name: row.secondaryMaterial
    });
  }

  return materials;
};

export const buildCarbonEngineInputFromBulkRow = (row: BulkProductRow): CarbonEngineInput => {
  const unitMassKg = toNumber(row.weightPerUnit) / 1000;
  const accessoryNames = parseAccessoryList(row.accessories);
  const accessoryWeightsKg = parseAccessoryWeightListKg(row.accessoriesWeightGram);
  // Bulk CSV import is textile-only for now; wood pallet bulk upload is a follow-up.
  const bulkRowCategory: ProductCategory = "textile";
  const bulkRowDefaultProcessFactorId = resolveCategoryMethodology(bulkRowCategory).defaultProcessFactorId;

  return {
    unitMassKg,
    quantity: Math.max(1, toNumber(row.quantity)),
    reportingActorRole: "manufacturer",
    productCategory: bulkRowCategory,
    materials: buildBulkMaterials(row),
    accessories: accessoryNames.map((name, index) => ({
      id: `accessory-${index + 1}`,
      type: name,
      name,
        weightKg: accessoryWeightsKg[index]
    })),
    packaging: null,
    includePackagingFallbackNote: false,
    processFactorIds: row.processes.map((process) => PROCESS_FACTOR_BY_TYPE[process] || bulkRowDefaultProcessFactorId),
    energyMix: [
      {
        factorId: resolveEnergyFactorId(row.energySource, row.manufacturingLocation),
        percentage: 100,
        geography: row.manufacturingLocation
      }
    ],
    manufacturingGeography: row.manufacturingLocation,
    originGeography: row.materialSource === "domestic" ? "Vietnam" : undefined,
    destinationMarket: row.marketType === "domestic" ? "vietnam" : row.exportCountry || "other",
    transport: (() => {
      const entry = buildTransportEntry(
        row.transportMode,
        row.transportDistanceKm,
        row.marketType === "domestic" ? "vietnam" : row.exportCountry || "other"
      );
      return entry ? [entry] : [];
    })()
  };
};

export const calculateBulkRowCarbon = (row: BulkProductRow): CarbonComputationResult =>
  calculateCarbonFootprint(buildCarbonEngineInputFromBulkRow(row));

export const buildCarbonEngineInputFromAssessment = (
  data: ProductAssessmentData,
  companyDomesticMarket?: string | null,
  options?: { forceGridElectricity?: boolean }
): CarbonEngineInput => {
  const destinationMarket =
    normalizeText(data.destinationMarket) ||
    normalizeText(companyDomesticMarket) ||
    "other";
  const productCategory: ProductCategory = data.productCategory || "textile";

  return {
    unitMassKg: Math.max(0, toNumber(data.weightPerUnit) / 1000),
    quantity: Math.max(1, toNumber(data.quantity)),
    reportingActorRole: "manufacturer",
    productCategory,
    materials: data.materials.map((material) => ({
      id: material.id,
      type: material.materialType,
      factorId:
        material.materialType.startsWith("cat-") ?
          material.materialType :
          MATERIAL_FACTOR_BY_TYPE[material.materialType],
      percentage: material.percentage,
      source: material.source,
      name: material.materialType
    })),
    accessories: data.accessories.map((accessory) => ({
      id: accessory.id,
      type: accessory.type,
      name: accessory.name,
      weightKg: isFinite(accessory.weight || 0) ? (accessory.weight || 0) / 1000 : undefined
    })),
    packaging: null,
    includePackagingFallbackNote: false,
    processFactorIds: data.productionProcesses.map(
      (process) => PROCESS_FACTOR_BY_TYPE[process] || resolveCategoryMethodology(productCategory).defaultProcessFactorId
    ),
    energyMix:
      data.energySources.length > 0 ?
        data.energySources.map((energy) => {
          const energyGeography = data.manufacturingLocation || data.originAddress.country;
          const normalizedEnergy = normalizeText(energy.source);
          const isRenewable = normalizedEnergy === "solar" || normalizedEnergy === "wind";
          // I-REC/GO sold => green attribute transferred; account this renewable
          // electricity at the national grid factor (GHG Protocol Scope 2 market-based).
          const factorId =
            options?.forceGridElectricity || (isRenewable && energy.recsSold) ?
              resolveEnergyFactorId("grid", energyGeography) :
              resolveEnergyFactorId(energy.source, energyGeography);
          return {
            factorId,
            percentage: energy.percentage,
            geography: energyGeography
          };
        }) :
        [],
    manufacturingGeography: data.manufacturingLocation || data.originAddress.country,
    originGeography: data.originAddress.country,
    destinationMarket,
    transport: data.transportLegs.map((leg) => ({
      mode: leg.mode,
      factorId: TRANSPORT_FACTOR_BY_MODE[leg.mode] || "transport-multimodal-proxy",
      distanceKm: leg.estimatedDistance,
      defaultDistanceKey: destinationMarket,
      boundaryType: "gate_to_market"
    }))
  };
};

export const calculateAssessmentCarbon = (
  data: ProductAssessmentData,
  companyDomesticMarket?: string | null,
  options?: { forceGridElectricity?: boolean }
): CarbonComputationResult =>
  calculateCarbonFootprint(buildCarbonEngineInputFromAssessment(data, companyDomesticMarket, options));

export const buildCarbonEngineInputFromProductOverview = (
  data: ProductOverviewAdapterInput
): CarbonEngineInput => {
  const unitMassKg = parseWeightToKg(data.weight, data.unit);
  const primaryPercentage = toNumber(data.materialPercentage) || 100;
  const secondaryPercentage = toNumber(data.secondaryPercentage) || 0;
  const processType = normalizeText(data.processType);
  // This legacy overview form has no category field of its own; textile is its only caller today.
  const productOverviewCategory: ProductCategory = "textile";
  const productOverviewDefaultProcessFactorId = resolveCategoryMethodology(productOverviewCategory).defaultProcessFactorId;
  const processFactorIds = processType
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((process) => PROCESS_FACTOR_BY_TYPE[process] || productOverviewDefaultProcessFactorId);

  return {
    unitMassKg,
    quantity: 1,
    reportingActorRole: "manufacturer",
    productCategory: productOverviewCategory,
    materials: [
      {
        id: "material-1",
        type: data.primaryMaterial,
        factorId: MATERIAL_FACTOR_BY_TYPE[data.primaryMaterial],
        percentage: primaryPercentage,
        source: "unknown",
        name: data.primaryMaterial
      },
      ...(data.secondaryMaterial && secondaryPercentage > 0
        ? [{
            id: "material-2",
            type: data.secondaryMaterial,
            factorId: MATERIAL_FACTOR_BY_TYPE[data.secondaryMaterial],
            percentage: secondaryPercentage,
            source: "unknown" as const,
            name: data.secondaryMaterial
          }]
        : [])
    ],
    accessories: [],
    packaging:
      toNumber(data.packagingWeight) > 0 ?
        {
          factorId: data.packagingType || "packaging-minimal-proxy",
          weightKg: toNumber(data.packagingWeight),
          label: data.packagingType
        } :
        null,
    processFactorIds,
    energyMix: [
      {
        factorId: resolveEnergyFactorId(data.energySource, data.originCountry || data.manufacturingLocation),
        percentage: 100,
        geography: data.originCountry || data.manufacturingLocation
      }
    ],
    manufacturingGeography: data.manufacturingLocation || data.originCountry,
    originGeography: data.originCountry,
    destinationMarket: data.destinationMarket || "other",
    transport: (() => {
      const entry = buildTransportEntry(data.transportMode, undefined, data.destinationMarket || "other");
      return entry ? [entry] : [];
    })()
  };
};

export const calculateProductOverviewCarbon = (
  data: ProductOverviewAdapterInput
): CarbonComputationResult =>
  calculateCarbonFootprint(buildCarbonEngineInputFromProductOverview(data));
