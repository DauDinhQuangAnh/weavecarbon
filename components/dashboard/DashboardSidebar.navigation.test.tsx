// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "/overview", demo: false, trial: false, settings: true }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "a" }, isDemoSession: state.demo, signOut: vi.fn(), exitDemoSession: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canAccessSettings: state.settings, isTrialPlan: state.trial }) }));
vi.mock("@/lib/apiClient", () => ({ authTokenStore: { getAccessToken: () => null } }));
vi.mock("@/lib/demo/routes", async () => {
  const { useMemo } = await import("react");
  return { useAppRoutes: () => {
    const demo = state.demo;
    return useMemo(() => ({ toAppPath: (path: string) => demo ? `/demo${path}` : path, homePath: demo ? "/demo/overview" : "/overview" }), [demo]);
  } };
});
import DashboardSidebar from "./DashboardSidebar";
const props = { company: null, profile: null, currentPlan: "standard", sidebarOpen: true, onToggleSidebar: vi.fn() };
beforeEach(() => { state.path = "/overview"; state.demo = false; state.trial = false; state.settings = true; });
afterEach(cleanup);
describe("sidebar rendering preserves old navigation", () => {
  it("renders the nine protected links in their original relative order", () => {
    render(<DashboardSidebar {...props} />);
    const links = screen.getByRole("navigation").querySelectorAll("a");
    expect([...links].slice(0, 9).map(link => link.getAttribute("href"))).toEqual(["/overview", "/products", "/logistics", "/carbon-calculator", "/evidence", "/export", "/reports", "/audit-trail", "/billing"]);
    expect(screen.getByRole("link", { name: "overview" })).toHaveAttribute("aria-current", "page");
  });
  it("applies demo prefixes and existing trial visibility", () => {
    state.demo = true; state.trial = true;
    render(<DashboardSidebar {...props} />);
    expect(screen.getByRole("link", { name: "product" })).toHaveAttribute("href", "/demo/products");
    expect(screen.queryByRole("link", { name: "export" })).toBeNull();
    expect(screen.queryByRole("link", { name: "reports" })).toBeNull();
    expect(screen.queryByRole("link", { name: "settings" })).toBeNull();
  });
  it("opens the current new route group and permits keyboard-compatible toggles", () => {
    state.path = "/evidence-graph";
    render(<DashboardSidebar {...props} />);
    const toggle = screen.getByRole("button", { name: "Dữ liệu" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Đồ thị bằng chứng" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "evidence" })).not.toHaveAttribute("aria-current");
    fireEvent.click(toggle);
    expect(screen.queryByRole("link", { name: "Đồ thị bằng chứng" })).toBeNull();
  });
});
