import { resolveComplianceDocumentGroup } from "@/lib/complianceDocumentGroups";
import type { ComplianceDocument, DocumentStatus, MarketCompliance } from "./types";

const normalizeDocumentKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

export const isCompletedComplianceDocumentStatus = (status: DocumentStatus) =>
  status === "approved";

const isCompletedComplianceDocument = (document: ComplianceDocument) => {
  if (!isCompletedComplianceDocumentStatus(document.status)) return false;
  if (!document.validTo) return true;
  const validTo = new Date(`${document.validTo}T23:59:59.999Z`);
  return !Number.isNaN(validTo.getTime()) && validTo.getTime() >= Date.now();
};

export const summarizeRequiredExportDocuments = (
  exportDocuments: ComplianceDocument[],
  requiredDocumentNames: string[] = [],
  requiredDocumentsCount = 0,
  requiredDocumentsUploadedCount = 0
) => {
  const requiredDocsFromDocuments = exportDocuments.filter((document) => document.required);
  if (requiredDocsFromDocuments.length > 0) {
    const completedRequiredCount = requiredDocsFromDocuments.filter(isCompletedComplianceDocument).length;
    return {
      total: requiredDocsFromDocuments.length,
      uploaded: completedRequiredCount,
      missing: Math.max(0, requiredDocsFromDocuments.length - completedRequiredCount)
    };
  }

  const requiredNameKeySet = new Set(requiredDocumentNames.map(normalizeDocumentKey).filter(Boolean));
  const requiredTotal = Math.max(requiredDocumentsCount, requiredNameKeySet.size);
  const completedRequiredCount =
    requiredNameKeySet.size > 0
      ? exportDocuments.filter((document) => {
          if (!isCompletedComplianceDocument(document)) return false;
          const keys = [document.id, document.name, document.type]
            .map(normalizeDocumentKey)
            .filter(Boolean);
          return keys.some((key) => requiredNameKeySet.has(key));
        }).length
      : requiredDocumentsUploadedCount;

  const uploaded = Math.min(completedRequiredCount, requiredTotal);
  return {
    total: requiredTotal,
    uploaded,
    missing: Math.max(0, requiredTotal - uploaded)
  };
};

export const computeRequiredDocumentReadinessFromExportDocuments = (
  exportDocuments: ComplianceDocument[],
  requiredDocumentNames: string[] = [],
  requiredDocumentsCount = 0
) => {
  const requiredSummary = summarizeRequiredExportDocuments(
    exportDocuments,
    requiredDocumentNames,
    requiredDocumentsCount
  );
  const requiredTotal = requiredSummary.total;
  if (requiredTotal <= 0) {
    return 100;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((requiredSummary.uploaded / requiredTotal) * 100))
  );
};

export const extractExportComplianceDocuments = (documents: ComplianceDocument[]) =>
  documents.filter((document) => resolveComplianceDocumentGroup(document) === "export_compliance");

export const computeMarketDocumentReadinessScore = (marketData: MarketCompliance) => {
  const exportDocuments = extractExportComplianceDocuments(marketData.documents);
  return computeRequiredDocumentReadinessFromExportDocuments(
    exportDocuments,
    marketData.requiredDocuments,
    marketData.requiredDocumentsCount
  );
};
