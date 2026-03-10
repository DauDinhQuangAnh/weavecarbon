import {
  MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE,
  MATERIAL_CERTIFICATION_VALUE_BY_DOCUMENT_CODE,
  normalizeMaterialCertificationDocumentCode
} from "@/lib/materialCertificationDefinitions";

export const CERTIFICATION_DOCUMENT_CODE_BY_VALUE =
  MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE;

export const CERTIFICATION_VALUE_BY_DOCUMENT_CODE =
  MATERIAL_CERTIFICATION_VALUE_BY_DOCUMENT_CODE;

export const CERTIFICATION_READY_DOCUMENT_STATUSES = new Set([
  "uploaded",
  "approved"
]);

export const normalizeCertificationDocumentCode = (
  code: string | null | undefined
) => normalizeMaterialCertificationDocumentCode(code);
