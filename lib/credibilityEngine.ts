/**
 * Weave Carbon — Credibility Engine type definitions.
 * The full calculation engine lives in lib/carbon/engine.ts.
 * These types are used by audit UI components (CompliancePanel, RedFlagBanner).
 */

export type FactorScope = 1 | 2 | 3;
export type FactorSource = 'ecoinvent' | 'defra' | 'vn_monre';

export interface EmissionFactor {
  key: string;
  label: string;
  factor: number;
  isDefault: boolean;
  scope: FactorScope;
  source: FactorSource;
  citation: string;
}

export interface EmissionLine {
  category: 'material' | 'energy' | 'transport' | 'process';
  label: string;
  factor: EmissionFactor;
  activity: number;
  kgCo2e: number;
}

export interface CredibilityResult {
  totalKgCo2e: number;
  bestCaseKgCo2e: number;
  hasRedFlag: boolean;
  excessTonsCo2e: number;
  cbamPenaltyEur: number;
  lines: EmissionLine[];
  methodology: string;
}
