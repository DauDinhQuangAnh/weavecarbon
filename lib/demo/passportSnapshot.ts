// Encodes a compact, self-contained product snapshot into the demo passport QR
// link so a scanned QR resolves the product on ANY device — even one whose local
// demo dataset never contained it (e.g. a product created on another browser).
//
// Demo data lives only in each browser's localStorage, so a QR that merely carried
// the product id showed "product not found" when scanned on a phone. Carrying a
// trimmed snapshot in the URL (`?p=<base64url>`) removes that cross-device gap
// without needing a backend. Only the fields the passport summary renders are
// included, keeping the payload small enough for a reliably scannable QR (~1.2KB
// JSON → ~1.6KB base64url, well within a level-M QR's ~2.3KB byte capacity).

import type { ProductRecord } from "@/lib/productsApi";

export const PRODUCT_SNAPSHOT_PARAM = "p";

// Skip embedding rather than emit a QR too dense to scan. Level-M byte capacity is
// ~2331 bytes; leave headroom.
const MAX_ENCODED_LENGTH = 2300;

const toBase64Url = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (input: string): string => {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const pick = (obj: unknown, keys: string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (!obj || typeof obj !== "object") return out;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  return out;
};

// Only the fields SummaryClient reads to render the passport. Heavy nested payloads
// (factorSourceSummary, dataQualityBreakdown, geometry, accessories…) are dropped
// to keep the QR scannable; the summary view degrades gracefully without them.
const buildSnapshot = (product: ProductRecord): Record<string, unknown> => {
  const carbon = product.carbonResults;
  return {
    id: product.id,
    productCode: product.productCode,
    productName: product.productName,
    productType: product.productType,
    status: product.status,
    weightPerUnit: product.weightPerUnit,
    quantity: product.quantity,
    materials: (product.materials || []).map((material) =>
      pick(material, ["materialType", "percentage", "source", "certifications", "catalogMaterialId"])
    ),
    productionProcesses: product.productionProcesses,
    energySources: (product.energySources || []).map((energy) =>
      pick(energy, ["source", "percentage"])
    ),
    manufacturingLocation: product.manufacturingLocation,
    wasteRecovery: product.wasteRecovery,
    destinationMarket: product.destinationMarket,
    originAddress: pick(product.originAddress, ["country", "city"]),
    transportLegs: (product.transportLegs || []).map((leg) =>
      pick(leg, ["mode", "estimatedDistance", "emissionFactor", "co2Kg"])
    ),
    estimatedTotalDistance: product.estimatedTotalDistance,
    carbonResults: carbon
      ? {
          perProduct: carbon.perProduct,
          totalBatch: carbon.totalBatch,
          confidenceLevel: carbon.confidenceLevel,
          confidenceScore: carbon.confidenceScore,
          proxyUsed: carbon.proxyUsed,
          proxyNotes: carbon.proxyNotes,
        }
      : undefined,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

export const encodeProductSnapshot = (
  product: ProductRecord | null | undefined
): string | null => {
  if (!product || typeof btoa === "undefined") return null;
  try {
    const encoded = toBase64Url(JSON.stringify(buildSnapshot(product)));
    if (encoded.length > MAX_ENCODED_LENGTH) return null;
    return encoded;
  } catch {
    return null;
  }
};

export const decodeProductSnapshot = (
  encoded: string | null | undefined
): unknown | null => {
  if (!encoded || typeof atob === "undefined") return null;
  try {
    const parsed = JSON.parse(fromBase64Url(encoded));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};
