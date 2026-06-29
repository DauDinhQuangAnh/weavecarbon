"use client";

import demoSeed from "@/lib/demo/seed/demo-b2b-standard20.json";
import {
  DEMO_DATASET_STORAGE_KEY,
  DEMO_DATA_REFRESH_INTERVAL_MS,
  DEMO_DATASET_UPDATED_EVENT,
  DEMO_DATA_VERSION,
  DEMO_MAX_DATASET_BYTES,
} from "@/lib/demo/constants";
import { enrichDemoDataset } from "@/lib/demo/enrich";
import { normalizeSeedDemoDataset } from "@/lib/demo/normalize";
import { DemoDatasetV1Schema, type DemoDataset } from "@/lib/demo/schema";

const isBrowser = () => typeof window !== "undefined";

const DEMO_REPORT_SAMPLES_MARKER = "__demoReportSamplesHydrated";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cloneDataset = (dataset: DemoDataset): DemoDataset => cloneJson(dataset);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const addDays = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const rollDateString = (value: string, daysToRoll: number) => {
  if (DATE_TIME_PATTERN.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : addDays(parsed, daysToRoll).toISOString();
  }

  if (DATE_ONLY_PATTERN.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? value : formatDateOnly(addDays(parsed, daysToRoll));
  }

  return value;
};

const rollDatesInValue = (value: unknown, daysToRoll: number): unknown => {
  if (typeof value === "string") {
    return rollDateString(value, daysToRoll);
  }

  if (Array.isArray(value)) {
    return value.map((item) => rollDatesInValue(item, daysToRoll));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rollDatesInValue(item, daysToRoll)])
    );
  }

  return value;
};

const rollSeedDatasetDates = (dataset: DemoDataset): DemoDataset => {
  const seedAnchor = new Date((demoSeed as DemoDataset).seededAt);
  if (Number.isNaN(seedAnchor.getTime())) {
    return dataset;
  }

  const now = new Date();
  const daysToRoll = Math.max(0, Math.round((now.getTime() - seedAnchor.getTime()) / MS_PER_DAY));
  const rolled = rollDatesInValue(dataset, daysToRoll) as DemoDataset;
  rolled.seededAt = now.toISOString();
  return rolled;
};

const isDatasetFresh = (dataset: DemoDataset) => {
  const seededAt = new Date(dataset.seededAt);
  if (Number.isNaN(seededAt.getTime())) {
    return false;
  }

  return Date.now() - seededAt.getTime() < DEMO_DATA_REFRESH_INTERVAL_MS;
};

const prepareDataset = (dataset: DemoDataset): DemoDataset => {
  const prepared = cloneDataset(dataset);
  enrichDemoDataset(prepared);
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
  return rollSeedDatasetDates(prepareDataset(validateDataset(seedCandidate)));
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
  if (existing && existing.version === DEMO_DATA_VERSION && isDatasetFresh(existing)) {
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
