"use client";

import demoSeed from "@/lib/demo/seed/demo-b2b-standard20.json";
import {
  DEMO_DATASET_STORAGE_KEY,
  DEMO_DATASET_UPDATED_EVENT,
  DEMO_DATA_VERSION,
  DEMO_MAX_DATASET_BYTES,
} from "@/lib/demo/constants";
import { normalizeSeedDemoDataset } from "@/lib/demo/normalize";
import { DemoDatasetV1Schema, type DemoDataset } from "@/lib/demo/schema";

const isBrowser = () => typeof window !== "undefined";

const DEMO_REPORT_SAMPLES_MARKER = "__demoReportSamplesHydrated";

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cloneDataset = (dataset: DemoDataset): DemoDataset => cloneJson(dataset);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const prepareDataset = (dataset: DemoDataset): DemoDataset => {
  const prepared = cloneDataset(dataset);
  const uiState = isRecord(prepared.uiState) ? prepared.uiState : {};
  const hasHydratedSampleReports = uiState[DEMO_REPORT_SAMPLES_MARKER] === true;

  if (prepared.reports.length === 0 && !hasHydratedSampleReports) {
    prepared.reports = cloneJson((demoSeed as DemoDataset).reports);
  }

  prepared.uiState = {
    ...uiState,
    [DEMO_REPORT_SAMPLES_MARKER]: hasHydratedSampleReports || prepared.reports.length > 0,
  };

  const normalized = normalizeSeedDemoDataset(prepared);
  normalized.version = DEMO_DATA_VERSION;
  return normalized;
};

const emitDatasetUpdated = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(DEMO_DATASET_UPDATED_EVENT));
};

const validateDataset = (dataset: unknown): DemoDataset => {
  const parsed = DemoDatasetV1Schema.safeParse(dataset);
  if (!parsed.success) {
    throw new Error("Invalid demo dataset.");
  }
  return parsed.data;
};

const ensureDatasetSize = (dataset: DemoDataset) => {
  const bytes = new Blob([JSON.stringify(dataset)]).size;
  if (bytes > DEMO_MAX_DATASET_BYTES) {
    throw new Error("Demo dataset exceeded local storage limit.");
  }
};

const createSeedDataset = (): DemoDataset => {
  const seedCandidate = {
    ...(cloneDataset(demoSeed as DemoDataset)),
    version: DEMO_DATA_VERSION,
  };
  const dataset = prepareDataset(validateDataset(seedCandidate));
  dataset.seededAt = new Date().toISOString();
  return dataset;
};

export const readDemoDataset = (): DemoDataset | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(DEMO_DATASET_STORAGE_KEY);
    if (!raw) return null;
    const normalized = prepareDataset(validateDataset(JSON.parse(raw)));
    const serialized = JSON.stringify(normalized);
    if (serialized !== raw) {
      ensureDatasetSize(normalized);
      window.localStorage.setItem(DEMO_DATASET_STORAGE_KEY, serialized);
    }
    return normalized;
  } catch {
    return null;
  }
};

export const writeDemoDataset = (dataset: DemoDataset) => {
  if (!isBrowser()) return dataset;
  const normalized = prepareDataset(validateDataset(dataset));
  ensureDatasetSize(normalized);
  window.localStorage.setItem(DEMO_DATASET_STORAGE_KEY, JSON.stringify(normalized));
  emitDatasetUpdated();
  return normalized;
};

export const clearDemoDataset = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(DEMO_DATASET_STORAGE_KEY);
  emitDatasetUpdated();
};

export const resetDemoDataset = () => {
  const dataset = createSeedDataset();
  return writeDemoDataset(dataset);
};

export const ensureDemoDataset = () => {
  const existing = readDemoDataset();
  if (existing && existing.version === DEMO_DATA_VERSION) {
    return existing;
  }
  return resetDemoDataset();
};

export const mutateDemoDataset = async <T>(
  mutator: (draft: DemoDataset) => T | Promise<T>
) => {
  const current = ensureDemoDataset();
  const draft = cloneDataset(current);
  const result = await mutator(draft);
  const next = validateDataset(draft);
  writeDemoDataset(next);
  return { dataset: next, result };
};
