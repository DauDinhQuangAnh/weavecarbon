import {
  getCarbonFactor,
  resolveAccessoryFactorIdByKeyword,
  resolveMarketDistanceDefault
} from "@/lib/carbon/factorRegistry";
import type {
  CarbonConfidenceLevel,
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

const METHODOLOGY_NAME = "WeaveCarbon Attributional Textile PCF";
const METHODOLOGY_VERSION = "WeaveCarbon Attributional Textile PCF v2.1 - climate-only partial CFP";
const CALCULATION_GRAPH_VERSION = "textile-pcf-2.1.0";
const RULE_ENGINE_VERSION = "scope-quality-rss-1.0.0";

const CORE_STAGE_KEYS = [
  "materials",
  "finished_goods_manufacturing",
  "packaging",
  "logistics_and_storage"
] as const satisfies CarbonStageKey[];

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

type ContributionTerm = {
  amount: number;
  factor: CarbonFactorMetadata;
};

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
    factorVersionId: factor.factorVersionId,
    label: factor.label,
    stage,
    unit: factor.unit,
    value: factor.value,
    source: factor.source,
    sourceUrl: factor.sourceUrl,
    geography: factor.geography,
    year: factor.year,
    quality: factor.quality,
    factorClass: factor.factorClass,
    boundaryType: factor.boundaryType,
    gwpBasis: factor.gwpBasis,
    uncertaintyCv: factor.uncertaintyCv,
    qualityScores: factor.qualityScores,
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

const resolveEnergyScope = (
  factor: CarbonFactorMetadata,
  reportingActorRole: CarbonEngineInput["reportingActorRole"]
): ScopeKey => {
  if (reportingActorRole === "brand") return "scope3";
  if (factor.id.startsWith("energy-coal") || factor.id.startsWith("energy-gas")) return "scope1";
  return "scope2";
};

const buildRssUncertainty = (terms: ContributionTerm[], total: number) => {
  if (total <= 0 || terms.length === 0) {
    return {
      method: "rss_fallback" as const,
      p5KgCO2e: 0,
      p95KgCO2e: 0,
      halfWidth95Percent: 0
    };
  }

  const variance = terms.reduce((sum, term) => {
    const cv = term.factor.uncertaintyCv || UNCERTAINTY_BY_QUALITY[term.factor.quality];
    return sum + Math.pow(term.amount * cv, 2);
  }, 0);
  const halfWidth = 1.96 * Math.sqrt(variance);
  return {
    method: "rss_fallback" as const,
    p5KgCO2e: roundPerProduct(Math.max(0, total - halfWidth)),
    p95KgCO2e: roundPerProduct(total + halfWidth),
    halfWidth95Percent: roundPerProduct((halfWidth / total) * 100)
  };
};

const averageQualityScore = (factor: CarbonFactorMetadata) => {
  const scores = factor.qualityScores;
  return (
    scores.technologicalRepresentativeness +
    scores.temporalRepresentativeness +
    scores.geographicalRepresentativeness +
    scores.completeness +
    scores.reliability
  ) / 5;
};

const resolveConfidenceLevel = (
  dataQualityRating1To5: number,
  proxyShare: number,
  uncertaintyHalfWidth95Percent: number
): CarbonConfidenceLevel => {
  if (dataQualityRating1To5 <= 2 && proxyShare <= 0.15 && uncertaintyHalfWidth95Percent <= 20) {
    return "high";
  }
  if (dataQualityRating1To5 <= 3.5 && proxyShare <= 0.5 && uncertaintyHalfWidth95Percent <= 60) {
    return "medium";
  }
  return "low";
};

export const calculateCarbonFootprint = (
  input: CarbonEngineInput
): CarbonComputationResult => {
  const notes: string[] = [];
  const warnings: string[] = [
    "This result is an attributional, climate-only partial CFP estimate for decision support.",
    "This result is not a comparative claim, product label, ISO certification, or third-party verification statement."
  ];
  const quantity = isFiniteNumber(input.quantity) && input.quantity > 0 ? input.quantity : 1;
  const unitMassKg = isFiniteNumber(input.unitMassKg) ? Math.max(0, input.unitMassKg) : 0;
  const includePackagingFallbackNote = input.includePackagingFallbackNote ?? true;
  const reportingActorRole = input.reportingActorRole || "manufacturer";

  const stages: Record<(typeof CORE_STAGE_KEYS)[number], StageAccumulator> = {
    materials: createStageAccumulator(),
    finished_goods_manufacturing: createStageAccumulator(),
    packaging: createStageAccumulator(),
    logistics_and_storage: createStageAccumulator()
  };

  let proxyContribution = 0;
  let totalContribution = 0;
  let scope1Amount = 0;
  let scope2Amount = 0;
  let scope3Amount = 0;
  const contributionTerms: ContributionTerm[] = [];
  const energyBreakdown: CarbonComputationResult["energyBreakdown"] = [];
  const addContribution = (amount: number, factor: CarbonFactorMetadata) => {
    if (amount <= 0) return;
    totalContribution += amount;
    contributionTerms.push({ amount, factor });
    if (factor.isProxy) proxyContribution += amount;
  };

  const totalAccessoryMassKg = input.accessories.reduce((sum, accessory) => {
    if (!isFiniteNumber(accessory.weightKg) || accessory.weightKg <= 0) return sum;
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
    warnings.push("Material BOM coverage is outside the 95-105% control range.");
  }

  if (input.materials.length === 0) {
    notes.push("Material inputs are missing; material stage is excluded from the estimate.");
    stages.materials.quality = maxQuality(stages.materials.quality, "market_default_or_missing");
  }

  for (const material of input.materials) {
    const factor = resolveFactorOrFallback(material.factorId ?? material.type, "cat-other-generic");
    const percentage = clamp(material.percentage || 0, 0, 100);
    const yieldToProduct =
      isFiniteNumber(material.yieldToProduct) && material.yieldToProduct > 0 ?
        clamp(material.yieldToProduct, 0.01, 1) :
        1;
    const amount = (materialBaseMassKg * (percentage / 100) / yieldToProduct) * factor.value;

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
    const packagingYield =
      isFiniteNumber(input.packaging.yieldToProduct) && input.packaging.yieldToProduct > 0 ?
        clamp(input.packaging.yieldToProduct, 0.01, 1) :
        1;
    packagingMassKg = input.packaging.weightKg / packagingYield;
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
    stages.finished_goods_manufacturing.quality = maxQuality(
      stages.finished_goods_manufacturing.quality,
      "market_default_or_missing"
    );
  }

  const processIntensityKwhPerKg = processFactorIds.reduce((sum, factorId) => {
    const factor = resolveFactorOrFallback(factorId, "process-generic-garment");
    addFactorSummary(stages.finished_goods_manufacturing, "finished_goods_manufacturing", factor);
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
    stages.finished_goods_manufacturing.quality = maxQuality(
      stages.finished_goods_manufacturing.quality,
      "market_default_or_missing"
    );
  }

  const totalEnergyPercent = sumValues(
    energyEntries.map((entry) => Math.max(0, entry.percentage || 0))
  );
  if (input.energyMix.length > 0 && (totalEnergyPercent < 95 || totalEnergyPercent > 105)) {
    notes.push(
      `Energy mix coverage is ${roundPerProduct(totalEnergyPercent)}%; shares were normalized before calculation.`
    );
    stages.finished_goods_manufacturing.quality = maxQuality(
      stages.finished_goods_manufacturing.quality,
      "market_default_or_missing"
    );
  }

  const normalizedEnergyDenominator = totalEnergyPercent > 0 ? totalEnergyPercent : 100;
  const weightedEnergyFactor = energyEntries.reduce((sum, entry) => {
    const factor = resolveEnergyFactor(entry.factorId, entry.geography || manufacturingGeography);
    addFactorSummary(stages.finished_goods_manufacturing, "finished_goods_manufacturing", factor);
    const normalizedShare = Math.max(0, entry.percentage || 0) / normalizedEnergyDenominator;
    const scopedAmount = unitMassKg * processIntensityKwhPerKg * factor.value * normalizedShare;
    const scopeKey = resolveEnergyScope(factor, reportingActorRole);
    if (scopeKey === "scope1") {
      scope1Amount += scopedAmount;
    } else if (scopeKey === "scope2") {
      scope2Amount += scopedAmount;
    } else {
      scope3Amount += scopedAmount;
    }
    energyBreakdown.push({
      factorId: factor.id,
      label: factor.label,
      amount: roundPerProduct(scopedAmount),
      scope: scopeKey
    });
    return sum + factor.value * normalizedShare;
  }, 0);

  const productionAmount = unitMassKg * processIntensityKwhPerKg * weightedEnergyFactor;
  stages.finished_goods_manufacturing.amount += productionAmount;
  if (productionAmount > 0) {
    const productionQualityFactor =
      stages.finished_goods_manufacturing.factors.find((factor) => factor.isProxy) ??
      stages.finished_goods_manufacturing.factors[0];
    if (productionQualityFactor) {
      addContribution(
        productionAmount,
        resolveFactorOrFallback(productionQualityFactor.factorId, "process-generic-garment")
      );
    }
  }

  const transportEntries = input.transport;
  const shippedMassTonne = (unitMassKg + packagingMassKg) / 1000;

  for (const transport of transportEntries) {
    if (!transport.mode && !transport.factorId) {
      notes.push("A transport leg is missing mode/factor and was excluded from the estimate.");
      stages.logistics_and_storage.quality = maxQuality(
        stages.logistics_and_storage.quality,
        "market_default_or_missing"
      );
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
      stages.logistics_and_storage.quality = maxQuality(
        stages.logistics_and_storage.quality,
        "market_default_or_missing"
      );
    }

    const amount = shippedMassTonne * distanceKm * factor.value;
    stages.logistics_and_storage.amount += amount;
    addFactorSummary(stages.logistics_and_storage, "logistics_and_storage", factor);
    addContribution(amount, factor);
    scope3Amount += amount;
  }

  if (transportEntries.length === 0) {
    notes.push("Transport is excluded because no transport legs were provided.");
    stages.logistics_and_storage.quality = maxQuality(
      stages.logistics_and_storage.quality,
      "market_default_or_missing"
    );
  }

  const stageBreakdown = CORE_STAGE_KEYS.map((stage) => toStageBreakdown(stage, stages[stage]));
  const perProduct = {
    materials: roundPerProduct(stages.materials.amount),
    production: roundPerProduct(stages.finished_goods_manufacturing.amount),
    energy: 0,
    transport: roundPerProduct(stages.logistics_and_storage.amount),
    packaging: roundPerProduct(stages.packaging.amount),
    total: roundPerProduct(
      stages.materials.amount +
        stages.finished_goods_manufacturing.amount +
        stages.logistics_and_storage.amount +
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

  const uncertainty = buildRssUncertainty(contributionTerms, perProduct.total);
  const range: CarbonRange = {
    min: uncertainty.p5KgCO2e,
    max: uncertainty.p95KgCO2e
  };
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
  const legacyConfidenceScore = clamp(
    completenessScore +
      specificityScore +
      geographicScore +
      transportSpecificityScore +
      proxyShareScore,
    0,
    100
  );
  const weightedQualityNumerator = contributionTerms.reduce(
    (sum, term) => sum + averageQualityScore(term.factor) * term.amount,
    0
  );
  const dataQualityRating1To5 = totalContribution > 0 ?
    roundPerProduct(weightedQualityNumerator / totalContribution) :
    5;
  const dataQualityPercent = roundPerProduct(100 * (5 - dataQualityRating1To5) / 4);
  const confidenceLevel = resolveConfidenceLevel(
    dataQualityRating1To5,
    proxyShare,
    uncertainty.halfWidth95Percent
  );
  const confidenceScore = clamp(Math.round((legacyConfidenceScore + dataQualityPercent) / 2), 0, 100);
  const cradleToGateCoreKgCO2e = roundPerProduct(
    perProduct.materials + perProduct.production + perProduct.packaging
  );
  const gateToMarketExtensionKgCO2e = perProduct.transport;
  const factorSourceSummary = stageBreakdown.flatMap((stage) => stage.factors);
  const factorManifest = Array.from(new Set(factorSourceSummary.map((factor) => factor.factorVersionId)));
  const contributionDenominator = totalContribution > 0 ? totalContribution : 1;

  return {
    perProduct,
    totalBatch,
    cradleToGateCoreKgCO2e,
    gateToMarketExtensionKgCO2e,
    reportedTotalKgCO2e: perProduct.total,
    confidenceLevel,
    confidenceScore,
    proxyUsed: proxyShare > 0 || notes.length > 0,
    proxyNotes: dedupeMessages(notes),
    scope1: roundPerProduct(scope1Amount),
    scope2: roundPerProduct(scope2Amount),
    scope3: roundPerProduct(scope3Amount),
    co2eRange: range,
    methodologyVersion: METHODOLOGY_VERSION,
    methodology: {
      name: METHODOLOGY_NAME,
      methodologyVersion: METHODOLOGY_VERSION,
      standardsAlignment: ["GHG Product Standard", "ISO 14067", "ISO 14040", "ISO 14044"],
      impactCategory: "climate_change_only",
      inventoryType: "partial_cfp",
      boundaryType: "cradle_to_gate_plus_gate_to_market_extension",
      gwpBasis: "IPCC_AR5_100y",
      reportingActorRole
    },
    boundary: {
      includedStages: [...CORE_STAGE_KEYS],
      excludedStages: ["use", "end_of_life"],
      partialCfp: true
    },
    quality: {
      dataQualityRating1To5,
      dataQualityPercent,
      confidenceLevel,
      primaryDataEmissionsShare: roundPerProduct(
        contributionTerms
          .filter((term) => term.factor.factorClass === "measured_primary_activity")
          .reduce((sum, term) => sum + term.amount, 0) / contributionDenominator
      ),
      supplierSpecificEmissionsShare: roundPerProduct(
        contributionTerms
          .filter((term) => term.factor.factorClass === "supplier_specific")
          .reduce((sum, term) => sum + term.amount, 0) / contributionDenominator
      ),
      secondaryEmissionsShare: roundPerProduct(
        contributionTerms
          .filter((term) => term.factor.factorClass === "documented_secondary")
          .reduce((sum, term) => sum + term.amount, 0) / contributionDenominator
      ),
      proxyEmissionsShare: roundPerProduct(proxyShare)
    },
    uncertainty,
    energyBreakdown,
    factorSources: factorSourceSummary,
    warnings: dedupeMessages(warnings),
    trace: {
      factorManifest,
      calculationGraphVersion: CALCULATION_GRAPH_VERSION,
      ruleEngineVersion: RULE_ENGINE_VERSION
    },
    assumptionsUsed: dedupeMessages([
      "Boundary: climate-only partial CFP with cradle-to-gate core and gate-to-market extension.",
      "Manufacturing energy is modeled as a process input inside finished goods manufacturing.",
      "Uncertainty range uses WeaveCarbon internal RSS fallback, not Monte Carlo.",
      ...notes
    ]),
    factorSourceSummary,
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
  cradleToGateCoreKgCO2e: 0,
  gateToMarketExtensionKgCO2e: 0,
  reportedTotalKgCO2e: 0,
  confidenceLevel: "low",
  confidenceScore: 0,
  proxyUsed: true,
  proxyNotes: ["No valid carbon input was provided."],
  scope1: null,
  scope2: null,
  scope3: null,
  co2eRange: buildEmptyRange(),
  methodologyVersion: METHODOLOGY_VERSION,
  methodology: {
    name: METHODOLOGY_NAME,
    methodologyVersion: METHODOLOGY_VERSION,
    standardsAlignment: ["GHG Product Standard", "ISO 14067", "ISO 14040", "ISO 14044"],
    impactCategory: "climate_change_only",
    inventoryType: "partial_cfp",
    boundaryType: "cradle_to_gate_plus_gate_to_market_extension",
    gwpBasis: "IPCC_AR5_100y",
    reportingActorRole: "manufacturer"
  },
  boundary: {
    includedStages: [...CORE_STAGE_KEYS],
    excludedStages: ["use", "end_of_life"],
    partialCfp: true
  },
  quality: {
    dataQualityRating1To5: 5,
    dataQualityPercent: 0,
    confidenceLevel: "low",
    primaryDataEmissionsShare: 0,
    supplierSpecificEmissionsShare: 0,
    secondaryEmissionsShare: 0,
    proxyEmissionsShare: 1
  },
  uncertainty: {
    method: "rss_fallback",
    p5KgCO2e: 0,
    p95KgCO2e: 0,
    halfWidth95Percent: 0
  },
  energyBreakdown: [],
  factorSources: [],
  warnings: [
    "This result is an attributional, climate-only partial CFP estimate for decision support.",
    "This result is not a comparative claim, product label, ISO certification, or third-party verification statement."
  ],
  trace: {
    factorManifest: [],
    calculationGraphVersion: CALCULATION_GRAPH_VERSION,
    ruleEngineVersion: RULE_ENGINE_VERSION
  },
  assumptionsUsed: ["Boundary: climate-only partial CFP with cradle-to-gate core and gate-to-market extension."],
  factorSourceSummary: [],
  dataQualityBreakdown: buildEmptyDataQualityBreakdown(),
  stageBreakdown: [
    { stage: "materials", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true },
    { stage: "finished_goods_manufacturing", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true },
    { stage: "packaging", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true },
    { stage: "logistics_and_storage", amount: 0, range: buildEmptyRange(), quality: "market_default_or_missing", factors: [], isEstimated: true }
  ]
};
