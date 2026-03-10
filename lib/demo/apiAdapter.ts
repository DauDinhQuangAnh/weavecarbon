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


