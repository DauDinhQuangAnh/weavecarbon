import { DEMO_PACK_V2, type DemoSkuV2 } from "./demoPackV2";
import { computeSkuCarbonV2 } from "./reportBuilder";

export interface ExportConfigV2 {
  customsDeclarationNo: string;
  poContractId: string;
  billOfLadingNo: string;
  containerNo: string;
  barcodeStandard: "GS1-Digital" | "GS1-128" | "EAN-13";
  buyerBrand: string;
  buyerWebhookUrl: string;
}

export interface DppPayloadV2 {
  sku: string;
  gtin: string;
  productName: string;
  cnCode: string;
  embeddedKgPerUnit: number;
  embeddedTonnesBatch: number;
  fiberComposition: { name: string; ratio: number }[];
  supplyGapPenaltyRatio: number;
  evidenceHashes: { kind: string; sha256: string }[];
  customsDeclarationNo: string;
  poContractId: string;
  billOfLadingNo: string;
  containerNo: string;
  issuedAt: string;
  payloadSha256: string;
  decentralizedUrl: string;
}

export const DEFAULT_EXPORT_CONFIG_V2: ExportConfigV2 = {
  customsDeclarationNo: "106429381040",
  poContractId: "PO-2026-TXT-099",
  billOfLadingNo: "ONEVNHAN260411",
  containerNo: "ONEU1234567",
  barcodeStandard: "GS1-Digital",
  buyerBrand: "H&M Group",
  buyerWebhookUrl: "https://api.hm-group.com/sustainability/v1/ingest"
};

const sha256 = async (input: string) => {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const fakeGtin = (sku: string) => `0894001${sku.replace(/\D/g, "").padStart(6, "0").slice(0, 6)}07`;

export const getAllCarbonBreakdownsV2 = (skus: DemoSkuV2[] = DEMO_PACK_V2) =>
  skus.map((sku) => {
    const computed = computeSkuCarbonV2(sku);
    return {
      sku,
      materialKgPerUnit: computed.materials,
      energyKgPerUnit: computed.energy,
      transportKgPerUnit: computed.transport,
      embeddedKgPerUnit: computed.total,
      embeddedTonnesBatch: computed.batchTonnes
    };
  });

export const buildDppPayloadV2 = async (
  sku: DemoSkuV2,
  cfg: ExportConfigV2 = DEFAULT_EXPORT_CONFIG_V2
): Promise<DppPayloadV2> => {
  const computed = computeSkuCarbonV2(sku);
  const materialTotal = sku.materials.reduce((sum, item) => sum + item.kgPerUnit, 0) || 1;
  const gtin = fakeGtin(sku.sku);
  const unsigned = {
    sku: sku.sku,
    gtin,
    productName: sku.name,
    cnCode: sku.cnCode,
    embeddedKgPerUnit: Number(computed.total.toFixed(4)),
    embeddedTonnesBatch: Number(computed.batchTonnes.toFixed(4)),
    fiberComposition: sku.materials.map((item) => ({
      name: item.name,
      ratio: Number(((item.kgPerUnit / materialTotal) * 100).toFixed(1))
    })),
    supplyGapPenaltyRatio: Number(
      (sku.materials.filter((item) => item.isDefault).reduce((sum, item) => sum + item.kgPerUnit, 0) / materialTotal).toFixed(4)
    ),
    evidenceHashes: sku.evidence.map((item) => ({ kind: item.kind, sha256: item.sha256 })),
    customsDeclarationNo: cfg.customsDeclarationNo,
    poContractId: cfg.poContractId,
    billOfLadingNo: cfg.billOfLadingNo,
    containerNo: cfg.containerNo,
    issuedAt: new Date().toISOString()
  };
  const payloadSha256 = await sha256(JSON.stringify(unsigned));
  return {
    ...unsigned,
    payloadSha256,
    decentralizedUrl: `https://dpp.weavecarbon.local/01/${gtin}?sku=${encodeURIComponent(sku.sku)}&hash=${payloadSha256.slice(0, 16)}`
  };
};
