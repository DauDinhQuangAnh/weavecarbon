import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_MENU_PATHS, ROOT_MENU_ITEMS, SIDEBAR_GROUPS, TAIL_MENU_ITEMS, canShowNavigation, isNavigationActive } from "./navigation";

// Các trang của menu cố định cũ vẫn phải còn trên menu (chỉ đổi vị trí theo chuẩn Lovable).
const LEGACY_PATHS = ["/overview", "/products", "/logistics", "/carbon-calculator", "/evidence", "/export", "/reports", "/audit-trail", "/billing"];

describe("navigation (chuẩn Lovable)", () => {
  it("giữ Tổng quan ở trên, Báo cáo / Gói dịch vụ ở cuối và 6 nhóm nghiệp vụ", () => {
    expect(ROOT_MENU_ITEMS.map((row) => row.path)).toEqual(["/overview"]);
    expect(TAIL_MENU_ITEMS.map((row) => row.path)).toEqual(["/reports", "/billing"]);
    expect(SIDEBAR_GROUPS.map((group) => group.id)).toEqual(["carbon", "data", "supply-chain", "intelligence", "readiness", "connected-data"]);
  });
  it("không có mục nào lặp lại và các trang cũ vẫn truy cập được", () => {
    expect(new Set(ALL_MENU_PATHS).size).toBe(ALL_MENU_PATHS.length);
    LEGACY_PATHS.forEach((route) => expect(ALL_MENU_PATHS).toContain(route));
  });
  it("mọi mục menu đều có trang thật và trang demo", () => {
    ALL_MENU_PATHS.forEach((route) => ["(dashboard)", "demo"].forEach((segment) => {
      if (route === "/settings" && segment === "demo") return;
      expect(fs.existsSync(path.join(process.cwd(), "app", segment, route, "page.tsx")), `${segment}${route}`).toBe(true);
    }));
  });
  it("giữ quy tắc hiển thị cho gói dùng thử, demo và cài đặt", () => {
    const access = { isDemo: false, isTrial: true, canAccessSettings: false };
    expect(LEGACY_PATHS.filter((route) => canShowNavigation(route, access))).toEqual(["/overview", "/products", "/logistics", "/carbon-calculator", "/evidence", "/audit-trail", "/billing"]);
    expect(canShowNavigation("/settings", access)).toBe(false);
    expect(canShowNavigation("/settings", { ...access, isTrial: false, canAccessSettings: true })).toBe(true);
    expect(canShowNavigation("/settings", { ...access, isDemo: true, canAccessSettings: true })).toBe(false);
  });
  it("khớp đường dẫn con mà không nhầm route trùng tiền tố", () => {
    expect(isNavigationActive("/export/abc", "/export")).toBe(true);
    expect(isNavigationActive("/exporter", "/export")).toBe(false);
    expect(isNavigationActive("/demo/evidence-graph", "/demo/evidence")).toBe(false);
  });
});
