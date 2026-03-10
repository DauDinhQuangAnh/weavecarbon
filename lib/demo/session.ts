"use client";

import {
  DEMO_DATA_VERSION,
  DEMO_SCENARIO,
  DEMO_SESSION_STORAGE_KEY,
} from "@/lib/demo/constants";
import { DemoSessionSchema, type DemoSession } from "@/lib/demo/schema";
import { ensureDemoDataset } from "@/lib/demo/storage";

const isBrowser = () => typeof window !== "undefined";

const validateSession = (session: unknown): DemoSession => {
  const parsed = DemoSessionSchema.safeParse(session);
  if (!parsed.success) {
    throw new Error("Invalid demo session.");
  }
  return parsed.data;
};

export const createDemoSession = (): DemoSession => {
  const dataset = ensureDemoDataset();
  return {
    version: DEMO_DATA_VERSION,
    scenario: DEMO_SCENARIO,
    startedAt: new Date().toISOString(),
    user: dataset.user,
    company: dataset.company,
  };
};

export const readDemoSession = (): DemoSession | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return validateSession(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeDemoSession = (session: DemoSession) => {
  if (!isBrowser()) return session;
  const normalized = validateSession(session);
  window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const clearDemoSession = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
};

export const ensureDemoSession = () => {
  const existing = readDemoSession();
  if (existing && existing.version === DEMO_DATA_VERSION) {
    return existing;
  }
  return writeDemoSession(createDemoSession());
};
