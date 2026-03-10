import { MATERIAL_CERTIFICATION_ALL_DOCUMENT_CODES } from "@/lib/materialCertificationDefinitions";

export interface ComplianceDocumentLike {
  id?: string | null;
  code?: string | null;
  type?: string | null;
}

export type ComplianceDocumentGroup = "export_compliance" | "material_certification";

export const MATERIAL_CERTIFICATION_DOCUMENT_CODES =
  MATERIAL_CERTIFICATION_ALL_DOCUMENT_CODES;

const normalizeToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeLooseToken = (value: string | null | undefined) =>
  normalizeToken(value).replace(/_/g, "");

const MATERIAL_CERTIFICATION_CODE_SET = new Set<string>([
  ...MATERIAL_CERTIFICATION_DOCUMENT_CODES,
  ...MATERIAL_CERTIFICATION_DOCUMENT_CODES.map((code) => code.replace(/^cert_/, ""))
]);

const MATERIAL_CERTIFICATION_CODE_LOOSE_SET = new Set<string>(
  Array.from(MATERIAL_CERTIFICATION_CODE_SET).map((code) => normalizeLooseToken(code))
);

const MATERIAL_CERTIFICATION_TYPE_HINTS = new Set<string>([
  "material_certification",
  "material_certificate",
  "material_compliance",
  "material_cert",
  "certificate_material",
  "certification_material",
  "material_group_certification",
  "material_certification_group"
]);

const isMaterialCertificationType = (value: string | null | undefined) => {
  const normalizedType = normalizeToken(value);
  if (!normalizedType) return false;
  if (MATERIAL_CERTIFICATION_TYPE_HINTS.has(normalizedType)) return true;

  const looseType = normalizeLooseToken(normalizedType);
  if (!looseType.includes("material")) return false;
  return looseType.includes("cert") || looseType.includes("certificate");
};

export const isMaterialCertificationDocumentCode = (value: string | null | undefined) => {
  const normalizedCode = normalizeToken(value);
  if (MATERIAL_CERTIFICATION_CODE_SET.has(normalizedCode)) {
    return true;
  }

  const looseCode = normalizeLooseToken(normalizedCode);
  return MATERIAL_CERTIFICATION_CODE_LOOSE_SET.has(looseCode);
};

export const isMaterialCertificationDocument = (document: ComplianceDocumentLike) => {
  if (isMaterialCertificationDocumentCode(document.code)) {
    return true;
  }
  if (isMaterialCertificationDocumentCode(document.id)) {
    return true;
  }
  return isMaterialCertificationType(document.type);
};

export const resolveComplianceDocumentGroup = (
  document: ComplianceDocumentLike
): ComplianceDocumentGroup =>
  isMaterialCertificationDocument(document) ? "material_certification" : "export_compliance";

export const filterMaterialCertificationDocuments = <T extends ComplianceDocumentLike>(
  documents: T[]
) => documents.filter((document) => isMaterialCertificationDocument(document));

export const filterExportComplianceDocuments = <T extends ComplianceDocumentLike>(
  documents: T[]
) => documents.filter((document) => !isMaterialCertificationDocument(document));

export const splitComplianceDocumentsByGroup = <T extends ComplianceDocumentLike>(
  documents: T[]
) => ({
  exportComplianceDocuments: filterExportComplianceDocuments(documents),
  materialCertificationDocuments: filterMaterialCertificationDocuments(documents)
});
