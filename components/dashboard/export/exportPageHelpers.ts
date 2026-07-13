import { isApiError } from "@/lib/apiClient";
import type { ComplianceDocumentGroup } from "@/lib/complianceDocumentGroups";
import type { DocumentStatus, MarketCode } from "./types";

export interface SummaryDocument {
  id: string;
  documentId: string;
  market: MarketCode;
  marketName: string;
  name: string;
  status: DocumentStatus;
  group: ComplianceDocumentGroup;
  expires: string | null;
  downloadUrl?: string;
}

export interface UploadTarget {
  key: string;
  market: MarketCode;
  marketName: string;
  documentId: string;
  documentName: string;
  required: boolean;
  status: DocumentStatus;
  group: ComplianceDocumentGroup;
}

export type UploadMarketFilter = "ALL" | MarketCode;
export type UploadModalMode = "create" | "edit";
export interface UploadFormDocumentOption {
  id: string;
  name: string;
}

export const getUploadTargetKey = (market: MarketCode, documentId: string) => `${market}::${documentId}`;
export const PRICING_MODAL_OPEN_EVENT = "weavecarbon:open-pricing-modal";
export const DOCUMENT_GROUPS: ComplianceDocumentGroup[] = ["export_compliance", "material_certification"];
export const DEFAULT_GROUP_SEARCH: Record<ComplianceDocumentGroup, string> = {
  export_compliance: "",
  material_certification: ""
};
export const DEFAULT_GROUP_MARKET_FILTER: Record<ComplianceDocumentGroup, UploadMarketFilter> = {
  export_compliance: "ALL",
  material_certification: "ALL"
};

export const getReadinessColor = (score: number): string => {
  if (score >= 80) {
    return "bg-green-50 text-green-700 border border-green-200";
  }
  if (score >= 50) {
    return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  }
  return "bg-red-50 text-red-700 border border-red-200";
};

export const getMarketTone = (score: number) => {
  if (score >= 80) {
    return {
      cardClassName: "border-slate-200 bg-white",
      iconClassName: "bg-emerald-100 text-emerald-700",
      barClassName: "bg-emerald-500",
      statClassName: "border-slate-200 bg-slate-50"
    };
  }
  if (score >= 50) {
    return {
      cardClassName: "border-slate-200 bg-white",
      iconClassName: "bg-amber-100 text-amber-700",
      barClassName: "bg-amber-500",
      statClassName: "border-slate-200 bg-slate-50"
    };
  }
  return {
    cardClassName: "border-slate-200 bg-white",
    iconClassName: "bg-rose-100 text-rose-700",
    barClassName: "bg-rose-500",
    statClassName: "border-slate-200 bg-slate-50"
  };
};

export const DOCUMENT_GROUP_THEME: Record<
  ComplianceDocumentGroup,
  {
    sectionClassName: string;
    statCardClassName: string;
    iconWrapClassName: string;
  }
> = {
  export_compliance: {
    sectionClassName: "border-slate-200 bg-white",
    statCardClassName: "border-slate-200 bg-slate-50",
    iconWrapClassName: "bg-emerald-100 text-emerald-700"
  },
  material_certification: {
    sectionClassName: "border-slate-200 bg-white",
    statCardClassName: "border-slate-200 bg-slate-50",
    iconWrapClassName: "bg-amber-100 text-amber-700"
  }
};

export const getManagerDocumentTone = (status: DocumentStatus) => {
  if (status === "approved") {
    return "border-slate-200 bg-white";
  }
  if (status === "uploaded") {
    return "border-slate-200 bg-white";
  }
  if (status === "expired") {
    return "border-slate-200 bg-white";
  }
  return "border-slate-200 bg-white";
};

export const isPlanRestrictionError = (error: unknown) => {
  if (!isApiError(error) || error.status !== 403) return false;

  const normalizedCode = String(error.code || "").trim().toLowerCase();
  const normalizedMessage = String(error.message || "").trim().toLowerCase();

  if (normalizedCode.includes("plan") || normalizedCode.includes("subscription")) {
    return true;
  }

  return (
    normalizedMessage.includes("standard plan") ||
    normalizedMessage.includes("upgrade") ||
    normalizedMessage.includes("export and reports")
  );
};

export const isPdfFile = (file: File) => {
  const mimeType = String(file.type || "").toLowerCase();
  const fileName = String(file.name || "").toLowerCase();
  return mimeType === "application/pdf" || fileName.endsWith(".pdf");
};

export const getDocumentStatusMeta = (status: DocumentStatus) => {
  if (status === "approved") {
    return {
      label: "Đã duyệt",
      className: "border border-green-200 bg-green-50 text-green-700"
    };
  }
  if (status === "uploaded") {
    return {
      label: "Mới upload",
      className: "border border-blue-200 bg-blue-50 text-blue-700"
    };
  }
  if (status === "expired") {
    return {
      label: "Hết hạn",
      className: "border border-orange-200 bg-orange-50 text-orange-700"
    };
  }
  return {
    label: "Chưa có",
    className: "border border-slate-200 bg-slate-100 text-slate-700"
  };
};
