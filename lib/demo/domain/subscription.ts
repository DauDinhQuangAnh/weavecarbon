"use client";

import type { DemoDataset } from "@/lib/demo/schema";

export const getDemoSubscriptionPayload = (dataset: DemoDataset) => {
  const startedAt = "2026-03-01T00:00:00.000Z";
  const expiresAt = "2026-03-31T23:59:59.000Z";

  return {
    current_plan: "standard",
    limits: {
      products: dataset.company.standard_sku_limit,
    },
    plan_details: {
      products: dataset.company.standard_sku_limit,
    },
    standard_started_at: startedAt,
    standard_expires_at: expiresAt,
    standard_expired: false,
    standard_days_remaining: 30,
    features_locked: false,
    standard_cycle: {
      started_at: startedAt,
      expires_at: expiresAt,
      expired: false,
      days_remaining: 30,
    },
  };
};
