import type { CarbonComputationResult } from "@/lib/carbon/types";

/**
 * Stable numerical/audit projection frozen by WP-CARB1. Presentation copy and full
 * source citations intentionally stay outside the golden contract; factor versions,
 * values, quality, rounding, scopes, assumptions and numerical outputs are locked.
 */
export const projectCarbonGoldenResult = (result: CarbonComputationResult) => ({
  perProduct: result.perProduct,
  totalBatch: result.totalBatch,
  boundaryTotals: {
    cradleToGateCoreKgCO2e: result.cradleToGateCoreKgCO2e,
    gateToMarketExtensionKgCO2e: result.gateToMarketExtensionKgCO2e,
    reportedTotalKgCO2e: result.reportedTotalKgCO2e
  },
  scopes: {
    scope1: result.scope1,
    scope2: result.scope2,
    scope3: result.scope3
  },
  co2eRange: result.co2eRange,
  confidence: {
    level: result.confidenceLevel,
    score: result.confidenceScore,
    proxyUsed: result.proxyUsed
  },
  quality: result.quality,
  uncertainty: result.uncertainty,
  dataQualityBreakdown: result.dataQualityBreakdown,
  energyBreakdown: result.energyBreakdown.map(({ factorId, amount, scope }) => ({
    factorId,
    amount,
    scope
  })),
  stages: result.stageBreakdown.map((stage) => ({
    stage: stage.stage,
    amount: stage.amount,
    range: stage.range,
    quality: stage.quality,
    isEstimated: stage.isEstimated,
    factorIds: stage.factors.map((factor) => factor.factorId)
  })),
  factors: result.factorSourceSummary.map((factor) => ({
    factorId: factor.factorId,
    factorVersionId: factor.factorVersionId,
    value: factor.value,
    uncertaintyCv: factor.uncertaintyCv,
    quality: factor.quality,
    isProxy: factor.isProxy
  })),
  trace: result.trace,
  proxyNotes: result.proxyNotes
});

export type CarbonGoldenOutput = ReturnType<typeof projectCarbonGoldenResult>;
