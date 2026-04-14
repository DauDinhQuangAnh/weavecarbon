import type { CompanyRole } from "@/lib/permissions";

type AnalyticsAccountType = "admin" | "anonymous" | "b2b" | "b2c";
type AnalyticsCompanyRole = CompanyRole | "none";
export type AnalyticsPageGroup =
  | "auth"
  | "calculator"
  | "export"
  | "landing"
  | "logistics"
  | "onboarding"
  | "other"
  | "overview"
  | "products"
  | "reports"
  | "settings";

export interface AnalyticsContext {
  accountType?: "admin" | "b2b" | "b2c" | null;
  companyRole?: CompanyRole | null;
  isDemo?: boolean;
  locale?: string | null;
}

export interface AnalyticsCommonParams {
  account_type: AnalyticsAccountType;
  company_role: AnalyticsCompanyRole;
  is_demo: boolean;
  locale: string;
  page_group: AnalyticsPageGroup;
  page_path: string;
}

type AnalyticsAuthIntent = "signin" | "signup";
type AnalyticsEntryAccountType = "b2b" | "b2c";
type AnalyticsDashboardAction = "add_product" | "logistics" | "reports";
type AnalyticsDocumentGroup = "export_compliance" | "material_certification";
type AnalyticsExportFormat = "csv" | "pdf" | "xlsx";
type AnalyticsReportStatus = "completed" | "failed" | "processing";
type AnalyticsDatasetType = "analytics" | "company" | "history" | "products" | "users";

export interface AnalyticsPayloadMap {
  auth_google_start: {
    auth_method: "google";
    entry_account_type: AnalyticsEntryAccountType;
    intent: AnalyticsAuthIntent;
  };
  auth_login_error: {
    auth_method: "email";
    entry_account_type: AnalyticsEntryAccountType;
    error_code?: string;
    intent: "signin";
  };
  auth_login_submit: {
    auth_method: "email";
    entry_account_type: AnalyticsEntryAccountType;
    intent: "signin";
  };
  auth_login_success: {
    auth_method: "email";
    entry_account_type: AnalyticsEntryAccountType;
    intent: "signin";
  };
  auth_signup_error: {
    auth_method: "email";
    entry_account_type: AnalyticsEntryAccountType;
    error_code?: string;
    intent: "signup";
  };
  auth_signup_submit: {
    auth_method: "email";
    entry_account_type: AnalyticsEntryAccountType;
    intent: "signup";
  };
  auth_signup_success: {
    auth_method: "email";
    entry_account_type: AnalyticsEntryAccountType;
    intent: "signup";
  };
  calculator_run: {
    material: string;
    route: string;
  };
  dashboard_quick_action_click: {
    action: AnalyticsDashboardAction;
  };
  export_document_approve_success: {
    document_group: AnalyticsDocumentGroup;
    document_id: string;
    market: string;
  };
  export_document_preview_open: {
    document_group: AnalyticsDocumentGroup;
    document_id: string;
    market: string;
  };
  export_document_upload_error: {
    document_group: AnalyticsDocumentGroup;
    document_id: string;
    error_code?: string;
    market: string;
    mode: "create" | "edit";
  };
  export_document_upload_submit: {
    document_group: AnalyticsDocumentGroup;
    document_id: string;
    market: string;
    mode: "create" | "edit";
  };
  export_document_upload_success: {
    document_group: AnalyticsDocumentGroup;
    document_id: string;
    market: string;
    mode: "create" | "edit";
  };
  export_market_open: {
    market: string;
  };
  landing_calculator_click: Record<string, never>;
  landing_start_click: Record<string, never>;
  lead_form_error: {
    error_code?: string;
  };
  lead_form_submit: Record<string, never>;
  lead_form_success: Record<string, never>;
  onboarding_error: {
    business_type: string;
    domestic_market: string;
    error_code?: string;
  };
  onboarding_submit: {
    business_type: string;
    domestic_market: string;
  };
  onboarding_success: {
    business_type: string;
    domestic_market: string;
  };
  pricing_modal_open: {
    source_page: string;
  };
  report_create_error: {
    dataset_type?: AnalyticsDatasetType;
    error_code?: string;
    format: AnalyticsExportFormat;
    report_type: string;
  };
  report_create_submit: {
    dataset_type?: AnalyticsDatasetType;
    format: AnalyticsExportFormat;
    report_type: string;
  };
  report_create_success: {
    dataset_type?: AnalyticsDatasetType;
    format: AnalyticsExportFormat;
    report_type: string;
  };
  report_download_click: {
    format: AnalyticsExportFormat;
    report_status: AnalyticsReportStatus;
    report_type: string;
  };
  report_download_error: {
    error_code?: string;
    format: AnalyticsExportFormat;
    report_status: AnalyticsReportStatus;
    report_type: string;
  };
  report_download_success: {
    format: AnalyticsExportFormat;
    report_status: AnalyticsReportStatus;
    report_type: string;
  };
  report_quick_export_click: {
    dataset_type: AnalyticsDatasetType;
    format: AnalyticsExportFormat;
  };
  report_quick_export_error: {
    dataset_type: AnalyticsDatasetType;
    error_code?: string;
    format: AnalyticsExportFormat;
  };
  report_quick_export_success: {
    dataset_type: AnalyticsDatasetType;
    format: AnalyticsExportFormat;
  };
  weave_page_view: {
    page_group: AnalyticsPageGroup;
    page_path?: string;
  };
}

export type AnalyticsEventName = keyof AnalyticsPayloadMap;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

let analyticsContext: AnalyticsContext = {};

const GTM_ID = (process.env.NEXT_PUBLIC_GTM_ID || "").trim();

const DEFAULT_ACCOUNT_TYPE: AnalyticsAccountType = "anonymous";
const DEFAULT_COMPANY_ROLE: AnalyticsCompanyRole = "none";
const DEFAULT_LOCALE = "unknown";

const trimTrailingSlash = (value: string) => {
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1);
  }
  return value;
};

const normalizePagePath = (value: string | null | undefined) => {
  const fallback = "/";
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return trimTrailingSlash(`${url.pathname || fallback}${url.search || ""}`) || fallback;
    } catch {
      return fallback;
    }
  }

  if (trimmed.startsWith("/")) {
    return trimTrailingSlash(trimmed) || fallback;
  }

  return trimTrailingSlash(`/${trimmed}`) || fallback;
};

export const resolveAnalyticsPageGroup = (path: string | null | undefined): AnalyticsPageGroup => {
  const normalizedPath = normalizePagePath(path);
  const pathname = normalizedPath.split("?")[0] || "/";

  if (pathname === "/") return "landing";
  if (pathname.startsWith("/auth")) return "auth";
  if (pathname.startsWith("/onboarding")) return "onboarding";
  if (pathname.startsWith("/calculator")) return "calculator";
  if (pathname === "/overview" || pathname.startsWith("/demo/overview")) return "overview";

  if (
    pathname === "/products" ||
    pathname.startsWith("/demo/products") ||
    pathname.startsWith("/assessment") ||
    pathname.startsWith("/summary") ||
    pathname.startsWith("/passport")
  ) {
    return "products";
  }

  if (
    pathname === "/logistics" ||
    pathname === "/transport" ||
    pathname === "/track-shipment" ||
    pathname.startsWith("/demo/logistics")
  ) {
    return "logistics";
  }

  if (pathname === "/export" || pathname.startsWith("/demo/export")) return "export";
  if (pathname === "/reports" || pathname.startsWith("/demo/reports")) return "reports";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "settings";
  return "other";
};

const getCurrentPagePath = () => {
  if (typeof window === "undefined") {
    return "/";
  }

  return normalizePagePath(`${window.location.pathname}${window.location.search}`);
};

const isAnalyticsEnabled = () => typeof window !== "undefined" && GTM_ID.length > 0;

const getCommonParams = (
  pageGroupOverride?: AnalyticsPageGroup,
  pagePathOverride?: string
): AnalyticsCommonParams => {
  const pagePath = normalizePagePath(pagePathOverride || getCurrentPagePath());
  return {
    page_path: pagePath,
    page_group: pageGroupOverride || resolveAnalyticsPageGroup(pagePath),
    locale: analyticsContext.locale?.trim() || DEFAULT_LOCALE,
    account_type: analyticsContext.accountType || DEFAULT_ACCOUNT_TYPE,
    company_role: analyticsContext.companyRole || DEFAULT_COMPANY_ROLE,
    is_demo: Boolean(analyticsContext.isDemo)
  };
};

const pushToDataLayer = <TEventName extends AnalyticsEventName>(
  eventName: TEventName,
  params: AnalyticsPayloadMap[TEventName]
) => {
  if (!isAnalyticsEnabled()) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  const pageGroup =
    typeof params === "object" && params !== null && "page_group" in params ?
      (params.page_group as AnalyticsPageGroup) :
      undefined;
  const pagePath =
    typeof params === "object" && params !== null && "page_path" in params ?
      (params.page_path as string | undefined) :
      undefined;
  window.dataLayer.push({
    event: eventName,
    ...getCommonParams(pageGroup, pagePath),
    ...params
  });
};

export const setAnalyticsContext = (nextContext: AnalyticsContext) => {
  analyticsContext = {
    locale: nextContext.locale?.trim() || null,
    accountType: nextContext.accountType || null,
    companyRole: nextContext.companyRole || null,
    isDemo: Boolean(nextContext.isDemo)
  };
};

export const trackEvent = <TEventName extends Exclude<AnalyticsEventName, "weave_page_view">>(
  eventName: TEventName,
  params: AnalyticsPayloadMap[TEventName]
) => {
  pushToDataLayer(eventName, params);
};

export const trackPageView = (
  pageGroup: AnalyticsPageGroup,
  pagePath?: string
) => {
  pushToDataLayer("weave_page_view", {
    page_group: pageGroup,
    page_path: pagePath
  });
};

const normalizeAnalyticsToken = (value: string) =>
  value.
    toLowerCase().
    normalize("NFD").
    replace(/[\u0300-\u036f]/g, "").
    replace(/[^a-z0-9]+/g, "_").
    replace(/^_+|_+$/g, "") || "unknown_error";

export const toAnalyticsErrorCode = (error: unknown) => {
  if (error && typeof error === "object") {
    const candidateCode = (error as { code?: unknown; status?: unknown }).code;
    if (typeof candidateCode === "string" && candidateCode.trim().length > 0) {
      return normalizeAnalyticsToken(candidateCode);
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return normalizeAnalyticsToken(error.message);
  }

  return "unknown_error";
};
