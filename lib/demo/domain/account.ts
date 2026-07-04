"use client";

import type { DemoDataset } from "@/lib/demo/schema";

const DEMO_COMPANY_ID = "00000000-0000-4000-8000-000000000001";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const asDate = (value: unknown, fallback: string) => {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const getSeededAt = (dataset: DemoDataset) => asDate(dataset.seededAt, new Date().toISOString());

export const getDemoAccountPayload = (dataset: DemoDataset) => ({
  profile: {
    id: dataset.user.id,
    user_id: dataset.user.id,
    full_name: dataset.user.full_name,
    email: dataset.user.email,
    company_id: dataset.company.id,
    created_at: getSeededAt(dataset),
  },
  company: {
    id: dataset.company.id,
    name: dataset.company.name,
    business_type: dataset.company.business_type,
    domestic_market: dataset.company.domestic_market,
    target_markets: dataset.company.target_markets,
    current_plan: dataset.company.current_plan,
    standard_sku_limit: dataset.company.standard_sku_limit,
    created_at: getSeededAt(dataset),
    updated_at: getSeededAt(dataset),
  },
  roles: ["b2b"],
  company_membership: {
    company_id: dataset.company.id,
    role: "admin",
    status: "active",
    is_root: true,
  },
});

export const getDemoCompanyMembersPayload = (dataset: DemoDataset) =>
  dataset.users.map((rawUser, index) => {
    const user = asRecord(rawUser);
    const isRoot = String(user.id || dataset.user.id) === dataset.user.id || index === 0;
    const role = isRoot ? "admin" : String(user.role || "member");
    const uid = String(user.user_id || user.id || `demo-member-${index + 1}`);
    const name = String(user.full_name || user.name || `Demo Member ${index + 1}`);
    return {
      id: String(user.id || uid),
      user_id: uid,
      userId: uid,
      full_name: name,
      fullName: name,
      email: String(user.email || `member${index + 1}@weavecarbon.demo`),
      role: role === "viewer" || role === "member" || role === "editor" || role === "admin" ? role : "member",
      status: String(user.status || "active"),
      last_login: typeof user.last_login === "string" ? user.last_login : null,
      created_at: asDate(user.created_at, getSeededAt(dataset)),
      company_id: String(user.company_id || dataset.company.id || DEMO_COMPANY_ID),
      is_root: isRoot,
    };
  });

export const getDemoCheckCompanyPayload = () => ({
  is_b2b: true,
  has_company: true,
  user_type: "b2b" as const,
});
