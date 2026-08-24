"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  api,
  API_BASE_URL,
  authTokenStore,
  isApiError
} from "@/lib/apiClient";
import { showNoPermissionToast } from "@/lib/noPermissionToast";
import {
  Card,
  CardContent } from
"@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";
import {
  FileSpreadsheet,
  Download,
  Package,
  Activity,
  Users,
  Shield,
  History,
  Loader2,
  Eye,
  Layers,
  Building2,
  ClipboardCheck,
  Leaf,
  FileBarChart,
  BadgeCheck } from
"lucide-react";

import { toast } from "sonner";
import {
  fetchReportExportSourceCounts,
  fetchReportExportSourceCount,
  getDefaultReportExportSourceCounts,
  exportDataset,
  exportFullStandardReport,
  type ExportFileFormat,
  type ReportDatasetType } from
"../../../lib/reportsApi";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import { isStandardPlan, normalizeSubscriptionPlan } from "@/lib/subscriptionPlans";
import { isDemoPath } from "@/lib/demo/routes";
import { downloadDemoReportFromPath } from "@/lib/demo/domain/reports";
import { cn } from "@/lib/utils";import MobileDataCard from "./mobile/MobileDataCard";
const ReportPreviewModal = dynamic(() => import("./ReportPreviewModal"), { ssr: false });
// CBAM pre-audit tool is heavy (loads invoices/evidence/calcs); only load it when its
// tab is selected. Merged in from the former standalone /cbam-report page.
const CbamReportSection = dynamic(
  () => import("@/components/dashboard/cbam/CbamReportSection"),
  { ssr: false }
);

type ReportCategory = "esg" | "ghg" | "cbam" | "iso";

const REPORT_CATEGORIES = [
  { key: "esg" as const, label: "ESG", icon: Leaf, desc: "Phát triển bền vững & sẵn sàng tuân thủ" },
  { key: "ghg" as const, label: "GHG", icon: Building2, desc: "GHG Protocol · Kiểm kê phát thải Scope 1/2/3" },
  { key: "cbam" as const, label: "CBAM", icon: FileBarChart, desc: "EU CBAM pre-audit · 6 tab phỏng theo mẫu EU" },
  { key: "iso" as const, label: "ISO", icon: BadgeCheck, desc: "ISO 14067 · Dấu chân carbon sản phẩm (PCF)" },
];

// Which PDF report card belongs under which standard tab (one primary home each).
const PDF_CARD_CATEGORY: Record<string, ReportCategory> = {
  product: "iso",
  facility: "ghg",
  batch: "cbam",
  compliance: "esg",
};

const isReportCategory = (value: unknown): value is ReportCategory =>
  value === "esg" || value === "ghg" || value === "cbam" || value === "iso";

type ReportType =
"carbon_footprint" |
"market_analysis" |
"carbon_audit" |
"compliance" |
"sustainability" |
"product" |
"products" |
"activity" |
"audit" |
"users" |
"analytics" |
"history" |
"company";

type ReportStatus = "completed" | "processing" | "failed";

// Turbopack/HMR can temporarily keep a stale reference to this component
// while the report list layout is being iterated. Keep the symbol stable.
void MobileDataCard;

interface ReportItem {
  id: string;
  title: string;
  type: ReportType;
  typeLabel: string;
  format: string;
  date: string;
  size: string;
  status: ReportStatus;
  co2e: number | null;
  records: number;
  downloadUrl?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
typeof value === "object" && value !== null;

const REPORTS_ENDPOINT = "/reports";

const PDF_REPORT_TYPE_MAP: Record<string, string> = {
  product: "product_carbon",
  batch: "batch_export",
  facility: "facility_emission",
  compliance: "compliance",
};

const PDF_REPORT_TITLE_MAP: Record<string, string> = {
  product: "Báo cáo PCF Sản phẩm",
  batch: "Báo cáo Lô Xuất khẩu",
  facility: "Báo cáo Phát thải Cơ sở",
  compliance: "Sẵn sàng Tuân thủ",
};

const CREATE_REPORT_TYPE_OPTIONS: ReportType[] = [
"carbon_audit",
"compliance",
"sustainability",
"products",
"users",
"analytics",
"history",
"company"];

const DEFAULT_CREATE_REPORT_TYPE: ReportType = "carbon_audit";

const SUPPORTED_MANUAL_REPORT_TYPES = new Set<ReportType>([
"carbon_audit",
"compliance",
"sustainability"]);

const CREATE_REPORT_FORMAT_OPTIONS = ["xlsx", "csv"] as const;

type CreateReportFormat = (typeof CREATE_REPORT_FORMAT_OPTIONS)[number];

const normalizeFormatLabel = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!normalized) {
    return "XLSX";
  }
  return normalized;
};

const normalizeReportType = (rawType: unknown): ReportType => {
  const value = typeof rawType === "string" ? rawType.toLowerCase() : "";
  if (value === "export_data") return "company";
  if (value === "carbon_footprint") return "carbon_footprint";
  if (value === "market_analysis") return "market_analysis";
  if (value === "carbon_audit") return "carbon_audit";
  if (value === "compliance") return "compliance";
  if (value === "export_declaration") return "compliance";
  if (value === "sustainability") return "sustainability";
  if (value.includes("product")) return "products";
  if (value.includes("activity")) return "activity";
  if (value.includes("audit")) return "audit";
  if (value.includes("user")) return "users";
  if (value.includes("analytic")) return "analytics";
  if (value.includes("history")) return "history";
  return "company";
};

const getExportDatasetType = (type: ReportType): string | null => {
  if (type === "products" || type === "product") return "product";
  if (type === "activity") return "activity";
  if (type === "audit") return "audit";
  if (type === "users") return "users";
  if (type === "analytics") return "analytics";
  if (type === "history") return "history";
  if (type === "company") return "company";
  return null;
};

const normalizeReportStatus = (
rawStatus: unknown)
: ReportStatus => {
  const value = typeof rawStatus === "string" ? rawStatus.toLowerCase() : "";
  if (value.includes("fail") || value.includes("error")) return "failed";
  if (
  value.includes("draft") ||
  value.includes("process") ||
  value.includes("pending"))
  {
    return "processing";
  }
  return "completed";
};

const normalizeDate = (value: unknown) => {
  if (typeof value !== "string") {
    return new Date().toISOString().split("T")[0];
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().split("T")[0];
};

const normalizeSize = (value: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${value.toFixed(1)} MB`;
  }
  return "N/A";
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "N/A";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const normalizeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const PLACEHOLDER_EXPORT_CODE = "PLACEHOLDER_EXPORT";

class PlaceholderExportError extends Error {
  readonly code = PLACEHOLDER_EXPORT_CODE;

  constructor() {
    super(PLACEHOLDER_EXPORT_CODE);
    this.name = "PlaceholderExportError";
  }
}

const isPlaceholderExportError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error instanceof PlaceholderExportError) {
    return true;
  }

  const errorWithCode = error as Error & { code?: string };
  return errorWithCode.code === PLACEHOLDER_EXPORT_CODE;
};
const getTypeLabel = (type: ReportType, t: ReturnType<typeof useTranslations>) => {
  switch (type) {
    case "carbon_footprint":
      return t("typeLabels.carbonFootprint");
    case "market_analysis":
      return t("typeLabels.marketAnalysis");
    case "carbon_audit":
      return t("typeLabels.carbonAudit");
    case "compliance":
      return t("typeLabels.compliance");
    case "sustainability":
      return t("typeLabels.sustainability");
    case "product":
    case "products":
      return t("filterOptions.product");
    case "activity":
      return t("filterOptions.activity");
    case "audit":
      return t("filterOptions.audit");
    case "users":
      return t("filterOptions.users");
    case "analytics":
      return t("filterOptions.analytics");
    case "history":
      return t("filterOptions.history");
    default:
      return t("filterOptions.company");
  }
};

const normalizeReportsPayload = (
payload: unknown,
t: ReturnType<typeof useTranslations>)
: ReportItem[] => {
  let reportsArray: unknown[] = [];

  if (Array.isArray(payload)) {
    reportsArray = payload;
  } else if (isObject(payload)) {
    if (Array.isArray(payload.reports)) {
      reportsArray = payload.reports;
    } else if (Array.isArray(payload.items)) {
      reportsArray = payload.items;
    } else if (Array.isArray(payload.data)) {
      reportsArray = payload.data;
    }
  }

  return reportsArray.
  filter(isObject).
  map((item, index) => {
    const metadata = isObject(item.metadata) ? item.metadata : undefined;
    const filters = isObject(item.filters) ? item.filters : undefined;
    const rawType = item.report_type || item.type || item.category;
    const exportDatasetType =
      item.dataset_type ||
      metadata?.dataset_type ||
      metadata?.datasetType ||
      filters?.dataset_type ||
      filters?.datasetType;
    const type = normalizeReportType(
      rawType === "export_data" ? exportDatasetType || rawType : rawType
    );
    const records = normalizeNumber(
      item.records ||
      item.record_count ||
      item.total_records ||
      metadata?.record_count ||
      metadata?.total_records
    );
    const co2eRaw =
    item.co2e ||
    item.total_co2e ||
    item.totalCO2 ||
    item.total_co2e_kg ||
    metadata?.total_co2e ||
    metadata?.co2e;
    const co2e =
    co2eRaw === null || typeof co2eRaw === "undefined" ?
    null :
    normalizeNumber(co2eRaw);
    const status = normalizeReportStatus(item.status || item.report_status);
    const rawReportId =
    item.id ??
    item.report_id ??
    item.reportId ??
    item.uuid ??
    item._id;
    const reportId =
    typeof rawReportId === "string" && rawReportId ||
    typeof rawReportId === "number" && Number.isFinite(rawReportId) && String(rawReportId) ||
    isObject(rawReportId) &&
    typeof rawReportId.$oid === "string" && rawReportId.$oid ||
    `report-${index}`;
    const explicitDownloadUrl =
    typeof item.download_url === "string" && item.download_url ||
    typeof item.downloadUrl === "string" && item.downloadUrl ||
    typeof item.file_url === "string" && item.file_url ||
    typeof item.fileUrl === "string" && item.fileUrl;
    const fileSizeBytes = normalizeNumber(
      item.file_size_bytes || metadata?.file_size_bytes,
      NaN
    );
    const fallbackSizeValue =
    typeof item.file_size_mb === "number" && Number.isFinite(item.file_size_mb) ?
    `${item.file_size_mb.toFixed(1)} MB` :
    item.file_size || item.size || metadata?.file_size;
    const downloadUrl =
    explicitDownloadUrl || (
    status === "completed" ?
    `${REPORTS_ENDPOINT}/${reportId}/download` :
    undefined);

    return {
      id: reportId,
      title:
      typeof item.title === "string" && item.title ||
      typeof item.name === "string" && item.name ||
      t("fullReport"),
      type,
      typeLabel: getTypeLabel(type, t),
      format: normalizeFormatLabel(item.file_format || item.format),
      date: normalizeDate(item.generated_at || item.created_at || item.date),
      size: Number.isFinite(fileSizeBytes) ?
      formatBytes(fileSizeBytes) :
      normalizeSize(fallbackSizeValue),
      status,
      co2e,
      records,
      downloadUrl
    };
  }).
  filter((report) => report.type !== "activity" && report.type !== "audit");
};

const EXPORT_DATASET_TYPES = new Set<ReportType>([
"products",
"users",
"history",
"analytics",
"company"]);

const ReportsPage: React.FC = () => {
  const t = useTranslations("reports");
  const locale = "vi";
  const { setPageTitle } = useDashboardTitle();
  const { canMutate } = usePermissions();
  const { currentPlan } = useSubscriptionLock();
  const [hasHydrated, setHasHydrated] = useState(false);
  const effectivePlan = hasHydrated ? currentPlan : null;
  const normalizedPlan = normalizeSubscriptionPlan(effectivePlan, "free");
  const hasStandardReportingAccess = isStandardPlan(effectivePlan);
  const standardPlanLabel = normalizedPlan.replace(/_/g, " ").toUpperCase();

  const pathname = usePathname();
  const isDemoRuntime = isDemoPath(pathname);
  const { user, loading: authLoading, isDemoSession } = useAuth();

  // Report standard tabs (ESG / GHG / CBAM / ISO). The former standalone
  // /cbam-report page now redirects here with ?tab=cbam.
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<ReportCategory>(() => {
    const tab = searchParams?.get("tab");
    return isReportCategory(tab) ? tab : "esg";
  });

  const [previewOpen, setPreviewOpen] = useState(false);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [, setReportsLoading] = useState(true);
  const [, setReportsError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{
    title: string;
    type: ReportType;
    format: CreateReportFormat;
  }>({
    title: "",
    type: DEFAULT_CREATE_REPORT_TYPE,
    format: "xlsx"
  });

  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [pendingDeleteReport, setPendingDeleteReport] = useState<Pick<
    ReportItem,
    "id" | "title"
  > | null>(null);
  const [exportingDataset, setExportingDataset] = useState<string | null>(null);

  // PDF report generation state: cardKey → 'idle' | 'generating' | 'done' | 'error'
  const [pdfGenState, setPdfGenState] = useState<Record<string, "idle" | "generating" | "done" | "error">>({});

  const [exportSourcesLoaded, setExportSourcesLoaded] = useState(false);
  const [exportSourceCounts, setExportSourceCounts] = useState(
    getDefaultReportExportSourceCounts()
  );
  const [extraExportSourceCounts, setExtraExportSourceCounts] = useState<{
    analytics: number;
    company: number | null;
  }>({
    analytics: 0,
    company: null
  });

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const hasStoredAuthToken = Boolean(
    authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
  );
  const canLoadProtectedReportData =
    !authLoading && (isDemoRuntime || isDemoSession || (Boolean(user) && hasStoredAuthToken));

  const isMissingAuthError = useCallback((error: unknown) => {
    if (isApiError(error)) {
      if (error.status === 401) return true;
      const code = String(error.code || "").toUpperCase();
      if (code === "UNAUTHORIZED" || code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") {
        return true;
      }
    }

    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes("no token provided") ||
      message.includes("unauthorized") ||
      message.includes("invalid token")
    );
  }, []);

  const totalExportSourceCount = useMemo(
    () =>
      exportSourceCounts.products +
      exportSourceCounts.users +
      exportSourceCounts.history +
      extraExportSourceCounts.analytics,
    [
      exportSourceCounts.products,
      exportSourceCounts.users,
      exportSourceCounts.history,
      extraExportSourceCounts.analytics
    ]
  );

  const getDatasetSourceCount = useCallback(
    (dataset: ReportDatasetType) => {
      if (dataset === "company") {
        return extraExportSourceCounts.company ?? totalExportSourceCount;
      }
      if (dataset === "analytics") {
        return extraExportSourceCounts.analytics;
      }
      if (dataset === "products") return exportSourceCounts.products;
      if (dataset === "users") return exportSourceCounts.users;
      if (dataset === "history") return exportSourceCounts.history;
      return 0;
    },
    [exportSourceCounts, extraExportSourceCounts.analytics, extraExportSourceCounts.company, totalExportSourceCount]
  );

  const isNoDataExportError = useCallback(
    (error: unknown) =>
      error instanceof Error &&
      (
        error.message.toLowerCase().includes("no data available") ||
        error.message.toLowerCase().includes("không có dữ liệu") ||
        error.message.toLowerCase().includes("khong co du lieu") ||
        error.message.toLowerCase().includes("khong co du lieu chuan")
      ),
    []
  );

  const createReportTypeOptions = useMemo(
    () =>
      CREATE_REPORT_TYPE_OPTIONS.filter((type) => {
        if (!EXPORT_DATASET_TYPES.has(type)) {
          return true;
        }
        return getDatasetSourceCount(type as ReportDatasetType) > 0;
      }),
    [getDatasetSourceCount]
  );

  const preferredCreateReportType = useMemo(() => {
    if (createReportTypeOptions.includes(DEFAULT_CREATE_REPORT_TYPE)) {
      return DEFAULT_CREATE_REPORT_TYPE;
    }
    return createReportTypeOptions[0] || DEFAULT_CREATE_REPORT_TYPE;
  }, [createReportTypeOptions]);

  const ensureReportActionAllowed = useCallback(() => {
    if (!canMutate) {
      showNoPermissionToast();
      return false;
    }

    if (!hasStandardReportingAccess) {
      toast.error(
        t("errors.standardPlanRequired", {
          plan: standardPlanLabel
        })
      );
      return false;
    }

    return true;
  }, [canMutate, hasStandardReportingAccess, standardPlanLabel, t]);

  useEffect(() => {
    setPageTitle(t("title"), t("subtitle"));
  }, [setPageTitle, t]);

  const loadReports = useCallback(
    async (withLoader = false) => {
      if (!canLoadProtectedReportData) {
        setReports([]);
        setReportsError(null);
        if (withLoader) {
          setReportsLoading(false);
        }
        return [];
      }

      if (withLoader) {
        setReportsLoading(true);
      }
      setReportsError(null);

      try {
        const payload = await api.get<unknown>(REPORTS_ENDPOINT);
        const loadedReports = normalizeReportsPayload(payload, t);
        setReports(loadedReports);
        return loadedReports;
      } catch (error) {
        if (isMissingAuthError(error)) {
          setReports([]);
          setReportsError(null);
          return [];
        }
        console.error("Failed to load reports:", error);
        setReports([]);
        setReportsError(
          error instanceof Error ?
          error.message :
          t("errors.loadReportsFromServer")
        );
        return [];
      } finally {
        if (withLoader) {
          setReportsLoading(false);
        }
      }
    },
    [canLoadProtectedReportData, isMissingAuthError, t]
  );

  const handleGeneratePdf = useCallback(async (cardKey: string) => {
    if (!ensureReportActionAllowed()) return;
    if (pdfGenState[cardKey] === "generating") return;

    const reportType = PDF_REPORT_TYPE_MAP[cardKey];
    const title = PDF_REPORT_TITLE_MAP[cardKey] || reportType;

    setPdfGenState(prev => ({ ...prev, [cardKey]: "generating" }));

    try {
      const created = await api.post<{ id: string }>("/reports", {
        report_type: reportType,
        title,
        file_format: "pdf",
      });

      const reportId = created?.id;
      if (!reportId) throw new Error("No report ID returned");

      // Poll every 3s for up to 3 minutes
      const MAX_ATTEMPTS = 60;
      let done = false;
      for (let i = 0; i < MAX_ATTEMPTS && !done; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const status = await api.get<{ status: string; download_url?: string; downloadUrl?: string }>(
            `/reports/${reportId}/status`
          );
          if (status?.status === "completed") {
            const demoDownloadPath = status.download_url || status.downloadUrl;
            if (isDemoRuntime && demoDownloadPath) {
              await downloadDemoReportFromPath(demoDownloadPath, {
                locale,
                requestedBy: user?.email || null,
                planLabel: currentPlan,
              });
              setPdfGenState(prev => ({ ...prev, [cardKey]: "idle" }));
              loadReports();
              done = true;
              continue;
            }
            // Fetch with auth header then trigger blob download
            const token = authTokenStore.getAccessToken();
            const res = await fetch(`${API_BASE_URL}/reports/${reportId}/download`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error(`Download failed: ${res.status}`);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = `${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
            setPdfGenState(prev => ({ ...prev, [cardKey]: "idle" }));
            loadReports();
            done = true;
          } else if (status?.status === "failed") {
            setPdfGenState(prev => ({ ...prev, [cardKey]: "error" }));
            done = true;
          }
        } catch {
          setPdfGenState(prev => ({ ...prev, [cardKey]: "error" }));
          done = true;
        }
      }
      if (!done) {
        setPdfGenState(prev => ({ ...prev, [cardKey]: "error" }));
      }
    } catch {
      setPdfGenState(prev => ({ ...prev, [cardKey]: "error" }));
    }
  }, [currentPlan, ensureReportActionAllowed, isDemoRuntime, loadReports, locale, pdfGenState, user?.email]);

  const loadExportSources = useCallback(async () => {
    if (!canLoadProtectedReportData) {
      setExportSourceCounts(getDefaultReportExportSourceCounts());
      setExtraExportSourceCounts({
        analytics: 0,
        company: null
      });
      return;
    }

    try {
      const [counts, analyticsCount, companyCount] = await Promise.all([
        fetchReportExportSourceCounts(),
        fetchReportExportSourceCount("analytics"),
        fetchReportExportSourceCount("company")
      ]);
      setExportSourceCounts(counts);
      setExtraExportSourceCounts({
        analytics: analyticsCount,
        company: companyCount > 0 ? companyCount : null
      });
    } catch (error) {
      if (!isMissingAuthError(error)) {
        console.error("Failed to load report export sources:", error);
      }
      setExportSourceCounts(getDefaultReportExportSourceCounts());
      setExtraExportSourceCounts({
        analytics: 0,
        company: null
      });
    } finally {
      setExportSourcesLoaded(true);
    }
  }, [canLoadProtectedReportData, isMissingAuthError]);

  useEffect(() => {
    if (authLoading) {
      setReportsLoading(true);
      return;
    }
    if (!canLoadProtectedReportData) {
      setReportsLoading(false);
      setReports([]);
      setReportsError(null);
      return;
    }
    void loadReports(true);
  }, [authLoading, canLoadProtectedReportData, loadReports]);

  useEffect(() => {
    if (authLoading || !canLoadProtectedReportData) {
      return;
    }
    if (exportSourcesLoaded) {
      return;
    }
    void loadExportSources();
  }, [authLoading, canLoadProtectedReportData, exportSourcesLoaded, loadExportSources]);

  useEffect(() => {
    if (!createDialogOpen) {
      return;
    }

    if (!createReportTypeOptions.includes(createForm.type)) {
      setCreateForm((prev) => ({
        ...prev,
        type: preferredCreateReportType,
        format: "xlsx"
      }));
      setCreateError(null);
    }
  }, [createDialogOpen, createForm.type, createReportTypeOptions, preferredCreateReportType]);

  useEffect(() => {
    const hasProcessingReport = reports.some((report) => report.status === "processing");
    if (!hasProcessingReport) return;

    const intervalId = window.setInterval(() => {
      void loadReports(false);
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [reports, loadReports]);

  const runDatasetExport = useCallback(
    async (
    dataset: ReportDatasetType,
    format: ExportFileFormat,
    label: string) =>
    {
      setExportingDataset(dataset);
      try {
        const options = {
          locale,
          planLabel: standardPlanLabel,
          fileNamePrefix: dataset === "company" ? "standard_full" : dataset
        };
        const result =
          dataset === "company" ?
            await exportFullStandardReport(format, options) :
            await exportDataset(dataset, format, options);
        const total = result.total;

        toast.success(
          dataset === "company" ?
            t("toasts.fullReportSuccess") :
            t("toasts.success", {
              count: total,
              type: label,
              format: format.toUpperCase()
            })
        );
        } catch (error) {
        if (!isNoDataExportError(error)) {
          console.error("Failed to export dataset:", error);
        }
        const message =
          isPlaceholderExportError(error) ?
            t("errors.placeholderExport") :
            error instanceof Error ? error.message : t("errors.exportDatasetFailed");
        toast.error(message);
      } finally {
        setExportingDataset(null);
      }
    },
    [isNoDataExportError, locale, standardPlanLabel, t]
  );

  const handleQuickExport = (type: ReportDatasetType, label: string) => {
    if (!ensureReportActionAllowed()) {
      return;
    }
    if (getDatasetSourceCount(type) <= 0) {
      toast.info(t("noDataToExport"));
      return;
    }
    void runDatasetExport(type, "xlsx", label);
  };

  const resetCreateForm = () => {
    setCreateError(null);
    setCreateForm({
      title: "",
      type: preferredCreateReportType,
      format: "xlsx"
    });
  };

  const handleCreateReport = async () => {
    if (!ensureReportActionAllowed()) {
      return;
    }
    const title = createForm.title.trim();

    if (!title) {
      const message = t("errors.reportTitleRequired");
      setCreateError(message);
      toast.error(message);
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const exportDatasetType = getExportDatasetType(createForm.type);
      const reportType = exportDatasetType ? "export_data" : createForm.type;
      const payload: Record<string, unknown> = {
        title,
        report_type: reportType,
        file_format: createForm.format
      };
      if (exportDatasetType) {
        payload.filters = {
          dataset_type: exportDatasetType
        };
      } else if (!SUPPORTED_MANUAL_REPORT_TYPES.has(createForm.type)) {
        const message = t("errors.unsupportedReportType");
        setCreateError(message);
        toast.error(message);
        return;
      }

      await api.post(REPORTS_ENDPOINT, payload);
      await loadReports(false);

      toast.success(t("toasts.createReportSuccess"));
      setCreateDialogOpen(false);
      resetCreateForm();
    } catch (error) {
      if (!isNoDataExportError(error)) {
        console.error("Failed to create report:", error);
      }
      const message =
        error instanceof Error ? error.message : t("errors.createReportFailed");
      setCreateError(message);
      toast.error(message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleConfirmDeleteReport = useCallback(
    async (report: Pick<ReportItem, "id" | "title">) => {
      const reportTitle = report.title?.trim() || t("deleteFallbackTitle");
      setDeletingReportId(report.id);
      try {
        await api.delete<{ success: boolean }>(`${REPORTS_ENDPOINT}/${report.id}`);
        setReports((prev) => prev.filter((item) => item.id !== report.id));
        setPendingDeleteReport(null);
        toast.success(t("toasts.deleteSuccess", { title: reportTitle }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("errors.deleteReportFailed");
        toast.error(message);
      } finally {
        setDeletingReportId(null);
      }
    },
    [t]
  );

  const reportSummaryCards = [
    {
      label: "Sản phẩm",
      value: getDatasetSourceCount("products"),
      icon: Package,
      iconClassName: "text-emerald-800"
    },
    {
      label: "Hoạt động",
      value: getDatasetSourceCount("activity"),
      icon: Activity,
      iconClassName: "text-emerald-700"
    },
    {
      label: "Người dùng",
      value: getDatasetSourceCount("users"),
      icon: Users,
      iconClassName: "text-emerald-700"
    },
    {
      label: "Lịch sử tính",
      value: getDatasetSourceCount("history"),
      icon: History,
      iconClassName: "text-red-400"
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6 no-horizontal-scroll" suppressHydrationWarning>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-end">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-emerald-100 bg-white px-4 text-slate-900 hover:bg-emerald-50"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Xem trước báo cáo
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl bg-emerald-800 px-4 text-white hover:bg-emerald-900"
              onClick={() => handleQuickExport("company", t("types.company.label"))}
              disabled={exportingDataset === "company"}
            >
              {exportingDataset === "company" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Báo cáo đầy đủ
            </Button>
          </div>
        </div>

        {isDemoRuntime && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-100 px-3 text-amber-700">
              Demo
            </Badge>
            <span>Tenant: Ego Lism • Dữ liệu export sẽ có metadata demo</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {reportSummaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="rounded-xl border border-emerald-100 bg-white shadow-sm">
                <CardContent className="flex min-h-[112px] flex-col items-center justify-center p-4 text-center">
                  <Icon className={cn("mb-2 h-6 w-6", card.iconClassName)} />
                  <p className="text-2xl font-bold leading-none text-slate-950">{card.value}</p>
                  <p className="mt-1 text-xs text-slate-600">{card.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Report standard tabs: ESG / GHG / CBAM / ISO ────────── */}
        <div className="flex flex-wrap gap-2">
          {REPORT_CATEGORIES.map((category) => {
            const CategoryIcon = category.icon;
            const isActive = activeCategory === category.key;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category.key)}
                aria-pressed={isActive}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-emerald-800 bg-emerald-800 text-white shadow-sm"
                    : "border-emerald-100 bg-white text-slate-700 hover:bg-emerald-50"
                )}
              >
                <CategoryIcon className="h-4 w-4" />
                {category.label}
              </button>
            );
          })}
        </div>

        {/* ── Report cards for the active standard ─────────────────── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <h3 className="text-sm font-semibold text-slate-800">
              {REPORT_CATEGORIES.find((category) => category.key === activeCategory)?.desc ??
                "Loại báo cáo PDF"}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([
              {
                key: "product",
                icon: Package,
                iconBg: "bg-emerald-100 text-emerald-700",
                title: "Báo cáo PCF Sản phẩm",
                desc: locale === "vi"
                  ? "ISO 14067 · Bóc tách Scope 1/2/3 theo từng SKU"
                  : "ISO 14067 · Scope 1/2/3 breakdown per SKU",
              },
              {
                key: "batch",
                icon: Layers,
                iconBg: "bg-blue-100 text-blue-700",
                title: "Báo cáo Lô Xuất khẩu",
                desc: locale === "vi"
                  ? "CBAM-ready · Nhóm sản phẩm theo lô vận chuyển"
                  : "CBAM-ready · Products grouped by shipment batch",
              },
              {
                key: "facility",
                icon: Building2,
                iconBg: "bg-amber-100 text-amber-700",
                title: "Báo cáo Phát thải Cơ sở",
                desc: locale === "vi"
                  ? "GHG Protocol · Scope 1 & 2 toàn nhà máy"
                  : "GHG Protocol · Scope 1 & 2 facility-wide",
              },
              {
                key: "compliance",
                icon: ClipboardCheck,
                iconBg: "bg-purple-100 text-purple-700",
                title: "Sẵn sàng Tuân thủ",
                desc: locale === "vi"
                  ? "EU ESPR/DPP · EPR dệt may · Kiểm kê KNK VN (TT 38/2023/TT-BCT) · Khoảng trống dữ liệu"
                  : "EU ESPR/DPP · Textile EPR · VN GHG inventory (TT 38/2023/TT-BCT) · Data gap analysis",
              },
            ] as const)
              .filter((card) => PDF_CARD_CATEGORY[card.key] === activeCategory)
              .map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.key}
                  className="rounded-xl border border-slate-100 bg-white shadow-sm"
                >
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{card.desc}</p>
                    </div>
                    <div className="mt-auto flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pdfGenState[card.key] === "generating" || !canMutate}
                        onClick={() => handleGeneratePdf(card.key)}
                        className="h-8 flex-1 rounded-lg bg-emerald-800 text-xs text-white hover:bg-emerald-900 disabled:opacity-50"
                      >
                        {pdfGenState[card.key] === "generating" ? (
                          <>
                            <svg className="mr-1.5 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            {"Đang tạo…"}
                          </>
                        ) : pdfGenState[card.key] === "error" ? (
                          <>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            {"Thử lại"}
                          </>
                        ) : (
                          <>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            PDF
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CBAM pre-audit tool (merged from the former /cbam-report page) */}
        {activeCategory === "cbam" && (
          <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm md:p-4">
            <CbamReportSection />
          </div>
        )}

        <Card className="rounded-xl border border-emerald-200 bg-white shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Xem trước Báo cáo Chuẩn (5 phần)</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Dashboard PCF + ISO 14067 + ESG · Kiểm kê KNK (TT 38/2023/TT-BCT) + CBAM EU — bóc tách theo SKU, cùng định dạng chuẩn cho mọi tài khoản.
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="h-11 shrink-0 rounded-xl bg-emerald-800 px-5 text-white hover:bg-emerald-900"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Mở Preview
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-emerald-100 bg-white shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-800" />
              <h3 className="font-semibold text-slate-950">Pre-Audit Pack — Chia sẻ cho kiểm toán viên</h3>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Tạo link chỉ-xem chứa toàn bộ phép tính CO₂e + chứng từ gốc (hóa đơn EVN, ERP) + lô vận chuyển.
              Token có hiệu lực 7 ngày, ký HMAC-SHA256, không thể giả mạo. SGS / Bureau Veritas chỉ cần URL — không cần tài khoản Weave Carbon.
            </p>
            <Button
              type="button"
              className="h-10 w-full rounded-xl bg-emerald-800 text-white hover:bg-emerald-900"
              disabled
            >
              <Shield className="mr-2 h-4 w-4" />
              Tạo Audit Pack link (7 ngày)
            </Button>
          </CardContent>
        </Card>

        <div className="border-t border-emerald-100 bg-emerald-50/40 px-1 py-3 text-xs text-emerald-900">
          <Shield className="mr-2 inline h-3.5 w-3.5 align-[-2px]" />
          Phương pháp toán: 100% ISO 14067:2018. Hệ số phát thải đồng bộ từ Ecoinvent v3.10, DEFRA 2024 và Niên giám Hệ số phát thải của Bộ TN&MT Việt Nam.
        </div>
      </div>

      <ReportPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} />

      <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            if (!open && !createSubmitting) {
              resetCreateForm();
            }
            setCreateDialogOpen(open);
          }}>

          <DialogContent className="h-dvh w-screen max-w-[100vw] rounded-none border border-slate-200 bg-white p-4 sm:h-auto sm:max-w-lg sm:rounded-lg sm:p-6">
            <DialogHeader>
              <DialogTitle>{t("createReport")}</DialogTitle>
              <DialogDescription>
                {t("createReportDesc")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {createError &&
              <p className="text-sm text-slate-600">{createError}</p>
              }
              <div className="space-y-2">
                <Label>{t("createForm.titleLabel")}</Label>
                <Input
                  value={createForm.title}
                  onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    title: e.target.value
                  }))
                  }
                  placeholder={t("createForm.titlePlaceholder")}
                  className="border-slate-200 bg-white"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("createForm.typeLabel")}</Label>
                  <Select
                    value={
                      createReportTypeOptions.includes(createForm.type) ?
                        createForm.type :
                        preferredCreateReportType
                    }
                    onValueChange={(value) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      type: value as ReportType
                    }))
                    }>

                    <SelectTrigger className="border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-200 bg-white">
                      {createReportTypeOptions.map((type) =>
                      <SelectItem key={type} value={type}>
                          {getTypeLabel(type, t)}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("createForm.formatLabel")}</Label>
                  <Select
                    value={createForm.format}
                    onValueChange={(value) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      format: value as CreateReportFormat
                    }))
                    }>

                    <SelectTrigger className="border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-200 bg-white">
                      {CREATE_REPORT_FORMAT_OPTIONS.map((format) =>
                      <SelectItem
                          key={format}
                          value={format}>
                          {format.toUpperCase()}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                disabled={createSubmitting}
                onClick={() => setCreateDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button
                className="bg-slate-900 text-white hover:bg-slate-800"
                disabled={createSubmitting}
                onClick={handleCreateReport}>
                {createSubmitting &&
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                }
                {t("createReport")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(pendingDeleteReport)}
          onOpenChange={(open) => {
            if (!open && !deletingReportId) {
              setPendingDeleteReport(null);
            }
          }}>

          <AlertDialogContent className="w-[92vw] max-w-md border-slate-200 bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteConfirm", {
                  title: pendingDeleteReport?.title?.trim() || t("deleteFallbackTitle")
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingReportId)}>
                {t("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={!pendingDeleteReport || Boolean(deletingReportId)}
                onClick={async (event) => {
                  event.preventDefault();
                  if (!pendingDeleteReport) {
                    return;
                  }
                  await handleConfirmDeleteReport(pendingDeleteReport);
                }}>

                {deletingReportId === pendingDeleteReport?.id &&
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                }
                {t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>);


};

export default ReportsPage;
