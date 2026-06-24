export const SHARED_NAMESPACES = [] as const;

export const ROOT_NAMESPACES = SHARED_NAMESPACES;

export const HOME_NAMESPACES = [
  "navigation",
  "hero",
  "features",
  "howItWorks",
  "stats",
  "cta",
  "footer",
  "userType",
  "auth"
] as const;

export const AUTH_NAMESPACES = ["auth", "userType", "onboarding", "authCallback"] as const;

export const B2C_NAMESPACES = ["b2c"] as const;
export const CALCULATOR_NAMESPACES = ["calculator", "navigation", "footer", "userType", "auth"] as const;
export const ONBOARDING_NAMESPACES = ["onboarding"] as const;

export const DASHBOARD_BASE_NAMESPACES = [
  "sidebar",
  "pricingModal",
  "dashboard.weaveyChat",
  "logistics.shipmentContext"
] as const;

export const DASHBOARD_ASSESSMENT_NAMESPACES = [
  "assessment",
  "addressSelection"
] as const;
export const DASHBOARD_CALCULATION_HISTORY_NAMESPACES = ["calculationHistory"] as const;
export const DASHBOARD_EXPORT_NAMESPACES = ["export"] as const;
export const DASHBOARD_LOGISTICS_NAMESPACES = ["logistics", "trackShipment", "products"] as const;
export const DASHBOARD_OVERVIEW_NAMESPACES = ["overview"] as const;
export const DASHBOARD_PASSPORT_NAMESPACES = ["passport"] as const;
export const DASHBOARD_PRODUCTS_NAMESPACES = ["products"] as const;
export const DASHBOARD_REPORTS_NAMESPACES = ["reports"] as const;
export const DASHBOARD_SETTINGS_NAMESPACES = ["settings"] as const;
export const DASHBOARD_SUMMARY_NAMESPACES = ["summary", "productDetail", "products"] as const;
export const DASHBOARD_TRACK_SHIPMENT_NAMESPACES = ["trackShipment"] as const;
export const DASHBOARD_TRANSPORT_NAMESPACES = [
  "transport",
  "addressSelection",
  "trackShipment"
] as const;
