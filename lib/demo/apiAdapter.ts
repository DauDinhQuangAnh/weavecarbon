"use client";

import {
  ApiError,
  type ApiRequestAdapter,
} from "@/lib/apiClient";
import type { DemoDataset } from "@/lib/demo/schema";
import { mutateDemoDataset, readDemoDataset } from "@/lib/demo/storage";
import { getDemoAccountPayload, getDemoCheckCompanyPayload, getDemoCompanyMembersPayload } from "@/lib/demo/domain/account";
import { getDemoSubscriptionPayload } from "@/lib/demo/domain/subscription";
import {
  getDemoOverviewPayload,
  saveDemoDashboardTarget
} from "@/lib/demo/domain/overview";
import {
  addDemoBatchItem,
  createDemoBatch,
  createDemoProduct,
  deleteDemoBatch,
  deleteDemoProduct,
  getDemoBatchById,
  getDemoProductById,
  importDemoBulkRows,
  listDemoBatches,
  listDemoProducts,
  publishDemoBatch,
  removeDemoBatchItem,
  updateDemoBatch,
  updateDemoBatchItem,
  updateDemoProduct,
  updateDemoProductStatus,
  validateDemoBulkImport,
} from "@/lib/demo/domain/products";
import {
  createDemoShipment,
  getDemoLogisticsOverview,
  getDemoShipmentById,
  listDemoShipments,
  replaceDemoShipmentLegs,
  replaceDemoShipmentProducts,
  updateDemoShipment,
  updateDemoShipmentStatus,
} from "@/lib/demo/domain/logistics";
import {
  approveDemoComplianceDocument,
  createDemoComplianceReport,
  getDemoComplianceMarkets,
  removeDemoComplianceDocument,
  removeDemoComplianceProduct,
  runDemoComplianceRecommendationAction,
  uploadDemoComplianceDocument,
  upsertDemoComplianceCarbonData,
  upsertDemoComplianceProduct,
} from "@/lib/demo/domain/export";
import {
  createDemoReport,
  deleteDemoReport,
  getDemoExportData,
  getDemoReports,
  getDemoReportSourceCount,
  getDemoReportSourceCounts,
} from "@/lib/demo/domain/reports";
import {
  getDemoAuditTrail,
  getDemoCarbonCalculations,
  getDemoDataGaps,
  getDemoElectricityInvoices,
  getDemoEvidenceDocuments,
  getDemoEvidenceFields,
  getDemoFuelInvoices,
  getDemoSuppliers,
} from "@/lib/demo/domain/operations";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePath = (value: string) => {
  try {
    const parsed = new URL(value, "http://demo.local");
    return `${parsed.pathname.replace(/^\/api(?=\/|$)/, "")}${parsed.search}`;
  } catch {
    return value.replace(/^\/api(?=\/|$)/, "");
  }
};

const parseRequestUrl = (value: string) => new URL(normalizePath(value), "http://demo.local");

const getBodyObject = (value: unknown) => (isObject(value) ? value : {});

const createUnhandledEndpointError = (path: string, method: string) =>
  new ApiError(`Demo adapter does not handle ${method} ${path}.`, {
    status: 501,
    code: "DEMO_ENDPOINT_NOT_IMPLEMENTED",
  });

const getDemoDataset = () => {
  const dataset = readDemoDataset();
  if (!dataset) {
    throw new ApiError("Demo dataset is unavailable.", {
      status: 503,
      code: "DEMO_DATASET_UNAVAILABLE",
    });
  }
  return dataset;
};

const ensurePathMatches = (match: RegExpMatchArray | null, path: string) => {
  if (!match) {
    throw new ApiError(`Invalid demo path: ${path}`, {
      status: 400,
      code: "DEMO_INVALID_PATH",
    });
  }
  return match;
};

const stripQuotes = (value: string) => value.replace(/^"+|"+$/g, "");

const removeProductFromExportScopes = (dataset: DemoDataset, productId: string) => {
  for (const marketCode of Object.keys(dataset.exportCompliance)) {
    const market = dataset.exportCompliance[marketCode] as Record<string, unknown>;
    if (Array.isArray(market.productScope)) {
      market.productScope = market.productScope.filter(
        (item) => String((item as Record<string, unknown>)?.productId || "") !== productId
      );
    }
    if (Array.isArray(market.documents)) {
      market.documents = market.documents.map((document) => {
        const entry = document as Record<string, unknown>;
        if (!Array.isArray(entry.linkedProducts)) {
          return entry;
        }
        return {
          ...entry,
          linkedProducts: entry.linkedProducts.filter((id) => String(id) !== productId),
        };
      });
    }
  }
};

const mutateDemoResult = async <T>(
  mutator: (draft: DemoDataset) => T | Promise<T>
) => {
  const mutation = await mutateDemoDataset(mutator);
  return mutation.result;
};

export const createDemoApiRequestAdapter = (): ApiRequestAdapter => {
  return (async ({ path, method, body }) => {
    const requestUrl = parseRequestUrl(path);
    const pathname = requestUrl.pathname;
    const searchParams = requestUrl.searchParams;

    try {
      if (method === "GET" && pathname === "/auth/check-company") {
        return { handled: true, value: getDemoCheckCompanyPayload() };
      }

      if (method === "GET" && pathname === "/account") {
        return {
          handled: true,
          value: {
            ...getDemoAccountPayload(getDemoDataset()),
          },
        };
      }

      if (method === "GET" && pathname === "/company/members") {
        return {
          handled: true,
          value: getDemoCompanyMembersPayload(getDemoDataset()),
        };
      }

      if (method === "POST" && pathname === "/company/members") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const now = new Date().toISOString();
            const member = {
              id: `demo-member-${Date.now()}`,
              user_id: `demo-member-${Date.now()}`,
              company_id: dataset.company.id,
              full_name: String(payload.full_name || payload.email || "Demo Team Member"),
              email: String(payload.email || `member-${Date.now()}@weavecarbon.demo`),
              role: String(payload.role || "member"),
              status: "invited",
              last_login: null,
              created_at: now,
            };
            dataset.users = [member, ...dataset.users] as DemoDataset["users"];
            return member;
          }),
        };
      }

      if (method === "POST" && /^\/company\/members\/[^/]+\/resend-invite$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/company\/members\/([^/]+)\/resend-invite$/), pathname);
        return {
          handled: true,
          value: {
            success: true,
            id: decodeURIComponent(match[1]),
            resent_at: new Date().toISOString(),
          },
        };
      }

      if (method === "PUT" && /^\/company\/members\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/company\/members\/([^/]+)$/), pathname);
        const memberId = decodeURIComponent(match[1]);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            let updated: Record<string, unknown> | null = null;
            dataset.users = dataset.users.map((rawUser) => {
              const user = rawUser as Record<string, unknown>;
              if (String(user.id || user.user_id || "") !== memberId) return rawUser;
              updated = {
                ...user,
                ...payload,
                id: String(user.id || memberId),
                user_id: String(user.user_id || user.id || memberId),
                updated_at: new Date().toISOString(),
              };
              return updated;
            }) as DemoDataset["users"];
            return updated || { id: memberId, ...payload, updated_at: new Date().toISOString() };
          }),
        };
      }

      if (method === "DELETE" && /^\/company\/members\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/company\/members\/([^/]+)$/), pathname);
        const memberId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            dataset.users = dataset.users.filter((rawUser) => {
              const user = rawUser as Record<string, unknown>;
              const id = String(user.id || user.user_id || "");
              return id !== memberId && id !== dataset.user.id;
            }) as DemoDataset["users"];
            return { success: true };
          }),
        };
      }

      if (method === "GET" && pathname === "/subscription") {
        return {
          handled: true,
          value: getDemoSubscriptionPayload(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/dashboard/overview") {
        return {
          handled: true,
          value: getDemoOverviewPayload(getDemoDataset()),
        };
      }

      if (method === "POST" && pathname === "/dashboard/targets") {
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            saveDemoDashboardTarget(dataset, getBodyObject(body))
          ),
        };
      }

      if (method === "GET" && pathname === "/products") {
        return {
          handled: true,
          value: listDemoProducts(getDemoDataset(), {
            search: searchParams.get("search") || undefined,
            status: (searchParams.get("status") as "draft" | "published" | "all" | null) || undefined,
            page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
            page_size: searchParams.get("page_size") ? Number(searchParams.get("page_size")) : undefined,
          }),
        };
      }

      if (method === "POST" && pathname === "/products") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            createDemoProduct(dataset, payload as never)
          ),
        };
      }

      if (method === "POST" && pathname === "/products/bulk-import/validate") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: validateDemoBulkImport(Array.isArray(payload.rows) ? payload.rows : []),
        };
      }

      if (method === "POST" && pathname === "/products/bulk-import") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            importDemoBulkRows(
              dataset,
              Array.isArray(payload.rows) ? payload.rows : [],
              String(payload.save_mode || "draft") === "publish" ? "publish" : "draft"
            )
          ),
        };
      }

      if (method === "GET" && /^\/products\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/products\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: getDemoProductById(getDemoDataset(), decodeURIComponent(match[1])),
        };
      }

      if (method === "PUT" && /^\/products\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/products\/([^/]+)$/), pathname);
        const productId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoProduct(dataset, productId, body as never)
          ),
        };
      }

      if (method === "PATCH" && /^\/products\/[^/]+\/status$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/products\/([^/]+)\/status$/), pathname);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoProductStatus(
              dataset,
              decodeURIComponent(match[1]),
              String(payload.status || "draft") === "published" ? "published" : "draft"
            )
          ),
        };
      }

      if (method === "DELETE" && /^\/products\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/products\/([^/]+)$/), pathname);
        const productId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            deleteDemoProduct(dataset, productId);
            removeProductFromExportScopes(dataset, productId);
            return { success: true };
          }),
        };
      }

      if (method === "GET" && pathname === "/product-batches") {
        return {
          handled: true,
          value: listDemoBatches(getDemoDataset(), {
            search: searchParams.get("search") || undefined,
            status: (searchParams.get("status") as "draft" | "published" | "archived" | "all" | null) || undefined,
            page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
            page_size: searchParams.get("page_size") ? Number(searchParams.get("page_size")) : undefined,
          }),
        };
      }

      if (method === "POST" && pathname === "/product-batches") {
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => createDemoBatch(dataset, body as never)),
        };
      }

      if (method === "GET" && /^\/product-batches\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: getDemoBatchById(getDemoDataset(), decodeURIComponent(match[1])),
        };
      }

      if (method === "PATCH" && /^\/product-batches\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoBatch(dataset, decodeURIComponent(match[1]), body as never)
          ),
        };
      }

      if (method === "DELETE" && /^\/product-batches\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            deleteDemoBatch(dataset, decodeURIComponent(match[1]));
            return { success: true };
          }),
        };
      }

      if (method === "POST" && /^\/product-batches\/[^/]+\/items$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)\/items$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            addDemoBatchItem(dataset, decodeURIComponent(match[1]), body as never);
            return { success: true };
          }),
        };
      }

      if (method === "PATCH" && /^\/product-batches\/[^/]+\/items\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(
          pathname.match(/^\/product-batches\/([^/]+)\/items\/([^/]+)$/),
          pathname
        );
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            updateDemoBatchItem(
              dataset,
              decodeURIComponent(match[1]),
              decodeURIComponent(match[2]),
              body as never
            );
            return { success: true };
          }),
        };
      }

      if (method === "DELETE" && /^\/product-batches\/[^/]+\/items\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(
          pathname.match(/^\/product-batches\/([^/]+)\/items\/([^/]+)$/),
          pathname
        );
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            removeDemoBatchItem(dataset, decodeURIComponent(match[1]), decodeURIComponent(match[2]));
            return { success: true };
          }),
        };
      }

      if (method === "PATCH" && /^\/product-batches\/[^/]+\/publish$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)\/publish$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            publishDemoBatch(dataset, decodeURIComponent(match[1]))
          ),
        };
      }

      if (method === "GET" && pathname === "/logistics/shipments") {
        return {
          handled: true,
          value: listDemoShipments(getDemoDataset(), {
            search: searchParams.get("search") || undefined,
            status:
              (searchParams.get("status") as "pending" | "in_transit" | "delivered" | "cancelled" | "all" | null) ||
              undefined,
            transport_mode:
              (searchParams.get("transport_mode") as "road" | "sea" | "air" | "rail" | null) || undefined,
            page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
            page_size: searchParams.get("page_size") ? Number(searchParams.get("page_size")) : undefined,
          }),
        };
      }

      if (method === "POST" && pathname === "/logistics/shipments") {
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => createDemoShipment(dataset, body as never)),
        };
      }

      if (method === "GET" && /^\/logistics\/shipments\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/logistics\/shipments\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: getDemoShipmentById(getDemoDataset(), decodeURIComponent(match[1])),
        };
      }

      if (method === "PATCH" && /^\/logistics\/shipments\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/logistics\/shipments\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoShipment(dataset, decodeURIComponent(match[1]), body as never)
          ),
        };
      }

      if (method === "PATCH" && /^\/logistics\/shipments\/[^/]+\/status$/.test(pathname)) {
        const match = ensurePathMatches(
          pathname.match(/^\/logistics\/shipments\/([^/]+)\/status$/),
          pathname
        );
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoShipmentStatus(
              dataset,
              decodeURIComponent(match[1]),
              String(payload.status || "pending") as never,
              typeof payload.actual_arrival === "string" ? payload.actual_arrival : undefined
            )
          ),
        };
      }

      if (method === "PUT" && /^\/logistics\/shipments\/[^/]+\/legs$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/logistics\/shipments\/([^/]+)\/legs$/), pathname);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            replaceDemoShipmentLegs(
              dataset,
              decodeURIComponent(match[1]),
              Array.isArray(payload.legs) ? payload.legs : []
            );
            return { success: true };
          }),
        };
      }

      if (method === "PUT" && /^\/logistics\/shipments\/[^/]+\/products$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/logistics\/shipments\/([^/]+)\/products$/), pathname);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            replaceDemoShipmentProducts(
              dataset,
              decodeURIComponent(match[1]),
              Array.isArray(payload.products) ? payload.products : []
            );
            return { success: true };
          }),
        };
      }

      if (method === "GET" && pathname === "/logistics/overview") {
        return {
          handled: true,
          value: getDemoLogisticsOverview(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/export/markets") {
        return {
          handled: true,
          value: getDemoComplianceMarkets(getDemoDataset()),
        };
      }

      if (pathname.startsWith("/export/markets/")) {
        const parts = pathname.split("/").filter(Boolean);
        const marketCode = decodeURIComponent(stripQuotes(parts[2] || "")) as never;

        if (method === "POST" && parts[3] === "recommendations" && parts[5] === "actions") {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              runDemoComplianceRecommendationAction(
                dataset,
                marketCode,
                decodeURIComponent(parts[4] || ""),
                String(payload.action || "")
              );
              return { success: true };
            }),
          };
        }

        if (method === "POST" && parts[3] === "products" && parts.length === 4) {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              upsertDemoComplianceProduct(dataset, marketCode, {
                productName: String(payload.product_name || ""),
                hsCode: String(payload.hs_code || ""),
                productionSite: String(payload.production_site || ""),
                exportVolume: Number(payload.export_volume || 0),
                unit: String(payload.unit || "pcs"),
              });
              return { success: true };
            }),
          };
        }

        if (method === "PATCH" && parts[3] === "products" && parts.length === 5) {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              upsertDemoComplianceProduct(dataset, marketCode, {
                productId: decodeURIComponent(parts[4] || ""),
                productName: String(payload.product_name || ""),
                hsCode: String(payload.hs_code || ""),
                productionSite: String(payload.production_site || ""),
                exportVolume: Number(payload.export_volume || 0),
                unit: String(payload.unit || "pcs"),
              });
              return { success: true };
            }),
          };
        }

        if (method === "DELETE" && parts[3] === "products" && parts.length === 5) {
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              removeDemoComplianceProduct(dataset, marketCode, decodeURIComponent(parts[4] || ""));
              return { success: true };
            }),
          };
        }

        if (method === "PATCH" && parts[3] === "carbon-data" && parts.length === 5) {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              upsertDemoComplianceCarbonData(dataset, marketCode, {
                scope: decodeURIComponent(parts[4] || "") as never,
                value: Number(payload.value || 0),
                unit: String(payload.unit || "tCO2e"),
                methodology: String(payload.methodology || ""),
                dataSource: String(payload.data_source || payload.dataSource || ""),
                reportingPeriod: String(payload.reporting_period || payload.reportingPeriod || ""),
                isComplete: true,
              });
              return { success: true };
            }),
          };
        }

        if (method === "POST" && parts[3] === "documents" && parts[5] === "upload") {
          const formData = body instanceof FormData ? body : null;
          const file = formData?.get("file");
          if (!(file instanceof File)) {
            throw new ApiError("Demo upload requires a PDF file.", {
              status: 400,
              code: "DEMO_FILE_REQUIRED",
            });
          }
          return {
            handled: true,
            value: await mutateDemoResult(async (dataset) => {
              await uploadDemoComplianceDocument(dataset, marketCode, decodeURIComponent(parts[4] || ""), file);
              return { success: true };
            }),
          };
        }

        if (method === "DELETE" && parts[3] === "documents" && parts.length === 5) {
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              removeDemoComplianceDocument(dataset, marketCode, decodeURIComponent(parts[4] || ""));
              return { success: true };
            }),
          };
        }

        if (method === "POST" && parts[3] === "documents" && parts[5] === "approve") {
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              approveDemoComplianceDocument(dataset, marketCode, decodeURIComponent(parts[4] || ""));
              return { success: true };
            }),
          };
        }

        if (method === "POST" && parts[3] === "reports" && parts.length === 4) {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) =>
              createDemoComplianceReport(
                dataset,
                marketCode,
                String(payload.file_format || "xlsx") as "csv" | "xlsx" | "pdf"
              )
            ),
          };
        }
      }

      if (method === "GET" && pathname === "/reports") {
        return {
          handled: true,
          value: getDemoReports(getDemoDataset()),
        };
      }

      if (method === "POST" && pathname === "/reports") {
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => createDemoReport(dataset, getBodyObject(body))),
        };
      }

      if (method === "GET" && /^\/reports\/[^/]+\/status$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/reports\/([^/]+)\/status$/), pathname);
        const reportId = decodeURIComponent(match[1]);
        const report = getDemoReports(getDemoDataset()).find((item) => item.id === reportId);
        return {
          handled: true,
          value: {
            id: reportId,
            status: report?.status || "completed",
            download_url: report?.downloadUrl || `demo://report/${reportId}`,
          },
        };
      }

      if (method === "DELETE" && /^\/reports\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/reports\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            deleteDemoReport(dataset, decodeURIComponent(match[1]));
            return { success: true };
          }),
        };
      }

      if (method === "GET" && pathname === "/reports/export-sources") {
        return {
          handled: true,
          value: getDemoReportSourceCounts(getDemoDataset()),
        };
      }

      if (method === "GET" && /^\/reports\/export-sources\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/reports\/export-sources\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: {
            count: getDemoReportSourceCount(getDemoDataset(), decodeURIComponent(match[1]) as never),
          },
        };
      }

      if (method === "GET" && /^\/reports\/export-data\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/reports\/export-data\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: getDemoExportData(getDemoDataset(), decodeURIComponent(match[1]) as never),
        };
      }

      if (method === "GET" && pathname === "/audit-trail") {
        return {
          handled: true,
          value: getDemoAuditTrail(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/suppliers") {
        return {
          handled: true,
          value: getDemoSuppliers(getDemoDataset()),
        };
      }

      if (method === "POST" && pathname === "/suppliers") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: {
            id: `sup-${Date.now()}`,
            company_id: "00000000-0000-4000-8000-000000000001",
            supplier_name: String(payload.supplier_name || payload.name || "New demo supplier"),
            supplier_email: String(payload.supplier_email || payload.email || "supplier@example.com"),
            material_supplied: String(payload.material_supplied || "Material evidence"),
            required_data: Array.isArray(payload.required_data)
              ? payload.required_data
              : ["Emission factor", "Invoice", "Certificate"],
            deadline: String(
              payload.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            ),
            status: String(payload.status || "pending"),
            created_at: new Date().toISOString(),
            ...payload,
          },
        };
      }

      if (method === "GET" && pathname === "/evidence") {
        const allDocuments = getDemoEvidenceDocuments(getDemoDataset());
        const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
        const pageSize = searchParams.get("page_size") ? Number(searchParams.get("page_size")) : allDocuments.length;
        const safePage = Number.isFinite(page) && page > 0 ? page : 1;
        const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : allDocuments.length;
        const start = (safePage - 1) * safePageSize;
        const items = allDocuments.slice(start, start + safePageSize);
        return {
          handled: true,
          value: {
            items,
            total: allDocuments.length,
            page: safePage,
            page_size: safePageSize,
          },
        };
      }

      if (method === "POST" && pathname === "/evidence/upload") {
        return {
          handled: true,
          value: {
            id: `ev-demo-${Date.now()}`,
            company_id: "00000000-0000-4000-8000-000000000001",
            kind: "supplier_declaration",
            status: "processing",
            file_name: "demo-upload.pdf",
            storage_path: "demo/pending.pdf",
            mime_type: "application/pdf",
            ocr_confidence: null,
            trust_score: 61,
            verification_level: "pending",
            file_hash_sha256: "pending-demo-upload-hash",
            warnings: ["OCR processing in demo mode"],
            created_at: new Date().toISOString(),
            extracted: {},
          },
        };
      }

      if (method === "GET" && /^\/evidence\/[^/]+\/fields$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/evidence\/([^/]+)\/fields$/), pathname);
        return {
          handled: true,
          value: getDemoEvidenceFields(getDemoDataset(), decodeURIComponent(match[1])),
        };
      }

      if (method === "GET" && pathname === "/data-gaps") {
        return {
          handled: true,
          value: getDemoDataGaps(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/electricity-invoices") {
        return {
          handled: true,
          value: getDemoElectricityInvoices(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/fuel-invoices") {
        return {
          handled: true,
          value: getDemoFuelInvoices(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/carbon-calculations") {
        return {
          handled: true,
          value: getDemoCarbonCalculations(getDemoDataset()),
        };
      }
      // ── Audit Trail ────────────────────────────────────────────
      if (method === "GET" && pathname === "/audit-trail") {
        return {
          handled: true,
          value: [
            { id: "at-1", action: "product.create", resource_type: "product", resource_id: "prod-1", resource_name: "Organic Cotton Tee", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-20T08:12:00.000Z", meta: {} },
            { id: "at-2", action: "product.publish", resource_type: "product", resource_id: "prod-1", resource_name: "Organic Cotton Tee", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-20T09:00:00.000Z", meta: {} },
            { id: "at-3", action: "evidence.upload", resource_type: "evidence", resource_id: "ev-1", resource_name: "EVN-Invoice-May2026.pdf", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-21T10:30:00.000Z", meta: {} },
            { id: "at-4", action: "product.create", resource_type: "product", resource_id: "prod-2", resource_name: "Recycled Polyester Shirt", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-22T08:00:00.000Z", meta: {} },
            { id: "at-5", action: "report.generate", resource_type: "report", resource_id: "rep-1", resource_name: "CBAM Q2/2026 Report", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-23T14:00:00.000Z", meta: {} },
            { id: "at-6", action: "shipment.create", resource_type: "shipment", resource_id: "ship-1", resource_name: "LOT-EU-2026-001 → Hamburg", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-24T11:15:00.000Z", meta: {} },
            { id: "at-7", action: "evidence.verify", resource_type: "evidence", resource_id: "ev-1", resource_name: "EVN-Invoice-May2026.pdf", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-25T09:45:00.000Z", meta: {} },
            { id: "at-8", action: "supplier.invite", resource_type: "supplier", resource_id: "sup-1", resource_name: "Viet Thang Textile Co.", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-26T13:00:00.000Z", meta: {} },
            { id: "at-9", action: "product.update", resource_type: "product", resource_id: "prod-2", resource_name: "Recycled Polyester Shirt", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-27T10:00:00.000Z", meta: {} },
            { id: "at-10", action: "report.generate", resource_type: "report", resource_id: "rep-2", resource_name: "Audit Pack Q2/2026", actor_email: "demo.b2b@weavecarbon.com", actor_name: "Demo B2B Admin", created_at: "2026-06-28T08:30:00.000Z", meta: {} },
          ],
        };
      }

      // ── Suppliers ──────────────────────────────────────────────
      if (method === "GET" && pathname === "/suppliers") {
        return {
          handled: true,
          value: [
            { id: "sup-1", company_id: "00000000-0000-4000-8000-000000000001", name: "Viet Thang Textile Co.", email: "contact@vietthangtex.vn", phone: "028-3812-5500", address: "123 Nguyen Van Cu, Q.5, TP.HCM", tier: "tier1", status: "active", carbon_score: 72, invited_at: "2026-05-10T08:00:00.000Z", responded_at: "2026-05-12T09:00:00.000Z" },
            { id: "sup-2", company_id: "00000000-0000-4000-8000-000000000001", name: "Green Dye Factory", email: "info@greendye.vn", phone: "0251-3920-111", address: "KCN Long Binh, Bien Hoa, Dong Nai", tier: "tier2", status: "pending", carbon_score: null, invited_at: "2026-06-01T08:00:00.000Z", responded_at: null },
            { id: "sup-3", company_id: "00000000-0000-4000-8000-000000000001", name: "EcoSpin Cotton Yarn", email: "supply@ecospinvn.com", phone: "0236-3888-999", address: "KCN Da Nang, Lien Chieu, Da Nang", tier: "tier1", status: "active", carbon_score: 85, invited_at: "2026-04-15T08:00:00.000Z", responded_at: "2026-04-18T14:00:00.000Z" },
            { id: "sup-4", company_id: "00000000-0000-4000-8000-000000000001", name: "Pacific Shipping Lines", email: "ops@pacificshipping.com", phone: "028-3914-2200", address: "Cang Cat Lai, Q.2, TP.HCM", tier: "tier3", status: "active", carbon_score: 61, invited_at: "2026-03-20T08:00:00.000Z", responded_at: "2026-03-25T10:00:00.000Z" },
          ],
        };
      }

      if (method === "POST" && pathname === "/suppliers") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: { id: `sup-${Date.now()}`, company_id: "00000000-0000-4000-8000-000000000001", status: "pending", carbon_score: null, invited_at: new Date().toISOString(), responded_at: null, ...payload },
        };
      }

      if (method === "PUT" && /^\/suppliers\/[^/]+$/.test(pathname)) {
        const payload = getBodyObject(body);
        return { handled: true, value: { ...payload, updated_at: new Date().toISOString() } };
      }

      // ── Evidence ───────────────────────────────────────────────
      if (method === "GET" && pathname === "/evidence") {
        return {
          handled: true,
          value: {
            data: [
              { id: "ev-1", company_id: "00000000-0000-4000-8000-000000000001", kind: "electricity_bill", status: "verified", file_name: "EVN-Invoice-May2026.pdf", storage_path: "demo/ev-1.pdf", mime_type: "application/pdf", ocr_confidence: 94, ocr_error: null, created_at: "2026-06-21T10:30:00.000Z", extracted: { supplier: "EVN HCMC", period_start: "2026-05-01", period_end: "2026-05-31", kwh_total: 48200, amount_vnd: 96400000 } },
              { id: "ev-2", company_id: "00000000-0000-4000-8000-000000000001", kind: "fuel_receipt", status: "extracted", file_name: "Diesel-Receipt-Jun2026.pdf", storage_path: "demo/ev-2.pdf", mime_type: "application/pdf", ocr_confidence: 88, ocr_error: null, created_at: "2026-06-25T08:00:00.000Z", extracted: { supplier: "Petrolimex", period_start: "2026-06-01", period_end: "2026-06-30", liters: 3200, amount_vnd: 72000000 } },
              { id: "ev-3", company_id: "00000000-0000-4000-8000-000000000001", kind: "transport_bol", status: "pending", file_name: "BOL-LOT-EU-2026-001.pdf", storage_path: "demo/ev-3.pdf", mime_type: "application/pdf", ocr_confidence: null, ocr_error: null, created_at: "2026-06-28T07:00:00.000Z", extracted: {} },
            ],
            total: 3,
            page: 1,
            page_size: 20,
          },
        };
      }

      if (method === "POST" && pathname === "/evidence/upload") {
        return {
          handled: true,
          value: { id: `ev-demo-${Date.now()}`, company_id: "00000000-0000-4000-8000-000000000001", kind: "other", status: "processing", file_name: "demo-upload.pdf", storage_path: "demo/pending.pdf", mime_type: "application/pdf", ocr_confidence: null, ocr_error: null, created_at: new Date().toISOString(), extracted: {} },
        };
      }

      if (method === "PATCH" && /^\/evidence\/[^/]+\/fields$/.test(pathname)) {
        return { handled: true, value: { success: true } };
      }

      if (method === "POST" && /^\/evidence\/[^/]+\/confirm$/.test(pathname)) {
        return { handled: true, value: { success: true } };
      }

      if (method === "POST" && /^\/evidence\/[^/]+\/verify$/.test(pathname)) {
        return { handled: true, value: { success: true } };
      }

      // ── Data Gaps ──────────────────────────────────────────────
      if (method === "GET" && pathname === "/data-gaps") {
        return {
          handled: true,
          value: [
            { id: "dg-1", company_id: "00000000-0000-4000-8000-000000000001", data_group: "Dyeing supplier energy data", required_for_audit: true, current_status: "uploaded", risk_level: "low", required_action: "Tải hóa đơn điện từ nhà máy nhuộm", owner: "Phòng Mua Hàng", deadline: "2026-07-15" },
            { id: "dg-2", company_id: "00000000-0000-4000-8000-000000000001", data_group: "Diesel/thermal process evidence", required_for_audit: true, current_status: "verified", risk_level: "low", required_action: "Biên lai nhiên liệu tháng 5-6/2026", owner: "Phòng Kỹ Thuật", deadline: "2026-07-20" },
            { id: "dg-3", company_id: "00000000-0000-4000-8000-000000000001", data_group: "Sea freight document (LOT-EU-2026-001)", required_for_audit: true, current_status: "missing", risk_level: "high", required_action: "Liên hệ Pacific Shipping để lấy vận đơn", owner: "Phòng Xuất Nhập Khẩu", deadline: "2026-07-10" },
            { id: "dg-4", company_id: "00000000-0000-4000-8000-000000000001", data_group: "BOM and electricity invoice", required_for_audit: true, current_status: "uploaded", risk_level: "medium", required_action: "Xác nhận BOM Q2 với phòng sản xuất", owner: "Phòng Sản Xuất", deadline: "2026-07-30" },
            { id: "dg-5", company_id: "00000000-0000-4000-8000-000000000001", data_group: "GOTS certification for cotton lot 2026", required_for_audit: false, current_status: "proxy", risk_level: "medium", required_action: "Yêu cầu EcoSpin cung cấp chứng chỉ GOTS", owner: "Phòng QC", deadline: "2026-08-01" },
            { id: "dg-6", company_id: "00000000-0000-4000-8000-000000000001", data_group: "Scope 1 fuel emission factor verification", required_for_audit: true, current_status: "self_declared", risk_level: "low", required_action: "Đối chiếu với hệ số DEFRA 2024", owner: "Phòng Môi Trường", deadline: "2026-07-25" },
          ],
        };
      }

      if (method === "POST" && pathname === "/data-gaps/seed") {
        return { handled: true, value: { seeded: 6, message: "Demo seed data already loaded." } };
      }

      if (method === "POST" && pathname === "/data-gaps") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: { id: `dg-${Date.now()}`, company_id: "00000000-0000-4000-8000-000000000001", required_for_audit: true, ...payload },
        };
      }

      if (method === "PUT" && /^\/data-gaps\/[^/]+$/.test(pathname)) {
        const payload = getBodyObject(body);
        return { handled: true, value: { ...payload, updated_at: new Date().toISOString() } };
      }

      // ── Electricity Invoices ───────────────────────────────────
      if (method === "GET" && pathname === "/electricity-invoices") {
        return {
          handled: true,
          value: [
            { id: "elec-1", company_id: "00000000-0000-4000-8000-000000000001", provider: "EVN HCMC", invoice_number: "EVN-HCM-052026-00142", period_start: "2026-05-01", period_end: "2026-05-31", kwh_total: 48200, amount_vnd: 96400000, co2_kg: 21209, emission_factor: 0.44, created_at: "2026-06-05T08:00:00.000Z" },
            { id: "elec-2", company_id: "00000000-0000-4000-8000-000000000001", provider: "EVN HCMC", invoice_number: "EVN-HCM-042026-00098", period_start: "2026-04-01", period_end: "2026-04-30", kwh_total: 45800, amount_vnd: 91600000, co2_kg: 20152, emission_factor: 0.44, created_at: "2026-05-06T08:00:00.000Z" },
            { id: "elec-3", company_id: "00000000-0000-4000-8000-000000000001", provider: "EVN HCMC", invoice_number: "EVN-HCM-032026-00071", period_start: "2026-03-01", period_end: "2026-03-31", kwh_total: 43100, amount_vnd: 86200000, co2_kg: 18964, emission_factor: 0.44, created_at: "2026-04-04T08:00:00.000Z" },
          ],
        };
      }

      if (method === "POST" && pathname === "/electricity-invoices") {
        const payload = getBodyObject(body);
        return { handled: true, value: { id: `elec-${Date.now()}`, company_id: "00000000-0000-4000-8000-000000000001", created_at: new Date().toISOString(), ...payload } };
      }

      // ── Fuel Invoices ──────────────────────────────────────────
      if (method === "GET" && pathname === "/fuel-invoices") {
        return {
          handled: true,
          value: [
            { id: "fuel-1", company_id: "00000000-0000-4000-8000-000000000001", provider: "Petrolimex", invoice_number: "PL-HCM-062026-3821", fuel_type: "diesel", period_start: "2026-06-01", period_end: "2026-06-30", liters: 3200, amount_vnd: 72000000, co2_kg: 8448, emission_factor: 2.64, created_at: "2026-07-02T08:00:00.000Z" },
            { id: "fuel-2", company_id: "00000000-0000-4000-8000-000000000001", provider: "Petrolimex", invoice_number: "PL-HCM-052026-3105", fuel_type: "diesel", period_start: "2026-05-01", period_end: "2026-05-31", liters: 2900, amount_vnd: 65250000, co2_kg: 7656, emission_factor: 2.64, created_at: "2026-06-03T08:00:00.000Z" },
          ],
        };
      }

      if (method === "POST" && pathname === "/fuel-invoices") {
        const payload = getBodyObject(body);
        return { handled: true, value: { id: `fuel-${Date.now()}`, company_id: "00000000-0000-4000-8000-000000000001", created_at: new Date().toISOString(), ...payload } };
      }

      // ── Carbon Calculations ────────────────────────────────────
      if (method === "GET" && pathname === "/carbon-calculations") {
        return {
          handled: true,
          value: [
            { id: "calc-1", company_id: "00000000-0000-4000-8000-000000000001", product_id: "00000000-0000-4000-8000-000000000100", product_name: "Organic Cotton Tee", scope1_kg: 312, scope2_kg: 21209, scope3_kg: 4820, total_kg: 26341, confidence_score: 88, methodology: "ISO 14067", calculated_at: "2026-06-20T09:00:00.000Z" },
            { id: "calc-2", company_id: "00000000-0000-4000-8000-000000000001", product_id: "00000000-0000-4000-8000-000000000101", product_name: "Recycled Polyester Shirt", scope1_kg: 280, scope2_kg: 18900, scope3_kg: 6100, total_kg: 25280, confidence_score: 81, methodology: "ISO 14067", calculated_at: "2026-06-22T10:00:00.000Z" },
          ],
        };
      }

      // ── Account profile update ─────────────────────────────────
      if (method === "PUT" && pathname === "/account/profile") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            dataset.user = {
              ...dataset.user,
              ...payload,
              updated_at: new Date().toISOString(),
            };
            dataset.users = dataset.users.map((rawUser) => {
              const user = rawUser as Record<string, unknown>;
              if (String(user.id || user.user_id || "") !== dataset.user.id) return rawUser;
              return {
                ...user,
                ...payload,
                updated_at: new Date().toISOString(),
              };
            }) as DemoDataset["users"];
            return {
              full_name: dataset.user.full_name,
              email: dataset.user.email,
            };
          }),
        };
      }

      if ((method === "PUT" || method === "POST") && pathname === "/account/company") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            dataset.company = {
              ...dataset.company,
              ...payload,
              updated_at: new Date().toISOString(),
            };
            return getDemoAccountPayload(dataset).company;
          }),
        };
      }

      if (method === "POST" && pathname === "/account/change-password") {
        return { handled: true, value: { success: true, message: "Password updated (demo — no actual change)." } };
      }

      // ── Subscription upgrade (billing) ─────────────────────────
      if (method === "POST" && pathname === "/subscription/upgrade") {
        return { handled: true, value: { success: true, checkout_url: null, message: "Demo mode — upgrade not processed." } };
      }

      if (method === "GET" && pathname.startsWith("/subscription/payment-status")) {
        return { handled: true, value: { status: "demo", plan: "standard", message: "Demo session — payment not required." } };
      }

    } catch (error) {
      if (error instanceof ApiError) {
        return { handled: true, error };
      }
      const message = error instanceof Error ? error.message : "Demo request failed.";
      return {
        handled: true,
        error: new ApiError(message, {
          status: 400,
          code: "DEMO_REQUEST_FAILED",
        }),
      };
    }

    return {
      handled: true,
      error: createUnhandledEndpointError(pathname, method),
    };
  }) as ApiRequestAdapter;
};
