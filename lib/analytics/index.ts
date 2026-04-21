import type { CompanyRole } from "@/lib/permissions";

type AnalyticsAccountType = "admin" | "anonymous" | "b2b" | "b2c";
type AnalyticsAuthIntent = "signin" | "signup";
type AnalyticsAuthMethod = "demo" | "email" | "google";
type AnalyticsBillingCycle = "monthly" | "yearly";
type AnalyticsBusinessType = "brand" | "factory" | "shop_online" | "unknown";
type AnalyticsChatVariant = "dashboard" | "landing";
type AnalyticsCompanyRole = CompanyRole | "none";
type AnalyticsDashboardAction = "add_product" | "logistics" | "reports";
type AnalyticsDocumentGroup = "export_compliance" | "material_certification";
type AnalyticsEntryAccountType = "b2b" | "b2c";
type AnalyticsExportFormat = "csv" | "pdf" | "xlsx";
type AnalyticsFeatureArea =
  | AnalyticsPageGroup
  | "chat"
  | "subscription"
  | "system"
  | "team";
type AnalyticsMemberRole = "admin" | "member" | "viewer";
type AnalyticsPlanFamily = "export" | "free" | "standard" | "trial";
type AnalyticsProductEntryPoint =
  | "assessment_modal"
  | "batch_management"
  | "bulk_upload"
  | "products_page";
type AnalyticsProfileScope = "company" | "password" | "personal";
type AnalyticsReportStatus = "completed" | "failed" | "processing";

export type AnalyticsDatasetType =
  | "activity"
  | "analytics"
  | "audit"
  | "company"
  | "history"
  | "product"
  | "products"
  | "users";

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

export interface AnalyticsIdentity {
  companyKey?: string | null;
  userId?: string | null;
}

export interface AnalyticsDispatchOptions {
  allowDebugOverride?: boolean;
  debugMode?: boolean;
}

export interface AnalyticsUserProperties {
  accountType?: "admin" | "b2b" | "b2c" | null;
  businessType?: string | null;
  companyRole?: CompanyRole | null;
  domesticMarket?: string | null;
  isDemo?: boolean;
  locale?: string | null;
  planFamily?: AnalyticsPlanFamily | null;
  planSkuLimit?: number | null;
}

export interface AnalyticsCommonParams {
  account_type: AnalyticsAccountType;
  business_type: AnalyticsBusinessType;
  company_role: AnalyticsCompanyRole;
  domestic_market: string;
  feature_area: AnalyticsFeatureArea;
  is_demo: boolean;
  locale: string;
  page_group: AnalyticsPageGroup;
  page_path: string;
  plan_family: AnalyticsPlanFamily;
  plan_sku_limit: number;
}

type AnalyticsEventContextOverride = Partial<
  Pick<AnalyticsCommonParams, "feature_area" | "page_group" | "page_path">
>;

type AnalyticsEventPayload<T extends object = object> = T &
  AnalyticsEventContextOverride;

export interface AnalyticsPayloadMapV2 {
  begin_checkout: AnalyticsEventPayload<{
    billing_cycle: AnalyticsBillingCycle;
    currency: "VND";
    payment_provider: string;
    plan_family: Exclude<AnalyticsPlanFamily, "free" | "trial">;
    plan_sku_limit?: number;
    value: number;
  }>;
  generate_lead: AnalyticsEventPayload<{
    form_name: "landing_cta";
    lead_type: "email_capture";
  }>;
  login: AnalyticsEventPayload<{
    entry_account_type?: AnalyticsEntryAccountType;
    intent: "signin";
    method: AnalyticsAuthMethod;
  }>;
  purchase: AnalyticsEventPayload<{
    billing_cycle: AnalyticsBillingCycle;
    currency: "VND";
    payment_provider: string;
    plan_family: Exclude<AnalyticsPlanFamily, "free" | "trial">;
    plan_sku_limit?: number;
    value: number;
  }>;
  sign_up: AnalyticsEventPayload<{
    entry_account_type: AnalyticsEntryAccountType;
    intent: "signup";
    method: Exclude<AnalyticsAuthMethod, "demo">;
  }>;
  wc_auth_google_start: AnalyticsEventPayload<{
    entry_account_type: AnalyticsEntryAccountType;
    intent: AnalyticsAuthIntent;
  }>;
  wc_auth_login_error: AnalyticsEventPayload<{
    entry_account_type: AnalyticsEntryAccountType;
    error_code?: string;
    method: AnalyticsAuthMethod;
  }>;
  wc_auth_login_submit: AnalyticsEventPayload<{
    entry_account_type: AnalyticsEntryAccountType;
    method: AnalyticsAuthMethod;
  }>;
  wc_auth_sign_up_error: AnalyticsEventPayload<{
    entry_account_type: AnalyticsEntryAccountType;
    error_code?: string;
    method: Exclude<AnalyticsAuthMethod, "demo">;
  }>;
  wc_auth_sign_up_submit: AnalyticsEventPayload<{
    entry_account_type: AnalyticsEntryAccountType;
    method: Exclude<AnalyticsAuthMethod, "demo">;
  }>;
  wc_batch_created: AnalyticsEventPayload;
  wc_batch_published: AnalyticsEventPayload;
  wc_bulk_import_completed: AnalyticsEventPayload;
  wc_bulk_import_failed: AnalyticsEventPayload<{
    error_code?: string;
  }>;
  wc_bulk_import_started: AnalyticsEventPayload;
  wc_calculator_run: AnalyticsEventPayload<{
    material: string;
    route: string;
  }>;
  wc_chat_conversation_deleted: AnalyticsEventPayload<{
    variant: AnalyticsChatVariant;
  }>;
  wc_chat_message_sent: AnalyticsEventPayload<{
    has_conversation: boolean;
    variant: AnalyticsChatVariant;
  }>;
  wc_chat_opened: AnalyticsEventPayload<{
    variant: AnalyticsChatVariant;
  }>;
  wc_chat_response_received: AnalyticsEventPayload<{
    variant: AnalyticsChatVariant;
  }>;
  wc_chat_settings_saved: AnalyticsEventPayload<{
    variant: AnalyticsChatVariant;
  }>;
  wc_dashboard_quick_action_clicked: AnalyticsEventPayload<{
    action: AnalyticsDashboardAction;
  }>;
  wc_document_approved: AnalyticsEventPayload<{
    document_group: AnalyticsDocumentGroup;
    market_code: string;
  }>;
  wc_document_preview_opened: AnalyticsEventPayload<{
    document_group: AnalyticsDocumentGroup;
    market_code: string;
  }>;
  wc_document_upload_failed: AnalyticsEventPayload<{
    document_group: AnalyticsDocumentGroup;
    error_code?: string;
    market_code: string;
    mode: "create" | "edit";
  }>;
  wc_document_upload_submit: AnalyticsEventPayload<{
    document_group: AnalyticsDocumentGroup;
    market_code: string;
    mode: "create" | "edit";
  }>;
  wc_document_uploaded: AnalyticsEventPayload<{
    document_group: AnalyticsDocumentGroup;
    market_code: string;
    mode: "create" | "edit";
  }>;
  wc_email_verification_completed: AnalyticsEventPayload<{
    method: Exclude<AnalyticsAuthMethod, "demo">;
  }>;
  wc_export_market_opened: AnalyticsEventPayload<{
    market_code: string;
  }>;
  wc_export_report_requested: AnalyticsEventPayload<{
    format: AnalyticsExportFormat;
    market_code: string;
  }>;
  wc_landing_calculator_clicked: AnalyticsEventPayload;
  wc_landing_start_clicked: AnalyticsEventPayload;
  wc_lead_form_error: AnalyticsEventPayload<{
    error_code?: string;
  }>;
  wc_lead_form_submit: AnalyticsEventPayload;
  wc_member_disabled: AnalyticsEventPayload<{
    member_role: AnalyticsMemberRole;
    status: "active" | "disabled" | "inactive";
  }>;
  wc_member_invite_resent: AnalyticsEventPayload<{
    member_role: AnalyticsMemberRole;
  }>;
  wc_member_invited: AnalyticsEventPayload<{
    member_role: AnalyticsMemberRole;
  }>;
  wc_member_removed: AnalyticsEventPayload<{
    member_role: AnalyticsMemberRole;
  }>;
  wc_member_role_changed: AnalyticsEventPayload<{
    next_role: AnalyticsMemberRole;
    previous_role: AnalyticsMemberRole;
  }>;
  wc_onboarding_completed: AnalyticsEventPayload<{
    business_type: AnalyticsBusinessType;
    domestic_market: string;
  }>;
  wc_onboarding_error: AnalyticsEventPayload<{
    business_type: AnalyticsBusinessType;
    domestic_market: string;
    error_code?: string;
  }>;
  wc_onboarding_submit: AnalyticsEventPayload<{
    business_type: AnalyticsBusinessType;
    domestic_market: string;
  }>;
  wc_payment_failed: AnalyticsEventPayload<{
    billing_cycle?: AnalyticsBillingCycle;
    error_code?: string;
    payment_provider?: string;
    plan_family?: Exclude<AnalyticsPlanFamily, "free" | "trial">;
    plan_sku_limit?: number;
  }>;
  wc_plan_selected: AnalyticsEventPayload<{
    billing_cycle: AnalyticsBillingCycle;
    payment_provider: string;
    plan_family: Exclude<AnalyticsPlanFamily, "free" | "trial">;
    plan_sku_limit?: number;
  }>;
  wc_pricing_modal_opened: AnalyticsEventPayload<{
    source_page: string;
  }>;
  wc_product_created: AnalyticsEventPayload<{
    entry_point: AnalyticsProductEntryPoint;
  }>;
  wc_product_deleted: AnalyticsEventPayload<{
    entry_point: AnalyticsProductEntryPoint;
  }>;
  wc_product_published: AnalyticsEventPayload<{
    entry_point: AnalyticsProductEntryPoint;
  }>;
  wc_product_updated: AnalyticsEventPayload<{
    entry_point: AnalyticsProductEntryPoint;
  }>;
  wc_product_viewed: AnalyticsEventPayload<{
    entry_point: AnalyticsProductEntryPoint;
  }>;
  wc_profile_updated: AnalyticsEventPayload<{
    profile_scope: AnalyticsProfileScope;
  }>;
  wc_report_download_failed: AnalyticsEventPayload<{
    error_code?: string;
    format: AnalyticsExportFormat;
    report_status: AnalyticsReportStatus;
    report_type: string;
  }>;
  wc_report_downloaded: AnalyticsEventPayload<{
    format: AnalyticsExportFormat;
    report_status: AnalyticsReportStatus;
    report_type: string;
  }>;
  wc_report_generation_failed: AnalyticsEventPayload<{
    dataset_type?: AnalyticsDatasetType;
    error_code?: string;
    format: AnalyticsExportFormat;
    report_type: string;
  }>;
  wc_report_generated: AnalyticsEventPayload<{
    dataset_type?: AnalyticsDatasetType;
    format: AnalyticsExportFormat;
    report_type: string;
  }>;
  wc_report_requested: AnalyticsEventPayload<{
    dataset_type?: AnalyticsDatasetType;
    format: AnalyticsExportFormat;
    report_type: string;
  }>;
  wc_route_simulation_run: AnalyticsEventPayload<{
    route_type?: string;
  }>;
  wc_shipment_created: AnalyticsEventPayload;
  wc_shipment_status_changed: AnalyticsEventPayload<{
    status: string;
  }>;
  wc_shipment_updated: AnalyticsEventPayload;
}

export type AnalyticsEventNameV2 = keyof AnalyticsPayloadMapV2;

export const ANALYTICS_EVENT_NAMES = [
  "begin_checkout",
  "generate_lead",
  "login",
  "purchase",
  "sign_up",
  "wc_auth_google_start",
  "wc_auth_login_error",
  "wc_auth_login_submit",
  "wc_auth_sign_up_error",
  "wc_auth_sign_up_submit",
  "wc_batch_created",
  "wc_batch_published",
  "wc_bulk_import_completed",
  "wc_bulk_import_failed",
  "wc_bulk_import_started",
  "wc_calculator_run",
  "wc_chat_conversation_deleted",
  "wc_chat_message_sent",
  "wc_chat_opened",
  "wc_chat_response_received",
  "wc_chat_settings_saved",
  "wc_dashboard_quick_action_clicked",
  "wc_document_approved",
  "wc_document_preview_opened",
  "wc_document_upload_failed",
  "wc_document_upload_submit",
  "wc_document_uploaded",
  "wc_email_verification_completed",
  "wc_export_market_opened",
  "wc_export_report_requested",
  "wc_landing_calculator_clicked",
  "wc_landing_start_clicked",
  "wc_lead_form_error",
  "wc_lead_form_submit",
  "wc_member_disabled",
  "wc_member_invite_resent",
  "wc_member_invited",
  "wc_member_removed",
  "wc_member_role_changed",
  "wc_onboarding_completed",
  "wc_onboarding_error",
  "wc_onboarding_submit",
  "wc_payment_failed",
  "wc_plan_selected",
  "wc_pricing_modal_opened",
  "wc_product_created",
  "wc_product_deleted",
  "wc_product_published",
  "wc_product_updated",
  "wc_product_viewed",
  "wc_profile_updated",
  "wc_report_download_failed",
  "wc_report_downloaded",
  "wc_report_generation_failed",
  "wc_report_generated",
  "wc_report_requested",
  "wc_route_simulation_run",
  "wc_shipment_created",
  "wc_shipment_status_changed",
  "wc_shipment_updated"
] as const satisfies readonly AnalyticsEventNameV2[];

export interface AnalyticsPreparedEvent {
  eventName: string;
  params: Record<string, unknown>;
}

export interface AnalyticsRuntimeState {
  canTrackDefault: boolean;
  canTrackWithDebugOverride: boolean;
  hasGtag: boolean;
  hasMeasurementId: boolean;
  isProductionRuntime: boolean;
  measurementId: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (
      command: "config" | "event" | "js",
      targetOrDate: Date | string,
      params?: Record<string, unknown>
    ) => void;
  }
}

const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim();
const IS_PRODUCTION_RUNTIME = process.env.NODE_ENV === "production";

const DEFAULT_ACCOUNT_TYPE: AnalyticsAccountType = "anonymous";
const DEFAULT_BUSINESS_TYPE: AnalyticsBusinessType = "unknown";
const DEFAULT_COMPANY_ROLE: AnalyticsCompanyRole = "none";
const DEFAULT_DOMESTIC_MARKET = "unknown";
const DEFAULT_LOCALE = "unknown";
const DEFAULT_PLAN_FAMILY: AnalyticsPlanFamily = "free";
const DYNAMIC_PATH_PARENTS = new Set(["history", "passport", "summary"]);
const DYNAMIC_SEGMENT_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{5,}|[a-z0-9_-]{20,})$/i;
const INTERNAL_TOOL_PATHS = new Set(["/ai_config", "/analytics_lab", "/tools/analytics-lab"]);

let analyticsIdentity: AnalyticsIdentity = {};
let analyticsUserProperties: AnalyticsUserProperties = {};

const compactAnalyticsParams = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (typeof value === "undefined" || value === null) {
        return false;
      }
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      return true;
    })
  ) as Partial<T>;

const normalizeAnalyticsToken = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";

const sanitizePathname = (value: string) => {
  const rawPathname = value.split("?")[0] || "/";
  const segments = rawPathname
    .split("/")
    .filter(Boolean)
    .map((segment, index, allSegments) => {
      const previousSegment = allSegments[index - 1] || "";
      if (
        DYNAMIC_SEGMENT_PATTERN.test(segment) ||
        DYNAMIC_PATH_PARENTS.has(previousSegment.toLowerCase())
      ) {
        return ":id";
      }
      return segment;
    });

  return segments.length > 0 ? `/${segments.join("/")}` : "/";
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
      return sanitizePathname(url.pathname || fallback);
    } catch {
      return fallback;
    }
  }

  const pathname = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return sanitizePathname(pathname);
};

export const resolveAnalyticsPageGroup = (
  path: string | null | undefined
): AnalyticsPageGroup => {
  const pathname = normalizePagePath(path);

  if (pathname === "/") return "landing";
  if (pathname.startsWith("/auth")) return "auth";
  if (pathname.startsWith("/onboarding")) return "onboarding";
  if (pathname.startsWith("/calculator")) return "calculator";
  if (pathname === "/overview" || pathname.startsWith("/demo/overview")) return "overview";

  if (
    pathname === "/products" ||
    pathname.startsWith("/assessment") ||
    pathname.startsWith("/demo/products") ||
    pathname.startsWith("/passport") ||
    pathname.startsWith("/summary")
  ) {
    return "products";
  }

  if (
    pathname === "/logistics" ||
    pathname === "/track-shipment" ||
    pathname === "/transport" ||
    pathname.startsWith("/demo/logistics")
  ) {
    return "logistics";
  }

  if (pathname === "/export" || pathname.startsWith("/demo/export")) return "export";
  if (pathname === "/reports" || pathname.startsWith("/demo/reports")) return "reports";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "settings";
  return "other";
};

const getFeatureArea = (
  pageGroup: AnalyticsPageGroup,
  featureAreaOverride?: AnalyticsFeatureArea
): AnalyticsFeatureArea => featureAreaOverride || pageGroup;

const getCurrentPagePath = () => {
  if (typeof window === "undefined") {
    return "/";
  }

  return normalizePagePath(window.location.pathname);
};

const canDispatchAnalytics = (options: AnalyticsDispatchOptions = {}) =>
  typeof window !== "undefined" &&
  GA_MEASUREMENT_ID.length > 0 &&
  typeof window.gtag === "function" &&
  (IS_PRODUCTION_RUNTIME || Boolean(options.allowDebugOverride));

const withDebugModeParam = (
  params: Record<string, unknown>,
  options: AnalyticsDispatchOptions = {}
) =>
  compactAnalyticsParams({
    ...params,
    ...(options.debugMode ? { debug_mode: true } : {})
  });

const getCommonParams = (
  overrides: AnalyticsEventContextOverride = {}
): AnalyticsCommonParams => {
  const pagePath = normalizePagePath(overrides.page_path || getCurrentPagePath());
  const pageGroup = overrides.page_group || resolveAnalyticsPageGroup(pagePath);

  return {
    page_path: pagePath,
    page_group: pageGroup,
    feature_area: getFeatureArea(pageGroup, overrides.feature_area),
    locale: analyticsUserProperties.locale?.trim() || DEFAULT_LOCALE,
    account_type: analyticsUserProperties.accountType || DEFAULT_ACCOUNT_TYPE,
    company_role: analyticsUserProperties.companyRole || DEFAULT_COMPANY_ROLE,
    is_demo: Boolean(analyticsUserProperties.isDemo),
    plan_family: analyticsUserProperties.planFamily || DEFAULT_PLAN_FAMILY,
    plan_sku_limit:
      typeof analyticsUserProperties.planSkuLimit === "number" &&
      Number.isFinite(analyticsUserProperties.planSkuLimit) ?
        Math.max(0, Math.round(analyticsUserProperties.planSkuLimit)) :
        0,
    business_type:
      (analyticsUserProperties.businessType?.trim() as AnalyticsBusinessType | undefined) ||
      DEFAULT_BUSINESS_TYPE,
    domestic_market:
      analyticsUserProperties.domesticMarket?.trim().toUpperCase() || DEFAULT_DOMESTIC_MARKET
  };
};

const buildAnalyticsUserProperties = () =>
  compactAnalyticsParams({
    locale: analyticsUserProperties.locale?.trim() || DEFAULT_LOCALE,
    account_type: analyticsUserProperties.accountType || DEFAULT_ACCOUNT_TYPE,
    company_role: analyticsUserProperties.companyRole || DEFAULT_COMPANY_ROLE,
    is_demo: Boolean(analyticsUserProperties.isDemo),
    plan_family: analyticsUserProperties.planFamily || DEFAULT_PLAN_FAMILY,
    plan_sku_limit:
      typeof analyticsUserProperties.planSkuLimit === "number" &&
      Number.isFinite(analyticsUserProperties.planSkuLimit) ?
        Math.max(0, Math.round(analyticsUserProperties.planSkuLimit)) :
        undefined,
    business_type:
      analyticsUserProperties.businessType?.trim() || DEFAULT_BUSINESS_TYPE,
    domestic_market:
      analyticsUserProperties.domesticMarket?.trim().toUpperCase() || DEFAULT_DOMESTIC_MARKET
  });

const syncAnalyticsConfig = (options: AnalyticsDispatchOptions = {}) => {
  if (!canDispatchAnalytics(options)) {
    return;
  }

  window.gtag?.(
    "config",
    GA_MEASUREMENT_ID,
    withDebugModeParam(
      compactAnalyticsParams({
        send_page_view: false,
        user_id: analyticsIdentity.userId?.trim() || undefined,
        user_properties: buildAnalyticsUserProperties()
      }),
      options
    )
  );
};

const dispatchPreparedEvent = (
  preparedEvent: AnalyticsPreparedEvent,
  options: AnalyticsDispatchOptions = {}
) => {
  if (!canDispatchAnalytics(options)) {
    return false;
  }

  syncAnalyticsConfig(options);
  window.gtag?.("event", preparedEvent.eventName, preparedEvent.params);
  return true;
};

export const setAnalyticsIdentity = (nextIdentity: AnalyticsIdentity) => {
  analyticsIdentity = {
    userId: nextIdentity.userId?.trim() || null,
    companyKey: nextIdentity.companyKey?.trim() || null
  };
  syncAnalyticsConfig();
};

export const setAnalyticsUserProperties = (
  nextProperties: AnalyticsUserProperties
) => {
  analyticsUserProperties = {
    locale: nextProperties.locale?.trim() || null,
    accountType: nextProperties.accountType || null,
    companyRole: nextProperties.companyRole || null,
    isDemo: Boolean(nextProperties.isDemo),
    planFamily: nextProperties.planFamily || null,
    planSkuLimit:
      typeof nextProperties.planSkuLimit === "number" &&
      Number.isFinite(nextProperties.planSkuLimit) ?
        Math.max(0, Math.round(nextProperties.planSkuLimit)) :
        null,
    businessType: nextProperties.businessType?.trim() || null,
    domesticMarket: nextProperties.domesticMarket?.trim().toUpperCase() || null
  };
  syncAnalyticsConfig();
};

export const setAnalyticsContext = setAnalyticsUserProperties;

export const shouldTrackAnalyticsPageView = (
  pagePath: string | null | undefined
) => {
  const normalizedPath = normalizePagePath(pagePath).toLowerCase();
  return ![...INTERNAL_TOOL_PATHS].some((toolPath) =>
    normalizedPath === toolPath || normalizedPath.startsWith(`${toolPath}/`)
  );
};

export const prepareAnalyticsEvent = <TEventName extends AnalyticsEventNameV2>(
  eventName: TEventName,
  params: AnalyticsPayloadMapV2[TEventName],
  options: AnalyticsDispatchOptions = {}
) => {
  const { page_group, page_path, feature_area, ...eventParams } = (params || {}) as
    AnalyticsPayloadMapV2[TEventName];
  const commonParams = getCommonParams({
    page_group,
    page_path,
    feature_area
  });

  return {
    eventName,
    params: withDebugModeParam(
      {
        ...commonParams,
        ...compactAnalyticsParams(eventParams as Record<string, unknown>)
      },
      options
    )
  } satisfies AnalyticsPreparedEvent;
};

export const trackEvent = <TEventName extends AnalyticsEventNameV2>(
  eventName: TEventName,
  params: AnalyticsPayloadMapV2[TEventName]
) => {
  dispatchPreparedEvent(prepareAnalyticsEvent(eventName, params));
};

export const prepareAnalyticsPageView = (
  pageGroup: AnalyticsPageGroup,
  pagePath?: string,
  options: AnalyticsDispatchOptions = {}
) => {
  const normalizedPagePath = normalizePagePath(pagePath || getCurrentPagePath());
  const pageLocation =
    typeof window !== "undefined" ?
      `${window.location.origin}${normalizedPagePath}` :
      normalizedPagePath;
  const pageTitle =
    typeof document !== "undefined" ? document.title : "WeaveCarbon";

  return {
    eventName: "page_view",
    params: withDebugModeParam(
      {
        ...getCommonParams({
          page_group: pageGroup,
          page_path: normalizedPagePath
        }),
        page_group: pageGroup,
        page_location: pageLocation,
        page_path: normalizedPagePath,
        page_title: pageTitle
      },
      options
    )
  } satisfies AnalyticsPreparedEvent;
};

export const trackPageView = (
  pageGroup: AnalyticsPageGroup,
  pagePath?: string
) => {
  dispatchPreparedEvent(prepareAnalyticsPageView(pageGroup, pagePath));
};

export const trackTestEvent = <TEventName extends AnalyticsEventNameV2>(
  eventName: TEventName,
  params: AnalyticsPayloadMapV2[TEventName],
  options: Pick<AnalyticsDispatchOptions, "debugMode"> = {}
) =>
  dispatchPreparedEvent(
    prepareAnalyticsEvent(eventName, params, options),
    {
      allowDebugOverride: true,
      debugMode: options.debugMode
    }
  );

export const trackTestPageView = (
  pageGroup: AnalyticsPageGroup,
  pagePath?: string,
  options: Pick<AnalyticsDispatchOptions, "debugMode"> = {}
) =>
  dispatchPreparedEvent(
    prepareAnalyticsPageView(pageGroup, pagePath, options),
    {
      allowDebugOverride: true,
      debugMode: options.debugMode
    }
  );

export const trackDebugEvent = <TEventName extends AnalyticsEventNameV2>(
  eventName: TEventName,
  params: AnalyticsPayloadMapV2[TEventName]
) =>
  trackTestEvent(eventName, params, {
    debugMode: true
  });

export const trackDebugPageView = (
  pageGroup: AnalyticsPageGroup,
  pagePath?: string
) =>
  trackTestPageView(pageGroup, pagePath, {
    debugMode: true
  });

export const getAnalyticsRuntimeState = (): AnalyticsRuntimeState => ({
  measurementId: GA_MEASUREMENT_ID,
  hasMeasurementId: GA_MEASUREMENT_ID.length > 0,
  hasGtag: typeof window !== "undefined" && typeof window.gtag === "function",
  isProductionRuntime: IS_PRODUCTION_RUNTIME,
  canTrackDefault: canDispatchAnalytics(),
  canTrackWithDebugOverride: canDispatchAnalytics({
    allowDebugOverride: true
  })
});

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
