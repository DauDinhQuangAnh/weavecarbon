export const DEMO_DATA_VERSION = 2;
export const DEMO_SCENARIO = "b2b_standard_20" as const;
export const DEMO_DATASET_STORAGE_KEY = `weavecarbon_demo_v${DEMO_DATA_VERSION}_dataset`;
export const DEMO_SESSION_STORAGE_KEY = `weavecarbon_demo_v${DEMO_DATA_VERSION}_session`;
export const DEMO_DATASET_UPDATED_EVENT = "weavecarbon:demo-dataset-updated";
export const DEMO_MAX_DATASET_BYTES = 4 * 1024 * 1024;
export const DEMO_MAX_FILE_BYTES = 1.5 * 1024 * 1024;
export const DEMO_ROUTES = {
  root: "/demo",
  overview: "/demo/overview",
  products: "/demo/products",
  logistics: "/demo/logistics",
  export: "/demo/export",
  reports: "/demo/reports",
} as const;

export type DemoScenario = typeof DEMO_SCENARIO;
