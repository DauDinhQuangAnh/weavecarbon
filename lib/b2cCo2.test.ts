import { describe, it, expect } from "vitest";
import {
  donationCo2Saved,
  REUSE_DISPLACEMENT_FACTOR,
  RECYCLE_NET_EF_PER_KG
} from "./b2cCo2";

describe("donationCo2Saved", () => {
  it("applies the conservative displacement factor for reuse (charity)", () => {
    // cotton virgin EF 8.0 → WRAP net reuse ~4.0 kg/kg
    expect(donationCo2Saved("charity", 8.0, 1)).toBeCloseTo(4.0, 6);
    expect(donationCo2Saved("charity", 8.0, 2)).toBeCloseTo(8.0, 6);
    expect(REUSE_DISPLACEMENT_FACTOR).toBe(0.5);
  });

  it("uses a flat downcycling factor for recycle, independent of material", () => {
    expect(donationCo2Saved("recycle", 8.0, 1)).toBeCloseTo(RECYCLE_NET_EF_PER_KG, 6);
    expect(donationCo2Saved("recycle", 17.0, 1)).toBeCloseTo(RECYCLE_NET_EF_PER_KG, 6);
  });

  it("treats unknown/empty categories as recycle (never over-credits)", () => {
    expect(donationCo2Saved("unknown", 10, 1)).toBeCloseTo(RECYCLE_NET_EF_PER_KG, 6);
    expect(donationCo2Saved(null, 10, 1)).toBeCloseTo(RECYCLE_NET_EF_PER_KG, 6);
  });

  it("returns 0 for non-positive or non-finite inputs", () => {
    expect(donationCo2Saved("charity", 8.0, 0)).toBe(0);
    expect(donationCo2Saved("charity", 8.0, -1)).toBe(0);
    expect(donationCo2Saved("charity", Number.NaN, 1)).toBe(0);
  });
});
