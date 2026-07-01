import { afterEach, beforeEach, describe, expect, it } from "vitest";
import demoSeed from "@/lib/demo/seed/demo-b2b-standard20.json";
import { DEMO_DATASET_STORAGE_KEY, DEMO_DATA_VERSION } from "@/lib/demo/constants";
import { createDemoApiRequestAdapter } from "@/lib/demo/apiAdapter";
import { enrichDemoDataset } from "@/lib/demo/enrich";
import { normalizeSeedDemoDataset } from "@/lib/demo/normalize";
import { DemoDatasetV1Schema, type DemoDataset } from "@/lib/demo/schema";
import { getDemoCompanyMembersPayload } from "@/lib/demo/domain/account";
import { getDemoSubscriptionPayload } from "@/lib/demo/domain/subscription";
import { getDemoReportSourceCounts } from "@/lib/demo/domain/reports";
import {
  getDemoAuditTrail,
  getDemoCarbonCalculations,
  getDemoDataGaps,
  getDemoElectricityInvoices,
  getDemoEvidenceDocuments,
  getDemoFuelInvoices,
  getDemoSuppliers,
} from "@/lib/demo/domain/operations";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const buildDataset = () => {
  const dataset = {
    ...clone(demoSeed),
    version: DEMO_DATA_VERSION,
  } as DemoDataset;

  enrichDemoDataset(dataset);
  return DemoDatasetV1Schema.parse(normalizeSeedDemoDataset(dataset));
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const asString = (value: unknown) => String(value || "");

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

const installBrowserStorage = (dataset: DemoDataset) => {
  const localStorage = createMemoryStorage();
  localStorage.setItem(DEMO_DATASET_STORAGE_KEY, JSON.stringify(dataset));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      dispatchEvent: () => true,
    },
  });
};

const uninstallBrowserStorage = () => {
  Reflect.deleteProperty(globalThis, "window");
};

describe("B2B demo dataset", () => {
  beforeEach(() => {
    installBrowserStorage(buildDataset());
  });

  afterEach(() => {
    uninstallBrowserStorage();
  });

  it("is dense enough for a judging demo across core modules", () => {
    const dataset = buildDataset();

    expect(dataset.products.length).toBeGreaterThanOrEqual(12);
    expect(dataset.shipments.length).toBeGreaterThanOrEqual(7);
    expect(dataset.analytics.rows.length).toBeGreaterThanOrEqual(6);
    expect(dataset.reports.length).toBeGreaterThanOrEqual(5);
    expect(dataset.users.length).toBeGreaterThanOrEqual(4);
    expect(dataset.history.length).toBeGreaterThanOrEqual(8);

    expect(getDemoSuppliers(dataset).length).toBeGreaterThanOrEqual(6);
    expect(getDemoEvidenceDocuments(dataset).length).toBeGreaterThanOrEqual(6);
    expect(getDemoDataGaps(dataset).length).toBeGreaterThanOrEqual(8);
    expect(getDemoAuditTrail(dataset).length).toBeGreaterThanOrEqual(10);
    expect(getDemoElectricityInvoices(dataset).length).toBeGreaterThanOrEqual(3);
    expect(getDemoFuelInvoices(dataset).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps published products linked to shipments and carbon calculations", () => {
    const dataset = buildDataset();
    const publishedProducts = dataset.products
      .map(asRecord)
      .filter((product) => product.status === "published");
    const shipmentProductIds = new Set(
      dataset.shipments.flatMap((shipment) =>
        Array.isArray(asRecord(shipment).products)
          ? (asRecord(shipment).products as unknown[]).map((item) => asString(asRecord(item).product_id))
          : []
      )
    );
    const calculationProductIds = new Set(
      getDemoCarbonCalculations(dataset).map((calculation) => asString(calculation.product_id))
    );

    expect(publishedProducts.length).toBeGreaterThanOrEqual(8);
    for (const product of publishedProducts) {
      expect(asString(product.shipmentId)).not.toBe("");
      expect(shipmentProductIds.has(asString(product.id))).toBe(true);
      expect(calculationProductIds.has(asString(product.id))).toBe(true);
    }
  });

  it("keeps operational evidence, gaps, audit trail, and reports mutually visible", () => {
    const dataset = buildDataset();
    const evidence = getDemoEvidenceDocuments(dataset);
    const gaps = getDemoDataGaps(dataset);
    const audit = getDemoAuditTrail(dataset);
    const reportCounts = getDemoReportSourceCounts(dataset);

    expect(evidence.some((doc) => asString(doc.kind) === "bill_of_lading")).toBe(true);
    expect(evidence.some((doc) => asString(doc.kind).includes("electricity"))).toBe(true);
    expect(evidence.some((doc) => asString(doc.kind).includes("fuel"))).toBe(true);
    expect(gaps.some((gap) => asString(gap.risk_level) === "high")).toBe(true);
    expect(audit.some((row) => asString(row.changedField) === "shipment.created")).toBe(true);
    expect(audit.some((row) => asString(row.changedField) === "evidence.uploaded")).toBe(true);

    expect(reportCounts.products).toBe(dataset.products.length);
    expect(reportCounts.activity).toBe(getDemoCarbonCalculations(dataset).length);
    expect(reportCounts.audit).toBe(audit.length);
    expect(reportCounts.users).toBe(dataset.users.length);
    expect(reportCounts.history).toBe(dataset.history.length);
  });

  it("keeps settings and subscription usage aligned with demo users and products", () => {
    const dataset = buildDataset();
    const members = getDemoCompanyMembersPayload(dataset);
    const subscription = getDemoSubscriptionPayload(dataset);

    expect(members).toHaveLength(dataset.users.length);
    expect(members.some((member) => member.role === "admin" && member.is_root)).toBe(true);
    expect(subscription.usage.products).toBe(dataset.products.length);
    expect(subscription.usage.members).toBe(dataset.users.length);
    expect(subscription.limits.products).toBe(dataset.company.standard_sku_limit);
    expect(subscription.limits.members).toBeGreaterThanOrEqual(dataset.users.length);
  });

  it("handles the demo dashboard API endpoints used by hydrated pages", async () => {
    const adapter = createDemoApiRequestAdapter();
    const call = async (method: string, path: string, body?: unknown) => {
      const result = await adapter({
        path,
        url: path,
        method,
        body: body as RequestInit["body"],
        options: {} as never,
        headers: new Headers(),
        hasExplicitAuthorization: false,
      });
      expect(result.handled, `${method} ${path}`).toBe(true);
      expect(result.error, `${method} ${path}`).toBeUndefined();
      expect(result.value, `${method} ${path}`).toBeDefined();
      return result.value as Record<string, unknown>;
    };

    await call("GET", "/auth/check-company");
    await call("GET", "/account");
    await call("GET", "/company/members");
    await call("POST", "/company/members", { email: "judge.demo@weavecarbon.demo", role: "viewer" });
    await call("POST", "/company/members/demo-member-1/resend-invite", {});
    await call("PUT", "/company/members/demo-member-1", { role: "member" });
    await call("GET", "/subscription");
    await call("POST", "/subscription/upgrade", { target_plan: "standard" });
    await call("GET", "/subscription/payment-status?session_id=demo");
    await call("GET", "/dashboard/overview?trend_months=6");
    await call("GET", "/products?page=1&page_size=20");
    await call("GET", "/product-batches?page=1&page_size=20");
    await call("GET", "/logistics/shipments?page=1&page_size=20");
    await call("GET", "/logistics/overview");
    await call("GET", "/export/markets");
    await call("GET", "/reports");
    const report = await call("POST", "/reports", {
      title: "Judge demo export",
      report_type: "export_data",
      file_format: "xlsx",
      filters: { dataset_type: "products" },
    });
    await call("GET", `/reports/${encodeURIComponent(asString(report.id))}/status`);
    await call("GET", "/reports/export-sources");
    await call("GET", "/reports/export-data/products");
    await call("GET", "/audit-trail");
    await call("GET", "/suppliers");
    await call("POST", "/suppliers", {
      supplier_name: "Judge Supplier",
      supplier_email: "supplier.demo@weavecarbon.demo",
    });
    await call("GET", "/evidence?page=1&page_size=100");
    await call("GET", "/evidence/ev-demo-bol/fields");
    await call("POST", "/evidence/ev-demo-bol/confirm", {});
    await call("GET", "/data-gaps");
    await call("POST", "/data-gaps/seed", {});
    await call("POST", "/data-gaps", { data_group: "Judge review gap", current_status: "missing" });
    await call("GET", "/electricity-invoices");
    await call("GET", "/fuel-invoices");
    await call("GET", "/carbon-calculations");
    await call("PUT", "/account/profile", { full_name: "Judge Demo Admin" });
    await call("PUT", "/account/company", { name: "WeaveCarbon Judge Demo" });
    await call("POST", "/account/change-password", {});
  });
});
