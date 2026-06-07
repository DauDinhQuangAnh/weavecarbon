"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Upload
} from "lucide-react";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { isApiError, isUnauthorizedApiError } from "@/lib/apiClient";import {
  approveComplianceDocument,
  fetchComplianceMarkets,
  getComplianceDocumentObjectUrl,
  removeComplianceDocument,
  uploadComplianceDocument
} from "@/lib/exportComplianceApi";
import { resolveComplianceDocumentGroup, type ComplianceDocumentGroup } from "@/lib/complianceDocumentGroups";
import { showNoPermissionToast } from "@/lib/noPermissionToast";
import { usePermissions } from "@/hooks/usePermissions";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type { DocumentStatus, MarketCode, MarketCompliance } from "./types";
import { computeMarketDocumentReadinessScore } from "./readiness";
import ComplianceDetailModal from "./ComplianceDetailModal";
import ExportConfigurationPortalV2 from "./ExportConfigurationPortalV2";

interface SummaryDocument {
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

interface UploadTarget {
  key: string;
  market: MarketCode;
  marketName: string;
  documentId: string;
  documentName: string;
  required: boolean;
  status: DocumentStatus;
  group: ComplianceDocumentGroup;
}

type UploadMarketFilter = "ALL" | MarketCode;
type UploadModalMode = "create" | "edit";
interface UploadFormDocumentOption {
  id: string;
  name: string;
}

const getUploadTargetKey = (market: MarketCode, documentId: string) => `${market}::${documentId}`;
const PRICING_MODAL_OPEN_EVENT = "weavecarbon:open-pricing-modal";
const DOCUMENT_GROUPS: ComplianceDocumentGroup[] = ["export_compliance", "material_certification"];
const DEFAULT_GROUP_SEARCH: Record<ComplianceDocumentGroup, string> = {
  export_compliance: "",
  material_certification: ""
};
const DEFAULT_GROUP_MARKET_FILTER: Record<ComplianceDocumentGroup, UploadMarketFilter> = {
  export_compliance: "ALL",
  material_certification: "ALL"
};

const getReadinessColor = (score: number): string => {
  if (score >= 80) {
    return "bg-green-50 text-green-700 border border-green-200";
  }
  if (score >= 50) {
    return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  }
  return "bg-red-50 text-red-700 border border-red-200";
};

const getMarketTone = (score: number) => {
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

const DOCUMENT_GROUP_THEME: Record<
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

const getManagerDocumentTone = (status: DocumentStatus) => {
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

const isPlanRestrictionError = (error: unknown) => {
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

const isPdfFile = (file: File) => {
  const mimeType = String(file.type || "").toLowerCase();
  const fileName = String(file.name || "").toLowerCase();
  return mimeType === "application/pdf" || fileName.endsWith(".pdf");
};

const getDocumentStatusMeta = (status: DocumentStatus) => {
  if (status === "approved") {
    return {
      label: "\u0110\u00e3 duy\u1ec7t",
      className: "border border-green-200 bg-green-50 text-green-700"
    };
  }
  if (status === "uploaded") {
    return {
      label: "M\u1edbi upload",
      className: "border border-blue-200 bg-blue-50 text-blue-700"
    };
  }
  if (status === "expired") {
    return {
      label: "H\u1ebft h\u1ea1n",
      className: "border border-orange-200 bg-orange-50 text-orange-700"
    };
  }
  return {
    label: "Ch\u01b0a c\u00f3",
    className: "border border-slate-200 bg-slate-100 text-slate-700"
  };
};

const ExportPage: React.FC = () => {
  const locale = useLocale();
  const t = useTranslations("export");
  const { setPageTitle } = useDashboardTitle();
  const { canMutate } = usePermissions();
  const { isMobile } = useBreakpoint();

  const [selectedMarket, setSelectedMarket] = useState<MarketCode | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);
  const [complianceData, setComplianceData] = useState<Record<MarketCode, MarketCompliance> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlanRestricted, setIsPlanRestricted] = useState(false);
  const [uploadTargetSearchByGroup, setUploadTargetSearchByGroup] = useState<
    Record<ComplianceDocumentGroup, string>
  >(DEFAULT_GROUP_SEARCH);
  const [uploadMarketFilterByGroup, setUploadMarketFilterByGroup] = useState<
    Record<ComplianceDocumentGroup, UploadMarketFilter>
  >(DEFAULT_GROUP_MARKET_FILTER);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [removingDocumentKey, setRemovingDocumentKey] = useState<string | null>(null);
  const [pendingRemoveDocument, setPendingRemoveDocument] = useState<SummaryDocument | null>(null);
  const [openingDocumentKey, setOpeningDocumentKey] = useState<string | null>(null);
  const [approvingDocumentKey, setApprovingDocumentKey] = useState<string | null>(null);
  const [previewDocumentOpen, setPreviewDocumentOpen] = useState(false);
  const [previewDocumentTitle, setPreviewDocumentTitle] = useState("");
  const [previewDocument, setPreviewDocument] = useState<SummaryDocument | null>(null);
  const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalMode, setUploadModalMode] = useState<UploadModalMode>("create");
  const [activeDocumentGroup, setActiveDocumentGroup] = useState<ComplianceDocumentGroup>(
    "export_compliance"
  );
  const [uploadModalGroup, setUploadModalGroup] = useState<ComplianceDocumentGroup>("export_compliance");
  const [editingDocument, setEditingDocument] = useState<SummaryDocument | null>(null);
  const [uploadFormMarket, setUploadFormMarket] = useState<MarketCode | "">("");
  const [uploadFormDocumentId, setUploadFormDocumentId] = useState("");
  const [uploadFormFile, setUploadFormFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      if (previewDocumentUrl) {
        URL.revokeObjectURL(previewDocumentUrl);
      }
    };
  }, [previewDocumentUrl]);

  useEffect(() => {
    setPageTitle(t("title"), t("subtitle"));
  }, [setPageTitle, t]);

  const loadComplianceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsPlanRestricted(false);
    try {
      const payload = await fetchComplianceMarkets();
      setComplianceData(payload);
    } catch (loadError) {
      if (isUnauthorizedApiError(loadError)) {
        setComplianceData(null);
        setError(null);
        return;
      }

      const planRestricted = isPlanRestrictionError(loadError);
      if (!planRestricted) {
        console.error("Failed to load export compliance data:", loadError);
      }

      setComplianceData(planRestricted ? ({} as Record<MarketCode, MarketCompliance>) : null);
      setIsPlanRestricted(planRestricted);
      setError(loadError instanceof Error ? loadError.message : t("errors.loadComplianceData"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadComplianceData();
  }, [loadComplianceData]);

  const markets = useMemo(
    () => (complianceData ? (Object.keys(complianceData) as MarketCode[]) : []),
    [complianceData]
  );

  const availableMarkets = useMemo(
    () => markets.filter((market) => Boolean(complianceData?.[market])),
    [complianceData, markets]
  );

  const documents = useMemo<SummaryDocument[]>(() => {
    if (!complianceData) return [];
    return availableMarkets.flatMap((market) => {
      const marketItem = complianceData[market];
      return marketItem.documents
        .filter((document) => document.status !== "missing")
        .map((document) => ({
          id: `${market}-${document.id}`,
          documentId: document.id,
          market,
          marketName: marketItem.marketName,
          name: document.name,
          status: document.status,
          group: resolveComplianceDocumentGroup(document),
          expires: document.validTo || null,
          downloadUrl: document.downloadUrl
        }));
    });
  }, [availableMarkets, complianceData]);

  const documentsByGroup = useMemo<Record<ComplianceDocumentGroup, SummaryDocument[]>>(
    () => ({
      export_compliance: documents.filter((document) => document.group === "export_compliance"),
      material_certification: documents.filter((document) => document.group === "material_certification")
    }),
    [documents]
  );

  const filteredDocumentsByGroup = useMemo<Record<ComplianceDocumentGroup, SummaryDocument[]>>(() => {
    const grouped: Record<ComplianceDocumentGroup, SummaryDocument[]> = {
      export_compliance: [],
      material_certification: []
    };

    for (const group of DOCUMENT_GROUPS) {
      const normalizedSearch = (uploadTargetSearchByGroup[group] || "").trim().toLowerCase();
      const marketFilter = uploadMarketFilterByGroup[group] || "ALL";
      grouped[group] = documentsByGroup[group].filter((document) => {
        if (marketFilter !== "ALL" && document.market !== marketFilter) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        const searchableText = `${document.name} ${document.market}`.toLowerCase();
        return searchableText.includes(normalizedSearch);
      });
    }

    return grouped;
  }, [documentsByGroup, uploadMarketFilterByGroup, uploadTargetSearchByGroup]);

  const uploadTargets = useMemo<UploadTarget[]>(() => {
    if (!complianceData) return [];
    return availableMarkets.flatMap((market) => {
      const marketData = complianceData[market];
      return marketData.documents.map((doc) => ({
        key: getUploadTargetKey(market, doc.id),
        market,
        marketName: marketData.marketName,
        documentId: doc.id,
        documentName: doc.name,
        required: doc.required,
        status: doc.status,
        group: resolveComplianceDocumentGroup(doc)
      }));
    });
  }, [availableMarkets, complianceData]);

  const uploadTargetsByGroup = useMemo<Record<ComplianceDocumentGroup, UploadTarget[]>>(
    () => ({
      export_compliance: uploadTargets.filter((target) => target.group === "export_compliance"),
      material_certification: uploadTargets.filter(
        (target) => target.group === "material_certification"
      )
    }),
    [uploadTargets]
  );

  const availableMarketsByGroup = useMemo<Record<ComplianceDocumentGroup, MarketCode[]>>(
    () => ({
      export_compliance: Array.from(
        new Set(uploadTargetsByGroup.export_compliance.map((target) => target.market))
      ),
      material_certification: Array.from(
        new Set(uploadTargetsByGroup.material_certification.map((target) => target.market))
      )
    }),
    [uploadTargetsByGroup]
  );

  const uploadFormAvailableDocuments = useMemo<UploadFormDocumentOption[]>(() => {
    if (!uploadFormMarket) return [];

    const uniqueDocuments = new Map<string, UploadFormDocumentOption>();
    for (const target of uploadTargets) {
      if (target.group !== uploadModalGroup) continue;
      if (target.market !== uploadFormMarket) continue;
      if (uniqueDocuments.has(target.documentId)) continue;
      uniqueDocuments.set(target.documentId, {
        id: target.documentId,
        name: target.documentName
      });
    }

    return Array.from(uniqueDocuments.values());
  }, [uploadFormMarket, uploadModalGroup, uploadTargets]);

  const uploadTargetCountsByGroup = useMemo<
    Record<
      ComplianceDocumentGroup,
      {
        uploadedCount: number;
        uploadedOnlyCount: number;
        approvedCount: number;
        missingCount: number;
        total: number;
      }
    >
  >(() => {
    const buildCounts = (targets: UploadTarget[]) => {
      const total = targets.length;
      const uploadedCount = targets.filter(
        (target) => target.status === "uploaded" || target.status === "approved"
      ).length;
      const uploadedOnlyCount = targets.filter((target) => target.status === "uploaded").length;
      const approvedCount = targets.filter((target) => target.status === "approved").length;
      return {
        total,
        uploadedCount,
        uploadedOnlyCount,
        approvedCount,
        missingCount: Math.max(0, total - uploadedCount)
      };
    };

    return {
      export_compliance: buildCounts(uploadTargetsByGroup.export_compliance),
      material_certification: buildCounts(uploadTargetsByGroup.material_certification)
    };
  }, [uploadTargetsByGroup]);

  useEffect(() => {
    if (!uploadModalOpen) return;
    if (!uploadFormMarket || uploadFormAvailableDocuments.length === 0) {
      if (uploadFormDocumentId) {
        setUploadFormDocumentId("");
      }
      return;
    }

    const hasCurrentSelection = uploadFormAvailableDocuments.some(
      (document) => document.id === uploadFormDocumentId
    );
    if (hasCurrentSelection) return;

    setUploadFormDocumentId(uploadFormAvailableDocuments[0]?.id || "");
  }, [uploadFormAvailableDocuments, uploadFormDocumentId, uploadFormMarket, uploadModalOpen]);

  const marketReadinessByScore = useMemo(() => {
    if (!complianceData) return {} as Partial<Record<MarketCode, number>>;
    const readinessMap: Partial<Record<MarketCode, number>> = {};
    for (const market of markets) {
      const marketData = complianceData[market];
      if (!marketData) continue;
      readinessMap[market] = computeMarketDocumentReadinessScore(marketData);
    }
    return readinessMap;
  }, [complianceData, markets]);

  const readyMarkets = markets.filter((market) => (marketReadinessByScore[market] || 0) >= 80).length;
  const needsWorkMarkets = markets.filter((market) => (marketReadinessByScore[market] || 0) < 80).length;

  const handleOpenMarketDetail = (market: MarketCode) => {
    setSelectedMarket(market);
    setIsDetailOpen(true);
  };

  const handleSelectMarketFromPicker = (market: MarketCode) => {
    setMarketPickerOpen(false);
    window.setTimeout(() => {
      handleOpenMarketDetail(market);
    }, 120);
  };

  const closeUploadModal = (force = false) => {
    if (uploadingDocument && !force) return;
    setUploadModalOpen(false);
    setUploadModalGroup("export_compliance");
    setEditingDocument(null);
    setUploadFormFile(null);
  };

  const openUploadModalForCreate = (group: ComplianceDocumentGroup) => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    const availableGroupMarkets = availableMarketsByGroup[group];
    if (!availableGroupMarkets.length) {
      toast.info(t("documents.noTargetAvailable"));
      return;
    }

    const groupMarketFilter = uploadMarketFilterByGroup[group];
    const defaultMarket =
      groupMarketFilter !== "ALL" && availableGroupMarkets.includes(groupMarketFilter)
        ? groupMarketFilter
        : availableGroupMarkets[0];
    const defaultDocumentId =
      uploadTargetsByGroup[group].find((target) => target.market === defaultMarket)?.documentId || "";

    setUploadModalMode("create");
    setUploadModalGroup(group);
    setEditingDocument(null);
    setUploadFormMarket(defaultMarket);
    setUploadFormDocumentId(defaultDocumentId);
    setUploadFormFile(null);
    setUploadModalOpen(true);
  };

  const openUploadModalForTarget = (market: MarketCode, documentId: string) => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }

    const target = uploadTargets.find(
      (item) => item.market === market && item.documentId === documentId
    );
    if (!target) {
      toast.info(t("documents.noTargetAvailable"));
      return;
    }

    setUploadModalMode("create");
    setUploadModalGroup(target.group);
    setEditingDocument(null);
    setUploadFormMarket(market);
    setUploadFormDocumentId(documentId);
    setUploadFormFile(null);
    setUploadModalOpen(true);
  };

  const openUploadModalForEdit = (document: SummaryDocument) => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }

    setUploadModalMode("edit");
    setUploadModalGroup(document.group);
    setEditingDocument(document);
    setUploadFormMarket(document.market);
    setUploadFormDocumentId(document.documentId);
    setUploadFormFile(null);
    setUploadModalOpen(true);
  };

  const handleUploadFromManager = (group: ComplianceDocumentGroup) => {
    if (uploadingDocument) return;
    openUploadModalForCreate(group);
  };

  const handleOpenUpgradeModal = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(PRICING_MODAL_OPEN_EVENT));
  };

  const closePreviewDocument = () => {
    setPreviewDocumentOpen(false);
    setPreviewDocumentTitle("");
    setPreviewDocument(null);
    setPreviewDocumentUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return null;
    });
  };

  const handleOpenDocument = (document: SummaryDocument) => {
    if (openingDocumentKey === document.id) return;

    void (async () => {
      setOpeningDocumentKey(document.id);
      try {
        const objectUrl = await getComplianceDocumentObjectUrl(
          document.market,
          document.documentId,
          document.downloadUrl
        );
        setPreviewDocumentUrl((previousUrl) => {
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          return objectUrl;
        });
        setPreviewDocument(document);
        setPreviewDocumentTitle(`${document.name} (${document.market})`);
        setPreviewDocumentOpen(true);
        } catch (openError) {
        console.warn("Failed to open compliance document:", openError);
        toast.error(openError instanceof Error ? openError.message : t("documents.openFailed"));
      } finally {
        setOpeningDocumentKey((previous) => (previous === document.id ? null : previous));
      }
    })();
  };

  const handleReuploadFromPreview = () => {
    if (!previewDocument) return;
    const documentForEdit = previewDocument;
    closePreviewDocument();
    openUploadModalForEdit(documentForEdit);
  };

  const handleApproveFromPreview = () => {
    if (!previewDocument) return;
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    if (approvingDocumentKey || uploadingDocument) return;
    if (previewDocument.status === "approved") {
      toast.info(
        locale === "vi"
          ? "T\u00e0i li\u1ec7u n\u00e0y \u0111\u00e3 \u1edf tr\u1ea1ng th\u00e1i \u0111\u00e3 duy\u1ec7t."
          : "This document has already been approved."
      );
      return;
    }
    if (previewDocument.status !== "uploaded") {
      toast.info(
        locale === "vi"
          ? "Ch\u1ec9 c\u00f3 th\u1ec3 duy\u1ec7t t\u00e0i li\u1ec7u \u1edf tr\u1ea1ng th\u00e1i \u0111\u00e3 t\u1ea3i l\u00ean."
          : "Only uploaded documents can be approved."
      );
      return;
    }

    const targetDocument = previewDocument;
    void (async () => {
      setApprovingDocumentKey(targetDocument.id);
      try {
        await approveComplianceDocument(targetDocument.market, targetDocument.documentId);
        toast.success(
          locale === "vi"
            ? "\u0110\u00e3 duy\u1ec7t t\u00e0i li\u1ec7u th\u00e0nh c\u00f4ng."
            : "Document approved successfully."
        );
        await loadComplianceData();
        setPreviewDocument((previous) =>
          previous?.id === targetDocument.id ? { ...previous, status: "approved" } : previous
        );
      } catch (approveError) {
        console.error("Failed to approve compliance document:", approveError);
        toast.error(
          approveError instanceof Error
            ? approveError.message
            : locale === "vi"
              ? "Duy\u1ec7t t\u00e0i li\u1ec7u th\u1ea5t b\u1ea1i."
              : "Failed to approve document."
        );
      } finally {
        setApprovingDocumentKey((previous) =>
          previous === targetDocument.id ? null : previous
        );
      }
    })();
  };

  const handleUploadSubmit = () => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    if (uploadingDocument) return;

    const targetMarket = uploadFormMarket;
    const targetDocumentId = uploadFormDocumentId;
    const file = uploadFormFile;

    if (!targetMarket || !targetDocumentId) {
      toast.error(t("documents.invalidTarget"));
      return;
    }
    if (!file) {
      toast.info(t("documents.fileRequired"));
      return;
    }
    if (!isPdfFile(file)) {
      toast.error(t("documents.filePdfOnly"));
      return;
    }

    const target = uploadTargets.find(
      (item) =>
        item.group === uploadModalGroup && item.key === getUploadTargetKey(targetMarket, targetDocumentId)
    );
    const targetMarketName = complianceData?.[targetMarket]?.marketName || targetMarket;
    const targetDocumentName =
      target?.documentName ||
      complianceData?.[targetMarket]?.documents.find(
        (document) =>
          document.id === targetDocumentId && resolveComplianceDocumentGroup(document) === uploadModalGroup
      )?.name ||
      targetDocumentId;
    void (async () => {
      setUploadingDocument(true);
      try {
        await uploadComplianceDocument(targetMarket, targetDocumentId, file);
        if (
          uploadModalMode === "edit" &&
          editingDocument &&
          (editingDocument.market !== targetMarket ||
            editingDocument.documentId !== targetDocumentId)
        ) {
          try {
            await removeComplianceDocument(editingDocument.market, editingDocument.documentId);
          } catch (removeLegacyError) {
            console.error("Failed to remove previous document after update:", removeLegacyError);
            toast.warning(t("documents.updateMoveOldStillExists"));
          }
        }
        toast.success(
          uploadModalMode === "edit"
            ? t("documents.updateSuccess", { market: targetMarketName, document: targetDocumentName })
            : t("documents.uploadSuccess", { market: targetMarketName, document: targetDocumentName })
        );
        await loadComplianceData();
        closeUploadModal(true);
      } catch (uploadError) {
        console.error("Failed to upload compliance document:", uploadError);
        toast.error(
          uploadError instanceof Error
            ? uploadError.message
            : uploadModalMode === "edit"
              ? t("documents.updateFailed")
              : t("documents.uploadFailed")
        );
      } finally {
        setUploadingDocument(false);
      }
    })();
  };

  const handleRemoveFromManager = (document: SummaryDocument) => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    if (removingDocumentKey || uploadingDocument) return;
    setPendingRemoveDocument(document);
  };

  const handleConfirmRemoveFromManager = (document: SummaryDocument) => {
    void (async () => {
      setRemovingDocumentKey(document.id);
      try {
        await removeComplianceDocument(document.market, document.documentId);
        setPendingRemoveDocument(null);
        toast.success(t("documents.removeSuccess"));
        await loadComplianceData();
      } catch (removeError) {
        console.error("Failed to remove compliance document:", removeError);
        toast.error(removeError instanceof Error ? removeError.message : t("documents.removeFailed"));
      } finally {
        setRemovingDocumentKey(null);
      }
    })();
  };

  const updateGroupSearch = (group: ComplianceDocumentGroup, value: string) => {
    setUploadTargetSearchByGroup((previous) => ({
      ...previous,
      [group]: value
    }));
  };

  const updateGroupMarketFilter = (group: ComplianceDocumentGroup, value: UploadMarketFilter) => {
    setUploadMarketFilterByGroup((previous) => ({
      ...previous,
      [group]: value
    }));
  };

  const getDocumentManagerCopy = (group: ComplianceDocumentGroup) => {
    const isExportGroup = group === "export_compliance";

    if (isExportGroup) {
      return {
        title: t("certificates"),
        description: t("documents.uploadManagerTitle"),
        switchTitle: locale === "vi" ? "Hồ sơ xuất khẩu" : "Export compliance",
        noResultText: t("documents.uploadManagerNoResults"),
        icon: FileText
      };
    }

    return {
      title: t.has("materialCertifications.title")
        ? t("materialCertifications.title")
        : locale === "vi"
          ? "Nhóm chứng nhận vật liệu"
          : "Material certifications",
      description: t.has("materialCertifications.description")
        ? t("materialCertifications.description")
        : locale === "vi"
          ? "Tài liệu chứng nhận để mở khóa lựa chọn chứng nhận trong bước Vật liệu."
          : "Certification documents used to unlock material certification options.",
      switchTitle:
        t.has("materialCertifications.title")
          ? t("materialCertifications.title")
          : locale === "vi"
            ? "Nhóm chứng nhận vật liệu"
            : "Material certifications",
      noResultText: t.has("materialCertifications.noResults")
        ? t("materialCertifications.noResults")
        : locale === "vi"
          ? "Không có tài liệu chứng nhận vật liệu phù hợp"
          : "No matching material certification documents.",
      icon: FileCheck
    };
  };

  const renderDocumentManagerSection = (group: ComplianceDocumentGroup) => {
    const theme = DOCUMENT_GROUP_THEME[group];
    const filteredDocuments = filteredDocumentsByGroup[group];
    const availableGroupMarkets = availableMarketsByGroup[group];
    const marketFilter = uploadMarketFilterByGroup[group] || "ALL";
    const searchValue = uploadTargetSearchByGroup[group] || "";
    const isExportGroup = group === "export_compliance";
    const sectionId = isExportGroup ? "export-compliance-documents" : "material-certification-documents";
    const sectionCopy = getDocumentManagerCopy(group);
    const SectionIcon = sectionCopy.icon;

    return (
      <div key={group}>
        <Card className="border border-slate-300 bg-slate-50 shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-4 md:col-span-4">
                <label
                  htmlFor={`${sectionId}-market-filter`}
                  className="sr-only text-xs font-semibold text-slate-700 md:not-sr-only md:mb-1 md:block"
                >
                  {t("documents.uploadManagerMarketFilterLabel")}
                </label>
                <select
                  id={`${sectionId}-market-filter`}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
                  value={marketFilter}
                  onChange={(event) =>
                    updateGroupMarketFilter(group, event.target.value as UploadMarketFilter)
                  }
                  disabled={uploadingDocument}
                >
                  <option value="ALL">{t("documents.uploadManagerMarketFilterAll")}</option>
                  {availableGroupMarkets.map((market) => (
                    <option key={market} value={market}>
                      {market}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-8 md:col-span-5">
                <label
                  htmlFor={`${sectionId}-search`}
                  className="sr-only text-xs font-semibold text-slate-700 md:not-sr-only md:mb-1 md:block"
                >
                  {t("documents.uploadManagerSearchLabel")}
                </label>
                <Input
                  id={`${sectionId}-search`}
                  className="h-10 border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"
                  value={searchValue}
                  onChange={(event) => updateGroupSearch(group, event.target.value)}
                  placeholder={t("documents.uploadManagerSearchPlaceholder")}
                  disabled={uploadingDocument}
                />
              </div>

              <div className="col-span-12 md:col-span-3">
                <Button
                  type="button"
                  size="sm"
                  className="h-10 w-full border border-emerald-800 bg-emerald-700 px-2 text-white hover:bg-emerald-800"
                  disabled={uploadingDocument || availableGroupMarkets.length === 0}
                  onClick={() => handleUploadFromManager(group)}
                >
                  {uploadingDocument ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1 h-4 w-4" />
                  )}
                  <span className="truncate">{t("documents.uploadSelected")}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((document) => {
            const statusMeta = getDocumentStatusMeta(document.status);

            return (
              <Card
                key={document.id}
                className={`cursor-pointer border shadow-sm transition-colors hover:bg-slate-50 ${getManagerDocumentTone(document.status)}`}
                onClick={() => handleOpenDocument(document)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenDocument(document);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${document.name} (${document.market})`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.iconWrapClassName}`}>
                        <SectionIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {document.name}
                          </p>
                          <Badge variant="outline" className="border-slate-300 bg-white/80 text-slate-700">
                            {document.market}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                          {document.expires && (
                            <p className="text-xs text-muted-foreground">
                              {t("expires")} {document.expires}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={
                          Boolean(removingDocumentKey) ||
                          uploadingDocument ||
                          openingDocumentKey === document.id
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openUploadModalForEdit(document);
                        }}
                        aria-label={t("documents.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        disabled={
                          Boolean(removingDocumentKey) ||
                          uploadingDocument ||
                          openingDocumentKey === document.id
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleRemoveFromManager(document);
                        }}
                        aria-label={t("documents.remove")}
                      >
                        {removingDocumentKey === document.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                      {openingDocumentKey === document.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredDocuments.length === 0 && (
            <Card className={`md:col-span-2 lg:col-span-3 border shadow-sm ${theme.sectionClassName}`}>
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium text-slate-700">{sectionCopy.noResultText}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const uploadModalSubmitDisabled =
    uploadingDocument || !uploadFormMarket || !uploadFormDocumentId || !uploadFormFile;
  const uploadModalDescription =
    uploadModalGroup === "material_certification"
      ? t.has("materialCertifications.uploadModalDescription")
        ? t("materialCertifications.uploadModalDescription")
        : "Ch\u1ecdn th\u1ecb tr\u01b0\u1eddng, lo\u1ea1i ch\u1ee9ng nh\u1eadn v\u1eadt li\u1ec7u v\u00e0 file PDF c\u1ea7n t\u1ea3i l\u00ean."
      : t("documents.uploadModalDescription");

  return (
    <>
      <div className="space-y-4 md:space-y-6 no-horizontal-scroll">
        <ExportConfigurationPortalV2 />

        <div className="border-t border-slate-200 pt-5">
          <h3 className="mb-3 text-base font-semibold text-slate-950">
            Mức độ sẵn sàng theo thị trường
          </h3>
        </div>

        <div>
          <div className="mb-3 flex justify-start md:justify-end">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-primary">
                <span className="font-semibold">{readyMarkets}</span>
                <span className="font-semibold">{t("readyMarkets")}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                <span className="font-semibold">{needsWorkMarkets}</span>
                <span className="font-semibold">{t("needsSupport")}</span>
              </span>
            </div>
          </div>

          {isMobile ? (
            <>
              {loading && (
                <Card className="border border-slate-200 bg-white shadow-sm">
                  <CardContent className="space-y-3 p-6">
                    <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                    <div className="h-2 w-full animate-pulse rounded bg-slate-200" />
                  </CardContent>
                </Card>
              )}

              {!loading && error && (
                <Card className="border border-red-200 bg-red-50/60 shadow-sm">
                  <CardContent className="space-y-3 py-6 text-center">
                    <p className="text-sm font-medium text-red-700">{error}</p>
                    {isPlanRestricted ? (
                      <Button size="sm" onClick={handleOpenUpgradeModal}>
                        Upgrade plan
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void loadComplianceData()}>
                        {t("retry")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {!loading && !error && availableMarkets.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMarketPickerOpen(true)}
                  className="h-auto w-full items-start justify-between rounded-2xl border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-slate-50"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {locale === "vi" ? "Thị trường xuất khẩu" : "Export markets"}
                      </p>
                      <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
                        {availableMarkets.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">
                      {locale === "vi"
                        ? "Chạm để chọn thị trường và xem chi tiết tuân thủ"
                        : "Tap to choose a market and view compliance details"}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-start gap-2 self-start pt-0.5">
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                </Button>
              )}

              {!loading && !error && availableMarkets.length === 0 && (
                <Card className="border border-slate-200 bg-slate-50/60 shadow-sm">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">{t("carbonData.noData")}</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-4">
              {loading && (
                <Card className="col-span-2 border border-slate-200 bg-white shadow-sm md:col-span-3 xl:col-span-4">
                  <CardContent className="space-y-3 p-6">
                    <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                    <div className="h-2 w-full animate-pulse rounded bg-slate-200" />
                  </CardContent>
                </Card>
              )}

              {!loading && error && (
                <Card className="col-span-2 border border-red-200 bg-red-50/60 shadow-sm md:col-span-3 xl:col-span-4">
                  <CardContent className="space-y-3 py-6 text-center">
                    <p className="text-sm font-medium text-red-700">{error}</p>
                    {isPlanRestricted ? (
                      <Button size="sm" onClick={handleOpenUpgradeModal}>
                        Upgrade plan
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void loadComplianceData()}>
                        {t("retry")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {!loading &&
                !error &&
                availableMarkets.map((market) => {
                  const data = complianceData?.[market];
                  if (!data) return null;
                  const readinessScore =
                    marketReadinessByScore[market] ?? computeMarketDocumentReadinessScore(data);
                  const marketTone = getMarketTone(readinessScore);

                  return (
                    <Card
                      key={market}
                      className={`group cursor-pointer overflow-hidden border shadow-sm transition-colors hover:bg-slate-50 ${marketTone.cardClassName}`}
                      onClick={() => handleOpenMarketDetail(market)}
                    >
                      <div className={`h-1 ${marketTone.barClassName}`} />
                      <CardContent className="p-2 md:p-3">
                        <div className="flex items-start gap-2 md:gap-4">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg md:h-12 md:w-12 md:rounded-xl ${marketTone.iconClassName}`}>
                            <span className="text-sm font-bold md:text-lg">{market}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center justify-between gap-1">
                              <p className="truncate text-xs font-semibold text-slate-900 md:text-sm">
                                {data.marketName}
                              </p>
                              <Badge className={`px-1.5 py-0 text-[10px] md:px-2 md:text-xs ${getReadinessColor(readinessScore)}`}>{readinessScore}%</Badge>
                            </div>
                            <p className="mb-1 truncate text-[10px] text-muted-foreground md:mb-2 md:text-xs">
                              {t(`regulations.${market}`)}
                            </p>
                            <Progress value={readinessScore} className="h-1.5 md:h-2" />
                          </div>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between border-t border-slate-200/80 pt-1.5 md:mt-3 md:pt-2.5">
                          <div className="flex min-w-0 items-center gap-1 text-[10px] md:text-xs">
                            {readinessScore >= 80 && (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-green-500 md:h-4 md:w-4" />
                                <span className="truncate text-green-600 dark:text-green-400">
                                  {t("exportReady")}
                                </span>
                              </>
                            )}
                            {readinessScore < 80 && readinessScore >= 50 && (
                              <>
                                <Clock className="h-3 w-3 text-yellow-500 md:h-4 md:w-4" />
                                <span className="truncate text-yellow-600 dark:text-yellow-400">
                                  {data.recommendations.filter((item) => item.status === "active").length}{" "}
                                  {t("needsWork")}
                                </span>
                              </>
                            )}
                            {readinessScore < 50 && (
                              <>
                                <AlertCircle className="h-3 w-3 text-red-500 md:h-4 md:w-4" />
                                <span className="truncate text-red-600 dark:text-red-400">{t("notReady")}</span>
                              </>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 shrink-0 gap-0.5 rounded-lg px-2 text-[10px] font-medium md:gap-1 md:text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenMarketDetail(market);
                            }}
                          >
                            {t("details")}
                            <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

              {!loading && !error && availableMarkets.length === 0 && (
                <Card className="col-span-2 border border-slate-200 bg-slate-50/60 shadow-sm md:col-span-3 xl:col-span-4">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">{t("carbonData.noData")}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {DOCUMENT_GROUPS.map((group) => {
              const theme = DOCUMENT_GROUP_THEME[group];
              const counts = uploadTargetCountsByGroup[group];
              const copy = getDocumentManagerCopy(group);
              const SwitchIcon = copy.icon;
              const isActive = activeDocumentGroup === group;

              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setActiveDocumentGroup(group)}
                  className={`h-full rounded-xl border px-3 pt-1.5 pb-1 text-left transition-colors md:rounded-2xl md:px-4 md:py-4 ${
                    isActive
                      ? group === "export_compliance"
                        ? "border-emerald-300 bg-emerald-50/70 shadow-sm md:border-slate-900 md:bg-slate-50"
                        : "border-amber-300 bg-amber-50/80 shadow-sm md:border-slate-900 md:bg-slate-50"
                      : group === "export_compliance"
                        ? "border-emerald-100 bg-white hover:bg-emerald-50/40 md:border-slate-200 md:hover:bg-slate-50"
                        : "border-amber-100 bg-white hover:bg-amber-50/40 md:border-slate-200 md:hover:bg-slate-50"
                  }`}
                >
                  <div className="flex min-h-[70px] flex-col gap-[0.2rem] md:min-h-[128px] md:gap-3">
                    <div className="hidden items-center justify-between gap-2 md:flex">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10 md:rounded-xl ${theme.iconWrapClassName}`}
                      >
                        <SwitchIcon className="h-4 w-4 md:h-5 md:w-5" />
                      </span>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[11px] md:text-xs ${
                          isActive
                            ? "border-slate-300 bg-white text-slate-900"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {counts.uploadedCount}/{counts.total}
                      </Badge>
                    </div>
                    <p className="min-h-[2.2rem] line-clamp-2 text-[12.5px] font-semibold leading-[1.1rem] text-slate-900 md:min-h-0 md:text-sm md:leading-5">
                      {copy.switchTitle}
                    </p>
                    <div className="grid grid-cols-2 gap-1 pt-0 text-[9px] md:mt-auto md:gap-2 md:pt-0 md:text-xs">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700 md:border-slate-200 md:bg-white md:text-slate-600 md:py-1">
                        {locale === "vi" ? "Duyệt" : "Approved"}:{" "}
                        <span className="font-semibold text-slate-900">{counts.approvedCount}</span>
                      </span>
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700 md:border-slate-200 md:bg-white md:text-slate-600 md:py-1">
                        {locale === "vi" ? "Thiếu" : "Missing"}:{" "}
                        <span className="font-semibold text-rose-700">{counts.missingCount}</span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {renderDocumentManagerSection(activeDocumentGroup)}
        </div>
      </div>

      <Dialog open={marketPickerOpen} onOpenChange={setMarketPickerOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] rounded-2xl border border-slate-200 bg-white p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>
              {locale === "vi" ? "Thị trường xuất khẩu" : "Export markets"}
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {locale === "vi"
                ? "Chọn một thị trường để xem chi tiết tuân thủ."
                : "Choose a market to view compliance details."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70dvh] space-y-2 overflow-y-auto p-4">
            {availableMarkets.map((market) => {
              const data = complianceData?.[market];
              if (!data) return null;
              const readinessScore =
                marketReadinessByScore[market] ?? computeMarketDocumentReadinessScore(data);
              const marketTone = getMarketTone(readinessScore);

              return (
                <button
                  key={market}
                  type="button"
                  onClick={() => handleSelectMarketFromPicker(market)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${marketTone.iconClassName}`}
                  >
                    <span className="text-sm font-bold">{market}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {data.marketName}
                      </p>
                      <Badge className={`px-1.5 py-0 text-[10px] ${getReadinessColor(readinessScore)}`}>
                        {readinessScore}%
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      {t(`regulations.${market}`)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={uploadModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setUploadModalOpen(true);
            return;
          }
          closeUploadModal();
        }}
      >
        <DialogContent className="h-dvh w-screen max-w-[100vw] overflow-y-auto rounded-none p-4 md:h-auto md:max-w-lg md:rounded-lg md:p-6">
          <DialogHeader>
            <DialogTitle>
              {uploadModalMode === "edit" ? t("documents.editModalTitle") : t("documents.uploadModalTitle")}
            </DialogTitle>
            <DialogDescription>{uploadModalDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("documents.uploadManagerMarketFilterLabel")}
              </label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={uploadFormMarket}
                onChange={(event) => {
                  setUploadFormMarket(event.target.value as MarketCode);
                  setUploadFormDocumentId("");
                }}
                disabled={uploadingDocument}
              >
                {availableMarketsByGroup[uploadModalGroup].map((market) => (
                  <option key={market} value={market}>
                    {complianceData?.[market]?.marketName || market} ({market})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("documents.uploadManagerSelectLabel")}
              </label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={uploadFormDocumentId}
                onChange={(event) => setUploadFormDocumentId(event.target.value)}
                disabled={uploadingDocument || uploadFormAvailableDocuments.length === 0}
              >
                {uploadFormAvailableDocuments.length === 0 ? (
                  <option value="">{t("documents.noDocumentsForMarket")}</option>
                ) : (
                  uploadFormAvailableDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("documents.fileLabel")}
              </label>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (file && !isPdfFile(file)) {
                    toast.error(t("documents.filePdfOnly"));
                    event.target.value = "";
                    setUploadFormFile(null);
                    return;
                  }
                  setUploadFormFile(file);
                }}
                disabled={uploadingDocument}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("documents.fileHint")}</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeUploadModal()} disabled={uploadingDocument}>
              {t("documents.cancel")}
            </Button>
            <Button type="button" onClick={handleUploadSubmit} disabled={uploadModalSubmitDisabled}>
              {uploadingDocument ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              {uploadModalMode === "edit" ? t("documents.update") : t("documents.upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewDocumentOpen} onOpenChange={(open) => !open && closePreviewDocument()}>
        <DialogContent className="h-dvh w-screen max-w-[100vw] rounded-none p-0 md:h-[92dvh] md:w-[95vw] md:max-w-6xl md:rounded-lg">
          <DialogHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-base">{previewDocumentTitle || t("documents.previewTitle")}</DialogTitle>
              {previewDocument && (
                <Badge className={getDocumentStatusMeta(previewDocument.status).className}>
                  {getDocumentStatusMeta(previewDocument.status).label}
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="h-[calc(100dvh-11rem)] w-full bg-slate-100 md:h-[75vh]">
            {previewDocumentUrl ? (
              <iframe
                title={previewDocumentTitle || t("documents.previewTitle")}
                src={previewDocumentUrl}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("documents.previewUnavailable")}
              </div>
            )}
          </div>
          <DialogFooter className="border-t px-4 py-3 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleReuploadFromPreview}
              disabled={!previewDocument || uploadingDocument || Boolean(approvingDocumentKey)}
            >
              <Upload className="mr-1 h-4 w-4" />
              {locale === "vi" ? "Upload l\u1ea1i" : "Re-upload"}
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleApproveFromPreview}
              disabled={
                !previewDocument ||
                uploadingDocument ||
                Boolean(approvingDocumentKey) ||
                previewDocument.status !== "uploaded"
              }
            >
              {approvingDocumentKey === previewDocument?.id ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              )}
              {previewDocument?.status === "approved"
                ? locale === "vi"
                  ? "\u0110\u00e3 duy\u1ec7t"
                  : "Approved"
                : locale === "vi"
                  ? "Duy\u1ec7t t\u00e0i li\u1ec7u"
                  : "Approve document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingRemoveDocument)}
        onOpenChange={(open) => {
          if (!open && !removingDocumentKey) {
            setPendingRemoveDocument(null);
          }
        }}
      >
        <AlertDialogContent className="w-[92vw] max-w-md border-slate-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === "vi" ? "X\u00f3a t\u00e0i li\u1ec7u" : "Remove document"}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("documents.removeConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(removingDocumentKey)}>
              {t("documents.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!pendingRemoveDocument || Boolean(removingDocumentKey)}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingRemoveDocument) {
                  return;
                }
                handleConfirmRemoveFromManager(pendingRemoveDocument);
              }}
            >
              {removingDocumentKey === pendingRemoveDocument?.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {locale === "vi" ? "X\u00f3a" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ComplianceDetailModal
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        marketCode={selectedMarket}
        complianceData={complianceData}
        onRequestDocumentUpload={openUploadModalForTarget}
        onDataChanged={loadComplianceData}
      />
    </>
  );
};

export default ExportPage;
