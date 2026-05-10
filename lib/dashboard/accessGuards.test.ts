import { describe, expect, it } from "vitest";
import {
  isStarterRestrictedDashboardPath,
  resolveDashboardSubscriptionPlan,
  resolveRestrictedDashboardRedirect
} from "@/lib/dashboard/accessGuards";

describe("dashboard access guards", () => {
  it("marks reports and export routes as restricted for starter plans", () => {
    expect(isStarterRestrictedDashboardPath("/export")).toBe(true);
    expect(isStarterRestrictedDashboardPath("/export/compliance")).toBe(true);
    expect(isStarterRestrictedDashboardPath("/reports")).toBe(true);
    expect(isStarterRestrictedDashboardPath("/reports/history")).toBe(true);
    expect(isStarterRestrictedDashboardPath("/overview")).toBe(false);
    expect(isStarterRestrictedDashboardPath("/demo/export")).toBe(false);
  });

  it("uses the subscription endpoint as the primary plan source", () => {
    expect(
      resolveDashboardSubscriptionPlan({
        current_plan: "standard_35",
        plan_details: { products: 35 }
      })
    ).toBe("standard_35");
  });

  it("falls back to account company trial when subscription is ambiguous", () => {
    expect(
      resolveDashboardSubscriptionPlan(
        {
          current_plan: "free"
        },
        "trial"
      )
    ).toBe("trial");
  });

  it("redirects trial users away from restricted dashboard routes", () => {
    expect(
      resolveRestrictedDashboardRedirect({
        pathname: "/reports",
        subscriptionPayload: {
          current_plan: "trial",
          trial_expired: false
        }
      })
    ).toBe("/overview");
  });

  it("allows standard users to stay on restricted dashboard routes", () => {
    expect(
      resolveRestrictedDashboardRedirect({
        pathname: "/export",
        subscriptionPayload: {
          current_plan: "standard",
          plan_details: { products: 20 }
        }
      })
    ).toBeNull();
  });

  it("does not redirect unrestricted dashboard routes", () => {
    expect(
      resolveRestrictedDashboardRedirect({
        pathname: "/products",
        subscriptionPayload: {
          current_plan: "trial",
          trial_expired: false
        }
      })
    ).toBeNull();
  });
});
