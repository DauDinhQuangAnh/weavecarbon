"use client";

import type { DemoDataset } from "@/lib/demo/schema";
import { DEMO_MAX_FILE_BYTES } from "@/lib/demo/constants";
import type {
  CarbonDataItem,
  MarketCode,
  MarketCompliance,
  ProductScopeItem,
  Recommendation,
} from "@/components/dashboard/export/types";
import {
  MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE,
  MATERIAL_CERTIFICATION_LABEL_BY_VALUE,
  MATERIAL_CERTIFICATION_VALUE_BY_DOCUMENT_CODE,
  normalizeMaterialCertificationDocumentCode,
} from "@/lib/materialCertificationDefinitions";

const nowIso = () => new Date().toISOString();
const nowDate = () => new Date().toISOString().slice(0, 10);
const oneYearFromNowDate = () =>
  new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const DEMO_PLACEHOLDER_PDF_PATH = "/demo-assets/documents/demo-placeholder.pdf?v=20260304-2140";

const asMarket = (value: unknown) => value as MarketCompliance;
const asMarkets = (value: DemoDataset["exportCompliance"]) =>
  value as unknown as Record<MarketCode, MarketCompliance>;

const normalizeToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const DESTINATION_MARKET_TO_COMPLIANCE_CODE: Record<string, MarketCode> = {
  vietnam: "VN",
  vn: "VN",
  domestic: "VN",
  usa: "US",
  us: "US",
  america: "US",
  korea: "KR",
  kr: "KR",
  japan: "JP",
  jp: "JP",
  eu: "EU",
  europe: "EU",
  china: "CN",
  cn: "CN",
  australia: "AU",
  au: "AU",
  asean: "ASEAN",
  thailand: "TH",
  th: "TH",
  singapore: "SG",
  sg: "SG",
  malaysia: "MY",
  my: "MY",
  indonesia: "ID",
  id: "ID",
  philippines: "PH",
  ph: "PH",
  canada: "CA",
  ca: "CA",
  uk: "UK",
  united_kingdom: "UK",
  india: "IN",
  in: "IN",
};

const PRODUCT_TYPE_TO_HS_CODE: Record<string, string> = {
  tshirt: "610910",
  polo: "610510",
  shirt: "620520",
  pants: "620342",
  shorts: "620343",
  dress: "620443",
  jacket: "620240",
  sweater: "611030",
  shoes: "640419",
  sandals: "640299",
  bag: "420292",
  accessories: "621710",
  other: "620000",
};

const uniqueStringArray = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
};

const resolveComplianceMarketCode = (destinationMarket: string | null | undefined) =>
  DESTINATION_MARKET_TO_COMPLIANCE_CODE[normalizeToken(destinationMarket)] || null;

const toProductHsCode = (productType: string | null | undefined) =>
  PRODUCT_TYPE_TO_HS_CODE[normalizeToken(productType)] || PRODUCT_TYPE_TO_HS_CODE.other;

const getCertificationLabelFromCode = (documentCode: string) => {
  const certificationValue =
    MATERIAL_CERTIFICATION_VALUE_BY_DOCUMENT_CODE[
      normalizeMaterialCertificationDocumentCode(documentCode)
    ];
  return certificationValue ?
      MATERIAL_CERTIFICATION_LABEL_BY_VALUE[certificationValue] || certificationValue :
      documentCode;
};

const matchesCertificationDocumentCode = (
  document: Pick<MarketCompliance["documents"][number], "id" | "code" | "name">,
  documentCode: string
) => {
  const normalizedExpected = normalizeMaterialCertificationDocumentCode(documentCode);
  const shortExpected = normalizedExpected.replace(/^cert_/, "");

  return [document.code, document.id, document.name]
    .map((value) => normalizeToken(value))
    .some(
      (candidate) =>
        Boolean(candidate) &&
        (
          candidate === normalizedExpected ||
          candidate === shortExpected ||
          candidate.startsWith(`${normalizedExpected}_`) ||
          candidate.startsWith(`${shortExpected}_`) ||
          candidate.includes(shortExpected)
        )
    );
};

const applyDemoPlaceholderToDocument = (
  document: MarketCompliance["documents"][number],
  uploadedBy: string,
  linkedProductId?: string,
  nextCode?: string
) => ({
  ...document,
  code: nextCode || document.code,
  status: "approved" as const,
  downloadUrl: DEMO_PLACEHOLDER_PDF_PATH,
  uploadedBy,
  uploadedDate: nowIso(),
  validFrom: document.validFrom || nowDate(),
  validTo: document.validTo || oneYearFromNowDate(),
  linkedProducts:
    linkedProductId ?
      uniqueStringArray([...(document.linkedProducts || []), linkedProductId]) :
      document.linkedProducts,
});

const completeSatisfiedRecommendations = (
  recommendations: Recommendation[],
  satisfiedDocumentIds: Set<string>
) =>
  recommendations.map((recommendation) =>
    recommendation.relatedDocumentId &&
    satisfiedDocumentIds.has(String(recommendation.relatedDocumentId))
      ? {
          ...recommendation,
          status: "completed" as const,
        }
      : recommendation
  );

const ensureRequiredExportDocumentsReady = (
  documents: MarketCompliance["documents"],
  uploadedBy: string,
  linkedProductId?: string
) => {
  const satisfiedDocumentIds = new Set<string>();
  const nextDocuments = documents.map((document) => {
    if (!document.required || document.type === "material_certification") {
      return document;
    }
    satisfiedDocumentIds.add(document.id);
    return applyDemoPlaceholderToDocument(document, uploadedBy, linkedProductId);
  });
  return {
    documents: nextDocuments,
    satisfiedDocumentIds,
  };
};

const ensureMaterialCertificationDocumentsReady = (
  documents: MarketCompliance["documents"],
  uploadedBy: string,
  certificationDocumentCodes: string[],
  linkedProductId?: string
) => {
  if (certificationDocumentCodes.length === 0) {
    return documents;
  }

  const nextDocuments = [...documents];

  for (const documentCode of certificationDocumentCodes) {
    const normalizedCode = normalizeMaterialCertificationDocumentCode(documentCode);
    if (!normalizedCode) continue;

    const existingIndex = nextDocuments.findIndex((document) =>
      matchesCertificationDocumentCode(document, normalizedCode)
    );

    if (existingIndex >= 0) {
      nextDocuments[existingIndex] = applyDemoPlaceholderToDocument(
        nextDocuments[existingIndex],
        uploadedBy,
        linkedProductId,
        normalizedCode
      );
      continue;
    }

    nextDocuments.push({
      id: normalizedCode,
      code: normalizedCode,
      name: getCertificationLabelFromCode(normalizedCode),
      type: "material_certification",
      required: false,
      status: "approved",
      downloadUrl: DEMO_PLACEHOLDER_PDF_PATH,
      uploadedBy,
      uploadedDate: nowIso(),
      validFrom: nowDate(),
      validTo: oneYearFromNowDate(),
      linkedProducts: linkedProductId ? [linkedProductId] : [],
    });
  }

  return nextDocuments;
};

const ensureProductScopeEntry = (
  productScope: ProductScopeItem[],
  input: {
    productId: string;
    productName: string;
    productType: string;
    manufacturingLocation: string;
    quantity: number;
  }
) => {
  const nextEntry: ProductScopeItem = {
    productId: input.productId,
    productName: input.productName,
    hsCode: toProductHsCode(input.productType),
    productionSite: input.manufacturingLocation || "Demo Factory",
    exportVolume: Math.max(1, Math.trunc(input.quantity || 1)),
    unit: "pcs",
  };

  return productScope.some((item) => item.productId === input.productId) ?
      productScope.map((item) => (item.productId === input.productId ? nextEntry : item)) :
      [...productScope, nextEntry];
};

export const syncDemoComplianceForPublishedProduct = (
  dataset: DemoDataset,
  input: {
    productId: string;
    productName: string;
    productType: string;
    quantity: number;
    manufacturingLocation: string;
    destinationMarket: string;
    materials: Array<{ certifications?: string[] }>;
  }
) => {
  const marketCode = resolveComplianceMarketCode(input.destinationMarket);
  if (!marketCode) {
    return;
  }

  const certificationDocumentCodes = uniqueStringArray(
    input.materials.flatMap((material) =>
      (material.certifications || []).map(
        (value) => MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE[String(value || "").trim()] || ""
      )
    )
  ).map((value) => normalizeMaterialCertificationDocumentCode(value)).filter(Boolean);

  updateMarket(dataset, marketCode, (market) => {
    const uploadedBy = dataset.user.full_name;
    const exportResult = ensureRequiredExportDocumentsReady(
      market.documents,
      uploadedBy,
      input.productId
    );
    const nextDocuments = ensureMaterialCertificationDocumentsReady(
      exportResult.documents,
      uploadedBy,
      certificationDocumentCodes,
      input.productId
    );

    return {
      ...market,
      documents: nextDocuments,
      productScope: ensureProductScopeEntry(market.productScope, {
        productId: input.productId,
        productName: input.productName,
        productType: input.productType,
        manufacturingLocation: input.manufacturingLocation,
        quantity: input.quantity,
      }),
      recommendations: completeSatisfiedRecommendations(
        market.recommendations,
        exportResult.satisfiedDocumentIds
      ),
      verificationStatus: "verified",
      verifiedBy: uploadedBy,
      approvalNote: "Demo placeholder documents were generated automatically.",
    };
  });
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const getMarket = (dataset: DemoDataset, marketCode: MarketCode) => {
  const market = asMarket(dataset.exportCompliance[marketCode]);
  if (!market) {
    throw new Error("Market compliance data not found.");
  }
  return market;
};

const recalculateMarket = (market: MarketCompliance): MarketCompliance => {
  const requiredDocuments = market.documents.filter(
    (document) => document.required && document.type !== "material_certification"
  );
  const requiredDocumentsUploadedCount = requiredDocuments.filter((document) =>
    ["uploaded", "approved"].includes(document.status)
  ).length;
  const documentsUploadedCount = market.documents.filter((document) =>
    ["uploaded", "approved"].includes(document.status)
  ).length;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (requiredDocuments.length > 0
          ? (requiredDocumentsUploadedCount / requiredDocuments.length) * 72
          : 40) +
          (market.documents.length > 0
            ? (documentsUploadedCount / market.documents.length) * 28
            : 0)
      )
    )
  );
  const status =
    score >= 90 ? "verified" : score >= 70 ? "ready" : score >= 45 ? "incomplete" : "draft";

  return {
    ...market,
    score,
    status,
    lastUpdated: nowIso(),
    requiredDocuments: requiredDocuments.map((document) => document.id),
    requiredDocumentsCount: requiredDocuments.length,
    requiredDocumentsUploadedCount,
    requiredDocumentsMissingCount: Math.max(0, requiredDocuments.length - requiredDocumentsUploadedCount),
    documentsTotalCount: market.documents.length,
    documentsUploadedCount,
    documentsMissingCount: Math.max(0, market.documents.length - documentsUploadedCount),
  };
};

const updateMarket = (
  dataset: DemoDataset,
  marketCode: MarketCode,
  mutate: (market: MarketCompliance) => MarketCompliance
) => {
  const current = getMarket(dataset, marketCode);
  asMarkets(dataset.exportCompliance)[marketCode] = recalculateMarket(mutate(current));
  return getMarket(dataset, marketCode);
};

const normalizeRecommendationStatus = (value: string): Recommendation["status"] => {
  if (value === "completed" || value === "ignored") {
    return value;
  }
  return "active";
};

export const getDemoComplianceMarkets = (dataset: DemoDataset) =>
  asMarkets(dataset.exportCompliance);

export const uploadDemoComplianceDocument = async (
  dataset: DemoDataset,
  marketCode: MarketCode,
  documentId: string,
  file: File
) => {
  if (file.size > DEMO_MAX_FILE_BYTES) {
    const maxSizeMb = (DEMO_MAX_FILE_BYTES / (1024 * 1024)).toFixed(1);
    throw new Error(`Demo upload supports files up to ${maxSizeMb} MB.`);
  }

  const dataUrl = await readFileAsDataUrl(file);
  updateMarket(dataset, marketCode, (market) => ({
    ...market,
    documents: market.documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            status: "uploaded",
            downloadUrl: dataUrl,
            uploadedBy: dataset.user.full_name,
            uploadedDate: nowIso(),
            validFrom: new Date().toISOString().slice(0, 10),
          }
        : document
    ),
  }));
};

export const approveDemoComplianceDocument = (
  dataset: DemoDataset,
  marketCode: MarketCode,
  documentId: string
) => {
  updateMarket(dataset, marketCode, (market) => ({
    ...market,
    documents: market.documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            status: "approved",
            uploadedBy: document.uploadedBy || dataset.user.full_name,
            uploadedDate: document.uploadedDate || nowIso(),
            validFrom: document.validFrom || new Date().toISOString().slice(0, 10),
            validTo:
              document.validTo ||
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          }
        : document
    ),
    verificationStatus: "verified",
    verifiedBy: dataset.user.full_name,
  }));
};

export const removeDemoComplianceDocument = (
  dataset: DemoDataset,
  marketCode: MarketCode,
  documentId: string
) => {
  updateMarket(dataset, marketCode, (market) => ({
    ...market,
    documents: market.documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            status: "missing",
            downloadUrl: undefined,
            uploadedBy: undefined,
            uploadedDate: undefined,
            validFrom: undefined,
            validTo: undefined,
          }
        : document
    ),
  }));
};

export const upsertDemoComplianceProduct = (
  dataset: DemoDataset,
  marketCode: MarketCode,
  input: {
    productId?: string;
    productName: string;
    hsCode: string;
    productionSite: string;
    exportVolume: number;
    unit: string;
  }
) => {
  updateMarket(dataset, marketCode, (market) => {
    const nextItem: ProductScopeItem = {
      productId: input.productId || createId(),
      productName: input.productName,
      hsCode: input.hsCode,
      productionSite: input.productionSite,
      exportVolume: input.exportVolume,
      unit: input.unit,
    };
    const items = input.productId
      ? market.productScope.map((item) => (item.productId === input.productId ? nextItem : item))
      : [...market.productScope, nextItem];
    return {
      ...market,
      productScope: items,
    };
  });
};

export const removeDemoComplianceProduct = (
  dataset: DemoDataset,
  marketCode: MarketCode,
  productId: string
) => {
  updateMarket(dataset, marketCode, (market) => ({
    ...market,
    productScope: market.productScope.filter((item) => item.productId !== productId),
    documents: market.documents.map((document) => ({
      ...document,
      linkedProducts: Array.isArray(document.linkedProducts)
        ? document.linkedProducts.filter((id) => id !== productId)
        : document.linkedProducts,
    })),
  }));
};

export const upsertDemoComplianceCarbonData = (
  dataset: DemoDataset,
  marketCode: MarketCode,
  input: CarbonDataItem
) => {
  updateMarket(dataset, marketCode, (market) => {
    const exists = market.carbonData.some((item) => item.scope === input.scope);
    const carbonData = exists
      ? market.carbonData.map((item) => (item.scope === input.scope ? input : item))
      : [...market.carbonData, input];
    return {
      ...market,
      carbonData,
    };
  });
};

export const runDemoComplianceRecommendationAction = (
  dataset: DemoDataset,
  marketCode: MarketCode,
  recommendationId: string,
  action: string
) => {
  updateMarket(dataset, marketCode, (market) => ({
    ...market,
    recommendations: market.recommendations.map((recommendation) =>
      recommendation.id === recommendationId
        ? {
            ...recommendation,
            status: normalizeRecommendationStatus(
              action === "complete" || action === "completed" ? "completed" : recommendation.status
            ),
          }
        : recommendation
    ),
  }));
};

export const createDemoComplianceReport = (
  dataset: DemoDataset,
  marketCode: MarketCode,
  format: "csv" | "xlsx" | "pdf" = "xlsx"
) => {
  const market = updateMarket(dataset, marketCode, (current) => {
    const uploadedBy = dataset.user.full_name;
    const exportResult = ensureRequiredExportDocumentsReady(current.documents, uploadedBy);
    return {
      ...current,
      documents: exportResult.documents,
      recommendations: completeSatisfiedRecommendations(
        current.recommendations,
        exportResult.satisfiedDocumentIds
      ),
      verificationStatus: "verified",
      verifiedBy: uploadedBy,
      approvalNote: "Demo compliance report exported with placeholder documents.",
    };
  });
  void format;

  return {
    reportId: createId(),
    status: "completed",
    title: `${marketCode} Compliance Report ${new Date().getFullYear()}`,
    download_url: DEMO_PLACEHOLDER_PDF_PATH,
    marketName: market.marketName,
  };
};
