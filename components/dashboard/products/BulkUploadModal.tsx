import React, { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAppRoutes } from "@/lib/demo/routes";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck,
  FileSpreadsheet,
  Leaf,
  Loader2,
  Package,
  Upload
} from "lucide-react";
import {
  BULK_UPLOAD_STEPS,
  type BulkUploadStep,
  type BulkProductRow,
  type ValidationError,
  type ValidationResult
} from "./types";
import { generateTemplate } from "./template";
import { parseFile, validateAndTransformData } from "./validation";
import { calculateBulkCarbon, calculateCarbonForProduct } from "./carbonCalculation";
import ValidationResults from "./ValidationResults";
import PreviewTable from "./PreviewTable";
import {
  fetchAllProducts,
  formatApiErrorMessage,
  importProductsBulkRows,
  validateProductsBulkImport,
  type BulkImportResult
} from "@/lib/productsApi";
import {
  applyComplianceAvailabilityToRows,
  buildExistingSkuWarnings,
  loadComplianceAvailability,
  mapBulkRowToApiPayload,
  mergeValidationWarnings,
  normalizeDestinationMarket,
  normalizeSku
} from "./bulkUploadHelpers";
interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
  starterDomesticMarket?: string | null;
}

const STEP_LABEL_KEYS: Record<BulkUploadStep["id"], string> = {
  upload: "steps.upload.label",
  validate: "steps.validate.label",
  preview: "steps.preview.label",
  processing: "steps.processing.label",
  complete: "steps.complete.label"
};

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  open,
  onClose,
  onCompleted,
  starterDomesticMarket
}) => {
  const t = useTranslations("products.bulkUpload");
  const displayLocale = "vi-VN";
  const navigate = useRouter();
  const appRoutes = useAppRoutes();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationResult, setValidationResult] =
  useState<ValidationResult | null>(null);
  const [processedRows, setProcessedRows] = useState<BulkProductRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendValidationPassed, setBackendValidationPassed] = useState(false);
  const normalizedStarterDomesticMarket =
  normalizeDestinationMarket(starterDomesticMarket);
  const starterDomesticOnly = normalizedStarterDomesticMarket.length > 0;

  const resetState = useCallback(() => {
    setCurrentStep(0);
    setFile(null);
    setDragOver(false);
    setValidationResult(null);
    setProcessedRows([]);
    setIsProcessing(false);
    setImportProgress(0);
    setImportedCount(0);
    setImportResult(null);
    setError(null);
    setBackendValidationPassed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const processSelectedFile = useCallback(
    async (selectedFile: File) => {

      const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv"];


      if (
      !validTypes.includes(selectedFile.type) &&
      !selectedFile.name.match(/\.(xlsx|xls|csv)$/i))
      {
        setError(t("errors.invalidFileType"));
        return;
      }

      setFile(selectedFile);
      setError(null);
      setBackendValidationPassed(false);
      setIsProcessing(true);

      try {
        const rawData = await parseFile(selectedFile);

        if (rawData.length === 0) {
          setError(t("errors.emptyFile"));
          setIsProcessing(false);
          return;
        }

        let result = validateAndTransformData(rawData);

        if (starterDomesticOnly && result.validRows.length > 0) {
          const overriddenRows = result.validRows.filter(
            (row) => row.marketType !== "domestic" || Boolean(row.exportCountry)
          ).length;

          if (overriddenRows > 0) {
            toast.warning(
              `Gói Trial: đã chuyển ${overriddenRows} dòng xuất khẩu sang nội địa.`
            );
          }

          result = {
            ...result,
            validRows: result.validRows.map((row) => ({
              ...row,
              marketType: "domestic",
              exportCountry: undefined,
              exportComplianceDocuments: undefined
            }))
          };
        }

        if (result.validRows.length > 0) {
          const complianceAvailability = await loadComplianceAvailability();
          const normalizedByCompliance = applyComplianceAvailabilityToRows(
            result.validRows,
            complianceAvailability,
            starterDomesticOnly ? normalizedStarterDomesticMarket : null
          );
          result = {
            ...result,
            validRows: normalizedByCompliance.rows
          };
          if (normalizedByCompliance.warnings.length > 0) {
            result = mergeValidationWarnings(result, normalizedByCompliance.warnings);
          }

          try {
            const existingProducts = await fetchAllProducts();
            const existingSkus = new Set(
              existingProducts.
              map((product) => normalizeSku(product.productCode || "")).
              filter((sku) => sku.length > 0)
            );

            const duplicateSkuWarnings = buildExistingSkuWarnings(
              result.validRows,
              existingSkus,
              (sku) => t("warnings.skuExists", { sku })
            );
            if (duplicateSkuWarnings.length > 0) {
              result = mergeValidationWarnings(result, duplicateSkuWarnings);
              toast.warning(
                t("warnings.duplicateSkuDetected", { count: duplicateSkuWarnings.length })
              );
            }
          } catch {

          }

          try {
            const backendValidation = await validateProductsBulkImport(
              result.validRows.map((row) =>
                mapBulkRowToApiPayload(
                  row,
                  starterDomesticOnly ? normalizedStarterDomesticMarket : null
                )
              )
            );

            if (backendValidation.warnings.length > 0) {
              const backendWarnings: ValidationError[] =
              backendValidation.warnings.map((warning) => ({
                row: warning.row || 1,
                field: warning.field || "general",
                message: warning.message,
                severity: "warning"
              }));
              result = mergeValidationWarnings(result, backendWarnings);
            }

            if (backendValidation.invalidRows.length > 0) {
              const invalidIndexes = new Set(
                backendValidation.invalidRows.map((invalidRow) => invalidRow.row)
              );
              const backendInvalidRows = backendValidation.invalidRows.map((invalidRow) => {
                const source = result.validRows[invalidRow.row - 1];
                const displayRow = source?.sourceRow || invalidRow.row;
                return {
                  row: displayRow,
                  data: source || {},
                  errors: invalidRow.errors.map((validationItem) => ({
                    row: displayRow,
                    field: validationItem.field || "general",
                    message: validationItem.message,
                    severity: "error" as const
                  }))
                };
              });
              const remainingRows = result.validRows.filter(
                (_row, index) => !invalidIndexes.has(index + 1)
              );
              const invalidRows = [...result.invalidRows, ...backendInvalidRows];
              result = {
                ...result,
                isValid: invalidRows.length === 0,
                validRows: remainingRows,
                invalidRows,
                validCount: remainingRows.length,
                errorCount: invalidRows.length
              };
            }

            setBackendValidationPassed(true);

            if (
            backendValidation.errorCount > 0 ||
            backendValidation.warningCount > 0)
            {
              toast.warning(
                t("warnings.backendValidationSummary", {
                  errors: backendValidation.errorCount,
                  warnings: backendValidation.warningCount
                })
              );
            }
          } catch (validationError) {
            const message = formatApiErrorMessage(
              validationError,
              t("errors.validateApiFallback")
            );
            setBackendValidationPassed(false);
            setError(message);
            toast.error(message);
          }
        }

        setValidationResult(result);
        setCurrentStep(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.readFile"));
      } finally {
        setIsProcessing(false);
      }
    },
    [normalizedStarterDomesticMarket, starterDomesticOnly, t]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        void processSelectedFile(selectedFile);
      }
    },
    [processSelectedFile]
  );

  const handleDownloadTemplate = useCallback((format: "xlsx" | "csv") => {
    void generateTemplate(format);
  }, []);

  const handleProceedToPreview = useCallback(() => {
    if (!validationResult || !backendValidationPassed) return;

    setIsProcessing(true);
    const calculatedRows = calculateBulkCarbon(validationResult.validRows);
    setProcessedRows(calculatedRows);
    setCurrentStep(2);
    setIsProcessing(false);
  }, [backendValidationPassed, validationResult]);

  const handleImportProducts = useCallback(async () => {
    if (processedRows.length === 0 || !backendValidationPassed || isProcessing) return;

    setCurrentStep(3);
    setIsProcessing(true);
    setImportProgress(20);
    setError(null);

    try {
      const payloadRows = processedRows.map((row) =>
        mapBulkRowToApiPayload(
          row,
          starterDomesticOnly ? normalizedStarterDomesticMarket : null
        )
      );
      setImportProgress(60);
      const result = await importProductsBulkRows(payloadRows, "draft");

      setImportProgress(100);
      setImportedCount(result.imported);
      setImportResult(result);
      setCurrentStep(4);

      if (result.failed > 0) {
        toast.warning(t("warnings.partialImport", { imported: result.imported, failed: result.failed }));
      } else {
        toast.success(t("success.importSuccess", { imported: result.imported }));
      }

      onCompleted?.();
    } catch (importError) {
      setCurrentStep(2);
      setError(formatApiErrorMessage(importError, t("errors.importFailed")));
      toast.error(formatApiErrorMessage(importError, t("errors.importFailed")));
      } finally {
      setIsProcessing(false);
    }
  }, [
    normalizedStarterDomesticMarket,
    backendValidationPassed,
    isProcessing,
    onCompleted,
    processedRows,
    starterDomesticOnly,
    t
  ]);

  const handleViewProducts = useCallback(() => {
    handleClose();
    navigate.push(appRoutes.toAppPath("/products"));
  }, [appRoutes, handleClose, navigate]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            {starterDomesticOnly &&
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Gói Trial chỉ hỗ trợ dữ liệu nội địa. Nếu file có dòng xuất khẩu, hệ thống sẽ chuyển về nội địa.
              </div>
            }
            <div className="bg-muted/50 rounded-lg p-4 border border-dashed">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-8 h-8 text-primary shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{t("template.title")}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("template.description")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void handleDownloadTemplate("xlsx");
                      }}>

                      <Download className="w-4 h-4 mr-1" /> {t("template.downloadExcel")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void handleDownloadTemplate("csv");
                      }}>

                      <Download className="w-4 h-4 mr-1" /> {t("template.downloadCsv")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200
                ${
                  dragOver
                    ? "border-primary bg-primary/10 scale-[0.99]"
                    : file
                      ? "border-primary/80 bg-primary/5"
                      : "border-slate-300 hover:border-primary/60 hover:bg-slate-50/80"
                }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) {
                  void processSelectedFile(droppedFile);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />

              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{t("upload.processingFile")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Đang đọc và phân tích cấu trúc dữ liệu...
                    </p>
                  </div>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm">
                    <FileCheck className="h-7 w-7 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB · Đã sẵn sàng
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-slate-700 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setError(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    {t("upload.selectAnotherFile")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 shadow-sm transition-all group-hover:scale-105 group-hover:bg-primary/15">
                    <Upload className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{t("upload.dropzoneTitle")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("upload.dropzoneDescription")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        );


      case 1:
        return (
          <div className="space-y-4">
            {validationResult &&
            <>
                <ValidationResults result={validationResult} />

                {validationResult.validCount > 0 &&
              <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> {t("actions.uploadAnother")}
                    </Button>
                    <Button
                  onClick={handleProceedToPreview}
                  disabled={isProcessing || !backendValidationPassed}>

                      {isProcessing ?
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> :

                  <ArrowRight className="w-4 h-4 mr-1" />
                  }
                      {t("actions.continueWithCount", { count: validationResult.validCount })}
                    </Button>
                  </div>
              }

                {validationResult.validCount === 0 &&
              <div className="flex justify-center pt-4 border-t">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> {t("actions.uploadAnother")}
                    </Button>
                  </div>
              }
              </>
            }
          </div>);


      case 2:
        return (
          <div className="space-y-4">
            {processedRows.length > 0 &&
            <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Package className="w-6 h-6 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold">{processedRows.length}</p>
                    <p className="text-xs text-muted-foreground">{t("stats.products")}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">
                      {processedRows.
                    reduce((sum, r) => sum + r.quantity, 0).
                    toLocaleString(displayLocale)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("stats.totalQuantity")}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Leaf className="w-6 h-6 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold">
                      {processedRows.
                    reduce((sum, r) => sum + (r.calculatedCO2 || 0), 0).
                    toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("stats.co2ePerUnit")}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">
                      {
                    processedRows.filter(
                      (r) => r.confidenceLevel === "high"
                    ).length
                    }
                    </p>
                    <p className="text-xs text-muted-foreground">{t("stats.highConfidence")}</p>
                  </div>
                </div>

                <PreviewTable rows={processedRows} showCarbonData />

                {error &&
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
              }

                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setCurrentStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> {t("actions.back")}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={isProcessing || !backendValidationPassed}
                    onClick={() => void handleImportProducts()}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> {t("actions.importCount", { count: processedRows.length })}
                  </Button>
                </div>
              </>
            }
          </div>);


      case 3:
        return (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="text-center">
                <h3 className="font-medium text-lg">{t("processing.title")}</h3>
                <p className="text-muted-foreground">{t("processing.description")}</p>
              </div>
            </div>
            <Progress value={importProgress} className="h-2" />
          </div>);


      case 4:
        return (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="font-medium text-lg">{t("completed.title")}</h3>
                <p className="text-muted-foreground">
                  {t("completed.description", { count: importedCount })}
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("completed.importedProducts")}</span>
                <Badge variant="default" className="bg-green-600">
                  {importResult?.imported ?? importedCount}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("completed.failedRows")}</span>
                <Badge variant="secondary">{importResult?.failed ?? 0}</Badge>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleClose}>
                {t("actions.close")}
              </Button>
              <Button onClick={handleViewProducts}>
                <Package className="w-4 h-4 mr-1" /> {t("actions.viewProducts")}
              </Button>
            </div>
          </div>);


      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="h-dvh w-screen max-w-[100vw] overflow-y-auto rounded-none p-3 md:max-h-[92vh] md:w-[96vw] md:max-w-[1400px] md:rounded-lg md:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {t("modal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("modal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-6 overflow-x-auto">
          <div className="flex min-w-[560px] items-center justify-between">
            {BULK_UPLOAD_STEPS.map((step, index) =>
            <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      index < currentStep
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : index === currentStep
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`text-xs mt-1.5 font-medium transition-colors ${
                      index === currentStep
                        ? "text-primary font-semibold"
                        : index < currentStep
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {t(STEP_LABEL_KEYS[step.id])}
                  </span>
                </div>
                {index < BULK_UPLOAD_STEPS.length - 1 &&
              <div
                className={`mx-2 h-0.5 flex-1 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />

              }
              </React.Fragment>
            )}
          </div>
        </div>

        {renderStep()}
      </DialogContent>
    </Dialog>);

};

export default BulkUploadModal;
