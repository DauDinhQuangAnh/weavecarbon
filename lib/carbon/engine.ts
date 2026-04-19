import {
  getCarbonFactor,
  resolveAccessoryFactorIdByKeyword,
  resolveMarketDistanceDefault
} from "@/lib/carbon/factorRegistry";
import type {
  CarbonComputationResult,
  CarbonDataQualityBreakdown,
  CarbonEngineInput,
  CarbonFactorMetadata,
  CarbonFactorQuality,
  CarbonFactorSummaryItem,
  CarbonRange,
  CarbonStageBreakdown,
  CarbonStageKey
} from "@/lib/carbon/types";

const METHODOLOGY_VERSION = "WeaveCarbon PCF v2.0 cradle-to-market climate-only";

const QUALITY_RANK: Record<CarbonFactorQuality, number> = {
  primary: 0,
  documented_secondary: 1,
  internal_proxy: 2,
  market_default_or_missing: 3
};

const UNCERTAINTY_BY_QUALITY: Record<CarbonFactorQuality, number> = {
  primary: 0.1,
  documented_secondary: 0.2,
  internal_proxy: 0.35,
  market_default_or_missing: 0.5
};

const roundPerProduct = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 1000) / 1000;

const roundBatch = (value: number) =>
  Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isFiniteNumber = (value: number | undefined | null): value is number =>
  typeof value === "number" && Number.isFinite(value);

const sumValues = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

const maxQuality = (left: CarbonFactorQuality, right: CarbonFactorQuality): CarbonFactorQuality =>
  QUALITY_RANK[left] >= QUALITY_RANK[right] ? left : right;

const dedupeMessages = (messages: string[]) => Array.from(new Set(messages));

const buildEmptyRange = (): CarbonRange => ({ min: 0, max: 0 });

const buildEmptyDataQualityBreakdown = (): CarbonDataQualityBreakdown => ({
  completeness: { score: 0, maxScore: 30 },
  specificity: { score: 0, maxScore: 25 },
  geographicRelevance: { score: 0, maxScore: 15 },
  transportSpecificity: { score: 0, maxScore: 15 },
  proxyShare: { score: 0, maxScore: 15 }
});

type StageAccumulator = {
  amount: number;
  factors: CarbonFactorSummaryItem[];
  quality: CarbonFactorQuality;
};

type ScopeKey = "scope1" | "scope2" | "scope3";

const createStageAccumulator = (): StageAccumulator => ({
  amount: 0,
  factors: [],
  quality: "primary"
});

const addFactorSummary = (
  accumulator: StageAccumulator,
  stage: CarbonStageKey,
  factor: CarbonFactorMetadata
) => {
  const key = `${stage}:${factor.id}`;
  if (accumulator.factors.some((item) => `${item.stage}:${item.factorId}` === key)) {
    accumulator.quality = maxQuality(accumulator.quality, factor.quality);
    return;
  }

  accumulator.factors.push({
    factorId: factor.id,
    label: factor.label,
    stage,
    unit: factor.unit,
    value: factor.value,
    source: factor.source,
    sourceUrl: factor.sourceUrl,
    geography: factor.geography,
    year: factor.year,
    quality: factor.quality,
    isProxy: factor.isProxy
  });
  accumulator.quality = maxQuality(accumulator.quality, factor.quality);
};

const buildStageRange = (amount: number, quality: CarbonFactorQuality): CarbonRange => {
  if (amount <= 0) return buildEmptyRange();
  const uncertainty = UNCERTAINTY_BY_QUALITY[quality];
  return {
    min: roundPerProduct(amount * (1 - uncertainty)),
    max: roundPerProduct(amount * (1 + uncertainty))
  };
};

const toStageBreakdown = (
  stage: CarbonStageKey,
  accumulator: StageAccumulator
): CarbonStageBreakdown => ({
  stage,
  amount: roundPerProduct(accumulator.amount),
  range: buildStageRange(accumulator.amount, accumulator.quality),
  quality: accumulator.quality,
  factors: accumulator.factors,
  isEstimated: accumulator.factors.some((factor) => factor.isProxy)
});

const resolveEnergyFactor = (
  factorId: string | undefined,
  geography: string | undefined
) => {
  if (factorId) {
    const explicitFactor = getCarbonFactor(factorId);
    if (explicitFactor) return explicitFactor;
  }

  const normalizedGeography = String(geography || "").trim().toLowerCase();
  if (normalizedGeography === "vietnam" || normalizedGeography === "vn") {
    return getCarbonFactor("energy-grid-vn-2023") ?? getCarbonFactor("energy-grid-generic")!;
  }
  return getCarbonFactor("energy-grid-generic")!;
};

const resolveFactorOrFallback = (
  factorId: string | undefined,
  fallbackId: string
): CarbonFactorMetadata => {
  return getCarbonFactor(factorId) ?? getCarbonFactor(fallbackId)!;
};

const resolveEnergyScope = (factor: CarbonFactorMetadata): ScopeKey => {
  if (factor.id.startsWith("energy-coal") || factor.id.startsWith("energy-gas")) {
    return "scope1";
  }

  return "scope2";
};

export const calculateCarbonFootprint = (
  input: CarbonEngineInput
): CarbonComputationResult => {
  const notes: string[] = [];
  const quantity = isFiniteNumber(input.quantity) && input.quantity > 0 ? input.quantity : 1;
  const unitMassKg = isFiniteNumber(input.unitMassKg) ? Math.max(0, input.unitMassKg) : 0;
  const includePackagingFallbackNote = input.includePackagingFallbackNote ?? true;

  const stages: Record<CarbonStageKey, StageAccumulator> = {
    materials: createStageAccumulator(),
    production: createStageAccumulator(),
    energy: createStageAccumulator(),
    transport: createStageAccumulator(),
    packaging: createStageAccumulator()
  };

  let proxyContribution = 0;
  let totalContribution = 0;
  let scope1Amount = 0;
  let scope2Amount = 0;
  let scope3Amount = 0;
  const addContribution = (amount: number, factor: CarbonFactorMetadata) => {
    totalContribution += amount;
    if (factor.isProxy) {
      proxyContribution += amount;
    }
  };

  const totalAccessoryMassKg = input.accessories.reduce((sum, accessory) => {
    if (!isFiniteNumber(accessory.weightKg) || accessory.weightKg <= 0) {
      return sum;
    }
    return sum + accessory.weightKg;
  }, 0);

  const materialBaseMassKg = Math.max(unitMassKg - totalAccessoryMassKg, 0);
  const unknownMaterialOriginCount = input.materials.filter(
    (material) => (material.source || "unknown") === "unknown"
  ).length;
  const bomCoverage = input.materials.reduce(
    (sum, material) => sum + Math.max(0, material.percentage || 0),
    0
  );

  if (bomCoverage < 95 || bomCoverage > 105) {
    notes.push(`BOM coverage is ${roundPerProduct(bomCoverage)}%; results rely on partial material allocation.`);
    stages.materials.quality = maxQuality(stages.materials.quality, "market_default_or_missing");
  }

  if (input.materials.length === 0) {
    notes.push("Material inputs are missing; material stage is excluded from the estimate.");
    stages.materials.quality = maxQuality(stages.materials.quality, "market_default_or_missing");
  }

  for (const material of input.materials) {
    const factor = resolveFactorOrFallback(material.factorId ?? material.type, "cat-other-generic");
    const percentage = clamp(material.percentage || 0, 0, 100);
    const massKg = materialBaseMassKg * (percentage / 100);
    const amount = massKg * factor.value;

    if (amount > 0) {
      stages.materials.amount += amount;
      addFactorSummary(stages.materials, "materials", factor);
      addContribution(amount, factor);
      scope3Amount += amount;
    }

    if ((material.source || "unknown") === "unknown") {
      notes.push(`Material "${material.name || material.type}" has unknown origin; uncertainty is widened.`);
      stages.materials.quality = maxQuality(stages.materials.quality, "market_default_or_missing");
    }

    if (!material.factorId && factor.id === "cat-other-generic") {
      notes.push(`Material "${material.name || material.type}" is mapped to a generic internal proxy factor.`);
    }
  }

  for (const accessory of input.accessories) {
    if (!isFiniteNumber(accessory.weightKg) || accessory.weightKg <= 0) {
      notes.push(`Accessory "${accessory.name || accessory.type}" has no explicit weight and is excluded from CO2e.`);
      stages.materials.quality = maxQuality(stages.materials.quality, "market_default_or_missing");
      continue;
    }

    const factor = resolveFactorOrFallback(
      accessory.factorId ?? resolveAccessoryFactorIdByKeyword(accessory.name || accessory.type),
      "accessory-other-proxy"
    );
    const amount = accessory.weightKg * factor.value;
    stages.materials.amount += amount;
    addFactorSummary(stages.materials, "materials", factor);
    addContribution(amount, factor);
    scope3Amount += amount;
  }

  let packagingMassKg = 0;
  if (input.packaging && isFiniteNumber(input.packaging.weightKg) && input.packaging.weightKg > 0) {
    packagingMassKg = input.packaging.weightKg;
    const factor = resolveFactorOrFallback(
      input.packaging.factorId ?? input.packaging.label,
      "packaging-minimal-proxy"
    );
    const amount = packagingMassKg * factor.value;
    stages.packaging.amount += amount;
    addFactorSummary(stages.packaging, "packaging", factor);
    addContribution(amount, factor);
    scope3Amount += amount;
  } else {
    if (includePackagingFallbackNote) {
      notes.push("Packaging is excluded because packaging weight/type was not provided.");
    }
    stages.packaging.quality = maxQuality(stages.packaging.quality, "market_default_or_missing");
  }

  const processFactorIds = input.processFactorIds.length > 0
    ? input.processFactorIds
    : ["process-generic-garment"];

  if (input.processFactorIds.length === 0) {
    notes.push("Manufacturing processes are missing; a generic garment process proxy was used.");
    stages.production.quality = maxQuality(stages.production.quality, "market_default_or_missing");
  }

  const processIntensityKwhPerKg = processFactorIds.reduce((sum, factorId) => {
    const factor = resolveFactorOrFallback(factorId, "process-generic-garment");
    addFactorSummary(stages.production, "production", factor);
    return sum + factor.value;
  }, 0);

  const manufacturingGeography = input.manufacturingGeography || input.originGeography;
  const energyEntries = input.energyMix.length > 0
    ? input.energyMix
    : [{
        factorId: manufacturingGeography ? undefined : "energy-grid-generic",
        percentage: 100,
        geography: manufacturingGeography
      }];

  if (input.energyMix.length === 0) {
    notes.push(
      manufacturingGeography
        ? `No energy mix was provided; grid electricity was inferred for ${manufacturingGeography}.`
        : "No energy mix was provided; a generic grid electricity fallback was used."
    );
    stages.production.quality = maxQuality(stages.production.quality, "market_default_or_missing");
  }

  const totalEnergyPercent = sumValues(
    energyEntries.map((entry) => Math.max(0, entry.percentage || 0))
  );
  if (input.energyMix.length > 0 && (totalEnergyPercent < 95 || totalEnergyPercent > 105)) {
    notes.push(
      `Energy mix coverage is ${roundPerProduct(totalEnergyPercent)}%; shares were normalized before calculation.`
    );
    stages.production.quality = maxQuality(stages.production.quality, "market_default_or_missing");
  }

  const normalizedEnergyDenominator = totalEnergyPercent > 0 ? totalEnergyPercent : 100;
  const weightedEnergyFactor = energyEntries.reduce((sum, entry) => {
    const factor = resolveEnergyFactor(entry.factorId, entry.geography || manufacturingGeography);
    addFactorSummary(stages.production, "production", factor);
    const normalizedShare = Math.max(0, entry.percentage || 0) / normalizedEnergyDenominator;
    const scopedAmount = unitMassKg * processIntensityKwhPerKg * factor.value * normalizedShare;
    const scopeKey = resolveEnergyScope(factor);
    if (scopeKey === "scope1") {
      scope1Amount += scopedAmount;
    } else {
      scope2Amount += scopedAmount;
    }
    return sum + factor.value * normalizedShare;
  }, 0);

  const productionAmount = unitMassKg * processIntensityKwhPerKg * weightedEnergyFactor;
  stages.production.amount += productionAmount;
  if (productionAmount > 0) {
    totalContribution += productionAmount;
    if (stages.production.factors.some((factor) => factor.isProxy)) {
      proxyContribution += productionAmount;
    }
  }

  const transportEntries = input.transport;
  const shippedMassTonne = (unitMassKg + packagingMassKg) / 1000;

  for (const transport of transportEntries) {
    if (!transport.mode && !transport.factorId) {
      notes.push("A transport leg is missing mode/factor and was excluded from the estimate.");
      stages.transport.quality = maxQuality(stages.transport.quality, "market_default_or_missing");
      continue;
    }

    const factor = resolveFactorOrFallback(
      transport.factorId ?? transport.mode,
      "transport-multimodal-proxy"
    );

    const explicitDistanceKm = isFiniteNumber(transport.distanceKm) && transport.distanceKm > 0
      ? transport.distanceKm
      : undefined;
    const fallbackDistanceKm = resolveMarketDistanceDefault(
      transport.defaultDistanceKey || input.destinationMarket
    );
    const distanceKm = explicitDistanceKm ?? fallbackDistanceKm;

    if (!explicitDistanceKm) {
      notes.push(
        `Transport distance for ${transport.mode || factor.label} used market default ${roundPerProduct(distanceKm)} km.`
      );
      stages.transport.quality = maxQuality(stages.transport.quality, "market_default_or_missing");
    }

    const amount = shippedMassTonne * distanceKm * factor.value;
    stages.transport.amount += amount;
    addFactorSummary(stages.transport, "transport", factor);
    addContribution(amount, factor);
    scope3Amount += amount;
  }

  if (transportEntries.length === 0) {
    notes.push("Transport is excluded because no transport legs were provided.");
    stages.transport.quality = maxQuality(stages.transport.quality, "market_default_or_missing");
  }

  const stageBreakdown = ([
    "materials",
    "production",
    "energy",
    "transport",
    "packaging"
  ] as CarbonStageKey[]).map((stage) => toStageBreakdown(stage, stages[stage]));

  const perProduct = {
    materials: roundPerProduct(stages.materials.amount),
    production: roundPerProduct(stages.production.amount),
    energy: 0,
    transport: roundPerProduct(stages.transport.amount),
    packaging: roundPerProduct(stages.packaging.amount),
    total: roundPerProduct(
      stages.materials.amount +
        stages.production.amount +
        stages.transport.amount +
        stages.packaging.amount
    )
  };

  const totalBatch = {
    materials: roundBatch(perProduct.materials * quantity),
    production: roundBatch(perProduct.production * quantity),
    energy: 0,
    transport: roundBatch(perProduct.transport * quantity),
    packaging: roundBatch(perProduct.packaging * quantity),
    total: roundBatch(perProduct.total * quantity)
  };

  const range = stageBreakdown.reduce<CarbonRange>(
    (accumulator, stage) => ({
      min: roundPerProduct(accumulator.min + stage.range.min),
      max: roundPerProduct(accumulator.max + stage.range.max)
    }),
    buildEmptyRange()
  );

  const proxyShare = totalContribution > 0 ? clamp(proxyContribution / totalContribution, 0, 1) : 1;

  const explicitMaterialFactorCount = input.materials.filter((material) => Boolean(material.factorId)).length;
  const explicitAccessoryWeightCount = input.accessories.filter(
    (accessory) => isFiniteNumber(accessory.weightKg) && accessory.weightKg > 0
  ).length;
  const explicitTransportDistanceCount = input.transport.filter(
    (transport) => isFiniteNumber(transport.distanceKm) && transport.distanceKm > 0
  ).length;
  const completenessScore = clamp(
    (unitMassKg > 0 ? 4 : 0) +
      (input.materials.length > 0 ? 6 : 0) +
      (bomCoverage >= 95 && bomCoverage <= 105 ? 10 : bomCoverage > 0 ? 5 : 0) +
      (processFactorIds.length > 0 ? 4 : 0) +
      (energyEntries.length > 0 ? 3 : 0) +
      (transportEntries.length > 0 ? 3 : 0),
    0,
    30
  );
  const specificityScore = clamp(
    (input.materials.length > 0
      ? Math.round((explicitMaterialFactorCount / input.materials.length) * 10)
      : 0) +
      (input.accessories.length === 0
        ? 5
        : Math.round((explicitAccessoryWeightCount / input.accessories.length) * 5)) +
      (input.processFactorIds.length > 0 ? 5 : 2) +
      (input.energyMix.length > 0 ? 5 : 2),
    0,
    25
  );
  const geographicScore = clamp(
    (manufacturingGeography ? 5 : 0) +
      (energyEntries.some((entry) => resolveEnergyFactor(entry.factorId, entry.geography || manufacturingGeography)?.id === "energy-grid-vn-2023")
        ? 10
        : energyEntries.length > 0
          ? 5
          : 2) -
      (unknownMaterialOriginCount > 0 ? 5 : 0),
    0,
    15
  );
  const transportSpecificityScore = clamp(
    (transportEntries.length > 0
      ? Math.round((explicitTransportDistanceCount / transportEntries.length) * 10)
      : 0) +
      (transportEntries.every((entry) => Boolean(entry.mode || entry.factorId)) && transportEntries.length > 0
        ? 5
        : transportEntries.length > 0
          ? 2
          : 0),
    0,
    15
  );
  const proxyShareScore = clamp(Math.round((1 - proxyShare) * 15), 0, 15);

  const dataQualityBreakdown: CarbonDataQualityBreakdown = {
    completeness: { score: completenessScore, maxScore: 30 },
    specificity: { score: specificityScore, maxScore: 25 },
    geographicRelevance: { score: geographicScore, maxScore: 15 },
    transportSpecificity: { score: transportSpecificityScore, maxScore: 15 },
    proxyShare: { score: proxyShareScore, maxScore: 15 }
  };

  const confidenceScore = clamp(
    completenessScore +
      specificityScore +
      geographicScore +
      transportSpecificityScore +
      proxyShareScore,
    0,
    100
  );
  const confidenceLevel =
    confidenceScore >= 80 ? "high" : confidenceScore >= 60 ? "medium" : "low";

  return {
    perProduct,
    totalBatch,
    confidenceLevel,
    confidenceScore,
    proxyUsed: proxyShare > 0 || notes.length > 0,
    proxyNotes: dedupeMessages(notes),
    scope1: roundPerProduct(scope1Amount),
    scope2: roundPerProduct(scope2Amount),
    scope3: roundPerProduct(scope3Amount),
    co2eRange: range,
    methodologyVersion: METHODOLOGY_VERSION,
    assumptionsUsed: dedupeMessages([
      "Boundary: cradle-to-market climate-only.",
      "Manufacturing energy is reported inside production; energy split is not shown separately.",
      ...notes
    ]),
    factorSourceSummary: stageBreakdown.flatMap((stage) => stage.factors),
    dataQualityBreakdown,
    stageBreakdown
  };
};

export const EMPTY_CARBON_RESULT: CarbonComputationResult = {
  perProduct: {
    materials: 0,
    production: 0,
    energy: 0,
    transport: 0,
    packaging: 0,
    total: 0
  },
  totalBatch: {
    materials: 0,
    production: 0,
    energy: 0,
    transport: 0,
    packaging: 0,
    total: 0
  },
  confidenceLevel: "low",
  confidenceScore: 0,
  proxyUsed: true,
  proxyNotes: ["No valid carbon input was provided."],
  scope1: null,
  scope2: null,
  scope3: null,
  co2eRange: buildEmptyRange(),
  methodologyVersion: METHODOLOGY_VERSION,
  assumptionsUsed: ["Boundary: cradle-to-market climate-only."],
  factorSourceSummary: [],
  dataQualityBreakdown: buildEmptyDataQualityBreakdown(),
  stageBreakdown: [
    { stage: "materials", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true },
    { stage: "production", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true },
    { stage: "energy", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true },
    { stage: "transport", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true },
    { stage: "packaging", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true }
  ]
};
