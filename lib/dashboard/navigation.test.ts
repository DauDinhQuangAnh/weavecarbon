import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROTECTED_MENU_ITEMS, SIDEBAR_GROUPS, canShowNavigation, isNavigationActive } from "./navigation";

describe("frozen navigation contract", () => {
  it("preserves all nine original paths, labels, icons and relative order", () => {
    expect(PROTECTED_MENU_ITEMS.map(row => [row.path, row.labelKey, row.icon])).toEqual([
      ["/overview", "overview", "BarChart3"], ["/products", "product", "Package"], ["/logistics", "logistics", "Truck"],
      ["/carbon-calculator", "calculator", "CalculatorIcon"], ["/evidence", "evidence", "FileText"], ["/export", "export", "FileCheck"],
      ["/reports", "reports", "TrendingUp"], ["/audit-trail", "auditTrail", "History"], ["/billing", "billing", "CreditCard"],
    ]);
  });
  it("keeps existing trial, demo and settings visibility", () => {
    const access = { isDemo: false, isTrial: true, canAccessSettings: false };
    expect(PROTECTED_MENU_ITEMS.filter(row => canShowNavigation(row.path, access)).map(row => row.path)).toEqual(["/overview", "/products", "/logistics", "/carbon-calculator", "/evidence", "/audit-trail", "/billing"]);
    expect(canShowNavigation("/settings", access)).toBe(false);
    expect(canShowNavigation("/settings", { ...access, isTrial: false, canAccessSettings: true })).toBe(true);
    expect(canShowNavigation("/settings", { ...access, isDemo: true, canAccessSettings: true })).toBe(false);
  });
  it("has unique menu links and real/demo implementations for every link", () => {
    const paths = [...PROTECTED_MENU_ITEMS.map(row => row.path), ...SIDEBAR_GROUPS.flatMap(group => group.items.map(row => row.path))];
    expect(new Set(paths).size).toBe(paths.length);
    expect(SIDEBAR_GROUPS).toHaveLength(6);
    paths.forEach(route => ["(dashboard)", "demo"].forEach(segment => expect(fs.existsSync(path.join(process.cwd(), "app", segment, route, "page.tsx")), `${segment}${route}`).toBe(true)));
  });
  it("matches nested paths without matching similarly named routes", () => {
    expect(isNavigationActive("/export/abc", "/export")).toBe(true);
    expect(isNavigationActive("/exporter", "/export")).toBe(false);
    expect(isNavigationActive("/demo/evidence-graph", "/demo/evidence")).toBe(false);
  });
});
