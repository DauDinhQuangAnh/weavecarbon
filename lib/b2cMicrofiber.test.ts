import { describe, it, expect } from "vitest";
import { classifyMicrofiber, aggregateMicrofiberLevel } from "./b2cMicrofiber";

describe("classifyMicrofiber", () => {
  it("flags virgin synthetics", () => {
    expect(classifyMicrofiber("100% Polyester").level).toBe("synthetic");
    expect(classifyMicrofiber("100% Nylon").level).toBe("synthetic");
    expect(classifyMicrofiber("Acrylic").level).toBe("synthetic");
    expect(classifyMicrofiber("Faux Leather/PU").level).toBe("synthetic");
  });

  it("escalates recycled synthetics to the higher-concern level", () => {
    expect(classifyMicrofiber("Recycled Polyester (rPET)").level).toBe("recycled-synthetic");
    expect(classifyMicrofiber("Recycled Nylon").level).toBe("recycled-synthetic");
  });

  it("does not flag natural fibres", () => {
    expect(classifyMicrofiber("100% Cotton").level).toBe("none");
    expect(classifyMicrofiber("100% Wool").level).toBe("none");
    expect(classifyMicrofiber("100% Linen").level).toBe("none");
    expect(classifyMicrofiber(null).level).toBe("none");
  });
});

describe("aggregateMicrofiberLevel", () => {
  it("returns the highest-concern level in the set", () => {
    expect(aggregateMicrofiberLevel(["100% Cotton", "100% Wool"])).toBe("none");
    expect(aggregateMicrofiberLevel(["100% Cotton", "100% Polyester"])).toBe("synthetic");
    expect(
      aggregateMicrofiberLevel(["100% Cotton", "100% Polyester", "Recycled Polyester (rPET)"])
    ).toBe("recycled-synthetic");
  });

  it("handles an empty set", () => {
    expect(aggregateMicrofiberLevel([])).toBe("none");
  });
});
