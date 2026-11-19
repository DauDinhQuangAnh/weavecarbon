import { describe, expect, it } from "vitest";
import demoSeed from "@/lib/demo/seed/demo-b2b-standard20.json";
import { DEMO_DATA_VERSION } from "@/lib/demo/constants";
import { enrichDemoDataset } from "@/lib/demo/enrich";
import { normalizeSeedDemoDataset } from "@/lib/demo/normalize";
import { DemoDatasetV1Schema, type DemoDataset } from "@/lib/demo/schema";
import { getDemoProducts } from "@/lib/demo/domain/products";
import { getDemoShipmentDetails } from "@/lib/demo/domain/logistics";
import { resolveDemoPassport } from "@/lib/demo/passportDemo";
import {
  decodePublicPassportSnapshot,
  encodePublicPassportSnapshot,
} from "@/lib/demo/passportSnapshot";

const buildDataset = () => {
  const dataset = { ...JSON.parse(JSON.stringify(demoSeed)), version: DEMO_DATA_VERSION } as DemoDataset;
  enrichDemoDataset(dataset);
  return DemoDatasetV1Schema.parse(normalizeSeedDemoDataset(dataset));
};

describe("demo public passport", () => {
  it("resolves a published product with a shipment that actually contains it", () => {
    const dataset = buildDataset();
    const shipment = getDemoShipmentDetails(dataset).find((item) => item.products.length > 0)!;
    const productId = shipment.products[0].productId;

    const result = resolveDemoPassport(dataset, productId);
    expect(result.product?.id).toBe(productId);
    expect(result.shipment?.products.some((item) => item.productId === productId)).toBe(true);

    const pinned = resolveDemoPassport(dataset, productId, shipment.id);
    expect(pinned.shipment?.id).toBe(shipment.id);
  });

  it("ignores a requested shipment that does not contain the product", () => {
    const dataset = buildDataset();
    const shipments = getDemoShipmentDetails(dataset);
    const product = getDemoProducts(dataset).find((item) => item.status === "published")!;
    const unrelated = shipments.find((item) => !item.products.some((p) => p.productId === product.id));
    const result = resolveDemoPassport(dataset, product.id, unrelated?.id ?? "missing");
    if (result.shipment) {
      expect(result.shipment.products.some((item) => item.productId === product.id)).toBe(true);
    }
  });

  it("hides draft products like the real public endpoint", () => {
    const dataset = buildDataset();
    const draft = getDemoProducts(dataset).find((item) => item.status !== "published");
    expect(draft).toBeDefined();
    expect(resolveDemoPassport(dataset, draft!.id).product).toBeNull();
    expect(resolveDemoPassport(dataset, "no-such-product").product).toBeNull();
  });

  it("round-trips a compact compressed snapshot without internal carbon results", async () => {
    const product = getDemoProducts(buildDataset())[0];
    const encoded = await encodePublicPassportSnapshot(product);
    expect(encoded).toBeTruthy();
    expect(encoded!.startsWith("z")).toBe(true);
    expect(encoded!.length).toBeLessThan(700);

    const decoded = (await decodePublicPassportSnapshot(encoded)) as Record<string, unknown>;
    expect(decoded.id).toBe(product.id);
    expect(decoded.productName).toBe(product.productName);
    expect(decoded).not.toHaveProperty("carbonResults");
  });
});
