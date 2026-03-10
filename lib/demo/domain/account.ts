"use client";

import type { DemoDataset } from "@/lib/demo/schema";

export const getDemoAccountPayload = (dataset: DemoDataset) => ({
  profile: {
    id: dataset.user.id,
    user_id: dataset.user.id,
    full_name: dataset.user.full_name,
    email: dataset.user.email,
    company_id: dataset.company.id,
  },
  company: {
    id: dataset.company.id,
    name: dataset.company.name,
    business_type: dataset.company.business_type,
    domestic_market: dataset.company.domestic_market,
    target_markets: dataset.company.target_markets,
    current_plan: dataset.company.current_plan,
    standard_sku_limit: dataset.company.standard_sku_limit,
  },
  roles: ["b2b"],
  company_membership: {
    company_id: dataset.company.id,
    role: "root",
    status: "active",
    is_root: true,
  },
});

export const getDemoCompanyMembersPayload = (dataset: DemoDataset) => [
  {
    id: dataset.user.id,
    user_id: dataset.user.id,
    email: dataset.user.email,
    role: "root",
    status: "active",
    company_id: dataset.company.id,
    is_root: true,
  },
];

export const getDemoCheckCompanyPayload = () => ({
  is_b2b: true,
  has_company: true,
  user_type: "b2b" as const,
});
