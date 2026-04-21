import type { AnalyticsEventNameV2 } from "@/lib/analytics";

export const ANALYTICS_LAB_UNSET_VALUE = "__unset__";
export const ANALYTICS_LAB_DEFAULT_EVENT: AnalyticsEventNameV2 = "wc_report_generated";

export const ANALYTICS_LAB_EVENT_PAGE_PATH_PRESETS: Partial<
  Record<AnalyticsEventNameV2, string>
> = {
  begin_checkout: "/settings",
  generate_lead: "/",
  login: "/auth",
  purchase: "/settings",
  sign_up: "/auth",
  wc_calculator_run: "/calculator",
  wc_chat_message_sent: "/overview",
  wc_document_uploaded: "/export",
  wc_onboarding_completed: "/onboarding",
  wc_product_created: "/products",
  wc_report_generated: "/reports",
  wc_route_simulation_run: "/transport",
  wc_shipment_status_changed: "/track-shipment"
};

export const ANALYTICS_LAB_EVENT_PAYLOAD_PRESETS: Partial<
  Record<AnalyticsEventNameV2, Record<string, unknown>>
> = {
  begin_checkout: {
    billing_cycle: "monthly",
    currency: "VND",
    payment_provider: "lab_console",
    plan_family: "standard",
    plan_sku_limit: 20,
    value: 299000
  },
  generate_lead: {
    form_name: "landing_cta",
    lead_type: "email_capture"
  },
  login: {
    intent: "signin",
    method: "email",
    entry_account_type: "b2b"
  },
  purchase: {
    billing_cycle: "monthly",
    currency: "VND",
    payment_provider: "lab_console",
    plan_family: "standard",
    plan_sku_limit: 20,
    value: 299000
  },
  sign_up: {
    intent: "signup",
    method: "email",
    entry_account_type: "b2b"
  },
  wc_calculator_run: {
    material: "cotton",
    route: "domestic_road"
  },
  wc_chat_message_sent: {
    has_conversation: true,
    variant: "dashboard"
  },
  wc_document_uploaded: {
    document_group: "export_compliance",
    market_code: "US",
    mode: "create"
  },
  wc_onboarding_completed: {
    business_type: "factory",
    domestic_market: "VN"
  },
  wc_product_created: {
    entry_point: "products_page"
  },
  wc_report_generated: {
    dataset_type: "analytics",
    format: "pdf",
    report_type: "analytics_summary"
  },
  wc_route_simulation_run: {
    route_type: "sea"
  },
  wc_shipment_status_changed: {
    status: "in_transit"
  }
};

export const stringifyAnalyticsLabJson = (value: unknown) => JSON.stringify(value, null, 2);

export const getAnalyticsLabDefaultEventPayload = (eventName: AnalyticsEventNameV2) =>
  stringifyAnalyticsLabJson(ANALYTICS_LAB_EVENT_PAYLOAD_PRESETS[eventName] || {});

export const getAnalyticsLabDefaultPagePath = (eventName: AnalyticsEventNameV2) =>
  ANALYTICS_LAB_EVENT_PAGE_PATH_PRESETS[eventName] || "/reports";

export const createAnalyticsLabIdentity = (prefix: string) => {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timePart}_${randomPart}`;
};

export const parseAnalyticsLabPayloadObject = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Payload must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
};
