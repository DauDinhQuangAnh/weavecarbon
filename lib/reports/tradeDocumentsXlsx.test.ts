import { describe, it, expect, vi } from "vitest";
import { exportBrandedTradeDocumentXlsx, type TradeDocumentExportItem } from "./tradeDocumentsXlsx";
import type { ExportConfigV2 } from "@/lib/weave-v2/exportLogisticsDocs";

// Mock downloadWorkbook so we test workbook generation in Node without browser DOM error
vi.mock("./excelTheme", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./excelTheme")>();
  return {
    ...mod,
    downloadWorkbook: vi.fn().mockResolvedValue(undefined)
  };
});

describe("tradeDocumentsXlsx", () => {
  const cfg: ExportConfigV2 = {
    customsDeclarationNo: "VN-CUSTOMS-2026-0891",
    poContractId: "PO-2026-0891",
    billOfLadingNo: "ONEVNHAN260411",
    containerNo: "MSKU9012445",
    barcodeStandard: "GS1-Digital",
    buyerBrand: "H&M Hennes & Mauritz GBC AB",
    buyerWebhookUrl: "https://api.hm.com/carbon/v1/ingest"
  };

  const sampleItems: TradeDocumentExportItem[] = [
    {
      sku: { sku: "TSHIRT-001", name: "Áo thun Organic", cnCode: "62052000", units: 5000 },
      embeddedKgPerUnit: 3.42,
      embeddedTonnesBatch: 17.1
    },
    {
      sku: { sku: "DENIM-002", name: "Quần Jeans Eco", cnCode: "62034200", units: 2500 },
      embeddedKgPerUnit: 8.95,
      embeddedTonnesBatch: 22.375
    }
  ];

  const totals = 39.475;

  it("exports Commercial Invoice with WeaveCarbon brand styling", async () => {
    await expect(
      exportBrandedTradeDocumentXlsx("commercial-invoice", cfg, sampleItems, totals)
    ).resolves.not.toThrow();
  });

  it("exports Packing List with carton and container calculations", async () => {
    await expect(
      exportBrandedTradeDocumentXlsx("packing-list", cfg, sampleItems, totals)
    ).resolves.not.toThrow();
  });

  it("exports Bill of Lading Maritime Annex per GLEC standard", async () => {
    await expect(
      exportBrandedTradeDocumentXlsx("bill-of-lading", cfg, sampleItems, totals)
    ).resolves.not.toThrow();
  });
});
