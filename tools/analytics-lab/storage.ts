import type {
  AnalyticsEventNameV2,
  AnalyticsIdentity,
  AnalyticsPreparedEvent,
  AnalyticsUserProperties
} from "@/lib/analytics";

export const ANALYTICS_LAB_SOURCE_PATH = "/tools/analytics-lab";
export const ANALYTICS_LAB_JOB_QUERY_PARAM = "wc_analytics_lab_job";
export const ANALYTICS_LAB_STEP_QUERY_PARAM = "wc_analytics_lab_step";

const ANALYTICS_LAB_JOB_PREFIX = "weavecarbon_analytics_lab_job_v1:";
const ANALYTICS_LAB_RESULT_PREFIX = "weavecarbon_analytics_lab_result_v1:";

export interface AnalyticsLabSessionStep {
  dwellMs: number;
  eventName: AnalyticsEventNameV2;
  eventPayload: Record<string, unknown>;
  id: string;
  targetPath: string;
}

export interface AnalyticsLabSessionJob {
  id: string;
  autoCloseWindow: boolean;
  createdAt: string;
  debugMode: boolean;
  identity: AnalyticsIdentity;
  sourcePath: string;
  steps: AnalyticsLabSessionStep[];
  userProperties: AnalyticsUserProperties;
}

export type AnalyticsLabSessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "path_mismatch";

export interface AnalyticsLabStepResult {
  currentPath: string;
  debugMode: boolean;
  error?: string;
  eventName: AnalyticsEventNameV2;
  eventSent: boolean;
  eventSentAt?: string;
  pageTitle?: string;
  pageViewPrepared?: AnalyticsPreparedEvent;
  pageViewSent: boolean;
  pageViewSentAt?: string;
  preparedEvent?: AnalyticsPreparedEvent;
  status: AnalyticsLabSessionStatus;
  stepId: string;
  stepIndex: number;
  targetPath: string;
  updatedAt: string;
  windowHref?: string;
}

export interface AnalyticsLabSessionResult {
  activeStepIndex: number;
  completedStepCount: number;
  currentPath: string;
  debugMode: boolean;
  error?: string;
  id: string;
  status: AnalyticsLabSessionStatus;
  stepResults: AnalyticsLabStepResult[];
  stepsTotal: number;
  updatedAt: string;
  windowHref?: string;
}

const getJobStorageKey = (jobId: string) => `${ANALYTICS_LAB_JOB_PREFIX}${jobId}`;
const getResultStorageKey = (jobId: string) => `${ANALYTICS_LAB_RESULT_PREFIX}${jobId}`;

const parseStoredJson = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const normalizeAnalyticsLabPath = (value: string | null | undefined) => {
  const fallback = "/";
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return url.pathname || fallback;
    } catch {
      return fallback;
    }
  }

  const withoutHash = trimmed.split("#")[0] || fallback;
  const pathname = (withoutHash.split("?")[0] || fallback).trim();
  if (!pathname) {
    return fallback;
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`;
};

export const createAnalyticsLabJobId = () => {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `wc_lab_${timePart}_${randomPart}`;
};

export const createAnalyticsLabStepId = () => {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `wc_lab_step_${timePart}_${randomPart}`;
};

export const parseAnalyticsLabStepIndex = (value: string | null | undefined) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
};

export const buildAnalyticsLabJobUrl = (
  origin: string,
  job: AnalyticsLabSessionJob,
  stepIndex = 0
) => {
  const targetStep = job.steps[stepIndex] || job.steps[0];
  const url = new URL(targetStep?.targetPath || "/", origin);
  url.searchParams.set(ANALYTICS_LAB_JOB_QUERY_PARAM, job.id);
  url.searchParams.set(ANALYTICS_LAB_STEP_QUERY_PARAM, String(Math.max(0, stepIndex)));
  return url.toString();
};

export const readAnalyticsLabJob = (jobId: string) => {
  if (typeof window === "undefined" || !jobId.trim()) {
    return null;
  }

  return parseStoredJson<AnalyticsLabSessionJob>(
    window.localStorage.getItem(getJobStorageKey(jobId.trim()))
  );
};

export const writeAnalyticsLabJob = (job: AnalyticsLabSessionJob) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getJobStorageKey(job.id), JSON.stringify(job));
};

export const removeAnalyticsLabJob = (jobId: string) => {
  if (typeof window === "undefined" || !jobId.trim()) {
    return;
  }

  window.localStorage.removeItem(getJobStorageKey(jobId.trim()));
};

export const readAnalyticsLabResult = (jobId: string) => {
  if (typeof window === "undefined" || !jobId.trim()) {
    return null;
  }

  return parseStoredJson<AnalyticsLabSessionResult>(
    window.localStorage.getItem(getResultStorageKey(jobId.trim()))
  );
};

export const writeAnalyticsLabResult = (result: AnalyticsLabSessionResult) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getResultStorageKey(result.id), JSON.stringify(result));
};

export const removeAnalyticsLabResult = (jobId: string) => {
  if (typeof window === "undefined" || !jobId.trim()) {
    return;
  }

  window.localStorage.removeItem(getResultStorageKey(jobId.trim()));
};
