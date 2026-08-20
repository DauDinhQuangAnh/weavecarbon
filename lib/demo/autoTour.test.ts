import { describe, expect, it } from "vitest";
import {
  DEMO_TOUR_STEPS,
  clampTourIndex,
  findTourStepIndex,
  getNextTourIndex,
  getPrevTourIndex,
} from "@/lib/demo/autoTour";

describe("autoTour step catalogue", () => {
  it("has at least the B2B and B2C sections and unique routes", () => {
    expect(DEMO_TOUR_STEPS.length).toBeGreaterThan(0);
    const routes = DEMO_TOUR_STEPS.map((step) => step.route);
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes.every((route) => route.startsWith("/demo/"))).toBe(true);
    expect(DEMO_TOUR_STEPS.some((step) => step.group === "b2b")).toBe(true);
    expect(DEMO_TOUR_STEPS.some((step) => step.group === "b2c")).toBe(true);
  });
});

describe("getNextTourIndex", () => {
  it("advances and wraps around at the end", () => {
    expect(getNextTourIndex(0, 3)).toBe(1);
    expect(getNextTourIndex(1, 3)).toBe(2);
    expect(getNextTourIndex(2, 3)).toBe(0);
  });

  it("handles empty and invalid input safely", () => {
    expect(getNextTourIndex(0, 0)).toBe(0);
    expect(getNextTourIndex(-1, 4)).toBe(0);
    expect(getNextTourIndex(Number.NaN, 4)).toBe(0);
  });
});

describe("getPrevTourIndex", () => {
  it("steps back and wraps to the last item", () => {
    expect(getPrevTourIndex(2, 3)).toBe(1);
    expect(getPrevTourIndex(1, 3)).toBe(0);
    expect(getPrevTourIndex(0, 3)).toBe(2);
  });

  it("handles empty input safely", () => {
    expect(getPrevTourIndex(0, 0)).toBe(0);
  });
});

describe("findTourStepIndex", () => {
  it("matches an exact demo route", () => {
    expect(findTourStepIndex("/demo/overview")).toBe(0);
  });

  it("prefers the most specific (longest) match for nested routes", () => {
    const historyIndex = DEMO_TOUR_STEPS.findIndex(
      (step) => step.route === "/demo/b2c/history"
    );
    // A nested B2C route must not be swallowed by the shorter /demo/b2c step.
    expect(findTourStepIndex("/demo/b2c/history")).toBe(historyIndex);
    expect(findTourStepIndex("/demo/b2c/history/abc123")).toBe(historyIndex);
  });

  it("is case-insensitive and tolerates a trailing slash", () => {
    expect(findTourStepIndex("/demo/Overview/")).toBe(0);
  });

  it("returns -1 for pages outside the tour or empty input", () => {
    expect(findTourStepIndex("/demo/settings")).toBe(-1);
    expect(findTourStepIndex("/dashboard/overview")).toBe(-1);
    expect(findTourStepIndex(null)).toBe(-1);
    expect(findTourStepIndex("")).toBe(-1);
  });
});

describe("clampTourIndex", () => {
  it("keeps valid indexes and clamps out-of-range ones", () => {
    expect(clampTourIndex(2, 5)).toBe(2);
    expect(clampTourIndex(9, 5)).toBe(4);
    expect(clampTourIndex(-3, 5)).toBe(0);
    expect(clampTourIndex(0, 0)).toBe(0);
  });
});
