"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  API_BASE_URL,
  api,
  authTokenStore,
  ensureAccessToken,
  isApiError,
  resolveApiUrl } from
"@/lib/apiClient";
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
  FileText,
  Download,
  Search,
  Package,
  Building2,
  Users,
  Shield,
  BarChart3,
  CheckCircle2,
  Clock,
  History,
  Plus,
  Loader2,
  Trash2 } from
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
import {
  downloadDemoReportFromPath,
  isDemoReportDownloadPath
} from "@/lib/demo/domain/reports";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import { isStandardPlan, normalizeSubscriptionPlan } from "@/lib/subscriptionPlans";
import { isDemoPath } from "@/lib/demo/routes";
import { cn } from "@/lib/utils";
import { toAnalyticsErrorCode, trackEvent } from "@/lib/analytics";
import MobileDataCard from "./mobile/MobileDataCard";

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
type AnalyticsReportDatasetType = "analytics" | "company" | "history" | "products" | "users";

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

const getAnalyticsDatasetType = (type: ReportType): AnalyticsReportDatasetType | undefined => {
  if (type === "product" || type === "products") return "products";
  if (type === "users") return "users";
  if (type === "analytics") return "analytics";
  if (type === "history") return "history";
  if (type === "company") return "company";
  return undefined;
};

const getAnalyticsExportFormat = (value: string): "csv" | "pdf" | "xlsx" => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "csv" || normalized === "pdf") {
    return normalized;
  }
  return "xlsx";
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

const REPORT_NOT_READY_CODE = "REPORT_NOT_READY";
const PLACEHOLDER_EXPORT_CODE = "PLACEHOLDER_EXPORT";

type ParsedApiError = {
  message: string;
  code?: string;
};

class ReportNotReadyError extends Error {
  readonly code = REPORT_NOT_READY_CODE;

  constructor(message: string) {
    super(message);
    this.name = "ReportNotReadyError";
  }
}

class PlaceholderExportError extends Error {
  readonly code = PLACEHOLDER_EXPORT_CODE;

  constructor() {
    super(PLACEHOLDER_EXPORT_CODE);
    this.name = "PlaceholderExportError";
  }
}

const isReportNotReadyError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error instanceof ReportNotReadyError) {
    return true;
  }

  const errorWithCode = error as Error & { code?: string };
  if (errorWithCode.code === REPORT_NOT_READY_CODE) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("report_not_ready") ||
    (message.includes("not ready") && message.includes("report")) ||
    message.includes("current status: processing")
  );
};

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

const parseErrorPayloadObject = (
payload: Record<string, unknown>,
fallbackMessage = "Request failed."
): ParsedApiError | null => {
  const message =
    typeof payload.message === "string" && payload.message.trim().length > 0 ?
    payload.message :
    null;
  const code =
    typeof payload.code === "string" && payload.code.trim().length > 0 ?
    payload.code :
    undefined;
  if (message || code) {
    return { message: message || fallbackMessage, code };
  }

  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return { message: payload.error };
  }
  if (isObject(payload.error)) {
    const nestedMessage =
      typeof payload.error.message === "string" &&
      payload.error.message.trim().length > 0 ?
      payload.error.message :
      null;
    const nestedCode =
      typeof payload.error.code === "string" &&
      payload.error.code.trim().length > 0 ?
      payload.error.code :
      undefined;
    if (nestedMessage || nestedCode) {
      return { message: nestedMessage || fallbackMessage, code: nestedCode };
    }
  }

  return null;
};

const parseApiErrorFromText = (value: string): ParsedApiError | null => {
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  if (!(raw.startsWith("{") || raw.startsWith("["))) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as unknown;
    if (typeof payload === "string" && payload.trim().length > 0) {
      return { message: payload };
    }
    if (isObject(payload)) {
      return parseErrorPayloadObject(payload);
    }
  } catch {
    return null;
  }

  return null;
};

const isLikelyCsvText = (value: string) => {
  const text = value.trim();
  if (!text) {
    return false;
  }

  const lower = text.toLowerCase();
  if (
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    lower.startsWith("{") ||
    lower.startsWith("[")
  ) {
    return false;
  }

  if (text.includes("\0")) {
    return false;
  }

  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const hasDelimiter = [",", ";", "\t"].some((delimiter) => firstLine.includes(delimiter));
  if (hasDelimiter) {
    return true;
  }

  return /\r?\n/.test(text);
};

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const isApiOriginUrl = (value: string) => {
  try {
    return new URL(value).origin === new URL(API_BASE_URL).origin;
  } catch {
    return false;
  }
};

const isExternalDownloadUrl = (value: string) =>
isAbsoluteHttpUrl(value) && !isApiOriginUrl(value);

const isDemoAssetsPath = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith("/demo-assets/")) {
    return true;
  }

  if (!isAbsoluteHttpUrl(trimmed)) {
    return false;
  }

  try {
    return new URL(trimmed).pathname.startsWith("/demo-assets/");
  } catch {
    return false;
  }
};

const isDirectDownloadUrl = (value: string) =>
  isExternalDownloadUrl(value) ||
  value.startsWith("data:") ||
  value.startsWith("blob:") ||
  isDemoAssetsPath(value);

const triggerExternalDownload = (url: string) => {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const parseApiErrorResponse = async (response: Response): Promise<ParsedApiError> => {
  const fallbackMessage = "Request failed.";
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as unknown;
      if (typeof payload === "string" && payload.trim().length > 0) {
        return { message: payload };
      }
      if (isObject(payload)) {
        const parsed = parseErrorPayloadObject(payload, fallbackMessage);
        if (parsed) {
          return parsed;
        }
      }
    } catch {
      return { message: fallbackMessage };
    }
  }

  try {
    const text = await response.text();
    return { message: text.trim().length > 0 ? text : fallbackMessage };
  } catch {
    return { message: fallbackMessage };
  }
};

const parseFilenameFromDisposition = (disposition: string | null) => {
  if (!disposition) return null;
  const match = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i
  );
  const raw = match?.[1] || match?.[2];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const sanitizeFilename = (value: string) =>
value.
replace(/[^\w.-]+/g, "_").
replace(/^_+|_+$/g, "") ||
"report";

const withXlsxExtension = (filename: string) => {
  const safeName = sanitizeFilename(filename);
  if (safeName.toLowerCase().endsWith(".xlsx")) {
    return safeName;
  }
  return safeName.replace(/\.[^./\\]+$/, "") + ".xlsx";
};

const hasZipSignature = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
};

const hasPdfSignature = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
};

const isPlaceholderCsvExport = (csvText: string) =>
csvText.toLowerCase().includes("placeholder-generated-in-dev");

const convertCsvBlobToXlsx = async (blob: Blob) => {
  const csvText = await blob.text();
  if (isPlaceholderCsvExport(csvText)) {
    throw new PlaceholderExportError();
  }
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(csvText, {
    type: "string",
    raw: false,
    codepage: 65001
  });
  const binary = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx"
  });
  return new Blob([binary], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
};

const extractDownloadPathFromPayload = (payload: unknown): string | null => {
  if (!isObject(payload)) return null;

  const directPathCandidate =
    payload.download_url ??
    payload.downloadUrl ??
    payload.file_url ??
    payload.fileUrl ??
    payload.url;
  if (typeof directPathCandidate === "string" && directPathCandidate.trim().length > 0) {
    return directPathCandidate;
  }

  const dataPayload = isObject(payload.data) ? payload.data : null;
  if (!dataPayload) return null;

  const nestedPathCandidate =
    dataPayload.download_url ??
    dataPayload.downloadUrl ??
    dataPayload.file_url ??
    dataPayload.fileUrl ??
    dataPayload.url;

  if (typeof nestedPathCandidate === "string" && nestedPathCandidate.trim().length > 0) {
    return nestedPathCandidate;
  }

  return null;
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

const getQuickExportCardTone = (type: ReportDatasetType) => {
  switch (type) {
    case "products":
      return {
        cardClassName: "border-slate-200 bg-white",
        iconClassName: "bg-slate-100 text-slate-700",
        countClassName: "text-slate-700"
      };
    case "users":
      return {
        cardClassName: "border-slate-200 bg-white",
        iconClassName: "bg-slate-100 text-slate-700",
        countClassName: "text-slate-700"
      };
    case "analytics":
      return {
        cardClassName: "border-slate-200 bg-white",
        iconClassName: "bg-slate-100 text-slate-700",
        countClassName: "text-slate-700"
      };
    case "history":
      return {
        cardClassName: "border-slate-200 bg-white",
        iconClassName: "bg-slate-100 text-slate-700",
        countClassName: "text-slate-700"
      };
    default:
      return {
        cardClassName: "border-slate-200 bg-white",
        iconClassName: "bg-slate-100 text-slate-700",
        countClassName: "text-slate-700"
      };
  }
};

const ReportsPage: React.FC = () => {
  const t = useTranslations("reports");
  const locale = useLocale();
  const { setPageTitle } = useDashboardTitle();
  const { canMutate } = usePermissions();
  const { currentPlan } = useSubscriptionLock();
  const [hasHydrated, setHasHydrated] = useState(false);
  const effectivePlan = hasHydrated ? currentPlan : null;
  const normalizedPlan = normalizeSubscriptionPlan(effectivePlan, "free");
  const hasStandardReportingAccess = isStandardPlan(effectivePlan);
  const standardPlanLabel = normalizedPlan.replace(/_/g, " ").toUpperCase();


  const REPORT_TYPES = useMemo(
    () => [
      {
        id: "products" as AnalyticsReportDatasetType,
        label: t("types.product.label"),
        icon: Package,
        description: t("types.product.description"),
        countKey: "products" as keyof typeof exportSourceCounts
      },
      {
        id: "users" as AnalyticsReportDatasetType,
        label: t("types.users.label"),
        icon: Users,
        description: t("types.users.description"),
        countKey: "users" as keyof typeof exportSourceCounts
      },
      {
        id: "analytics" as AnalyticsReportDatasetType,
        label: t("types.analytics.label"),
        icon: BarChart3,
        description: t("types.analytics.description"),
        countKey: "products" as keyof typeof exportSourceCounts
      },
      {
        id: "history" as AnalyticsReportDatasetType,
        label: t("types.history.label"),
        icon: History,
        description: t("types.history.description"),
        countKey: "history" as keyof typeof exportSourceCounts
      }
    ],
    [t]
  );

  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isDemoRuntime = isDemoPath(pathname);
  const { user, loading: authLoading, isDemoSession } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"reports" | "export">("reports");
  const ITEMS_PER_PAGE = 4;

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

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

  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(
    null
  );
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [pendingDeleteReport, setPendingDeleteReport] = useState<Pick<
    ReportItem,
    "id" | "title"
  > | null>(null);
  const [exportingDataset, setExportingDataset] = useState<string | null>(null);

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
  const [showExportHistory, setShowExportHistory] = useState(false);

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

  const downloadFileFromPath = useCallback(
    async (targetPath: string, fallbackFileName: string) => {
      const fetchFileFromPath = async (
        path: string,
        visitedPaths = new Set<string>()
      ): Promise<void> => {
        const normalizedPath = path.trim();
        if (!normalizedPath) {
          throw new Error(t("errors.downloadPathEmpty"));
        }

        if (visitedPaths.has(normalizedPath)) {
          throw new Error(t("errors.downloadMetadataLoop"));
        }
        visitedPaths.add(normalizedPath);

        if (isDemoReportDownloadPath(normalizedPath)) {
          await downloadDemoReportFromPath(normalizedPath, {
            locale
          });
          return;
        }

        if (isDirectDownloadUrl(normalizedPath)) {
          triggerExternalDownload(normalizedPath);
          return;
        }

        if (isDemoRuntime) {
          throw new Error(t("errors.reportFileUnavailable"));
        }

        const accessToken = (await ensureAccessToken()) || authTokenStore.getAccessToken();
        const response = await fetch(resolveApiUrl(normalizedPath), {
          method: "GET",
          credentials: "include",
          headers: accessToken ?
          {
            Authorization: `Bearer ${accessToken}`
          } :
          undefined
        });

        if (!response.ok) {
          const parsedError = await parseApiErrorResponse(response);
          if (
            response.status === 409 &&
            (
              parsedError.code === REPORT_NOT_READY_CODE ||
              parsedError.message.toLowerCase().includes("not ready"))
          )
          {
            throw new ReportNotReadyError(parsedError.message);
          }
          throw new Error(parsedError.message);
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          let payload: unknown = null;
          try {
            payload = await response.json();
          } catch {
            throw new Error(t("errors.downloadInvalidJson"));
          }

          const nestedPath = extractDownloadPathFromPayload(payload);
          if (nestedPath && nestedPath.trim() !== normalizedPath) {
            if (isDemoReportDownloadPath(nestedPath)) {
              await downloadDemoReportFromPath(nestedPath, {
                locale
              });
              return;
            }
            if (isDirectDownloadUrl(nestedPath)) {
              triggerExternalDownload(nestedPath);
              return;
            }
            await fetchFileFromPath(nestedPath, visitedPaths);
            return;
          }

          const payloadMessage =
            isObject(payload) && typeof payload.message === "string" && payload.message.trim().length > 0 ?
            payload.message :
            isObject(payload) &&
            isObject(payload.error) &&
            typeof payload.error.message === "string" &&
            payload.error.message.trim().length > 0 ?
            payload.error.message :
            t("errors.downloadMetadataAsJson");
          throw new Error(payloadMessage);
        }

        const blob = await response.blob();
        if (blob.size <= 0) {
          throw new Error(t("errors.downloadedEmptyReport"));
        }

        let filename =
        parseFilenameFromDisposition(response.headers.get("content-disposition")) ||
        fallbackFileName;
        let downloadBlob = blob;
        const normalizedContentType = contentType.toLowerCase();
        const lowerFilename = filename.toLowerCase();
        const isCsvResponse =
        lowerFilename.endsWith(".csv") ||
        normalizedContentType.includes("text/csv") ||
        normalizedContentType.includes("application/csv");

        if (isCsvResponse) {
          downloadBlob = await convertCsvBlobToXlsx(blob);
          filename = withXlsxExtension(filename);
        }

        const lowerDownloadFilename = filename.toLowerCase();
        const expectXlsx =
        lowerDownloadFilename.endsWith(".xlsx") ||
        contentType.includes(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        const expectPdf = lowerDownloadFilename.endsWith(".pdf") || contentType.includes("application/pdf");

        if (expectXlsx && !(await hasZipSignature(downloadBlob))) {
          const rawText = await downloadBlob.text();
          const inlineApiError = parseApiErrorFromText(rawText);
          if (inlineApiError) {
            if (
              inlineApiError.code === REPORT_NOT_READY_CODE ||
              inlineApiError.message.toLowerCase().includes("not ready")
            ) {
              throw new ReportNotReadyError(inlineApiError.message);
            }
            throw new Error(inlineApiError.message);
          }

          if (isLikelyCsvText(rawText)) {
            downloadBlob = await convertCsvBlobToXlsx(
              new Blob([rawText], { type: "text/csv;charset=utf-8" })
            );
            filename = withXlsxExtension(filename);
          } else {
            throw new Error(t("errors.invalidXlsxFile"));
          }
        }

        if (expectPdf && !(await hasPdfSignature(downloadBlob))) {
          throw new Error(t("errors.invalidPdfFile"));
        }

        const href = URL.createObjectURL(downloadBlob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => {
          URL.revokeObjectURL(href);
        }, 60_000);
      };

      await fetchFileFromPath(targetPath);
    },
    [isDemoRuntime, locale, t]
  );

  const runDatasetExport = useCallback(
    async (
    dataset: AnalyticsReportDatasetType,
    format: ExportFileFormat,
    label: string) =>
    {
      const analyticsFormat = getAnalyticsExportFormat(format);
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
        trackEvent("report_quick_export_success", {
          dataset_type: dataset,
          format: analyticsFormat
        });
      } catch (error) {
        trackEvent("report_quick_export_error", {
          dataset_type: dataset,
          format: analyticsFormat,
          error_code: toAnalyticsErrorCode(error)
        });
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

  const handleQuickExport = (type: AnalyticsReportDatasetType, label: string) => {
    if (!ensureReportActionAllowed()) {
      return;
    }
    trackEvent("report_quick_export_click", {
      dataset_type: type,
      format: "xlsx"
    });
    if (getDatasetSourceCount(type) <= 0) {
      trackEvent("report_quick_export_error", {
        dataset_type: type,
        format: "xlsx",
        error_code: "no_data"
      });
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
      const analyticsDatasetType = getAnalyticsDatasetType(createForm.type);
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

      trackEvent("report_create_submit", {
        report_type: createForm.type,
        dataset_type: analyticsDatasetType,
        format: createForm.format
      });

      await api.post(REPORTS_ENDPOINT, payload);
      await loadReports(false);

      trackEvent("report_create_success", {
        report_type: createForm.type,
        dataset_type: analyticsDatasetType,
        format: createForm.format
      });
      toast.success(t("toasts.createReportSuccess"));
      setCreateDialogOpen(false);
      resetCreateForm();
    } catch (error) {
      trackEvent("report_create_error", {
        report_type: createForm.type,
        dataset_type: getAnalyticsDatasetType(createForm.type),
        format: createForm.format,
        error_code: toAnalyticsErrorCode(error)
      });
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

  const handleRequestDeleteReport = useCallback(
    (report: Pick<ReportItem, "id" | "title">) => {
      if (!ensureReportActionAllowed()) {
        return;
      }
      setPendingDeleteReport(report);
    },
    [ensureReportActionAllowed]
  );

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

  const handleDownloadReport = async (report: ReportItem) => {
    if (!ensureReportActionAllowed()) {
      return;
    }
    const analyticsFormat = getAnalyticsExportFormat(report.format);
    if (report.status !== "completed") {
      trackEvent("report_download_error", {
        report_type: report.type,
        format: analyticsFormat,
        report_status: report.status,
        error_code: "report_not_ready"
      });
      const statusLabel =
        report.status === "processing" ? t("status.processing") : t("status.failed");
      toast.info(t("errors.reportFileNotReady", { status: statusLabel }));
      await loadReports(false);
      return;
    }

    const candidatePaths = Array.from(
      new Set(
        [report.downloadUrl, `${REPORTS_ENDPOINT}/${report.id}/download`].filter(
          (path): path is string => typeof path === "string" && path.trim().length > 0
        )
      )
    );
    if (candidatePaths.length === 0) {
      trackEvent("report_download_error", {
        report_type: report.type,
        format: analyticsFormat,
        report_status: report.status,
        error_code: "file_unavailable"
      });
      toast.error(t("errors.reportFileUnavailable"));
      return;
    }

    trackEvent("report_download_click", {
      report_type: report.type,
      format: analyticsFormat,
      report_status: report.status
    });
    setDownloadingReportId(report.id);
    try {
      const normalizedFormat = report.format.trim().toLowerCase();
      const extension =
        normalizedFormat === "csv" || normalizedFormat === "pdf" ?
          normalizedFormat :
          "xlsx";
      const fallbackName = `${sanitizeFilename(report.title)}.${extension}`;
      let lastError: unknown = null;

      for (const path of candidatePaths) {
        try {
          await downloadFileFromPath(path, fallbackName);
          trackEvent("report_download_success", {
            report_type: report.type,
            format: analyticsFormat,
            report_status: report.status
          });
          return;
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError instanceof Error) {
        throw lastError;
      }
      throw new Error(t("errors.downloadReportFailed"));
    } catch (error) {
      trackEvent("report_download_error", {
        report_type: report.type,
        format: analyticsFormat,
        report_status: report.status,
        error_code: toAnalyticsErrorCode(error)
      });
      if (isReportNotReadyError(error)) {
        toast.info((error as Error).message);
        await loadReports(false);
        return;
      }
      const message =
        isPlaceholderExportError(error) ?
          t("errors.placeholderExport") :
          error instanceof Error ? error.message : t("errors.downloadReportFailed");
      toast.error(message);
    } finally {
      setDownloadingReportId(null);
    }
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.title.
    toLowerCase().
    includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || report.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredReports.length / ITEMS_PER_PAGE)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, reports.length]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredReports, currentPage]);

const exportHistory = useMemo(
    () =>
    reports.
    filter((report) => EXPORT_DATASET_TYPES.has(report.type)).
    slice(0, 10),
    [reports]
  );

  const processingLabel = t("status.processing");
  const failedLabel = t("status.failed");

  const getStatusLabel = (status: ReportStatus) => {
    switch (status) {
      case "completed":
        return t("ready");
      case "processing":
        return processingLabel;
      default:
        return failedLabel;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "carbon_footprint":
        return <Shield className="w-4 h-4" />;
      case "market_analysis":
        return <BarChart3 className="w-4 h-4" />;
      case "carbon_audit":
        return <Shield className="w-4 h-4" />;
      case "compliance":
        return <FileText className="w-4 h-4" />;
      case "sustainability":
        return <BarChart3 className="w-4 h-4" />;
      case "product":
      case "products":
        return <Package className="w-4 h-4" />;
      case "audit":
        return <Shield className="w-4 h-4" />;
      case "users":
        return <Users className="w-4 h-4" />;
      case "analytics":
        return <BarChart3 className="w-4 h-4" />;
      case "history":
        return <History className="w-4 h-4" />;
      case "company":
        return <Building2 className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const reportTypeFilterOptions: Array<{value: string;label: string;}> = [
  { value: "all", label: t("filterOptions.all") },
  { value: "carbon_footprint", label: getTypeLabel("carbon_footprint", t) },
  { value: "market_analysis", label: getTypeLabel("market_analysis", t) },
  { value: "carbon_audit", label: getTypeLabel("carbon_audit", t) },
  { value: "compliance", label: getTypeLabel("compliance", t) },
  { value: "sustainability", label: getTypeLabel("sustainability", t) },
  { value: "product", label: t("filterOptions.product") },
  { value: "users", label: t("filterOptions.users") },
  { value: "analytics", label: t("filterOptions.analytics") },
  { value: "history", label: t("filterOptions.history") },
  { value: "company", label: t("filterOptions.company") }];

  return (
    <div className="space-y-4 md:space-y-6 no-horizontal-scroll" suppressHydrationWarning>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 md:w-auto">
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "reports" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
              )}
              onClick={() => setActiveTab("reports")}>
              <FileText className="h-4 w-4" />
              {t("tabs.reports")}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "export" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
              )}
              onClick={() => setActiveTab("export")}>
              <Download className="h-4 w-4" />
              {t("tabs.export")}
            </button>
          </div>
          {activeTab === "export" && (
            <Button
              onClick={() => handleQuickExport("company", t("types.company.label"))}
              className="h-11 gap-2 rounded-xl bg-emerald-800 px-4 text-white hover:bg-emerald-900"
              size={isMobile ? "sm" : "default"}>
              <Download className="h-4 w-4" />
              <span>{t("fullReport")}</span>
            </Button>
          )}
        </div>

        {activeTab === "export" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{t("quickExport")}</h3>
              {exportHistory.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowExportHistory((prev) => !prev)}>
                  <Clock className="mr-1.5 h-4 w-4" />
                  {showExportHistory ? t("historyToggle.hide") : t("historyToggle.show")}
                </Button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {REPORT_TYPES.map((type) => {
                const Icon = type.icon;
                const count = getDatasetSourceCount(type.id);
                const hasRows = count > 0;
                const isExporting = exportingDataset === type.id;
                const tone = getQuickExportCardTone(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    className={cn(
                      "group rounded-2xl border p-4 text-left shadow-sm transition-all",
                      tone.cardClassName,
                      hasStandardReportingAccess && hasRows ? "cursor-pointer hover:border-slate-300 hover:shadow-md" : "cursor-not-allowed opacity-75",
                      isExporting && "pointer-events-none opacity-70"
                    )}
                    onClick={() => handleQuickExport(type.id, type.label)}>
                    <div className="flex items-start gap-3">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.iconClassName)}>
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{type.label}</p>
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                            {count}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{isExporting ? t("exporting") : type.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {exportHistory.length > 0 && showExportHistory && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">{t("exportHistory")}</h4>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                    {exportHistory.length}
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {exportHistory.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {exp.status === "processing" ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
                        ) : exp.status === "failed" ? (
                          <Shield className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{exp.title}</p>
                          <p className="truncate text-xs text-slate-600">{exp.date} • {t("records", { count: exp.records })}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                        {exp.format}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder={t("search")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 shadow-none focus-visible:bg-white" />
                </div>
                <div className="w-full sm:w-[180px]">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                      <SelectValue placeholder={t("filterType")} />
                    </SelectTrigger>
                    <SelectContent className="border-slate-200 bg-white">
                      {reportTypeFilterOptions.map((option) => (
                        <SelectItem key={`desktop-${option.value}`} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-11 w-full rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50 md:w-auto"
                onClick={() => {
                  if (!ensureReportActionAllowed()) {
                    return;
                  }
                  resetCreateForm();
                  setCreateDialogOpen(true);
                }}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("createReport")}
              </Button>
            </div>

            {reportsLoading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                  <Card key={index} className="border border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
                        <div className="min-w-0 flex-1">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                        </div>
                      </div>
                      <div className="mt-4 h-8 w-full animate-pulse rounded bg-slate-100" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredReports.length === 0 ? (
              <Card className="border border-dashed border-slate-300 bg-slate-50/70 shadow-none">
                <CardContent className="p-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {reportsError ? t("errors.unableToLoadReports") : t("notFound")}
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    {reportsError || t("notFoundDesc")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {paginatedReports.map((report) => {
                  const isDownloading = downloadingReportId === report.id;
                  const isDeleting = deletingReportId === report.id;
                  const canDownload = report.status === "completed";
                  const statusLabel = getStatusLabel(report.status);
                  return (
                    <Card
                      key={report.id}
                      className="overflow-hidden border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex h-full flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                {getTypeIcon(report.type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="line-clamp-2 text-sm font-semibold text-slate-950">
                                  {report.title}
                                </h4>
                                <Badge variant="outline" className="shrink-0 rounded-full border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                                  {statusLabel}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-slate-600">
                                {report.date} • {t("records", { count: report.records })}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-[10px] text-slate-700">
                              {report.typeLabel}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-[10px] text-slate-700">
                              {report.format}
                            </Badge>
                            {report.co2e !== null && (
                              <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-[10px] text-slate-700">
                                {report.co2e.toFixed(1)} kg CO2e
                              </Badge>
                            )}
                          </div>

                          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg border-slate-200 bg-white px-2.5 text-slate-700 hover:bg-slate-50"
                              onClick={() => handleRequestDeleteReport(report)}
                              disabled={isDeleting}>
                              {isDeleting ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                              )}
                              {t("delete")}
                            </Button>
                            <Button
                              variant={canDownload ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-8 rounded-lg px-2.5",
                                canDownload ? "border-slate-200 bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 bg-white text-slate-500"
                              )}
                              onClick={() => handleDownloadReport(report)}
                              disabled={isDownloading || isDeleting || !canDownload || !hasStandardReportingAccess}>
                              {isDownloading ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="mr-1 h-3.5 w-3.5" />
                              )}
                              {t("download")}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {filteredReports.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}>
                  {t("pagination.prev")}
                </Button>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {t("pagination.page", { current: currentPage, total: totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}>
                  {t("pagination.next")}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

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

