import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("G2-07 climate risk workspace", () => {
  const source = readFileSync(resolve(process.cwd(), "components/dashboard/climate-risk/ClimateRiskClient.tsx"), "utf8");
  it("keeps facility location, source-backed assessment and portfolio steps visible", () => {
    expect(source).toContain("climateRiskApi.createLocation");
    expect(source).toContain("climateRiskApi.createAssessment");
    expect(source).toContain("climateRiskApi.createPortfolio");
    expect(source).toContain("spatialMatchNotes");
  });
  it("discloses the screening boundary", () => {
    expect(source).toContain('t("caution")');
    expect(source).toContain("screeningStatus");
  });
});
