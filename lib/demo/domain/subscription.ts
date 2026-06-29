"use client";

import type { DemoDataset } from "@/lib/demo/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

const getAnchor = (dataset: DemoDataset) => {
  const parsed = new Date(dataset.seededAt);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const getDemoSubscriptionPayload = (dataset: DemoDataset) => {
  const anchor = getAnchor(dataset);
  const startedAt = new Date(anchor.getTime() - 7 * DAY_MS).toISOString();
  const expiresAt = new Date(anchor.getTime() + 23 * DAY_MS).toISOString();
  const productsUsed = dataset.products.length;
  const membersUsed = dataset.users.length;
  const productsLimit = dataset.company.standard_sku_limit;
  const apiCallsUsed = 1840 + productsUsed * 37 + membersUsed * 11;

  return {
    current_plan: "standard",
    plan: "standard",
    limits: {
      products: dataset.company.standard_sku_limit,
      members: 8,
      api_calls_per_month: 10000,
    },
    usage: {
      products: productsUsed,
      products_count: productsUsed,
      products_limit: productsLimit,
      members: membersUsed,
      members_count: membersUsed,
      members_limit: 8,
      api_calls_this_month: apiCallsUsed,
      api_calls_used: apiCallsUsed,
      api_calls_limit: 10000,
    },
    plan_details: {
      products: dataset.company.standard_sku_limit,
      members: 8,
      api_calls_per_month: 10000,
    },
    standard_started_at: startedAt,
    standard_expires_at: expiresAt,
    standard_expired: false,
    standard_days_remaining: 23,
    features_locked: false,
    standard_cycle: {
      started_at: startedAt,
      expires_at: expiresAt,
      expired: false,
      days_remaining: 23,
    },
  };
};
