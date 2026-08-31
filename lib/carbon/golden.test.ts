import { describe, expect, it } from "vitest";
import inputs from "@/lib/carbon/fixtures/v1/inputs.json";
import expectedOutputs from "@/lib/carbon/fixtures/v1/expected.json";
import {
  projectCarbonGoldenResult,
  type CarbonGoldenOutput
} from "@/lib/carbon/fixtures/goldenProjection";
import { calculateCarbonFootprint } from "@/lib/carbon/engine";
import type { CarbonEngineInput } from "@/lib/carbon/types";

const expectedById = new Map(
  expectedOutputs.cases.map(({ id, expected }) => [
    id,
    expected as unknown as CarbonGoldenOutput
  ])
);

describe(`carbon engine golden fixtures (${inputs.fixtureVersion})`, () => {
  it("declares a unique, complete and version-aligned fixture set", () => {
    const inputIds = inputs.cases.map(({ id }) => id);
    const expectedIds = expectedOutputs.cases.map(({ id }) => id);
    const coveredBehaviors = new Set(inputs.cases.flatMap(({ covers }) => covers));

    expect(new Set(inputIds).size).toBe(inputIds.length);
    expect(expectedOutputs.fixtureVersion).toBe(inputs.fixtureVersion);
    expect(expectedIds).toEqual(inputIds);
    const requiredBehaviors = [
      "materials",
      "energy",
      "logistics",
      "packaging",
      "scope1",
      "scope2",
      "scope3",
      "proxy-factors",
      "default-factors",
      "bom-undercoverage",
      "data-quality",
      "uncertainty",
      "zero-rounding"
    ];

    for (const behavior of requiredBehaviors) {
      expect(coveredBehaviors.has(behavior)).toBe(true);
    }
  });

  for (const fixture of inputs.cases) {
    it(`${fixture.id}: ${fixture.description}`, () => {
      const actual = projectCarbonGoldenResult(
        calculateCarbonFootprint(fixture.input as unknown as CarbonEngineInput)
      );
      const expected = expectedById.get(fixture.id);

      expect(expected).toBeDefined();
      expect(actual).toEqual(expected);
      expect(actual.trace.ruleEngineVersion).toBe(inputs.engineVersion);
      expect(actual.trace.calculationGraphVersion).toBe("textile-pcf-2.1.0");
    });
  }
});
