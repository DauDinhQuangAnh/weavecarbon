import { describe, it, expect } from "vitest";
import { computeSkuCarbonV2, buildReportPayloadV2 } from "./reportBuilder";
import { DEMO_PACK_V2 } from "./demoPackV2";

// Phase A: the carbon maths that feed every report must satisfy their defining
// relationships, for every SKU — not just look plausible.
describe("computeSkuCarbonV2 invariants", () => {
  for (const sku of DEMO_PACK_V2) {
    it(`holds for ${sku.sku}`, () => {
      const c = computeSkuCarbonV2(sku);

      // Total is exactly the sum of its parts.
      expect(c.total).toBeCloseTo(c.materials + c.energy + c.transport + c.scope1, 9);

      // Batch tonnes = per-unit total × units / 1000.
      expect(c.batchTonnes).toBeCloseTo((c.total * sku.units) / 1000, 9);

      // Optimal is a non-negative reduction of the total.
      expect(c.optimal).toBeLessThanOrEqual(c.total + 1e-9);
      expect(c.optimal).toBeGreaterThanOrEqual(0);

      // The data gap is a subset of materials emissions.
      expect(c.gap).toBeLessThanOrEqual(c.materials + 1e-9);

      // No negative components.
      for (const v of [c.materials, c.energy, c.transport, c.scope1, c.total, c.batchTonnes]) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

describe("buildReportPayloadV2 consistency", () => {
  it("totals.pcfKgPerUnit equals the breakdown sum", () => {
    const p = buildReportPayloadV2();
    const sum = p.breakdownRows.reduce((s, r) => s + r.kgCo2e, 0);
    // pcfKgPerUnit is rounded to 3 decimals in the payload.
    expect(p.totals.pcfKgPerUnit).toBeCloseTo(sum, 2);
  });

  it("pie percentages are each within 0..100", () => {
    const p = buildReportPayloadV2();
    for (const slice of p.pieData) {
      expect(slice.value).toBeGreaterThanOrEqual(0);
      expect(slice.value).toBeLessThanOrEqual(100);
    }
  });
});
