"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileDown,
  FileText,
  Globe,
  Info,
  Leaf,
  Loader2,
  Package,
  Shield
} from "lucide-react";
import { resolveApiUrl } from "@/lib/apiClient";
import { showNoPermissionToast } from "@/lib/noPermissionToast";
import { filterExportComplianceDocuments } from "@/lib/complianceDocumentGroups";
import {
  createComplianceMarketReport,
  downloadComplianceDocument,
  openComplianceDocumentInNewTab,
  removeComplianceDocument,
  removeComplianceProduct,
  upsertComplianceCarbonData,
  upsertComplianceProduct
} from "@/lib/exportComplianceApi";
import { fetchAllProducts, type ProductRecord } from "@/lib/productsApi";
import { useAppRoutes } from "@/lib/demo/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MARKET_REGULATIONS,
  STATUS_CONFIG,
  type MarketCode,
  type MarketCompliance
} from "./types";
import ComplianceCarbonData from "./ComplianceCarbonData";
import ComplianceDocuments from "./ComplianceDocuments";
import ComplianceProductScope from "./ComplianceProductScope";
import ComplianceRecommendations from "./ComplianceRecommendations";
import {
  computeRequiredDocumentReadinessFromExportDocuments,
  summarizeRequiredExportDocuments
} from "./readiness";
import { usePermissions } from "@/hooks/usePermissions";

interface ComplianceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketCode: MarketCode | null;
  complianceData?: Record<MarketCode, MarketCompliance> | null;
  onRequestDocumentUpload?: (market: MarketCode, documentId: string) => void;
  onDataChanged?: () => Promise<void> | void;
}

type CarbonScope = "scope1" | "scope2" | "scope3";

interface CarbonFormState {
  scope: CarbonScope;
  value: string;
  unit: string;
  methodology: string;
  dataSource: string;
  reportingPeriod: string;
}

interface ProductFormState {
  mode: "add" | "edit";
  productId?: string;
  productName: string;
  hsCode: string;
  productionSite: string;
  exportVolume: string;
  unit: string;
}

const isDirectDownloadPath = (value: string) =>
  value.startsWith("http://") ||
  value.startsWith("https://") ||
  value.startsWith("data:") ||
  value.startsWith("blob:") ||
  value.startsWith("/demo-assets/");

const getCurrentReportingPeriod = () => {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${quarter}`;
};

const parseNonNegativeNumber = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

const ComplianceDetailModal: React.FC<ComplianceDetailModalProps> = ({
  open,
  onOpenChange,
  marketCode,
  complianceData,
  onRequestDocumentUpload,
  onDataChanged
}) => {
  const t = useTranslations("export.modal");
  const tStatus = useTranslations("export.status");
  const locale = useLocale();
  const appRoutes = useAppRoutes();
  const { canMutate } = usePermissions();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const [activeTab, setActiveTab] = useState("overview");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [carbonForm, setCarbonForm] = useState<CarbonFormState | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [availableProducts, setAvailableProducts] = useState<ProductRecord[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [pendingDocumentRemoveId, setPendingDocumentRemoveId] = useState<string | null>(null);
  const [pendingProductRemoveId, setPendingProductRemoveId] = useState<string | null>(null);

  const compliance = marketCode && complianceData ? complianceData[marketCode] : null;
  const regulation = useMemo(
    () => (marketCode ? MARKET_REGULATIONS[marketCode] : null),
    [marketCode]
  );

  useEffect(() => {
    if (!open) {
      setCarbonForm(null);
      setProductForm(null);
      setPendingDocumentRemoveId(null);
      setPendingProductRemoveId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || appRoutes.isDemo) return;

    let cancelled = false;
    setIsLoadingProducts(true);
    void fetchAllProducts({ sort_by: "updated_at", sort_order: "desc" })
      .then((products) => {
        if (!cancelled) {
          setAvailableProducts(products);
        }
      })
      .catch((error) => {
        console.error("Unable to load products for compliance scope", error);
        if (!cancelled) {
          setAvailableProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appRoutes.isDemo, open]);

  if (!compliance || !marketCode || !regulation) return null;

  const exportComplianceDocuments = filterExportComplianceDocuments(compliance.documents);
  const requiredExportDocumentSummary = summarizeRequiredExportDocuments(
    exportComplianceDocuments,
    compliance.requiredDocuments,
    compliance.requiredDocumentsCount,
    compliance.requiredDocumentsUploadedCount
  );
  const requiredExportDocumentsCount = requiredExportDocumentSummary.total;
  const requiredExportDocumentsUploadedCount = requiredExportDocumentSummary.uploaded;
  const readinessScore = computeRequiredDocumentReadinessFromExportDocuments(
    exportComplianceDocuments,
    compliance.requiredDocuments,
    compliance.requiredDocumentsCount
  );
  const statusConfig = STATUS_CONFIG[compliance.status];
  const complianceStatusLabel = tStatus(compliance.status);
  const isBusy = actionInProgress !== null;
  const refreshComplianceData = async () => {
    if (!onDataChanged) return;
    await onDataChanged();
  };

  const buildProductFormFromRecord = (
    product: ProductRecord,
    mode: ProductFormState["mode"] = "add"
  ): ProductFormState => ({
    mode,
    productId: product.id,
    productName: product.productName,
    hsCode: product.hsCode || product.cnCode || "",
    productionSite: product.facility || product.manufacturingLocation || "",
    exportVolume: String(Math.max(0, product.quantity || 0)),
    unit: "pcs"
  });

  const handleProductSelectionChange = (productId: string) => {
    const selected = availableProducts.find((product) => product.id === productId);
    if (!selected) return;
    setProductForm(buildProductFormFromRecord(selected, "add"));
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (isBusy) {
      toast.info(t("notifications.actionInProgress"));
      return;
    }
    setActionInProgress(key);
    try {
      await action();
    } catch (error) {
      console.error(`Compliance action failed: ${key}`, error);
      toast.error(error instanceof Error ? error.message : t("notifications.actionFailed"));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDocumentAction = (action: string) => (documentId: string) => {
    const matchedDocument = exportComplianceDocuments.find(
      (document) => document.id === documentId
    );
    const preferredDownloadUrl = matchedDocument?.downloadUrl;

    if (action === "view") {
      void runAction(`view-${documentId}`, async () => {
        await openComplianceDocumentInNewTab(
          marketCode,
          documentId,
          preferredDownloadUrl
        );
      });
      return;
    }

    if (action === "download") {
      void runAction(`download-${documentId}`, async () => {
        await downloadComplianceDocument(
          marketCode,
          documentId,
          preferredDownloadUrl
        );
      });
      return;
    }

    if (action === "upload") {
      if (!canMutate) {
        showNoPermissionToast();
        return;
      }
      onRequestDocumentUpload?.(marketCode, documentId);
      return;
    }

    if (action === "remove") {
      if (!canMutate) {
        showNoPermissionToast();
        return;
      }
      setPendingDocumentRemoveId(documentId);
    }
  };

  const confirmRemoveDocument = () => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    if (!pendingDocumentRemoveId) return;
    const documentId = pendingDocumentRemoveId;

    void runAction(`remove-${documentId}`, async () => {
      await removeComplianceDocument(marketCode, documentId);
      toast.success(t("notifications.documentRemoved"));
      setPendingDocumentRemoveId(null);
      await refreshComplianceData();
    });
  };

  const openCarbonForm = (scope: string) => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    const current = compliance.carbonData.find((item) => item.scope === scope);
    if (!current) {
      toast.error(t("validation.invalidCarbonScope"));
      return;
    }

    setCarbonForm({
      scope: current.scope,
      value: current.value === null ? "" : String(current.value),
      unit: current.unit || "kgCO2e",
      methodology: current.methodology || "GHG Protocol",
      dataSource: current.dataSource || "Internal",
      reportingPeriod: current.reportingPeriod || getCurrentReportingPeriod()
    });
  };

  const updateCarbonForm = (updates: Partial<CarbonFormState>) => {
    setCarbonForm((previous) => (previous ? { ...previous, ...updates } : previous));
  };

  const submitCarbonForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    if (!carbonForm) return;

    const value = parseNonNegativeNumber(carbonForm.value.trim());
    if (value === null) {
      toast.error(t("validation.invalidEmissionValue"));
      return;
    }

    if (!carbonForm.methodology.trim()) {
      toast.error(t("validation.methodologyRequired"));
      return;
    }

    if (!carbonForm.dataSource.trim()) {
      toast.error(t("validation.dataSourceRequired"));
      return;
    }

    if (!carbonForm.reportingPeriod.trim()) {
      toast.error(t("validation.reportingPeriodRequired"));
      return;
    }

    void runAction(`carbon-${carbonForm.scope}`, async () => {
      await upsertComplianceCarbonData({
        marketCode,
        scope: carbonForm.scope,
        value,
        unit: carbonForm.unit.trim() || "kgCO2e",
        methodology: carbonForm.methodology.trim(),
        dataSource: carbonForm.dataSource.trim(),
        reportingPeriod: carbonForm.reportingPeriod.trim()
      });
      toast.success(t("notifications.carbonDataUpdated"));
      setCarbonForm(null);
      await refreshComplianceData();
    });
  };

  const openProductForm = (mode: "add" | "edit", productId?: string) => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    const current = productId
      ? compliance.productScope.find((item) => item.productId === productId)
      : undefined;

    if (mode === "edit" && !current) {
      toast.error(t("validation.productNotFound"));
      return;
    }

    if (mode === "add" && !appRoutes.isDemo) {
      const defaultProduct = availableProducts.length === 1 ? availableProducts[0] : null;
      setProductForm(
        defaultProduct ?
          buildProductFormFromRecord(defaultProduct, "add") :
          {
            mode,
            productId: undefined,
            productName: "",
            hsCode: "",
            productionSite: "",
            exportVolume: "",
            unit: "pcs"
          }
      );
      return;
    }

    setProductForm({
      mode,
      productId: current?.productId,
      productName: current?.productName || "",
      hsCode: current?.hsCode || "",
      productionSite: current?.productionSite || "",
      exportVolume: current ? String(current.exportVolume) : "",
      unit: current?.unit || "pcs"
    });
  };

  const updateProductForm = (updates: Partial<ProductFormState>) => {
    setProductForm((previous) => (previous ? { ...previous, ...updates } : previous));
  };

  const submitProductForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    if (!productForm) return;

    if (!appRoutes.isDemo && !productForm.productId) {
      toast.error(t("validation.productRequired"));
      return;
    }

    if (!productForm.productName.trim()) {
      toast.error(t("validation.productNameRequired"));
      return;
    }

    if (!productForm.hsCode.trim()) {
      toast.error(t("validation.hsCodeRequired"));
      return;
    }

    if (!productForm.productionSite.trim()) {
      toast.error(t("validation.productionSiteRequired"));
      return;
    }

    if (!productForm.unit.trim()) {
      toast.error(t("validation.unitRequired"));
      return;
    }

    const exportVolume = parseNonNegativeNumber(productForm.exportVolume.trim());
    if (exportVolume === null) {
      toast.error(t("validation.invalidExportVolume"));
      return;
    }

    void runAction(`product-${productForm.mode}-${productForm.productId || "new"}`, async () => {
      await upsertComplianceProduct({
        marketCode,
        operation: productForm.mode,
        productId: productForm.productId,
        productName: productForm.productName.trim(),
        hsCode: productForm.hsCode.trim(),
        productionSite: productForm.productionSite.trim(),
        exportVolume,
        unit: productForm.unit.trim()
      });
      toast.success(
        productForm.mode === "add" ?
        t("notifications.productAdded") :
        t("notifications.productUpdated")
      );
      setProductForm(null);
      await refreshComplianceData();
    });
  };

  const confirmRemoveProduct = () => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    if (!pendingProductRemoveId) return;
    const productId = pendingProductRemoveId;

    void runAction(`product-remove-${productId}`, async () => {
      await removeComplianceProduct(marketCode, productId);
      toast.success(t("notifications.productRemoved"));
      setPendingProductRemoveId(null);
      await refreshComplianceData();
    });
  };

  const handleProductAction =
    (action: "add" | "edit" | "remove") =>
    (productId?: string) => {
      if (!canMutate) {
        showNoPermissionToast();
        return;
      }
      if (action === "remove") {
        if (!productId) return;
        setPendingProductRemoveId(productId);
        return;
      }

      openProductForm(action, productId);
    };

  const handleExportReport = () => {
    if (!canMutate) {
      showNoPermissionToast();
      return;
    }
    if (!appRoutes.isDemo && compliance.status !== "ready" && compliance.status !== "verified") {
      toast.error(t("notReadyError"));
      return;
    }

    void runAction("export-report", async () => {
      const result = await createComplianceMarketReport(
        marketCode,
        appRoutes.isDemo ? "pdf" : "xlsx"
      );
      await refreshComplianceData();

      if (result.downloadPath && result.status.toLowerCase().includes("complete")) {
        const targetUrl = isDirectDownloadPath(result.downloadPath)
          ? result.downloadPath
          : resolveApiUrl(result.downloadPath);
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }

      toast.success(t("generatingReport"));
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-screen max-h-dvh max-w-[100vw] gap-0 rounded-none p-0 md:max-h-[90vh] md:max-w-4xl md:rounded-lg">
          <DialogHeader className="border-b bg-white p-4 pb-3 md:p-6 md:pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 md:h-14 md:w-14">
                  <span className="text-2xl font-bold text-emerald-700">{marketCode}</span>
                </div>
                <div>
                  <DialogTitle className="text-lg md:text-xl">
                    {compliance.marketName}
                  </DialogTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {regulation.name} ({regulation.code})
                  </p>
                </div>
              </div>
              <Badge className={`${statusConfig.bgColor} ${statusConfig.color} w-fit shrink-0`}>
                {complianceStatusLabel}
              </Badge>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm md:mt-4 md:p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{t("readinessLevel")}</span>
                <span className="text-xl font-bold text-primary md:text-2xl">{readinessScore}%</span>
              </div>
              <Progress value={readinessScore} className="h-3" />
              <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {t("updated")} {new Date(compliance.lastUpdated).toLocaleDateString(displayLocale)}
                </span>
                <span>
                  {readinessScore >= 80 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> {t("exportReady")}
                    </span>
                  )}
                  {readinessScore < 80 && readinessScore >= 50 && (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Clock className="h-3 w-3" /> {t("needsWork")}
                    </span>
                  )}
                  {readinessScore < 50 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="h-3 w-3" /> {t("notReady")}
                    </span>
                  )}
                </span>
              </div>
            </div>

          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-auto mt-3 flex w-[calc(100%-2rem)] flex-nowrap rounded-xl border border-slate-200 bg-slate-100/80 p-1 md:mx-8 md:mt-4 md:w-fit">
              <TabsTrigger value="overview" className="gap-1.5">
                <Globe className="h-4 w-4" />
                {t("overviewTab")}
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5">
                <Package className="h-4 w-4" />
                {t("productsTab")}
              </TabsTrigger>
              <TabsTrigger value="carbon" className="gap-1.5">
                <Leaf className="h-4 w-4" />
                {t("carbonTab")}
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1.5">
                <FileText className="h-4 w-4" />
                {t("documentsTab")}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 p-4 pt-3 md:p-6 md:pt-4">
              <TabsContent value="overview" className="mt-0 space-y-4">
                <ComplianceRecommendations
                  recommendations={compliance.recommendations}
                  documents={exportComplianceDocuments}
                />

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-xl bg-blue-100 p-2">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="mb-2 text-sm font-semibold">{t("regulationInfo")}</h4>
                        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">{t("regulationCode")} </span>
                            <span className="font-medium">{regulation.code}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("reference")} </span>
                            <span className="font-medium">{regulation.legalReference}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("scope")} </span>
                            <span className="font-medium">{regulation.reportingScope}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("reportingFrequency")} </span>
                            <span className="font-medium">{regulation.reportingFrequency}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{t("enforcementDate")} </span>
                            <span className="font-medium">{regulation.enforcementDate}</span>
                          </div>
                        </div>
                        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          {regulation.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {compliance.verificationRequired && (
                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-purple-100 p-2">
                            <Shield className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold">{t("verificationStatus")}</h4>
                            <p className="text-xs text-muted-foreground">{t("verificationRequired")}</p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            compliance.verificationStatus === "verified" ? "default" : "secondary"
                          }
                        >
                          {compliance.verificationStatus === "verified"
                            ? t("verified")
                            : compliance.verificationStatus === "pending"
                              ? t("verificationPending")
                              : t("rejected")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="products" className="mt-0">
                <ComplianceProductScope
                  products={compliance.productScope}
                  marketName={compliance.marketName}
                  onAddProduct={handleProductAction("add")}
                  onEditProduct={handleProductAction("edit")}
                  onRemoveProduct={handleProductAction("remove")}
                />
              </TabsContent>

              <TabsContent value="carbon" className="mt-0">
                <ComplianceCarbonData
                  carbonData={compliance.carbonData}
                  emissionFactors={compliance.emissionFactors}
                  onEditData={openCarbonForm}
                  onAddData={() => openCarbonForm("scope3")}
                />
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <ComplianceDocuments
                  documents={exportComplianceDocuments}
                  requiredDocumentsCount={requiredExportDocumentsCount}
                  requiredDocumentsUploadedCount={requiredExportDocumentsUploadedCount}
                  onUpload={handleDocumentAction("upload")}
                  onDownload={handleDocumentAction("download")}
                  onRemove={handleDocumentAction("remove")}
                  onView={handleDocumentAction("view")}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <div className="flex flex-col gap-3 border-t p-4 pt-3 md:flex-row md:items-center md:justify-between md:p-6 md:pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
              {t("close")}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => window.open(regulation.guideUrl, "_blank", "noopener,noreferrer")}
                disabled={isBusy}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("viewGuide")}
              </Button>
              <Button
                onClick={handleExportReport}
                disabled={
                  isBusy ||
                  (
                    !appRoutes.isDemo &&
                    compliance.status !== "ready" &&
                    compliance.status !== "verified"
                  )
                }
                className="w-full sm:w-auto"
              >
                {actionInProgress === "export-report" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {t("exportReport")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={carbonForm !== null} onOpenChange={(isOpen) => (!isOpen ? setCarbonForm(null) : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("forms.carbon.title")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitCarbonForm}>
            <div className="space-y-2">
              <Label htmlFor="carbon-value">{t("forms.carbon.emissionValue")}</Label>
              <Input
                id="carbon-value"
                type="number"
                step="any"
                min="0"
                value={carbonForm?.value || ""}
                onChange={(event) => updateCarbonForm({ value: event.target.value })}
                disabled={isBusy}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="carbon-unit">{t("forms.carbon.unit")}</Label>
                <Input
                  id="carbon-unit"
                  value={carbonForm?.unit || ""}
                  onChange={(event) => updateCarbonForm({ unit: event.target.value })}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carbon-period">{t("forms.carbon.reportingPeriod")}</Label>
                <Input
                  id="carbon-period"
                  value={carbonForm?.reportingPeriod || ""}
                  onChange={(event) => updateCarbonForm({ reportingPeriod: event.target.value })}
                  disabled={isBusy}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="carbon-methodology">{t("forms.carbon.methodology")}</Label>
              <Input
                id="carbon-methodology"
                value={carbonForm?.methodology || ""}
                onChange={(event) => updateCarbonForm({ methodology: event.target.value })}
                disabled={isBusy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="carbon-source">{t("forms.carbon.dataSource")}</Label>
              <Input
                id="carbon-source"
                value={carbonForm?.dataSource || ""}
                onChange={(event) => updateCarbonForm({ dataSource: event.target.value })}
                disabled={isBusy}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCarbonForm(null)} disabled={isBusy}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isBusy}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={productForm !== null} onOpenChange={(isOpen) => (!isOpen ? setProductForm(null) : null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {productForm?.mode === "edit" ? t("forms.product.editTitle") : t("forms.product.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitProductForm}>
            {!appRoutes.isDemo && (
              <div className="space-y-2">
                <Label htmlFor="product-select">{t("forms.product.productSelect")}</Label>
                <Select
                  value={productForm?.productId || ""}
                  onValueChange={handleProductSelectionChange}
                  disabled={isBusy || isLoadingProducts || productForm?.mode === "edit"}
                >
                  <SelectTrigger id="product-select">
                    <SelectValue
                      placeholder={
                        isLoadingProducts ?
                          t("forms.product.loadingProducts") :
                          t("forms.product.selectProduct")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.productCode} - {product.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isLoadingProducts && availableProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("forms.product.noProducts")}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="product-name">{t("forms.product.productName")}</Label>
              <Input
                id="product-name"
                value={productForm?.productName || ""}
                onChange={(event) => updateProductForm({ productName: event.target.value })}
                disabled={isBusy || !appRoutes.isDemo}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-hs">{t("forms.product.hsCode")}</Label>
                <Input
                  id="product-hs"
                  value={productForm?.hsCode || ""}
                  onChange={(event) => updateProductForm({ hsCode: event.target.value })}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-unit">{t("forms.product.unit")}</Label>
                <Input
                  id="product-unit"
                  value={productForm?.unit || ""}
                  onChange={(event) => updateProductForm({ unit: event.target.value })}
                  disabled={isBusy}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-site">{t("forms.product.productionSite")}</Label>
              <Input
                id="product-site"
                value={productForm?.productionSite || ""}
                onChange={(event) => updateProductForm({ productionSite: event.target.value })}
                disabled={isBusy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-volume">{t("forms.product.exportVolume")}</Label>
              <Input
                id="product-volume"
                type="number"
                step="any"
                min="0"
                value={productForm?.exportVolume || ""}
                onChange={(event) => updateProductForm({ exportVolume: event.target.value })}
                disabled={isBusy}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setProductForm(null)} disabled={isBusy}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isBusy}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDocumentRemoveId !== null}
        onOpenChange={(isOpen) => (!isOpen ? setPendingDocumentRemoveId(null) : null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("removeDocument.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("removeDocument.description")}
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPendingDocumentRemoveId(null)} disabled={isBusy}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemoveDocument} disabled={isBusy}>
              {t("common.remove")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingProductRemoveId !== null}
        onOpenChange={(isOpen) => (!isOpen ? setPendingProductRemoveId(null) : null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("removeProduct.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("removeProduct.description")}
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPendingProductRemoveId(null)} disabled={isBusy}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemoveProduct} disabled={isBusy}>
              {t("common.remove")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ComplianceDetailModal;
