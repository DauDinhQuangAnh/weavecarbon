import { describe, expect, it } from "vitest";
import seed from "@/lib/demo/seed/demo-b2b-standard20.json";
import { enrichDemoDataset } from "@/lib/demo/enrich";
import type { DemoDataset } from "@/lib/demo/schema";
import { demoReportingProducts } from "./reportingDemo";

// Regression test for the test report of 2026-11-18 (#7): the overview table and
// the product list showed different intensities/codes for the same product.

type CatalogProduct = {
  productCode: string;
  weightPerUnit: number;
  carbonResults?: { perProduct?: { total?: number } };
};

const catalog = (enrichDemoDataset(seed as unknown as DemoDataset).products as unknown as CatalogProduct[])
  .filter((product) => product.carbonResults?.perProduct?.total !== undefined);
const byCode = new Map(catalog.map((product) => [product.productCode, product]));

describe("demo reporting products vs product catalog", () => {
  const linked = demoReportingProducts.filter((product) => byCode.has(product.productCode));

  it("links the shared steel, cement, aluminium, fertiliser and coffee products by catalog code", () => {
    expect(linked.map((product) => product.productCode).sort()).toEqual(
      ["AGR-CPH-005", "ALU-EXT-003", "CEM-PCB-001", "HCH-NPK-011", "STL-HRC-002", "STL-TVA-009"]
    );
  });

  it.each(linked.map((product) => [product.productCode, product.intensity] as const))(
    "%s intensity matches the catalog per-tonne value",
    (code, intensity) => {
      const product = byCode.get(code)!;
      const tonnes = product.weightPerUnit / 1_000_000;
      const expected = (product.carbonResults!.perProduct!.total! / 1000 / tonnes).toFixed(2);
      expect(String(intensity)).toContain(expected);
    }
  );
});
