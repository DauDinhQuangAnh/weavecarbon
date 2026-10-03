import { describe, expect, it } from "vitest";
import { validateAndTransformData } from "./validation";
import { calculateBulkCarbon, calculateCarbonForProduct } from "./carbonCalculation";
import { TEMPLATE_COLUMNS, buildSampleData } from "./template";
import { validateDemoBulkImport, importDemoBulkRows } from "@/lib/demo/domain/products";
import demoSeed from "@/lib/demo/seed/demo-b2b-standard20.json";
import type { DemoDataset } from "@/lib/demo/schema";
import type { ProductRecord } from "@/lib/productsApi";

describe("Bulk Product Import Validation & Transformation", () => {
  it("has complete template columns with required flags", () => {
    expect(TEMPLATE_COLUMNS.length).toBeGreaterThan(10);
    const requiredKeys = TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.key);
    expect(requiredKeys).toContain("sku");
    expect(requiredKeys).toContain("productName");
    expect(requiredKeys).toContain("productType");
    expect(requiredKeys).toContain("quantity");
    expect(requiredKeys).toContain("weightPerUnit");
    expect(requiredKeys).toContain("primaryMaterial");
    expect(requiredKeys).toContain("primaryMaterialPercentage");
    expect(requiredKeys).toContain("materialSource");
    expect(requiredKeys).toContain("processes");
    expect(requiredKeys).toContain("energySource");
    expect(requiredKeys).toContain("marketType");
  });

  it("validates and transforms raw template sample rows successfully", () => {
    const sampleRows = buildSampleData();
    expect(sampleRows.length).toBeGreaterThan(0);

    const result = validateAndTransformData(sampleRows as unknown as Record<string, unknown>[]);
    expect(result.isValid).toBe(true);
    expect(result.validCount).toBe(sampleRows.length);
    expect(result.errorCount).toBe(0);

    const firstProduct = result.validRows[0];
    expect(firstProduct.sku).toBeDefined();
    expect(firstProduct.productName).toBeDefined();
    expect(firstProduct.quantity).toBeGreaterThan(0);
    expect(firstProduct.weightPerUnit).toBeGreaterThan(0);
    expect(firstProduct.primaryMaterial).toBeDefined();
    expect(firstProduct.processes.length).toBeGreaterThan(0);
  });

  it("catches missing required fields and negative values", () => {
    const invalidRows = [
      {
        sku: "TEST-SKU-001",
        // missing productName
        productType: "tshirt",
        quantity: -50, // invalid quantity
        weightPerUnit: 0, // invalid weight
        primaryMaterial: "cotton",
        primaryMaterialPercentage: 100,
        materialSource: "domestic",
        processes: "cutting_sewing",
        energySource: "grid",
        marketType: "domestic",
      },
    ];

    const result = validateAndTransformData(invalidRows as Record<string, unknown>[]);
    expect(result.isValid).toBe(false);
    expect(result.validCount).toBe(0);
    expect(result.invalidRows.length).toBe(1);

    const errors = result.invalidRows[0].errors;
    expect(errors.some((e) => e.field === "productName")).toBe(true);
    expect(errors.some((e) => e.field === "quantity")).toBe(true);
    expect(errors.some((e) => e.field === "weightPerUnit")).toBe(true);
  });

  it("handles Vietnamese column header aliases properly", () => {
    const vietnameseRow = [
      {
        "Mã SKU": "VN-TEE-001",
        "Tên sản phẩm": "Áo thun cotton Việt Nam",
        "Loại sản phẩm": "Áo thun",
        "Số lượng": "500",
        "Trọng lượng (gram)": "180",
        "Vải chính": "Cotton hữu cơ",
        "Tỷ lệ vải chính": "100",
        "Nguồn nguyên liệu": "Trong nước",
        "Công đoạn sản xuất": "Cắt may, Hoàn tất",
        "Nguồn năng lượng": "Điện lưới",
        "Thị trường": "Trong nước",
      },
    ];

    const result = validateAndTransformData(vietnameseRow as Record<string, unknown>[]);
    expect(result.isValid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.validRows[0].sku).toBe("VN-TEE-001");
    expect(result.validRows[0].productName).toBe("Áo thun cotton Việt Nam");
    expect(result.validRows[0].productType).toBe("tshirt");
    expect(result.validRows[0].quantity).toBe(500);
    expect(result.validRows[0].weightPerUnit).toBe(180);
    expect(result.validRows[0].primaryMaterial).toBe("organic_cotton");
    expect(result.validRows[0].energySource).toBe("grid");
    expect(result.validRows[0].marketType).toBe("domestic");
  });

  it("detects duplicate SKUs within the import file and emits warnings", () => {
    const duplicateRows = [
      {
        sku: "DUPLICATE-SKU-001",
        productName: "Product 1",
        productType: "tshirt",
        quantity: 100,
        weightPerUnit: 200,
        primaryMaterial: "cotton",
        primaryMaterialPercentage: 100,
        materialSource: "domestic",
        processes: "cutting_sewing",
        energySource: "grid",
        marketType: "domestic",
      },
      {
        sku: "DUPLICATE-SKU-001",
        productName: "Product 2",
        productType: "pants",
        quantity: 200,
        weightPerUnit: 300,
        primaryMaterial: "polyester",
        primaryMaterialPercentage: 100,
        materialSource: "domestic",
        processes: "cutting_sewing",
        energySource: "grid",
        marketType: "domestic",
      },
    ];

    const result = validateAndTransformData(duplicateRows as Record<string, unknown>[]);
    expect(result.validCount).toBe(2);
    expect(result.warnings.some((w) => w.field === "sku" && w.message.includes("bị trùng"))).toBe(true);
  });
});

describe("Bulk Carbon Calculation Engine", () => {
  it("calculates emissions and stage breakdown for valid bulk rows", () => {
    const sampleRows = buildSampleData();
    const validation = validateAndTransformData(sampleRows as unknown as Record<string, unknown>[]);
    expect(validation.isValid).toBe(true);

    const calculated = calculateBulkCarbon(validation.validRows);
    expect(calculated.length).toBe(validation.validRows.length);

    calculated.forEach((row) => {
      expect(row.calculatedCO2).toBeGreaterThan(0);
      expect(row.confidenceLevel).toBeDefined();
      expect(row.scope).toBeDefined();

      const detail = calculateCarbonForProduct(row);
      expect(detail.materialsCO2).toBeGreaterThan(0);
      expect(detail.manufacturingCO2).toBeGreaterThan(0);
      expect(detail.totalCO2).toBeGreaterThan(0);
      expect(detail.confidenceScore).toBeGreaterThan(0);
    });
  });
});

describe("Bulk Import Demo Execution", () => {
  it("validates demo bulk import rows successfully", () => {
    const rows = [
      {
        product_code: "DEMO-BULK-01",
        product_name: "Demo Bulk Product 1",
        product_type: "tshirt",
        quantity: 1000,
        weight_per_unit: 200,
      },
    ];

    const validation = validateDemoBulkImport(rows);
    expect(validation.isValid).toBe(true);
    expect(validation.totalRows).toBe(1);
    expect(validation.validCount).toBe(1);
    expect(validation.errorCount).toBe(0);
  });

  it("imports products and updates dataset in demo mode", () => {
    const dataset = JSON.parse(JSON.stringify(demoSeed)) as DemoDataset;
    const initialProductCount = dataset.products.length;

    const rowsToImport = [
      {
        product_code: "NEW-IMPORT-SKU-01",
        product_name: "Newly Imported T-Shirt",
        product_type: "tshirt",
        quantity: 500,
        weight_per_unit: 180,
        destination_market: "vietnam",
      },
      {
        product_code: "NEW-IMPORT-SKU-02",
        product_name: "Newly Imported Jacket",
        product_type: "jacket",
        quantity: 250,
        weight_per_unit: 450,
        destination_market: "eu",
      },
    ];

    const result = importDemoBulkRows(dataset, rowsToImport, "draft");
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.ids.length).toBe(2);
    expect(dataset.products.length).toBe(initialProductCount + 2);

    const importedProducts = dataset.products as unknown as ProductRecord[];
    const importedProduct = importedProducts.find((p) => p.productCode === "NEW-IMPORT-SKU-01");
    expect(importedProduct).toBeDefined();
    expect(importedProduct?.carbonResults?.perProduct?.total).toBeGreaterThan(0);
  });
});
